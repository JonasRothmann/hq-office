// The SQLite database. Each table's schema is a file in schema/, applied at startup with its migrations (schema.ts).
import { Database } from "bun:sqlite";
import { DATA } from "./config.ts";
import { applySchema } from "./schema.ts";

export const db = new Database(`${DATA}/hud.db`, { create: true });
db.exec("PRAGMA journal_mode = WAL;");
applySchema(db);
