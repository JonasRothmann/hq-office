// The tables: every schema/*.sql file (CREATE ... IF NOT EXISTS) in name order, then the additive migrations for
// databases made before a column existed. Takes the database, so a test can build one in memory.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Database } from "bun:sqlite";

const SCHEMA = join(import.meta.dir, "schema");

const columns = (db: Database, table: string) => new Set((db.query(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((c) => c.name));
function addColumns(db: Database, table: string, defs: [string, string][]) {
  const have = columns(db, table);
  for (const [col, def] of defs) if (!have.has(col)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`);
}

export function applySchema(db: Database) {
  for (const f of readdirSync(SCHEMA).filter((f) => f.endsWith(".sql")).sort()) db.exec(readFileSync(join(SCHEMA, f), "utf8"));
  // Migrations; they run after the tables exist.
  addColumns(db, "lanes", [
    // What an idle agent still has running in the background (for example "2 shells still running"), from its pane.
    ["bg", "TEXT"],
    // The lane a lane reports to; empty means straight under HQ. Depth is computed from the chain, never stored.
    ["parent", "TEXT"],
    // blocked-prompts: the excerpt of the prompt a lane's agent waits on in herdr (null when none); see prompt.ts.
    ["prompt", "TEXT"],
  ]);
  addColumns(db, "asks", [
    // Names of the secrets an ask requests (JSON array). Names only: values never reach the database.
    ["secrets", "TEXT"],
    // Question tiers (docs/spec-3d-office.md, section 2): blocking or not, a priority (0 urgent .. 3 low), whether the
    // asking lane locked it as blocking, and who last set tier or priority, and when. Older asks read as
    // non-blocking, normal, unlocked.
    ["tier", "TEXT NOT NULL DEFAULT 'nonblocking'"],
    ["priority", "INTEGER NOT NULL DEFAULT 2"],
    ["tier_locked", "INTEGER NOT NULL DEFAULT 0"],
    ["tier_by", "TEXT"],
    ["tier_at", "INTEGER"],
    // Go to the lead (decision D20): the lead lane holding an open ask (null: the owner), and the lane that answered
    // it (null: the owner). Older asks read as the owner's.
    ["holder", "TEXT"],
    ["answered_by", "TEXT"],
  ]);
}
