#!/usr/bin/env bun
// Screenshots of the real page with the office on the @hq/world engine, for a person to look at: a server on a spare
// port with a throwaway data dir and a fake herdr (some lanes working, some idle), seeded with lanes, vitals, a lane
// tree past eight lanes and questions (one blocking, with a long body; one not), in headless Chrome with WebGL on
// SwiftShader. Saves docs/screens/office-<name>.jpg at 1440x900 unless the name says otherwise: wide (reader closed,
// the whole office), city (the land round it is a town), near (one team room close: a worker waiting on the owner, one
// at work, one waiting on CI, the lamps on in the dark), near-dark-hover (the pointer over a worker), reader (the
// reader open on the blocking question), reader-dark-1280 (the same at 1280x800) and reader-light-4 (4 lanes). Each in
// light and dark. Prints each shot's draw calls, triangles, zoom stop and the scale of the small things.
//
//   bun scripts/office-shots.ts [--only=SUBSTRING]
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { newSession, startChrome, startServer } from "./room-hash.ts";

const ROOT = resolve(import.meta.dir, "..");
const OUT = join(ROOT, "docs", "screens");
const NAMES = ["atlas", "birch", "cedar", "dune", "ember", "fjord", "grove", "harbor", "iris", "juniper", "kelp", "linden"];
// What each lane is doing: w = working in herdr, i = idle, plus the lane's phase. With the asks below, the first team
// room holds atlas (working), birch (waits on the owner), cedar (works while a question blocks) and dune (waits on CI).
const PLAN: [string, string][] = [["w", "running"], ["i", "running"], ["w", "running"], ["i", "waiting"], ["i", "done"], ["w", "running"], ["i", "parked"], ["w", "running"], ["i", "done"], ["i", "running"], ["w", "running"], ["i", "waiting"]];
const MODELS = ["claude-opus-5-5", "claude-sonnet-5", "claude-haiku-4-5"];
const LONG = "The export writes one file per table today. Before the next release it should stream rows instead, so a large "
  + "table never sits in memory. Two ways to get there: keep the current format and add a cursor, or switch the export "
  + "to a database file that other tools can open directly.\n\n- Postgres: the team knows it, and the cursor is small.\n"
  + "- SQLite: one file, no server, and the tests get simpler.";

const NEAR = 10;
type View ="wide" | "near" | "hover" | "reader";
type Shot = { name: string; n: number; theme: "light" | "dark"; outside: "nature" | "city"; view: View; w: number; h: number };
const shot = (name: string, theme: "light" | "dark", view: View, o: Partial<Shot> = {}): Shot => ({ name, n: 12, theme, outside: "nature", view, w: 1440, h: 900, ...o });
const SHOTS: Shot[] = [
  shot("wide-light", "light", "wide"),
  shot("wide-dark", "dark", "wide"),
  shot("city-light", "light", "wide", { outside: "city" }),
  shot("city-dark", "dark", "wide", { outside: "city" }),
  shot("near-light", "light", "near"),
  shot("near-dark", "dark", "near"),
  shot("near-dark-hover", "dark", "hover"),
  shot("reader-light", "light", "reader"),
  shot("reader-dark", "dark", "reader"),
  shot("reader-dark-1280", "dark", "reader", { w: 1280, h: 800 }),
  shot("reader-light-4", "light", "reader", { n: 4 }),
];

async function shoot(n: number, only?: string) {
  const shots = SHOTS.filter((x) => x.n === n && (!only || `office-${x.name}`.includes(only)));
  if (!shots.length) return;
  const names = NAMES.slice(0, n);
  const dir = mkdtempSync(join(tmpdir(), "hq-office-shots-"));
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
    await post("/api/asks", { lane: names[2], kind: "decision", tier: "blocking", priority: "high", title: "Which database for the export?", body: LONG, options: ["Postgres", "SQLite"] });
    await post("/api/sync", {});
    const { s, evaluate } = await newSession(chrome.cdp, errors);
    const step = (m: string) => { if (process.env.SHOTS_DEBUG) console.error(new Date().toISOString().slice(11, 19), m); };
    const until = async (expr: string, ms = 900_000) => {
      step(`waiting for ${expr.slice(0, 70)}`);
      for (const end = Date.now() + ms; Date.now() < end; await Bun.sleep(200)) if (await evaluate(expr).catch(() => false)) return;
      throw new Error(`timed out waiting for ${expr}; page errors: ${errors.join(" | ")}; now: ${await evaluate("JSON.stringify(window.__world?.inspect?.())").catch((e) => e.message)}`);
    };
    const mouse = (type: string, x: number, y: number, extra = {}) => s("Input.dispatchMouseEvent", { type, x, y, button: "left", pointerType: "mouse", ...extra });
    const click = async (x: number, y: number) => { await mouse("mouseMoved", x, y); await mouse("mousePressed", x, y, { clickCount: 1 }); await mouse("mouseReleased", x, y, { clickCount: 1 }); };
    // drag the office so a point on the canvas comes to (cx, cy)
    const drag = async (x: number, y: number, cx: number, cy: number) => {
      await mouse("mousePressed", x, y, { buttons: 1, clickCount: 1 });
      for (let k = 1; k <= 8; k++) await mouse("mouseMoved", x + ((cx - x) * k) / 8, y + ((cy - y) * k) / 8, { buttons: 1 });
      await mouse("mouseReleased", cx, cy, { clickCount: 1 });
    };
    const worker = async (lane: string) => JSON.parse(await evaluate(`JSON.stringify(__world.worker(${JSON.stringify(lane)}))`));
    for (const x of shots) {
      const file = join(OUT, `office-${x.name}.jpg`);
      await post("/api/settings", { settings: { outside: x.outside } });
      await s("Emulation.setDeviceMetricsOverride", { width: x.w, height: x.h, deviceScaleFactor: 1, mobile: false });
      await s("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: x.theme }] });
      await s("Page.navigate", { url: "about:blank" });
      await s("Page.navigate", { url: `${server.base}/` });
      await until(`__world.desks?.length === ${n} && document.querySelectorAll("#hud .ask").length >= 2`);
      await until(`document.fonts.status === "loaded"`, 5000).catch(() => {});
      await until(`(() => { const o = __world.inspect().outside; return o && o.mode === ${JSON.stringify(x.outside)} && !o.fading; })()`);
      await until(`__world.inspect().frames > 0`);
      await until(`__world.inspect().frames > 12 && !__world.inspect().turning`);
      if (x.view === "reader") {
        // the reader open on the blocking question
        const where = JSON.parse(await evaluate(`(() => { const b = document.querySelector("#hud .ask.blocking"); if (!b) return "null"; const r = b.getBoundingClientRect(); return JSON.stringify({ x: r.x + Math.min(r.width / 2, 120), y: r.y + 14 }); })()`));
        if (!where) throw new Error(`no #hud .ask.blocking card; page errors: ${errors.join(" | ")}`);
        await click(where.x, where.y);
        await until(`!document.querySelector("#reader").hidden`, 30_000);
        await mouse("mouseMoved", x.w - 10, x.h - 10);
        await until(`__world.inspect().frames > 12 && !__world.inspect().turning`);
        await Bun.sleep(4000);
      } else if (x.view === "wide") {
        await Bun.sleep(4000);
      } else {
        // the first lane's team room in the middle of the office area, close up
        await Bun.sleep(1500);
        const cx = 1000, cy = 470;
        step("near: drag");
        let w = await worker(names[0]);
        await drag(w.x, w.y, cx, cy);
        step("near: zoom");
        // one wheel notch (100) is one stop of the zoom ladder; the near stop is 10 (90 px/m)
        for (let k = 0; k < 30 && JSON.parse(await evaluate("__world.inspect().engine.zoom")) < NEAR; k++) { await mouse("mouseWheel", cx, cy, { deltaX: 0, deltaY: -100 }); await Bun.sleep(1000); }
        await Bun.sleep(1500);
        w = await worker(names[0]);
        await drag(w.x, w.y + 40, cx, cy);
        await Bun.sleep(1000);
        // the pointer on the waiting worker for the hover shot, off the canvas otherwise
        if (x.view === "hover") {
          const h = await worker(names[1]);
          await mouse("mouseMoved", h.x - 20, h.y + 20);
          await mouse("mouseMoved", h.x, h.y);
          await until(`__world.inspect().hovered === ${JSON.stringify(names[1])}`, 30_000);
        } else await mouse("mouseMoved", x.w - 10, x.h - 10);
        await Bun.sleep(3000);
      }
      step("capture");
      const { data } = await s("Page.captureScreenshot", { format: "jpeg", quality: 84 });
      writeFileSync(file, Buffer.from(data, "base64"));
      const info = await evaluate(`(() => { const i = __world.inspect(); const w = ${JSON.stringify(names.slice(0, 4))}.map((l) => { const k = __world.worker(l); return k && { lane: l, pose: k.pose, marker: k.marker && k.marker.glyph, light: !!k.light, visible: k.visible }; }); return { calls: i.calls, triangles: i.triangles, zoom: i.engine.zoom, scale: i.scale, balls: i.balls, hovered: i.hovered, lit: i.rooms.map((r) => +r.lit).join(""), cursor: document.getElementById("world").style.cursor, workers: w }; })()`);
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
