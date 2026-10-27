// The office on the @hq/world engine, behind the OFFICE setting (D18): mountOffice(canvas, opts) answers the same calls
// as the classic renderer's mountWorld (world/world.js), so world/index.js drives either one the same way. Each state
// change builds the doc again with officeDoc (office/plan.js) and hands it to world.apply, which rebuilds only what
// changed. It binds itself to world/api.js, so the desk chips, the subagent balls and addToWorld work unchanged.
import { createWorld } from "@hq/world";
import { fromJSON } from "@hq/world/model";
import { THREE, bindWorld, runFrame } from "../world/api.js";
import { Balls } from "../world/balls.js";
import { emit } from "../core/bus.js";
import japandi from "../office/japandi/index.js";
import { officeDoc, deskId, workerId } from "../office/plan.js";
import { rowOf } from "../office/acts.js";

// Frames a second per PERFORMANCE choice while nothing moves (workers typing, balls hopping). POWER SAVER: none, so
// the engine draws only when something changes or moves.
const FPS = { smooth: 30, balanced: 15, saver: 0 };
const TIME = { light: "14:00", dark: "21:00" };
const BALL_CENTRE = new THREE.Vector3(0, 0, 0.8); // round the chair, in the desk's frame (its worker toward +z)
const CHEST = 0.3;                                // metres above the hips: where a worker is clicked
const RING = { light: "#b9832f", dark: "#e0b25c" };
// The camera's side of what it looks at, per rotation, as the classic renderer reports it.
const SIDES = [{ sx: 1, sz: 1 }, { sx: 1, sz: -1 }, { sx: -1, sz: -1 }, { sx: -1, sz: 1 }];
const laneIn = (id) => /^(?:desk|chair|lane):(.+)$/.exec(id ?? "")?.[1] ?? null;

export function mountOffice(canvas, opts = {}) {
  let world = null, res = null;
  let theme = opts.theme === "dark" ? "dark" : "light";
  let insets = opts.insets ?? { left: 0, top: 0, right: 0, bottom: 0 };
  let hqName = opts.hq ?? "hq", hqStatus = "moving";
  let lanes = [], vitals = {}, live = new Set(), statusOf = new Map(), layoutKey = "";
  let selected = null, hovered = null, mode = "smooth", paused = false, fitting = true;
  const balls = new Balls();
  const deskFrames = new Map(); // lane -> a group attached to its desk: the frame its balls hop in
  const ring = selectionRing();

  // The pace: a host system that keeps the view drawing at the PERFORMANCE rate while workers type and balls hop.
  // Motion (a walk, a turn, an edit) draws at display rate whatever this says.
  let since = 0;
  const pace = { name: "hq/pace", run(ecs, dt) {
    if (!FPS[mode]) return false;
    since += dt;
    if (since < 1 / FPS[mode] - 1e-4) return false;
    since = 0;
    return true;
  } };

  let last = performance.now();
  function frame() {
    const now = performance.now(), dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    balls.update(now);
    runFrame(now, dt);
  }

  function build() {
    // HQ's own lane, when it is one, sits in the suite, not at a team desk (layout.js leaves it out)
    res = officeDoc(lanes, res, { hq: hqName, hqStatus });
    live = new Set([...res.layout.desks.filter((d) => !d.vacant).map((d) => d.lane), ...(res.layout.hq ? [hqName] : [])]);
    statusOf = new Map([...lanes.map((l) => [l.name, l.status]), [hqName, hqStatus]]);
    if (!world) {
      world = createWorld(canvas, fromJSON(res.doc, [japandi]), { theme, time: TIME[theme], insets, systems: [pace] });
      world.three.scene.add(balls.mesh);
      world.on("frame", frame);
      if (paused) world.pause(true);
      bindWorld(api);
      emit("world:ready");
      if (fitting) world.camera.fit();
    } else {
      let diff = null;
      try { diff = world.apply(res.doc); } catch (e) { console.error("the office could not change", e); return; }
      // the office grew or shrank: fit it again, unless the owner has panned or zoomed since
      if (diff?.lot && fitting) world.camera.fit({ ease: true });
    }
    const key = [...live].filter((l) => l !== hqName).join("\n");
    if (key !== layoutKey) { layoutKey = key; emit("world:layout", key ? key.split("\n") : []); }
    setSelected(selected);
    applyVitals();
  }

  // Each lane's subagents as balls round its desk. A frame is asked for only when they changed.
  let ballsKey = "";
  function applyVitals() {
    const now = performance.now();
    const key = JSON.stringify([...live].map((l) => [l, vitals[l]?.subagents ?? null]));
    if (key === ballsKey) return;
    ballsKey = key;
    for (const lane of [...balls.desks.keys()]) if (!live.has(lane) || !vitals[lane]) balls.drop(lane, now);
    for (const lane of live) {
      const v = vitals[lane];
      if (!v) continue;
      let g = deskFrames.get(lane);
      if (!g) deskFrames.set(lane, (g = new THREE.Group()));
      if (!g.parent && !world.attach(g, deskId(lane))) continue;
      g.updateWorldMatrix(true, false);
      balls.set(lane, v.subagents ?? [], g.matrixWorld, BALL_CENTRE, now);
    }
    world.invalidate();
  }

  // lanes: [{ name, parent, status, blocking }] in the order they appeared; vitals: S.vitals (by lane name).
  function setLanes(next, nextVitals = vitals) {
    lanes = next.map((l) => ({ name: l.name, parent: l.parent ?? null, status: l.status ?? "hq_turn", blocking: l.blocking ?? 0 }));
    vitals = nextVitals ?? {};
    build();
  }

  function setHq(name, status) {
    if (name) hqName = name;
    hqStatus = status ?? hqStatus;
    if (world) build();
  }

  function setTheme(t) {
    const next = t === "dark" ? "dark" : "light";
    if (next === theme) return;
    theme = next;
    ring.material.color.set(RING[theme]);
    if (!world) return;
    world.setTheme(theme);
    world.setTime(TIME[theme]);
  }

  // A ring on the floor under the selected lane's worker; it follows the worker wherever it walks.
  let ringOn = null;
  function setSelected(lane) {
    selected = lane;
    if (!world) return;
    const want = lane && live.has(lane) ? lane : null;
    if (want === ringOn && (!want || ring.parent)) return;
    ring.parent?.remove(ring);
    ringOn = want && world.attach(ring, workerId(want)) ? want : null;
    world.invalidate();
  }

  function setPerformance(m) {
    mode = m in FPS ? m : "smooth";
    world?.invalidate();
  }

  // While the reader covers the office on a phone, nothing steps or draws.
  function setPaused(on) {
    paused = !!on;
    world?.pause(paused);
  }

  function setInsets(i) {
    const next = { ...insets, ...i };
    if (JSON.stringify(next) === JSON.stringify(insets)) return;
    insets = next;
    if (!world) return;
    world.camera.setInsets(insets);
    if (fitting) world.camera.fit({ ease: true });
  }

  const rotate = (dir) => world?.camera.rotate(dir);
  function zoom(level) { fitting = false; world?.camera.zoom(level); }
  function fit() { fitting = true; world?.camera.fit({ ease: true }); }

  // Centre on some lanes' desks (the mean of their anchors).
  function focusLanes(names, now = false) {
    const pts = names.map((n) => deskAnchor(n)).filter(Boolean);
    if (!pts.length || !world) return;
    fitting = false;
    world.camera.focusOn(pts.reduce((a, p) => a + p.x, 0) / pts.length, pts.reduce((a, p) => a + p.z, 0) / pts.length, { ease: !now });
  }

  // world/api.js's door, on the engine's anchors, projection and attach.
  function deskAnchor(lane) {
    const a = world && live.has(lane) ? world.anchor(deskId(lane), "hud") : null;
    return a ? new THREE.Vector3(...a) : null;
  }
  function project(v) {
    if (!world) return { x: 0, y: 0, visible: false };
    return world.project(Array.isArray(v) ? v : [v.x, v.y, v.z]);
  }
  function addToWorld(obj, lane) {
    if (!world) return false;
    if (!lane || !live.has(lane) || !world.attach(obj, deskId(lane))) world.three.scene.add(obj);
    world.invalidate({ shadows: true });
    return true;
  }

  // A pick as a lane: a worker, or its desk or chair. Empty desks and the rest of the furniture are no one's.
  function pick(clientX, clientY) {
    const lane = world ? laneIn(world.pick(clientX, clientY)?.id) : null;
    return lane && live.has(lane) ? lane : null;
  }

  // Controls: drag to pan, wheel to step the zoom, click to select; the pointer over a worker or desk is its lane's hover.
  const cleanups = [];
  let hoverAt = null, hoverQueued = false, lit = false, wheelAt = 0;
  if (opts.controls !== false) {
    let drag = null;
    const down = (e) => { drag = { x: e.clientX, y: e.clientY, moved: false }; };
    const move = (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) < 4) return;
      drag.moved = true;
      fitting = false;
      world?.camera.pan(dx, dy);
      drag.x = e.clientX; drag.y = e.clientY;
    };
    const up = (e) => {
      if (drag && !drag.moved && e.target === canvas) { const lane = pick(e.clientX, e.clientY); if (lane) emit("world:select", lane); }
      drag = null;
    };
    const cancel = () => { drag = null; };
    const hover = (e) => {
      if (drag) return;
      hoverAt = { x: e.clientX, y: e.clientY };
      if (!hoverQueued) { hoverQueued = true; requestAnimationFrame(updateHover); }
    };
    const leave = () => { hoverAt = null; if (!hoverQueued) { hoverQueued = true; requestAnimationFrame(updateHover); } };
    const wheel = (e) => {
      e.preventDefault();
      const now = performance.now();
      if (!world || now - wheelAt < 220) return;
      wheelAt = now;
      zoom(world.camera.state.zoom + (e.deltaY < 0 ? 1 : -1));
    };
    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", hover);
    canvas.addEventListener("pointerleave", leave);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    canvas.addEventListener("wheel", wheel, { passive: false });
    cleanups.push(() => {
      canvas.removeEventListener("pointerdown", down); canvas.removeEventListener("pointermove", hover); canvas.removeEventListener("pointerleave", leave);
      window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", cancel);
      canvas.removeEventListener("wheel", wheel);
    });
  }
  function updateHover() {
    hoverQueued = false;
    if (!world || paused) return;
    const hit = hoverAt ? world.pick(hoverAt.x, hoverAt.y) : null;
    const lane = laneIn(hit?.id);
    const ours = lane && live.has(lane) ? lane : null;
    // the engine lights the desk or chair under the pointer; nothing else lights up
    if (ours && hit.kind === "object") { world.hover(hoverAt.x, hoverAt.y); lit = true; } else if (lit) { world.hover(-1e6, -1e6); lit = false; }
    if (ours === hovered) return;
    hovered = ours;
    canvas.style.cursor = ours ? "pointer" : "";
    emit("world:hover", ours);
  }

  // What the office shows, for tests and the lab: the classic renderer's read-only shape, and the engine's numbers.
  function inspect() {
    const e = world?.inspect();
    const L = res?.layout;
    const rot = e?.rot ?? 0;
    return {
      renderer: "new",
      rooms: L ? L.teamRooms.map((r) => ({ id: r.id, team: r.team, lanes: [...r.lanes] })) : [],
      desks: L ? L.desks.filter((d) => !d.vacant).map((d) => d.lane) : [],
      vacant: L ? L.desks.filter((d) => d.vacant).map((d) => d.lane) : [],
      stage: L?.stageName ?? null,
      rotation: rot,
      cameraSide: SIDES[rot],
      camera: e ? { x: e.camera.target[0], z: e.camera.target[2] } : null,
      azimuth: e?.camera.az ?? Math.PI / 4,
      turning: !!world?.camera.state.turning,
      frames: e?.stats.renders ?? 0,
      calls: e?.draws ?? 0,
      triangles: e?.triangles ?? 0,
      selected,
      hovered,
      mode,
      paused,
      fitting,
      outside: null,
      balls: balls.mesh.count, // subagent balls drawn in the last frame
      // the engine's own: draws and shadow redraws, the canvas's size, the zoom step, the cut walls, the characters
      engine: e ? { stats: e.stats, draws: e.draws, triangles: e.triangles, size: e.size, zoom: e.zoom, walls: e.walls, cut: e.cut.length, characters: e.characters.length } : null,
    };
  }

  // The four sides of a team room (by its id, or the room of a lane's desk): their middle on the lot, whether each wall
  // edge of the side is cut down to the kerb, and whether the side is an outer wall of the building.
  function roomWalls(idOrLane) {
    const L = res?.layout;
    if (!L || !world) return null;
    const id = L.teamRooms.some((r) => r.id === idOrLane) ? idOrLane : L.desks.find((d) => d.lane === idOrLane)?.room;
    const room = L.teamRooms.find((r) => r.id === id);
    if (!room) return null;
    const o = res.origin, cut = new Set(world.inspect().cut);
    const x0 = room.x, z0 = room.z, x1 = room.x + room.w, z1 = room.z + room.d;
    const sides = {
      n: { mid: { x: (x0 + x1) / 2, z: z0 }, of: (w) => w.dir === "x" && w.z === z0 },
      s: { mid: { x: (x0 + x1) / 2, z: z1 }, of: (w) => w.dir === "x" && w.z === z1 },
      w: { mid: { x: x0, z: (z0 + z1) / 2 }, of: (w) => w.dir === "z" && w.x === x0 },
      e: { mid: { x: x1, z: (z0 + z1) / 2 }, of: (w) => w.dir === "z" && w.x === x1 },
    };
    const inRun = (w) => (w.dir === "x" ? w.x >= x0 && w.x < x1 : w.z >= z0 && w.z < z1);
    const edge = (w) => `${w.dir === "x" ? "h" : "v"}:${w.x + o.x},${w.z + o.z}`;
    return Object.entries(sides).map(([side, s]) => {
      const walls = L.walls.filter((w) => s.of(w) && inRun(w));
      return { side, mid: { x: s.mid.x + o.x, z: s.mid.z + o.z }, cut: walls.map((w) => cut.has(edge(w))), outer: walls.length > 0 && walls.every((w) => !w.a || !w.b) };
    });
  }

  // A lane's worker on the canvas, in CSS pixels: its chest, and what it is doing.
  function workerOf(lane) {
    if (!world || !live.has(lane)) return null;
    const c = world.character(workerId(lane));
    const head = world.anchor(workerId(lane), "head");
    if (!c || !head) return null;
    // the engine's character anchor stands 0.95 m over the hips
    const at = world.project([c.x, head[1] - 0.95 + CHEST, c.z]);
    return { x: at.x, y: at.y, at: { x: c.x, z: c.z }, step: c.step, visible: at.visible, pose: c.clip, out: rowOf(statusOf.get(lane)).place === "break", marker: null, selected: selected === lane && !!ring.parent };
  }

  const api = {
    setLanes, setHq, setTheme, setSelected, setPerformance, setPaused, rotate, zoom, fit, focusLanes, setInsets,
    setOutside() {}, // the land round the office comes to the engine later (step 6): the new office shows its plain lot
    renderNow: () => world?.invalidate(),
    deskAnchor, project, addToWorld, pick, inspect, roomWalls, workerOf,
    get engine() { return world; },
    dispose() {
      cleanups.forEach((f) => f());
      if (world) { world.dispose(); world = null; }
      balls.dispose();
      ring.geometry.dispose(); ring.material.dispose();
      bindWorld(null);
    },
  };
  return api;

  function selectionRing() {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.34, 0.42, 40), new THREE.MeshBasicMaterial({ color: RING[theme], transparent: true, opacity: 0.85, depthWrite: false }));
    m.rotation.x = -Math.PI / 2;
    m.position.y = 0.025;
    m.name = "selected";
    m.renderOrder = 1;
    return m;
  }
}
