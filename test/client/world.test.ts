// The 3D office on the real page (office-view/view.js on the @hq/world engine), in Chrome with WebGL on SwiftShader,
// against one temporary server whose lanes the tests add and change through the API as they go: the engine draws the
// office with a lane's subagents as balls, a lamp per room and the suite; a lane added joins with world.apply on the
// same context and the workers keep their places; the desk chips sit over their desks clear of the stack; a click on
// a worker opens its card and Esc closes it; hover lights only a lane's desk and shows the pointer only over a lane;
// each desk's light, the badge over its worker and its room's lamp follow the lane's status; far out the balls, lights
// and badges grow and still draw; rooms of four, more rooms as the company grows (spec F3), a team of six in a second
// room beside its first; beside the open reader the office keeps right of it and keeps moving, and on a phone it rests;
// the walls nearest the camera cut down to the kerb and recomputed after a quarter turn (F4); OUTSIDE puts the town
// round the office within the draw budget and swaps it for the valley on the same context; a lane removed or renamed
// while it works, and the theme flipped, log nothing; a click on a worker's badge opens its card. No console errors.
// Needs Chrome.
import { afterAll, beforeAll, expect, test } from "bun:test";
import { join } from "node:path";
import { findChrome, newSession, startChrome, startServer } from "../../scripts/room-hash.ts";

const ROOT = join(import.meta.dir, "..", "..");
const chromeFound = !!findChrome();
let chrome: Awaited<ReturnType<typeof startChrome>>;
let server: Awaited<ReturnType<typeof startServer>>;
let page: Awaited<ReturnType<typeof newSession>>;
const errors: string[] = [];
const SLOW = 300_000;
const FRESH = 600_000; // a test that loads the page again: under load a page with 24 lanes can take minutes to come up
// SwiftShader draws on the CPU: under load a frame can take a second, so waits are long.
// One evaluate can take a minute, so the last look comes after the deadline rather than being skipped by it.
const until = async (expr: string, ms = 150_000) => {
  for (const end = Date.now() + ms; ; await Bun.sleep(150)) {
    if (await page.evaluate(expr).catch(() => false)) return true;
    if (Date.now() >= end) break;
  }
  throw new Error(`timed out waiting for ${expr}: ${JSON.stringify(await page.evaluate("window.__world?.inspect?.()").catch((e) => String(e)))}`);
};
const name = (i: number) => `lane-${String(i).padStart(2, "0")}`;
const q = (s: string) => JSON.stringify(s);
let added = 0;
// Lanes in phase "waiting" sit at their desks whatever herdr says, so every worker is there to click.
const grow = async (n: number) => {
  for (; added < n; added++) await server.post("/api/lanes", { name: name(added), phase: "waiting", title: `Lane ${added}`, machine: "local" });
};
const key = async (k: string) => {
  const one = k.length === 1, code = one ? `Key${k.toUpperCase()}` : k;
  await page.s("Input.dispatchKeyEvent", { type: "keyDown", key: k, code, ...(one ? { text: k } : {}) });
  await page.s("Input.dispatchKeyEvent", { type: "keyUp", key: k, code });
};
const move = (p: { x: number; y: number }) => page.s("Input.dispatchMouseEvent", { type: "mouseMoved", x: p.x, y: p.y });
const fresh = async (hash = "") => {
  // through a blank page, so the page loads again rather than only changing its hash
  await page.s("Page.navigate", { url: "about:blank" });
  await page.s("Page.navigate", { url: `${server.base}/${hash}` });
};
const DESKTOP = { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false };
const RED = { color: "#e5484d", glyph: "!" };
const BLUE = "#3e63dd";
// A worker the panels leave uncovered, at its chest in client px.
const OPEN_WORKER = `(() => {
  const c = document.getElementById("world"), r = c.getBoundingClientRect();
  for (const lane of __world.desks) {
    const w = __world.worker(lane);
    if (w && w.visible && document.elementFromPoint(r.left + w.x, r.top + w.y) === c) return { lane, x: r.left + w.x, y: r.top + w.y };
  }
  return null;
})()`;
// A bare point of the canvas, for the wheel.
const BARE = `(() => { const c = document.getElementById("world"); for (let y = 860; y > 100; y -= 20) for (let x = 600; x < 1400; x += 20) if (document.elementFromPoint(x, y) === c) return { x, y }; return null; })()`;

beforeAll(async () => {
  if (!chromeFound) return;
  chrome = await startChrome({ webgl: true });
  server = await startServer(ROOT);
  // the plain lot, as most of these tests want; the OUTSIDE test puts the land round it and takes it off again
  await server.post("/api/settings", { settings: { outside: "off" } });
  await grow(2);
  await server.post(`/api/lanes/${name(0)}/vitals`, { model: "claude-opus-5-5", effort: "high", subagents: 2, contextUsed: 90_000, contextMax: 200_000 });
  page = await newSession(chrome.cdp, errors);
  await page.s("Emulation.setDeviceMetricsOverride", DESKTOP);
  await page.s("Page.navigate", { url: `${server.base}/` });
  await until(`window.__world?.desks?.length === 2`, FRESH - 60_000);
}, FRESH);

afterAll(async () => {
  await server?.stop();
  await chrome?.close();
});

test.skipIf(!chromeFound)("the engine draws the office on #world: a room, the suite, a lamp each, and a lane's subagents as balls", async () => {
  await until(`__world.inspect().frames > 0 && __world.inspect().engine.draws > 0 && __world.inspect().balls === 2`);
  const got = await page.evaluate(`(() => {
    const files = performance.getEntriesByType("resource").map((r) => new URL(r.name).pathname);
    const i = __world.inspect();
    return { engine: files.includes("/packages/world/src/index.js"), stage: i.stage, rooms: i.rooms, suite: i.suite, lamps: i.lamps, characters: i.engine.characters };
  })()`);
  expect(got.engine).toBe(true);
  expect(got.stage).toBe("studio");
  // waiting lanes are active: their room's lamp is on, and so is the suite's (HQ at work)
  expect(got.rooms).toEqual([{ id: "room:0", team: null, lanes: [name(0), name(1)], lit: true }]);
  expect(got.suite).toEqual({ id: "hq", lit: true });
  expect(got.lamps).toBe(2);
  expect(got.characters).toBe(3); // two lanes and HQ
  expect(errors).toEqual([]);
}, SLOW);

test.skipIf(!chromeFound)("a lane added through the API joins with world.apply: same context, same engine, workers keep their places", async () => {
  // every worker in its chair, typing: only then is a place a place
  await until(`!__world.inspect().turning && __world.desks.every((l) => __world.worker(l)?.step === "loop")`);
  const before = await page.evaluate(`(() => {
    window.__gl = document.getElementById("world").getContext("webgl2");
    return { renders: __world.inspect().engine.stats.renders, at: [${q(name(0))}, ${q(name(1))}].map((l) => __world.worker(l).at) };
  })()`);
  await grow(3);
  // the engine's counters go on from where they were: it was not made again
  await until(`__world.desks.length === 3 && __world.inspect().engine.characters === 4 && __world.inspect().engine.stats.renders > ${before.renders}`);
  const after = await page.evaluate(`(() => ({
    same: window.__gl === document.getElementById("world").getContext("webgl2"),
    at: [${q(name(0))}, ${q(name(1))}].map((l) => __world.worker(l).at),
    rooms: __world.rooms.length,
    lamps: __world.inspect().lamps,
  }))()`);
  expect(after).toEqual({ same: true, at: before.at, rooms: 1, lamps: 2 });
  expect(errors).toEqual([]);
}, SLOW);

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
}, SLOW);

test.skipIf(!chromeFound)("clicking a worker selects its lane and opens its card; Esc closes it", async () => {
  const target = await page.evaluate(OPEN_WORKER);
  expect(target).not.toBeNull();
  for (const type of ["mousePressed", "mouseReleased"]) await page.s("Input.dispatchMouseEvent", { type, x: target.x, y: target.y, button: "left", clickCount: 1 });
  await until(`document.querySelector("#card h3")?.textContent === ${q(target.lane)} && !document.getElementById("card").hasAttribute("data-closed")`);
  await until(`__world.worker(${q(target.lane)}).selected && __world.inspect().selected === ${q(target.lane)}`);
  await key("Escape");
  await until(`document.getElementById("card").hasAttribute("data-closed")`);
  expect(errors).toEqual([]);
}, SLOW);

// The engine's scene, reached through world/api.js's addToWorld (an object added with no lane goes in the scene), and
// the camera it draws with, caught as it draws. From them: which objects are highlighted (their matte meshes wear the
// highlight in place of their own material), and a bare point over an object that is no lane's.
const SCENE = `import("/src/client/world/api.js").then(({ THREE, addToWorld }) => {
  const o = new THREE.Object3D();
  addToWorld(o, null);
  window.__scene = o.parent;
  window.__THREE = THREE;
  o.removeFromParent();
  window.__scene.onBeforeRender = (r, s, cam) => { window.__cam = cam; };
  return true;
})`;
const HIGHLIT = `(() => {
  const out = new Set();
  __scene.getObjectByName("objects").traverse((m) => { if (m.isMesh && m.userData.mat && m.material !== m.userData.mat) out.add(m.userData.entity); });
  return [...out];
})()`;
const OBJECT_POINT = `(() => {
  const T = __THREE, c = document.getElementById("world"), r = c.getBoundingClientRect();
  const desk = document.querySelector(".desk").getBoundingClientRect();
  const roots = [__scene.getObjectByName("characters"), __scene.getObjectByName("objects")];
  const shown = (o) => { for (; o; o = o.parent) if (!o.visible) return false; return true; };
  const idOf = (h) => h.object.userData.entity ?? h.object.userData.ids?.[h.instanceId];
  const workers = [...__world.desks, "hq"].map((l) => __world.worker(l)).filter(Boolean);
  const ray = new T.Raycaster();
  const found = [];
  for (let y = r.top + 40; y < r.bottom - 40; y += 12) for (let x = Math.max(r.left, desk.right) + 20; x < r.right - 20; x += 12) {
    if (document.elementFromPoint(x, y) !== c) continue;
    if (workers.some((w) => Math.hypot(r.left + w.x - x, r.top + w.y - y) < 90)) continue;
    ray.setFromCamera(new T.Vector2(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1), __cam);
    const hit = ray.intersectObjects(roots, true).find((h) => shown(h.object) && idOf(h));
    const id = hit && idOf(hit);
    if (id && !/^(desk|chair|lane):/.test(id)) found.push({ id, x, y });
  }
  return found.find((f) => !f.id.startsWith("rug")) ?? found[0] ?? null;
})()`;

test.skipIf(!chromeFound)("hover over a worker lights its desk and shows the pointer; over other furniture, nothing and no lane", async () => {
  await page.evaluate(SCENE);
  await until(`!!window.__cam`);
  await page.evaluate(`import("/src/client/core/bus.js").then(({ on }) => { window.__hovers = []; on("world:hover", (l) => __hovers.push(l)); return true; })`);
  const cursor = `document.getElementById("world").style.cursor`;

  const worker = await page.evaluate(OPEN_WORKER);
  expect(worker).not.toBeNull();
  await move(worker);
  await until(`${cursor} === "pointer" && __world.inspect().hovered === ${q(worker.lane)}`);
  expect(await page.evaluate(HIGHLIT)).toEqual([`desk:${worker.lane}`]);
  expect(await page.evaluate(`__hovers`)).toEqual([worker.lane]);

  const thing = await page.evaluate(OBJECT_POINT);
  expect(thing).not.toBeNull();
  await move(thing);
  await until(`${cursor} === "" && __world.inspect().hovered === null`);
  expect({ over: thing.id, highlit: await page.evaluate(HIGHLIT) }).toEqual({ over: thing.id, highlit: [] });
  expect(await page.evaluate(`__hovers`)).toEqual([worker.lane, null]);
  expect(errors).toEqual([]);
}, SLOW);

test.skipIf(!chromeFound)("a desk's light, the badge over its worker and the room's lamp follow the lane's status", async () => {
  const lanes = [name(0), name(1), name(2)];
  const look = (l: string) => `(() => { const w = __world.worker(${q(l)}); return { marker: w.marker, light: w.light, out: w.out }; })()`;
  // waiting on CI or another lane: a blue clock over each, a blue light on each desk, the room lit
  await until(`${JSON.stringify(lanes)}.every((l) => __world.worker(l)?.light === ${q(BLUE)})`);
  expect(await page.evaluate(look(name(1)))).toEqual({ marker: { color: BLUE, glyph: "clock" }, light: BLUE, out: false });
  expect(await page.evaluate(`__world.rooms[0].lit`)).toBe(true);
  // every lane in the room parked: its lamp goes dim, the lights go out, the badges go, the workers leave their desks
  for (const l of lanes) await server.post("/api/lanes", { name: l, phase: "parked" });
  await until(`__world.rooms[0].lit === false`);
  for (const l of lanes) expect({ l, ...(await page.evaluate(look(l))) }).toEqual({ l, marker: null, light: null, out: true });
  expect(await page.evaluate(`__world.inspect().suite.lit`)).toBe(true);
  expect(await page.evaluate(`__world.inspect().lamps`)).toBe(2); // dim, not removed
  // back at work: lit again
  for (const l of lanes) await server.post("/api/lanes", { name: l, phase: "waiting" });
  await until(`__world.rooms[0].lit === true && __world.worker(${q(name(1))}).light === ${q(BLUE)}`);
  // a question for the owner: up beside the desk, hand raised, the red badge and the red light
  await server.post("/api/asks", { lane: name(1), title: "Which one?" });
  await until(`__world.worker(${q(name(1))}).pose === "wave"`);
  expect(await page.evaluate(look(name(1)))).toEqual({ marker: RED, light: "#e5484d", out: false });
  expect(await page.evaluate(look(name(0)))).toEqual({ marker: { color: BLUE, glyph: "clock" }, light: BLUE, out: false });
  expect(errors).toEqual([]);
}, SLOW);

test.skipIf(!chromeFound)("far out the balls, the desk lights and the badges grow, and the balls still draw; close in they are true size", async () => {
  const at = await page.evaluate(BARE);
  expect(at).not.toBeNull();
  const wheel = async (n: number, dy: number) => {
    for (let i = 0; i < n; i++) await page.s("Input.dispatchMouseEvent", { type: "mouseWheel", x: at.x, y: at.y, deltaX: 0, deltaY: dy });
  };
  // in to the near stop (ZOOM_STOPS.near, 90.5 px/m): everything at its true size
  await wheel(16, -400);
  await until(`__world.inspect().engine.zoom >= 12 && Object.values(__world.inspect().scale).every((s) => s === 1)`);
  expect(await page.evaluate(`__world.inspect().fitting`)).toBe(false);
  // out past the far stop (ZOOM_STOPS.far, 22.6 px/m)
  await wheel(16, 400);
  await until(`__world.inspect().engine.zoom <= 4 && __world.inspect().scale.balls > 1`);
  const frames = await page.evaluate(`__world.inspect().frames`);
  await until(`__world.inspect().frames > ${frames}`);
  const far = await page.evaluate(`(() => { const i = __world.inspect(); return { scale: i.scale, balls: i.balls }; })()`);
  expect(far.balls).toBe(2);
  expect(far.scale.balls).toBeGreaterThan(1);
  expect(far.scale.lights).toBeGreaterThan(1);
  expect(far.scale.markers).toBeGreaterThan(1);
  // 0 fits the office again
  await key("0");
  await until(`__world.inspect().fitting`);
  expect(errors).toEqual([]);
}, SLOW);

test.skipIf(!chromeFound)("OUTSIDE city puts the town round a small office within the draw budget; nature swaps it on the same page and context", async () => {
  await page.evaluate(`(() => { window.__gl = document.getElementById("world").getContext("webgl2"); window.__samePage = true; })()`);
  await server.post("/api/settings", { settings: { outside: "city" } });
  await until(`__world.inspect().outside?.mode === "city" && __world.inspect().outside.pieces > 1000`);
  const before = await page.evaluate(`__world.inspect().engine.stats.renders`);
  await until(`__world.inspect().engine.stats.renders > ${before}`); // a frame drawn with the town in it
  const city = await page.evaluate(`(() => { const i = __world.inspect(); return { draws: i.engine.draws, pieces: i.outside.pieces, movers: i.outside.movers }; })()`);
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
  // back to the plain lot for the tests that follow
  await server.post("/api/settings", { settings: { outside: "off" } });
  await until(`__world.inspect().outside === null`);
  expect(errors).toEqual([]);
}, SLOW);

test.skipIf(!chromeFound)("one desk per lane in rooms of four, more rooms as the company grows, and the canvas draws them", async () => {
  for (const [n, stage, rooms] of [[4, "studio", 1], [9, "floor", 3], [12, "floor", 3]] as const) {
    await grow(n);
    await until(`__world.desks.length === ${n} && __world.stage === "${stage}"`);
    expect(await page.evaluate("__world.desks.slice().sort()")).toEqual(Array.from({ length: n }, (_, i) => name(i)));
    // lanes with no tree fill rooms of four in the order they came; a lamp each, and the suite's
    const got = await page.evaluate("__world.inspect()");
    expect(got.rooms.length).toBe(rooms);
    expect(got.rooms.map((r: any) => r.lanes.length)).toEqual(Array.from({ length: rooms }, (_, i) => Math.min(4, n - i * 4)));
    expect(got.rooms[0].lanes).toEqual(Array.from({ length: Math.min(4, n) }, (_, i) => name(i)));
    expect(got.lamps).toBe(rooms + 1);
  }
  // drawn: frames came, with every room's geometry in them
  await until(`__world.inspect().frames > 3 && __world.inspect().triangles > 50000`);
  expect(errors).toEqual([]);
}, SLOW);

test.skipIf(!chromeFound)("beside a room in the reader the office keeps right of it and keeps moving; on a phone the reader covers it and it rests", async () => {
  await server.post("/api/rooms", { slug: "ope-1", title: "A room", owner: name(0), members: [name(1)] });
  // desktop (1440 wide): the room opens in the reader beside the office
  await fresh("#room/ope-1");
  await until(`!document.getElementById("roomView")?.hidden && window.__world?.desks?.length === 12`, SLOW);
  // every desk of the 12 comes to rest right of the reader, on the canvas
  const OFF = `import("/src/client/world/api.js").then((api) => {
    const c = document.getElementById("world").getBoundingClientRect(), reader = document.getElementById("reader").getBoundingClientRect();
    return __world.desks.filter((l) => { const p = api.project(api.deskAnchor(l)); return !(c.left + p.x > reader.right && c.left + p.x < c.right && c.top + p.y > c.top && c.top + p.y < c.bottom); });
  })`;
  await until(`${OFF}.then((off) => off.length === 0)`);
  expect(await page.evaluate(OFF)).toEqual([]);
  // it keeps drawing (under load SwiftShader takes seconds a frame, so wait for frames rather than a fixed time)
  const moving = await page.evaluate(`__world.inspect().frames`);
  await until(`__world.inspect().frames > ${moving} + 1`);
  expect(await page.evaluate(`__world.inspect().paused`)).toBe(false);
  await page.evaluate(`document.querySelector("[data-room-back]").click()`);
  await until(`document.getElementById("reader").hidden`);
  // phone (390 wide): the reader is a full-screen sheet over the page, and the office rests until it closes
  await page.s("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await fresh("#room/ope-1");
  await until(`!document.getElementById("roomView")?.hidden && window.__world?.inspect?.().paused`, SLOW);
  const frames = await page.evaluate(`__world.inspect().frames`);
  await Bun.sleep(1500);
  expect(await page.evaluate(`__world.inspect().frames`)).toBe(frames);
  await page.evaluate(`document.querySelector("[data-room-back]").click()`);
  await until(`!__world.inspect().paused && __world.inspect().frames > ${frames}`);
  await page.s("Emulation.setDeviceMetricsOverride", DESKTOP);
  expect(errors).toEqual([]);
}, FRESH);

test.skipIf(!chromeFound)("a team shares a room, and a team of six opens a second room next to its first", async () => {
  await grow(18);
  // a team: crew leads five lanes, one of them a level further down
  await server.post("/api/lanes", { name: "crew", phase: "waiting", title: "Crew", machine: "local" });
  for (let i = 1; i <= 5; i++) await server.post("/api/lanes", { name: `crew-${i}`, parent: i === 3 ? "crew-1" : "crew", phase: "waiting", title: `Crew ${i}`, machine: "local" });
  // a fresh page lays the plan out from the tree (a live page keeps every desk where it is)
  await fresh();
  await until(`window.__world?.desks?.length === 24 && __world.inspect().frames > 0`, FRESH - 60_000);
  const rooms = await page.evaluate("__world.rooms");
  const crew = rooms.filter((r: any) => r.team === "crew");
  expect(crew.map((r: any) => r.lanes.length)).toEqual([4, 2]);
  expect(crew.flatMap((r: any) => r.lanes).sort()).toEqual(["crew", "crew-1", "crew-2", "crew-3", "crew-4", "crew-5"]);
  // opened one after the other: side by side in the same wing
  const ids = crew.map((r: any) => Number(r.id.split(":")[1]));
  expect(ids[1] - ids[0]).toBe(1);
  // nobody else sits in the team's rooms, and the lanes with no tree still fill rooms of four
  const rest = rooms.filter((r: any) => r.team !== "crew");
  expect(rest.every((r: any) => r.lanes.every((l: string) => l.startsWith("lane-")))).toBe(true);
  expect(rest.map((r: any) => r.lanes.length)).toEqual([4, 4, 4, 4, 2]);
  expect(await page.evaluate(`__world.stage`)).toBe("wings");
  expect(errors).toEqual([]);
}, FRESH);

// For each team room: the two sides whose middle is nearest the camera (its ground point along the view) must be cut
// to the kerb; the far sides that are the building's outer walls stand at full height, but for the stretch of one that
// would hide the indoors behind it (the HQ suite behind the first room).
const WALLS = `(() => {
  const az = __world.inspect().azimuth;
  const toward = (m) => m.x * Math.sin(az) + m.z * Math.cos(az);
  return __world.rooms.map(({ id }) => {
    const sides = __world.walls(id).sort((a, b) => toward(b.mid) - toward(a.mid));
    return { room: id, near: sides.slice(0, 2).map((s) => ({ side: s.side, low: s.cut.every(Boolean) })), farOuter: sides.slice(2).filter((s) => s.outer).flatMap((s) => s.cut.map((c) => ({ side: s.side, full: !c }))) };
  });
})()`;

test.skipIf(!chromeFound)("the walls nearest the camera are low, and a quarter turn recomputes them", async () => {
  const check = (rooms: any[]) => {
    for (const r of rooms) for (const s of r.near) expect({ room: r.room, side: s.side, low: s.low }).toEqual({ room: r.room, side: s.side, low: true });
    const far = rooms.flatMap((r) => r.farOuter); // one per wall edge
    if (far.length) expect(far.filter((e: any) => e.full).length / far.length).toBeGreaterThan(0.75);
    return rooms.map((r) => r.near.map((s: any) => s.side).sort().join(""));
  };
  await until(`__world.rotation === 0 && !__world.inspect().turning && __world.inspect().engine.cut > 0`);
  const walls = await page.evaluate(WALLS);
  expect(walls.flatMap((r: any) => r.farOuter).length).toBeGreaterThan(0); // the back row's outer walls
  const before = check(walls);
  expect(before.every((s) => s === "es")).toBe(true); // the default view looks from the south east
  await key("e");
  await until(`__world.rotation === 1 && !__world.inspect().turning`);
  const after = check(await page.evaluate(WALLS));
  expect(after.every((s) => s === "en")).toBe(true);
  await key("q");
  await until(`__world.rotation === 0 && !__world.inspect().turning`);
  expect(errors).toEqual([]);
}, SLOW);

// A lane removed while it works (its act is pending): the office drops its desk and logs nothing.
test.skipIf(!chromeFound)("a lane removed while it works leaves the office and logs no console error", async () => {
  const n = await page.evaluate("__world.desks.length");
  expect(await page.evaluate(`__world.desks.includes(${q(name(5))})`)).toBe(true);
  await server.post("/api/lanes/delete", { name: name(5) });
  await until(`__world.desks.length === ${n - 1} && !__world.desks.includes(${q(name(5))})`);
  expect(errors).toEqual([]);
}, SLOW);

test.skipIf(!chromeFound)("a lane renamed (removed, and another added in its place) logs no console error", async () => {
  const n = await page.evaluate("__world.desks.length");
  await server.post("/api/lanes/delete", { name: name(6) });
  await server.post("/api/lanes", { name: `${name(6)}-renamed`, phase: "waiting", title: "Renamed", machine: "local" });
  await until(`__world.desks.length === ${n} && __world.desks.includes(${q(`${name(6)}-renamed`)}) && !__world.desks.includes(${q(name(6))})`);
  expect(errors).toEqual([]);
}, SLOW);

// The badge over a worker, in client px where a click on its disc lands, for a lane with a badge and a canvas
// point nothing covers. The badge sprite names its worker (view.js's marks.js sets userData.entity).
const BADGE_POINT = `(async () => {
  const { THREE, project } = await import("/src/client/world/api.js");
  const c = document.getElementById("world"), r = c.getBoundingClientRect();
  const sprites = [];
  __scene.getObjectByName("characters").traverse((o) => { if (o.name === "marker" && o.userData.entity) sprites.push(o); });
  for (const b of sprites) {
    const lane = b.userData.entity.replace(/^lane:/, "");
    if (!__world.desks.includes(lane) || !__world.worker(lane).marker) continue;
    const p = b.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.31, 0)); // the disc's middle, above its tail
    const q = project(p), x = r.left + q.x, y = r.top + q.y;
    if (q.visible && document.elementFromPoint(x, y) === c) return { lane, x, y };
  }
  return null;
})()`;

test.skipIf(!chromeFound)("clicking a worker's badge opens its card, as a click on the worker does", async () => {
  await page.evaluate(SCENE);
  await until(`!!window.__cam`);
  const target = await page.evaluate(BADGE_POINT);
  expect(target).not.toBeNull();
  for (const type of ["mousePressed", "mouseReleased"]) await page.s("Input.dispatchMouseEvent", { type, x: target.x, y: target.y, button: "left", clickCount: 1 });
  await until(`document.querySelector("#card h3")?.textContent === ${q(target.lane)} && !document.getElementById("card").hasAttribute("data-closed")`);
  await key("Escape");
  await until(`document.getElementById("card").hasAttribute("data-closed")`);
  expect(errors).toEqual([]);
}, SLOW);

test.skipIf(!chromeFound)("flipping the theme twice redraws the office and logs no console error", async () => {
  const frames = await page.evaluate("__world.inspect().frames");
  for (let i = 0; i < 2; i++) await page.evaluate(`document.getElementById("themeBtn").click()`);
  await until(`document.documentElement.dataset.theme === "dark" && __world.inspect().frames > ${frames}`);
  expect(errors).toEqual([]);
}, SLOW);
