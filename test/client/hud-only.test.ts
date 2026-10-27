// The HUD runs without the 3D office: /?world=off never requests three.js or anything under world/, the question
// cards render and can be answered (a short one on its card, a long one in the reader), and there are no page errors. A page loaded without the flag in a Chrome with no
// WebGL does the same, so work on the panels never pays for the world. Needs Chrome (CHROME_BIN); skipped without it.
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
// Every resource the page asked for that belongs to the 3D office. The page always loads the world's entry (index.js,
// the small switch that decides whether the world starts) and its stylesheet; everything else is the world itself.
const WORLD_ENTRY = /^\/src\/client\/world\/(index\.js|world\.css)$/.source;
const WORLD_RESOURCES = `performance.getEntriesByType("resource").map((r) => new URL(r.name).pathname).filter((p) => p.startsWith("/src/client/vendor/three/") || (p.startsWith("/src/client/world/") && !new RegExp(${JSON.stringify(WORLD_ENTRY)}).test(p)))`;
// Every resource the page asked for that is a page module, so an empty list cannot mean nothing was measured.
const PAGE_RESOURCES = `performance.getEntriesByType("resource").filter((r) => r.name.includes("/src/client/inbox/")).length`;

beforeAll(async () => {
  if (!chromeFound) return;
  chrome = await startChrome();
  server = await startServer(ROOT);
  await seed(server.post); // lanes, and two open asks (bravo, charlie)
  page = await newSession(chrome.cdp, errors);
  await page.s("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await page.s("Page.navigate", { url: `${server.base}/?world=off` });
  await until(`document.querySelectorAll(".ask").length === 2`);
}, 30_000);

afterAll(async () => {
  await server?.stop();
  await chrome?.close();
});

test.skipIf(!chromeFound)("?world=off: no resource of the world or of three.js is requested", async () => {
  expect(await page.evaluate(`document.documentElement.dataset.world`)).toBe("off");
  expect(await page.evaluate(PAGE_RESOURCES)).toBeGreaterThan(0);
  expect(await page.evaluate(WORLD_RESOURCES)).toEqual([]);
});

test.skipIf(!chromeFound)("?world=off: the question cards render and an answer goes to the server", async () => {
  expect(await page.evaluate(`document.querySelectorAll(".ask").length`)).toBe(2);
  // "Ship the thing?" has a code block, so it is answered in the reader
  const card = `[...document.querySelectorAll("#hud .ask")].find((a) => a.textContent.includes("Ship the thing?"))`;
  expect(await page.evaluate(`${card}.classList.contains("short")`)).toBe(false);
  await page.evaluate(`${card}.click()`);
  await until(`!document.getElementById("reader").hidden && !!document.querySelector('#reader .askview .opt[data-opt="Yes"]')`);
  await page.evaluate(`document.querySelector('#reader .askview .opt[data-opt="Yes"]').click()`);
  await until(`document.querySelector("#reader .askview .opt.sel")?.dataset.opt === "Yes"`);
  await page.evaluate(`document.querySelector("#reader .askview [data-send]").click()`);
  await until(`document.querySelectorAll("#hud .ask").length === 1`);
  expect((await state()).answered.find((a: any) => a.title === "Ship the thing?")?.answer).toBe("Yes");
  // the reader moves on to the next question: the short one, which the stack answers on its card too
  await until(`document.querySelector("#reader .askview")?.dataset.lane === "charlie"`);
  await page.evaluate(`document.querySelector('#hud .ask.short[data-lane="charlie"] [data-quick]').click()`);
  await until(`document.querySelectorAll("#hud .ask").length === 0`);
  expect((await state()).answered.find((a: any) => a.title === "Approve the deploy")?.answer).toBe("done");
  expect(await page.evaluate(`document.getElementById("reader").hidden`)).toBe(true);
  expect(await page.evaluate(WORLD_RESOURCES)).toEqual([]);
  expect(errors).toEqual([]);
});

test.skipIf(!chromeFound)("without the flag and without WebGL, three.js is still not fetched", async () => {
  await page.s("Page.navigate", { url: `${server.base}/` });
  await until(`document.querySelectorAll("#hud .item").length > 0 && window.__world?.unavailable === true`);
  expect(await page.evaluate(`document.documentElement.dataset.world`)).toBe("off");
  expect(await page.evaluate(PAGE_RESOURCES)).toBeGreaterThan(0);
  expect(await page.evaluate(WORLD_RESOURCES)).toEqual([]);
  expect(errors).toEqual([]);
});
