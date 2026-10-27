// The office for a lane with a question open: a working lane keeps working at its desk (seated, typing); a blocking
// question adds the red badge over its head and it still works (spec B6, F7); an idle lane with a question stands
// beside its desk with its hand raised under the red badge. Needs Chrome with WebGL (SwiftShader); skipped without it.
import { afterAll, beforeAll, expect, test } from "bun:test";
import { join } from "node:path";
import { findChrome, newSession, startChrome, startServer } from "../../scripts/room-hash.ts";

const ROOT = join(import.meta.dir, "..", "..");
const chromeFound = !!findChrome();
let chrome: Awaited<ReturnType<typeof startChrome>>;
let server: Awaited<ReturnType<typeof startServer>>;
let page: Awaited<ReturnType<typeof newSession>>;
const errors: string[] = [];
const until = async (expr: string, ms = 60_000) => {
  for (const end = Date.now() + ms; Date.now() < end; await Bun.sleep(100)) if (await page.evaluate(expr).catch(() => false)) return true;
  throw new Error(`timed out waiting for ${expr}`);
};
// What each worker does: its pose and the badge over its head.
const PROBE = `Object.fromEntries(["golf", "alpha"].map((n) => { const w = __world.worker(n); return [n, { pose: w.pose, marker: w.marker }]; }))`;
const RED = { color: "#e5484d", glyph: "!" };

beforeAll(async () => {
  if (!chromeFound) return;
  chrome = await startChrome({ webgl: true });
  // The stub herdr reports golf working and alpha idle.
  server = await startServer(ROOT);
  for (const name of ["golf", "alpha"]) await server.post("/api/lanes", { name, machine: "local" });
  await server.post("/api/sync", {});
  page = await newSession(chrome.cdp, errors);
  await page.s("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await page.s("Page.navigate", { url: `${server.base}/` });
  await until(`window.__world?.offices?.length === 2 && __world.worker("golf")?.pose === "work"`);
}, 120_000);

afterAll(async () => {
  await server?.stop();
  await chrome?.close();
});

test.skipIf(!chromeFound)("a working lane with a question works on; a blocking one adds the red badge; an idle one raises its hand", async () => {
  expect(await page.evaluate(PROBE)).toEqual({ golf: { pose: "work", marker: null }, alpha: { pose: "fold", marker: { color: "#f5a524", glyph: "hq" } } });
  // a non-blocking question: golf goes on working, unmarked; alpha has nothing to do but wait on the owner
  await server.post("/api/asks", { lane: "golf", title: "Go live?" });
  await server.post("/api/asks", { lane: "alpha", title: "Which one?" });
  await until(`(${PROBE}).alpha.pose === "raise"`);
  expect(await page.evaluate(PROBE)).toEqual({ golf: { pose: "work", marker: null }, alpha: { pose: "raise", marker: RED } });
  // a blocking question: golf still works, under the red badge
  await server.post("/api/asks", { lane: "golf", title: "Drop the table?", tier: "blocking" });
  await until(`!!(${PROBE}).golf.marker`);
  expect(await page.evaluate(PROBE)).toEqual({ golf: { pose: "work", marker: RED }, alpha: { pose: "raise", marker: RED } });
  // The top bar counts every question.
  expect(await page.evaluate(`document.querySelector("#sWait .count").textContent`)).toBe("3");
  expect(errors).toEqual([]);
}, 120_000);
