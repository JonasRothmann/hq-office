// The comparison's own house (the same plan as the engine's test house), so the comparison pins nothing inside the
// package. It imports the files "@hq/world/model" and "@hq/world/packs/starter" map to: Bun has no import map here.
import { defineWorld, rect } from "../../../packages/world/src/model/index.js";
import starter from "../../../packages/world/packs/starter/index.js";

export default defineWorld({
  format: 1,
  id: "compare-house",
  packs: [starter],
  lot: { w: 14, d: 11 },
  floors: [{ rect: [2, 2, 10, 7], finish: "starter/oak" }],
  walls: [
    { path: rect(2, 2, 10, 7), finish: "starter/plaster", outside: "starter/siding" },
    { path: [[7, 2], [7, 9]], finish: "starter/plaster" },
  ],
  openings: [
    { type: "starter/door", at: [4, 8], side: "s" },
    { type: "starter/door", at: [6, 5], side: "e" },
  ],
  objects: [
    { id: "desk-1", type: "starter/desk", at: [3, 3], facing: "s" },
    { id: "chair-1", type: "starter/chair", at: [3, 4], facing: "n" },
    { id: "chair-3", type: "starter/chair", at: [8, 4], facing: "e" },
  ],
  characters: [{ id: "ada", at: [9, 7], facing: "n" }],
});
