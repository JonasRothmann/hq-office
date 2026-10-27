#!/usr/bin/env bun
// Check a world file or a pack, with no browser: validation (every problem with its fix), each pack's objects
// (footprints, slots, coplanar parts, files listed in index.js), and the coplanar lint on the world as built in every
// rotation, wall mode and turn. Exits 1 on any error.
//
//   bun packages/world/tools/check.ts path/to/x.world.js [more files...]
//   bun packages/world/tools/check.ts path/to/pack/index.js
import "./resolve.ts";
import { dirname, resolve } from "node:path";
import { validateWorld, checkPack, buildLot, cutaway, lotPrims, lintCoplanar, describePair, formatProblems, WALL_MODES } from "../src/model/index.js";
import { packFileProblems } from "./pack-files.ts";

const files = process.argv.slice(2);
if (!files.length) { console.error("usage: bun tools/check.ts <world.js | pack/index.js> ..."); process.exit(2); }
let errors = 0;
const report = (what: string, problems: any[]) => {
  const e = problems.filter((p) => p.severity === "error").length;
  errors += e;
  console.log(problems.length ? `${what}: ${e} error(s), ${problems.length - e} warning(s)\n${formatProblems(problems)}` : `${what}: ok`);
};

for (const f of files) {
  const mod = (await import(resolve(f))).default;
  if (mod?.objects) {
    report(`pack ${mod.id}`, [...checkPack(mod), ...packFileProblems(dirname(resolve(f)))]);
    continue;
  }
  if (!mod?.doc) { console.log(`${f}: its default export is neither defineWorld(...) nor definePack(...)`); errors++; continue; }
  for (const p of mod.packs) report(`pack ${p.id}`, checkPack(p));
  const problems = validateWorld(mod);
  report(`world ${mod.doc.id}`, problems);
  if (problems.some((p: any) => p.severity === "error")) continue;
  const { lot, catalog } = buildLot(mod);
  const lint: any[] = [];
  for (const mode of WALL_MODES) for (let rot = 0; rot < 4; rot++) {
    const cut = cutaway(lot, { mode, rot });
    const turning = new Set([...cut, ...cutaway(lot, { mode, rot: rot + 1 })]);
    for (const [label, set] of [[`${mode} rot ${rot}`, cut], [`${mode} turning ${rot}→${(rot + 1) % 4}`, turning]] as const) {
      for (const pair of lintCoplanar(lotPrims(lot, catalog, set as Set<string>))) lint.push({ code: "world.coplanar", severity: "error", path: label, message: describePair(pair), fix: "these faces z-fight; if one is an object part, fix the object (check its pack); if both are walls, report an engine bug" });
    }
  }
  const seen = new Set<string>();
  report(`world ${mod.doc.id} coplanar lint (12 views, 12 turns)`, lint.filter((p) => !seen.has(p.message) && seen.add(p.message)));
}
process.exit(errors ? 1 : 0);
