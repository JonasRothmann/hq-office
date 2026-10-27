// The + menu and threads in Chrome against a temporary server with the world off: every send box has the + menu
// (a file, an image, a link, a room's shelf); a link and a shelf item become cards; a file uploads and travels as a URL
// on this server, never a path; a dropped or pasted file goes to the item the keys target; a reply on a question goes
// to its lane and shows its delivery (DELIVERED, AWAY · KEPT, NOT DELIVERED, then RETRY); the lane's answer lands in
// the thread; an answered question reopens from the reader. Needs Chrome; skipped without it.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { chmodSync, existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { findChrome, newSession, seed, startChrome, startServer } from "../../scripts/room-hash.ts";

const ROOT = join(import.meta.dir, "..", "..");
const chromeFound = !!findChrome();
const STUB = mkdtempSync(join(tmpdir(), "hq-threads-page-"));
const FAIL = join(STUB, "fail"); // while it exists, a prompt to "flaky" fails
let chrome: Awaited<ReturnType<typeof startChrome>>;
let server: Awaited<ReturnType<typeof startServer>>;
let page: Awaited<ReturnType<typeof newSession>>;
const errors: string[] = [];
const ids: Record<string, number> = {};
const until = async (expr: string, ms = 10_000) => {
  for (const end = Date.now() + ms; Date.now() < end; await Bun.sleep(50)) if (await page.evaluate(expr).catch(() => false)) return true;
  throw new Error(`timed out waiting for ${expr}`);
};
const state = async () => (await fetch(`${server.base}/api/state`)).json();
const room = async (slug: string) => (await fetch(`${server.base}/api/rooms/${slug}`)).json();
const HELPERS = `
  window.open_ = (key) => { const b = document.createElement("button"); b.dataset.read = key; document.body.append(b); b.click(); b.remove(); };
  window.__pick = (sel, files) => {
    const input = document.querySelector(sel), dt = new DataTransfer();
    for (const f of files) dt.items.add(f);
    input.files = dt.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  };
  window.__type = (sel, text) => { const ta = document.querySelector(sel); ta.value = text; ta.dispatchEvent(new Event("input", { bubbles: true })); };
  window.__files = (name, text) => { const dt = new DataTransfer(); dt.items.add(new File([text], name, { type: "text/plain" })); return dt; };
  window.__drop = (el, dt) => {
    el.dispatchEvent(new DragEvent("dragover", { dataTransfer: dt, bubbles: true, cancelable: true }));
    const hint = document.querySelector(".drophint")?.textContent, lit = [...document.querySelectorAll(".dropping")].map((e) => e.dataset.key || e.dataset.composer || e.id);
    el.dispatchEvent(new DragEvent("drop", { dataTransfer: dt, bubbles: true, cancelable: true }));
    return { hint, lit };
  };
  window.__menu = () => { const m = document.querySelector(".amenu:popover-open"); return m && { key: m.closest(".attach").dataset.attachFor, items: [...m.querySelectorAll(":scope > .aitem")].map((i) => i.querySelector("span").textContent), inView: (() => { const r = m.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth; })() }; };
`;
const box = (sel: string) => `#reader .rview:not([hidden]) ${sel}`;
const key = async (k: string, mods = 0) => {
  for (const type of ["keyDown", "keyUp"]) await page.s("Input.dispatchKeyEvent", { type, key: k, code: k.length === 1 ? `Key${k.toUpperCase()}` : k, modifiers: mods, windowsVirtualKeyCode: k === "Escape" ? 27 : k.toUpperCase().charCodeAt(0) });
};

beforeAll(async () => {
  if (!chromeFound) return;
  // A herdr that knows HQ, golf, alpha and flaky; a prompt to flaky fails while FAIL exists. bravo is away.
  const herdr = join(STUB, "herdr");
  writeFileSync(herdr, `#!/bin/sh\ncase "$*" in\n  *"agent list"*) echo '{"result":{"agents":[{"name":"hq","agent_status":"idle","pane_id":"p0","agent":"claude"},{"name":"golf","agent_status":"working","pane_id":"p1","agent":"claude"},{"name":"alpha","agent_status":"idle","pane_id":"p2","agent":"claude"},{"name":"flaky","agent_status":"idle","pane_id":"p3","agent":"claude"}]}}' ;;\n  *"agent prompt flaky"*) if [ -e "${FAIL}" ]; then echo "pane closed" >&2; exit 1; fi ;;\nesac\nexit 0\n`);
  chmodSync(herdr, 0o755);
  chrome = await startChrome();
  server = await startServer(ROOT, { HERDR_BIN: herdr });
  ids.bravo = await seed(server.post);
  await server.post("/api/lanes", { name: "flaky", phase: "running", title: "Drops prompts", machine: "local" });
  await server.post("/api/sync", {});
  ids.golf = (await server.post("/api/asks", { lane: "golf", kind: "decision", title: "Which export path?", body: "## Options\n- COPY\n- SQLite", options: ["COPY", "SQLite"] })).id;
  ids.flaky = (await server.post("/api/asks", { lane: "flaky", kind: "decision", title: "Rotate the key?", options: ["Now", "Later"] })).id;
  ids.alpha = (await server.post("/api/asks", { lane: "alpha", kind: "decision", title: "Ship the migration tonight?", options: ["Yes", "Wait"] })).id;
  await server.post("/api/rooms", { slug: "nightly", title: "Nightly export", owner: "golf" });
  await server.post("/api/rooms/nightly/artifacts", { title: "Export benchmark", url: "https://example.com/bench" });
  page = await newSession(chrome.cdp, errors);
  await page.s("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await page.s("Page.navigate", { url: `${server.base}/?world=off` });
  await until(`!!document.querySelector("#hud .ask")`);
  await page.evaluate(HELPERS);
}, 30_000);

afterAll(async () => {
  await server?.stop();
  await chrome?.close();
  rmSync(STUB, { recursive: true, force: true });
});

describe.skipIf(!chromeFound)("attach and threads", () => {
  test("every send box has the + menu: a file, an image, a link, a room's shelf; ⌘U opens the target's", async () => {
    const seen: any[] = [];
    for (const item of [`question:${ids.golf}`, "update:1", "room:nightly", "tell"]) {
      await page.evaluate(`open_(${JSON.stringify(item)})`);
      await until(`!!document.querySelector(${JSON.stringify(box(".reply .aplus"))})?.offsetParent`);
      await page.evaluate(`document.querySelector(${JSON.stringify(box(".reply .aplus"))}).click()`);
      await until(`!!__menu()`);
      seen.push(await page.evaluate(`__menu()`));
      await page.evaluate(`document.querySelector(".amenu:popover-open").hidePopover()`);
    }
    expect(seen.map((m) => m.key)).toEqual([String(ids.golf), "upd:1", "room:nightly", "note"]);
    for (const m of seen) {
      expect(m.items).toEqual(["Upload a file", "Image or screenshot", "Link or artifact URL", "From a room's shelf"]);
      expect(m.inView).toBe(true);
    }
    // ⌘U with no field focused: the menu of the item the keys target (the reader, on a question).
    await page.evaluate(`open_("question:${ids.golf}")`);
    await page.evaluate(`document.activeElement?.blur(); document.querySelector("#reader").dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }))`);
    await key("u", 4);
    await until(`__menu()?.key === "${ids.golf}"`);
    await key("Escape");
    await until(`!__menu()`);
  });

  test("a link becomes a card; a file uploads and goes to the lane as a URL on this server, never a path", async () => {
    const k = String(ids.golf);
    await page.evaluate(`document.querySelector(${JSON.stringify(box(".aplus"))}).click()`);
    await page.evaluate(`document.querySelector(".amenu:popover-open [data-attach-link]").click()`);
    await page.evaluate(`document.querySelector(".amenu:popover-open [data-link-url]").value = "https://claude.ai/artifact/abc123"; document.querySelector(".amenu:popover-open [data-link-add]").click()`);
    await until(`!!document.querySelector('[data-chips="${k}"] .chip.acard.k-claude-artifact.done')`);
    expect(await page.evaluate(`document.querySelector('[data-chips="${k}"] .chip.acard small').textContent`)).toBe("Claude artifact");
    // The card shows: no other area's class hides it.
    expect(await page.evaluate(`(() => { const r = document.querySelector('[data-chips="${k}"] .chip.acard').getBoundingClientRect(); return r.width > 100 && r.height > 40; })()`)).toBe(true);
    await page.evaluate(`__pick('${box(`[data-attach="${k}"]:not([data-attach-image])`)}', [new File(["# Plan\\n"], "plan notes.md", { type: "text/markdown" })])`);
    await until(`!!document.querySelector('[data-chips="${k}"] .chip.acard.k-file.done')`);
    await page.evaluate(`__type(${JSON.stringify(box(".rcomp textarea"))}, "See these")`);
    await page.evaluate(`document.querySelector(${JSON.stringify(box("[data-reply-only]"))}).click()`);
    await until(`!!document.querySelector('#reader .ithread [data-tmsg] .seen.ok')`);
    const msg = (await room(`thread-q${ids.golf}`)).messages[0];
    expect(msg).toMatchObject({ who: "owner", to: "golf", delivery: "sent" });
    expect(msg.text).toMatch(new RegExp(`^See these https://claude\\.ai/artifact/abc123 \\[plan notes\\.md\\]\\(${server.base.replace(/\./g, "\\.")}/uploads/[\\w-]+-plan-notes\\.md\\)$`));
    expect(msg.text).not.toMatch(/\/(tmp|var|private|Users|home)\//);
    // The box and its tray clear; the question stays open.
    expect(await page.evaluate(`document.querySelector(${JSON.stringify(box(".rcomp textarea"))}).value`)).toBe("");
    expect(await page.evaluate(`document.querySelectorAll('[data-chips="${k}"] .chip').length`)).toBe(0);
    expect((await state()).open.some((a: any) => a.id === ids.golf)).toBe(true);
  });

  test("from a room's shelf: pick the room, then the item; it travels as its link", async () => {
    const k = String(ids.golf);
    await page.evaluate(`document.querySelector(${JSON.stringify(box(".aplus"))}).click()`);
    await page.evaluate(`document.querySelector(".amenu:popover-open [data-attach-shelf]").click()`);
    await until(`!!document.querySelector('.amenu:popover-open [data-shelf-room="nightly"]')`);
    await page.evaluate(`document.querySelector('.amenu:popover-open [data-shelf-room="nightly"]').click()`);
    await until(`!!document.querySelector(".amenu:popover-open [data-shelf-item]")`);
    await page.evaluate(`document.querySelector(".amenu:popover-open [data-shelf-item]").click()`);
    await until(`!!document.querySelector('[data-chips="${k}"] .chip.acard.k-link.done')`);
    expect(await page.evaluate(`!!__menu()`)).toBe(false);
    expect(await page.evaluate(`document.querySelector('[data-chips="${k}"] .chip.acard').textContent`)).toContain("Nightly export shelf");
    await page.evaluate(`document.querySelector(${JSON.stringify(box("[data-reply-only]"))}).click()`);
    await until(`document.querySelectorAll('#reader .ithread [data-tmsg]').length === 2`);
    expect((await room(`thread-q${ids.golf}`)).messages[1].text).toBe("[Export benchmark](https://example.com/bench)");
  });

  test("a dropped or pasted file goes to the item the keys target, and the page says which", async () => {
    // Nothing in the reader; J marks a card in the stack: that card is the target.
    await key("Escape");
    await until(`document.getElementById("reader").hidden`);
    await page.evaluate(`document.activeElement?.blur()`);
    let target = "";
    for (let i = 0; i < 8 && target !== `ask:${ids.alpha}`; i++) { await key("j"); target = await page.evaluate(`document.querySelector("#hud .item.target")?.dataset.key ?? ""`); }
    expect(target).toBe(`ask:${ids.alpha}`);
    const dropped = await page.evaluate(`__drop(document.querySelector("#topbar") ?? document.body, __files("dropped.txt", "from a drop"))`);
    expect(dropped.hint).toBe("Drop to attach to: Ship the migration tonight?");
    expect(dropped.lit).toEqual([`ask:${ids.alpha}`]);
    await page.evaluate(`document.dispatchEvent(new ClipboardEvent("paste", { clipboardData: __files("pasted.txt", "from a paste"), bubbles: true, cancelable: true }))`);
    // Both wait on that question's box, uploaded, and show when it opens.
    await page.evaluate(`open_("question:${ids.alpha}")`);
    await until(`document.querySelectorAll('[data-chips="${ids.alpha}"] .chip.acard.done').length === 2`);
    expect(await page.evaluate(`[...document.querySelectorAll('[data-chips="${ids.alpha}"] .chip.acard b')].map((b) => b.textContent)`)).toEqual(["dropped.txt", "pasted.txt"]);
    // With the reader the target, a drop anywhere goes to what it shows; a drop on another box goes to that box.
    await page.evaluate(`document.querySelector("#reader").dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }))`);
    const second = await page.evaluate(`__drop(document.body, __files("third.txt", "three"))`);
    expect(second.hint).toBe("Drop to attach to: Ship the migration tonight?");
    await until(`document.querySelectorAll('[data-chips="${ids.alpha}"] .chip.acard').length === 3`);
    await page.evaluate(`(() => { let b; while ((b = document.querySelector('[data-chips="${ids.alpha}"] [data-chip-rm]'))) b.click(); })()`);
    expect(await page.evaluate(`document.querySelectorAll('[data-chips="${ids.alpha}"] .chip').length`)).toBe(0);
  });

  test("a reply shows its delivery: DELIVERED, AWAY · KEPT, NOT DELIVERED, then RETRY delivers it", async () => {
    const reply = async (id: number, text: string) => {
      await page.evaluate(`open_("question:${id}")`);
      await until(`!!document.querySelector('#reader .askview[data-ask="${id}"] .rcomp textarea')`);
      await page.evaluate(`__type('#reader .askview .rcomp textarea', ${JSON.stringify(text)})`);
      await page.evaluate(`document.querySelector('#reader .askview [data-reply-only]').click()`);
      await until(`!!document.querySelector('#reader .ithread [data-tmsg]:last-child .seen:not(:empty)') && !document.querySelector('#reader .ithread [data-tmsg]:last-child').dataset.delivery.startsWith("sending")`);
      return page.evaluate(`[...document.querySelector('#reader .ithread [data-tmsg]:last-child .meta').children].map((c) => c.textContent).filter((t) => /DELIVERED|AWAY|RETRY|→/.test(t))`);
    };
    // The To chip names the lane, and says how it goes.
    await page.evaluate(`open_("question:${ids.bravo}")`);
    await until(`!!document.querySelector('#reader .askview .tobar select')`);
    expect(await page.evaluate(`[...document.querySelector('#reader .askview .tobar select').options].map((o) => o.value)`)).toEqual(["bravo", "hq"]);
    expect(await page.evaluate(`document.querySelector('#reader .askview .tobar .tostate').textContent`)).toContain("kept until the lane is back");
    expect(await reply(ids.bravo, "Is the second way safe?")).toEqual(["→ bravo", "AWAY · KEPT"]);
    writeFileSync(FAIL, "");
    expect(await reply(ids.flaky, "Why now?")).toEqual(["→ flaky", "NOT DELIVERED", "RETRY"]);
    rmSync(FAIL);
    await page.evaluate(`document.querySelector('#reader .ithread [data-thread-retry]').click()`);
    await until(`document.querySelector('#reader .ithread [data-tmsg]:last-child .seen')?.textContent === "DELIVERED"`);
    // The lane answers in the thread with hud room say; it shows, and the owner has seen it.
    await server.post(`/api/rooms/thread-q${ids.flaky}/say`, { text: "Because the old key leaked.", as: "flaky" });
    await until(`[...document.querySelectorAll('#reader .ithread .msg.lane .text')].some((t) => t.textContent.includes("old key leaked"))`);
    // The head says there is a thread, and takes you to it.
    expect(await page.evaluate(`document.querySelector("#reader .askview .rv-head [data-thread-jump]")?.textContent.startsWith("THREAD")`)).toBe(true);
    await until(`(async () => (await (await fetch("/api/rooms/thread-q${ids.flaky}")).json()).unread === 0)()`);
    // To HQ: the chip switches, and the reply goes to HQ.
    await page.evaluate(`(() => { const s = document.querySelector('#reader .askview .tobar select'); s.value = "hq"; s.dispatchEvent(new Event("change", { bubbles: true })); })()`);
    await until(`document.querySelector('#reader .askview .tobar .tostate').textContent.includes("HQ")`);
    expect(await reply(ids.flaky, "HQ, please confirm.")).toEqual(["→ HQ", "DELIVERED"]);
  });

  test("an answered question opens from Tell HQ with its answer and thread, and REOPEN opens it again", async () => {
    await server.post(`/api/asks/${ids.golf}/answer`, { answer: "COPY" });
    await page.evaluate(`open_("tell")`);
    await until(`!!document.querySelector('#log [data-read="question:${ids.golf}"]')`);
    await page.evaluate(`document.querySelector('#log [data-read="question:${ids.golf}"]').click()`);
    await until(`!!document.querySelector('#reader .askview[data-ask="${ids.golf}"] .answered')`);
    const shown = await page.evaluate(`(() => { const v = document.querySelector("#reader .askview"); return { answer: v.querySelector(".answered .md").textContent, tag: v.querySelector(".meta .tag.done")?.textContent, thread: v.querySelectorAll(".ithread [data-tmsg]").length, reopen: !!v.querySelector("[data-reopen]"), send: !!v.querySelector("[data-send]") }; })()`);
    expect(shown).toEqual({ answer: "COPY", tag: "ANSWERED", thread: 2, reopen: true, send: false });
    await page.evaluate(`document.querySelector("#reader .askview [data-reopen]").click()`);
    await until(`!!document.querySelector('#reader .askview[data-ask="${ids.golf}"] .opt')`);
    const s = await state();
    expect(s.open.find((a: any) => a.id === ids.golf)).toMatchObject({ status: "open", answer: null });
    await until(`document.querySelectorAll('#reader .ithread [data-tmsg]').length === 3`);
    expect(await page.evaluate(`document.querySelector('#reader .ithread [data-tmsg]:last-child .text').textContent`)).toContain('The answer "COPY" no longer stands');
    expect(errors).toEqual([]);
  });
});
