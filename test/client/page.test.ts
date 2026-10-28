// The page works end to end in a real browser at 1440x900, against a temporary server: it loads with no console
// errors and no page scroll, the world's canvas behind it, an answer and a note reach the server, the stack's filters,
// the reader, the pills, the worker card, settings and sound respond. Needs Chrome (CHROME_BIN to point at one); skipped without it.
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
  // picked with its number key in the reader, sent with ⌘Enter
  await page.evaluate(`[...document.querySelectorAll("#hud .ask")].find((a) => a.textContent.includes("Ship the thing?")).click()`);
  await until(`!!document.querySelector('#reader .askview .opt[data-opt="Yes"]')`);
  const key = (k: string, extra = "") => page.evaluate(`document.body.dispatchEvent(new KeyboardEvent("keydown", { key: ${JSON.stringify(k)}, bubbles: true${extra} }))`);
  await key("1");
  await until(`document.querySelector("#reader .askview .opt.sel")?.dataset.opt === "Yes"`);
  await key("Enter", ", metaKey: true");
  await until(`document.querySelectorAll("#hud .ask").length === 1`);
  const s = await state();
  expect(s.answered.find((a: any) => a.title === "Ship the thing?")?.answer).toBe("Yes");
});

test.skipIf(!chromeFound)("Tell HQ sends a note", async () => {
  await page.evaluate(`document.getElementById("noteText").value = "From the page test"; document.getElementById("compose").requestSubmit()`);
  await until(`document.getElementById("lastNote").textContent.includes("From the page test")`);
  expect((await state()).notes[0].text).toBe("From the page test");
});

test.skipIf(!chromeFound)("the filters, the reader, the pills, the worker card, settings and sound respond", async () => {
  // Rooms: none yet. All: the update read earlier stays listed. Needs you again: the open question and the unread update.
  await page.evaluate(`document.querySelector('[data-filter="rooms"]').click()`);
  expect(await page.evaluate(`document.querySelectorAll("#hud .item").length === 0 && document.getElementById("hud").textContent.includes("No rooms yet")`)).toBe(true);
  await page.evaluate(`document.querySelector('[data-filter="needs"]').click()`);
  expect(await page.evaluate(`[...document.querySelectorAll("#hud .item")].map((i) => i.dataset.key.split(":")[0])`)).toEqual(["ask", "update"]);
  // an update opens in the reader and is marked read
  await page.evaluate(`document.querySelector("#hud .upd").click()`);
  await until(`!document.getElementById("reader").hidden && document.querySelector("#reader .updview").textContent.includes("The first part is merged.")`);
  // read now, it stays listed (lit) while the reader shows it
  await until(`!!document.querySelector("#hud .upd.on") && !document.querySelector("#hud .upd.unread")`);
  expect((await state()).updates[0].read_at).toBeTruthy();
  await page.evaluate(`document.querySelector('[data-filter="all"]').click()`);
  expect(await page.evaluate(`!!document.querySelector("#hud .upd.on")`)).toBe(true);
  // a lane's name selects its worker
  await page.evaluate(`document.querySelector('#reader .updview [data-select="golf"]').click()`);
  expect(await page.evaluate(`document.querySelector("#card h3").textContent`)).toBe("golf");
  // the pills: Tell HQ (its log has the answer), the work board, and a second click closes the reader
  await page.evaluate(`document.getElementById("pTell").click()`);
  expect(await page.evaluate(`!document.getElementById("tellView").hidden && document.getElementById("log").textContent.includes("Ship the thing?")`)).toBe(true);
  await page.evaluate(`document.getElementById("pWork").click()`);
  expect(await page.evaluate(`!document.getElementById("workView").hidden && document.getElementById("tellView").hidden`)).toBe(true);
  await page.evaluate(`document.getElementById("pWork").click()`);
  expect(await page.evaluate(`document.getElementById("reader").hidden`)).toBe(true);
  await page.evaluate(`document.querySelector('[data-filter="needs"]').click()`);
  await page.evaluate(`document.getElementById("settingsBtn").click()`);
  expect(await page.evaluate(`!document.getElementById("settings").hidden`)).toBe(true);
  // Only what still does something: PERFORMANCE, OUTSIDE and LEVEL NAMES (the pixel room's hero, season, hat and theme
  // are gone, and so is OFFICE: the engine is the only office).
  expect(await page.evaluate(`[...new Set([...document.querySelectorAll("#settings [data-set]")].map((b) => b.dataset.set))]`)).toEqual(["performance", "outside"]);
  // REROLL grows another land: a new seed, kept with the settings
  await page.evaluate(`document.querySelector("#settings [data-reroll]").click()`);
  expect(await page.evaluate(`typeof JSON.parse(localStorage.getItem("hq-settings")).outsideSeed`)).toBe("string");
  expect(await page.evaluate(`!!document.querySelector("#settings [data-levels]")`)).toBe(true);
  await page.evaluate(`document.querySelector('[data-set="performance"][data-val="saver"]').click()`);
  expect(await page.evaluate(`JSON.parse(localStorage.getItem("hq-settings")).performance`)).toBe("saver");
  await page.evaluate(`document.querySelector("[data-reset]").click(); document.querySelector("#settings [data-close]").click()`);
  expect(await page.evaluate(`document.getElementById("settings").hidden`)).toBe(true);
  const before = await page.evaluate(`document.getElementById("alerts").textContent`);
  await page.evaluate(`document.getElementById("alerts").click()`);
  expect(await page.evaluate(`document.getElementById("alerts").textContent`)).not.toBe(before);
  expect(errors).toEqual([]);
});
