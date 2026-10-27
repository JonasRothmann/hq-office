#!/usr/bin/env bun
// The engine's proof, measured in headless Chrome on a world (default: the test house):
//   1. a 90° turn: six frames, the camera's height and the focus's screen point per frame (must not move);
//   2. panning: two consecutive frames compared after undoing the whole-pixel shift, for the engine and for the old
//      defects switched back on (no pixel snap; three's screen-space shadow dither);
//   3. the wall modes; 4. a character walking to a chair and sitting down; 5. night.
//
//   bun packages/world/tools/proof.ts [--world path] [--root DIR] [--out DIR]
import { mkdirSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { serve, PKG } from "./serve.ts";
import { startChrome, openTab } from "./chrome.ts";
import { labUrl } from "./shot.ts";
import { fileArg, rootFor } from "./paths.ts";

const args = process.argv.slice(2);
const arg = (n: string) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : undefined; };
const world = arg("world") ? fileArg(arg("world")!) : join(PKG, "test/fixtures/house.world.js");
const root = rootFor([world], arg("root"));
const out = fileArg(arg("out") ?? "shots");
const worldUrl = "/" + relative(root, world);
mkdirSync(out, { recursive: true });
const save = (name: string, dataUrl: string) => { writeFileSync(join(out, name), Buffer.from(dataUrl.split(",")[1], "base64")); return name; };

const server = serve({ root });
const chrome = await startChrome();
const report: any = {};
try {
  const tab = await openTab(chrome.cdp, { w: 1280, h: 800 });
  const url = (o: any, extra = "") => labUrl(server.port, worldUrl, o) + extra;

  // 1. the turn
  await tab.load(url({ rot: 0, zoom: 1 }));
  report.turn = await tab.evaluate(`(() => {
    const w = __lab.world; w.advance(0);
    const r = __lab.strip(6, (i) => {
      if (i === 0) w.camera.rotate(1); else w.advance(380 / 5);
      const pose = w.camera.pose(), s = w.camera.state, f = w.project([...s.focus.slice(0, 1), 0, s.focus[1]]);
      return { frame: i, cameraY: pose.position[1], azDeg: +(s.az * 180 / Math.PI).toFixed(2), ppm: s.ppm, focusScreen: [+f.x.toFixed(3), +f.y.toFixed(3)], turning: s.turning };
    }, { scale: 0.42, caption: (i, r) => "az " + r.azDeg.toFixed(1) + "°  y " + r.cameraY.toFixed(9) });
    return { png: r.png, log: r.log };
  })()`);
  save("turn-strip.png", report.turn.png);
  delete report.turn.png;

  // 2. panning: two consecutive frames of a drag of (7.37, 3.11) CSS px, per configuration
  report.pan = {};
  // the old office's settings: no snap, three's screen-space dither, shadow radius 4 (scene.js:22)
  const configs = [["engine", ""], ["engine, shadow radius 4", "&shadowRadius=4"], ["no pixel snap", "&noSnap=1"],
    ["screen-space shadow dither, radius 4", "&screenNoise=1&shadowRadius=4"], ["old: no snap + screen dither + radius 4", "&noSnap=1&screenNoise=1&shadowRadius=4"]] as const;
  for (const [name, flags] of configs) {
    await tab.load(url({ rot: 0, zoom: 2, focusOn: "5,5" }, flags));
    report.pan[name] = await tab.evaluate(`(() => { __lab.world.advance(0); __lab.panDiff(7.37, 3.11); return __lab.panDiff(7.37, 3.11); })()`);
  }

  // 3. the wall modes, and per-room focus
  await tab.load(url({ rot: 0, zoom: 1 }));
  const walls = await tab.evaluate(`(() => {
    const w = __lab.world; w.advance(0);
    const modes = [["up"], ["cutaway"], ["down"], ["cutaway", "lounge"]];
    const r = __lab.strip(4, (i) => { w.setWalls(modes[i][0], modes[i][1] ?? null); const s = w.inspect(); return { walls: s.walls, focus: s.focusRoom, cut: s.cut.length }; },
      { scale: 0.42, caption: (i, r) => r.walls + (r.focus ? " (focus " + r.focus + ")" : "") + "  cut " + r.cut });
    return r;
  })()`);
  save("walls-strip.png", walls.png);
  report.walls = walls.log;

  // 4. a character walks to the chair and sits down
  await tab.load(url({ rot: 0, zoom: 2, focusOn: "6.5,5.5" }));
  const walk = await tab.evaluate(`(() => {
    const w = __lab.world; w.advance(0);
    const times = [0, 1200, 2400, 3600, 4800, 7000];
    let t = 0;
    const r = __lab.strip(6, (i) => { w.advance(times[i] - t); t = times[i]; const c = w.character("ada"); return { t: times[i] / 1000, clip: c.clip, step: c.step, x: +c.x.toFixed(2), z: +c.z.toFixed(2), hips: +c.hips.toFixed(2) }; },
      { scale: 0.42, caption: (i, r) => r.t.toFixed(1) + " s  " + r.clip + "  (" + r.x + ", " + r.z + ")" });
    return r;
  })()`);
  save("walk-sit-strip.png", walk.png);
  report.walk = walk.log;

  // 5. night, everyone seated
  await tab.load(url({ rot: 0, zoom: 1, theme: "dark", time: "21:30" }));
  await tab.evaluate("__lab.world.advance(7000)");
  writeFileSync(join(out, "night.jpg"), await tab.screenshot("jpeg"));

  // the day view, full size, for reference
  await tab.load(url({ rot: 0, zoom: 1 }));
  await tab.evaluate("__lab.world.advance(7000)");
  writeFileSync(join(out, "day.jpg"), await tab.screenshot("jpeg"));
  report.errors = tab.errors;
} finally {
  await chrome.close();
  server.stop(true);
}
writeFileSync(join(out, "proof.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
