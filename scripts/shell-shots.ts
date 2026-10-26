#!/usr/bin/env bun
// Screenshots of the glass shell for a person to look at: a seeded server on a spare port with a throwaway data dir,
// headless Chrome, at 1440x900 (light and dark), 1280x800, with the worker card, with settings open, in a conference
// room, and on a 390x844 phone. Until the 3D world draws, a soft gradient stands in behind the glass (in the shots
// only) so the blur reads. Saves JPEGs to docs/screens/glass-*.jpg.
//
//   bun scripts/shell-shots.ts
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { newSession, seed, startChrome, startServer } from "./room-hash.ts";

const ROOT = resolve(import.meta.dir, "..");
const OUT = join(ROOT, "docs", "screens");

// A stand-in for the world: coloured light and a few soft shapes, so frosted glass has something to frost.
const STAND_IN = `(() => {
  const s = document.createElement("style");
  s.textContent = \`
    body { background:
      radial-gradient(40vw 40vh at 72% 30%, rgba(255, 170, 110, .85), transparent 70%),
      radial-gradient(35vw 45vh at 40% 75%, rgba(90, 160, 255, .8), transparent 70%),
      radial-gradient(30vw 30vh at 90% 85%, rgba(120, 220, 160, .8), transparent 70%),
      radial-gradient(25vw 30vh at 15% 20%, rgba(240, 120, 200, .7), transparent 70%),
      radial-gradient(22vw 28vh at 8% 72%, rgba(250, 210, 90, .8), transparent 70%),
      linear-gradient(160deg, #f4efe6, #e3e9f3) !important; background-attachment: fixed !important; }
    :root[data-theme="dark"] body { background:
      radial-gradient(40vw 40vh at 72% 30%, rgba(255, 140, 60, .45), transparent 70%),
      radial-gradient(35vw 45vh at 40% 75%, rgba(60, 110, 255, .5), transparent 70%),
      radial-gradient(30vw 30vh at 90% 85%, rgba(40, 180, 120, .45), transparent 70%),
      radial-gradient(25vw 30vh at 15% 20%, rgba(200, 80, 180, .4), transparent 70%),
      radial-gradient(22vw 28vh at 8% 72%, rgba(230, 180, 60, .4), transparent 70%),
      linear-gradient(160deg, #101218, #1a1c24) !important; background-attachment: fixed !important; }\`;
  document.head.append(s);
})()`;

async function main() {
  mkdirSync(OUT, { recursive: true });
  const chrome = await startChrome();
  const server = await startServer(ROOT, { HUD_GITHUB_REPO: "example/repo" });
  const errors: string[] = [];
  try {
    await seed(server.post);
    const { post } = server;
    await post("/api/asks", { lane: "golf", kind: "decision", tier: "blocking", priority: "high", title: "Which database for the export?", body: "The lane cannot go on with the export until this is decided.", options: ["Postgres", "SQLite"], recommended: "Postgres" });
    await post("/api/asks", { lane: "alpha", kind: "info", priority: "low", title: "FYI: the nightly run moved to 03:00" });
    await post("/api/updates", { lane: "alpha", title: "PR is up", body: "Review when you can." });
    await post("/api/rooms", { slug: "ope-7", title: "Search relevance", owner: "alpha", members: ["golf"], issues: ["OPE-7"] });
    await post("/api/rooms/ope-7/brief", { body: "## Plan\n- [x] baseline\n- [ ] rerank\n\nThe reranker lifts recall by 4 points on the eval set." });
    for (let i = 1; i <= 6; i++) await post("/api/rooms/ope-7/say", { text: `Finding ${i}: the reranker moves item ${i} up.` });
    const page = await newSession(chrome.cdp, errors);
    const { s, evaluate } = page;
    const until = async (expr: string, ms = 15000) => {
      for (const end = Date.now() + ms; Date.now() < end; await Bun.sleep(80)) if (await evaluate(expr).catch(() => false)) return;
      throw new Error(`timed out waiting for ${expr}`);
    };
    const size = (width: number, height: number, mobile = false) => Promise.all([
      s("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: mobile ? 2 : 1, mobile }),
      s("Emulation.setTouchEmulationEnabled", { enabled: mobile, maxTouchPoints: 5 }),
    ]);
    const scheme = (dark: boolean) => s("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: dark ? "dark" : "light" }] });
    const open = async (hash = "") => {
      await s("Page.navigate", { url: "about:blank" });
      await s("Page.navigate", { url: `${server.base}/${hash}` });
      await until(`document.querySelectorAll(".ask").length >= 4 && document.fonts.status === "loaded"`);
      await evaluate(STAND_IN);
      await Bun.sleep(400);
    };
    const shot = async (name: string) => {
      const { data } = await s("Page.captureScreenshot", { format: "jpeg", quality: 82 });
      const file = join(OUT, `glass-${name}.jpg`);
      writeFileSync(file, Buffer.from(data, "base64"));
      console.log(file);
    };

    for (const dark of [false, true]) {
      const t = dark ? "dark" : "light";
      await scheme(dark);
      await size(1440, 900);
      await open();
      await shot(`1440-${t}`);
      await evaluate(`document.querySelector('.ask [data-select="bravo"]').click()`);
      await Bun.sleep(900);
      await shot(`1440-${t}-card`);
      await evaluate(`document.getElementById("settingsBtn").click()`);
      await Bun.sleep(300);
      await shot(`1440-${t}-settings`);
      await size(1280, 800);
      await open();
      await shot(`1280-${t}`);
      await size(1440, 900);
      await open("#room/ope-7");
      await until(`!document.getElementById("roomView").hidden && document.querySelectorAll("#roomView [data-rmsg]").length > 0`);
      await Bun.sleep(300);
      await shot(`1440-${t}-room`);
      await size(390, 844, true);
      await open();
      await shot(`phone-${t}`);
    }
    if (errors.length) console.error("page errors:\n" + errors.join("\n"));
  } finally {
    await server.stop();
    await chrome.close();
  }
}

await main();
