// ROOMS in Chrome against a temporary server: the stack's Rooms filter, its count of rooms with new lane messages and
// a pill for each; a room as a place you go to in the reader (its address #room/SLUG, the close button, Esc, the
// browser's back button, a reload, the pills), with the stack untouched; an open room's lanes, brief, shelf and
// thread; one scroll in the reader, the brief folded after 12 lines, the send box pinned under it; line breaks in
// messages; writing to the owner and to a member; who sits at the table; and the phone: the reader full screen (no
// zoom, no sideways page, the newest message in view, no jump when a message lands while you read older ones). Needs
// Chrome; skipped without it.
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
const click = (sel: string) => page.evaluate(`document.querySelector(${JSON.stringify(sel)}).click()`);
const size = (width: number, height: number, mobile: boolean) => Promise.all([
  page.s("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: mobile ? 3 : 1, mobile }),
  page.s("Emulation.setTouchEmulationEnabled", { enabled: mobile, maxTouchPoints: 5 }),
]);
const load = async (hash = "") => {
  await page.s("Page.navigate", { url: `${server.base}/?world=off${hash}` });
  await until(`!!document.getElementById("card")?.innerHTML && !!window.__roomsReady && !!document.querySelector("#hud")`);
};
const press = (key: string) => page.evaluate(`document.dispatchEvent(new KeyboardEvent("keydown", { key: ${JSON.stringify(key)}, bubbles: true }))`);
const inRoom = (slug: string) => `location.hash === "#room/${slug}" && !document.getElementById("reader").hidden && !document.getElementById("roomView").hidden && !!document.querySelector("#roomView .rthread [data-rmsg], #roomView .rthread .empty:not(:empty)")`;
const inOffice = `location.hash === "" && document.getElementById("reader").hidden`;
const stack = `JSON.stringify((({ x, y, width }) => [x, y, width])(document.querySelector(".desk").getBoundingClientRect()))`;

const LONG_BRIEF = Array.from({ length: 12 }, (_, i) => `### Part ${i + 1}\nA paragraph that goes on for a while about part ${i + 1}, so that the brief is far longer than the screen.\n- a point\n- another point`).join("\n\n");

beforeAll(async () => {
  if (!chromeFound) return;
  chrome = await startChrome();
  server = await startServer(ROOT);
  // The stub herdr knows golf (working) and alpha (idle); bravo is away.
  for (const name of ["alpha", "golf", "bravo"]) await server.post("/api/lanes", { name, machine: "local" });
  await server.post("/api/sync", {});
  await server.post("/api/rooms", { slug: "ope-7", title: "Search relevance", owner: "alpha", members: ["golf", "bravo"], issues: ["OPE-7"] });
  await server.post("/api/rooms/ope-7/brief", { body: "## Plan\n- [x] baseline\n- [ ] rerank\n\nSee [the doc](https://example.com/doc) <script>window.pwned = 1</script> [bad](javascript:alert(1))\n\n```\nbun test\n```" });
  await server.post("/api/rooms/ope-7/artifacts", { title: "Eval report", url: "https://claude.ai/artifact/abc" });
  await server.post("/api/rooms/ope-7/artifacts", { title: "Dashboard", url: "https://example.com/dash" });
  const png = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="), (c) => c.charCodeAt(0));
  await fetch(`${server.base}/api/rooms/ope-7/files?name=shot.png&title=Screenshot`, { method: "POST", headers: { "content-type": "image/png", "x-hud": "1" }, body: png });
  for (let i = 1; i <= 14; i++) await server.post("/api/rooms/ope-7/say", { text: `Finding ${i}: the reranker moves item ${i} up.\nA second line.` });
  // A second room, with a brief far longer than the screen, six artifacts and a long thread.
  await server.post("/api/rooms", { slug: "ope-9", title: "Billing export", owner: "golf", members: ["alpha"] });
  await server.post("/api/rooms/ope-9/brief", { body: LONG_BRIEF });
  for (let i = 1; i <= 6; i++) await server.post("/api/rooms/ope-9/artifacts", { title: `Artifact number ${i} with a longer title`, url: `https://example.com/a/${i}` });
  for (let i = 1; i <= 20; i++) await server.post("/api/rooms/ope-9/say", { text: `Step ${i} of the export is done.` });
  await server.post("/api/rooms/ope-9/say", { text: "First line\nsecond line\n\nA new paragraph\n- one\n- two" });
  page = await newSession(chrome.cdp, errors);
  await page.s("Network.setBlockedURLs", { urls: ["*fonts.googleapis.com*", "*fonts.gstatic.com*"] });
  await size(1440, 900, false);
  await load();
}, 40_000);

afterAll(async () => {
  await server?.stop();
  await chrome?.close();
});

test.skipIf(!chromeFound)("the Rooms filter counts rooms with new lane messages and lists them; each has a pill", async () => {
  await until(`document.getElementById("fRooms").textContent === "2"`);
  await click('[data-filter="rooms"]');
  await until(`!!document.querySelector('#hud [data-room="ope-7"]')`);
  const row = await page.evaluate(`document.querySelector('#hud [data-room="ope-7"]').innerText`);
  expect(row).toContain("Search relevance");
  expect(row).toContain("alpha");
  expect(row).toContain("14 NEW");
  expect(row).toContain("+2");
  expect(await page.evaluate(`[...document.querySelectorAll("#roomPills .pill")].map((p) => p.innerText.replace(/\\s+/g, " ").trim()).sort()`)).toEqual(["ROOM Billing export 21", "ROOM Search relevance 14"]);
});

test.skipIf(!chromeFound)("a room is a place: the stack goes there, the address names it, close, Esc and the browser's back return, the stack never moves", async () => {
  const before = await page.evaluate(stack);
  await click('#hud [data-room="ope-7"]');
  await until(inRoom("ope-7"));
  // The stack is where it was; its row and the room's pill are lit.
  expect(await page.evaluate(stack)).toBe(before);
  expect(await page.evaluate(`[document.querySelector('#hud [data-room="ope-7"]').classList.contains("on"), document.querySelector('#roomPills [data-read="room:ope-7"]').classList.contains("on")]`)).toEqual([true, true]);
  // the close button
  await click("[data-room-back]");
  await until(inOffice);
  expect(await page.evaluate(stack)).toBe(before);
  // Esc
  await click('#hud [data-room="ope-7"]');
  await until(inRoom("ope-7"));
  await press("Escape");
  await until(inOffice);
  // The browser's back button, then forward
  await click('#hud [data-room="ope-7"]');
  await until(inRoom("ope-7"));
  await page.evaluate("history.back()");
  await until(inOffice);
  await page.evaluate("history.forward()");
  await until(inRoom("ope-7"));
  // A pill moves straight to another room, with its new messages counted; one back is the office.
  const chip = await page.evaluate(`document.querySelector('#roomPills [data-read="room:ope-9"]').innerText`);
  expect(chip).toContain("Billing export");
  expect(chip).toContain("21");
  await click('#roomPills [data-read="room:ope-9"]');
  await until(inRoom("ope-9"));
  await page.evaluate("history.back()");
  await until(inOffice);
  // J and K walk the stack with the reader open, from room to room.
  const [one, two] = await page.evaluate(`[...document.querySelectorAll("#hud .rrow")].map((r) => r.dataset.room)`);
  await click(`#hud [data-room="${one}"]`);
  await until(inRoom(one));
  await press("j");
  await until(inRoom(two));
  await press("k");
  await until(inRoom(one));
  await click("[data-room-back]");
  await until(inOffice);
  // A reload at a room's address opens it; the close button then leaves it.
  await load("#room/ope-7");
  await until(inRoom("ope-7"));
  await click("[data-room-back]");
  await until(inOffice);
  // An address with no such room: back to the office, and a word why.
  await load("#room/nope");
  await until(`location.hash === "" && document.getElementById("reader").hidden && [...document.querySelectorAll(".toast")].some((t) => t.textContent.includes("NO ROOM NOPE"))`);
});

test.skipIf(!chromeFound)("an open room: lanes with level and away, brief as markdown and inert, three cards, the thread at its newest", async () => {
  await load("#room/ope-7");
  await until(`document.querySelectorAll("#roomView .rthread [data-rmsg]").length === 14 && !!document.querySelector("#roomView .rbrief .md")`);
  await Bun.sleep(300);
  const v = await page.evaluate(`(() => {
    const r = document.getElementById("roomView"), md = r.querySelector(".rbrief .md"), body = r.querySelector(".rv-body").getBoundingClientRect();
    const last = [...r.querySelectorAll(".rthread [data-rmsg]")].pop().getBoundingClientRect();
    return {
      owner: [...r.querySelectorAll(".who .rlane")].map((b) => b.innerText.replace(/\\s+/g, " ").trim()),
      seats: [...r.querySelectorAll(".rvseats .rlane")].map((b) => b.innerText.replace(/\\s+/g, " ").trim()),
      h: md.querySelector("h4")?.textContent, ticks: md.querySelectorAll(".tick.on").length, links: [...md.querySelectorAll("a")].map((a) => a.getAttribute("href")),
      scripts: md.querySelectorAll("script").length, text: md.textContent,
      font: (() => { const f = (e) => { const c = getComputedStyle(e); return [c.fontFamily, c.fontSize, c.lineHeight]; }; return { body: f(md.querySelector("p")), item: f(md.querySelector("li")), message: f(r.querySelector(".rthread .msg .text p")), label: (({ fontSize, fontWeight }) => [fontSize, fontWeight])(getComputedStyle(r.querySelector(".rbrief .k"))) }; })(),
      code: md.querySelector(".codebox pre")?.textContent, copy: !!md.querySelector(".codebox .copy"),
      cards: [...r.querySelectorAll(".art")].map((a) => a.className.replace("art ", "")),
      lastInView: last.bottom <= body.bottom + 1 && last.top >= body.top - 1 && body.bottom <= innerHeight,
      sendInView: r.querySelector("[data-room-send]").getBoundingClientRect().bottom <= innerHeight,
      pageScroll: document.documentElement.scrollHeight > innerHeight,
    };
  })()`);
  // The owner in the head, then everyone at the table: the owner of the HUD first, then the room's lanes by name.
  expect(v.owner).toEqual(["alpha MANAGER OWNER"]);
  expect(v.seats).toEqual(["Tester HEAD", "alpha MANAGER", "bravo MANAGER AWAY", "golf MANAGER"]);
  expect(v.h).toBe("Plan");
  expect(v.ticks).toBe(1);
  expect(v.links).toEqual(["https://example.com/doc"]);
  expect(v.scripts).toBe(0);
  // The brief reads like a message: the text font and size, the label style (11px, weight 600) for its label only;
  // code in a code box.
  expect(v.font.body).toEqual(v.font.message);
  expect(v.font.item).toEqual(v.font.message);
  expect(v.font.body[0]).toContain("Inter");
  expect(v.font.label).toEqual(["11px", "600"]);
  expect(v.font.body[1]).not.toBe("11px");
  expect(v.code).toBe("bun test");
  expect(v.copy).toBe(true);
  expect(v.text).toContain("<script>");
  expect(await page.evaluate("window.pwned")).toBeUndefined();
  expect(v.cards).toEqual(["image", "link", "claude-artifact"]);
  expect(v).toMatchObject({ lastInView: true, sendInView: true, pageScroll: false });
  // Opening it marked the lanes' messages seen: its pill and its row stop counting them.
  await until(`!document.querySelector('#roomPills [data-read="room:ope-7"] .tag') && !document.querySelector('#hud [data-room="ope-7"] .tag.new')`);
  await click(".art.image [data-art-preview]");
  await until(`document.getElementById("imgPreview")?.open && document.querySelector("#imgPreview figcaption").textContent === "Screenshot"`);
  // Esc closes the preview, not the room.
  await press("Escape");
  await page.evaluate(`document.getElementById("imgPreview").close()`);
  expect(await page.evaluate(inRoom("ope-7"))).toBe(true);
});

test.skipIf(!chromeFound)("one scroll in the reader: the brief folded after 12 lines, the shelf, the thread at its newest; the send box pinned under it", async () => {
  await load("#room/ope-9");
  await until(`document.querySelectorAll("#roomView .rshelf .art").length === 6 && document.querySelectorAll("#roomView .rthread [data-rmsg]").length === 21`);
  await Bun.sleep(300);
  const v = await page.evaluate(`(() => {
    const r = document.getElementById("roomView"), body = r.querySelector(".rv-body"), send = r.querySelector(".rsend"), reader = document.getElementById("reader").getBoundingClientRect();
    const br = body.getBoundingClientRect(), sr = send.getBoundingClientRect();
    const last = [...r.querySelectorAll(".rthread [data-rmsg]")].pop().getBoundingClientRect();
    return {
      clamped: !!r.querySelector(".rbrief .md.clamp"), fold: r.querySelector("[data-brief-fold]").textContent,
      bodyScrolls: getComputedStyle(body).overflowY === "auto" && body.scrollHeight > body.clientHeight,
      nested: [...body.querySelectorAll("*")].some((e) => /auto|scroll/.test(getComputedStyle(e).overflowY)),
      sendBelow: sr.top >= br.bottom - 1 && sr.bottom <= innerHeight,
      newest: last.bottom <= br.bottom + 1,
      inWindow: reader.bottom <= innerHeight,
      pageScroll: document.documentElement.scrollHeight > innerHeight,
    };
  })()`);
  expect(v.fold).toMatch(/^ALL \d+ LINES$/);
  expect(v).toMatchObject({ clamped: true, bodyScrolls: true, nested: false, sendBelow: true, newest: true, inWindow: true, pageScroll: false });
  // ALL N LINES unfolds it, and it stays so for this room.
  await click("[data-brief-fold]");
  await until(`!document.querySelector("#roomView .rbrief .md.clamp") && document.querySelector("[data-brief-fold]").textContent === "FOLD THE BRIEF"`);
});

test.skipIf(!chromeFound)("a message's line breaks show: a break for a new line, a paragraph for a blank one, lists and code as markdown", async () => {
  const html = await page.evaluate(`[...document.querySelectorAll("#roomView .rthread .msg")].find((m) => m.innerText.includes("First line")).querySelector(".text").innerHTML`);
  expect(html).toContain("<p>First line<br>second line</p><p>A new paragraph</p><ul><li>one</li><li>two</li></ul>");
  // The owner's own message, sent from the box, keeps its breaks too.
  await page.evaluate(`(() => { const ta = document.querySelector("#roomView .rsend textarea"); ta.value = "one\\ntwo\\n\\nthree"; ta.dispatchEvent(new Event("input", { bubbles: true })); })()`);
  await click("[data-room-send]");
  await until(`[...document.querySelectorAll("#roomView .msg.you")].some((m) => m.querySelector(".text").innerHTML === "<p>one<br>two</p><p>three</p>")`);
});

test.skipIf(!chromeFound)("the seats name who is at the table: the owner at its head, then the owning lane and its members (by name when added together), each one selectable", async () => {
  await load("#room/ope-7");
  await until(inRoom("ope-7"));
  const seats = await page.evaluate(`[...document.querySelectorAll("#roomView .rvseats .rlane")].map((b) => [b.querySelector("b").textContent, b.dataset.select ?? null])`);
  expect(seats).toEqual([["Tester", null], ["alpha", "alpha"], ["bravo", "bravo"], ["golf", "golf"]]);
  await page.evaluate(`document.querySelector('#roomView .rvseats [data-select="golf"]').click()`);
  await until(`document.querySelector("#card h3")?.textContent === "golf"`);
});

test.skipIf(!chromeFound)("writing: to the owner by default, to a member with To:, kept for a lane that is away", async () => {
  await load("#room/ope-7");
  await until(`!!document.querySelector("#roomView [data-room-send]")`);
  const write = async (text: string) => {
    await page.evaluate(`(() => { const ta = document.querySelector("#roomView .rsend textarea"); ta.value = ${JSON.stringify(text)}; ta.dispatchEvent(new Event("input", { bubbles: true })); })()`);
    await click("[data-room-send]");
    await until(`[...document.querySelectorAll("#roomView .msg.you")].some((m) => m.innerText.includes(${JSON.stringify(text)}) && !m.innerText.includes("SENDING"))`);
    return page.evaluate(`[...document.querySelectorAll("#roomView .msg.you")].pop().innerText`);
  };
  expect(await write("How far is the rerank?")).toMatch(/→ alpha[\s\S]*DELIVERED/);
  await page.evaluate(`(() => { const s = document.querySelector("[data-room-to]"); s.value = "golf"; s.dispatchEvent(new Event("change", { bubbles: true })); })()`);
  expect(await page.evaluate(`document.querySelector(".rsend .tostate").textContent`)).toBe("typed into golf");
  expect(await write("Golf, the numbers?")).toMatch(/→ golf[\s\S]*DELIVERED/);
  await page.evaluate(`(() => { const s = document.querySelector("[data-room-to]"); s.value = "bravo"; s.dispatchEvent(new Event("change", { bubbles: true })); })()`);
  expect(await page.evaluate(`document.querySelector(".rsend .tostate").textContent`)).toContain("AWAY");
  expect(await write("Bravo, when you are back.")).toMatch(/→ bravo[\s\S]*AWAY · KEPT/);
  const thread = await (await fetch(`${server.base}/api/rooms/ope-7`)).json();
  expect(thread.messages.slice(-3).map((m: any) => [m.to, m.delivery])).toEqual([["alpha", "sent"], ["golf", "sent"], ["bravo", "away"]]);
});

test.skipIf(!chromeFound)("phone: the room in the reader, full screen; no zoom, no sideways page; the thread opens at its newest and keeps your place", async () => {
  await size(390, 664, true);
  await load("#room/ope-7");
  await until(`!!document.querySelector("#roomView .rthread [data-rmsg]") && !!document.querySelector("#roomView .rbrief .md")`);
  // The room settles at its newest message once the view has its size (a frame after the room is drawn).
  const BODY = `document.querySelector("#roomView .rv-body")`;
  await until(`(() => { const b = ${BODY}; return b.scrollHeight - b.scrollTop - b.clientHeight < 2; })()`, 3000);
  const v = await page.evaluate(`(() => {
    const view = document.getElementById("reader").getBoundingClientRect(), b = ${BODY}, br = b.getBoundingClientRect();
    const last = [...document.querySelectorAll("#roomView .rthread [data-rmsg]")].pop().getBoundingClientRect();
    return {
      full: Math.round(view.left) === 0 && Math.round(view.top) === 0 && Math.round(view.width) === innerWidth && Math.round(view.height) === innerHeight,
      select: parseFloat(getComputedStyle(document.querySelector("[data-room-to]")).fontSize),
      textarea: parseFloat(getComputedStyle(document.querySelector("#roomView .rsend textarea")).fontSize),
      sendInView: document.querySelector("[data-room-send]").getBoundingClientRect().bottom <= innerHeight,
      wide: document.documentElement.scrollWidth > innerWidth,
      overflowY: getComputedStyle(b).overflowY, bounded: b.scrollHeight > b.clientHeight,
      newest: last.bottom <= br.bottom + 1 && last.top >= br.top - 1,
    };
  })()`);
  expect(v).toEqual({ full: true, select: 16, textarea: 16, sendInView: true, wide: false, overflowY: "auto", bounded: true, newest: true });
  // Reading older messages: a new one lands below, and what you read stays where it was.
  const first = `document.querySelector('#roomView .rthread [data-rmsg]')`;
  await page.evaluate(`(() => { const b = ${BODY}; b.scrollTop += ${first}.getBoundingClientRect().top - b.getBoundingClientRect().top - 20; b.dispatchEvent(new Event("scroll")); })()`);
  await Bun.sleep(100);
  const before = await page.evaluate(`[${first}.dataset.rmsg, ${first}.getBoundingClientRect().top]`);
  await server.post("/api/rooms/ope-7/say", { text: "One more finding, while you read." });
  await until(`[...document.querySelectorAll("#roomView .rthread [data-rmsg]")].some((m) => m.innerText.includes("while you read"))`);
  const after = await page.evaluate(`[${first}.dataset.rmsg, ${first}.getBoundingClientRect().top]`);
  expect(after[0]).toBe(before[0]);
  expect(Math.abs(after[1] - before[1])).toBeLessThan(2);
  // The close button returns to the page as it was, with the stack.
  await click("[data-room-back]");
  await until(inOffice);
  expect(await page.evaluate(`getComputedStyle(document.documentElement).overflowY !== "hidden" && document.querySelector(".desk").getBoundingClientRect().height > 0`)).toBe(true);
  expect(errors).toEqual([]);
});

test.skipIf(!chromeFound)("a shelf image shows as a picture only when this HUD serves it; one on another host is a link card, never fetched", async () => {
  // A room of its own, with no lane messages, so the counts the tests above check stay as they are.
  await server.post("/api/rooms", { slug: "ope-11", title: "Pictures", owner: "alpha" });
  const png = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="), (c) => c.charCodeAt(0));
  const up = await (await fetch(`${server.base}/api/uploads?name=chart.png`, { method: "POST", headers: { "content-type": "image/png", "x-hud": "1" }, body: png })).json();
  await server.post("/api/rooms/ope-11/artifacts", { title: "Uploaded chart", url: new URL(up.url, server.base).href, kind: "image" });
  await server.post("/api/rooms/ope-11/artifacts", { title: "Tracking pixel", url: "https://images.example.net/pixel.png", kind: "image" });
  // A full load at the desktop size, not a hash change on the page as it is: its state may not have the new room yet.
  await size(1440, 900, false);
  await page.s("Page.navigate", { url: "about:blank" });
  await load("#room/ope-11");
  await until(`document.querySelectorAll("#roomView .rshelf .art").length === 2`);
  const cards = await page.evaluate(`[...document.querySelectorAll("#roomView .rshelf .art")].map((a) => ({ title: a.querySelector(".at").textContent, img: a.querySelector("img")?.getAttribute("src") ?? null, href: a.querySelector("a")?.getAttribute("href") ?? null }))`);
  expect(cards).toEqual([
    { title: "Tracking pixel", img: null, href: "https://images.example.net/pixel.png" },
    { title: "Uploaded chart", img: new URL(up.url, server.base).href, href: null },
  ]);
  expect(await page.evaluate(`performance.getEntriesByType("resource").some((e) => e.name.includes("images.example.net"))`)).toBe(false);
});
