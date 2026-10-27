// The leads: a question a lane's lead holds sits under With leads, not in Needs you, and the owner can answer it on its
// card. The owner's own question stays counted. Needs Chrome (CHROME_BIN); skipped without it. A throwaway server on a
// spare port, the world off.
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

beforeAll(async () => {
  if (!chromeFound) return;
  chrome = await startChrome();
  server = await startServer(ROOT);
  await server.post("/api/lanes", { name: "alpha", phase: "running", title: "x", machine: "local" });
  await server.post("/api/lanes", { name: "kid", machine: "local", parent: "alpha" });
  // alpha's herdr status is read, so it is a lead the ask can be routed to.
  await server.post("/api/sync", {});
  page = await newSession(chrome.cdp, errors);
  await page.s("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
}, 60_000);
afterAll(async () => { await server?.stop(); await chrome?.close(); });

test.skipIf(!chromeFound)("a lead's question sits under With leads, is not in Needs you, and the owner answers it on its card", async () => {
  const lead = await server.post("/api/asks", { lane: "kid", title: "Retry budget for the queue?", to: "lead", options: ["3", "5"] });
  expect(lead.holder).toBe("alpha");
  const L = lead.id as number;
  const O = (await server.post("/api/asks", { lane: "alpha", title: "Owner question" })).id as number;
  await page.s("Page.navigate", { url: `${server.base}/?world=off` });
  await until(`!!document.querySelector('#hud .ask[data-ask="${L}"]') && !!document.querySelector('#hud .ask[data-ask="${O}"]')`);
  const card = (id: number) => `document.querySelector('#hud .ask[data-ask="${id}"]')`;
  const leads = `document.querySelector("#hud .grp.leads")`;
  // The With leads header comes after the owner's own question, and counts the one lead-held question.
  expect(await page.evaluate(`${leads}.querySelector("h4").textContent.trim()`)).toBe("With leads 1");
  expect(await page.evaluate(`!!(${card(O)}.compareDocumentPosition(${leads}) & Node.DOCUMENT_POSITION_FOLLOWING)`)).toBe(true);
  // The lead's card names the lead and says when it comes to the owner; Needs you counts only the owner's question.
  const lc = card(L);
  expect(await page.evaluate(`${lc}.classList.contains("held")`)).toBe(true);
  expect(await page.evaluate(`${lc}.querySelector(".tag.lead").textContent`)).toContain("alpha");
  expect(await page.evaluate(`${lc}.querySelector(".tolead").textContent`)).toContain("to you at");
  await until(`document.getElementById("fNeeds").textContent === "1"`);
  // The owner answers the lead's card: pick the option, then SEND.
  await page.evaluate(`${lc}.querySelector('.opt[data-opt="3"]').click()`);
  await until(`${lc}.querySelector(".opt.sel")?.dataset.opt === "3"`);
  await until(`${lc}.querySelector("[data-quick]").disabled === false`);
  await page.evaluate(`${lc}.querySelector("[data-quick]").click()`);
  await until(`!${lc}`);
  const answered = (await state()).answered.find((a: any) => a.id === L);
  expect(answered?.answer).toBe("3");
  expect(answered?.answered_by).toBeNull();
  expect(await page.evaluate(`document.getElementById("fNeeds").textContent`)).toBe("1");
}, 60_000);

test.skipIf(!chromeFound)("no page errors", () => {
  expect(errors).toEqual([]);
});
