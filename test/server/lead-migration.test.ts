// Checks the new applySchema on a database made before go to the lead (the old schema and old db.ts migrations, inlined). Throwaway files only, never a real hud.db.
import { Database } from "bun:sqlite";
import { expect, test } from "bun:test";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applySchema } from "../../src/server/schema.ts";

const OLD = join(import.meta.dir, "fixtures", "schema-before-leads");

// The old db.ts, verbatim in effect.
function oldApply(db: Database) {
  for (const f of readdirSync(OLD).filter((f) => f.endsWith(".sql")).sort()) db.exec(readFileSync(join(OLD, f), "utf8"));
  if (!(db.query("PRAGMA table_info(lanes)").all() as { name: string }[]).some((c) => c.name === "bg")) db.exec("ALTER TABLE lanes ADD COLUMN bg TEXT");
  if (!(db.query("PRAGMA table_info(asks)").all() as { name: string }[]).some((c) => c.name === "secrets")) db.exec("ALTER TABLE asks ADD COLUMN secrets TEXT");
  if (!(db.query("PRAGMA table_info(lanes)").all() as { name: string }[]).some((c) => c.name === "parent")) db.exec("ALTER TABLE lanes ADD COLUMN parent TEXT");
  if (!(db.query("PRAGMA table_info(lanes)").all() as { name: string }[]).some((c) => c.name === "prompt")) db.exec("ALTER TABLE lanes ADD COLUMN prompt TEXT");
  const askColumns = new Set((db.query("PRAGMA table_info(asks)").all() as { name: string }[]).map((c) => c.name));
  for (const [col, def] of [
    ["tier", "TEXT NOT NULL DEFAULT 'nonblocking'"],
    ["priority", "INTEGER NOT NULL DEFAULT 2"],
    ["tier_locked", "INTEGER NOT NULL DEFAULT 0"],
    ["tier_by", "TEXT"],
    ["tier_at", "INTEGER"],
  ]) if (!askColumns.has(col)) db.exec(`ALTER TABLE asks ADD COLUMN ${col} ${def}`);
}

const tables = (db: Database) => (db.query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all() as { name: string }[]).map((r) => r.name);
const snap = (db: Database) => Object.fromEntries(tables(db).map((t) => [t, db.query(`SELECT * FROM ${t} ORDER BY rowid`).all()]));
const schemaText = (db: Database) => (db.query("SELECT type, name, sql FROM sqlite_master ORDER BY name").all() as any[]);

function seed(db: Database) {
  const now = Date.now();
  db.query("INSERT INTO lanes (name, machine, herdr, phase, parent) VALUES ('lead','local','idle','running',NULL), ('kid','local','idle','running','lead')").run();
  db.query("INSERT INTO asks (lane, title, created_at) VALUES ('kid','Open before',?)").run(now - 60_000);
  db.query("INSERT INTO asks (lane, title, created_at, status, answer, answered_at) VALUES ('kid','Answered before',?, 'answered','Yes, the real answer',?)").run(now - 120_000, now - 30_000);
  db.query("INSERT INTO asks (lane, title, created_at, status, answer, answered_at, tier, priority, tier_locked, tier_by, tier_at, secrets) VALUES ('kid','Blocking before',?, 'open',NULL,NULL,'blocking',1,1,'lane',?, '[\"K\"]')").run(now, now);
  db.query("INSERT INTO settings (key, value, updated_at) VALUES ('sound','true',?)").run(now);
}

const dir = mkdtempSync(join(tmpdir(), "lead-review-mig-"));

test("old-code database: new applySchema keeps every row and column, adds holder/answered_by/ask_routes, and is idempotent", () => {
  const file = join(dir, "a.db");
  const db = new Database(file, { create: true });
  db.exec("PRAGMA journal_mode = WAL;");
  oldApply(db);
  seed(db);
  const before = snap(db);
  applySchema(db);
  const after = snap(db);
  for (const [t, rows] of Object.entries(before)) {
    expect(after[t].length).toBe((rows as any[]).length);
    (rows as any[]).forEach((r, i) => expect(after[t][i]).toMatchObject(r));
  }
  for (const r of after.asks as any[]) expect(r).toMatchObject({ holder: null, answered_by: null });
  expect(after.ask_routes).toEqual([]);
  const s1 = schemaText(db);
  applySchema(db);
  applySchema(db);
  expect(schemaText(db)).toEqual(s1);
  expect(snap(db)).toEqual(after);
  db.close();
});

test("a crash between the two ALTERs (holder added, answered_by not) recovers on the next start", () => {
  const db = new Database(join(dir, "b.db"), { create: true });
  oldApply(db);
  seed(db);
  db.exec("ALTER TABLE asks ADD COLUMN holder TEXT");
  const before = snap(db);
  applySchema(db);
  const cols = (db.query("PRAGMA table_info(asks)").all() as { name: string }[]).map((c) => c.name);
  expect(cols).toEqual(expect.arrayContaining(["holder", "answered_by"]));
  (before.asks as any[]).forEach((r, i) => expect((snap(db).asks as any[])[i]).toMatchObject(r));
  db.close();
});

test("the oldest shape (asks without secrets/tier, lanes without bg/parent/prompt) migrates in one start", () => {
  const db = new Database(join(dir, "c.db"), { create: true });
  db.exec(readFileSync(join(OLD, "asks.sql"), "utf8"));
  db.exec(`CREATE TABLE lanes (name TEXT PRIMARY KEY, title TEXT, machine TEXT, pane TEXT, agent TEXT, herdr TEXT, herdr_since INTEGER, herdr_seen INTEGER, issue TEXT, pr TEXT, phase TEXT NOT NULL DEFAULT 'running', note TEXT, updated_at INTEGER)`);
  db.query("INSERT INTO asks (lane, title, created_at, status, answer) VALUES ('x','Ancient',1,'answered','kept')").run();
  db.query("INSERT INTO lanes (name) VALUES ('x')").run();
  applySchema(db);
  expect(db.query("SELECT * FROM asks").get()).toMatchObject({ title: "Ancient", answer: "kept", tier: "nonblocking", priority: 2, holder: null, answered_by: null });
  expect(db.query("SELECT * FROM lanes").get()).toMatchObject({ name: "x", bg: null, parent: null, prompt: null });
  db.close();
});

test("the old code still opens a database the new code migrated (rollback safety)", () => {
  const db = new Database(join(dir, "d.db"), { create: true });
  oldApply(db);
  seed(db);
  applySchema(db);
  oldApply(db); // a downgrade: old db.ts on the new database
  expect((db.query("SELECT COUNT(*) n FROM asks").get() as any).n).toBe(3);
  db.close();
  rmSync(dir, { recursive: true, force: true });
});
