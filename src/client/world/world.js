// The world's entry: mountWorld(canvas, { theme, hq, insets }) builds the offices for the lanes and keeps them drawn.
import { THREE, roomLight, MAX_ROOMS } from "./kit.js";
import { plan as makePlan, cameraSide, toWorld, KERB_H, WALL_H } from "./plan.js";
import { lookFor, STATUS } from "./look.js";
import { View } from "./camera.js";
import { createScene } from "./scene.js";
import { buildRooms } from "./rooms.js";
import { buildOffice, buildSuite, buildBreak, OFFICE_SPOTS, SUITE_SPOTS } from "./furniture.js";
import { Worker } from "./people.js";
import { Balls } from "./balls.js";
import { route } from "./walk.js";
import { screen as screenTexture, glow } from "./textures.js";
import { bindWorld, runFrame } from "./api.js";
import { emit } from "../core/bus.js";

const RISE_MS = 800;   // a new office rises from the floor; a removed lane's office folds away as long
const TURN_MS = 650;   // a 90° turn: the walls go down to the kerbs, the cutaway swaps, they come up again
const LOW = KERB_H / WALL_H;
const BALL_CENTRE = new THREE.Vector3(2, 0, 1.1);
const LIT = new Set(["moving", "needs_you", "blocked", "hq_turn", "waiting", "done", "stale"]);
const WARM = new THREE.Color(1.0, 0.8, 0.55);
// Frames a second per PERFORMANCE choice; POWER SAVER draws only when something changes or moves.
const FPS = { smooth: 30, balanced: 15, saver: 30 };
const ease = (k) => 1 - Math.pow(1 - Math.min(1, Math.max(0, k)), 3);

export function mountWorld(canvas, opts = {}) {
  const sc = createScene(canvas, { fps: FPS.smooth });
  const view = new View();
  if (opts.insets) view.setInsets(opts.insets);
  const balls = new Balls();
  sc.scene.add(balls.mesh);

  let theme = opts.theme === "dark" ? "dark" : "light";
  let L = lookFor(theme);
  let lanes = [], vitals = {}, p = null;
  let built = null;
  const rising = new Map();  // lane -> start time
  const folding = new Map(); // lane -> start time
  let hqName = opts.hq ?? "hq", hqStatus = "moving";
  let selected = null;
  let mode = "smooth", paused = false, dirty = true, frames = 0;
  let turn = null, wallScale = 1;

  // Each room's light: one Color, shared by the room's own materials (a uniform) and by the walls (a slot in an array).
  // Outdoors has its own: the moon at night.
  const roomArray = { value: Array.from({ length: MAX_ROOMS }, () => new THREE.Color(0, 0, 0)) };
  const outdoor = roomLight();
  function indexOf(id) {
    if (!built.slots.has(id)) built.slots.set(id, Math.min(MAX_ROOMS - 1, built.slots.size + 1));
    return built.slots.get(id);
  }
  function lightOf(id) {
    if (!built.lights.has(id)) {
      const u = roomLight();
      u.value = roomArray.value[indexOf(id)];
      built.lights.set(id, u);
    }
    return built.lights.get(id);
  }

  function teardown() {
    if (!built) return;
    sc.scene.remove(built.root);
    built.rooms.dispose();
    built.root.traverse((o) => { o.geometry?.dispose(); if (o.material && !Array.isArray(o.material)) o.material.dispose(); });
    for (const o of built.offices.values()) o.worker?.dispose();
    built = null;
  }

  // Builds every room for the plan. added: lanes whose office rises; folded: lanes whose office folds away.
  function build(added = [], folded = []) {
    teardown();
    rising.clear(); folding.clear();
    for (const c of roomArray.value) c.setRGB(0, 0, 0);
    outdoor.value.set(L.moon ?? "#000000");
    built = { root: new THREE.Group(), lights: new Map(), slots: new Map(), offices: new Map(), suite: null, lounge: null, rooms: null, cuts: null, wallIndex: new Map(), taken: new Map() };
    built.root.name = "world";
    for (const r of p.rooms) lightOf(r.id);
    built.rooms = buildRooms(p, L, lightOf, roomArray, indexOf, outdoor);
    built.root.add(built.rooms.group);
    p.walls.forEach((w, i) => built.wallIndex.set(`${w.dir}:${w.x}:${w.z}`, i));
    const now = performance.now();
    for (const room of p.offices) {
      const o = buildOffice(room, L, lightOf(room.id));
      o.room = room;
      if (!room.vacant) {
        o.worker = new Worker(room.lane, L, lightOf(room.id));
        o.group.add(o.worker.root);
        o.worker.place({ seat: OFFICE_SPOTS.seat, stand: OFFICE_SPOTS.stand, faceDesk: Math.PI });
        o.worker.setSelected(room.lane === selected);
      } else if (folded.includes(room.lane)) folding.set(room.lane, now);
      else o.group.visible = false; // a lane that left: its office stands empty, floor and walls only
      built.root.add(o.group);
      built.offices.set(room.lane, o);
    }
    if (p.hq) {
      const s = buildSuite(p.hq, L, lightOf(p.hq.id));
      s.room = p.hq;
      s.worker = new Worker(hqName, L, lightOf(p.hq.id));
      s.group.add(s.worker.root);
      s.worker.place({ seat: SUITE_SPOTS.seat, stand: SUITE_SPOTS.stand, faceDesk: Math.PI });
      built.root.add(s.group);
      built.suite = s;
    }
    const br = p.rooms.find((r) => r.kind === "break");
    if (br) { built.lounge = buildBreak(br, L, lightOf(br.id)); built.lounge.room = br; built.root.add(built.lounge.group); }
    sc.scene.add(built.root);
    sc.setLights(L, p.bounds);
    for (const lane of added) if (built.offices.has(lane)) { rising.set(lane, now); built.offices.get(lane).group.scale.y = 0.01; }
    applyCuts();
    built.rooms.setWallScale(wallScale);
    built.root.updateMatrixWorld(true);
    applyStatus(true);
    applyVitals();
    dirty = true;
  }

  // The cutaway for the current rotation, and the posters that hang on a wall that is now cut.
  function applyCuts() {
    built.cuts = built.rooms.setRotation(view.rotation);
    const wallAt = (room, lx) => {
      const w = toWorld(room, lx, 0);
      const k = room.back === "w" || room.back === "e" ? `z:${Math.round(w.x)}:${Math.floor(w.z)}` : `x:${Math.floor(w.x)}:${Math.round(w.z)}`;
      const i = built.wallIndex.get(k);
      return i === undefined ? true : built.cuts[i];
    };
    for (const o of [...built.offices.values(), built.suite, built.lounge]) {
      if (!o?.wallPoster) continue;
      const cut = wallAt(o.room, o.wallPoster.position.x);
      o.wallPoster.visible = !cut;
      if (o.leanPoster) o.leanPoster.visible = cut;
    }
    dirty = true;
  }

  const laneOf = (name) => lanes.find((l) => l.name === name);

  function light(o, status, vacant) {
    const night = L.night;
    const lit = !vacant && LIT.has(status);
    const red = status === "needs_you" || status === "blocked";
    if (o.screen) {
      const c = vacant || !lit || status === "stale" ? null : STATUS[status];
      o.screen.material.map = screenTexture(c ? status : "off", c);
      o.screen.material.needsUpdate = true;
    }
    if (o.shade) o.shade.material.color.set(red ? "#ff5a5f" : night && lit ? "#ffe2a8" : "#d9d3c6");
    if (o.lantern) o.lantern.material.color.set(night ? (lit ? "#ffe6b4" : "#6b6252") : L.lantern.paper);
    if (o.pool) {
      o.pool.visible = night && lit;
      o.pool.material.map = glow(red ? "rgba(255,110,110,0.55)" : "rgba(255,214,150,0.55)");
      o.pool.material.needsUpdate = true;
    }
    const u = lightOf(o.room.id);
    if (night) u.value.copy(WARM).multiplyScalar(lit ? L.light.room : 0.07);
    else u.value.setRGB(0, 0, 0);
  }

  // fresh: just built, so a worker who should be in the break area is put there, not walked there.
  function applyStatus(fresh = false) {
    for (const [lane, o] of built.offices) {
      const l = laneOf(lane);
      const st = o.room.vacant ? "gone" : l?.status ?? "parked";
      light(o, st, o.room.vacant);
      if (!o.worker) continue;
      o.worker.setStatus(st, l?.blocking ?? 0);
      errand(o, st === "done", fresh);
    }
    if (built.suite) {
      light(built.suite, hqStatus, false);
      built.suite.worker.setStatus(hqStatus);
    }
    if (built.lounge) light(built.lounge, "moving", false);
    for (const [id, u] of built.lights) {
      if (id.startsWith("hall") || id.startsWith("wing")) u.value.copy(WARM).multiplyScalar(L.night ? 0.2 : 0);
    }
    dirty = true;
  }

  // A done worker walks to the break area and stands there with a mug; when its lane moves on, it walks back.
  function errand(o, wantBreak, fresh) {
    const w = o.worker, lane = o.room.lane, lounge = built.lounge;
    if (!lounge) return;
    const seat = o.group.localToWorld(OFFICE_SPOTS.seat.clone());
    if (wantBreak && !w.out) {
      const used = new Set(built.taken.values());
      const i = lounge.spots.findIndex((_, k) => !used.has(k));
      if (i < 0) return; // the break area is full: this one stays at the desk with its mug
      built.taken.set(lane, i);
      const s = lounge.spots[i];
      const at = lounge.group.localToWorld(new THREE.Vector3(s.x, 0, s.z));
      const ry = lounge.group.rotation.y + s.ry;
      built.root.add(w.root);
      const path = fresh ? null : route(p, seat.x, seat.z, lounge.room.id);
      if (!path) { w.standAt(at.x, at.z, ry); return; }
      w.root.position.set(seat.x, 0, seat.z);
      w.walk([...path.slice(1), at], () => w.standAt(at.x, at.z, ry));
    } else if (!wantBreak && w.out) {
      built.taken.delete(lane);
      const back = () => {
        o.group.add(w.root);
        w.home();
        if (laneOf(lane)?.status === "done") errand(o, true, false);
      };
      const path = fresh ? null : route(p, w.root.position.x, w.root.position.z, o.room.id);
      if (!path) { back(); return; }
      w.walk([...path, seat], back);
    }
  }

  function applyVitals() {
    const now = performance.now();
    const seen = new Set();
    for (const [lane, o] of built.offices) {
      const v = vitals[lane];
      seen.add(lane);
      if (!v || o.room.vacant) { balls.drop(lane, now); continue; }
      o.group.updateMatrixWorld(true);
      balls.set(lane, v.subagents ?? [], o.group.matrixWorld, BALL_CENTRE, now);
    }
    // HQ's subagents hop round its desk in the suite (the suite's desk stands where an office's does)
    const hv = vitals[hqName];
    if (built.suite && hv) {
      seen.add(hqName);
      built.suite.group.updateMatrixWorld(true);
      balls.set(hqName, hv.subagents ?? [], built.suite.group.matrixWorld, BALL_CENTRE, now);
    }
    for (const lane of balls.desks.keys()) if (!seen.has(lane)) balls.drop(lane, now);
    dirty = true;
  }

  // lanes: [{ name, parent, status, blocking }] in the order they appeared; vitals: S.vitals (by lane name).
  function setLanes(next, nextVitals = vitals) {
    lanes = next.filter((l) => l.name !== hqName).map((l) => ({ name: l.name, parent: l.parent ?? null, status: l.status ?? "hq_turn", blocking: l.blocking ?? 0 }));
    vitals = nextVitals ?? {};
    const live = (q) => new Set(q?.offices.filter((o) => !o.vacant).map((o) => o.lane) ?? []);
    const before = live(p);
    const np = makePlan(lanes, p, { hq: hqName });
    const sig = (q) => q?.rooms.map((r) => `${r.id}@${r.x},${r.z},${r.w},${r.d},${r.vacant ? 1 : 0}`).join("|") ?? "";
    const first = !p, moved = sig(p) !== sig(np);
    p = np;
    if (moved || !built) {
      const after = live(np);
      const added = first ? [] : [...after].filter((n) => !before.has(n));
      const folded = first ? [] : [...before].filter((n) => !after.has(n));
      build(added, folded);
      if (view.fitting || first) view.fit(p.bounds, first);
      emit("world:layout", p.offices.filter((o) => !o.vacant).map((o) => o.lane));
    } else {
      applyStatus();
      applyVitals();
    }
  }

  // HQ's own desk in the suite: its name (S.hq.agent) and what it shows.
  function setHq(name, status) {
    const renamed = name && name !== hqName;
    if (name) hqName = name;
    hqStatus = status ?? hqStatus;
    if (renamed && p) { p = null; setLanes(lanes, vitals); return; }
    if (built?.suite) { light(built.suite, hqStatus, false); built.suite.worker.setStatus(hqStatus); dirty = true; }
  }

  function setTheme(t) {
    const next = t === "dark" ? "dark" : "light";
    if (next === theme) return;
    theme = next;
    L = lookFor(theme);
    if (p) build();
  }

  function setSelected(lane) {
    selected = lane;
    if (!built) return;
    for (const [name, o] of built.offices) o.worker?.setSelected(name === lane);
    dirty = true;
  }

  function setPerformance(m) {
    mode = m in FPS ? m : "smooth";
    sc.setFps(FPS[mode]);
    dirty = true;
  }

  // While a conference room covers the office, nothing is drawn.
  function setPaused(on) {
    paused = !!on;
    dirty = true;
  }

  function rotate(dir) {
    view.rotate(dir);
    if (!built) return;
    // the walls go down to the kerbs, the cutaway swaps at the bottom, and they come up again for the new side
    turn = { at: performance.now(), from: wallScale, swapped: false };
  }

  function zoom(level) { view.zoom(level); dirty = true; }

  function fit() { if (p) { view.fit(p.bounds); dirty = true; } }

  // Centre on some lanes' desks (the mean of their offices).
  function focusLanes(names, now = false) {
    const pts = names.map((n) => deskAnchor(n)).filter(Boolean);
    if (!pts.length) return;
    const c = pts.reduce((a, b) => a.add(b), new THREE.Vector3()).multiplyScalar(1 / pts.length);
    view.focus(c.x, c.z, now);
    dirty = true;
  }

  function deskAnchor(lane) {
    const o = lane === hqName ? built?.suite : built?.offices.get(lane);
    if (!o || o.room.vacant) return null;
    o.group.updateMatrixWorld(true);
    return o.group.localToWorld((lane === hqName ? SUITE_SPOTS.hud : OFFICE_SPOTS.hud).clone());
  }

  function project(v3) {
    const v = v3.clone().project(view.camera);
    const w = canvas.clientWidth, h = canvas.clientHeight;
    const x = (v.x + 1) / 2 * w, y = (1 - v.y) / 2 * h;
    return { x, y, visible: v.z > -1 && v.z < 1 && x >= -40 && x <= w + 40 && y >= -40 && y <= h + 40 };
  }

  function addToWorld(obj, lane) {
    if (!built) return false;
    const o = lane ? (lane === hqName ? built.suite : built.offices.get(lane)) : null;
    (o ? o.group : sc.scene).add(obj);
    dirty = true;
    return true;
  }

  // Picking: a worker (wherever it is) or anything in an office selects its lane.
  const ray = new THREE.Raycaster();
  function pick(clientX, clientY) {
    if (!built) return null;
    const r = canvas.getBoundingClientRect();
    ray.setFromCamera(new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1), view.camera);
    const targets = [...built.offices.values()].flatMap((o) => (o.group.visible ? [o.group] : []));
    for (const o of built.offices.values()) if (o.worker?.out) targets.push(o.worker.root);
    if (built.suite) targets.push(built.suite.group);
    for (const h of ray.intersectObjects(targets, true)) {
      if (h.object.name === "balls" || !h.object.visible) continue;
      for (let o = h.object; o; o = o.parent) {
        if (o.name.startsWith("worker:")) return o.name.slice(7);
        if (o.name.startsWith("office:")) return o.name.slice(7);
        if (o.name === "hq") return hqName;
      }
    }
    return null;
  }

  // Controls: drag to pan, wheel to zoom, click to select; the pointer over a worker or desk is its lane's hover.
  const cleanups = [];
  let hoverAt = null, hoverSeen = null, hovered = null;
  if (opts.controls !== false) {
    let drag = null;
    const down = (e) => { drag = { x: e.clientX, y: e.clientY, moved: false }; };
    const move = (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) < 4) return;
      drag.moved = true;
      view.pan(dx, dy);
      dirty = true;
      drag.x = e.clientX; drag.y = e.clientY;
    };
    const up = (e) => {
      if (drag && !drag.moved && e.target === canvas) { const lane = pick(e.clientX, e.clientY); if (lane) emit("world:select", lane); }
      drag = null;
    };
    const cancel = () => { drag = null; };
    const hover = (e) => { if (!drag) hoverAt = { x: e.clientX, y: e.clientY }; };
    const leave = () => { hoverAt = null; };
    const wheel = (e) => { e.preventDefault(); view.zoomBy(Math.exp(-e.deltaY * 0.0015)); dirty = true; };
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
    if (hoverAt === hoverSeen) return;
    hoverSeen = hoverAt;
    const lane = hoverAt ? pick(hoverAt.x, hoverAt.y) : null;
    if (lane === hovered) return;
    hovered = lane;
    canvas.style.cursor = lane ? "pointer" : "";
    emit("world:hover", lane);
  }

  function resize() {
    const w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight;
    sc.resize(w, h);
    view.resize(w, h);
    dirty = true;
  }
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  function animate(now) {
    if (turn) {
      const k = (now - turn.at) / TURN_MS;
      if (k < 0.5) wallScale = turn.from + (LOW - turn.from) * ease(k / 0.5);
      else {
        if (!turn.swapped) { applyCuts(); turn.swapped = true; }
        wallScale = LOW + (1 - LOW) * ease((k - 0.5) / 0.5);
      }
      if (k >= 1) { wallScale = 1; turn = null; }
      built?.rooms.setWallScale(wallScale);
    }
    for (const [lane, at] of rising) {
      const o = built.offices.get(lane), k = (now - at) / RISE_MS;
      o.group.scale.y = 0.01 + ease(k) * 0.99;
      if (k >= 1) rising.delete(lane);
    }
    for (const [lane, at] of folding) {
      const o = built.offices.get(lane), k = (now - at) / RISE_MS;
      o.group.scale.y = Math.max(0.01, 1 - ease(k));
      if (k >= 1) { o.group.visible = false; folding.delete(lane); }
    }
  }

  const walking = () => built && [...built.offices.values()].some((o) => o.worker?.walking);

  function tick(now, dt) {
    if (paused) return;
    updateHover();
    const moving = view.update(dt);
    const busy = moving || turn || rising.size || folding.size || walking();
    // POWER SAVER: an office where nothing changed and nothing moves draws no frame
    if (mode === "saver" && !busy && !dirty) return;
    if (built) {
      animate(now);
      const t = now / 1000;
      for (const o of built.offices.values()) o.worker?.update(t, dt, view.az - o.group.rotation.y);
      built.suite?.worker.update(t, dt, view.az - built.suite.group.rotation.y);
    }
    balls.update(now);
    runFrame(now, dt);
    sc.renderer.render(sc.scene, view.camera);
    frames++;
    dirty = false;
  }
  // one frame now, so a caller (or a screenshot) sees the world before the loop's first tick
  const renderNow = () => { dirty = true; tick(performance.now(), 1 / 30); };
  sc.start(tick);

  // What the world shows, for tests and the lab: read-only numbers and names, never the scene itself.
  function inspect() {
    const side = cameraSide(view.rotation);
    const cam = view.camera.position;
    return {
      offices: p ? p.offices.filter((o) => !o.vacant).map((o) => o.lane) : [],
      vacant: p ? p.offices.filter((o) => o.vacant).map((o) => o.lane) : [],
      stage: p?.stageName ?? null,
      rotation: view.rotation,
      cameraSide: side,
      camera: { x: cam.x, z: cam.z },
      // the direction from what the camera looks at toward the camera, on the ground (radians, 0 = +z)
      azimuth: view.az,
      turning: !!turn,
      frames,
      // what the last frame drew
      calls: sc.renderer.info.render.calls,
      triangles: sc.renderer.info.render.triangles,
      selected,
      hovered,
      mode,
      paused,
    };
  }

  // The four sides of a lane's office: their middle, whether each wall tile of the side is cut down to the kerb, and
  // whether the side is an outer wall of the building.
  function officeWalls(lane) {
    const room = p?.offices.find((o) => o.lane === lane);
    if (!room || !built?.cuts) return null;
    const sides = {
      n: { mid: { x: room.x + room.w / 2, z: room.z }, of: (w) => w.dir === "x" && w.z === room.z },
      s: { mid: { x: room.x + room.w / 2, z: room.z + room.d }, of: (w) => w.dir === "x" && w.z === room.z + room.d },
      w: { mid: { x: room.x, z: room.z + room.d / 2 }, of: (w) => w.dir === "z" && w.x === room.x },
      e: { mid: { x: room.x + room.w, z: room.z + room.d / 2 }, of: (w) => w.dir === "z" && w.x === room.x + room.w },
    };
    const inRun = (w) => (w.dir === "x" ? w.x >= room.x && w.x < room.x + room.w : w.z >= room.z && w.z < room.z + room.d);
    return Object.entries(sides).map(([name, s]) => {
      const idx = p.walls.map((w, i) => (s.of(w) && inRun(w) ? i : -1)).filter((i) => i >= 0);
      return { side: name, mid: s.mid, cut: idx.map((i) => built.cuts[i]), outer: idx.length > 0 && idx.every((i) => !p.walls[i].a || !p.walls[i].b) };
    });
  }

  // A lane's worker on the canvas, in CSS pixels: its chest, and what it is doing.
  function workerOf(lane) {
    const o = lane === hqName ? built?.suite : built?.offices.get(lane);
    const w = o?.worker;
    if (!w) return null;
    w.root.updateMatrixWorld(true);
    const at = project(w.root.localToWorld(new THREE.Vector3(0, 0.95, 0)));
    return { x: at.x, y: at.y, visible: at.visible && w.root.visible, pose: w.pose, out: w.out, marker: w.marker ? { color: w.marker.color, glyph: w.marker.glyph } : null, selected: w.ring.visible };
  }

  const api = {
    setLanes, setHq, setTheme, setSelected, setPerformance, setPaused, rotate, zoom, fit, focusLanes, renderNow,
    setInsets: (i) => { view.setInsets(i); dirty = true; },
    deskAnchor, project, addToWorld, pick, inspect, officeWalls, workerOf,
    get view() { return view; },
    get plan() { return p; },
    get renderer() { return sc.renderer; },
    dispose() { sc.stop(); ro.disconnect(); cleanups.forEach((f) => f()); teardown(); balls.dispose(); sc.renderer.dispose(); bindWorld(null); },
  };
  bindWorld(api);
  emit("world:ready");
  return api;
}
