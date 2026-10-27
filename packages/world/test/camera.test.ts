// The Sims camera: during a turn the camera's height is constant, the focus stays on the same screen point, the zoom
// does not change, and the turn ends exactly on 45° + n·90°. At rest, a pan lands the world on whole device pixels.
import { describe, expect, test } from "bun:test";
import { createCamera, stepCamera, cameraPose, project, unproject, rotateCamera, zoomCamera, panCamera, fitCamera, ZOOMS } from "@hq/world/model";

const cam0 = () => createCamera({ w: 1280, h: 800, dpr: 2, zoom: 1, focus: [7, 5.5], bounds: { minX: 0, minZ: 0, maxX: 14, maxZ: 11 } });

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
      expect(new Set(ppm)).toEqual(new Set([ZOOMS[1]]));
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
    zoomCamera(cam, 2);
    while (stepCamera(cam, 16)) { const c = project(cameraPose(cam), [7, 0, 5.5]); expect(Math.abs(c.x - 640)).toBeLessThan(1e-6); }
    expect(cam.ppm).toBe(ZOOMS[2]);
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
    expect(step).toBe(1);
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
});
