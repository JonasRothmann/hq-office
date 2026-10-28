// The glass shell never covers a question (spec outcome F10): at 1440x900 and 1280x800, light and dark, with a
// question open in the reader and the worker card and the settings sheet open, the centre of every open question card
// in the stack is the topmost element at its point, and so are the reader's head, body and foot; no other panel
// overlaps the stack or the reader, and the page does not scroll. The theme control cycles system, light
// and dark, sets <html data-theme> and tells the bus. Needs Chrome (CHROME_BIN to point at one); skipped without it.
import { afterAll, beforeAll, expect, test } from "bun:test";
import { join } from "node:path";
import { findChrome, newSession, seed, startChrome, startServer } from "../../scripts/room-hash.ts";

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

// For each open question card: brought into its list's view, is the element at its centre inside it?
const CARDS_ON_TOP = `(async () => {
  const out = [];
  for (const card of document.querySelectorAll("#hud .ask")) {
    card.scrollIntoView({ block: "center" });
    await new Promise(requestAnimationFrame);
    const r = card.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
    const hit = document.elementFromPoint(x, y);
    out.push({ ask: card.dataset.ask, onTop: !!hit && card.contains(hit), hit: hit ? hit.tagName + "." + hit.className : null });
  }
  return out;
})()`;
// The reader's parts: the element at the centre of each is inside it.
const READER_ON_TOP = `(() => [...document.querySelectorAll("#reader .rview:not([hidden]) > *")].map((part) => {
  const r = part.getBoundingClientRect(), hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  return { part: part.className, onTop: !!hit && part.contains(hit), hit: hit ? hit.tagName + "." + hit.className : null };
}))()`;
// Every other panel that shows: none of them may overlap the stack, or the reader.
const OVERLAPS = (box: string, others: string[]) => `(() => {
  const d = document.querySelector(${JSON.stringify(box)}).getBoundingClientRect();
  const panels = ${JSON.stringify(others)}.flatMap((s) => [...document.querySelectorAll(s)]);
  return panels.filter((p) => { const r = p.getBoundingClientRect(); return r.width && r.height && getComputedStyle(p).display !== "none" && !(r.right <= d.left || r.left >= d.right || r.bottom <= d.top || r.top >= d.bottom); }).map((p) => p.id || p.className);
})()`;
const NO_SCROLL = `document.documentElement.scrollHeight <= innerHeight && document.documentElement.scrollWidth <= innerWidth`;

beforeAll(async () => {
  if (!chromeFound) return;
  chrome = await startChrome();
  server = await startServer(ROOT);
  await seed(server.post);
  // Blocking (locked, high) and non-blocking asks, so both groups show.
  await server.post("/api/asks", { lane: "golf", kind: "decision", tier: "blocking", priority: "high", title: "Which database for the export?", body: "The lane cannot go on with the export until this is decided.", options: ["Postgres", "SQLite"] });
  await server.post("/api/asks", { lane: "alpha", kind: "info", priority: "low", title: "FYI: the nightly run moved" });
  page = await newSession(chrome.cdp, errors);
  await page.s("Network.setBlockedURLs", { urls: ["*fonts.googleapis.com*", "*fonts.gstatic.com*"] });
}, 40_000);

afterAll(async () => {
  await server?.stop();
  await chrome?.close();
});

for (const [width, height] of [[1440, 900], [1280, 800]]) {
  for (const scheme of ["light", "dark"]) {
    test.skipIf(!chromeFound)(`${width}x${height} ${scheme}: every question card is on top, nothing overlaps the column, no page scroll`, async () => {
      await page.s("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });
      await page.s("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: scheme }] });
      await page.s("Page.navigate", { url: `${server.base}/?world=off` });
      await until(`document.querySelectorAll("#hud .ask").length === 4 && !!document.getElementById("card").innerHTML`);
      expect(await page.evaluate(`document.documentElement.dataset.theme`)).toBe(scheme);
      expect(await page.evaluate(`[...document.querySelectorAll("#hud .grp h4")].map((h) => h.textContent.trim())`)).toEqual(["Blocking 1", "Open 3", "From HQ 1"]);
      // a question in the reader, with the worker card and the settings sheet open
      await page.evaluate(`document.querySelector('#hud .ask[data-lane="bravo"]').click()`);
      await until(`!document.getElementById("reader").hidden && !!document.querySelector('#reader .askview .lname[data-select="bravo"]')`);
      await page.evaluate(`document.querySelector('#reader .askview .lname[data-select="bravo"]').click(); document.getElementById("settingsBtn").click()`);
      expect(await page.evaluate(`getComputedStyle(document.getElementById("card")).display !== "none" && !document.getElementById("settings").hidden`)).toBe(true);
      const cards = await page.evaluate(CARDS_ON_TOP);
      expect(cards).toHaveLength(4);
      for (const c of cards) expect(c).toMatchObject({ onTop: true });
      const parts = await page.evaluate(READER_ON_TOP);
      expect(parts.map((p: any) => p.part)).toEqual(["rv-head", "rv-body", "rv-foot"]);
      for (const p of parts) expect(p).toMatchObject({ onTop: true });
      expect(await page.evaluate(OVERLAPS(".desk", [".top", "#reader", "#card", ".pill", "#settings", ".hqdown"]))).toEqual([]);
      expect(await page.evaluate(OVERLAPS("#reader", [".top", ".desk", "#card", ".pill", "#settings", ".hqdown"]))).toEqual([]);
      expect(await page.evaluate(NO_SCROLL)).toBe(true);
      expect(errors).toEqual([]);
    });
  }
}

test.skipIf(!chromeFound)("the theme control cycles system, light and dark, keeps the choice and tells the bus", async () => {
  await page.s("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await page.s("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "light" }] });
  await page.evaluate(`localStorage.removeItem("hq-theme")`);
  await page.s("Page.navigate", { url: `${server.base}/?world=off` });
  await until(`!!document.querySelector("#themeBtn svg")`);
  await page.evaluate(`(async () => { const { on } = await import("/src/client/core/bus.js"); window.__themes = []; on("theme", (t) => window.__themes.push(t)); })()`);
  const bg = `getComputedStyle(document.body).color`;
  const lightText = await page.evaluate(bg);
  expect(await page.evaluate(`document.documentElement.dataset.theme`)).toBe("light");
  await page.evaluate(`document.getElementById("themeBtn").click()`); // system -> light: no change in effect
  expect(await page.evaluate(`[localStorage.getItem("hq-theme"), document.documentElement.dataset.theme, window.__themes.join()]`)).toEqual(["light", "light", ""]);
  await page.evaluate(`document.getElementById("themeBtn").click()`); // light -> dark
  expect(await page.evaluate(`[localStorage.getItem("hq-theme"), document.documentElement.dataset.theme, window.__themes.join()]`)).toEqual(["dark", "dark", "dark"]);
  expect(await page.evaluate(bg)).not.toBe(lightText);
  // the system's own change does not override a picked theme
  await page.s("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "light" }] });
  await page.s("Page.navigate", { url: `${server.base}/?world=off` });
  await until(`!!document.querySelector("#themeBtn svg")`);
  expect(await page.evaluate(`document.documentElement.dataset.theme`)).toBe("dark");
  await page.evaluate(`(async () => { const { on } = await import("/src/client/core/bus.js"); window.__themes = []; on("theme", (t) => window.__themes.push(t)); })()`);
  await page.evaluate(`document.getElementById("themeBtn").click()`); // dark -> system (light)
  expect(await page.evaluate(`[localStorage.getItem("hq-theme"), document.documentElement.dataset.theme, window.__themes.join()]`)).toEqual([null, "light", "light"]);
  // following the system: its change reaches the page and the bus
  await page.s("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "dark" }] });
  await until(`document.documentElement.dataset.theme === "dark"`);
  expect(await page.evaluate(`window.__themes.join()`)).toBe("light,dark");
  const { effective } = await page.evaluate(`(async () => ({ effective: (await import("/src/client/theme/index.js")).effectiveTheme() }))()`);
  expect(effective).toBe("dark");
  expect(errors).toEqual([]);
});
