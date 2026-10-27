// The reader: on a phone, a question that arrives while the full-screen reader is open shows as a banner in it, and a
// tap opens it; a reply to an update and a message to a room clear only the box they were sent from, even when the
// reader has moved on before the send landed. Needs Chrome (CHROME_BIN); skipped without it. Throwaway server, world off.
import { afterAll, beforeAll, expect, test } from "bun:test";
import { join } from "node:path";
import { findChrome, newSession, startChrome, startServer } from "../../scripts/room-hash.ts";

const ROOT = join(import.meta.dir, "..", "..");
const chromeFound = !!findChrome();
let chrome: Awaited<ReturnType<typeof startChrome>>;
let server: Awaited<ReturnType<typeof startServer>>;
let page: Awaited<ReturnType<typeof newSession>>;
const errors: string[] = [];
const until = async (expr: string, ms = 15000) => {
  for (const end = Date.now() + ms; Date.now() < end; await Bun.sleep(50)) if (await page.evaluate(expr).catch(() => false)) return true;
  throw new Error(`timed out waiting for ${expr}`);
};
const state = async () => (await fetch(`${server.base}/api/state`)).json();
const ask = async (b: object) => (await server.post("/api/asks", b)).id as number;
async function load(hash = "") {
  await page.s("Page.navigate", { url: `${server.base}/?world=off${hash}` });
  await until(`!!window.__roomsReady && !!document.querySelector("#hud .item, #hud .empty")`);
}
// Holds every POST whose path has `part` until the test calls window.__go().
const hold = (part: string) => page.evaluate(`(() => { const f = window.fetch; window.__go = null; window.fetch = (u, o) => String(u).includes(${JSON.stringify(part)}) ? new Promise((r) => { window.__go = () => r(f(u, o)); }) : f(u, o); })()`);
// Types into a textarea the way the owner does: its value, then an input event.
const type = (sel: string, text: string) => page.evaluate(`(() => { const t = document.querySelector(${JSON.stringify(sel)}); t.focus(); t.value = ${JSON.stringify(text)}; t.dispatchEvent(new Event("input", { bubbles: true })); })()`);

beforeAll(async () => {
  if (!chromeFound) return;
  chrome = await startChrome();
  server = await startServer(ROOT);
  for (const name of ["alpha", "golf", "bravo"]) await server.post("/api/lanes", { name, phase: "running", title: "x", machine: "local" });
  page = await newSession(chrome.cdp, errors);
}, 60_000);
afterAll(async () => { await server?.stop(); await chrome?.close(); });

test.skipIf(!chromeFound)("phone: a question that arrives while the reader is open shows as a banner; a tap opens it", async () => {
  await page.s("Emulation.setDeviceMetricsOverride", { width: 390, height: 664, deviceScaleFactor: 2, mobile: true });
  const A = await ask({ lane: "alpha", kind: "info", title: "First", body: "x\n```\ny\n```" });
  await load();
  await page.evaluate(`document.querySelector('#hud .ask[data-ask="${A}"]').click()`);
  await until(`document.querySelector("#reader .askview")?.dataset.ask === "${A}" && !document.getElementById("reader").hidden`);
  const B = await ask({ lane: "bravo", kind: "decision", title: "Arrived while reading", options: ["Yes", "No"] });
  await until(`(() => { const b = document.querySelector("#reader .rbanner"); if (!b || b.hidden) return false; const r = b.getBoundingClientRect(); return r.height > 0 && r.top >= 0 && r.bottom <= innerHeight && b.textContent.includes("Arrived while reading"); })()`);
  await page.evaluate(`document.querySelector("#reader .rbanner").click()`);
  await until(`document.querySelector("#reader .askview")?.dataset.ask === "${B}"`);
  expect(await page.evaluate(`document.querySelector("#reader .rbanner").hidden`)).toBe(true);
  for (const id of [A, B]) await server.post(`/api/asks/${id}/withdraw`, {});
  await page.s("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
}, 60_000);

test.skipIf(!chromeFound)("a reply to an update clears only its own box, though the reader moved on", async () => {
  const U1 = (await server.post("/api/updates", { lane: "golf", title: "First news", body: "One." })).id;
  const U2 = (await server.post("/api/updates", { lane: "golf", title: "Second news", body: "Two." })).id;
  await load();
  await page.evaluate(`document.querySelector('#hud [data-upd="${U1}"]').click()`);
  await until(`document.querySelector("#reader .updview:not([hidden])")?.dataset.upd === "${U1}"`);
  await type("#reader .updview .rcomp textarea", "about the first");
  await hold("/api/notes");
  await page.evaluate(`document.querySelector("#reader .updview [data-rsend]").click()`);
  await until(`!!window.__go`);
  await page.evaluate(`document.querySelector('#hud [data-upd="${U2}"]').click()`);
  await until(`document.querySelector("#reader .updview:not([hidden])")?.dataset.upd === "${U2}"`);
  await type("#reader .updview .rcomp textarea", "about the second");
  await page.evaluate(`window.__go()`);
  await until(`(async () => (await (await fetch("/api/state")).json()).notes.some((n) => n.text.includes("about the first")))()`);
  await Bun.sleep(300);
  expect(await page.evaluate(`document.querySelector("#reader .updview .rcomp textarea").value`)).toBe("about the second");
  expect(await page.evaluate(`document.querySelector("#reader .updview [data-rsend]").disabled`)).toBe(false);
  expect((await state()).notes.some((n: any) => n.text.includes("about the second"))).toBe(false);
}, 60_000);

test.skipIf(!chromeFound)("a message to a room clears only its own box, though the reader moved to another room", async () => {
  await server.post("/api/rooms", { slug: "r-one", title: "Room one", owner: "alpha", members: [] });
  await server.post("/api/rooms", { slug: "r-two", title: "Room two", owner: "golf", members: [] });
  // The reader shut first (a reload reopens what it showed), then the room by its address.
  await load();
  await page.evaluate(`document.getElementById("reader").hidden || document.querySelector("#reader [data-close]:not([hidden])")?.click()`);
  await until(`document.getElementById("reader").hidden`);
  await page.evaluate(`location.hash = "#room/r-one"`);
  await until(`location.hash === "#room/r-one" && !!document.querySelector("#roomView .rsend textarea")`);
  await type("#roomView .rsend textarea", "for room one");
  await hold("/post");
  await page.evaluate(`document.querySelector("#roomView [data-room-send]").click()`);
  await until(`!!window.__go`);
  await page.evaluate(`location.hash = "#room/r-two"`);
  await until(`!!document.querySelector("#roomView .rhead, #roomView")?.textContent.includes("Room two") && !!document.querySelector("#roomView .rsend textarea")`);
  await type("#roomView .rsend textarea", "for room two");
  // Read the box the moment the send has finished (its toast), before the next state can redraw the room.
  const box = await page.evaluate(`new Promise((ok) => { const mo = new MutationObserver(() => { if (/(SENT TO|KEPT FOR) ALPHA/.test(document.body.textContent)) { mo.disconnect(); ok(document.querySelector("#roomView .rsend textarea").value); } }); mo.observe(document.body, { subtree: true, childList: true, characterData: true }); window.__go(); })`);
  expect(box).toBe("for room two");
  await until(`(async () => (await (await fetch("/api/rooms/r-one")).json()).messages.some((m) => m.text === "for room one"))()`);
  await Bun.sleep(300);
  expect(await page.evaluate(`document.querySelector("#roomView .rsend textarea").value`)).toBe("for room two");
  expect(await page.evaluate(`document.querySelector("#roomView [data-room-send]").disabled`)).toBe(false);
}, 60_000);

test.skipIf(!chromeFound)("no page errors", () => {
  expect(errors).toEqual([]);
});

// Review follow-up: a link card shows a picture only from this HUD's own origin; a protocol-relative URL is another host.
test("a link card's image is fetched only from this HUD, never from //other.host or /\\other.host", async () => {
  const g = globalThis as any;
  const had = g.location;
  g.location = new URL("http://127.0.0.1:4999/");
  try {
    const { linkCards } = await import("../../src/client/reader/links.js");
    const html = (url: string) => linkCards([{ kind: "image", url, title: "x" }]);
    expect(html("/uploads/a.png")).toContain("<img");
    for (const url of ["//images.example.net/p.png", "/\\images.example.net/p.png", "https://images.example.net/p.png"]) expect(html(url)).not.toContain("<img");
    expect(html("http://127.0.0.1:4999/uploads/a.png")).toContain("<img");
  } finally {
    g.location = had;
  }
});
