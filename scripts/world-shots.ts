#!/usr/bin/env bun
// Screenshots of the world lab in headless Chrome, for judging the 3D office's looks: docs/design/shots/*.png|jpg.
//
//   bun scripts/world-shots.ts [--only=SUBSTRING] [--out=DIR]
//
// Each shot is the lab at 1440x900 with a query (theme, lanes, rot, zoom, focus). A PNG over ~400 KB is saved as a
// JPEG at quality 85 instead. The showroom shots (`--only=showroom`: the lab's ?scene=showroom, UI off) and the
// outside shots (`--only=outside-`, into docs/design/outside) are always JPEGs of at most 400 KB. WebGL runs on
// SwiftShader, so it works without a GPU (and slowly under load).
import { mkdirSync, writeFileSync, existsSync, unlinkSync } from "node:fs";
import { join, resolve } from "node:path";
import { newSession, freePort, startChrome } from "./room-hash.ts";
import { serveLab } from "./world-lab.ts";

const ROOT = resolve(import.meta.dir, "..");
const MAX_BYTES = 400 * 1024;

export const SHOTS: [string, string][] = [
  ["light-4", "theme=light&lanes=4"],
  ["dark-4", "theme=dark&lanes=4"],
  ["light-1", "theme=light&lanes=1"],
  ["light-9", "theme=light&lanes=9"],
  ["light-18", "theme=light&lanes=18"],
  ["dark-18", "theme=dark&lanes=18"],
  ["light-close", "theme=light&lanes=3&statuses=moving,needs_you,waiting&zoom=2&focus=0,1"],
  ["light-poses", "theme=light&lanes=3&statuses=hq_turn,done,stale&zoom=2&focus=0,1"],
  ["light-4-rot1", "theme=light&lanes=4&rot=1"],
  // the land around the office (src/client/world/outside/): --only=outside- writes them to docs/design/outside/
  ["outside-nature-light-far", "scene=outside&mode=nature&seed=7&lot=24x14&theme=light&zoom=0"],
  ["outside-nature-light-mid", "scene=outside&mode=nature&seed=7&lot=24x14&theme=light&zoom=1&focus=22,14"],
  ["outside-nature-dark-far", "scene=outside&mode=nature&seed=7&lot=24x14&theme=dark&zoom=0"],
  ["outside-nature-light-big", "scene=outside&mode=nature&seed=3&lot=60x40&theme=light"],
  // the town, Copenhagen-ish (docs/design/outside/copenhagen.md): seed 1 puts the canal north of the lot, its houses facing the camera
  ["outside-city-light-far", "scene=outside&mode=city&seed=1&lot=24x14&theme=light&zoom=0"],
  ["outside-city-light-mid", "scene=outside&mode=city&seed=1&lot=24x14&theme=light&zoom=1&focus=0,-40"],
  ["outside-city-light-near", "scene=outside&mode=city&seed=1&lot=24x14&theme=light&zoom=2&focus=6,-46"],
  ["outside-city-light-street", "scene=outside&mode=city&seed=1&lot=24x14&theme=light&zoom=2&focus=24,6"],
  ["outside-city-dark-far", "scene=outside&mode=city&seed=1&lot=24x14&theme=dark&zoom=0"],
  ["outside-city-dark-mid", "scene=outside&mode=city&seed=1&lot=24x14&theme=dark&zoom=1&focus=0,-40"],
  ["outside-city-dark-near", "scene=outside&mode=city&seed=1&lot=24x14&theme=dark&zoom=2&focus=6,-46"],
  ["outside-city-light-big", "scene=outside&mode=city&seed=3&lot=60x40&theme=light"],
  ["outside-city-light-rot1", "scene=outside&mode=city&seed=11&lot=24x14&theme=light&zoom=0&rot=1"],
];

// The showroom (one team room, the HQ suite, the break area, in the office's own look), always JPEG; room=N dresses
// the team room as the Nth of a floor.
export const SHOWROOM: [string, string][] = [
  ["showroom-light-mid", "scene=showroom&theme=light&ui=0&zoom=1&at=10.5,3"],
  ["showroom-dark-mid", "scene=showroom&theme=dark&ui=0&zoom=1&at=10.5,3"],
  ["showroom-light-near-team", "scene=showroom&theme=light&ui=0&zoom=2&at=3.6,2.6"],
  ["showroom-dark-near-team", "scene=showroom&theme=dark&ui=0&zoom=2&at=3.6,2.6"],
  ["showroom-light-near-hq", "scene=showroom&theme=light&ui=0&zoom=2&at=10.6,2.6"],
  ["showroom-light-near-break", "scene=showroom&theme=light&ui=0&zoom=2&at=17.6,2.6"],
  ["showroom-dark-near-break", "scene=showroom&theme=dark&ui=0&zoom=2&at=17.6,2.6"],
  ["showroom-light-far", "scene=showroom&theme=light&ui=0&zoom=0&at=10.5,2"],
  ["showroom-light-rot1", "scene=showroom&theme=light&ui=0&zoom=1&rot=1&at=10.5,2.5"],
  // closer than the near step, to judge faces and clothes
  ["showroom-light-people", "scene=showroom&theme=light&ui=0&ppm=170&at=3.4,2.4"],
  ["showroom-light-people-break", "scene=showroom&theme=light&ui=0&ppm=150&at=16.2,2.3"],
  ["showroom-light-room1", "scene=showroom&theme=light&ui=0&zoom=2&at=3.6,2.6&room=1"],
  ["showroom-light-room2", "scene=showroom&theme=light&ui=0&zoom=2&at=3.6,2.6&room=2"],
  ["showroom-light-room3", "scene=showroom&theme=light&ui=0&zoom=2&at=3.6,2.6&room=3"],
  ["showroom-light-room4", "scene=showroom&theme=light&ui=0&zoom=2&at=3.6,2.6&room=4"],
];

if (import.meta.main) {
  const only = process.argv.find((a) => a.startsWith("--only="))?.slice(7);
  const outArg = process.argv.find((a) => a.startsWith("--out="))?.slice(6);
  const out = resolve(ROOT, outArg ?? "docs/design/shots");
  const outside = resolve(ROOT, outArg ?? "docs/design/outside");
  mkdirSync(out, { recursive: true });
  mkdirSync(outside, { recursive: true });
  const server = serveLab(freePort());
  const chrome = await startChrome({ webgl: true });
  const errors: string[] = [];
  try {
    const { s, evaluate } = await newSession(chrome.cdp, errors);
    await s("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    for (const [name, query] of [...SHOTS, ...SHOWROOM]) {
      const dir = name.startsWith("outside-") ? outside : out;
      if (only && !name.includes(only)) continue;
      const t0 = Date.now();
      errors.length = 0;
      await s("Page.navigate", { url: "about:blank" });
      const page = query.includes("scene=outside") ? "docs/design/outside/lab.html" : "docs/design/world-lab.html";
      await s("Page.navigate", { url: `http://127.0.0.1:${server.port}/${page}?${query}` });
      let ready = false;
      for (let i = 0; i < 1200 && !ready; i++) {
        if (errors.some((e) => /Error/.test(e))) break; // a module or script error: the page will never be ready
        ready = await evaluate("!!window.__worldReady").catch(() => false);
        if (!ready) await Bun.sleep(100);
      }
      if (!ready) { console.error(`${name}: not ready`, errors.slice(0, 5)); continue; }
      await Bun.sleep(Number(process.env.SHOT_SETTLE ?? 1500));
      const png = Buffer.from((await s("Page.captureScreenshot", { format: "png" })).data, "base64");
      for (const ext of ["png", "jpg"]) { const f = join(dir, `${name}.${ext}`); if (existsSync(f)) unlinkSync(f); }
      let file = join(dir, `${name}.png`), bytes: Buffer = png;
      if (png.length > MAX_BYTES || name.startsWith("showroom") || name.startsWith("outside-")) {
        for (const quality of [85, 78, 70, 60]) {
          bytes = Buffer.from((await s("Page.captureScreenshot", { format: "jpeg", quality })).data, "base64");
          if (bytes.length <= MAX_BYTES) break;
        }
        file = join(dir, `${name}.jpg`);
      }
      writeFileSync(file, bytes);
      const info = await evaluate("(() => { const r = window.__outsideCost ?? world.renderer.info.render; return `${window.__outsideCost ? 'outside: ' : ''}${r.calls} draw calls, ${Math.round(r.triangles / 1000)}k triangles`; })()").catch(() => "");
      console.log(`${name}: ${file.slice(ROOT.length + 1)} ${(bytes.length / 1024).toFixed(0)} KB in ${((Date.now() - t0) / 1000).toFixed(1)} s; ${info}${errors.length ? `; errors: ${errors.slice(0, 3).join(" | ")}` : ""}`);
    }
  } finally {
    await chrome.close();
    server.stop(true);
  }
}
