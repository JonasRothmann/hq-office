// The desk HUD (src/client/desk-hud/): its words and numbers, its placement, and in Chrome against a seeded server
// with four lanes whose vitals came through POST /api/lanes/:name/vitals: one chip per lane showing model, effort,
// subagent count and context; on the world, no two chips overlap and none touches the question column, at the
// default and the far zoom; hover lifts a chip with the lane's title, a click selects the lane.
//
// The chips' content is HTML from the state and needs no world; where they are drawn is over the office, which the
// page mounts. WebGL runs on SwiftShader. Needs Chrome (CHROME_BIN to point at one); skipped without it.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { findChrome, newSession, startChrome, startServer } from "../../scripts/room-hash.ts";
import { shortModel, tokens } from "../../src/client/desk-hud/format.js";
import { crowding, place } from "../../src/client/desk-hud/layout.js";

const ROOT = join(import.meta.dir, "..", "..");

describe("desk HUD words and numbers", () => {
  test("short model names, a dash when unknown", () => {
    expect(["claude-opus-5-5", "claude-sonnet-4-5-20250929", "claude-haiku-4-5", "claude-opus-5-5[1m]", "claude-3-5-sonnet-20241022", "haiku", "claude-opus-4", null].map(shortModel))
      .toEqual(["opus 5.5", "sonnet 4.5", "haiku 4.5", "opus 5.5", "sonnet 3.5", "haiku", "opus 4", "—"]);
  });
  test("token counts", () => {
    expect([412_000, 1_000_000, 1_500_000, 200_000, 84_123, 8_400, 950, 0, null].map(tokens)).toEqual(["412k", "1M", "1.5M", "200k", "84k", "8.4k", "950", "0", "—"]);
  });
});

describe("desk HUD placement", () => {
  const overlap = (a: any, b: any) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  test("chips that want the same spot are nudged apart; none overlaps another or a panel", () => {
    const items = Array.from({ length: 6 }, (_, i) => ({ key: `l${i}`, x: 600 + i * 30, y: 300 + (i % 2) * 10, w: 160, h: 38 }));
    const column = { x: 12, y: 12, w: 420, h: 876 };
    const out = place(items, { obstacles: [column], bounds: { x: 0, y: 0, w: 1440, h: 900 }, reach: 400 });
    const boxes = items.map((it) => ({ ...out.get(it.key), w: it.w, h: it.h }));
    expect(boxes.every((b) => b.x !== undefined)).toBe(true);
    for (let i = 0; i < boxes.length; i++) {
      expect(overlap(boxes[i], column)).toBe(false);
      for (let j = i + 1; j < boxes.length; j++) expect(overlap(boxes[i], boxes[j])).toBe(false);
    }
    // the first keeps its spot
    expect(out.get("l0")).toMatchObject({ x: 600, y: 300, moved: 0 });
  });
  test("a chip with no free spot in reach gets none, and crowding says so", () => {
    const items = [{ key: "a", x: 100, y: 100, w: 100, h: 30 }, { key: "b", x: 100, y: 100, w: 100, h: 30 }];
    const out = place(items, { bounds: { x: 0, y: 0, w: 210, h: 140 }, reach: 20 });
    expect(out.get("a")).toBeTruthy();
    expect(out.get("b")).toBeNull();
    expect(crowding(out)).toEqual({ moved: 0, lost: 1 });
  });
});

const chromeFound = !!findChrome();
const claudeDir = mkdtempSync(join(tmpdir(), "hq-deskhud-claude-"));
let chrome: Awaited<ReturnType<typeof startChrome>>;
let server: Awaited<ReturnType<typeof startServer>>;
let page: Awaited<ReturnType<typeof newSession>>;
const errors: string[] = [];
// SwiftShader on a loaded machine is slow: a page's first evaluate can take most of a minute.
const SLOW = 180_000;
// DESK_HUD_SHOTS=DIR saves what each world test saw, for judging the look.
const shot = async (name: string) => {
  if (!process.env.DESK_HUD_SHOTS) return;
  const { data } = await page.s("Page.captureScreenshot", { format: "png" });
  writeFileSync(join(process.env.DESK_HUD_SHOTS, `desk-hud-${name}.png`), Buffer.from(data, "base64"));
};
const until = async (expr: string, ms = 60_000) => {
  for (const end = Date.now() + ms; Date.now() < end; await Bun.sleep(100)) if (await page.evaluate(expr).catch(() => false)) return true;
  throw new Error(`timed out waiting for ${expr}`);
};

// The four lanes and what each reports. golf works with a blocking question open; bravo waits on the owner.
const LANES = [
  { name: "golf", title: "Port the export to the new API", vitals: { model: "claude-opus-5-5", effort: "high", subagents: 3, contextUsed: 412_000, contextMax: 1_000_000 }, text: ["opus 5.5 · high", "412k / 1M"], subs: 3 },
  { name: "bravo", title: "Has a question", vitals: { model: "claude-sonnet-4-5", effort: "medium", subagents: 1, contextUsed: 84_000, contextMax: 200_000 }, text: ["sonnet 4.5 · medium", "84k / 200k"], subs: 1 },
  { name: "charlie", title: "Waits on CI", vitals: { model: "claude-haiku-4-5", subagents: 0, contextUsed: 176_000, contextMax: 200_000 }, text: ["haiku 4.5 · —", "176k / 200k"], subs: 0 },
  { name: "delta", title: "Reports nothing but its effort", vitals: { effort: "low" }, text: ["— · low", "— / 200k"], subs: 0 }, // the server's default window
];

const CHIPS = `[...document.querySelectorAll("#deskHud .dh-chip")].map((el) => {
  const r = el.getBoundingClientRect();
  return { lane: el.dataset.lane, shown: !el.hidden && r.width > 0, text: el.textContent, count: el.querySelector(".dh-cnt")?.textContent, badge: el.querySelector(".dh-blk")?.textContent ?? null,
    wait: el.classList.contains("wait"), compact: el.classList.contains("compact"), x: r.left, y: r.top, w: r.width, h: r.height };
})`;
// Every pair of shown chips that overlap, and every shown chip that touches the question column or the status pill.
const CLASHES = `(() => {
  const chips = [...document.querySelectorAll("#deskHud .dh-chip:not([hidden])")].map((el) => [el.dataset.lane, el.getBoundingClientRect()]);
  const hit = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
  const out = [];
  for (let i = 0; i < chips.length; i++) for (let j = i + 1; j < chips.length; j++) if (hit(chips[i][1], chips[j][1])) out.push(chips[i][0] + " over " + chips[j][0]);
  for (const sel of [".desk", ".top"]) { const p = document.querySelector(sel).getBoundingClientRect(); for (const [lane, r] of chips) if (hit(r, p)) out.push(lane + " over " + sel); }
  return out;
})()`;

beforeAll(async () => {
  if (!chromeFound) return;
  chrome = await startChrome({ webgl: true });
  page = await newSession(chrome.cdp, errors); // first: on a loaded machine a tab opened later can take its time
  server = await startServer(ROOT, { HUD_CLAUDE_DIR: claudeDir, HUD_HQ_HINT: "0", HUD_GH_BIN: "false" });
  for (const l of LANES) await server.post("/api/lanes", { name: l.name, title: l.title, phase: l.name === "charlie" ? "waiting" : "running", machine: "local" });
  for (const l of LANES) {
    const r = await server.post(`/api/lanes/${l.name}/vitals`, l.vitals);
    if (!r.vitals) throw new Error(`vitals for ${l.name}: ${JSON.stringify(r)}`);
  }
  await server.post("/api/asks", { lane: "golf", kind: "decision", tier: "blocking", title: "Which database for the export?", options: ["Postgres", "SQLite"] });
  await server.post("/api/asks", { lane: "bravo", kind: "decision", title: "Ship the thing?", options: ["Yes", "No"] });
  await server.post("/api/sync", {});
  await page.s("Network.setBlockedURLs", { urls: ["*fonts.googleapis.com*", "*fonts.gstatic.com*"] });
  await page.s("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await page.s("Page.navigate", { url: `${server.base}/` });
}, SLOW);

afterAll(async () => {
  await server?.stop();
  await chrome?.close();
  rmSync(claudeDir, { recursive: true, force: true });
});

test.skipIf(!chromeFound)("one chip per lane, with its model, effort, exact subagent count, context and blocking badge", async () => {
  await until(`document.querySelectorAll("#deskHud .dh-chip").length === 4`);
  const chips = await page.evaluate(CHIPS);
  expect(chips.map((c: any) => c.lane).sort()).toEqual(LANES.map((l) => l.name).sort());
  for (const l of LANES) {
    const c = chips.find((c: any) => c.lane === l.name);
    for (const t of l.text) expect({ lane: l.name, has: c.text.includes(t), t }).toEqual({ lane: l.name, has: true, t });
    expect(c.count).toBe(String(l.subs));
  }
  const golf = chips.find((c: any) => c.lane === "golf"), bravo = chips.find((c: any) => c.lane === "bravo");
  expect(golf.badge).toBe("1"); // working, and blocked on a question
  expect(golf.text).toContain("working");
  expect(golf.wait).toBe(false);
  expect(bravo.wait).toBe(true); // waiting on the owner: the red edge
  // the chips come after the question column in tab order
  expect(await page.evaluate(`!!(document.querySelector(".desk").compareDocumentPosition(document.getElementById("deskHud")) & Node.DOCUMENT_POSITION_FOLLOWING)`)).toBe(true);
  expect(errors).toEqual([]);
}, SLOW);

test.skipIf(!chromeFound)("dark: the chips take the dark glass", async () => {
  const look = `(() => { const el = document.querySelector("#deskHud .dh-chip"); return [getComputedStyle(el.querySelector(".dh-name")).color, getComputedStyle(el).backgroundColor]; })()`;
  await page.evaluate(`document.documentElement.dataset.theme = "light"`);
  const light = await page.evaluate(look);
  await page.evaluate(`document.documentElement.dataset.theme = "dark"`);
  const dark = await page.evaluate(look);
  expect(dark[0]).not.toBe(light[0]);
  expect(dark[1]).not.toBe(light[1]);
  await page.evaluate(`delete document.documentElement.dataset.theme`);
}, SLOW);

// From here on the chips are drawn over the office: the page mounts it.
test.skipIf(!chromeFound)("every chip shows, none overlaps another, none touches the question column or the pill", async () => {
  await until(`document.querySelectorAll("#deskHud .dh-chip:not([hidden])").length === 4`, 120_000);
  await Bun.sleep(1500); // let the camera's fit ease in
  await shot("mid");
  expect(await page.evaluate(CLASHES)).toEqual([]);
  // the question cards stay on top at their centres
  expect(await page.evaluate(`[...document.querySelectorAll("#hud .ask")].every((c) => { const r = c.getBoundingClientRect(); return c.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)); })`)).toBe(true);
  expect(errors).toEqual([]);
}, SLOW);

test.skipIf(!chromeFound)("hover lifts a chip to full with the lane's title; a click selects the lane", async () => {
  const at = await page.evaluate(`(() => { const r = document.querySelector('#deskHud .dh-chip[data-lane="golf"]').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
  await page.s("Input.dispatchMouseEvent", { type: "mouseMoved", x: at.x, y: at.y });
  await until(`document.querySelector('#deskHud .dh-chip[data-lane="golf"]').classList.contains("hot")`);
  const title = await page.evaluate(`(() => { const t = document.querySelector('#deskHud .dh-chip[data-lane="golf"] .dh-title'); return [t.textContent, getComputedStyle(t).display]; })()`);
  expect(title).toEqual(["Port the export to the new API", "block"]);
  await shot("hover");
  expect(await page.evaluate(CLASHES)).toEqual([]);
  await page.s("Input.dispatchMouseEvent", { type: "mousePressed", x: at.x, y: at.y, button: "left", clickCount: 1 });
  await page.s("Input.dispatchMouseEvent", { type: "mouseReleased", x: at.x, y: at.y, button: "left", clickCount: 1 });
  await until(`document.querySelector("#card h3")?.textContent.includes("golf")`);
  await page.s("Input.dispatchMouseEvent", { type: "mouseMoved", x: 5, y: 5 });
  await until(`!document.querySelector("#deskHud .dh-chip.hot")`);
  expect(errors).toEqual([]);
}, SLOW);

test.skipIf(!chromeFound)("zoomed out, every chip is one compact line, and still none overlaps", async () => {
  // wheel out over a bare part of the world
  const at = await page.evaluate(`(() => { for (let y = 860; y > 100; y -= 20) for (let x = 470; x < 1400; x += 20) if (document.elementFromPoint(x, y)?.id === "world") return { x, y }; return null; })()`);
  expect(at).not.toBeNull();
  for (let i = 0; i < 6; i++) await page.s("Input.dispatchMouseEvent", { type: "mouseWheel", x: at.x, y: at.y, deltaX: 0, deltaY: 400 });
  await until(`document.getElementById("deskHud").dataset.mode === "compact"`);
  await Bun.sleep(1500);
  await shot("far");
  const chips = await page.evaluate(CHIPS);
  expect(chips.some((c: any) => c.shown)).toBe(true);
  for (const c of chips.filter((c: any) => c.shown)) expect({ lane: c.lane, compact: c.compact, oneLine: c.h < 26 }).toEqual({ lane: c.lane, compact: true, oneLine: true });
  expect(await page.evaluate(CLASHES)).toEqual([]);
  expect(errors).toEqual([]);
}, SLOW);
