// The page works end to end in a real browser at 1440x900, against a temporary server: it loads with no console
// errors and no page scroll, the world's canvas behind it, an answer and a note reach the server, the tabs, the worker card, settings and sound
// respond. Needs Chrome (CHROME_BIN to point at one); skipped without it.
import { afterAll, beforeAll, expect, test } from "bun:test";
import { join } from "node:path";
import { findChrome, newSession, seed, startChrome, startServer } from "../../scripts/room-hash.ts";

const ROOT = join(import.meta.dir, "..", "..");
const chromeFound = !!findChrome();
let chrome: Awaited<ReturnType<typeof startChrome>>;
let server: Awaited<ReturnType<typeof startServer>>;
let page: Awaited<ReturnType<typeof newSession>>;
const errors: string[] = [];
const until = async (expr: string, ms = 8000) => {
  for (const end = Date.now() + ms; Date.now() < end; await Bun.sleep(50)) if (await page.evaluate(expr).catch(() => false)) return true;
  throw new Error(`timed out waiting for ${expr}`);
};
const state = async () => (await fetch(`${server.base}/api/state`)).json();

beforeAll(async () => {
  if (!chromeFound) return;
  chrome = await startChrome();
  server = await startServer(ROOT);
  await seed(server.post);
  page = await newSession(chrome.cdp, errors);
  await page.s("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await page.s("Page.navigate", { url: `${server.base}/` });
  await until(`!!document.querySelector(".ask")`);
}, 30_000);

afterAll(async () => {
  await server?.stop();
  await chrome?.close();
});

test.skipIf(!chromeFound)("loads with no errors and no page scroll, the world's canvas behind the panels", async () => {
  expect(await page.evaluate(`document.documentElement.scrollHeight <= innerHeight && document.documentElement.scrollWidth <= innerWidth`)).toBe(true);
  // The 3D world's canvas is the body's first child and fills the window.
  expect(await page.evaluate(`(() => { const w = document.getElementById("world"), r = w.getBoundingClientRect(); return [document.body.firstElementChild === w, r.width === innerWidth && r.height === innerHeight]; })()`)).toEqual([true, true]);
  // The pixel room is gone. This Chrome has no WebGL, so the office stays undrawn and says so, with no error.
  expect(await page.evaluate(`[!!document.getElementById("room"), !!document.querySelector(".stage > .room"), window.__world.unavailable]`)).toEqual([false, false, true]);
  expect(await page.evaluate(`document.querySelector("#sWait .count").textContent`)).toBe("2");
  expect(errors).toEqual([]);
});

test.skipIf(!chromeFound)("an answer goes to the server", async () => {
  await page.evaluate(`[...document.querySelectorAll(".ask")].find((a) => a.textContent.includes("Ship the thing?")).querySelector('.opt[data-opt="Yes"]').click()`);
  await until(`[...document.querySelectorAll(".ask")].find((a) => a.textContent.includes("Ship the thing?"))?.querySelector(".opt.sel")?.dataset.opt === "Yes"`);
  await page.evaluate(`[...document.querySelectorAll(".ask")].find((a) => a.textContent.includes("Ship the thing?")).querySelector(".send").click()`);
  await until(`document.querySelectorAll(".ask").length === 1`);
  const s = await state();
  expect(s.answered.find((a: any) => a.title === "Ship the thing?")?.answer).toBe("Yes");
});

test.skipIf(!chromeFound)("Tell HQ sends a note", async () => {
  await page.evaluate(`document.getElementById("noteText").value = "From the page test"; document.getElementById("compose").requestSubmit()`);
  await until(`document.getElementById("lastNote").textContent.includes("From the page test")`);
  expect((await state()).notes[0].text).toBe("From the page test");
});

test.skipIf(!chromeFound)("tabs, worker card, settings and sound respond", async () => {
  await page.evaluate(`document.querySelector('[data-qtab="messages"]').click()`);
  expect(await page.evaluate(`!document.getElementById("msgs").hidden && document.getElementById("hud").hidden && document.getElementById("msgs").textContent.includes("Halfway there")`)).toBe(true);
  await page.evaluate(`document.querySelector('[data-qtab="questions"]').click()`);
  expect(await page.evaluate(`!document.getElementById("hud").hidden`)).toBe(true);
  await page.evaluate(`document.querySelector('[data-select="charlie"]').click()`);
  expect(await page.evaluate(`document.querySelector("#card h3").textContent`)).toBe("charlie");
  await page.evaluate(`document.querySelector('#feed [data-tab="log"]').click()`);
  expect(await page.evaluate(`document.querySelector("#feed .log").textContent.includes("Ship the thing?")`)).toBe(true);
  await page.evaluate(`document.getElementById("settingsBtn").click()`);
  expect(await page.evaluate(`!document.getElementById("settings").hidden`)).toBe(true);
  // Only what still does something: PERFORMANCE and LEVEL NAMES (the pixel room's hero, season, hat and theme are gone).
  expect(await page.evaluate(`[...new Set([...document.querySelectorAll("#settings [data-set]")].map((b) => b.dataset.set))]`)).toEqual(["performance"]);
  expect(await page.evaluate(`!!document.querySelector("#settings [data-levels]")`)).toBe(true);
  await page.evaluate(`document.querySelector('[data-set="performance"][data-val="saver"]').click()`);
  expect(await page.evaluate(`JSON.parse(localStorage.getItem("hq-settings")).performance`)).toBe("saver");
  await page.evaluate(`document.querySelector("[data-reset]").click(); document.querySelector("[data-close]").click()`);
  expect(await page.evaluate(`document.getElementById("settings").hidden`)).toBe(true);
  const before = await page.evaluate(`document.getElementById("alerts").textContent`);
  await page.evaluate(`document.getElementById("alerts").click()`);
  expect(await page.evaluate(`document.getElementById("alerts").textContent`)).not.toBe(before);
  expect(errors).toEqual([]);
});
