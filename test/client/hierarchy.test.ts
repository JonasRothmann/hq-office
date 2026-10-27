// The lane tree in the page: with no tree the worker card shows no path; with one it shows the lane's level and the
// chain up to HQ, each step selecting that lane; SETTINGS saves the level names and the card follows them. (The 3D
// office groups a team's offices in one wing: test/client/world-plan.test.ts.) Needs Chrome (CHROME_BIN); skipped
// without it.
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
// A sample tree: two managers, a lead under one, an engineer under the lead.
const TREE = [["web-pm", ""], ["data-pm", ""], ["api-lead", "web-pm"], ["api-auth", "api-lead"]];
const select = (lane: string) => page.evaluate(`(() => { const b = document.createElement("button"); b.dataset.select = ${JSON.stringify(lane)}; document.body.append(b); b.click(); b.remove(); })()`);

beforeAll(async () => {
  if (!chromeFound) return;
  chrome = await startChrome();
  server = await startServer(ROOT);
  for (const [name] of TREE) await server.post("/api/lanes", { name, machine: "local" });
  page = await newSession(chrome.cdp, errors);
  await page.s("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await page.s("Page.navigate", { url: `${server.base}/?world=off` });
  await until(`!!document.getElementById("card")?.innerHTML`);
}, 30_000);

afterAll(async () => {
  await server?.stop();
  await chrome?.close();
});

test.skipIf(!chromeFound)("with no tree, the card shows no path", async () => {
  await select("web-pm");
  await until(`document.querySelector("#card h3")?.textContent === "web-pm"`);
  expect(await page.evaluate(`!!document.querySelector("#card .path")`)).toBe(false);
});

test.skipIf(!chromeFound)("with a tree, the card shows the level and the path, and a step selects that lane", async () => {
  for (const [name, parent] of TREE) if (parent) await server.post("/api/lanes", { name, parent });
  await select("api-auth");
  await until(`document.querySelector("#card h3")?.textContent === "api-auth" && !!document.querySelector("#card .path")`);
  expect(await page.evaluate(`document.querySelector("#card .path .level").textContent`)).toBe("ENGINEER");
  expect(await page.evaluate(`document.querySelector("#card .path .chain").textContent`)).toBe("HQ > web-pm > api-lead > api-auth");
  await page.evaluate(`document.querySelector('#card .path [data-select="web-pm"]').click()`);
  await until(`document.querySelector("#card h3")?.textContent === "web-pm"`);
  expect(await page.evaluate(`document.querySelector("#card .path .level").textContent`)).toBe("MANAGER");
  expect(errors).toEqual([]);
});

test.skipIf(!chromeFound)("SETTINGS saves the level names, and the card follows them", async () => {
  await page.evaluate(`document.getElementById("settingsBtn").click()`);
  await until(`!!document.querySelector("[data-levels]")`);
  await page.evaluate(`(() => { const f = document.querySelector("[data-levels]"); f.elements.levels.value = " PM ,Senior,, Junior "; f.requestSubmit(); })()`);
  for (let i = 0; i < 100 && (await (await fetch(`${server.base}/api/settings`)).json()).settings.levels !== "PM, Senior, Junior"; i++) await Bun.sleep(50);
  expect((await (await fetch(`${server.base}/api/settings`)).json()).settings.levels).toBe("PM, Senior, Junior");
  await until(`document.querySelector("#card .path .level")?.textContent === "PM"`);
  expect(errors).toEqual([]);
});
