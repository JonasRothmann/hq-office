// The land round the office as the engine's scenery (src/client/office/outside/scenery.js): for each mode and a few
// offices and seeds it passes checkScenery against the office's packs and the land pack, the same input gives the same
// scenery, the valley or the town stays out of the garden (only the garden's own pieces are inside its reach), the
// walkers step up onto the quays, and "off" is no scenery at all.
import { describe, expect, test } from "bun:test";
import { createCatalog, checkScenery, formatProblems, checkPack } from "@hq/world/model";
import japandi from "../../src/client/office/japandi/index.js";
import land from "../../src/client/office/outside/land/index.js";
import { officeDoc } from "../../src/client/office/plan.js";
import { outsideScenery, landFor, lotOf } from "../../src/client/office/outside/scenery.js";
import { LEVEL } from "../../src/client/office/outside/gen.js";

const catalog = createCatalog([japandi, land]);
const lanes = (n: number) => [{ name: "hq", status: "moving" }, ...Array.from({ length: n }, (_, i) => ({ name: `l${i}`, parent: "hq", status: "moving" }))];
const GARDEN = new Set(["tree-birch", "pine", "shrub-clipped", "grass-clump", "gravel-bed", "moss", "garden-maple", "stone-lantern", "basin",
  "step-stone", "paver", "garden-bollard", "bike-rack", "bike", "garden-bench", "deck", "block", "light-pool"].map((t) => `land/${t}`));

describe("the land pack", () => {
  test("has no problems", () => expect(formatProblems(checkPack(land))).toBe(""));
});

for (const mode of ["nature", "city"] as const) {
  describe(mode, () => {
    for (const [n, seed] of [[4, "hq"], [12, "hq"], [12, 7]] as const) {
      test(`${n} lanes, seed ${seed}: a scenery the engine takes, the same every time`, () => {
        const { layout } = officeDoc(lanes(n));
        const s = outsideScenery(layout, { mode, seed });
        expect(formatProblems(checkScenery(s, catalog))).toBe("");
        expect(JSON.stringify(outsideScenery(layout, { mode, seed }))).toBe(JSON.stringify(s));
        expect(s!.ground).toBe(true);
        expect(s!.pieces!.length).toBeGreaterThan(500);
        if (mode === "city") expect(s!.movers!.length).toBeGreaterThan(50);
      });
    }

    test("the land stays out of the garden", () => {
      const { layout } = officeDoc(lanes(12));
      const s = outsideScenery(layout, { mode })!;
      const hole = s.fade!.box, inside = (x: number, z: number) => x > hole.minX + 0.01 && x < hole.maxX - 0.01 && z > hole.minZ + 0.01 && z < hole.maxZ - 0.01;
      const stray = s.pieces!.filter((p) => !GARDEN.has(p.type) && inside(p.at[0], p.at[2]));
      expect(stray.map((p) => `${p.type} at ${p.at}`)).toEqual([]);
      for (const m of s.movers ?? []) expect(m.route.some(([x, , z]) => inside(x, z))).toBe(false);
      const field = s.fields!.find((f) => f.hole && f.color !== "ground");
      if (field) expect(field.hole).toEqual(hole);
    });
  });
}

test("walkers in the town follow the ground: road, track, pavement and quay", () => {
  const { layout } = officeDoc(lanes(12));
  const s = outsideScenery(layout, { mode: "city", seed: "hq" })!;
  const heights = new Set(s.movers!.filter((m) => m.type === "land/walker").flatMap((m) => m.route.map(([, y]) => Math.round((y - 0.12) * 100) / 100)));
  for (const y of [LEVEL.walk, LEVEL.quay]) expect(heights.has(y)).toBe(true);
});

test("the land's lot is centred on the front door and reaches past the building", () => {
  const { layout } = officeDoc(lanes(12));
  const lot = lotOf(layout), b = layout.bounds;
  expect(lot.minX).toBeLessThan(b.minX - 6);
  expect(lot.maxZ).toBe(b.maxZ + 7);
  const land = landFor(layout, { mode: "nature", seed: "hq" })!;
  expect(land.lot.minX).toBeLessThanOrEqual(lot.minX);
  // an office one room bigger keeps the land it had
  const { layout: next } = officeDoc(lanes(13));
  expect(landFor(next, { mode: "nature", seed: "hq", prev: land })!.lot).toEqual(land.lot);
});

test("off is no scenery", () => {
  const { layout } = officeDoc(lanes(4));
  expect(outsideScenery(layout, { mode: "off" })).toBe(null);
  expect(landFor(layout, { mode: "off" })).toBe(null);
});
