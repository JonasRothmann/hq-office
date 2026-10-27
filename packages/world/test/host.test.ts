// What a host page needs from the view's driver, headless: insets (the edges its panels cover), so the view centres
// and fits in the free part, and pause, so a covered view neither steps nor draws.
import { describe, expect, test } from "bun:test";
import { fromJSON, cameraPose, project } from "@hq/world/model";
import { createDriver } from "../src/view/driver.js";
import house from "./fixtures/house.world.js";

const STEP = 1000 / 60;
const quiet = fromJSON({ ...structuredClone(house.doc), acts: [] }, house.packs);
let clock = 0;
const run = (d: any, ms: number) => {
  let renders = 0;
  for (let t = 0; t < ms - 1e-9; t += STEP) if (d.tick((clock += STEP), STEP).render) renders++;
  return renders;
};
// The middle of the indoor box on screen, CSS px.
const middle = (d: any) => {
  const b = d.box;
  return project(cameraPose(d.cam), [(b.minX + b.maxX) / 2, 0, (b.minZ + b.maxZ) / 2]);
};

describe("insets", () => {
  test("the view centres in the free part, and fit picks the zoom that fits there", () => {
    const wide = createDriver(quiet, { size: { w: 1000, h: 600, dpr: 1 } });
    const inset = createDriver(quiet, { size: { w: 1000, h: 600, dpr: 1 }, insets: { left: 400, top: 60, right: 0, bottom: 0 } });
    run(wide, STEP); run(inset, STEP);
    const a = middle(wide), b = middle(inset);
    expect(a.x).toBeCloseTo(500, 0);
    expect(b.x).toBeCloseTo(700, 0);   // the middle of 400..1000
    expect(b.y).toBeCloseTo(330, 0);   // the middle of 60..600
    expect(inset.cam.zoom).toBeLessThanOrEqual(wide.cam.zoom);
  });

  test("setInsets moves the centre at once, draws once, and never refits on its own", () => {
    const d = createDriver(quiet, { size: { w: 1000, h: 600, dpr: 1 } });
    run(d, STEP);
    const zoom = d.cam.zoom, focus = [...d.cam.focus];
    d.setInsets({ left: 300 });
    expect(run(d, 500)).toBe(1);
    expect(middle(d).x).toBeCloseTo(650, 0);
    expect(d.cam.zoom).toBe(zoom);
    expect(d.cam.focus).toEqual(focus);
    // a fit afterwards fits into the free part
    d.setInsets({ left: 900 });
    d.fit();
    run(d, STEP);
    expect(d.cam.zoom).toBe(0);
  });
});

describe("pause", () => {
  test("paused: no step and no draw, even while a character walks; resuming draws and the walk goes on", () => {
    const d = createDriver(quiet, { size: { w: 1000, h: 600, dpr: 1 } });
    run(d, STEP);
    d.sim.act("ada", { do: "sit", target: "chair-1", clip: "type" });
    run(d, 500);
    const at = d.sim.character("ada");
    d.pause(true);
    expect(d.paused).toBe(true);
    const frames = d.stats.frames;
    expect(run(d, 2000)).toBe(0);
    expect(d.stats.frames).toBe(frames);
    expect(d.sim.character("ada")).toEqual(at);
    d.pause(false);
    expect(run(d, STEP)).toBe(1);
    run(d, 8000);
    expect(d.sim.character("ada").step).toBe("loop");
  });
});
