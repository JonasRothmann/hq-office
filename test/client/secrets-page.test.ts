// Secrets on the page, in Chrome against a temporary server: a value typed into a question that asks for one, or into
// Tell HQ's drop, never reaches the page's markup, sessionStorage or localStorage (not even across a reload), is
// cleared from its field on send, and reaches the server, which lists only its name. Skipped without Chrome.
import { afterAll, beforeAll, expect, test } from "bun:test";
import { join } from "node:path";
import { findChrome, newSession, startChrome, startServer } from "../../scripts/room-hash.ts";

const ROOT = join(import.meta.dir, "..", "..");
const chromeFound = !!findChrome();
let chrome: Awaited<ReturnType<typeof startChrome>>;
let server: Awaited<ReturnType<typeof startServer>>;
let page: Awaited<ReturnType<typeof newSession>>;
let askId = 0;
const errors: string[] = [];
const VALUE = "sk-test-0123456789-do-not-show";
const until = async (expr: string, ms = 8000) => {
  for (const end = Date.now() + ms; Date.now() < end; await Bun.sleep(50)) if (await page.evaluate(expr).catch(() => false)) return true;
  throw new Error(`timed out waiting for ${expr}`);
};
const open = (key: string) => page.evaluate(`(() => { const b = document.createElement("button"); b.dataset.read = ${JSON.stringify(key)}; document.body.append(b); b.click(); b.remove(); })()`);
// Everywhere the page could keep it: its markup (attributes included) and both storages.
const LEAKS = `[document.documentElement.outerHTML.includes(${JSON.stringify(VALUE)}), JSON.stringify({ ...sessionStorage }).includes(${JSON.stringify(VALUE)}), JSON.stringify({ ...localStorage }).includes(${JSON.stringify(VALUE)})]`;
const type = (sel: string, value: string) => page.evaluate(`(() => { const i = document.querySelector(${JSON.stringify(sel)}); i.value = ${JSON.stringify(value)}; i.dispatchEvent(new Event("input", { bubbles: true })); })()`);

beforeAll(async () => {
  if (!chromeFound) return;
  chrome = await startChrome();
  server = await startServer(ROOT);
  await server.post("/api/lanes", { name: "alpha", machine: "local" });
  ({ id: askId } = await server.post("/api/asks", { lane: "alpha", kind: "decision", title: "Need the test key", secrets: ["TEST_KEY"] }));
  page = await newSession(chrome.cdp, errors);
  await page.s("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await page.s("Page.navigate", { url: `${server.base}/?world=off` });
  await until(`!!document.querySelector('#hud [data-ask="${askId}"]')`);
}, 30_000);

afterAll(async () => {
  await server?.stop();
  await chrome?.close();
});

test.skipIf(!chromeFound)("a question's secret: in memory only, through a reload, then sent and cleared", async () => {
  // a question for secrets is never answered from the stack
  expect(await page.evaluate(`document.querySelector('#hud [data-ask="${askId}"]').classList.contains("short")`)).toBe(false);
  await open(`question:${askId}`);
  await until(`!!document.querySelector('#reader .askview [data-secret="TEST_KEY"]')`);
  expect(await page.evaluate(`document.querySelector('#reader .askview [data-secret="TEST_KEY"]').type`)).toBe("password");
  await type('#reader .askview [data-secret="TEST_KEY"]', VALUE);
  // a re-render of the question keeps the typed value in the field, not in the markup
  await server.post(`/api/asks/${askId}/comment`, { text: "Any key with read access." });
  await until(`document.querySelector("#reader .askview .ledger").textContent.includes("Any key")`);
  expect(await page.evaluate(`document.querySelector('#reader .askview [data-secret="TEST_KEY"]').value`)).toBe(VALUE);
  expect(await page.evaluate(`(async () => { (await import("/src/client/inbox/drafts.js")).keepDrafts(); return ${LEAKS}; })()`)).toEqual([false, false, false]);
  // a reload loses it (it was never stored), and the reader opens on the question again
  await page.evaluate(`location.reload()`);
  await until(`!!document.querySelector('#reader .askview [data-secret="TEST_KEY"]')`);
  expect(await page.evaluate(`document.querySelector('#reader .askview [data-secret="TEST_KEY"]').value`)).toBe("");
  expect(await page.evaluate(LEAKS)).toEqual([false, false, false]);
  await type('#reader .askview [data-secret="TEST_KEY"]', VALUE);
  await until(`!document.querySelector("#reader .askview [data-send]").disabled`);
  await page.evaluate(`document.querySelector("#reader .askview [data-send]").click()`);
  await until(`!document.querySelector('#hud [data-ask="${askId}"]')`);
  const s = await (await fetch(`${server.base}/api/state`)).json();
  expect(s.secrets.map((x: any) => x.name)).toEqual(["TEST_KEY"]);
  expect(JSON.stringify(s)).not.toContain(VALUE);
  expect(await page.evaluate(LEAKS)).toEqual([false, false, false]);
});

test.skipIf(!chromeFound)("Tell HQ's drop: the value goes out once, the field is cleared, the list shows the name", async () => {
  await open("tell");
  await until(`!document.getElementById("tellView").hidden`);
  await page.evaluate(`document.getElementById("secName").value = "DROP_KEY"; document.getElementById("secValue").value = ${JSON.stringify(VALUE)}; document.getElementById("secretForm").requestSubmit()`);
  expect(await page.evaluate(`document.getElementById("secValue").value`)).toBe("");
  await until(`!!document.querySelector('#secretList [data-secret-row="DROP_KEY"]')`);
  expect(await page.evaluate(LEAKS)).toEqual([false, false, false]);
  expect(JSON.stringify(await (await fetch(`${server.base}/api/state`)).json())).not.toContain(VALUE);
  expect(errors).toEqual([]);
});
