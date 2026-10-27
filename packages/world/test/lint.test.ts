// The coplanar lint: it finds the z-fights of the old office (a window frame as deep as its wall; a wall end in the
// crossing wall's face; walls squashed into their kerbs during a turn) and finds none in the tiny house, in any
// rotation, wall mode or turn (the union of two rotations' cuts).
import { describe, expect, test } from "bun:test";
import { buildLot, lotPrims, cutaway, lintCoplanar, WALL_MODES } from "@hq/world/model";
import { Kit } from "../src/catalog/kit.js";
import tiny from "../examples/tiny-house.world.js";

const T = 0.15;

describe("coplanar lint", () => {
  test("a window frame exactly as deep as its wall fights the wall (rooms.js:153 of the old office)", () => {
    const k = new Kit();
    k.box("wall-left", [0.4, 2.95, T], [-0.3, 0, 0], "plaster");
    k.box("frame-side", [0.12, 1.3, T], [-0.04, 0.95, 0], "steel");
    const pairs = lintCoplanar(k.prims);
    expect(pairs.length).toBe(0); // side by side, touching: no overlap yet
    k.box("frame-over", [0.12, 1.3, T], [-0.15, 0.95, 0], "steel"); // overlapping the wall, same depth
    expect(lintCoplanar(k.prims).map((p) => p.normal.join(","))).toEqual(expect.arrayContaining(["0,0,1", "0,0,-1"]));
  });

  test("a wall end extended into the crossing wall's face fights it (rooms.js:19-20 of the old office)", () => {
    const k = new Kit();
    k.box("through", [T, 2.95, 3], [0, 0, 1.5], "plaster");                 // along z at x = 0
    k.box("t-wall", [1 + T / 2, 2.95, T], [-0.5 + T / 4, 0, 1.5], "plaster"); // along x, its end at x = +T/2
    const pairs = lintCoplanar(k.prims);
    expect(pairs.some((p) => p.normal[0] === 1)).toBe(true);
  });

  test("an upper wall squashed down into its kerb fights it (rooms.js:186 of the old office)", () => {
    const k = new Kit();
    k.box("kerb", [1, 0.35, T], [0, 0, 0], "plaster");
    k.box("upper-squashed", [1, 0.3, T], [0, 0.0, 0], "plaster");
    expect(lintCoplanar(k.prims).length).toBeGreaterThan(0);
  });

  test("touching boxes (opposite faces) and parts 2 mm apart are fine", () => {
    const k = new Kit();
    k.box("a", [1, 1, 1], [0, 0, 0], "wood");
    k.box("b", [1, 1, 1], [1, 0, 0], "wood");
    k.box("c", [0.5, 0.5, 0.5], [0, 1.002, 0], "wood");
    expect(lintCoplanar(k.prims)).toEqual([]);
  });

  test("the tiny house has no coplanar pairs in any rotation, wall mode or turn", () => {
    const { lot, catalog } = buildLot(tiny);
    for (const mode of WALL_MODES) for (let rot = 0; rot < 4; rot++) {
      const cut = cutaway(lot, { mode, rot });
      expect({ mode, rot, pairs: lintCoplanar(lotPrims(lot, catalog, cut)) }).toEqual({ mode, rot, pairs: [] });
      const turning = new Set([...cut, ...cutaway(lot, { mode, rot: rot + 1 })]);
      expect({ mode, rot, turning: true, pairs: lintCoplanar(lotPrims(lot, catalog, turning)) }).toEqual({ mode, rot, turning: true, pairs: [] });
    }
  });

  test("cutaway drops the near walls and keeps the far ones", () => {
    const { lot } = buildLot(tiny);
    const cut = cutaway(lot, { mode: "cutaway", rot: 0 }); // camera to the south-east
    expect(cut.has("h:4,9")).toBe(true);  // the south wall (near)
    expect(cut.has("v:12,4")).toBe(true); // the east wall (near)
    expect(cut.has("h:4,2")).toBe(false); // the north wall (far)
    expect(cut.has("v:2,4")).toBe(false); // the west wall (far)
    expect(cut.has("v:7,4")).toBe(true);  // the inner wall: the study is behind it
    const study = cutaway(lot, { mode: "cutaway", rot: 0, focus: "study" });
    expect(study.has("v:12,4")).toBe(false); // the lounge's own east wall stays up when the study has focus
    expect(cutaway(lot, { mode: "up" }).size).toBe(0);
    expect(cutaway(lot, { mode: "down" }).size).toBe(lot.walls.size);
  });
});
