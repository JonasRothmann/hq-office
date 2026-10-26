// The world's entry: mountWorld(canvas, { look, theme }) builds the offices for the lanes and keeps them drawn.
import { THREE } from "./kit.js";
import { roomLight } from "./kit.js";
import { plan as makePlan, diff, toWorld } from "./plan.js";
import { lookFor, STATUS } from "./look.js";
import { View } from "./camera.js";
import { createScene } from "./scene.js";
import { buildRooms } from "./rooms.js";
import { buildOffice, buildSuite, buildBreak, OFFICE_SPOTS, SUITE_SPOTS } from "./furniture.js";
import { Worker } from "./people.js";
import { Balls } from "./balls.js";
import { screen as screenTexture, glow } from "./textures.js";
import { bindWorld, runFrame } from "./api.js";
import { emit } from "../core/bus.js";

const RISE_MS = 800;
const BALL_CENTRE = new THREE.Vector3(2, 0, 1.1);
const LIT = new Set(["moving", "needs_you", "blocked", "hq_turn", "waiting", "done", "stale"]);
const WARM = new THREE.Color(1.0, 0.8, 0.55);

export function mountWorld(canvas, opts = {}) {
  const sc = createScene(canvas, { fps: opts.fps ?? 30 });
  const view = new View();
  if (opts.insets) view.setInsets(opts.insets);
  const balls = new Balls();
  sc.scene.add(balls.mesh);

  let look = opts.look ?? "b", theme = opts.theme ?? "light";
  let L = lookFor(look, theme);
  let lanes = [], vitals = {}, p = null;
  let built = null;
  const rising = new Map(); // lane -> start time
  const hqName = opts.hq ?? "hq";

  function lightOf(id) {
    if (!built.lights.has(id)) built.lights.set(id, roomLight());
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

  function build(added = []) {
    teardown();
    built = { root: new THREE.Group(), lights: new Map(), offices: new Map(), suite: null, lounge: null, rooms: null, cuts: null, wallIndex: new Map() };
    built.root.name = "world";
    built.rooms = buildRooms(p, L, lightOf);
    built.root.add(built.rooms.group);
    p.walls.forEach((w, i) => built.wallIndex.set(`${w.dir}:${w.x}:${w.z}`, i));
    for (const room of p.offices) {
      const o = buildOffice(room, L, lightOf(room.id));
      o.room = room;
      if (!room.vacant) {
        o.worker = new Worker(room.lane, L, lightOf(room.id));
        o.group.add(o.worker.root);
        o.worker.place({ seat: OFFICE_SPOTS.seat, stand: OFFICE_SPOTS.stand, faceDesk: Math.PI });
      }
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
    const now = performance.now();
    for (const lane of added) if (built.offices.has(lane)) { rising.set(lane, now); built.offices.get(lane).group.scale.y = 0.01; }
    applyCuts();
    applyStatus();
    built.root.updateMatrixWorld(true);
    applyVitals();
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
  }

  function statusOf(name) {
    return lanes.find((l) => l.name === name)?.status ?? "parked";
  }

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

  function applyStatus() {
    for (const [lane, o] of built.offices) {
      const st = statusOf(lane);
      light(o, st, o.room.vacant);
      o.worker?.setStatus(o.room.vacant ? "gone" : st);
    }
    if (built.suite) {
      const st = lanes.find((l) => l.name === hqName)?.status ?? "moving";
      light(built.suite, st, false);
      built.suite.worker.setStatus(st);
    }
    if (built.lounge) light(built.lounge, "moving", false);
    for (const [id, u] of built.lights) {
      if (id.startsWith("hall") || id.startsWith("wing")) u.value.copy(WARM).multiplyScalar(L.night ? 0.2 : 0);
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
    for (const lane of balls.desks.keys()) if (!seen.has(lane)) balls.drop(lane, now);
  }

  function setLanes(next, nextVitals = vitals) {
    lanes = next.map((l) => ({ name: l.name, parent: l.parent ?? null, status: l.status ?? "hq_turn" }));
    vitals = nextVitals ?? {};
    const np = makePlan(lanes, p, { hq: hqName });
    const d = diff(p, np);
    const first = !p;
    p = np;
    if (d.moved || !built) {
      build(first ? [] : d.added);
      if (view.fitting || first) view.fit(p.bounds, first);
      emit("world:layout", p.offices.filter((o) => !o.vacant).map((o) => o.lane));
    } else {
      applyStatus();
      applyVitals();
    }
  }

  function setTheme(t) {
    theme = t === "dark" ? "dark" : "light";
    L = lookFor(look, theme);
    if (p) build();
  }

  function setLook(l) {
    look = l;
    L = lookFor(look, theme);
    if (p) build();
  }

  function rotate(dir) {
    view.rotate(dir);
    if (built) applyCuts();
  }

  function zoom(level) { view.zoom(level); }

  function fit() { if (p) view.fit(p.bounds); }

  // Centre on some lanes' desks (the mean of their offices).
  function focusLanes(names, now = false) {
    const pts = names.map((n) => deskAnchor(n)).filter(Boolean);
    if (!pts.length) return;
    const c = pts.reduce((a, b) => a.add(b), new THREE.Vector3()).multiplyScalar(1 / pts.length);
    view.focus(c.x, c.z, now);
  }

  function deskAnchor(lane) {
    const o = lane === hqName ? built?.suite : built?.offices.get(lane);
    if (!o) return null;
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
    return true;
  }

  // Picking: a click on a worker or an office selects its lane.
  const ray = new THREE.Raycaster();
  function pick(clientX, clientY) {
    if (!built) return null;
    const r = canvas.getBoundingClientRect();
    ray.setFromCamera(new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1), view.camera);
    const hits = ray.intersectObjects([...built.offices.values()].map((o) => o.group).concat(built.suite ? [built.suite.group] : []), true);
    for (const h of hits) {
      for (let o = h.object; o; o = o.parent) {
        if (o.name.startsWith("office:")) return o.name.slice(7);
        if (o.name === "hq") return hqName;
      }
    }
    return null;
  }

  // Controls: drag to pan, wheel to zoom, click to select.
  const cleanups = [];
  if (opts.controls !== false) {
    let drag = null;
    const down = (e) => { drag = { x: e.clientX, y: e.clientY, moved: false }; };
    const move = (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) < 4) return;
      drag.moved = true;
      view.pan(dx, dy);
      drag.x = e.clientX; drag.y = e.clientY;
    };
    const up = (e) => {
      if (drag && !drag.moved) { const lane = pick(e.clientX, e.clientY); if (lane) emit("world:select", lane); }
      drag = null;
    };
    const wheel = (e) => { e.preventDefault(); view.zoomBy(Math.exp(-e.deltaY * 0.0015)); };
    canvas.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    canvas.addEventListener("wheel", wheel, { passive: false });
    cleanups.push(() => { canvas.removeEventListener("pointerdown", down); window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); canvas.removeEventListener("wheel", wheel); });
  }

  function resize() {
    const w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight;
    sc.resize(w, h);
    view.resize(w, h);
  }
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  function tick(now, dt) {
    view.update(dt);
    if (built) {
      const t = now / 1000;
      for (const [lane, o] of built.offices) {
        if (o.worker) o.worker.update(t, dt, view.az - o.group.rotation.y);
        const at = rising.get(lane);
        if (at !== undefined) {
          const k = Math.min(1, (now - at) / RISE_MS);
          o.group.scale.y = 0.01 + (1 - Math.pow(1 - k, 3)) * 0.99;
          if (k >= 1) rising.delete(lane);
        }
      }
      built.suite?.worker.update(t, dt, view.az - built.suite.group.rotation.y);
    }
    balls.update(now);
    runFrame(now, dt);
    sc.renderer.render(sc.scene, view.camera);
  }
  // one frame now, so a caller (or a screenshot) sees the world before the loop's first tick
  const renderNow = () => tick(performance.now(), 1 / 30);
  sc.start(tick);

  const api = {
    setLanes, setTheme, setLook, rotate, zoom, fit, focusLanes, renderNow,
    setInsets: (i) => view.setInsets(i),
    deskAnchor, project, addToWorld, pick,
    get view() { return view; },
    get plan() { return p; },
    get renderer() { return sc.renderer; },
    dispose() { sc.stop(); ro.disconnect(); cleanups.forEach((f) => f()); teardown(); balls.dispose(); sc.renderer.dispose(); bindWorld(null); },
  };
  bindWorld(api);
  emit("world:ready");
  return api;
}
