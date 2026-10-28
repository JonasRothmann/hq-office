// The PERFORMANCE setting in a real browser with WebGL, on the frozen clock: in an idle office (nobody walks, nothing
// changes) POWER SAVER draws no frames at all, BALANCED 15 a second, SMOOTH 30; a choice in the SETTINGS panel
// switches the office at once, without a reload, and reaches the server. Needs Chrome; skipped without it.
import { afterAll, beforeAll, expect, test } from "bun:test";
import { join } from "node:path";
import { FREEZE, findChrome, newSession, startChrome, startServer } from "../../scripts/room-hash.ts";

const ROOT = join(import.meta.dir, "..", "..");
const chromeFound = !!findChrome();
const DAY = Date.UTC(2026, 3, 20, 14, 0);
const STEP = 1000 / 30 + 0.1; // a little over a 30 fps frame, so every step is due at SMOOTH
let chrome: Awaited<ReturnType<typeof startChrome>>;
let server: Awaited<ReturnType<typeof startServer>>;
let page: Awaited<ReturnType<typeof newSession>>;
const errors: string[] = [];
const serverSettings = async () => (await (await fetch(`${server.base}/api/settings`)).json()).settings;
// Frames the office drew over the next second of page time.
const framesOverASecond = async () => {
  const a = await page.evaluate("__world.inspect().frames");
  await page.evaluate(`__hq.advance(30, ${STEP})`);
  return (await page.evaluate("__world.inspect().frames")) - a;
};
const choose = async (mode: string) => {
  await page.evaluate(`(() => { const p = document.getElementById("settings"); if (p.hidden) document.getElementById("settingsBtn").click(); document.querySelector('[data-set="performance"][data-val="${mode}"]').click(); })()`);
  for (let i = 0; i < 100 && (await serverSettings()).performance !== mode; i++) await Bun.sleep(50);
  expect((await serverSettings()).performance).toBe(mode);
  await page.evaluate(`__hq.advance(2, ${STEP})`); // the frame the change wakes
};

beforeAll(async () => {
  if (!chromeFound) return;
  chrome = await startChrome({ webgl: true });
  server = await startServer(ROOT);
  // Everyone waits at a desk: nobody walks to the break area.
  for (const name of ["alpha", "bravo", "charlie", "golf"]) await server.post("/api/lanes", { name, phase: "waiting", title: name, machine: "local" });
  await server.post("/api/settings", { settings: { performance: "saver" } });
  page = await newSession(chrome.cdp, errors);
  await page.s("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await page.s("Network.setBlockedURLs", { urls: ["*fonts.googleapis.com*", "*fonts.gstatic.com*"] });
  await page.s("Page.addScriptToEvaluateOnNewDocument", { source: FREEZE });
  await page.s("Page.navigate", { url: `${server.base}/#t=${DAY}` });
  for (let i = 0; i < 600 && !(await page.evaluate("!!window.__hq && __hq.ready() && window.__world?.desks?.length === 4").catch(() => false)); i++) await Bun.sleep(100);
  await page.evaluate("document.fonts.ready.then(() => true)");
  await page.evaluate(`__hq.advance(20, ${STEP})`); // the first frames: state, the camera settling
  // the workers walk in to their chairs: the office is idle once every one sits typing
  for (let i = 0; i < 40 && !(await page.evaluate(`__world.desks.every((l) => __world.worker(l)?.step === "loop") && !__world.inspect().turning`)); i++) await page.evaluate(`__hq.advance(30, ${STEP})`);
  await page.evaluate(`__hq.advance(10, ${STEP})`);
}, 600_000);

afterAll(async () => {
  await server?.stop();
  await chrome?.close();
});

test.skipIf(!chromeFound)("POWER SAVER draws no frames in an idle office", async () => {
  expect(await page.evaluate("__world.inspect().mode")).toBe("saver");
  expect(await framesOverASecond()).toBe(0);
}, 120_000);

test.skipIf(!chromeFound)("the choice switches the office at once and is saved on the server", async () => {
  await choose("balanced");
  expect(await framesOverASecond()).toBe(15);
  await choose("smooth");
  expect(await framesOverASecond()).toBe(30);
  await choose("saver");
  expect(await framesOverASecond()).toBe(0);
  expect(errors).toEqual([]);
}, 120_000);
