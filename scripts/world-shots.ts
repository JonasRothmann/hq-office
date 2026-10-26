#!/usr/bin/env bun
// Screenshots of the world lab in headless Chrome, for judging the 3D office's looks: docs/design/shots/*.png|jpg.
//
//   bun scripts/world-shots.ts [--only=SUBSTRING] [--out=DIR]
//
// Each shot is the lab at 1440x900 with a query (look, theme, lanes, rot, zoom, focus). A PNG over ~400 KB is saved
// as a JPEG at quality 85 instead. WebGL runs on SwiftShader, so it works without a GPU (and slowly under load).
import { mkdtempSync, rmSync, readFileSync, mkdirSync, writeFileSync, existsSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { findChrome, Cdp, newSession, freePort } from "./room-hash.ts";
import { serveLab } from "./world-lab.ts";

const ROOT = resolve(import.meta.dir, "..");
const MAX_BYTES = 400 * 1024;

export const SHOTS: [string, string][] = [
  ["a-light-4", "look=a&theme=light&lanes=4"],
  ["a-dark-4", "look=a&theme=dark&lanes=4"],
  ["b-light-4", "look=b&theme=light&lanes=4"],
  ["b-dark-4", "look=b&theme=dark&lanes=4"],
  ["b-light-1", "look=b&theme=light&lanes=1"],
  ["b-light-9", "look=b&theme=light&lanes=9"],
  ["b-light-18", "look=b&theme=light&lanes=18"],
  ["b-light-close", "look=b&theme=light&lanes=3&statuses=moving,needs_you,waiting&zoom=2&focus=0,1"],
  ["a-light-close", "look=a&theme=light&lanes=3&statuses=moving,needs_you,waiting&zoom=2&focus=0,1"],
];

// Chrome with WebGL on SwiftShader (room-hash's startChrome takes no extra flags).
async function startChrome() {
  const bin = findChrome();
  if (!bin) throw new Error("no Chrome found; set CHROME_BIN");
  const profile = mkdtempSync(join(tmpdir(), "hq-world-chrome-"));
  const proc = Bun.spawn([bin, "--headless=new", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "--no-first-run", "--no-default-browser-check", "--mute-audio", "--hide-scrollbars", "--force-device-scale-factor=1", "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "about:blank"], { stdout: "ignore", stderr: "ignore" });
  let port = "";
  for (let i = 0; i < 300 && !port; i++) {
    try { port = readFileSync(join(profile, "DevToolsActivePort"), "utf8").split("\n")[0]; } catch {}
    if (!port) await Bun.sleep(100);
  }
  if (!port) throw new Error("Chrome did not start");
  const version = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
  const cdp = await Cdp.open(version.webSocketDebuggerUrl);
  return { cdp, close: async () => { cdp.ws.close(); proc.kill(); await proc.exited; rmSync(profile, { recursive: true, force: true }); } };
}

if (import.meta.main) {
  const only = process.argv.find((a) => a.startsWith("--only="))?.slice(7);
  const out = resolve(ROOT, process.argv.find((a) => a.startsWith("--out="))?.slice(6) ?? "docs/design/shots");
  mkdirSync(out, { recursive: true });
  const server = serveLab(freePort());
  const chrome = await startChrome();
  const errors: string[] = [];
  try {
    const { s, evaluate } = await newSession(chrome.cdp, errors);
    await s("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    for (const [name, query] of SHOTS) {
      if (only && !name.includes(only)) continue;
      const t0 = Date.now();
      errors.length = 0;
      await s("Page.navigate", { url: "about:blank" });
      await s("Page.navigate", { url: `http://127.0.0.1:${server.port}/docs/design/world-lab.html?${query}` });
      let ready = false;
      for (let i = 0; i < 1200 && !ready; i++) {
        ready = await evaluate("!!window.__worldReady").catch(() => false);
        if (!ready) await Bun.sleep(100);
      }
      if (!ready) { console.error(`${name}: not ready after 120 s`, errors.slice(0, 5)); continue; }
      await Bun.sleep(Number(process.env.SHOT_SETTLE ?? 1500));
      const png = Buffer.from((await s("Page.captureScreenshot", { format: "png" })).data, "base64");
      for (const ext of ["png", "jpg"]) { const f = join(out, `${name}.${ext}`); if (existsSync(f)) unlinkSync(f); }
      let file = join(out, `${name}.png`), bytes: Buffer = png;
      if (png.length > MAX_BYTES) {
        bytes = Buffer.from((await s("Page.captureScreenshot", { format: "jpeg", quality: 85 })).data, "base64");
        file = join(out, `${name}.jpg`);
      }
      writeFileSync(file, bytes);
      const info = await evaluate("(() => { const r = world.renderer.info.render; return `${r.calls} draw calls, ${Math.round(r.triangles / 1000)}k triangles`; })()").catch(() => "");
      console.log(`${name}: ${file.slice(ROOT.length + 1)} ${(bytes.length / 1024).toFixed(0)} KB in ${((Date.now() - t0) / 1000).toFixed(1)} s; ${info}${errors.length ? `; errors: ${errors.slice(0, 3).join(" | ")}` : ""}`);
    }
  } finally {
    await chrome.close();
    server.stop(true);
  }
}
