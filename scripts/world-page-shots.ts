#!/usr/bin/env bun
// Screenshots of the real page with the 3D office, for a person to look at: a server on a spare port with a throwaway
// data dir and a fake herdr (some lanes working, some idle), seeded with lanes, questions (one blocking a working
// lane), vitals and a lane tree, in headless Chrome with WebGL on SwiftShader. Saves docs/screens/world-*.jpg at
// 1440x900: light and dark, with 4 and 12 lanes, in a valley (nature) and in a town (city), and a near view of one
// team room. Prints each shot's draw calls and triangles (the last frame, shadow pass included).
//
//   bun scripts/world-page-shots.ts [--only=SUBSTRING]
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { newSession, startChrome, startServer } from "./room-hash.ts";

const ROOT = resolve(import.meta.dir, "..");
const OUT = join(ROOT, "docs", "screens");
const NAMES = ["atlas", "birch", "cedar", "dune", "ember", "fjord", "grove", "harbor", "iris", "juniper", "kelp", "linden"];
// What each lane is doing: w = working in herdr, i = idle, plus the lane's phase.
const PLAN: [string, string][] = [["w", "running"], ["i", "running"], ["w", "running"], ["i", "waiting"], ["i", "done"], ["w", "running"], ["i", "parked"], ["w", "running"], ["i", "done"], ["i", "running"], ["w", "running"], ["i", "waiting"]];
const MODELS = ["claude-opus-5-5", "claude-sonnet-5", "claude-haiku-4-5"];
// [name suffix, theme, outside, near view]
const SHOTS: [string, string, string, boolean][] = [
  ["light", "light", "nature", false],
  ["dark", "dark", "nature", false],
  ["light-city", "light", "city", false],
  ["dark-city", "dark", "city", false],
  ["light-near", "light", "nature", true],
  ["dark-near", "dark", "nature", true],
];

async function shoot(n: number, only?: string) {
  const shots = SHOTS.filter(([suffix]) => !only || `world-${suffix}-${n}`.includes(only));
  if (!shots.length) return;
  const names = NAMES.slice(0, n);
  const dir = mkdtempSync(join(tmpdir(), "hq-world-shots-"));
  const herdr = join(dir, "herdr");
  const agents = [{ name: "hq", agent_status: "idle", pane_id: "p0", agent: "claude" }, ...names.map((name, i) => ({ name, agent_status: PLAN[i][0] === "w" ? "working" : "idle", pane_id: `p${i + 1}`, agent: "claude" }))];
  writeFileSync(herdr, `#!/bin/sh\ncase "$*" in\n  *"agent list"*) echo '${JSON.stringify({ result: { agents } })}' ;;\n  *) exit 0 ;;\nesac\n`);
  chmodSync(herdr, 0o755);
  const server = await startServer(ROOT, { HERDR_BIN: herdr });
  const chrome = await startChrome({ webgl: true });
  const errors: string[] = [];
  try {
    const { post } = server;
    for (const [i, name] of names.entries()) {
      // past eight lanes, a small tree: every fourth lane leads the three after it
      const parent = n > 8 && i % 4 ? names[i - (i % 4)] : undefined;
      await post("/api/lanes", { name, phase: PLAN[i][1], title: `Lane ${name}`, machine: "local", ...(parent ? { parent } : {}) });
      await post(`/api/lanes/${name}/vitals`, { model: MODELS[i % 3], effort: ["high", "medium", "xhigh"][i % 3], subagents: PLAN[i][0] === "w" ? [2, 3, 1, 4][i % 4] : 0, contextUsed: 60_000 + i * 37_000, contextMax: 1_000_000 });
    }
    await post("/api/asks", { lane: names[1], kind: "decision", title: "Ship the migration tonight?", options: ["Yes", "Wait"], recommended: "Yes" });
    await post("/api/asks", { lane: names[2], kind: "decision", tier: "blocking", priority: "high", title: "Which database for the export?", options: ["Postgres", "SQLite"] });
    await post("/api/sync", {});
    const { s, evaluate } = await newSession(chrome.cdp, errors);
    const until = async (expr: string, ms = 300_000) => {
      for (const end = Date.now() + ms; Date.now() < end; await Bun.sleep(150)) if (await evaluate(expr).catch(() => false)) return;
      throw new Error(`timed out waiting for ${expr}; page errors: ${errors.join(" | ")}; now: ${await evaluate("JSON.stringify({ desks: window.__world?.desks, asks: document.querySelectorAll(\".ask\").length, fonts: document.fonts.status, url: location.href })").catch((e) => e.message)}`);
    };
    const mouse = (type: string, x: number, y: number, extra = {}) => s("Input.dispatchMouseEvent", { type, x, y, button: "left", pointerType: "mouse", ...extra });
    // drag the office so a point on the canvas comes to (cx, cy)
    const drag = async (x: number, y: number, cx: number, cy: number) => {
      await mouse("mousePressed", x, y, { buttons: 1, clickCount: 1 });
      for (let k = 1; k <= 8; k++) await mouse("mouseMoved", x + ((cx - x) * k) / 8, y + ((cy - y) * k) / 8, { buttons: 1 });
      await mouse("mouseReleased", cx, cy, { clickCount: 1 });
    };
    await s("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    for (const [suffix, theme, outside, near] of shots) {
      const name = `world-${suffix}-${n}`;
      await post("/api/settings", { settings: { outside } });
      await s("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: theme }] });
      await s("Page.navigate", { url: "about:blank" });
      await s("Page.navigate", { url: `${server.base}/` });
      await until(`window.__world?.desks?.length === ${n} && document.querySelectorAll(".ask").length >= 2`);
      // the page's fonts (a font the canvas asked for and this machine lacks can keep the status at "loading")
      await until(`document.fonts.status === "loaded"`, 5000).catch(() => {});
      await until(`(() => { const o = __world.inspect().outside; return o && o.mode === ${JSON.stringify(outside)} && !o.fading; })()`);
      // a few seconds for the camera to settle and the frames to come
      await until(`window.__world.inspect().frames > 20`);
      await Bun.sleep(1500);
      if (near) {
        // the first lane's team room in the middle of the office area, close up
        const cx = 1000, cy = 470;
        const at = async () => JSON.parse(await evaluate(`JSON.stringify(__world.worker(${JSON.stringify(names[0])}))`));
        let w = await at();
        await drag(w.x, w.y, cx, cy);
        for (let k = 0; k < 4; k++) { await mouse("mouseWheel", cx, cy, { deltaX: 0, deltaY: -300 }); await Bun.sleep(120); }
        await Bun.sleep(900);
        w = await at();
        await drag(w.x, w.y + 40, cx, cy);
        await mouse("mouseMoved", 1430, 890);
        await Bun.sleep(1800);
      }
      const { data } = await s("Page.captureScreenshot", { format: "jpeg", quality: 84 });
      const file = join(OUT, `${name}.jpg`);
      writeFileSync(file, Buffer.from(data, "base64"));
      const info = await evaluate("(() => { const i = __world.inspect(); return { stage: i.stage, frames: i.frames, calls: i.calls, triangles: i.triangles, outside: i.outside && { mode: i.outside.mode, meshes: i.outside.meshes } }; })()");
      console.log(`${file.slice(ROOT.length + 1)}: ${JSON.stringify(info)}`);
    }
    if (errors.length) console.error("page errors:\n" + errors.join("\n"));
  } finally {
    await chrome.close();
    await server.stop();
    rmSync(dir, { recursive: true, force: true });
  }
}

if (import.meta.main) {
  mkdirSync(OUT, { recursive: true });
  const only = process.argv.find((a) => a.startsWith("--only="))?.slice(7);
  for (const n of [4, 12]) await shoot(n, only);
}
