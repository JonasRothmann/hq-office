#!/usr/bin/env bun
// List the objects of one or more packs (default: the starter pack): id, kind, footprint, slots, anchors, tags.
//
//   bun packages/world/tools/catalog.ts [path/to/pack/index.js ...] [--json]     (paths from the current directory)
import "./resolve.ts";
import { join } from "node:path";
import { createCatalog } from "../src/model/index.js";
import { moduleArg } from "./paths.ts";

const args = process.argv.slice(2);
const paths = args.filter((a) => !a.startsWith("--"));
const packs = await Promise.all((paths.length ? paths : [join(import.meta.dir, "..", "packs", "starter", "index.js")]).map(async (p) => (await import(moduleArg(p))).default));
const catalog = createCatalog(packs);
const rows = catalog.list().map((o: any) => ({
  id: o.id, kind: o.kind,
  ...(o.kind === "object" ? { footprint: o.footprint, height: o.height, blocks: o.blocks, slots: Object.fromEntries(Object.entries(o.slots).map(([k, s]: any) => [k, `${s.clip}, facing ${s.facing}`])), anchors: Object.keys(o.anchors) } : {}),
  ...(o.kind === "opening" ? { width: o.width, sill: o.sill, head: o.head, passable: o.passable } : {}),
  ...(o.kind === "floor" || o.kind === "wall" ? { color: o.color, pattern: o.pattern, ...(o.bands ? { bands: o.bands } : {}) } : {}),
  tags: o.tags,
}));
if (args.includes("--json")) console.log(JSON.stringify(rows, null, 2));
else for (const r of rows) {
  const { id, kind, tags, ...rest } = r as any;
  console.log(`${id.padEnd(22)} ${kind.padEnd(8)} ${Object.entries(rest).map(([k, v]) => `${k} ${typeof v === "object" ? JSON.stringify(v) : v}`).join("  ")}${tags.length ? `  tags ${tags.join(",")}` : ""}`);
}
if (catalog.problems.length) { console.error(catalog.problems.map((p: any) => `${p.code}: ${p.message} (fix: ${p.fix})`).join("\n")); process.exit(1); }
