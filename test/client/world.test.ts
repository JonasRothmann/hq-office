// The 3D office on the real page, in Chrome with WebGL on SwiftShader, against a temporary server: one office per
// lane as the company grows from a studio to a campus (spec F3), the WebGL canvas drawing it, the walls nearest the
// camera cut down to the kerb and recomputed after a quarter turn (F4), a click on a worker opening its card and Esc
// closing it (F9), the office resting while a conference room covers it, and no console errors. Needs Chrome.
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
const until = async (expr: string, ms = 60_000) => {
  for (const end = Date.now() + ms; Date.now() < end; await Bun.sleep(100)) if (await page.evaluate(expr).catch(() => false)) return true;
  throw new Error(`timed out waiting for ${expr}: ${JSON.stringify(await page.evaluate("window.__world?.inspect?.()").catch((e) => String(e)))}`);
};
const name = (i: number) => `lane-${String(i).padStart(2, "0")}`;
let added = 0;
// Lanes in phase "waiting" sit at their desks whatever herdr says, so every worker is there to click.
const grow = async (n: number) => {
  for (; added < n; added++) await server.post("/api/lanes", { name: name(added), phase: "waiting", title: `Lane ${added}`, machine: "local" });
};

beforeAll(async () => {
  if (!chromeFound) return;
  chrome = await startChrome({ webgl: true });
  server = await startServer(ROOT);
  await grow(1);
  page = await newSession(chrome.cdp, errors);
  await page.s("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await page.s("Page.navigate", { url: `${server.base}/` });
  await until(`window.__world?.offices?.length === 1`);
}, 120_000);

afterAll(async () => {
  await server?.stop();
  await chrome?.close();
});

test.skipIf(!chromeFound)("one office per lane, more offices as the company grows, and the canvas draws them", async () => {
  for (const [n, stage] of [[1, "studio"], [4, "floor"], [9, "wings"], [18, "campus"]] as const) {
    await grow(n);
    await until(`__world.offices.length === ${n} && __world.stage === "${stage}"`);
    expect(await page.evaluate("__world.offices.slice().sort()")).toEqual(Array.from({ length: n }, (_, i) => name(i)));
  }
  // drawn: frames came, with every office's geometry in them
  await until(`__world.inspect().frames > 3 && __world.inspect().triangles > 50000`);
  expect(errors).toEqual([]);
}, 240_000);

// For each office: the two sides whose middle is nearest the camera (its ground point along the view) must be cut to
// the kerb; the far sides that are the building's outer walls stand at full height, unless one would hide a room
// behind it (the HQ suite behind the first office), as in the reference.
const WALLS = `(() => {
  const az = __world.inspect().azimuth;
  const toward = (m) => m.x * Math.sin(az) + m.z * Math.cos(az);
  return __world.offices.map((lane) => {
    const sides = __world.walls(lane).sort((a, b) => toward(b.mid) - toward(a.mid));
    return { lane, near: sides.slice(0, 2).map((s) => ({ side: s.side, low: s.cut.every(Boolean) })), farOuter: sides.slice(2).filter((s) => s.outer).map((s) => ({ side: s.side, full: s.cut.every((c) => !c) })) };
  });
})()`;

test.skipIf(!chromeFound)("the walls nearest the camera are low, and a quarter turn recomputes them", async () => {
  const check = (offices: any[]) => {
    for (const o of offices) {
      for (const s of o.near) expect({ lane: o.lane, side: s.side, low: s.low }).toEqual({ lane: o.lane, side: s.side, low: true });
    }
    const far = offices.flatMap((o) => o.farOuter);
    if (far.length) expect(far.filter((s: any) => s.full).length / far.length).toBeGreaterThan(0.75);
    return offices.map((o) => o.near.map((s: any) => s.side).sort().join(""));
  };
  await until(`!__world.inspect().turning`);
  const walls = await page.evaluate(WALLS);
  expect(walls.flatMap((o: any) => o.farOuter).length).toBeGreaterThan(0); // the back row's outer walls
  const before = check(walls);
  expect(before.every((s) => s === "es")).toBe(true); // the default view looks from the south east
  // E turns the office a quarter
  await page.s("Input.dispatchKeyEvent", { type: "keyDown", key: "e", code: "KeyE", text: "e" });
  await page.s("Input.dispatchKeyEvent", { type: "keyUp", key: "e", code: "KeyE" });
  await until(`__world.rotation === 1 && !__world.inspect().turning`);
  const after = check(await page.evaluate(WALLS));
  expect(after.every((s) => s === "en")).toBe(true);
  expect(errors).toEqual([]);
}, 120_000);

test.skipIf(!chromeFound)("clicking a worker opens its card; Esc closes it", async () => {
  // back to four lanes' worth of view: fit, then find a worker the panels leave uncovered
  await page.evaluate(`document.querySelector('.wctl [data-fit]').click()`);
  await Bun.sleep(1500);
  const target = await page.evaluate(`(() => {
    const c = document.getElementById("world");
    for (const lane of __world.offices) {
      const w = __world.worker(lane);
      if (w && w.visible && document.elementFromPoint(w.x, w.y) === c) return { lane, x: w.x, y: w.y };
    }
    return null;
  })()`);
  expect(target).not.toBeNull();
  for (const type of ["mousePressed", "mouseReleased"]) await page.s("Input.dispatchMouseEvent", { type, x: target.x, y: target.y, button: "left", clickCount: 1 });
  await until(`document.querySelector("#card h3")?.textContent === ${JSON.stringify(target.lane)} && !document.getElementById("card").hasAttribute("data-closed")`);
  await until(`__world.worker(${JSON.stringify(target.lane)}).selected`);
  await page.s("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape" });
  await page.s("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape" });
  await until(`document.getElementById("card").hasAttribute("data-closed")`);
  expect(errors).toEqual([]);
}, 120_000);

test.skipIf(!chromeFound)("the office rests while a conference room covers it", async () => {
  await server.post("/api/rooms", { slug: "ope-1", title: "A room", owner: name(0), members: [name(1)] });
  // a fresh page at the room's address (through a blank page, so it loads again rather than only changing its hash)
  await page.s("Page.navigate", { url: "about:blank" });
  await page.s("Page.navigate", { url: `${server.base}/#room/ope-1` });
  await until(`!document.getElementById("roomView")?.hidden && window.__world?.inspect?.().paused`);
  const frames = await page.evaluate(`__world.inspect().frames`);
  await Bun.sleep(1500);
  expect(await page.evaluate(`__world.inspect().frames`)).toBe(frames);
  await page.evaluate(`document.querySelector("[data-room-back]").click()`);
  await until(`!__world.inspect().paused && __world.inspect().frames > ${frames}`);
  expect(errors).toEqual([]);
}, 120_000);
