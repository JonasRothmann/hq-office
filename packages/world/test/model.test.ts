// Model validation: a good world has no problems; each kind of mistake gives one problem with its code, path and a fix
// that names coordinates or ids. JSON round-trips.
import { describe, expect, test } from "bun:test";
import { defineWorld, validateWorld, buildLot, toJSON, fromJSON, rect, WorldError } from "@hq/world/model";
import starter from "@hq/world/packs/starter";
import tiny from "../examples/tiny-house.world.js";

// A one-room house with a door, a desk and a chair; `edit` changes the spec before it is defined.
function house(edit: (s: any) => void = () => {}) {
  const spec: any = {
    id: "t", packs: [starter], lot: { w: 10, d: 8 },
    floors: [{ rect: [1, 1, 6, 5], finish: "starter/oak" }],
    walls: [{ path: rect(1, 1, 6, 5), finish: "starter/plaster", outside: "starter/siding" }],
    openings: [{ type: "starter/door", at: [3, 5], side: "s" }],
    objects: [{ id: "desk", type: "starter/desk", at: [2, 2], facing: "s" }, { id: "chair", type: "starter/chair", at: [2, 3], facing: "n" }],
    characters: [{ id: "bo", at: [8, 7] }],
    acts: [{ who: "bo", do: "sit", target: "chair" }],
  };
  edit(spec);
  return defineWorld(spec);
}
const codes = (w: any) => validateWorld(w).filter((p) => p.severity === "error").map((p) => p.code);
const only = (w: any) => { const e = validateWorld(w).filter((p) => p.severity === "error"); expect(e.length).toBe(1); return e[0]; };

describe("validation", () => {
  test("the tiny house and the test house are valid", () => {
    expect(validateWorld(tiny)).toEqual([]);
    expect(validateWorld(house())).toEqual([]);
  });

  test("an unknown type suggests the nearest id", () => {
    const p = only(house((s) => { s.objects[1].type = "starter/chiar"; s.acts = []; }));
    expect(p.code).toBe("object.type");
    expect(p.path).toBe("objects[1].type");
    expect(p.fix).toContain("starter/chair");
  });

  test("overlapping objects name the tile, the other object and free tiles", () => {
    const p = only(house((s) => { s.objects[1].at = [3, 2]; s.acts = []; }));
    expect(p.code).toBe("object.overlap");
    expect(p.message).toContain("(3,2)");
    expect(p.message).toContain("'desk'");
    expect(p.fix).toMatch(/\(\d+,\d+\)/);
  });

  test("a door where there is no wall names nearby wall edges", () => {
    const p = only(house((s) => { s.openings[0].at = [3, 3]; s.acts = []; s.characters = []; }));
    expect(p.code).toBe("opening.nowall");
    expect(p.fix).toMatch(/tile \(\d+,\d+\) side [nw]/);
  });

  test("an object straddling a wall, or leaving the lot, is an error", () => {
    expect(codes(house((s) => { s.objects.push({ id: "d2", type: "starter/desk", at: [0, 3], facing: "s" }); }))).toContain("object.wall");
    expect(codes(house((s) => { s.objects.push({ id: "d3", type: "starter/desk", at: [9, 0], facing: "s" }); }))).toContain("object.at");
  });

  test("a room with no door cannot be reached, and the fix names an edge for one", () => {
    const p = only(house((s) => { s.openings = []; s.acts = []; }));
    expect(p.code).toBe("room.unreachable");
    expect(p.fix).toMatch(/at: \[\d+,\d+\], side: "[nesw]"/);
  });

  test("an act on an unknown object, or one cut off, says so", () => {
    expect(codes(house((s) => { s.acts[0].target = "sofa"; }))).toEqual(["act.target"]);
    // a chair walled into a corner: its stand tiles are blocked by desks
    const p = only(house((s) => { s.objects.push({ id: "d2", type: "starter/desk", at: [1, 3], facing: "s" }); s.objects[1].at = [2, 3]; s.objects.push({ id: "d4", type: "starter/desk", at: [2, 4], facing: "s" }); s.objects[2].at = [1, 3]; s.objects[2].type = "starter/plant"; s.objects[2].id = "p"; s.objects.splice(3); s.objects.push({ id: "p2", type: "starter/plant", at: [3, 3], facing: "s" }); }));
    expect(p.code).toBe("act.unreachable");
  });

  test("a wall finish that is a floor, a missing pack, a bad lot", () => {
    expect(codes(house((s) => { s.walls[0].finish = "starter/oak"; }))).toContain("wall.finish");
    expect(codes(defineWorld({ id: "x", packs: [], lot: { w: 4, d: 4 }, floors: [{ rect: [0, 0, 2, 2], finish: "starter/oak" }] }))).toContain("floor.finish");
    expect(codes(defineWorld({ id: "x", lot: { w: 1, d: 300 } }))).toEqual(["lot.size"]);
  });

  test("buildLot throws a WorldError listing every problem with its fix", () => {
    const w = house((s) => { s.objects[1].type = "starter/chiar"; s.acts = []; });
    expect(() => buildLot(w)).toThrow(WorldError);
    try { buildLot(w); } catch (e: any) { expect(e.message).toContain("fix: did you mean starter/chair?"); }
  });

  test("JSON round-trips", () => {
    const json = toJSON(tiny);
    const back = fromJSON(json, [starter]);
    expect(back.doc).toEqual(tiny.doc);
    expect(validateWorld(back)).toEqual([]);
    expect(JSON.parse(json).packs).toEqual(["starter"]);
  });

  test("objects without ids get stable ones by type", () => {
    const w = defineWorld({ id: "x", packs: [starter], lot: { w: 6, d: 6 }, objects: [{ type: "starter/plant", at: [0, 0] }, { type: "starter/plant", at: [1, 0] }, { type: "starter/lamp", at: [2, 0] }] });
    expect(w.doc.objects.map((o: any) => o.id)).toEqual(["plant-1", "plant-2", "lamp-1"]);
  });
});
