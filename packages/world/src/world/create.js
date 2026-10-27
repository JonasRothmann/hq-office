// createWorld: a world file on a canvas. The driver (view/driver.js, pure) owns the lot, the sim, the camera and
// the frame policy; this file is the three.js side. It builds the architecture for the cut walls, an anchor group per
// object (its meshes, or an instance in its type's batch) and one skinned mesh per character, mirrors the sim onto
// them, and draws only when the driver says so: nothing while the view is still, and the shadow map only when a
// character moved or an edit asked. apply() takes an edited doc and rebuilds only what changed: the objects it
// touched and their types' batches. The canvas's backing store matches its device pixels (view/size.js).
import * as THREE from "three";
import { FLOOR_Y, tileKey } from "../model/grid.js";
import { buildPrims } from "../catalog/define.js";
import { floorAt as floorOf } from "../sim/motion.js";
import { buildArchitecture } from "../arch/build.js";
import { cameraPose, project as projectPose, unproject } from "../camera/rig.js";
import { createDriver } from "../view/driver.js";
import { canvasSize } from "../view/size.js";
import { createStage } from "../render/stage.js";
import { createMaterials } from "../render/materials.js";
import { primsToGroup, primsToGeometries } from "../render/meshes.js";
import { buildCharacter } from "../render/character.js";
import { planBatches, staleTypes, typesOf, hungOn, shows } from "../view/batches.js";

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
 * @property {number} [idleFps]              draw clips looping in place (breathing, typing) this often while nothing
 *                                           else moves; default 0: a still view draws nothing
 * @property {{ w: number, h: number, dpr?: number }} [size]   default: the canvas's own box, in device pixels
 * @property {{ x: number, y: number }} [offset]   where the view's centre sits, CSS px from the canvas centre
 * @property {{ left: number, top: number, right: number, bottom: number }} [insets]   CSS px of the canvas that the
 *                                           host's panels cover: the view centres in the rest, and fits into it
 * @property {boolean} [startActs]           run the world's acts at once (default true)
 * @property {import("../sim/ecs.js").System[]} [systems]   the host's own systems, run after the engine's step systems
 * @property {{ screenNoise?: boolean, noSnap?: boolean, shadowRadius?: number, oldSizing?: boolean }} [debug]
 *   reproduce the old defects, for comparisons
 */

/** @stability stable */
export function createWorld(canvas, world, opts = {}) {
  const debug = opts.debug ?? {};
  const events = new Map();
  let hovered = null;
  const emit = (name, data) => { for (const fn of events.get(name) ?? []) { try { fn(data); } catch (e) { console.error(`world ${name} handler failed`, e); } } };

  // --- size: the backing store is the canvas's device-pixel box exactly
  const deviceBoxes = typeof ResizeObserverEntry !== "undefined" && "devicePixelContentBoxSize" in ResizeObserverEntry.prototype;
  const hostStyle = { w: canvas.style.width, h: canvas.style.height };
  function measure(entry) {
    if (opts.size) return canvasSize({ css: opts.size, dpr: opts.size.dpr ?? 1 });
    const dpr = window.devicePixelRatio || 1;
    if (debug.oldSizing) { const w = canvas.clientWidth || 800, h = canvas.clientHeight || 600, d = Math.min(dpr, 2); return { w, h, dpr: d, bw: Math.floor(w * d), bh: Math.floor(h * d), style: null }; }
    const box = entry?.contentBoxSize?.[0], dev = entry?.devicePixelContentBoxSize?.[0];
    let css;
    if (box && deviceBoxes) css = { w: box.inlineSize, h: box.blockSize };
    else {
      if (!deviceBoxes) { canvas.style.width = hostStyle.w; canvas.style.height = hostStyle.h; } // measure the host's box, not ours
      const r = canvas.getBoundingClientRect();
      css = { w: r.width, h: r.height };
    }
    if (!(css.w > 0 && css.h > 0)) css = { w: 800, h: 600 }; // not laid out yet
    return canvasSize({ css, dpr, device: dev ? { w: dev.inlineSize, h: dev.blockSize } : null });
  }
  const s0 = measure(null);

  const driver = createDriver(world, { size: s0, rot: opts.rot, zoom: opts.zoom, walls: opts.walls, focusRoom: opts.focusRoom, offset: opts.offset, insets: opts.insets, snap: !debug.noSnap, idleFps: opts.idleFps, systems: opts.systems, emit });
  const { sim, cam } = driver;
  let theme = opts.theme === "dark" ? "dark" : "light";
  let time = opts.time ?? (theme === "dark" ? "21:00" : "14:00");
  let palette = driver.catalog.palette(theme);

  const stage = createStage(canvas);
  if (debug.shadowRadius) stage.sun.shadow.radius = debug.shadowRadius;
  const materials = createMaterials({ screenNoise: !!debug.screenNoise });
  const { scene, renderer } = stage;
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 400);
  const shadowBox = () => ({ min: [-2, 0, -2], max: [driver.lot.w + 2, 3.2, driver.lot.d + 2] });
  stage.setShadowBox(shadowBox());
  function applySize(s) {
    if (s.style && !deviceBoxes && !opts.size) { canvas.style.width = `${s.style.w}px`; canvas.style.height = `${s.style.h}px`; }
    stage.resize(s.bw, s.bh);
    driver.resize({ w: s.w, h: s.h, dpr: s.dpr });
  }
  applySize(s0);

  // --- architecture: one group per cut set and theme, cached; walls never scale, an edge is full or kerb
  const archCache = new Map();
  let arch = null, archKey = "";
  function syncArch() {
    const cut = driver.cut;
    const key = `${theme}|${driver.cutText}`;
    if (key === archKey) return;
    if (!archCache.has(key)) {
      if (archCache.size > 24) clearArch();
      archCache.set(key, primsToGroup(buildArchitecture(driver.lot, driver.catalog, cut), palette, materials, { name: "architecture" }));
    }
    if (arch) scene.remove(arch);
    arch = archCache.get(key);
    arch.userData.cut = cut;
    scene.add(arch);
    archKey = key;
    syncHung(cut);
    stage.invalidateShadows();
  }
  function clearArch() { for (const g of archCache.values()) { if (g !== arch) disposeGroup(g); } if (arch) { scene.remove(arch); disposeGroup(arch); arch = null; } archCache.clear(); archKey = ""; }

  // --- objects: one anchor group per object, in its own frame (attach() parents app objects to it; pick and hover name
  // it). A type with one copy draws in its objects' anchors (a "body" group each); a type with more draws as a batch,
  // an InstancedMesh per material with an instance per object (view/batches.js). An edit redraws only the types it
  // touched.
  const objectsGroup = new THREE.Group();
  objectsGroup.name = "objects";
  scene.add(objectsGroup);
  const objectGroups = new Map(), lamps = new Map(), typeMeshes = new Map();
  let plan = planBatches([]), byId = new Map(), byIdLot = null, hung = new Set();
  const objectOf = (id) => { if (byIdLot !== driver.lot) { byIdLot = driver.lot; byId = new Map(driver.lot.objects.map((o) => [o.id, o])); } return byId.get(id); };
  function dropObject(id) {
    const g = objectGroups.get(id);
    const kept = g ? g.children.filter((c) => !c.userData.engine) : [];
    if (g) { for (const c of kept) g.remove(c); objectsGroup.remove(g); disposeGroup(g); objectGroups.delete(id); }
    const l = lamps.get(id);
    if (l) { stage.removeLamp(l); lamps.delete(id); }
    return kept;
  }
  // The anchor and the lamp; drawType gives it its meshes.
  function placeObject(id) {
    const kept = dropObject(id);
    const o = objectOf(id);
    if (!o) return;
    const g = new THREE.Group();
    g.name = `object:${o.id}`;
    g.position.set(...o.pos);
    g.rotation.y = o.q * (Math.PI / 2);
    g.userData.entity = o.id;
    g.visible = !hung.has(o.id);
    for (const c of kept) g.add(c);
    objectsGroup.add(g);
    objectGroups.set(o.id, g);
    if (o.anchors.light) lamps.set(o.id, stage.addLamp(o.anchors.light));
  }
  const bodyOf = (o, name) => {
    const body = primsToGroup(buildPrims(o.def), palette, materials, { name });
    body.userData.engine = true;
    body.traverse((m) => { if (m.isMesh) m.userData.entity = o.id; });
    return body;
  };
  function undrawType(type) {
    for (const m of typeMeshes.get(type) ?? []) { m.parent?.remove(m); disposeGroup(m); if (m.isInstancedMesh) m.dispose(); }
    typeMeshes.delete(type);
  }
  function drawType(type) {
    undrawType(type);
    const ids = plan.batches.get(type) ?? plan.single.get(type);
    if (!ids) return;
    const made = [];
    if (plan.batches.has(type)) {
      for (const [key, geo] of primsToGeometries(buildPrims(objectOf(ids[0]).def), palette)) {
        const [finish, pattern] = key.split("|");
        const mesh = new THREE.InstancedMesh(geo, materials.get(finish, pattern || null), ids.length);
        ids.forEach((id, i) => mesh.setMatrixAt(i, matrixOf(objectOf(id))));
        mesh.computeBoundingSphere(); // round every instance, hidden or not, so one shown later is never culled
        mesh.castShadow = finish !== "glass";
        mesh.receiveShadow = finish !== "glow";
        mesh.name = `batch:${type}`;
        mesh.userData = { finish, ids };
        objectsGroup.add(mesh);
        made.push(mesh);
      }
    } else {
      for (const id of ids) { const body = bodyOf(objectOf(id), "body"); objectGroups.get(id).add(body); made.push(body); }
    }
    typeMeshes.set(type, made);
    placeInstances(type);
  }
  const _place = new THREE.Object3D();
  function matrixOf(o) {
    _place.position.set(...o.pos);
    _place.rotation.set(0, o.q * (Math.PI / 2), 0);
    _place.updateMatrix();
    return _place.matrix;
  }
  const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);
  // Each instance of a batched type (or only `id`'s): its object's matrix, or HIDDEN while hovered (its own body stands
  // in) or hung on a cut wall (shows() in view/batches.js).
  function placeInstances(type, id = null) {
    const ids = plan.batches.get(type);
    if (!ids) return;
    for (const m of typeMeshes.get(type) ?? []) {
      ids.forEach((x, i) => {
        const o = objectOf(x); // gone after an edit that removed it, which redraws its batch anyway
        if ((id === null || x === id) && o) m.setMatrixAt(i, shows(x, { hung, hovered }) === "instance" ? matrixOf(o) : HIDDEN);
      });
      m.instanceMatrix.needsUpdate = true;
    }
  }
  // The objects on cut walls hide: their anchors (with any lifted body and attached app objects) and their instances.
  function syncHung(cut) {
    hung = hungOn(driver.lot.objects, cut);
    for (const [id, g] of objectGroups) g.visible = !hung.has(id);
    for (const type of plan.batches.keys()) placeInstances(type);
  }
  // Hover lifts an object out of its batch (its instance shrinks to nothing and its own body stands in its place)
  // and turns its matte meshes to the highlight. An object on a cut wall stays hidden: its anchor is hidden too.
  function lift(id, on) {
    const g = objectGroups.get(id), type = plan.typeOf.get(id);
    if (!g) return;
    if (plan.batches.has(type)) {
      placeInstances(type, id);
      const old = g.getObjectByName("lifted");
      if (old) { g.remove(old); disposeGroup(old); }
      const o = objectOf(id);
      if (on && o) g.add(bodyOf(o, "lifted"));
    }
    g.traverse((m) => {
      if (!m.isMesh || m.userData.finish !== "matte") return;
      if (on) { m.userData.mat = m.material; m.material = materials.highlight; } else if (m.userData.mat) m.material = m.userData.mat;
    });
  }
  function setHover(id) {
    const was = hovered;
    hovered = id && objectGroups.has(id) ? id : null;
    if (was) lift(was, false);
    if (hovered) lift(hovered, true);
  }

  // --- characters: the sim owns their state; the meshes only mirror it (renderSync)
  const charGroup = new THREE.Group();
  charGroup.name = "characters";
  scene.add(charGroup);
  const meshes = new Map();
  const floorAt = (x, z) => floorOf(driver.lot, x, z);
  function dropCharacter(id) {
    const m = meshes.get(id);
    if (!m) return [];
    const kept = m.root.children.filter((c) => !c.userData.engine);
    for (const c of kept) m.root.remove(c);
    charGroup.remove(m.root);
    m.dispose();
    meshes.delete(id);
    return kept;
  }
  function buildCharacterMesh(id) {
    const kept = dropCharacter(id);
    const c = sim.ecs.get(id, "character");
    if (!c) return;
    const mesh = buildCharacter(id, c.look, palette, materials);
    for (const j of mesh.root.children) j.userData.engine = true;
    for (const k of kept) mesh.root.add(k);
    charGroup.add(mesh.root);
    meshes.set(id, mesh);
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

  // --- drawing
  const stats = { renders: 0, shadowRedraws: 0 };
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
    renderSync();
    emit("frame", { pose });
    stats.renders++;
    if (renderer.shadowMap.needsUpdate) stats.shadowRedraws++;
    renderer.render(scene, camera);
  }
  // What the driver decided for one frame (or several, merged, for advance).
  function draw(f) {
    if (!f.render) return;
    syncArch();
    if (f.shadows) stage.invalidateShadows();
    render();
  }

  // Every animation frame: the driver steps and decides; most frames of a still view draw nothing. A frame that
  // throws is logged once; the loop goes on (a throwing system is already switched off by the sim).
  let raf = 0, last = 0, running = false, failed = false;
  function loop(now) {
    if (!running) return;
    raf = requestAnimationFrame(loop);
    const dt = last ? Math.min(100, now - last) : STEP;
    last = now;
    try { draw(driver.tick(now, dt)); } catch (e) { if (!failed) console.error("@hq/world: a frame failed", e); failed = true; }
  }
  const manual = (opts.clock ?? "raf") !== "raf";
  function start() { if (running || manual) return; running = true; last = 0; raf = requestAnimationFrame(loop); }

  function applyTime() {
    stage.setTime(time, palette);
    driver.invalidate({ shadows: true });
  }

  applyTime();
  plan = planBatches(driver.lot.objects);
  for (const o of driver.lot.objects) placeObject(o.id);
  for (const type of typesOf(plan)) drawType(type);
  for (const id of sim.characters()) buildCharacterMesh(id);
  syncArch();
  if (opts.startActs !== false) driver.startActs();
  draw(driver.tick(0, 0));
  start();

  let ro = null;
  if (!opts.size && typeof ResizeObserver !== "undefined") {
    ro = new ResizeObserver((entries) => {
      const entry = entries.find((e) => e.target === canvas);
      applySize(measure(deviceBoxes ? entry : null));
      if (!running) render();
    });
    if (deviceBoxes) ro.observe(canvas, { box: "device-pixel-content-box" });
    else { ro.observe(canvas); if (canvas.parentElement) ro.observe(canvas.parentElement); }
  }

  // --- picking and hover
  const ray = new THREE.Raycaster();
  function pick(clientX, clientY) {
    const r = canvas.getBoundingClientRect();
    const x = clientX - r.left, y = clientY - r.top;
    ray.setFromCamera(new THREE.Vector2((x / r.width) * 2 - 1, -(y / r.height) * 2 + 1), camera);
    for (const m of meshes.values()) m.refreshBounds();
    const hit = ray.intersectObjects([charGroup, objectsGroup], true).find((h) => { const id = entityOf(h); return id && !hung.has(id); }); // not a piece hidden on a cut wall
    const ground = unproject(pose, [x, y], FLOOR_Y);
    const tile = [Math.floor(ground[0]), Math.floor(ground[2])];
    const lot = driver.lot;
    if (hit) { const id = entityOf(hit); return { kind: meshes.has(id) ? "character" : "object", id, tile }; }
    if (tile[0] < 0 || tile[1] < 0 || tile[0] >= lot.w || tile[1] >= lot.d) return null;
    return { kind: "tile", tile, room: lot.roomAt.get(tileKey(...tile)) };
  }
  // an instance names its object through its batch's ids
  const entityOf = (h) => h.object.userData.entity ?? h.object.userData.ids?.[h.instanceId];
  function highlight(id) {
    if (id === hovered) return;
    setHover(id);
    driver.invalidate();
    if (!running) render();
  }

  const view = {
    get lot() { return driver.lot; },
    get catalog() { return driver.catalog; },
    get nav() { return driver.nav; },
    camera: {
      rotate(dir) { driver.rotate(dir); emit("camera", { rot: cam.rot }); },
      zoom(step) { driver.zoom(step); },
      pan(dx, dy) { driver.pan(dx, dy); },
      /** Centre on a ground point, eased unless { ease: false }. */
      focusOn(x, z, o) { driver.focusOn(x, z, o); },
      /** Centre on a box ({ minX, minZ, maxX, maxZ }, a room's for example) at the nearest zoom that fits it, eased. */
      fitBox(box, o) { driver.fitBox(box, o); },
      fit(o) { driver.fit(o); },
      /** The edges of the canvas a host's panels cover, CSS px ({ left, top, right, bottom }). Never refits. */
      setInsets(insets) { driver.setInsets(insets); },
      pose: () => cameraPose(cam),
      get state() { return { rot: cam.rot, az: cam.az, zoom: cam.zoom, ppm: cam.ppm, focus: [...cam.focus], turning: !!cam.turn, moving: !!cam.moving }; },
    },
    /** A room's tiles as a box, for camera.fitBox. */
    roomBox: (id) => driver.roomBox(id),
    setWalls(mode, room = null) { driver.setWalls(mode, room); if (!running) draw(driver.tick(0, 0)); },
    setTheme(t) {
      theme = t === "dark" ? "dark" : "light";
      palette = driver.catalog.palette(theme);
      const h = hovered;
      setHover(null);
      clearArch();
      for (const type of typesOf(plan)) drawType(type);
      for (const id of sim.characters()) buildCharacterMesh(id);
      setHover(h);
      applyTime();
      if (!running) draw(driver.tick(0, 0));
    },
    setTime(t) { time = t; applyTime(); if (!running) draw(driver.tick(0, 0)); },
    /**
     * Change the world without a restart: a World or a doc (validated whole; a WorldError changes nothing). Only what
     * changed is rebuilt, the sim keeps running, and the same doc twice is a no-op. Returns the diff, or null.
     */
    apply(next) {
      const diff = driver.apply(next);
      if (!diff) return null;
      const recolour = diff.packs || diff.palette; // colours live in the geometry, so every type redraws
      if (recolour) palette = driver.catalog.palette(theme);
      if (diff.lot || recolour) { clearArch(); stage.setShadowBox(shadowBox()); }
      const ids = recolour ? driver.lot.objects.map((o) => o.id) : [...diff.objects.added, ...diff.objects.changed];
      const h = hovered;
      setHover(null);
      const nextPlan = planBatches(driver.lot.objects);
      const stale = recolour ? new Set([...typesOf(plan), ...typesOf(nextPlan)]) : staleTypes(plan, nextPlan, [...ids, ...diff.objects.removed]);
      hung = hungOn(driver.lot.objects, driver.cut);
      for (const id of diff.objects.removed) dropObject(id);
      for (const id of ids) placeObject(id);
      plan = nextPlan;
      for (const type of stale) drawType(type);
      setHover(h);
      for (const id of diff.characters.removed) dropCharacter(id);
      for (const id of recolour ? sim.characters() : [...diff.characters.added, ...diff.characters.changed]) buildCharacterMesh(id);
      if (recolour) applyTime();
      if (!running) draw(driver.tick(0, 0));
      return diff;
    },
    act: (id, a) => sim.act(id, a),
    character: (id) => sim.character(id),
    sim,
    pick,
    hover(clientX, clientY) { const p = pick(clientX, clientY); highlight(p?.kind === "object" ? p.id : null); emit("hover", p); return p; },
    project(p) { const q = projectPose(pose, p); const d = pose.dpr; return { x: Math.round(q.x * d) / d, y: Math.round(q.y * d) / d, visible: q.x >= 0 && q.y >= 0 && q.x <= pose.w && q.y <= pose.h }; },
    anchor(id, name) {
      const o = driver.lot.objects.find((x) => x.id === id);
      if (o) return o.anchors[name] ?? null;
      const c = sim.ecs.get(id, "body");
      return c ? [c.x, floorAt(c.x, c.z) + c.hips + 0.95, c.z] : null;
    },
    /** Parent an app object to an object's or character's group; it stays through edits that rebuild that entity. */
    attach(obj, id) { const g = objectGroups.get(id) ?? meshes.get(id)?.root; if (!g) return false; g.add(obj); driver.invalidate({ shadows: true }); return true; },
    on(name, fn) { if (!events.has(name)) events.set(name, new Set()); events.get(name).add(fn); return () => events.get(name).delete(fn); },
    /** With clock "manual": step by ms, then draw once. */
    advance(ms) {
      const f = { render: true, shadows: false };
      let left = ms;
      while (left > 1e-6) { const d = Math.min(STEP, left); f.shadows = driver.tick(0, d).shadows || f.shadows; left -= d; }
      draw(f);
      return view.inspect();
    },
    render() { syncArch(); render(); },
    /** Pause (true) or resume: while paused nothing steps or draws, for a view the host has covered. */
    pause(on) { driver.pause(on); },
    /** Request a frame (the host changed something the engine cannot see, such as an attached object). */
    invalidate(o) { driver.invalidate(o); },
    bindInput(el = canvas) { return bindInput(view, el, emit); },
    inspect() {
      return { rot: ((cam.rot % 4) + 4) % 4, zoom: cam.zoom, paused: driver.paused, walls: driver.walls, focusRoom: driver.focusRoom, theme, time, cut: [...(arch?.userData.cut ?? [])].sort(),
        camera: { y: pose.position[1], position: pose.position, target: pose.target, az: cam.az, ppm: cam.ppm, snapped: pose.snapped },
        size: { w: cam.w, h: cam.h, dpr: cam.dpr, buffer: [canvas.width, canvas.height] },
        stats: { ...stats, frames: driver.stats.frames },
        characters: sim.characters().map((id) => sim.character(id)), draws: renderer.info.render.calls, triangles: renderer.info.render.triangles };
    },
    three: { renderer, scene, camera },
    dispose() {
      running = false; cancelAnimationFrame(raf); ro?.disconnect();
      clearArch();
      for (const type of [...typeMeshes.keys()]) undrawType(type);
      for (const id of [...objectGroups.keys()]) dropObject(id);
      for (const id of [...meshes.keys()]) dropCharacter(id);
      materials.dispose(); renderer.dispose();
    },
  };
  return view;
}

function disposeGroup(g) {
  g.traverse((o) => { if (o.userData.engine !== false) o.geometry?.dispose(); });
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
