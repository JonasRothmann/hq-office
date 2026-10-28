// The page for a lane blocked on a prompt in herdr: a BLOCKED count in the top bar (only while there is one), its
// worker standing at its desk with a raised hand under the red badge, the card with the excerpt and where to answer
// it, and the WORK board with the blocked item on top. Needs Chrome with WebGL (SwiftShader); skipped without it.
import { afterAll, beforeAll, expect, test } from "bun:test";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { findChrome, newSession, startChrome, startServer } from "../../scripts/room-hash.ts";

const ROOT = join(import.meta.dir, "..", "..");
const chromeFound = !!findChrome();
const dir = mkdtempSync(join(tmpdir(), "hq-blocked-page-"));
const herdr = join(dir, "herdr");
// golf works; alpha waits at a Claude permission prompt.
writeFileSync(join(dir, "pane.txt"), `│ Bash command
│   rm -rf build
│   Remove the build folder
│ Do you want to proceed?
│ ❯ 1. Yes
│   2. No, and tell Claude what to do differently (esc)
`);
writeFileSync(herdr, `#!/bin/sh
case "$*" in
  *"agent list"*) echo '{"result":{"agents":[{"name":"golf","agent_status":"working","pane_id":"p1","agent":"claude"},{"name":"alpha","agent_status":"blocked","pane_id":"w3:p2","agent":"claude"}]}}' ;;
  *"pane read w3:p2"*) cat "${dir}/pane.txt" ;;
esac
exit 0
`);
chmodSync(herdr, 0o755);

let chrome: Awaited<ReturnType<typeof startChrome>>;
let server: Awaited<ReturnType<typeof startServer>>;
let page: Awaited<ReturnType<typeof newSession>>;
const errors: string[] = [];
const until = async (expr: string, ms = 60_000) => {
  for (const end = Date.now() + ms; Date.now() < end; await Bun.sleep(50)) if (await page.evaluate(expr).catch(() => false)) return true;
  throw new Error(`timed out waiting for ${expr}`);
};
// What alpha's worker does: its pose (the clip it loops), whether it is off to the break area, and its badge.
const PROBE = `(() => { const w = __world.worker("alpha"); return { pose: w.pose, out: w.out, marker: w.marker }; })()`;

beforeAll(async () => {
  if (!chromeFound) return;
  chrome = await startChrome({ webgl: true });
  server = await startServer(ROOT, { HERDR_BIN: herdr });
  for (const name of ["golf", "alpha"]) await server.post("/api/lanes", { name, machine: "local" });
  await server.post("/api/board/track", { issue: "ABC-7", lane: "alpha" });
  await server.post("/api/board/track", { issue: "ABC-8", lane: "golf" });
  await server.post("/api/sync", {});
  page = await newSession(chrome.cdp, errors);
  await page.s("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await page.s("Page.navigate", { url: `${server.base}/` });
  await until(`window.__world?.desks?.length === 2`);
}, 120_000);

afterAll(async () => {
  await server?.stop();
  await chrome?.close();
  rmSync(dir, { recursive: true, force: true });
});

test.skipIf(!chromeFound)("a blocked lane: BLOCKED in the top bar, a raised hand under the red badge at its desk, the prompt on its card, first on WORK", async () => {
  // The top bar.
  await until(`!!document.querySelector("#sBlocked:not([hidden])")`);
  expect(await page.evaluate(`document.querySelector("#sBlocked .k").textContent + " " + document.querySelector("#sBlocked .v").textContent`)).toBe("BLOCKED 1");
  // The office: beside its desk, hand raised, under the red badge.
  await until(`(${PROBE}).pose === "wave"`);
  expect(await page.evaluate(PROBE)).toEqual({ pose: "wave", out: false, marker: { color: "#e5484d", glyph: "!" } });
  // The card: clicking the count selects the lane, and its card shows what it asks and where.
  await page.evaluate(`document.querySelector("#sBlocked").click()`);
  await until(`!!document.querySelector("#card .prompt")`);
  const card = await page.evaluate(`document.querySelector("#card").innerText`);
  expect(card).toContain("BLOCKED ON A PROMPT");
  expect(card).toContain("ANSWER IT IN HERDR ON LOCAL, PANE w3:p2");
  expect(card).toContain("Remove the build folder · Do you want to proceed?\n1. Yes\n2. No, and tell Claude what to do differently (esc)");
  // The work board (its pill): the blocked item first, the excerpt as its why.
  await page.evaluate(`document.getElementById("pWork").click()`);
  await until(`!!document.querySelector("#work .wi")`);
  const first = await page.evaluate(`(() => { const a = document.querySelector("#work .wi"); return { cls: a.className, key: a.querySelector(".key").textContent, what: a.querySelector(".what").textContent }; })()`);
  expect(first).toEqual({ cls: "wi blocked", key: "ABC-7", what: "Remove the build folder · Do you want to proceed? / 1. Yes / 2. No, and tell Claude what to do differently (esc)" });
  expect(await page.evaluate(`document.querySelector("#work h4").textContent`)).toBe("BLOCKED ON A PROMPT (1)");
  expect(errors).toEqual([]);
}, 120_000);
