// createWorld: a world file on a canvas. It validates the world (throwing every problem with its fix), builds the lot,
// the nav grid, the architecture for the wall mode and rotation, the objects and the characters, and runs the loop:
// a frame on every animation frame while anything moves, none while the view is still, and no cap during interaction.
import * as THREE from "three";
import { buildLot } from "../lot/lot.js";
import { WorldError } from "../model/problems.js";
import { FLOOR_Y, tileKey } from "../model/grid.js";
import { buildPrims } from "../catalog/define.js";
import { createNav } from "../nav/nav.js";
import { createSim } from "../sim/index.js";
import { floorAt as floorOf } from "../sim/motion.js";
import { cutaway, WALL_MODES } from "../arch/cutaway.js";
import { buildArchitecture } from "../arch/build.js";
import { createCamera, stepCamera, cameraPose, project as projectPose, unproject, rotateCamera, zoomCamera, panCamera, fitCamera } from "../camera/rig.js";
import { createStage } from "../render/stage.js";
import { createMaterials } from "../render/materials.js";
import { primsToGroup } from "../render/meshes.js";
import { buildCharacter } from "../render/character.js";

const STEP = 1000 / 60;   // ms, the simulation step of the manual clock

/**
 * @typedef {object} WorldOptions
 * @property {"light"|"dark"} [theme]
 * @property {string} [time]                 "hh:mm"; default 14:00 (light) or 21:00 (dark)
 * @property {"up"|"cutaway"|"down"} [walls]
 * @property {string|null} [focusRoom]       cut only the walls in front of this room
 * @property {number} [rot]
 * @property {number} [zoom]                 0..2; default: the nearest step that fits the lot at every rotation
 * @property {"raf"|"manual"} [clock]        manual: nothing moves until advance(ms) (tests, shots)
 * @property {{ w: number, h: number, dpr?: number }} [size]   default: the canvas's CSS size
 * @property {{ x: number, y: number }} [offset]   where the view's centre sits, CSS px from the canvas centre
 * @property {boolean} [startActs]           run the world's acts at once (default true)
 * @property {import("../sim/ecs.js").System[]} [systems]   the host's own systems, run after the engine's step systems
 * @property {{ screenNoise?: boolean, noSnap?: boolean, shadowRadius?: number }} [debug]   reproduce the old defects, for comparisons
 */

/** @stability stable */
export function createWorld(canvas, world, opts = {}) {
  const { lot, catalog } = buildLot(world);
  const nav = createNav(lot);
  let theme = opts.theme === "dark" ? "dark" : "light";
  let time = opts.time ?? (theme === "dark" ? "21:00" : "14:00");
  let wallMode = WALL_MODES.includes(opts.walls) ? opts.walls : "cutaway";
  let focusRoom = opts.focusRoom ?? null;
  let palette = catalog.palette(theme);
  const debug = opts.debug ?? {};

  const stage = createStage(canvas);
  if (debug.shadowRadius) stage.sun.shadow.radius = debug.shadowRadius;
  const materials = createMaterials({ screenNoise: !!debug.screenNoise });
  const { scene, renderer } = stage;
  const size = () => opts.size ?? { w: canvas.clientWidth || 800, h: canvas.clientHeight || 600, dpr: Math.min(window.devicePixelRatio || 1, 2) };
  const s0 = size();
  const cam = createCamera({ w: s0.w, h: s0.h, dpr: s0.dpr ?? 1, rot: opts.rot ?? 0, snap: !debug.noSnap, offset: opts.offset ?? { x: 0, y: 0 }, bounds: { minX: 0, minZ: 0, maxX: lot.w, maxZ: lot.d } });
  const lotBox = indoorBox(lot);
  fitCamera(cam, lotBox);
  if (opts.zoom !== undefined) { cam.zoom = opts.zoom; cam.ppm = [22.6, 45.3, 90.5][opts.zoom] ?? cam.ppm; }
  stage.resize(s0.w, s0.h, s0.dpr);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 400);
  stage.setShadowBox({ min: [-2, 0, -2], max: [lot.w + 2, 3.2, lot.d + 2] });

  const events = new Map();
  const emit = (name, data) => { for (const fn of events.get(name) ?? []) { try { fn(data); } catch (e) { console.error(`world ${name} handler failed`, e); } } };

  // --- architecture: one group per cut set, cached; walls never scale, an edge is full or kerb
  const archCache = new Map();
  let arch = null, archKey = "";
  const cutNow = () => {
    const at = (rot) => cutaway(lot, { mode: wallMode, rot, focus: focusRoom });
    if (!cam.turn) return at(cam.rot);
    // during a turn: the walls cut at either end stay cut, so no wall rises in front of the view mid-turn
    return new Set([...at(cam.rot - Math.sign(cam.turn.to - cam.turn.from)), ...at(cam.rot)]);
  };
  function syncArch() {
    const cut = cutNow();
    const key = `${theme}|${[...cut].sort().join(" ")}`;
    if (key === archKey) return false;
    if (!archCache.has(key)) {
      if (archCache.size > 24) { for (const g of archCache.values()) disposeGroup(g); archCache.clear(); }
      archCache.set(key, primsToGroup(buildArchitecture(lot, catalog, cut), palette, materials, { name: "architecture" }));
    }
    if (arch) scene.remove(arch);
    arch = archCache.get(key);
    arch.userData.cut = cut;
    scene.add(arch);
    archKey = key;
    stage.invalidateShadows();
    return true;
  }

  // --- objects: one group per object, in its own frame (attach() parents app objects to it)
  const objectsGroup = new THREE.Group();
  objectsGroup.name = "objects";
  scene.add(objectsGroup);
  const objectGroups = new Map();
  const lamps = [];
  function buildObjects() {
    for (const g of objectGroups.values()) { objectsGroup.remove(g); disposeGroup(g, true); }
    objectGroups.clear();
    for (const l of lamps) scene.remove(l);
    lamps.length = 0;
    for (const o of lot.objects) {
      const g = primsToGroup(buildPrims(o.def), palette, materials, { name: `object:${o.id}` });
      g.position.set(...o.pos);
      g.rotation.y = o.q * (Math.PI / 2);
      g.userData.entity = o.id;
      g.traverse((m) => { if (m.isMesh) m.userData.entity = o.id; });
      objectsGroup.add(g);
      objectGroups.set(o.id, g);
      if (o.anchors.light) {
        const l = new THREE.PointLight(palette.lamp ?? "#ffe3ad", 0, 5, 1.6);
        l.position.set(...o.anchors.light);
        scene.add(l);
        lamps.push(l);
      }
    }
  }

  // --- characters: the simulation (pure, an ECS) owns their state; the meshes only mirror it (renderSync)
  const sim = createSim(lot, nav, { systems: opts.systems, emit: (name, data) => emit(name, data) });
  const charGroup = new THREE.Group();
  charGroup.name = "characters";
  scene.add(charGroup);
  const meshes = new Map();
  const floorAt = (x, z) => floorOf(lot, x, z);
  function buildCharacters() {
    for (const m of meshes.values()) { charGroup.remove(m.root); m.dispose(); }
    meshes.clear();
    for (const [id, c] of sim.ecs.query("character")) {
      const mesh = buildCharacter(id, c.look, palette, materials);
      charGroup.add(mesh.root);
      meshes.set(id, mesh);
    }
    renderSync();
  }
  function renderSync() {
    for (const [id, , b] of sim.ecs.query("character", "body")) {
      const m = meshes.get(id);
      if (!m) continue;
      m.root.position.set(b.x, floorAt(b.x, b.z), b.z);
      m.root.rotation.y = b.ry;
      m.setHips(b.hips);
      m.setPose(sim.pose(id));
    }
  }

  // --- the frame
  let dirty = true;
  function simulate(dtMs) {
    const moving = stepCamera(cam, dtMs);
    let busy = moving;
    busy = sim.step(dtMs / 1000) || busy;
    renderSync();
    if (meshes.size) stage.invalidateShadows();
    syncArch();
    return busy;
  }
  let pose = cameraPose(cam);
  function render() {
    pose = cameraPose(cam);
    camera.position.set(...pose.position);
    camera.up.set(...pose.up);
    camera.lookAt(...pose.target);
    const f = pose.frustum;
    camera.left = f.left; camera.right = f.right; camera.top = f.top; camera.bottom = f.bottom;
    camera.near = 1; camera.far = 400;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    emit("frame", { pose });
    renderer.render(scene, camera);
    dirty = false;
  }

  // Every animation frame while something moves (no cap during interaction); nothing while the view is still. Idle
  // animation alone (characters breathing, typing) may be limited with opts.idleFps.
  let raf = 0, last = 0, lastDraw = 0, running = false;
  function loop(now) {
    if (!running) return;
    raf = requestAnimationFrame(loop);
    const dt = last ? Math.min(100, now - last) : STEP;
    last = now;
    const busy = simulate(dt);
    const ambient = meshes.size > 0 && (!opts.idleFps || now - lastDraw >= 1000 / opts.idleFps - 1);
    if (busy || dirty || ambient) { render(); lastDraw = now; }
  }
  function start() { if (running || (opts.clock ?? "raf") !== "raf") return; running = true; last = 0; raf = requestAnimationFrame(loop); }

  function applyTime() {
    const { night } = stage.setTime(time, palette);
    for (const l of lamps) { l.intensity = 2.2 * night; l.color.set(palette.lamp); }
    dirty = true;
  }

  buildObjects();
  buildCharacters();
  applyTime();
  syncArch();
  if (opts.startActs !== false) for (const a of world.doc.acts) sim.act(a.who, a).catch((e) => console.error(e));
  render();
  start();

  let ro = null;
  if (!opts.size && typeof ResizeObserver !== "undefined") {
    ro = new ResizeObserver(() => { const s = size(); cam.w = s.w; cam.h = s.h; cam.dpr = s.dpr ?? 1; stage.resize(s.w, s.h, s.dpr); dirty = true; if ((opts.clock ?? "raf") !== "raf") render(); });
    ro.observe(canvas);
  }

  // --- picking and hover
  const ray = new THREE.Raycaster();
  function pick(clientX, clientY) {
    const r = canvas.getBoundingClientRect();
    const x = clientX - r.left, y = clientY - r.top;
    ray.setFromCamera(new THREE.Vector2((x / r.width) * 2 - 1, -(y / r.height) * 2 + 1), camera);
    const hit = ray.intersectObjects([charGroup, objectsGroup], true).find((h) => h.object.userData.entity);
    const ground = unproject(pose, [x, y], FLOOR_Y);
    const tile = [Math.floor(ground[0]), Math.floor(ground[2])];
    if (hit) return { kind: meshes.has(hit.object.userData.entity) ? "character" : "object", id: hit.object.userData.entity, tile };
    if (tile[0] < 0 || tile[1] < 0 || tile[0] >= lot.w || tile[1] >= lot.d) return null;
    return { kind: "tile", tile, room: lot.roomAt.get(tileKey(...tile)) };
  }
  let hovered = null;
  function highlight(id) {
    if (id === hovered) return;
    const swap = (gid, on) => objectGroups.get(gid)?.traverse((m) => {
      if (!m.isMesh || m.userData.finish !== "matte") return;
      if (on) { m.userData.mat = m.material; m.material = materials.highlight; } else if (m.userData.mat) m.material = m.userData.mat;
    });
    if (hovered) swap(hovered, false);
    hovered = id;
    if (id) swap(id, true);
    dirty = true;
    if (!running) render();
  }

  const view = {
    lot, catalog, nav,
    camera: {
      rotate(dir) { rotateCamera(cam, dir); dirty = true; emit("camera", { rot: cam.rot }); },
      zoom(step) { zoomCamera(cam, step); dirty = true; },
      pan(dx, dy) { panCamera(cam, dx, dy); dirty = true; },
      focusOn(x, z) { cam.focus = [x, z]; dirty = true; },
      fit() { fitCamera(cam, lotBox); dirty = true; },
      pose: () => cameraPose(cam),
      get state() { return { rot: cam.rot, az: cam.az, zoom: cam.zoom, ppm: cam.ppm, focus: [...cam.focus], turning: !!cam.turn } },
    },
    setWalls(mode, room = null) { if (WALL_MODES.includes(mode)) wallMode = mode; focusRoom = room; syncArch(); dirty = true; if (!running) render(); },
    setTheme(t) {
      theme = t === "dark" ? "dark" : "light";
      palette = catalog.palette(theme);
      for (const g of archCache.values()) disposeGroup(g);
      archCache.clear(); archKey = "";
      buildObjects(); buildCharacters(); applyTime(); syncArch();
      if (!running) render();
    },
    setTime(t) { time = t; applyTime(); if (!running) render(); },
    act: sim.act,
    character: sim.character,
    sim,
    pick,
    hover(clientX, clientY) { const p = pick(clientX, clientY); highlight(p?.kind === "object" ? p.id : null); emit("hover", p); return p; },
    project(p) { const q = projectPose(pose, p); const d = pose.dpr; return { x: Math.round(q.x * d) / d, y: Math.round(q.y * d) / d, visible: q.x >= 0 && q.y >= 0 && q.x <= pose.w && q.y <= pose.h }; },
    anchor(id, name) {
      const o = lot.objects.find((x) => x.id === id);
      if (o) return o.anchors[name] ?? null;
      const c = sim.ecs.get(id, "body");
      return c ? [c.x, floorAt(c.x, c.z) + c.hips + 0.95, c.z] : null;
    },
    attach(obj, id) { const g = objectGroups.get(id) ?? meshes.get(id)?.root; if (!g) return false; g.add(obj); dirty = true; return true; },
    on(name, fn) { if (!events.has(name)) events.set(name, new Set()); events.get(name).add(fn); return () => events.get(name).delete(fn); },
    advance(ms) { let left = ms; while (left > 1e-6) { const d = Math.min(STEP, left); simulate(d); left -= d; } render(); return view.inspect(); },
    render() { render(); },
    bindInput(el = canvas) { return bindInput(view, el, emit); },
    inspect() {
      return { rot: ((cam.rot % 4) + 4) % 4, zoom: cam.zoom, walls: wallMode, focusRoom, theme, time, cut: [...(arch?.userData.cut ?? [])].sort(),
        camera: { y: pose.position[1], position: pose.position, target: pose.target, az: cam.az, ppm: cam.ppm, snapped: pose.snapped },
        characters: sim.characters().map((id) => sim.character(id)), draws: renderer.info.render.calls, triangles: renderer.info.render.triangles };
    },
    three: { renderer, scene, camera },
    get dirty() { return dirty; },
    dispose() {
      running = false; cancelAnimationFrame(raf); ro?.disconnect();
      for (const g of archCache.values()) disposeGroup(g);
      for (const g of objectGroups.values()) disposeGroup(g, true);
      for (const m of meshes.values()) m.dispose();
      materials.dispose(); renderer.dispose();
    },
  };
  return view;
}

// The floored part of the lot (what the view fits), or the whole lot when nothing is floored.
function indoorBox(lot) {
  let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
  for (const k of lot.floor.keys()) { const [x, z] = k.split(",").map(Number); minX = Math.min(minX, x); minZ = Math.min(minZ, z); maxX = Math.max(maxX, x + 1); maxZ = Math.max(maxZ, z + 1); }
  return minX === Infinity ? { minX: 0, minZ: 0, maxX: lot.w, maxZ: lot.d } : { minX, minZ, maxX, maxZ };
}

function disposeGroup(g, keepMaterials = true) {
  g.traverse((o) => { o.geometry?.dispose(); if (!keepMaterials) o.material?.dispose?.(); });
}

// Drag to pan, wheel to step the zoom, click to pick (emits "pick"), move to hover. Returns a function that unbinds.
function bindInput(view, el, emit) {
  let drag = null, wheelAt = 0;
  const down = (e) => { drag = { x: e.clientX, y: e.clientY, moved: false }; el.setPointerCapture?.(e.pointerId); };
  const move = (e) => {
    if (!drag) { view.hover(e.clientX, e.clientY); return; }
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < 4) return;
    drag.moved = true;
    view.camera.pan(dx, dy);
    drag.x = e.clientX; drag.y = e.clientY;
  };
  const up = (e) => {
    if (drag && !drag.moved) emit("pick", view.pick(e.clientX, e.clientY));
    drag = null;
  };
  const wheel = (e) => {
    e.preventDefault();
    const now = performance.now();
    if (now - wheelAt < 220) return;
    wheelAt = now;
    view.camera.zoom(view.camera.state.zoom + (e.deltaY < 0 ? 1 : -1));
  };
  el.addEventListener("pointerdown", down);
  el.addEventListener("pointermove", move);
  el.addEventListener("pointerup", up);
  el.addEventListener("wheel", wheel, { passive: false });
  return () => { el.removeEventListener("pointerdown", down); el.removeEventListener("pointermove", move); el.removeEventListener("pointerup", up); el.removeEventListener("wheel", wheel); };
}
