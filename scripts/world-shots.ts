#!/usr/bin/env bun
// Screenshots of the world lab in headless Chrome, for judging the 3D office's looks: docs/design/shots/*.png|jpg.
//
//   bun scripts/world-shots.ts [--only=SUBSTRING] [--out=DIR]
//
// Each shot is the lab at 1440x900 with a query (theme, lanes, rot, zoom, focus). A PNG over ~400 KB is saved as a
// JPEG at quality 85 instead. WebGL runs on SwiftShader, so it works without a GPU (and slowly under load).
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

if (import.meta.main) {
  const only = process.argv.find((a) => a.startsWith("--only="))?.slice(7);
  const out = resolve(ROOT, process.argv.find((a) => a.startsWith("--out="))?.slice(6) ?? (only?.startsWith("outside") ? "docs/design/outside" : "docs/design/shots"));
  mkdirSync(out, { recursive: true });
  const server = serveLab(freePort());
  const chrome = await startChrome({ webgl: true });
  const errors: string[] = [];
  try {
    const { s, evaluate } = await newSession(chrome.cdp, errors);
    await s("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    for (const [name, query] of SHOTS) {
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
      for (const ext of ["png", "jpg"]) { const f = join(out, `${name}.${ext}`); if (existsSync(f)) unlinkSync(f); }
      let file = join(out, `${name}.png`), bytes: Buffer = png;
      if (png.length > MAX_BYTES || name.startsWith("outside-")) {
        bytes = Buffer.from((await s("Page.captureScreenshot", { format: "jpeg", quality: 85 })).data, "base64");
        file = join(out, `${name}.jpg`);
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
