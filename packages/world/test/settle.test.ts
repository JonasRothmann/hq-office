// The end of every motion is drawn: the frame that finishes a turn, a zoom, a fitBox or a focusOn is drawn at the
// snapped pose, and a clip's cross-fade is drawn to its end, so a still view always shows where things came to rest.
import { expect, test } from "bun:test";
import { fromJSON, cameraPose, CLIPS, samplePose, ZOOM_STOPS } from "@hq/world/model";
import { createDriver } from "../src/view/driver.js";
import house from "./fixtures/house.world.js";

const STEP = 1000 / 60;
const edit = (world: any, fn: (d: any) => void) => { const d = structuredClone(world.doc); fn(d); return fromJSON(d, world.packs); };
const quiet = edit(house, (d) => { d.acts = []; });
let clock = 0;
// Run the driver; remember the camera pose and the characters' poses at the last frame it asked to draw.
function run(d: any, ms: number, rec: any) {
  for (let t = 0; t < ms - 1e-9; t += STEP) {
    const f = d.tick((clock += STEP), STEP);
    if (f.render) { rec.pose = JSON.stringify(cameraPose(d.cam)); rec.chars = JSON.stringify(d.sim.characters().map((id: string) => [d.sim.character(id), d.sim.pose(id), d.sim.ecs.get(id, "anim")])); rec.n++; }
  }
}
const mk = (o: any = {}) => { const d = createDriver(quiet, { size: { w: 1280, h: 800, dpr: 1 }, ...o }); const rec: any = { n: 0 }; run(d, 100, rec); return { d, rec }; };
const nowPose = (d: any) => JSON.stringify(cameraPose(d.cam));

for (const walls of ["up", "down", "cutaway"]) test(`turn with walls ${walls}: the final, snapped pose is drawn`, () => {
  const { d, rec } = mk({ walls });
  d.rotate(1); run(d, 2000, rec);
  expect(cameraPose(d.cam).snapped).toBe(true);
  expect(JSON.parse(rec.pose).snapped).toBe(true);
  expect(rec.pose).toBe(nowPose(d));
});

test("zoom: the final, snapped pose is drawn", () => {
  const { d, rec } = mk();
  d.zoom(d.cam.zoom === ZOOM_STOPS.near ? ZOOM_STOPS.mid : ZOOM_STOPS.near); run(d, 2000, rec);
  expect(JSON.parse(rec.pose).snapped).toBe(true);
  expect(rec.pose).toBe(nowPose(d));
});

test("zoom toward the cursor, retargeted twice mid-zoom: the final, snapped pose is drawn", () => {
  const { d, rec } = mk();
  const z = d.cam.zoom;
  d.zoom(z + 1, [300, 250]); run(d, 60, rec);
  d.zoom(z + 2, [310, 240]); run(d, 60, rec);
  d.zoom(z + 3, [320, 230]); run(d, 2000, rec);
  expect(d.cam.zoom).toBe(z + 3);
  expect(JSON.parse(rec.pose).snapped).toBe(true);
  expect(rec.pose).toBe(nowPose(d));
});

test("fitBox: the final, snapped pose is drawn", () => {
  const { d, rec } = mk();
  d.fitBox(d.roomBox("study")); run(d, 2000, rec);
  expect(JSON.parse(rec.pose).snapped).toBe(true);
  expect(rec.pose).toBe(nowPose(d));
});

test("focusOn: the final, snapped pose is drawn", () => {
  const { d, rec } = mk();
  d.focusOn(9, 5); run(d, 2000, rec);
  expect(rec.pose).toBe(nowPose(d));
});

// Idle breathing loops in place and is not drawn (idleFps 0), so "at rest" is the idle clip with the walk faded out.
test("walk: the last drawn pose of the character is its pose at rest", () => {
  const { d, rec } = mk();
  d.sim.act("ada", { do: "walk", to: [10, 3] }); run(d, 8000, rec);
  expect(d.sim.character("ada").step).toBe("loop");
  const [char, pose, anim] = JSON.parse(rec.chars)[0], now = d.sim.character("ada");
  expect(char.clip).toBe(now.clip);
  expect([char.x, char.z, char.ry, char.hips]).toEqual([now.x, now.z, now.ry, now.hips]);
  expect(JSON.stringify(pose)).toBe(JSON.stringify(samplePose(CLIPS[now.clip], anim.t)));
});

test("sit: the last drawn pose is the sit/type pose", () => {
  const { d, rec } = mk();
  d.sim.act("ada", { do: "sit", target: "chair-1", clip: "type" }); run(d, 9000, rec);
  const drawn = JSON.parse(rec.chars)[0];
  expect(drawn[0].clip).toBe("type");
});
