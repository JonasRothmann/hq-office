#!/usr/bin/env bun
// Screenshots of the real page with OFFICE set to new (the office on the @hq/world engine, D18), for a person to look
// at: a server on a spare port with a throwaway data dir and a fake herdr (some lanes working, some idle), seeded with
// lanes, vitals, a lane tree past eight lanes, and questions (one blocking, with a long body), in headless Chrome with
// WebGL on SwiftShader. The stack shows the questions and the reader is open on the blocking one. Saves
// docs/screens/office-view-<theme>-<lanes>.jpg at 1440x900, light and dark, with 4 and 12 lanes, and prints each
// shot's draw calls, triangles and shadow redraws.
//
//   bun scripts/office-view-shots.ts [--only=SUBSTRING]
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
const LONG = "The export writes one file per table today. Before the next release it should stream rows instead, so a large "
  + "table never sits in memory. Two ways to get there: keep the current format and add a cursor, or switch the export "
  + "to a database file that other tools can open directly.\n\n- Postgres: the team knows it, and the cursor is small.\n"
  + "- SQLite: one file, no server, and the tests get simpler.";

async function shoot(n: number, only?: string) {
  const themes = ["light", "dark"].filter((t) => !only || `office-view-${t}-${n}`.includes(only));
  if (!themes.length) return;
  const names = NAMES.slice(0, n);
  const dir = mkdtempSync(join(tmpdir(), "hq-office-view-shots-"));
  const herdr = join(dir, "herdr");
  const agents = [{ name: "hq", agent_status: "idle", pane_id: "p0", agent: "claude" }, ...names.map((name, i) => ({ name, agent_status: PLAN[i][0] === "w" ? "working" : "idle", pane_id: `p${i + 1}`, agent: "claude" }))];
  writeFileSync(herdr, `#!/bin/sh\ncase "$*" in\n  *"agent list"*) echo '${JSON.stringify({ result: { agents } })}' ;;\n  *) exit 0 ;;\nesac\n`);
  chmodSync(herdr, 0o755);
  const server = await startServer(ROOT, { HERDR_BIN: herdr });
  const chrome = await startChrome({ webgl: true });
  const errors: string[] = [];
  try {
    const { post } = server;
    await post("/api/settings", { settings: { office: "new" } });
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
    const until = async (expr: string, ms = 900_000) => {
      for (const end = Date.now() + ms; Date.now() < end; await Bun.sleep(200)) if (await evaluate(expr).catch(() => false)) return;
      throw new Error(`timed out waiting for ${expr}; page errors: ${errors.join(" | ")}; now: ${await evaluate("JSON.stringify(window.__world?.inspect?.())").catch((e) => e.message)}`);
    };
    await s("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    for (const theme of themes) {
      const name = `office-view-${theme}-${n}`;
      await s("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: theme }] });
      await s("Page.navigate", { url: "about:blank" });
      await s("Page.navigate", { url: `${server.base}/` });
      await until(`window.__world?.inspect?.().renderer === "new" && __world.desks.length === ${n} && document.querySelectorAll("#hud .ask").length >= 2`);
      await until(`document.fonts.status === "loaded"`, 5000).catch(() => {});
      // the reader open on the blocking question
      const where = JSON.parse(await evaluate(`(() => { const b = document.querySelector("#hud .ask.blocking"); if (!b) return "null"; const r = b.getBoundingClientRect(); return JSON.stringify({ x: r.x + Math.min(r.width / 2, 120), y: r.y + 14 }); })()`));
      if (!where) throw new Error(`no #hud .ask.blocking card; page errors: ${errors.join(" | ")}`);
      await s("Input.dispatchMouseEvent", { type: "mouseMoved", x: where.x, y: where.y });
      await s("Input.dispatchMouseEvent", { type: "mousePressed", x: where.x, y: where.y, button: "left", clickCount: 1 });
      await s("Input.dispatchMouseEvent", { type: "mouseReleased", x: where.x, y: where.y, button: "left", clickCount: 1 });
      await until(`!document.querySelector("#reader").hidden`, 30_000);
      await s("Input.dispatchMouseEvent", { type: "mouseMoved", x: 1430, y: 890 });
      // the workers reach their places, the chips settle
      await until(`__world.inspect().frames > 12 && !__world.inspect().turning`);
      await Bun.sleep(4000);
      const { data } = await s("Page.captureScreenshot", { format: "jpeg", quality: 84 });
      const file = join(OUT, `${name}.jpg`);
      writeFileSync(file, Buffer.from(data, "base64"));
      const info = await evaluate("(() => { const i = __world.inspect(); return { stage: i.stage, frames: i.frames, draws: i.engine.draws, triangles: i.engine.triangles, shadows: i.engine.stats.shadowRedraws, zoom: i.engine.zoom }; })()");
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
