// The view's driver, headless: createWorld does only what it decides. A still view draws nothing and never redraws
// shadows; a walk draws every frame; a turn never refits; edits at run time keep the sim going, rebuild only what
// changed, and the same doc twice is a no-op; the backing store matches device pixels, so a pan moves whole pixels.
import { describe, expect, test } from "bun:test";
import { fromJSON, cameraPose, project, panCamera } from "@hq/world/model";
import { createDriver } from "../src/view/driver.js";
import { canvasSize } from "../src/view/size.js";
import house from "./fixtures/house.world.js";

const STEP = 1000 / 60;
const edit = (world: any, fn: (d: any) => void) => { const d = structuredClone(world.doc); fn(d); return fromJSON(d, world.packs); };
const quiet = edit(house, (d) => { d.acts = []; });
let clock = 0;
// Run the driver for ms at 60 fps; count what it asked to draw.
function frames(drv: any, ms: number) {
  const out = { frames: 0, renders: 0, shadows: 0, cuts: 0 };
  for (let t = 0; t < ms - 1e-9; t += STEP) {
    const f = drv.tick((clock += STEP), STEP);
    out.frames++;
    if (f.render) out.renders++;
    if (f.shadows) out.shadows++;
    if (f.cut) out.cuts++;
  }
  return out;
}
const driver = (world: any = quiet, o: any = {}) => { const d = createDriver(world, { size: { w: 1280, h: 800, dpr: 1 }, ...o }); frames(d, STEP); return d; };

describe("idle means idle", () => {
  test("still: no render and no shadow redraw; a walk: a frame and a shadow redraw per frame; then still again", () => {
    const d = driver();
    expect(frames(d, 3000)).toEqual({ frames: 180, renders: 0, shadows: 0, cuts: 0 });
    d.sim.act("ada", { do: "sit", target: "chair-1", clip: "type" });
    const walk = frames(d, 8000);
    expect(d.sim.character("ada").step).toBe("loop");
    // she moves for about 5.5 s of the 8 (walk, turn, sit down); every one of those frames draws and moves her shadow
    expect(walk.renders).toBe(walk.shadows);
    expect(walk.renders).toBeGreaterThan(300);
    expect(walk.renders).toBeLessThan(480);
    // seated and typing: the clip loops in place, which is not motion
    expect(frames(d, 5000)).toEqual({ frames: 300, renders: 0, shadows: 0, cuts: 0 });
  });

  test("idleFps draws a clip looping in place at that rate, and never redraws shadows for it", () => {
    const d = driver(house, { idleFps: 4 });
    frames(d, 9000);
    const still = frames(d, 5000);
    expect(still.renders).toBeGreaterThanOrEqual(19);
    expect(still.renders).toBeLessThanOrEqual(21);
    expect(still.shadows).toBe(0);
  });

  test("a pan or a hover draws once without shadows; a turn draws each frame and redraws shadows only when the cut walls change", () => {
    const d = driver();
    d.pan(12, 5);
    expect(frames(d, 1000)).toEqual({ frames: 60, renders: 1, shadows: 0, cuts: 0 });
    d.invalidate();
    expect(frames(d, 1000)).toEqual({ frames: 60, renders: 1, shadows: 0, cuts: 0 });
    d.rotate(1);
    const turn = frames(d, 1000);
    expect(turn.renders).toBeGreaterThanOrEqual(23); // 380 ms of turn at 60 fps
    expect(turn.renders).toBeLessThanOrEqual(25);
    expect(turn.cuts).toBe(2);                       // the union of both ends' cuts at the start, the new cut at the end
    expect(turn.shadows).toBe(2);
  });

  test("an edit or a theme change redraws once, shadows included", () => {
    const d = driver();
    d.apply(edit(quiet, (doc) => { doc.objects.push({ id: "plant-9", type: "starter/plant", at: [9, 3], facing: "s" }); }));
    expect(frames(d, 1000)).toEqual({ frames: 60, renders: 1, shadows: 1, cuts: 0 });
    d.invalidate({ shadows: true });
    expect(frames(d, 1000)).toEqual({ frames: 60, renders: 1, shadows: 1, cuts: 0 });
  });
});

describe("the camera never refits on its own", () => {
  test("through a turn, a resize and an edit mid-turn: focus, zoom and px per metre never change; only the azimuth moves", () => {
    const d = driver();
    const { focus, zoom, ppm } = d.cam;
    const seen = new Set<string>();
    d.rotate(1);
    for (let i = 0; i < 30; i++) {
      if (i === 5) d.resize({ w: 1100, h: 700, dpr: 2 });
      if (i === 8) d.apply(edit(quiet, (doc) => { doc.walls.push({ path: [[2, 6], [7, 6]] }); doc.openings.push({ type: "starter/door", at: [3, 6], side: "n" }); }));
      d.tick((clock += STEP), STEP);
      seen.add(JSON.stringify([d.cam.focus, d.cam.zoom, d.cam.ppm]));
      const pose = cameraPose(d.cam);
      expect(pose.position[1]).toBeCloseTo(50, 9);
    }
    expect([...seen]).toEqual([JSON.stringify([focus, zoom, ppm])]);
    expect(d.cam.turn).toBeNull();
    expect(d.cam.az).toBeCloseTo(Math.PI / 4 + Math.PI / 2, 12);
  });

  test("fitBox eases to a room at a zoom that fits it at every rotation, and lands on whole pixels", () => {
    const d = driver();
    const box = d.roomBox("study");
    expect(box).toEqual({ minX: 2, minZ: 2, maxX: 7, maxZ: 9 });
    d.fitBox(box);
    const mid = frames(d, 200);
    expect(mid.renders).toBe(12);
    expect(d.cam.moving).not.toBeNull();
    frames(d, 400);
    expect(d.cam.moving).toBeNull();
    expect(d.cam.focus).toEqual([4.5, 5.5]);
    expect(cameraPose(d.cam).snapped).toBe(true);
    d.focusOn(9, 5);
    frames(d, 1000);
    expect(d.cam.focus).toEqual([9, 5]);
  });
});

describe("edits at run time", () => {
  test("a character added mid-walk: the walker walks on untouched, the new one appears where the doc puts it", () => {
    const a = driver(), b = driver();
    for (const d of [a, b]) d.sim.act("ada", { do: "sit", target: "chair-1" });
    frames(a, 2000); frames(b, 2000);
    const diff = b.apply(edit(quiet, (doc) => { doc.characters.push({ id: "bob", at: [10, 7], facing: "w" }); }));
    expect(diff.characters).toEqual({ added: ["bob"], removed: [], changed: [] });
    expect(diff.lot).toBe(false);
    expect(b.sim.character("bob")).toMatchObject({ x: 10.5, z: 7.5, step: null });
    frames(a, 6000); frames(b, 6000);
    expect(b.sim.character("ada")).toEqual(a.sim.character("ada"));
  });

  test("the chair being walked to is removed: the act fails cleanly, she stops where she is and the slot is free", async () => {
    const d = driver();
    let error: any = null;
    d.sim.act("ada", { do: "sit", target: "chair-1" }).catch((e: any) => { error = e; });
    frames(d, 2000);
    const at = d.sim.character("ada");
    d.apply(edit(quiet, (doc) => { doc.objects = doc.objects.filter((o: any) => o.id !== "chair-1"); }));
    const after = d.sim.character("ada");
    expect([after.x, after.z]).toEqual([at.x, at.z]); // nothing jumps
    await Promise.resolve();
    expect(error?.problems?.[0]).toMatchObject({ code: "act.target", message: "no object 'chair-1'" });
    expect(d.sim.ecs.get("ada", "holding")).toBeUndefined();
    frames(d, 1000);
    expect(d.sim.character("ada")).toMatchObject({ step: "loop", clip: "idle", x: at.x, z: at.z });
  });

  test("the chair she sits on moves: she gets up and sits on it where it is now", async () => {
    const d = driver();
    d.sim.act("ada", { do: "sit", target: "chair-1" });
    frames(d, 9000);
    d.apply(edit(quiet, (doc) => { doc.objects.find((o: any) => o.id === "chair-1").at = [5, 5]; }));
    frames(d, 9000);
    const c = d.sim.character("ada");
    expect(c).toMatchObject({ step: "loop", clip: "sit" });
    expect([Math.floor(c.x), Math.floor(c.z)]).toEqual([5, 5]);
    expect(d.sim.holder("chair-1", "seat")).toBe("ada");
  });

  test("the same doc applied twice is a no-op: null, and the state is untouched", () => {
    const d = driver();
    d.sim.act("ada", { do: "sit", target: "chair-1" });
    frames(d, 1500);
    const next = edit(quiet, (doc) => { doc.objects.push({ id: "plant-9", type: "starter/plant", at: [9, 3], facing: "s" }); });
    expect(d.apply(next)).not.toBeNull();
    frames(d, 100);
    const state = JSON.stringify(d.sim.ecs.toJSON());
    expect(d.apply(next)).toBeNull();
    expect(d.apply(structuredClone(next.doc))).toBeNull(); // a plain doc with the same data
    expect(JSON.stringify(d.sim.ecs.toJSON())).toBe(state);
    expect(frames(d, 0)).toEqual({ frames: 0, renders: 0, shadows: 0, cuts: 0 });
  });

  test("a bad doc throws every problem and changes nothing", () => {
    const d = driver();
    const lot = d.lot;
    expect(() => d.apply(edit(quiet, (doc) => { doc.objects.push({ id: "x", type: "starter/chiar", at: [9, 3] }); }))).toThrow(/did you mean starter\/chair/);
    expect(d.lot).toBe(lot);
  });

  test("a lot change keeps characters on valid tiles: a walker replans round a new wall; one under a new desk steps off it", () => {
    const d = driver(edit(quiet, (doc) => { doc.characters.push({ id: "bob", at: [9, 4], facing: "s" }); }));
    d.sim.act("ada", { do: "sit", target: "chair-1" });
    frames(d, 1200); // she is on her way to the inner door at (7, 5)
    // the inner door moves north to (6, 3) and a desk lands on Bob
    d.apply(edit(quiet, (doc) => {
      doc.characters.push({ id: "bob", at: [10, 7], facing: "s" }); // a doc's `at` only places a new character
      doc.openings.find((o: any) => o.at[0] === 6 && o.at[1] === 5).at = [6, 3];
      doc.objects.push({ id: "desk-9", type: "starter/desk", at: [9, 3], facing: "e" }); // on (9, 3) and (9, 4)
    }));
    const path: number[][] = [];
    for (let i = 0; i < 600; i++) { d.tick((clock += STEP), STEP); const c = d.sim.character("ada"); path.push([c.x, c.z]); }
    const crossings = path.slice(1).filter((p, i) => (path[i][0] >= 7) !== (p[0] >= 7));
    expect(crossings.length).toBe(1);
    expect(Math.floor(crossings[0][1])).toBe(3); // through the new door
    expect(d.sim.character("ada")).toMatchObject({ step: "loop", clip: "sit" });
    const bob = d.sim.character("bob");
    expect(d.nav.walkable(Math.floor(bob.x), Math.floor(bob.z))).toBe(true);
    for (const id of ["ada", "bob"]) { const c = d.sim.character(id); expect(c.x >= 0 && c.z >= 0 && c.x < d.lot.w && c.z < d.lot.d).toBe(true); }
  });

  test("only what changed is named: an object moved, one removed, a look changed", () => {
    const d = driver();
    const diff = d.apply(edit(quiet, (doc) => {
      doc.objects.find((o: any) => o.id === "lamp-1").at = [6, 3];
      doc.objects = doc.objects.filter((o: any) => o.id !== "plant-3");
      doc.characters[0].look = { shirt: "#336699" };
    }));
    expect(diff).toMatchObject({ lot: false, packs: false, objects: { added: [], removed: ["plant-3"], changed: ["lamp-1"] }, characters: { added: [], removed: [], changed: ["ada"] } });
    expect(d.sim.ecs.get("ada", "character").look).toEqual({ shirt: "#336699" });
  });
});

describe("canvas sizing", () => {
  test("the backing store is the device-pixel box when the browser reports it; else the CSS box rounded to device pixels", () => {
    expect(canvasSize({ css: { w: 1280, h: 800 }, dpr: 1 })).toEqual({ w: 1280, h: 800, dpr: 1, bw: 1280, bh: 800, style: { w: 1280, h: 800 } });
    // a fractional box at 1.5: the browser says 1535 device px; the camera draws 1535 / 1.5 CSS px, no style needed
    expect(canvasSize({ css: { w: 1023.4, h: 700.6 }, dpr: 1.5, device: { w: 1535, h: 1051 } })).toEqual({ w: 1535 / 1.5, h: 1051 / 1.5, dpr: 1.5, bw: 1535, bh: 1051, style: null });
    // no device box: round to device pixels and size the canvas to match
    const s = canvasSize({ css: { w: 1023.4, h: 700.6 }, dpr: 1.5 });
    expect([s.bw, s.bh, s.style!.w * 1.5, s.style!.h * 1.5]).toEqual([1535, 1051, 1535, 1051]);
    expect(canvasSize({ css: { w: 801.3, h: 600 }, dpr: 2 })).toMatchObject({ bw: 1603, bh: 1200, w: 801.5 });
    // above the cap the buffer is scaled up, so no snap can hold; it says so by setting no style
    expect(canvasSize({ css: { w: 400, h: 300 }, dpr: 3, device: { w: 1200, h: 900 } })).toMatchObject({ dpr: 2, bw: 800, bh: 600, style: null });
  });

  for (const [dpr, css] of [[1, { w: 1280, h: 800 }], [1.5, { w: 1280, h: 800 }], [2, { w: 1280, h: 800 }], [1.5, { w: 1023.4, h: 700.6 }], [1, { w: 1023.4, h: 700.6 }], [2, { w: 801.3, h: 600.7 }]] as const) {
    test(`at DPR ${dpr} and ${css.w}×${css.h} CSS px, a pan moves every point by the same whole number of device pixels`, () => {
      const s = canvasSize({ css, dpr });
      expect(Number.isInteger(s.bw) && Number.isInteger(s.bh)).toBe(true);
      expect(s.w * s.dpr).toBeCloseTo(s.bw, 9); // the camera draws exactly the backing store
      const d = driver(quiet, { size: { w: s.w, h: s.h, dpr: s.dpr }, zoom: 2 });
      const pts = [[5, 0, 5], [3.3, 1.2, 7.9], [11.7, 2.9, 2.2]];
      const dev = () => { const pose = cameraPose(d.cam); return pts.map((p) => { const q = project(pose, p); return [q.x * s.dpr, q.y * s.dpr]; }); };
      const a = dev();
      panCamera(d.cam, 7.37, 3.11);
      const b = dev();
      const shift = [b[0][0] - a[0][0], b[0][1] - a[0][1]];
      expect(Math.abs(shift[0] - Math.round(shift[0]))).toBeLessThan(1e-6);
      expect(Math.abs(shift[1] - Math.round(shift[1]))).toBeLessThan(1e-6);
      for (let i = 1; i < pts.length; i++) {
        expect(b[i][0] - a[i][0]).toBeCloseTo(shift[0], 6);
        expect(b[i][1] - a[i][1]).toBeCloseTo(shift[1], 6);
      }
    });
  }
});
