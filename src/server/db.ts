// The SQLite database. Each table's schema is a file in schema/, applied at startup in name order.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Database } from "bun:sqlite";
import { DATA } from "./config.ts";

export const db = new Database(`${DATA}/hud.db`, { create: true });
db.exec("PRAGMA journal_mode = WAL;");
const SCHEMA = join(import.meta.dir, "schema");
for (const f of readdirSync(SCHEMA).filter((f) => f.endsWith(".sql")).sort()) db.exec(readFileSync(join(SCHEMA, f), "utf8"));
// Migrations for databases made before a column existed; they run after the tables exist.
// What an idle agent still has running in the background (for example "2 shells still running"), from its pane.
if (!(db.query("PRAGMA table_info(lanes)").all() as { name: string }[]).some((c) => c.name === "bg")) db.exec("ALTER TABLE lanes ADD COLUMN bg TEXT");
// Names of the secrets an ask requests (JSON array). Names only: values never reach the database.
if (!(db.query("PRAGMA table_info(asks)").all() as { name: string }[]).some((c) => c.name === "secrets")) db.exec("ALTER TABLE asks ADD COLUMN secrets TEXT");
// The lane a lane reports to; empty means straight under HQ. Depth is computed from the chain, never stored.
if (!(db.query("PRAGMA table_info(lanes)").all() as { name: string }[]).some((c) => c.name === "parent")) db.exec("ALTER TABLE lanes ADD COLUMN parent TEXT");
// blocked-prompts: the excerpt of the prompt a lane's agent waits on in herdr (null when none); see prompt.ts.
if (!(db.query("PRAGMA table_info(lanes)").all() as { name: string }[]).some((c) => c.name === "prompt")) db.exec("ALTER TABLE lanes ADD COLUMN prompt TEXT");
// Question tiers (docs/spec-3d-office.md, section 2): blocking or not, a priority (0 urgent .. 3 low), whether the
// asking lane locked it as blocking, and who last set tier or priority, and when. Older asks read as non-blocking,
// normal, unlocked.
const askColumns = new Set((db.query("PRAGMA table_info(asks)").all() as { name: string }[]).map((c) => c.name));
for (const [col, def] of [
  ["tier", "TEXT NOT NULL DEFAULT 'nonblocking'"],
  ["priority", "INTEGER NOT NULL DEFAULT 2"],
  ["tier_locked", "INTEGER NOT NULL DEFAULT 0"],
  ["tier_by", "TEXT"],
  ["tier_at", "INTEGER"],
]) if (!askColumns.has(col)) db.exec(`ALTER TABLE asks ADD COLUMN ${col} ${def}`);
