#!/usr/bin/env bun
// Check a world file or a pack, with no browser: validation (every problem with its fix, the world's packs included:
// footprints, colour tokens, clips, slots, coplanar parts), files listed in a pack's index.js, and the coplanar lint
// on the world as built in every rotation, wall mode and turn. --map prints the lot as ASCII. Exits 1 on any error.
//
//   bun packages/world/tools/check.ts path/to/x.world.js [more files...] [--map]
//   bun packages/world/tools/check.ts path/to/pack/index.js
//
// World and pack files are .js or .mjs; any other file is refused with that message.
// Paths are relative to the current directory, from anywhere (tools/paths.ts).
import "./resolve.ts";
import { dirname } from "node:path";
import { validateWorld, checkPack, buildLot, cutaway, lintViews, describePairs, formatProblems, lotMap, WALL_MODES } from "../src/model/index.js";
import { packFileProblems } from "./pack-files.ts";
import { moduleArg, shown } from "./paths.ts";

const args = process.argv.slice(2);
const files = args.filter((a) => !a.startsWith("--"));
if (!files.length) { console.error("usage: bun tools/check.ts <world.js | pack/index.js> ... [--map]"); process.exit(2); }
let errors = 0;
const report = (what: string, problems: any[]) => {
  const e = problems.filter((p) => p.severity === "error").length;
  errors += e;
  console.log(problems.length ? `${what}: ${e} error(s), ${problems.length - e} warning(s)\n${formatProblems(problems)}` : `${what}: ok`);
};

for (const f of files) {
  const path = moduleArg(f);
  const mod = (await import(path)).default;
  if (mod?.objects) {
    report(`pack ${mod.id} (${shown(path)})`, [...checkPack(mod), ...packFileProblems(dirname(path))]);
    continue;
  }
  if (!mod?.doc) { console.log(`${shown(path)}: its default export is neither defineWorld(...) nor definePack(...)`); errors++; continue; }
  const problems = validateWorld(mod);
  report(`world ${mod.doc.id} (${shown(path)}; packs ${mod.packs.map((p: any) => p.id).join(", ")})`, problems);
  if (problems.some((p: any) => p.severity === "error")) continue;
  const { lot, catalog } = buildLot(mod);
  if (args.includes("--map")) console.log(`\n${lotMap(lot)}\n`);
  const views: [string, Set<string>][] = [];
  for (const mode of WALL_MODES) for (let rot = 0; rot < 4; rot++) {
    const cut = cutaway(lot, { mode, rot });
    views.push([`${mode} rot ${rot}`, cut], [`${mode} turning ${rot}→${(rot + 1) % 4}`, new Set([...cut, ...cutaway(lot, { mode, rot: rot + 1 })])]);
  }
  const lint = lintViews(lot, catalog, views.map(([, set]) => set)).flatMap((pairs, i) => describePairs(pairs).map((line) => ({ code: "world.coplanar", severity: "error", path: views[i][0], message: line, fix: "these faces z-fight; if one is an object part, fix the object (check its pack); if both are walls, report an engine bug" })));
  const seen = new Set<string>();
  report(`world ${mod.doc.id} coplanar lint (12 views, 12 turns)`, lint.filter((p) => !seen.has(p.message) && seen.add(p.message)));
}
process.exit(errors ? 1 : 0);
