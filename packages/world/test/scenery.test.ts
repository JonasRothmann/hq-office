// Scenery, headless: a scenery piece is checked like any object but has no footprint; checkScenery names what is wrong
// and how to fix it; pieces of one type and params are one batch; movers go round their loops at their speed, facing
// along them; the driver draws moving scenery at idleFps only, never redraws shadows for it, and at idleFps 0 its
// clock stands still (the land holds still in a power saver).
import { describe, expect, test } from "bun:test";
import { defineObject, definePack, createCatalog, checkPack, checkScenery, planScenery, moverPlaces, fromJSON, analyse, buildPrims } from "@hq/world/model";
import starter from "@hq/world/packs/starter";
import { createDriver } from "../src/view/driver.js";
import house from "./fixtures/house.world.js";

const tree = defineObject({
  id: "tree", kind: "scenery",
  build(k) { k.cyl("trunk", 0.1, 2, [0, 0, 0], "bark"); k.cyl("crown", 1.2, 2.4, [0, 1.8, 0], "leaf", { top: 0.05 }); },
});
const house12 = defineObject({
  id: "row-house", kind: "scenery",
  build(k, p) { k.box("walls", [p.w ?? 6, 9, 8], [0, 0, 0], "wall"); },
});
const land = definePack({ id: "land", palette: { light: { bark: "#5f4a3a", wall: "#d8ad66" }, dark: { bark: "#3f3a3c", wall: "#9a8e7e" } }, objects: [tree, house12] });
const catalog = createCatalog([land]);

describe("scenery pieces", () => {
  test("a scenery piece needs no footprint and may be bigger than a room's furniture, up to 40 m", () => {
    expect(checkPack(land)).toEqual([]);
    const huge = definePack({ id: "huge", objects: [defineObject({ id: "tower", kind: "scenery", build(k) { k.box("walls", [8, 50, 8], [0, 0, 0], "#888888"); } })] });
    expect(checkPack(huge).map((p) => p.code)).toEqual(["prim.units"]);
  });

  test("a pool of light is its own finish, so it never shares a material with the ground it lies on", () => {
    const pool = defineObject({ id: "pool", kind: "scenery", build(k) { k.light("pool", [1, 0.01, 1], [0, 0, 0], "#8a6f45", { omit: ["-y"] }); } });
    const prims = buildPrims(pool);
    expect(prims.map((p: any) => p.finish)).toEqual(["light"]);
    expect(checkPack(definePack({ id: "pools", objects: [pool] }))).toEqual([]);
  });

  test("a scenery piece placed on the lot is refused with where it goes instead", () => {
    const doc = structuredClone(house.doc);
    doc.packs.push("land");
    doc.objects.push({ id: "t", type: "land/tree", at: [1, 1], facing: "s" });
    const r = analyse(fromJSON(doc, [...house.packs, land]));
    const p = r.problems.find((x: any) => x.code === "object.kind");
    expect(p.fix).toContain("scenery");
  });
});

describe("checkScenery", () => {
  test("a good scenery has no problems", () => {
    expect(checkScenery({
      pieces: [{ type: "land/tree", at: [-3, 0, 2], ry: 1, s: 1.2, tint: "#e0e0e0" }, { type: "land/row-house", at: [-20, 0, 0], s: [1, 1, 1], tint: "land/wall", params: { w: 7 } }],
      fields: [{ xs: [0, 1], zs: [0, 1], h: [0, 0, 0, 0], color: ["land/bark"], tone: [1, 1, 1, 1], hole: { minX: 0, minZ: 0, maxX: 0.5, maxZ: 0.5 } }],
      strips: [{ points: [[0, 0.1, 0, 1], [5, 0.1, 0, 1]], color: "#86a7ad", finish: "glass" }],
      movers: [{ type: "land/tree", route: [[0, 0, 0], [10, 0, 0], [10, 0, 10]], speed: 3, at: [0, 4], tint: ["#ffffff", "land/wall"] }],
      fade: { box: { minX: 0, minZ: 0, maxX: 10, maxZ: 10 }, from: 30, to: 60 }, shade: { minX: -5, minZ: -5, maxX: 15, maxZ: 15 }, ground: true,
    }, catalog)).toEqual([]);
  });

  test("each mistake is named with its path and a fix", () => {
    const problems = checkScenery({
      pieces: [{ type: "land/tre", at: [0, 0, 0] }, { type: "land/tree", at: [0, 0] }, { type: "land/tree", at: [0, 0, 0], tint: "red" }, { type: "land/tree", at: [0, 0, 0], s: -1 }],
      fields: [{ xs: [0, 1], zs: [0, 1], h: [0, 0, 0], color: "#ffffff" }],
      strips: [{ points: [[0, 0, 0, 1]], color: "#ffffff", finish: "shiny" }],
      movers: [{ type: "land/tree", route: [[0, 0, 0], [0, 0, 0]], speed: "fast", at: [0], tint: ["#ffffff", "#000000"] }],
      fade: { box: { minX: 0, minZ: 0, maxX: 1, maxZ: 1 }, from: 60, to: 30 },
    }, catalog);
    const by = (path: string) => problems.find((p) => p.path === path);
    expect(by("scenery.pieces[0].type")?.fix).toContain("land/tree");
    expect(by("scenery.pieces[1].at")?.code).toBe("scenery.at");
    expect(by("scenery.pieces[2].tint")?.code).toBe("scenery.color");
    expect(by("scenery.pieces[3].s")?.code).toBe("scenery.s");
    expect(by("scenery.fields[0].h")?.message).toContain("not 4");
    expect(by("scenery.strips[0].points")?.code).toBe("scenery.strip");
    expect(by("scenery.strips[0].finish")?.code).toBe("scenery.strip");
    expect(by("scenery.movers[0].route")?.message).toContain("no length");
    expect(by("scenery.movers[0].speed")?.code).toBe("scenery.speed");
    expect(by("scenery.movers[0].tint")?.message).toContain("2 tints for 1 copies");
    expect(by("scenery.fade")?.code).toBe("scenery.fade");
    expect(problems.every((p) => p.fix)).toBe(true);
  });

  test("a lot object is not a scenery piece", () => {
    const problems = checkScenery({ pieces: [{ type: "starter/desk", at: [0, 0, 0] }] }, createCatalog([starter]));
    expect(problems.map((p) => p.message)).toEqual(["'starter/desk' is a object, not a scenery piece"]);
  });
});

describe("planScenery", () => {
  test("pieces of one type, params and shadow are one batch, in order", () => {
    const plan = planScenery({
      pieces: [
        { type: "land/tree", at: [1, 0, 1] }, { type: "land/row-house", at: [0, 0, 0], params: { w: 7 } }, { type: "land/tree", at: [2, 0, 2], s: 2 },
        { type: "land/row-house", at: [9, 0, 0], params: { w: 5 } }, { type: "land/tree", at: [3, 0, 3], shadow: true },
      ],
    });
    expect(plan.batches.map((b) => [b.type, b.items.length, b.shadow])).toEqual([["land/tree", 2, false], ["land/row-house", 1, false], ["land/row-house", 1, false], ["land/tree", 1, true]]);
    expect(plan.batches[0].items[1]).toEqual({ at: [2, 0, 2], ry: 0, s: [2, 2, 2], tint: null });
    expect(plan.ground).toBe(false);
  });
});

describe("movers", () => {
  const mover = planScenery({ movers: [{ type: "land/tree", route: [[0, 0, 0], [10, 0, 0], [10, 0, 10], [0, 0, 10]], speed: 2, at: [0, 5] }] }).movers[0];

  test("a loop is measured closed, the last point joining the first", () => {
    expect(mover.length).toBe(40);
  });

  test("each copy goes round from its start at the speed, facing along the loop", () => {
    const [a, b] = moverPlaces(mover, 0);
    expect(a).toEqual([0, 0, 0, Math.PI / 2]);           // east along the first side: +z turned to +x
    expect(b.slice(0, 3)).toEqual([5, 0, 0]);
    const later = moverPlaces(mover, 7)[0];              // 14 m: 4 m down the second side, heading south
    expect(later.slice(0, 3).map((v) => +v.toFixed(6))).toEqual([10, 0, 4]);
    expect(later[3]).toBeCloseTo(0);
    expect(moverPlaces(mover, 20)[0].slice(0, 3).map((v) => +v.toFixed(6))).toEqual([0, 0, 0]); // round once in 20 s
  });

  test("a mover going backwards faces the way it goes", () => {
    const back = { ...mover, speed: -2 };
    const p = moverPlaces(back, 1)[0];                   // 2 m back from the start: on the closing side, heading south
    expect(p.slice(0, 3).map((v) => +v.toFixed(6))).toEqual([0, 0, 2]);
    expect(Math.cos(p[3])).toBeCloseTo(1);                // its front (+z) points south, the way it goes
  });
});

describe("the frame policy for moving scenery", () => {
  const STEP = 1000 / 60;
  const quiet = (() => { const d = structuredClone(house.doc); d.acts = []; d.characters = []; return fromJSON(d, house.packs); })();
  function run(d: any, ms: number) {
    const out = { renders: 0, shadows: 0 };
    for (let t = 0; t < ms - 1e-9; t += STEP) { const f = d.tick((clock += STEP), STEP); if (f.render) out.renders++; if (f.shadows) out.shadows++; }
    return out;
  }
  let clock = 0;

  test("moving scenery draws at idleFps and never redraws shadows; its clock runs with it", () => {
    const d = createDriver(quiet, { size: { w: 800, h: 600, dpr: 1 }, idleFps: 10 });
    d.setScenery({ moving: true });
    run(d, STEP); // the frame the change asked for
    const r = run(d, 3000);
    expect(r.shadows).toBe(0);
    expect(r.renders).toBeGreaterThanOrEqual(29);
    expect(r.renders).toBeLessThanOrEqual(31);
    expect(d.sceneryTime).toBeCloseTo(3 + STEP / 1000, 2);
  });

  test("at idleFps 0 the land holds still: nothing draws and its clock stops, until idleFps is set again", () => {
    const d = createDriver(quiet, { size: { w: 800, h: 600, dpr: 1 } });
    d.setScenery({ moving: true });
    run(d, STEP);
    expect(run(d, 3000)).toEqual({ renders: 0, shadows: 0 });
    expect(d.sceneryTime).toBe(0);
    d.setIdleFps(30);
    expect(run(d, 1000).renders).toBeGreaterThanOrEqual(29);
    expect(d.sceneryTime).toBeCloseTo(1, 1);
  });

  test("still scenery never draws, whatever idleFps is, when nothing else moves", () => {
    const d = createDriver(quiet, { size: { w: 800, h: 600, dpr: 1 }, idleFps: 30 });
    d.setScenery({ moving: false });
    run(d, STEP);
    expect(run(d, 2000)).toEqual({ renders: 0, shadows: 0 });
  });
});
