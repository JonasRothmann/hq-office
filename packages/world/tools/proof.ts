#!/usr/bin/env bun
// The engine's proof, measured in headless Chrome on a world (default: the test house):
//   1. a 90° turn: six frames, the camera's height and the focus's screen point per frame (must not move);
//   2. panning: two consecutive frames compared after undoing the whole-pixel shift, for the engine and for the old
//      defects switched back on (no pixel snap; three's screen-space shadow dither);
//   3. the wall modes; 4. a character walking to a chair and sitting down; 5. night;
//   6. sizing: at DPR 1, 1.5 and 2, full size and a fractional box at a fractional place, the backing store against
//      the device-pixel box, and two screenshots (what the screen shows, after the browser composites the canvas)
//      compared across a pan after undoing its whole-pixel shift; the old sizing (clientWidth) for contrast;
//   7. idle: on the real clock, renders and shadow-map redraws while still, while walking, and still again.
//
//   bun packages/world/tools/proof.ts [--world path] [--root DIR] [--out DIR] [--only turn,pan,walls,walk,night,sizing,idle]
import { mkdirSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { serve, PKG } from "./serve.ts";
import { startChrome, openTab } from "./chrome.ts";
import { labUrl } from "./shot.ts";
import { fileArg, rootFor } from "./paths.ts";
import { decodePng } from "./png.ts";

const args = process.argv.slice(2);
const arg = (n: string) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : undefined; };
const world = arg("world") ? fileArg(arg("world")!) : join(PKG, "test/fixtures/house.world.js");
const root = rootFor([world], arg("root"));
const out = fileArg(arg("out") ?? "shots");
const worldUrl = "/" + relative(root, world);
const only = arg("only")?.split(",");
const want = (part: string) => !only || only.includes(part);
mkdirSync(out, { recursive: true });
const save = (name: string, dataUrl: string) => { writeFileSync(join(out, name), Buffer.from(dataUrl.split(",")[1], "base64")); return name; };

const server = serve({ root });
const chrome = await startChrome();
const report: any = {};
try {
  const tab = await openTab(chrome.cdp, { w: 1280, h: 800 });
  const url = (o: any, extra = "") => labUrl(server.port, worldUrl, o) + extra;

  // 1. the turn
  if (want("turn")) {
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
  }

  // 2. panning: two consecutive frames of a drag of (7.37, 3.11) CSS px, per configuration
  if (want("pan")) {
  report.pan = {};
  // the old office's settings: no snap, three's screen-space dither, shadow radius 4 (scene.js:22)
  const configs = [["engine", ""], ["engine, shadow radius 4", "&shadowRadius=4"], ["no pixel snap", "&noSnap=1"],
    ["screen-space shadow dither, radius 4", "&screenNoise=1&shadowRadius=4"], ["old: no snap + screen dither + radius 4", "&noSnap=1&screenNoise=1&shadowRadius=4"]] as const;
  for (const [name, flags] of configs) {
    await tab.load(url({ rot: 0, zoom: 2, focusOn: "5,5" }, flags));
    report.pan[name] = await tab.evaluate(`(() => { __lab.world.advance(0); __lab.panDiff(7.37, 3.11); return __lab.panDiff(7.37, 3.11); })()`);
  }
  }

  // 3. the wall modes, and per-room focus
  if (want("walls")) {
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
  }

  // 4. a character walks to the chair and sits down
  if (want("walk")) {
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
  }

  // 5. night, everyone seated
  if (want("night")) {
  await tab.load(url({ rot: 0, zoom: 1, theme: "dark", time: "21:30" }));
  await tab.evaluate("__lab.world.advance(7000)");
  writeFileSync(join(out, "night.jpg"), await tab.screenshot("jpeg"));

  // the day view, full size, for reference
  await tab.load(url({ rot: 0, zoom: 1 }));
  await tab.evaluate("__lab.world.advance(7000)");
  writeFileSync(join(out, "day.jpg"), await tab.screenshot("jpeg"));
  }

  // 6. sizing: what the screen shows across a pan, at each DPR, full size and a fractional box
  if (want("sizing")) {
    report.sizing = [];
    const W = 800, H = 500, box = "640.4x400.6", at = "10.3,7.7";
    const cases: [string, number, string][] = [["full", 1, ""], ["full", 1.5, ""], ["full", 2, ""], ["fractional", 1, `&box=${box}&at=${at}`], ["fractional", 1.5, `&box=${box}&at=${at}`], ["fractional", 2, `&box=${box}&at=${at}`], ["fractional, old sizing", 1.5, `&box=${box}&at=${at}&oldSizing=1`]];
    for (const [what, dpr, flags] of cases) {
      const t = await openTab(chrome.cdp, { w: W, h: H, dpr });
      await t.load(url({ rot: 0, zoom: 2, focusOn: "5,5" }, flags));
      const size = await t.evaluate(`(async () => { __lab.world.advance(0); await __lab.frames(3); __lab.world.render(); await __lab.frames(2); return __lab.sizing(); })()`);
      const a = decodePng(await t.screenshot("png"));
      const shift = await t.evaluate(`(async () => { const s = __lab.panShift(7.37, 3.11); await __lab.frames(2); return s; })()`);
      const b = decodePng(await t.screenshot("png"));
      const [ix, iy] = shift.map(Math.round);
      // compare inside the canvas, a margin in from its edges and the shift
      const [l, tp, w, h] = size.rect.map((v: number) => v * dpr);
      const m = Math.max(Math.abs(ix), Math.abs(iy)) + 6;
      let n = 0, changed = 0, sum = 0;
      for (let y = Math.ceil(tp) + m; y < Math.floor(tp + h) - m; y++) for (let x = Math.ceil(l) + m; x < Math.floor(l + w) - m; x++) {
        const ia = (y * a.w + x) * 4, ib = ((y + iy) * b.w + (x + ix)) * 4;
        let d = 0;
        for (let c = 0; c < 3; c++) d = Math.max(d, Math.abs(a.px[ia + c] - b.px[ib + c]));
        n++; sum += d; if (d > 8) changed++;
      }
      report.sizing.push({ what, dpr, css: size.rect.slice(2), buffer: size.buffer, deviceBox: size.deviceBox, exact: !!size.deviceBox && size.buffer[0] === size.deviceBox[0] && size.buffer[1] === size.deviceBox[1],
        screenshot: [a.w, a.h], shift: shift.map((v: number) => +v.toFixed(4)), wholePixels: shift.every((v: number) => Math.abs(v - Math.round(v)) < 1e-3), pixels: n, changed, changedPct: +((100 * changed) / n).toFixed(3), meanDiff: +(sum / n).toFixed(4) });
      console.log(JSON.stringify(report.sizing.at(-1)));
      await chrome.cdp.send("Target.closeTarget", { targetId: t.targetId });
    }
  }

  // 7. idle: the real clock; count what the world draws while still, while walking, and still again
  if (want("idle")) {
    await tab.load(labUrl(server.port, worldUrl, { rot: 0, zoom: 1 }).replace("manual=1&", ""));
    report.idle = await tab.evaluate(`(async () => {
      const w = __lab.world, wait = (ms) => new Promise((ok) => setTimeout(ok, ms));
      const seated = () => w.character("ada").step === "loop" && !w.sim.ecs.has("ada", "queue");
      for (let i = 0; i < 600 && !seated(); i++) await wait(200);
      await wait(500);
      const take = () => ({ ...w.inspect().stats });
      const span = async (ms, during) => { const a = take(), t0 = performance.now(); if (during) await during(); else await wait(ms); const b = take();
        return { seconds: +((performance.now() - t0) / 1000).toFixed(1), frames: b.frames - a.frames, renders: b.renders - a.renders, shadowRedraws: b.shadowRedraws - a.shadowRedraws }; };
      const still = await span(3000);
      const walk = await span(0, () => w.act("ada", { do: "sit", target: "chair-2" }));
      const after = await span(3000);
      return { still, walk, after };
    })()`);
    console.log(JSON.stringify(report.idle));
  }
  report.errors = tab.errors;
} finally {
  await chrome.close();
  server.stop(true);
}
writeFileSync(join(out, "proof.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
