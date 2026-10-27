// Wall bands: a wall finish's bands cut its walls and posts at the band heights, each stretch showing its band on
// the banded side and the plain finish on the other; a cut wall shows only what is under the kerb; the lot stays free
// of coplanar faces; every stretch keeps the wall's foot as its base; checkPack names a bad band.
import { describe, expect, test } from "bun:test";
import { buildLot, buildArchitecture, lotPrims, cutaway, lintCoplanar, checkPack, definePack, defineObject, defineWorld, rect, WALL_MODES, FLOOR_Y, KERB_H, WALL_H } from "@hq/world/model";
import starter from "@hq/world/packs/starter";

const BANDS = [{ to: 0.1, color: "smoked" }, { to: 0.76, color: "oak", pattern: "battens" }, { to: 0.8, color: "smoked-light" }];
const banded = definePack({
  id: "banded",
  palette: { light: { smoked: "#3a3029", "smoked-light": "#6b5a4c" }, dark: { smoked: "#2a221d", "smoked-light": "#54473c" } },
  objects: [defineObject({ id: "panel", kind: "wall", color: "plaster", pattern: "plain", bands: BANDS })],
});
const world = defineWorld({
  format: 1, id: "bands", packs: [starter, banded], lot: { w: 7, d: 6 },
  floors: [{ rect: [1, 1, 5, 4], finish: "starter/oak" }],
  walls: [{ path: rect(1, 1, 5, 4), finish: "banded/panel", outside: "starter/siding" }, { path: [[4, 1], [4, 5]], finish: "banded/panel" }],
  openings: [{ type: "starter/door", at: [2, 4], side: "s" }, { type: "starter/door", at: [3, 2], side: "e" }, { type: "starter/window", at: [2, 1], side: "n" }],
});
const STEPS = [0, FLOOR_Y + 0.1, FLOOR_Y + 0.76, FLOOR_Y + 0.8];
const INSIDE = ["banded/smoked", "oak", "banded/smoked-light", "plaster"];
const round = (n: number) => Math.round(n * 1e6) / 1e6;
const stretches = (prims: any[], owner: string) => prims.filter((p) => p.owner === owner).sort((a, b) => a.at[1] - b.at[1]);

describe("wall bands", () => {
  const { lot, catalog } = buildLot(world);

  test("a banded wall is cut at the band heights: band colours inside, the plain finish outside, one cap on top", () => {
    const parts = stretches(buildArchitecture(lot, catalog), "wall:h:1,1"); // the north wall: outdoors at -z, the room at +z
    expect(parts.map((p) => round(p.at[1]))).toEqual(STEPS.map(round));
    expect(round(parts.at(-1).at[1] + parts.at(-1).size[1])).toBe(round(FLOOR_Y + WALL_H));
    expect(parts.map((p) => p.faces["+z"].color)).toEqual(INSIDE);
    expect(parts.map((p) => p.faces["+z"].pattern)).toEqual(["plain", "battens", "plain", "plain"]);
    expect(parts.map((p) => p.faces["-z"].color)).toEqual(["siding", "siding", "siding", "siding"]);
    expect(parts.map((p) => p.faces["+y"]?.color ?? null)).toEqual([null, null, null, "cap"]);
    expect(parts.slice(0, -1).every((p) => p.omit.includes("+y") && p.omit.includes("-y"))).toBe(true);
    expect(parts.every((p) => p.part === "wall" && p.base === 0)).toBe(true);
  });

  test("an inner wall shows the bands on both sides; a wall under a window is cut too", () => {
    const inner = stretches(buildArchitecture(lot, catalog), "wall:v:4,1");
    expect(inner.map((p) => [p.faces["-x"].color, p.faces["+x"].color])).toEqual(INSIDE.map((c) => [c, c]));
    const under = stretches(buildArchitecture(lot, catalog), "wall:h:2,1").filter((p) => p.part === "wall-under");
    expect(under.map((p) => p.faces["+z"].color)).toEqual(INSIDE); // the sill (0.9 m) is above the last band: plaster under it
  });

  test("posts are cut at the band heights too", () => {
    const post = stretches(buildArchitecture(lot, catalog), "post:1,1"); // the north-west corner
    expect(post.map((p) => round(p.at[1]))).toEqual(STEPS.map(round));
    expect(post.map((p) => p.faces["+z"].color)).toEqual(INSIDE);
    expect(post.map((p) => p.faces["-z"].color)).toEqual(["siding", "siding", "siding", "siding"]);
    expect(post.map((p) => p.faces["+y"]?.color ?? null)).toEqual([null, null, null, "cap"]);
  });

  test("a cut wall shows only the bands under the kerb", () => {
    const parts = stretches(buildArchitecture(lot, catalog, new Set(["h:1,1"])), "wall:h:1,1");
    expect(parts.map((p) => round(p.at[1]))).toEqual([0, round(FLOOR_Y + 0.1)]);
    expect(round(parts[1].at[1] + parts[1].size[1])).toBe(round(FLOOR_Y + KERB_H));
    expect(parts.map((p) => p.faces["+z"].color)).toEqual(["banded/smoked", "oak"]);
    expect(parts[1].faces["+y"].color).toBe("cap");
  });

  test("a banded lot has no coplanar pairs in any wall mode, rotation or turn", () => {
    expect(lotPrims(lot, catalog).filter((p: any) => p.owner === "post:4,1").length).toBe(4); // the lint sees the stretches
    for (const mode of WALL_MODES) for (let rot = 0; rot < 4; rot++) {
      const cut = cutaway(lot, { mode, rot });
      expect({ mode, rot, pairs: lintCoplanar(lotPrims(lot, catalog, cut)) }).toEqual({ mode, rot, pairs: [] });
      const turning = new Set([...cut, ...cutaway(lot, { mode, rot: rot + 1 })]);
      expect({ mode, rot, turning: true, pairs: lintCoplanar(lotPrims(lot, catalog, turning)) }).toEqual({ mode, rot, turning: true, pairs: [] });
    }
  }, 30_000);

  test("checkPack: a good banded finish is clean; a bad band is named with its fix", () => {
    expect(checkPack(banded)).toEqual([]);
    const bad = definePack({ id: "bad", palette: { light: { smoked: "#333333" }, dark: { smoked: "#222222" } }, objects: [
      defineObject({ id: "down", kind: "wall", color: "plaster", bands: [{ to: 0.8, color: "oak" }, { to: 0.5, color: "smoked" }] }),
      defineObject({ id: "tall", kind: "wall", color: "plaster", bands: [{ to: 3.2, color: "oak" }] }),
      defineObject({ id: "token", kind: "wall", color: "plaster", bands: [{ to: 0.8, color: "smokd" }] }),
      defineObject({ id: "slats", kind: "wall", color: "plaster", bands: [{ to: 0.8, color: "oak", pattern: "slats" }] }),
      defineObject({ id: "list", kind: "wall", color: "plaster", bands: { to: 0.8, color: "oak" } }),
      defineObject({ id: "floor", kind: "floor", color: "oak", bands: [{ to: 0.1, color: "oak" }] }),
    ] });
    const found = checkPack(bad).map((p: any) => [p.path.match(/\(bad\/(\w+)\)/)[1], p.code]);
    expect(found).toEqual([["down", "finish.bands"], ["tall", "finish.bands"], ["token", "color.token"], ["slats", "finish.pattern"], ["list", "finish.bands"], ["floor", "finish.bands"]]);
    expect(checkPack(bad).find((p: any) => p.code === "color.token").fix).toContain("smoked");
  });
});
