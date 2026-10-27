// The office on the @hq/world engine (OFFICE: new, D18) on the real page, in Chrome with WebGL on SwiftShader, against
// a temporary server: the setting mounts the engine instead of the classic renderer; a lane added through the API
// joins with world.apply (the same WebGL context, the same engine, and the workers already there keep their places);
// a click on a worker selects its lane and opens its card; Q turns the office; the desk chips sit over their desks;
// OUTSIDE puts the town or the valley round it, and switches between them on the same page and context. Needs Chrome.
import { afterAll, beforeAll, expect, test } from "bun:test";
import { join } from "node:path";
import { findChrome, newSession, startChrome, startServer } from "../../scripts/room-hash.ts";

const ROOT = join(import.meta.dir, "..", "..");
const chromeFound = !!findChrome();
let chrome: Awaited<ReturnType<typeof startChrome>>;
let server: Awaited<ReturnType<typeof startServer>>;
let page: Awaited<ReturnType<typeof newSession>>;
const errors: string[] = [];
// SwiftShader draws on the CPU: under load a frame can take a second, so waits are long.
const until = async (expr: string, ms = 150_000) => {
  for (const end = Date.now() + ms; Date.now() < end; await Bun.sleep(150)) if (await page.evaluate(expr).catch(() => false)) return true;
  throw new Error(`timed out waiting for ${expr}: ${JSON.stringify(await page.evaluate("window.__world?.inspect?.()").catch((e) => String(e)))}`);
};
const name = (i: number) => `lane-${String(i).padStart(2, "0")}`;
// Lanes in phase "waiting" sit at their desks whatever herdr says, so every worker is there to click.
const addLane = (i: number) => server.post("/api/lanes", { name: name(i), phase: "waiting", title: `Lane ${i}`, machine: "local" });
const key = async (k: string) => {
  const one = k.length === 1, code = one ? `Key${k.toUpperCase()}` : k;
  await page.s("Input.dispatchKeyEvent", { type: "keyDown", key: k, code, ...(one ? { text: k } : {}) });
  await page.s("Input.dispatchKeyEvent", { type: "keyUp", key: k, code });
};

beforeAll(async () => {
  if (!chromeFound) return;
  chrome = await startChrome({ webgl: true });
  server = await startServer(ROOT);
  // the plain lot, as these tests were written for; the last test puts the land round it
  await server.post("/api/settings", { settings: { office: "new", outside: "off" } });
  for (let i = 0; i < 2; i++) await addLane(i);
  await server.post(`/api/lanes/${name(0)}/vitals`, { model: "claude-opus-5-5", effort: "high", subagents: 2, contextUsed: 90_000, contextMax: 200_000 });
  page = await newSession(chrome.cdp, errors);
  await page.s("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await page.s("Page.navigate", { url: `${server.base}/` });
  // a fresh browser waits for the server's settings, so it mounts the new office at once
  await until(`window.__world?.inspect?.().renderer === "new" && __world.desks.length === 2`, 300_000);
}, 400_000);

afterAll(async () => {
  await server?.stop();
  await chrome?.close();
});

test.skipIf(!chromeFound)("OFFICE new mounts the engine on #world and draws the generated office", async () => {
  // drawn, with lane-00's two subagents as balls round its desk
  await until(`__world.inspect().frames > 0 && __world.inspect().engine.draws > 0 && __world.inspect().balls === 2`);
  const got = await page.evaluate(`(() => {
    const files = performance.getEntriesByType("resource").map((r) => new URL(r.name).pathname);
    return { engine: files.includes("/packages/world/src/index.js"), classic: files.includes("/src/client/world/world.js"), stage: __world.stage, rooms: __world.rooms, characters: __world.inspect().engine.characters };
  })()`);
  expect(got.engine).toBe(true);
  expect(got.classic).toBe(false);
  expect(got.stage).toBe("studio");
  expect(got.rooms).toEqual([{ id: "room:0", team: null, lanes: [name(0), name(1)] }]);
  expect(got.characters).toBe(3); // two lanes and HQ
  expect(errors).toEqual([]);
}, 240_000);

test.skipIf(!chromeFound)("a lane added through the API joins without a rebuild: same context, same engine, workers keep their places", async () => {
  // every worker in its chair, typing: only then is a place a place
  await until(`!__world.inspect().turning && __world.desks.every((l) => __world.worker(l)?.step === "loop")`);
  const before = await page.evaluate(`(() => {
    window.__gl = document.getElementById("world").getContext("webgl2");
    return { renders: __world.inspect().engine.stats.renders, at: [${JSON.stringify(name(0))}, ${JSON.stringify(name(1))}].map((l) => __world.worker(l).at) };
  })()`);
  await addLane(2);
  // the engine's counters go on from where they were: it was not made again
  await until(`__world.desks.length === 3 && __world.inspect().engine.characters === 4 && __world.inspect().engine.stats.renders > ${before.renders}`);
  const after = await page.evaluate(`(() => ({
    same: window.__gl === document.getElementById("world").getContext("webgl2"),
    renders: __world.inspect().engine.stats.renders,
    at: [${JSON.stringify(name(0))}, ${JSON.stringify(name(1))}].map((l) => __world.worker(l).at),
    rooms: __world.rooms.length,
  }))()`);
  expect(after.same).toBe(true);
  expect(after.at).toEqual(before.at);
  expect(after.rooms).toBe(1);
  expect(errors).toEqual([]);
}, 240_000);

test.skipIf(!chromeFound)("clicking a worker selects its lane and opens its card", async () => {
  const target = await page.evaluate(`(() => {
    const c = document.getElementById("world");
    for (const lane of __world.desks) {
      const w = __world.worker(lane);
      if (w && w.visible && document.elementFromPoint(w.x, w.y) === c) return { lane, x: w.x, y: w.y };
    }
    return null;
  })()`);
  expect(target).not.toBeNull();
  for (const type of ["mousePressed", "mouseReleased"]) await page.s("Input.dispatchMouseEvent", { type, x: target.x, y: target.y, button: "left", clickCount: 1 });
  await until(`document.querySelector("#card h3")?.textContent === ${JSON.stringify(target.lane)} && !document.getElementById("card").hasAttribute("data-closed")`);
  await until(`__world.worker(${JSON.stringify(target.lane)}).selected && __world.inspect().selected === ${JSON.stringify(target.lane)}`);
  await key("Escape");
  await until(`document.getElementById("card").hasAttribute("data-closed")`);
  expect(errors).toEqual([]);
}, 240_000);

test.skipIf(!chromeFound)("Q turns the office a quarter, and the cut walls follow", async () => {
  const cutBefore = await page.evaluate(`__world.walls("room:0").map((s) => s.side + s.cut.every(Boolean)).join(" ")`);
  expect(await page.evaluate(`__world.rotation`)).toBe(0);
  await key("q");
  await until(`__world.rotation === 3 && !__world.inspect().turning`);
  expect(await page.evaluate(`__world.walls("room:0").map((s) => s.side + s.cut.every(Boolean)).join(" ")`)).not.toBe(cutBefore);
  await key("e");
  await until(`__world.rotation === 0 && !__world.inspect().turning`);
  expect(errors).toEqual([]);
}, 240_000);

test.skipIf(!chromeFound)("the desk chips sit over their desks, clear of the stack", async () => {
  await until(`document.querySelector("#deskHud[data-live]") && [...document.querySelectorAll("#deskHud .dh-chip")].filter((c) => !c.hidden).length === 3`);
  const chips = await page.evaluate(`import("/src/client/world/api.js").then((api) => {
    const c = document.getElementById("world").getBoundingClientRect();
    const desk = document.querySelector(".desk").getBoundingClientRect();
    return [...document.querySelectorAll("#deskHud .dh-chip:not([hidden])")].map((el) => {
      const r = el.getBoundingClientRect(), p = api.project(api.deskAnchor(el.dataset.lane));
      return { lane: el.dataset.lane, dx: Math.abs(r.left + r.width / 2 - (c.left + p.x)), dy: Math.abs(r.bottom - (c.top + p.y)), clear: r.left >= desk.right || r.top >= desk.bottom };
    });
  })`);
  expect(chips.map((c: any) => c.lane).sort()).toEqual([name(0), name(1), name(2)]);
  for (const c of chips) {
    expect(c.clear).toBe(true);
    expect(c.dx + c.dy).toBeLessThan(160); // within the placer's reach of its desk's anchor
  }
  expect(errors).toEqual([]);
}, 240_000);

test.skipIf(!chromeFound)("OUTSIDE city puts the town round the office within the draw budget; nature swaps it on the same page and context", async () => {
  await page.evaluate(`(() => { window.__gl = document.getElementById("world").getContext("webgl2"); window.__samePage = true; })()`);
  await server.post("/api/settings", { settings: { outside: "city" } });
  await until(`__world.inspect().outside?.mode === "city" && __world.inspect().outside.pieces > 1000`);
  const before = await page.evaluate(`__world.inspect().engine.stats.renders`);
  await until(`__world.inspect().engine.stats.renders > ${before}`); // a frame drawn with the town in it
  const city = await page.evaluate(`(() => { const i = __world.inspect(); return { draws: i.engine.draws, pieces: i.outside.pieces, movers: i.outside.movers, id: i.outside.mode }; })()`);
  expect(city.draws).toBeGreaterThan(0);
  expect(city.draws).toBeLessThan(220);
  expect(city.movers).toBeGreaterThan(0); // traffic, walkers, boats

  await server.post("/api/settings", { settings: { outside: "nature" } });
  await until(`__world.inspect().outside?.mode === "nature"`);
  const nature = await page.evaluate(`(() => ({
    same: window.__gl === document.getElementById("world").getContext("webgl2"),
    page: window.__samePage === true,
    pieces: __world.inspect().outside.pieces,
    draws: __world.inspect().engine.draws,
  }))()`);
  expect(nature.same).toBe(true);
  expect(nature.page).toBe(true);
  expect(nature.pieces).not.toBe(city.pieces);
  expect(nature.draws).toBeLessThan(220);
  expect(errors).toEqual([]);
}, 300_000);
