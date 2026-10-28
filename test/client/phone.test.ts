// The page on a phone, in Chrome at 390x664 with touch, against a temporary server: no zoom (the viewport forbids
// it, every text field is 16px or more); the stack is a sheet under the world's strip and the page scrolls, not the
// list; a live update keeps the place of what you read; a card opens the reader as a full-screen sheet with its answer
// box pinned at the foot, the page under it still and the office resting; a long update scrolls inside the reader;
// closing it puts you back where you were. Needs Chrome; skipped without it.
import { afterAll, beforeAll, expect, test } from "bun:test";
import { join } from "node:path";
import { findChrome, newSession, startChrome, startServer } from "../../scripts/room-hash.ts";

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
const settle = () => Bun.sleep(300);
const topOf = (sel: string) => page.evaluate(`document.querySelector('${sel}').getBoundingClientRect().top`);
const LONG = Array.from({ length: 60 }, (_, i) => `Line ${i + 1} of a long report from the lane.`).join("\n");

beforeAll(async () => {
  if (!chromeFound) return;
  chrome = await startChrome();
  server = await startServer(ROOT);
  await server.post("/api/asks", { lane: "alpha", kind: "action", title: "One question" });
  for (let i = 1; i <= 24; i++) await server.post("/api/updates", { lane: "alpha", title: `Update ${i}`, body: i === 24 ? LONG : "Two lines of news.\nThe second line." });
  page = await newSession(chrome.cdp, errors);
  await page.s("Emulation.setDeviceMetricsOverride", { width: 390, height: 664, deviceScaleFactor: 3, mobile: true });
  await page.s("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
  await page.s("Page.navigate", { url: `${server.base}/?world=off` });
  await until(`!!document.querySelector("#hud .ask")`);
}, 30_000);

afterAll(async () => {
  await server?.stop();
  await chrome?.close();
});

test.skipIf(!chromeFound)("no zoom: the viewport forbids it, and no text field is under 16px", async () => {
  const meta = await page.evaluate(`document.querySelector('meta[name="viewport"]').content`);
  expect(meta).toContain("maximum-scale=1");
  expect(meta).toContain("user-scalable=no");
  expect(await page.evaluate(`getComputedStyle(document.documentElement).touchAction`)).toBe("pan-x pan-y");
  const sizes: number[] = await page.evaluate(`[...document.querySelectorAll("textarea, input, select")].map((e) => parseFloat(getComputedStyle(e).fontSize))`);
  expect(sizes.length).toBeGreaterThan(1);
  expect(Math.min(...sizes)).toBeGreaterThanOrEqual(16);
});

test.skipIf(!chromeFound)("the stack is a sheet under the world's strip: the page scrolls, not the list", async () => {
  const s = await page.evaluate(`(() => { const d = document.querySelector(".desk").getBoundingClientRect(), w = document.getElementById("world").getBoundingClientRect(), l = getComputedStyle(document.getElementById("hud"));
    return { underStrip: d.top >= w.bottom - 40, full: Math.round(d.width) === 390 - 20, listScrolls: l.overflowY !== "visible", pageScrolls: document.scrollingElement.scrollHeight > innerHeight * 2 }; })()`);
  expect(s).toEqual({ underStrip: true, full: true, listScrolls: false, pageScrolls: true });
  // every update is listed (all unread), under the question
  expect(await page.evaluate(`document.querySelectorAll("#hud .upd").length`)).toBe(24);
});

test.skipIf(!chromeFound)("a live update keeps the place of what you read", async () => {
  await page.evaluate(`document.querySelector('#hud [data-upd="12"]').scrollIntoView({ block: "start" })`);
  await settle();
  const before = await topOf('#hud [data-upd="12"]');
  await server.post("/api/updates", { lane: "alpha", title: "Arrives while reading" });
  await until(`document.getElementById("hud").textContent.includes("Arrives while reading")`);
  await settle();
  expect(Math.abs((await topOf('#hud [data-upd="12"]')) - before)).toBeLessThan(1);
});

test.skipIf(!chromeFound)("a card opens the reader full screen, its box pinned at the foot, the page still under it", async () => {
  const before = await topOf('#hud [data-upd="12"]');
  await page.evaluate(`document.querySelector('#hud [data-upd="24"]').click()`);
  await until(`!document.getElementById("reader").hidden && !!document.querySelector("#reader .updview .rcomp textarea")`);
  await settle();
  const r = await page.evaluate(`(() => { const r = document.getElementById("reader").getBoundingClientRect(), f = document.querySelector("#reader .updview .rv-foot").getBoundingClientRect(), b = document.querySelector("#reader .updview .rv-body");
    return { sheet: [r.left, r.top, r.width, r.height], footAtFoot: Math.round(f.bottom) === 664, bodyScrolls: getComputedStyle(b).overflowY === "auto" && b.scrollHeight > b.clientHeight,
      pageStill: getComputedStyle(document.body).overflow === "hidden", resting: document.documentElement.classList.contains("roomopen"), onTop: document.getElementById("reader").contains(document.elementFromPoint(195, 600)) }; })()`);
  expect(r).toEqual({ sheet: [0, 0, 390, 664], footAtFoot: true, bodyScrolls: true, pageStill: true, resting: true, onTop: true });
  // the long update scrolls inside the reader; the page does not move
  const y = await page.evaluate(`scrollY`);
  await page.evaluate(`document.querySelector("#reader .updview .rv-body").scrollTop = 1e6`);
  await settle();
  expect(await page.evaluate(`[document.querySelector("#reader .updview .rv-body").scrollTop > 0, scrollY]`)).toEqual([true, y]);
  // closed, what you read is where it was (the update read leaves Needs you) and the office wakes
  await page.evaluate(`document.querySelector("#reader .updview [data-close]").click()`);
  await until(`document.getElementById("reader").hidden && !document.querySelector('#hud [data-upd="24"]')`);
  await settle();
  expect(Math.abs((await topOf('#hud [data-upd="12"]')) - before)).toBeLessThan(1);
  expect(await page.evaluate(`document.documentElement.classList.contains("roomopen")`)).toBe(false);
  expect(errors).toEqual([]);
});
