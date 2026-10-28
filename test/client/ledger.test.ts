// The ask ledger on the page, in Chrome at 1440x900 against a temporary server: a question open in the reader updates
// in place when edited, with its EDITED tag, keeps the typed draft and drops a pick the edit removed; comments (latest
// 5, MORE for the rest) and checklist ticks show in the reader; the tier and priority menu in the reader's head moves
// it, and a locked one says why (a forced move gets the server's 409 in a toast); no console errors and no page
// scroll. Skipped without Chrome.
import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { findChrome, newSession, seed, startChrome, startServer } from "../../scripts/room-hash.ts";

const ROOT = join(import.meta.dir, "..", "..");
const chromeFound = !!findChrome();
const GH = mkdtempSync(join(tmpdir(), "hq-ledger-gh-"));
let chrome: Awaited<ReturnType<typeof startChrome>>;
let server: Awaited<ReturnType<typeof startServer>>;
let page: Awaited<ReturnType<typeof newSession>>;
let askId = 0;
const errors: string[] = [];
const until = async (expr: string, ms = 8000) => {
  for (const end = Date.now() + ms; Date.now() < end; await Bun.sleep(50)) if (await page.evaluate(expr).catch(() => false)) return true;
  throw new Error(`timed out waiting for ${expr}`);
};
// The question in the reader.
const card = () => `document.querySelector('#reader .askview[data-ask="${askId}"]')`;
const openAsk = (id: number) => page.evaluate(`(() => { const b = document.createElement("button"); b.dataset.read = "question:${id}"; document.body.append(b); b.click(); b.remove(); })()`);

beforeAll(async () => {
  if (!chromeFound) return;
  // No real GitHub: the server gets the fake gh, which knows no PRs.
  writeFileSync(join(GH, "gh.json"), "{}");
  chrome = await startChrome();
  server = await startServer(ROOT, { HUD_GH_BIN: join(ROOT, "test", "fake-gh.ts"), FAKE_GH_DATA: join(GH, "gh.json"), HUD_GITHUB_REPO: "example/repo" });
  askId = await seed(server.post);
  page = await newSession(chrome.cdp, errors);
  await page.s("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await page.s("Page.navigate", { url: `${server.base}/?world=off` });
  await until(`!!document.querySelector('#hud [data-ask="${askId}"]')`);
  await openAsk(askId);
  await until(`!!${card()}`);
}, 30_000);

afterAll(async () => {
  await server?.stop();
  await chrome?.close();
  rmSync(GH, { recursive: true, force: true });
});

test.skipIf(!chromeFound)("an edit updates the card in place, keeps the draft and drops a removed pick", async () => {
  await page.evaluate(`${card()}.querySelector('.opt[data-opt="No"]').click()`);
  await until(`${card()}.querySelector(".opt.sel")?.dataset.opt === "No"`);
  await page.evaluate(`(() => { const ta = ${card()}.querySelector("textarea"); ta.focus(); ta.value = "half typed"; ta.dispatchEvent(new Event("input", { bubbles: true })); })()`);
  await server.post(`/api/asks/${askId}/update`, { title: "Ship the thing today?", options: ["Yes", "Later"] });
  await until(`${card()}.querySelector(".rv-title").textContent === "Ship the thing today?"`);
  await until(`document.querySelector('#hud [data-ask="${askId}"] .st').textContent === "Ship the thing today?"`);
  await until(`/^EDITED \\d\\d:\\d\\d$/.test(${card()}.querySelector(".meta .tag.edited")?.textContent ?? "")`);
  expect(await page.evaluate(`[...${card()}.querySelectorAll(".opt")].map((o) => o.dataset.opt)`)).toEqual(["Yes", "Later"]);
  expect(await page.evaluate(`${card()}.querySelector(".opt.sel")`)).toBeNull();
  expect(await page.evaluate(`${card()}.querySelector("textarea").value`)).toBe("half typed");
  expect(await page.evaluate(`document.activeElement === ${card()}.querySelector("textarea")`)).toBe(true);
});

test.skipIf(!chromeFound)("comments and ticks show on the card, the latest five with MORE", async () => {
  await server.post(`/api/asks/${askId}/items`, { text: "Write the notes" });
  await server.post(`/api/asks/${askId}/items`, { text: "Land #4321" });
  await server.post(`/api/asks/${askId}/items/1`, { done: true });
  for (let i = 1; i <= 7; i++) await server.post(`/api/asks/${askId}/comment`, { text: `note ${i}` });
  await until(`${card()}.querySelectorAll(".ledger .lc").length === 5`);
  expect(await page.evaluate(`[...${card()}.querySelectorAll(".lc")].map((c) => c.textContent.slice(c.querySelector(".lat").textContent.length))`)).toEqual(["note 3", "note 4", "note 5", "note 6", "note 7"]);
  expect(await page.evaluate(`[...${card()}.querySelectorAll(".lchk li")].map((li) => [li.classList.contains("done"), li.textContent.trim()])`)).toEqual([[true, "✓Write the notes"], [false, "Land #4321"]]);
  expect(await page.evaluate(`${card()}.querySelectorAll(".lchk li")[1].querySelector("a").href`)).toBe("https://github.com/example/repo/pull/4321");
  // The ledger sits between the question and its answer: at the foot of the body (only the thread with the lane comes
  // after it), over the options.
  expect(await page.evaluate(`[${card()}.querySelector(".rv-body > .ledger + .ithread:last-child") !== null, ${card()}.querySelector(".rv-foot > .opts") !== null]`)).toEqual([true, true]);
  await page.evaluate(`${card()}.querySelector("[data-ledger-more]").click()`);
  await until(`${card()}.querySelectorAll(".lc").length === 7`);
  // An answer picked after all this still works, and the ledger survives the panel redrawing the card.
  await page.evaluate(`${card()}.querySelector('.opt[data-opt="Later"]').click()`);
  await until(`${card()}.querySelector(".opt.sel")?.dataset.opt === "Later"`);
  expect(await page.evaluate(`${card()}.querySelectorAll(".lc").length`)).toBe(7);
  expect(await page.evaluate(`!!${card()}.querySelector(".tag.edited")`)).toBe(true);
  expect(await page.evaluate(`document.documentElement.scrollHeight <= innerHeight && document.documentElement.scrollWidth <= innerWidth`)).toBe(true);
  expect(errors).toEqual([]);
});

// Tiers (docs/spec-3d-office.md B3, B7): a Blocking group above the Open one, each counted; a lane's locked ask reads
// "Blocking · <lane> waits" in the reader's menu, which has no tier button; the owner moves an unlocked one and changes
// its priority from the menu (E opens it). A move the server refuses (409, locked) shows in a toast.
test.skipIf(!chromeFound)("tiers: blocking group first, the lock, and the owner's tier and priority controls", async () => {
  const { id: locked } = await server.post("/api/asks", { lane: "golf", title: "Blocked on this", tier: "blocking", priority: "high" });
  await until(`!!document.querySelector('#hud [data-ask="${locked}"]')`);
  const groups = `[...document.querySelectorAll("#hud > .grp h4, #hud > .ask")].map((e) => e.matches("h4") ? e.textContent.trim() : Number(e.dataset.ask))`;
  const before = await page.evaluate(groups);
  expect(before[0]).toBe("Blocking 1");
  expect(before[1]).toBe(locked);
  expect(before[2]).toMatch(/^Open \d+$/);
  expect(await page.evaluate(`document.querySelector('#hud [data-ask="${locked}"] .tag.waits').textContent`)).toBe("golf waits");
  // The locked one in the reader: its chip, its lock, no tier button, and its priority.
  await openAsk(locked);
  const lockedCard = `document.querySelector('#reader .askview[data-ask="${locked}"]')`;
  await until(`!!${lockedCard}`);
  expect(await page.evaluate(`[${lockedCard}.querySelector(".tierchip").textContent, !!${lockedCard}.querySelector(".tierchip svg.lock"), !!${lockedCard}.querySelector(".tier-set"), ${lockedCard}.querySelector(".prio-set.on").dataset.prio, !!${lockedCard}.querySelector(".lockwhy")]`)).toEqual(["Blocking · golf waits", true, false, "high", true]);
  // A move sent anyway (as from a page that had not heard of the lock) is refused, and the toast says why.
  await page.evaluate(`(() => { const b = document.createElement("button"); b.className = "btn-s tier-set"; b.dataset.tier = "nonblocking"; ${lockedCard}.querySelector(".pop").append(b); b.click(); })()`);
  await until(`/locked as blocking/.test(document.querySelector(".toast")?.textContent ?? "")`);
  expect((await (await fetch(`${server.base}/api/state`)).json()).open.find((a: any) => a.id === locked).tier).toBe("blocking");
  // The owner promotes the ledger's question from its menu (M): it joins the blocking group, unlocked, and says who moved it.
  await openAsk(askId);
  await until(`!!${card()}`);
  await page.evaluate(`document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "m", bubbles: true }))`);
  await until(`!!${card()}.querySelector(".tiermenu[open] .tier-set")`);
  await page.evaluate(`${card()}.querySelector(".tier-set").click()`);
  await until(`(${groups})[0] === "Blocking 2"`);
  await until(`/^MOVED BY OWNER \\d\\d:\\d\\d$/.test(${card()}.querySelector(".moved")?.textContent ?? "")`);
  expect(await page.evaluate(`[${card()}.querySelector(".tier-set").textContent, ${card()}.querySelector(".tierchip").textContent, !!${card()}.querySelector(".tierchip svg.lock")]`)).toEqual(["MAKE NON-BLOCKING", "Blocking", false]);
  // Priority from the menu: urgent goes above the locked high one.
  await page.evaluate(`${card()}.querySelector('.prio-set[data-prio="urgent"]').click()`);
  await until(`(${groups})[1] === ${askId}`);
  expect(await page.evaluate(`${card()}.querySelector(".tiermenu summary .tag.prio").className`)).toBe("tag prio p0");
  // Esc closes the menu first, then the reader.
  const esc = `document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))`;
  await page.evaluate(esc);
  expect(await page.evaluate(`[!!${card()}.querySelector(".tiermenu[open]"), document.getElementById("reader").hidden]`)).toEqual([false, false]);
  await page.evaluate(esc);
  expect(await page.evaluate(`document.getElementById("reader").hidden`)).toBe(true);
  expect(errors.filter((e) => !e.includes("status of 409"))).toEqual([]); // the refused move above
});
