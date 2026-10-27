// The Sims camera: during a turn the camera's height is constant, the focus stays on the same screen point, the zoom
// does not change, and the turn ends exactly on 45° + n·90°. At rest, a pan lands the world on whole device pixels, at
// every stop of the zoom ladder. A zoom toward the cursor keeps the ground under it; wheel deltas add up into stops.
import { describe, expect, test } from "bun:test";
import { createCamera, stepCamera, cameraPose, project, unproject, rotateCamera, zoomCamera, panCamera, fitCamera, ZOOMS, ZOOM_STOPS } from "@hq/world/model";
import { wheelSteps, WHEEL_STOP } from "../src/camera/rig.js";

const { far, mid, near } = ZOOM_STOPS;
const settle = (cam: any) => { while (stepCamera(cam, 16)); };
const cam0 = () => createCamera({ w: 1280, h: 800, dpr: 2, zoom: mid, focus: [7, 5.5], bounds: { minX: 0, minZ: 0, maxX: 14, maxZ: 11 } });

describe("camera", () => {
  test("a turn: constant height, focus fixed on screen, zoom unchanged, ends on the step", () => {
    for (const dir of [1, -1]) {
      const cam = cam0();
      rotateCamera(cam, dir);
      const ys: number[] = [], centre: number[][] = [], ppm: number[] = [];
      let frames = 0;
      do {
        const pose = cameraPose(cam);
        ys.push(pose.position[1]);
        const c = project(pose, [7, 0, 5.5]);
        centre.push([c.x, c.y]);
        ppm.push(pose.ppm);
        frames++;
      } while (stepCamera(cam, 1000 / 60) || frames < 3);
      expect(frames).toBeGreaterThan(15);
      expect(Math.max(...ys) - Math.min(...ys)).toBeLessThan(1e-9);
      for (const [x, y] of centre) { expect(Math.abs(x - 640)).toBeLessThan(0.51); expect(Math.abs(y - 400)).toBeLessThan(0.51); }
      expect(new Set(ppm)).toEqual(new Set([ZOOMS[mid]]));
      expect(cam.az).toBeCloseTo(Math.PI / 4 + dir * Math.PI / 2, 12);
    }
  });

  test("a turn never moves the focus, even from a panned view", () => {
    const cam = cam0();
    panCamera(cam, 133.3, -41.7);
    const before = [...cam.focus];
    rotateCamera(cam, 1);
    while (stepCamera(cam, 16)) expect(cam.focus).toEqual(before);
  });

  test("at rest, a pan by any drag moves the world by whole device pixels", () => {
    const cam = cam0();
    const probe = [3.21, 0.7, 8.9];
    const p0 = project(cameraPose(cam), probe);
    for (const [dx, dy] of [[0.3, 0], [17.37, -4.2], [-250.01, 99.9]]) {
      panCamera(cam, dx, dy);
      const p = project(cameraPose(cam), probe);
      const sx = (p.x - p0.x) * cam.dpr, sy = (p.y - p0.y) * cam.dpr;
      expect(Math.abs(sx - Math.round(sx))).toBeLessThan(1e-6);
      expect(Math.abs(sy - Math.round(sy))).toBeLessThan(1e-6);
    }
  });

  test("zoom steps ease about the focus; the focus stays put", () => {
    const cam = cam0();
    zoomCamera(cam, near);
    while (stepCamera(cam, 16)) { const c = project(cameraPose(cam), [7, 0, 5.5]); expect(Math.abs(c.x - 640)).toBeLessThan(1e-6); }
    expect(cam.ppm).toBe(ZOOMS[near]);
  });

  test("unproject inverts project on the ground", () => {
    const cam = cam0();
    rotateCamera(cam, 1);
    while (stepCamera(cam, 16));
    const pose = cameraPose(cam);
    const s = project(pose, [4.25, 0, 9.5]);
    const g = unproject(pose, [s.x, s.y]);
    expect(g[0]).toBeCloseTo(4.25, 9);
    expect(g[2]).toBeCloseTo(9.5, 9);
  });

  test("fit picks one zoom that fits at every rotation, so turning never refits", () => {
    const cam = createCamera({ w: 1280, h: 800 });
    const step = fitCamera(cam, { minX: 0, minZ: 0, maxX: 14, maxZ: 11 });
    expect(step).toBe(mid);
    expect(cam.focus).toEqual([7, 5.5]);
    for (let r = 0; r < 4; r++) {
      rotateCamera(cam, 1);
      while (stepCamera(cam, 16));
      const pose = cameraPose(cam);
      for (const [x, z] of [[0, 0], [14, 0], [0, 11], [14, 11]]) for (const y of [0, 3]) {
        const p = project(pose, [x, y, z]);
        expect(p.x >= 0 && p.x <= 1280 && p.y >= 0 && p.y <= 800).toBe(true);
      }
    }
  });

  // The box's corners, floor and wall tops, on screen at every rotation: whether all lie inside the margin.
  const fits = (w: number, h: number, box: number[], stop: number, margin = 24) => {
    const cam = createCamera({ w, h, zoom: stop, focus: [(box[0] + box[2]) / 2, (box[1] + box[3]) / 2] });
    for (let r = 0; r < 4; r++) {
      const pose = cameraPose(cam);
      for (const x of [box[0], box[2]]) for (const z of [box[1], box[3]]) for (const y of [0, 3.01]) {
        const p = project(pose, [x, y, z]);
        if (p.x < margin - 1e-6 || p.x > w - margin + 1e-6 || p.y < margin - 1e-6 || p.y > h - margin + 1e-6) return false;
      }
      rotateCamera(cam, 1);
      settle(cam);
    }
    return true;
  };

  test("fit picks the closest stop of the whole ladder that fits at every rotation: a stop between the named ones", () => {
    const box = [0, 0, 10, 8];
    const cam = createCamera({ w: 1280, h: 800 });
    const step = fitCamera(cam, { minX: 0, minZ: 0, maxX: 10, maxZ: 8 });
    expect(step).toBe(8);                                       // 64 px/m; the old three steps would have taken 45.3
    expect(Object.values(ZOOM_STOPS)).not.toContain(step);
    expect(fits(1280, 800, box, step)).toBe(true);
    expect(fits(1280, 800, box, step + 1)).toBe(false);
  });
});

describe("the zoom ladder", () => {
  test("a geometric ladder from 16 to 128 px/m at about 2^(1/4); the named stops are the old three steps", () => {
    expect(ZOOMS.length).toBe(13);
    expect(ZOOMS[0]).toBe(16);
    expect(ZOOMS.at(-1)).toBe(128);
    for (let k = 1; k < ZOOMS.length; k++) expect(Math.abs(ZOOMS[k] / ZOOMS[k - 1] - 2 ** 0.25)).toBeLessThan(0.005);
    expect([ZOOMS[far], ZOOMS[mid], ZOOMS[near]]).toEqual([22.6, 45.3, 90.5]);
  });

  for (const dpr of [1, 1.5, 2]) test(`at DPR ${dpr}, every stop settles on a snapped pose, and a pan there moves the world by whole device pixels`, () => {
    for (let k = 0; k < ZOOMS.length; k++) {
      const cam = createCamera({ w: 1023.4, h: 700.6, dpr, zoom: mid, focus: [7.13, 5.29], bounds: { minX: 0, minZ: 0, maxX: 14, maxZ: 11 } });
      zoomCamera(cam, k, [300.3, 211.7]);
      settle(cam);
      expect(cam.ppm).toBe(ZOOMS[k]);
      expect(cameraPose(cam).snapped).toBe(true);
      const probe = [3.21, 0.7, 8.9];
      const p0 = project(cameraPose(cam), probe);
      panCamera(cam, 17.37, -4.2);
      const p = project(cameraPose(cam), probe);
      const sx = (p.x - p0.x) * dpr, sy = (p.y - p0.y) * dpr;
      expect(Math.abs(sx - Math.round(sx))).toBeLessThan(1e-6);
      expect(Math.abs(sy - Math.round(sy))).toBeLessThan(1e-6);
    }
  });

  test("a zoom toward a point keeps the ground under it there through the ease, and within a device pixel after settle", () => {
    for (const rot of [0, 1, 3]) for (const dpr of [1, 1.5, 2]) for (const [step, at] of [[near, [400, 300]], [far, [900.5, 610.25]], [mid + 1, [640, 400]], [ZOOMS.length - 1, [123.4, 700.1]]] as const) {
      const cam = createCamera({ w: 1280, h: 800, dpr, rot, zoom: mid, focus: [50, 50], bounds: { minX: 0, minZ: 0, maxX: 100, maxZ: 100 } });
      const g = unproject(cameraPose(cam), at);
      zoomCamera(cam, step, at);
      while (stepCamera(cam, 16)) {
        const p = project(cameraPose(cam), g);
        expect(Math.abs(p.x - at[0])).toBeLessThan(1e-6);
        expect(Math.abs(p.y - at[1])).toBeLessThan(1e-6);
      }
      const pose = cameraPose(cam);
      expect(pose.snapped).toBe(true);
      const p = project(pose, g);
      expect(Math.hypot(p.x - at[0], p.y - at[1]) * dpr).toBeLessThan(1);
    }
  });

  test("a zoom toward a point never takes the focus past the bounds", () => {
    const cam = createCamera({ w: 1280, h: 800, zoom: mid, focus: [7, 5.5], bounds: { minX: 0, minZ: 0, maxX: 14, maxZ: 11 } });
    zoomCamera(cam, near, [5, 5]);
    const inside = () => cam.focus[0] >= 0 && cam.focus[0] <= 14 && cam.focus[1] >= 0 && cam.focus[1] <= 11;
    while (stepCamera(cam, 16)) expect(inside()).toBe(true);
    expect(inside()).toBe(true);
  });

  test("a new zoom mid-zoom retargets from where the scale is: no queue, no stall, no step back", () => {
    const cam = cam0();
    zoomCamera(cam, mid + 1, [500, 300]);
    for (let i = 0; i < 6; i++) stepCamera(cam, 16);
    zoomCamera(cam, mid + 2, [500, 300]);
    zoomCamera(cam, mid + 3, [500, 300]);
    expect(cam.zoom).toBe(mid + 3);
    const ppm = [cam.ppm];
    while (stepCamera(cam, 16)) ppm.push(cam.ppm);
    ppm.push(cam.ppm);
    for (let i = 1; i < ppm.length; i++) expect(ppm[i]).toBeGreaterThan(ppm[i - 1] - 1e-9);
    expect(ppm[1] - ppm[0]).toBeGreaterThan(0.1);               // eased out: it keeps moving at once
    expect(cam.ppm).toBe(ZOOMS[mid + 3]);
    expect(ppm.length).toBeLessThan(260 / 16 + 3);              // one ease, not three queued
  });

  test("a turn mid-zoom keeps the target: the same stop and the same focus as without the turn", () => {
    const zoomed = (turnAt: number | null) => {
      const cam = createCamera({ w: 1280, h: 800, dpr: 2, zoom: mid, focus: [50, 50], bounds: { minX: 0, minZ: 0, maxX: 100, maxZ: 100 } });
      zoomCamera(cam, near, [300, 200]);
      for (let i = 0; stepCamera(cam, 16) || i < 2; i++) if (i === turnAt) rotateCamera(cam, 1);
      return cam;
    };
    const plain = zoomed(null), turned = zoomed(4);
    expect(turned.zoom).toBe(near);
    expect(turned.ppm).toBe(ZOOMS[near]);
    expect(turned.focus[0]).toBeCloseTo(plain.focus[0], 9);
    expect(turned.focus[1]).toBeCloseTo(plain.focus[1], 9);
    expect(turned.az).toBeCloseTo(Math.PI / 4 + Math.PI / 2, 12);
  });

  test("a pan mid-zoom lets go of the point; the zoom goes on to its stop", () => {
    const cam = cam0();
    zoomCamera(cam, near, [300, 200]);
    stepCamera(cam, 16);
    panCamera(cam, 10, 0);
    const f = [...cam.focus];
    settle(cam);
    expect(cam.focus).toEqual(f);
    expect(cam.ppm).toBe(ZOOMS[near]);
  });
});

describe("wheel and pinch to stops", () => {
  const ev = (deltaY: number, timeStamp: number, o: any = {}) => ({ deltaY, timeStamp, ...o });
  test("small trackpad deltas add up to one stop each time they pass a notch's worth", () => {
    const acc = {};
    const out = Array.from({ length: 20 }, (_, i) => wheelSteps(acc, ev(-12, i * 16)));
    expect(out.filter((n) => n).length).toBe(2);                // 240 px: two stops, 40 px left over
    expect(out.indexOf(1)).toBe(8);                             // the ninth delta passes 100
    expect(out.every((n) => n === 0 || n === 1)).toBe(true);    // deltaY < 0 is closer
  });

  test("a mouse notch is one stop; a larger delta is still one stop per event", () => {
    const acc = {};
    expect([0, 1, 2].map((i) => wheelSteps(acc, ev(WHEEL_STOP, i * 100)))).toEqual([-1, -1, -1]);
    expect(wheelSteps(acc, ev(-480, 400))).toBe(1);
    expect(wheelSteps(acc, ev(3, 500, { deltaMode: 1 }))).toBe(-1); // three lines
  });

  test("a change of direction or a pause starts the total again", () => {
    const acc = {};
    expect(wheelSteps(acc, ev(-90, 0))).toBe(0);
    expect(wheelSteps(acc, ev(20, 16))).toBe(0);                // reversed: the 90 is dropped
    expect(wheelSteps(acc, ev(-90, 32))).toBe(0);
    expect(wheelSteps(acc, ev(-90, 1000))).toBe(0);             // after a pause: the 90 before it is dropped
    expect(wheelSteps(acc, ev(-10, 1016))).toBe(1);
    expect(wheelSteps(acc, ev(0, 1032))).toBe(0);               // a sideways scroll changes nothing
  });

  test("a pinch (ctrlKey) takes a stop per scale step of 2^(1/4), as the browser scales by exp(-deltaY / 100)", () => {
    const acc = {};
    const out = Array.from({ length: 6 }, (_, i) => wheelSteps(acc, ev(-6, i * 16, { ctrlKey: true })));
    expect(out).toEqual([0, 0, 1, 0, 0, 1]);
    expect(wheelSteps(acc, ev(100, 200, { ctrlKey: true }))).toBe(-1); // a ctrl+wheel notch is one stop, not six
  });
});
