// The stack and its keys: nothing sends an answer the owner did not mean, nothing hides what a question says. The keys
// act on one target, the item last used, and it is marked; a second ⌘Enter after an answer does not answer the next
// question; a long card is never answered from the stack; Enter belongs to buttons; M is the tier menu and E is left to
// the office; a saved filter never hides a blocking question; the quick SEND stays off until its send settles.
// Needs Chrome (CHROME_BIN); skipped without it. A throwaway server on a spare port, the world off.
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
const answerOf = async (id: number) => (await state()).answered.find((a: any) => a.id === id) ?? null;
const clear = async () => { for (const a of (await state()).open) await server.post(`/api/asks/${a.id}/withdraw`, {}); };
const ask = async (b: object) => (await server.post("/api/asks", b)).id as number;
const META = 4;
async function key(k: string, mods = 0, autoRepeat = false) {
  const code = k === "Enter" ? "Enter" : k === " " ? "Space" : /\d/.test(k) ? `Digit${k}` : `Key${k.toUpperCase()}`;
  const vk = k === "Enter" ? 13 : k === " " ? 32 : k.toUpperCase().charCodeAt(0);
  await page.s("Input.dispatchKeyEvent", { type: "rawKeyDown", key: k, code, windowsVirtualKeyCode: vk, modifiers: mods, autoRepeat });
  if (!mods && (k.length === 1 || k === "Enter")) await page.s("Input.dispatchKeyEvent", { type: "char", key: k, text: k === "Enter" ? "\r" : k, modifiers: mods });
  await page.s("Input.dispatchKeyEvent", { type: "keyUp", key: k, code, windowsVirtualKeyCode: vk, modifiers: mods });
}
const card = (id: number) => `document.querySelector('#hud .ask[data-ask="${id}"]')`;
const readerAsk = `document.querySelector("#reader:not([hidden]) .askview:not([hidden])")?.dataset.ask`;
// Loads the page with the reader shut (a reload reopens what it showed).
async function load() {
  await page.s("Page.navigate", { url: `${server.base}/?world=off` });
  await until(`!!window.__roomsReady && !!document.querySelector("#hud .item, #hud .empty")`);
  await page.evaluate(`document.getElementById("reader").hidden || document.querySelector("#reader [data-close]:not([hidden])")?.click()`);
  await until(`document.getElementById("reader").hidden`);
}
// A real picture on the HUD, so the card's thumbnail loads.
const PNG = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="), (c) => c.charCodeAt(0));
const upload = async () => (await (await fetch(`${server.base}/api/uploads?name=shot`, { method: "POST", headers: { "content-type": "image/png", "x-hud": "1" }, body: PNG })).json()).url as string;

beforeAll(async () => {
  if (!chromeFound) return;
  chrome = await startChrome();
  server = await startServer(ROOT);
  for (const name of ["bravo", "charlie"]) await server.post("/api/lanes", { name, phase: "running", title: "x", machine: "local" });
  page = await newSession(chrome.cdp, errors);
  await page.s("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
}, 60_000);
afterAll(async () => { await server?.stop(); await chrome?.close(); });

test.skipIf(!chromeFound)("a second ⌘Enter after an answer does not answer the next question, however long it waits", async () => {
  await clear();
  const A = await ask({ lane: "bravo", kind: "decision", title: "Pick one", body: "Long.\n```\nx\n```", options: ["Yes", "No"], tier: "blocking" });
  const B = await ask({ lane: "charlie", kind: "action", title: "Rotate the key, then DONE" });
  await load();
  await page.evaluate(`${card(A)}.click()`);
  await until(`${readerAsk} === "${A}"`);
  await key("1");
  await until(`document.querySelector('#reader .askview .opt.sel')?.dataset.opt === "Yes"`);
  await key("Enter", META);
  await until(`${readerAsk} === "${B}"`);
  // The advanced question is unconfirmed: its send is off, now and after any wait, and ⌘Enter sends nothing.
  const send = `document.querySelector("#reader .askview [data-send]")`;
  expect(await page.evaluate(`${send}.disabled`)).toBe(true);
  await key("Enter", META);
  await Bun.sleep(3000);
  expect(await page.evaluate(`${send}.disabled`)).toBe(true);
  await key("Enter", META);
  await Bun.sleep(500);
  expect((await answerOf(A))?.answer).toBe("Yes");
  expect(await answerOf(B)).toBeNull();
  expect(await page.evaluate(`${readerAsk}`)).toBe(String(B));
  // A click in the question confirms it: the send is on, and a deliberate ⌘Enter sends.
  await page.evaluate(`document.querySelector("#reader .askview .rv-title").click()`);
  await until(`${send}.disabled === false`);
  await key("Enter", META);
  await until(`!document.querySelector('#hud .ask[data-ask="${B}"]')`);
  expect((await answerOf(B))?.answer).toBe("done");
}, 60_000);

test.skipIf(!chromeFound)("picking with 1–9 on an advanced question confirms it, and the send still needs its own press", async () => {
  await clear();
  const A = await ask({ lane: "bravo", kind: "action", title: "First thing, then DONE", body: "Steps.\n```\nmake\n```" });
  const B = await ask({ lane: "charlie", kind: "decision", title: "Second thing", body: "Long.\n```\nx\n```", options: ["Yes", "No"] });
  await load();
  await page.evaluate(`${card(A)}.click()`);
  await until(`${readerAsk} === "${A}" && !document.querySelector("#reader .askview [data-send]").disabled`);
  await key("Enter", META);
  await until(`${readerAsk} === "${B}"`);
  await key("2");
  await until(`document.querySelector('#reader .askview .opt.sel')?.dataset.opt === "No"`);
  await until(`document.querySelector("#reader .askview [data-send]").disabled === false`);
  expect(await answerOf(B)).toBeNull();
  await key("Enter", META);
  for (let i = 0; i < 100 && !(await answerOf(B)); i++) await Bun.sleep(50);
  expect((await answerOf(B))?.answer).toBe("No");
}, 60_000);

test.skipIf(!chromeFound)("a held ⌘Enter (key repeat) sends nothing", async () => {
  await clear();
  const A = await ask({ lane: "bravo", kind: "action", title: "Do the thing", body: "Steps.\n```\nmake\n```" });
  await load();
  await page.evaluate(`${card(A)}.click()`);
  await until(`${readerAsk} === "${A}" && !document.querySelector("#reader .askview [data-send]").disabled`);
  await key("Enter", META, true);
  await Bun.sleep(1200);
  expect(await answerOf(A)).toBeNull();
}, 60_000);

test.skipIf(!chromeFound)("keys act on the card just used, and it is marked, not the reader's question", async () => {
  await clear();
  const A = await ask({ lane: "bravo", kind: "info", title: "FYI long one", body: "Read this.\n```\ncode\n```" });
  const B = await ask({ lane: "charlie", kind: "decision", title: "Short pick", options: ["Yes", "No"] });
  await load();
  await until(`document.querySelectorAll("#hud .ask").length === 2`);
  await page.evaluate(`${card(A)}.click()`);
  await until(`${readerAsk} === "${A}"`);
  expect(await page.evaluate(`document.getElementById("reader").classList.contains("target")`)).toBe(true);
  await page.evaluate(`${card(B)}.querySelector('.opt[data-opt="Yes"]').click()`);
  await until(`${card(B)}.classList.contains("target") && !document.getElementById("reader").classList.contains("target")`);
  await key("2");
  await until(`${card(B)}.querySelector(".opt.sel")?.dataset.opt === "No"`);
  expect(await page.evaluate(`document.querySelector("#reader .askview .opt.sel")`)).toBeNull();
  await key("Enter", META);
  await Bun.sleep(1500);
  expect((await answerOf(B))?.answer).toBe("No");
  expect(await answerOf(A)).toBeNull();
}, 60_000);

test.skipIf(!chromeFound)("a short card shows its kind, its whole body, its link and its images", async () => {
  await clear();
  const shot = await upload();
  const A = await ask({ lane: "bravo", kind: "decision", title: "Merge it?", body: `This drops the users table in production. [image: ${shot}]`, link: "https://example.com/pr/1", options: ["Yes", "No"] });
  const B = await ask({ lane: "charlie", kind: "action", title: "Rotate the key" });
  await load();
  await until(`!!${card(A)} && !!${card(B)}`);
  const c = await page.evaluate(`(() => { const c = ${card(A)}; return { short: c.classList.contains("short"), text: c.textContent.replace(/\\s+/g, " "), link: !!c.querySelector('a[href="https://example.com/pr/1"]'), img: !!c.querySelector('img[src="${shot}"]') }; })()`);
  expect(c.short).toBe(true);
  expect(c.text).toContain("This drops the users table in production.");
  expect(c.text).toContain("DECISION");
  expect(c.link).toBe(true);
  expect(c.img).toBe(true);
  expect(await page.evaluate(`${card(B)}.textContent`)).toContain("ACTION");
  await page.evaluate(`${card(B)}.querySelector("h3").click()`);
  await until(`${readerAsk} === "${B}"`);
  expect(await page.evaluate(`document.querySelector("#reader .askview .rv-head").textContent`)).toContain("ACTION");
}, 60_000);

test.skipIf(!chromeFound)("⌘Enter and 1–9 do nothing to a long card that is not open in the reader", async () => {
  await clear();
  const A = await ask({ lane: "bravo", kind: "action", title: "Run the migration by hand", body: "Steps:\n```\nmake migrate\n```" });
  const B = await ask({ lane: "charlie", kind: "decision", title: "Pick a long one", body: "Read:\n```\nx\n```", options: ["Yes", "No"] });
  await load();
  await until(`!!${card(A)} && !!${card(B)}`);
  await page.evaluate(`document.activeElement?.blur()`);
  await key("j");
  await until(`${card(A)}.classList.contains("focus")`);
  expect(await page.evaluate(`document.getElementById("reader").hidden`)).toBe(true);
  await key("Enter", META);
  await key("j");
  await until(`${card(B)}.classList.contains("focus")`);
  await key("1");
  await Bun.sleep(1200);
  expect(await answerOf(A)).toBeNull();
  await page.evaluate(`${card(B)}.click()`);
  await until(`${readerAsk} === "${B}"`);
  expect(await page.evaluate(`document.querySelector("#reader .askview .opt.sel")`)).toBeNull();
}, 60_000);

test.skipIf(!chromeFound)("Enter on a button is the button's; Enter with nothing focused opens the focused card", async () => {
  await clear();
  const A = await ask({ lane: "bravo", kind: "info", title: "Long info", body: "x\n```\ny\n```" });
  const B = await ask({ lane: "charlie", kind: "info", title: "Another long info", body: "x\n```\ny\n```" });
  await load();
  await page.evaluate(`${card(A)}.click()`);
  await until(`${readerAsk} === "${A}"`);
  await page.evaluate(`document.querySelector("#reader .askview [data-send]").focus()`);
  await key("Enter");
  await Bun.sleep(1500);
  expect((await answerOf(A))?.answer).toBe("seen");
  await until(`${readerAsk} === "${B}" || document.getElementById("reader").hidden`);
  await page.evaluate(`document.activeElement?.blur(); document.querySelector("#reader [data-close]")?.click()`);
  await until(`document.getElementById("reader").hidden`);
  await key("j");
  await until(`${card(B)}.classList.contains("focus")`);
  await key("Enter");
  await until(`${readerAsk} === "${B}"`);
}, 60_000);

test.skipIf(!chromeFound)("M opens the tier menu; E is left to the office", async () => {
  await clear();
  const A = await ask({ lane: "bravo", kind: "decision", title: "Tiered", body: "x\n```\ny\n```", options: ["a", "b"] });
  await load();
  await page.evaluate(`${card(A)}.click()`);
  await until(`${readerAsk} === "${A}"`);
  await page.evaluate(`window.__ePrevented = null; window.addEventListener("keydown", (e) => { if (e.key === "e") window.__ePrevented = e.defaultPrevented; })`);
  await key("e");
  await until(`window.__ePrevented !== null`);
  expect(await page.evaluate(`window.__ePrevented`)).toBe(false);
  expect(await page.evaluate(`!!document.querySelector("#reader .tiermenu[open]")`)).toBe(false);
  await key("m");
  await until(`!!document.querySelector("#reader .tiermenu[open]")`);
  expect(await page.evaluate(`document.querySelector("#reader .tiermenu summary").title`)).toContain("(M)");
  await key("Escape");
  await key("?");
  await until(`!!document.querySelector("dialog.keys[open]")`);
  const dl = await page.evaluate(`document.querySelector("dialog.keys").textContent`);
  expect(dl).toContain("M");
  expect(dl).toMatch(/Q \/ E|Q, E|Q and E/);
  await page.evaluate(`document.querySelector("dialog.keys").close()`);
}, 60_000);

test.skipIf(!chromeFound)("a saved Rooms filter never hides a blocking question", async () => {
  await clear();
  const A = await ask({ lane: "bravo", kind: "decision", title: "Blocking one", options: ["a", "b"], tier: "blocking" });
  await load();
  await page.evaluate(`localStorage.setItem("hq-filter", "rooms")`);
  try {
    await load();
    await until(`!!${card(A)}`);
    expect(await page.evaluate(`document.querySelector("#filters .on")?.dataset.filter`)).toBe("rooms");
  } finally {
    await page.evaluate(`localStorage.removeItem("hq-filter")`);
  }
}, 60_000);

test.skipIf(!chromeFound)("the quick SEND stays off until its send settles, whatever redraws the stack", async () => {
  await clear();
  const A = await ask({ lane: "bravo", kind: "action", title: "Quick one" });
  await load();
  await until(`!!${card(A)}?.querySelector("[data-quick]:not([disabled])")`);
  // Hold the answer's POST until the test lets it go.
  await page.evaluate(`(() => { const f = window.fetch; window.__go = null; window.fetch = (u, o) => String(u).includes("/answer") ? new Promise((r) => { window.__go = () => r(f(u, o)); }) : f(u, o); })()`);
  await page.evaluate(`${card(A)}.querySelector("[data-quick]").click()`);
  await until(`!!window.__go`);
  await ask({ lane: "charlie", kind: "info", title: "Arrives meanwhile" });
  await until(`document.querySelectorAll("#hud .ask").length === 2`);
  expect(await page.evaluate(`${card(A)}.querySelector("[data-quick]").disabled`)).toBe(true);
  await page.evaluate(`window.__go()`);
  await until(`!${card(A)}`);
  expect((await answerOf(A))?.answer).toBe("done");
}, 60_000);

test.skipIf(!chromeFound)("no page errors", () => {
  expect(errors).toEqual([]);
});
