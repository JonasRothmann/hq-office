// The view's driver, pure: one world's lot, nav, sim and camera; edits at run time (apply); and the frame policy, which
// decides each frame whether to draw and whether the shadow map must redraw. createWorld wraps it with three.js and
// does only what tick() and apply() return; tests run it headless.
//
// The policy: draw while the camera moves, a character moves, a host system says it is busy, or something was
// invalidated (an edit, a theme or time change, a hover, a resize). The step that ends a motion is drawn too: the
// camera's snapped pose at rest and the clip a cross-fade ends on. Redraw the shadow map only when a character moved
// or changed pose, the cut walls changed, or an edit, theme or time change asked for it. A clip looping in place (breathing,
// typing) is not motion: it draws at idleFps (default 0, never) and never redraws shadows. Nothing else draws.
import { analyse } from "../lot/lot.js";
import { WorldError, errorsOf } from "../model/problems.js";
import { fromJSON } from "../model/world.js";
import { diffWorld } from "../model/diff.js";
import { createNav } from "../nav/nav.js";
import { createSim } from "../sim/index.js";
import { FADE } from "../sim/motion.js";
import { cutaway, WALL_MODES } from "../arch/cutaway.js";
import { createCamera, stepCamera, rotateCamera, zoomCamera, panCamera, fitCamera, focusCamera, insetCamera, ZOOMS } from "../camera/rig.js";

/**
 * @typedef {object} DriverOptions
 * @property {{ w: number, h: number, dpr?: number }} [size]     CSS px the camera draws, and device px per CSS px
 * @property {number} [rot]
 * @property {number} [zoom]            0..2; default: the nearest step that fits the lot at every rotation
 * @property {"up"|"cutaway"|"down"} [walls]
 * @property {string|null} [focusRoom]
 * @property {{ x: number, y: number }} [offset]
 * @property {{ left: number, top: number, right: number, bottom: number }} [insets]   CSS px a host's panels cover
 * @property {boolean} [snap]           snap to device pixels at rest (default true)
 * @property {number} [idleFps]         how often a clip looping in place is drawn when nothing else moves (default 0)
 * @property {import("../sim/ecs.js").System[]} [systems]
 * @property {(name: string, data: any) => void} [emit]
 */

const NONE = Object.freeze({ render: false, shadows: false, cut: null });

/** @param {DriverOptions} [opts] */
export function createDriver(world, opts = {}) {
  const first = analyse(world);
  if (errorsOf(first.problems).length) throw new WorldError(first.problems, `world '${world.doc.id}'`);
  let current = world, key = JSON.stringify(world.doc);
  let lot = first.lot, catalog = first.catalog, nav = createNav(lot);
  const sim = createSim(lot, nav, { systems: opts.systems, emit: opts.emit });
  const size = opts.size ?? { w: 800, h: 600, dpr: 1 };
  const cam = createCamera({ w: size.w, h: size.h, dpr: size.dpr ?? 1, rot: opts.rot ?? 0, snap: opts.snap !== false, offset: opts.offset ?? { x: 0, y: 0 }, insets: opts.insets ?? null, bounds: lotBounds(lot) });
  let box = indoorBox(lot);
  fitCamera(cam, box);
  if (opts.zoom !== undefined && ZOOMS[opts.zoom]) { cam.zoom = opts.zoom; cam.ppm = ZOOMS[opts.zoom]; }
  let wallMode = WALL_MODES.includes(opts.walls) ? opts.walls : "cutaway";
  let focusRoom = opts.focusRoom ?? null;
  const idleFps = opts.idleFps ?? 0;
  let paused = false;

  const pending = { render: true, shadows: true };
  const stats = { frames: 0, renders: 0, shadows: 0 };
  let lastDraw = -Infinity;
  const report = (e) => console.error(`@hq/world: ${e?.message ?? e}`);

  // The cut walls: worked out again only when what they depend on changes, so a still view costs no cutaway pass.
  let cutKey = "", cutText = "", cut = new Set(), lotRev = 0;
  function cutNow() {
    const dir = cam.turn ? Math.sign(cam.turn.to - cam.turn.from) : 0;
    const k = `${cam.rot}|${dir}|${wallMode}|${focusRoom}|${lotRev}`;
    if (k === cutKey) return false;
    cutKey = k;
    const at = (rot) => cutaway(lot, { mode: wallMode, rot, focus: focusRoom });
    // during a turn the walls cut at either end stay cut, so no wall rises in front of the view mid-turn
    const next = dir ? new Set([...at(cam.rot - dir), ...at(cam.rot)]) : at(cam.rot);
    const text = [...next].sort().join(" ");
    if (text === cutText) return false;
    cut = next; cutText = text;
    return true;
  }

  // Where each character's body was at the last frame: a change is motion (and moves a shadow).
  const last = new Map();
  function bodiesMoved() {
    let moved = false;
    const seen = new Set();
    for (const [id, b] of sim.ecs.query("body")) {
      seen.add(id);
      const p = last.get(id);
      if (!p || p[0] !== b.x || p[1] !== b.z || p[2] !== b.ry || p[3] !== b.hips) { moved = true; last.set(id, [b.x, b.z, b.ry, b.hips]); }
    }
    for (const id of last.keys()) if (!seen.has(id)) { last.delete(id); moved = true; }
    return moved;
  }
  bodiesMoved();
  cutNow();
  // A cross-fade ran during the last step (a limb moved, so its shadow did): fadeT has already advanced by dt.
  const fading = (dt) => sim.ecs.query("anim").some(([, a]) => a.from && a.fadeT - dt < FADE);

  const invalidate = ({ shadows = false } = {}) => { pending.render = true; if (shadows) pending.shadows = true; };

  const driver = {
    get world() { return current; },
    get lot() { return lot; },
    get catalog() { return catalog; },
    get nav() { return nav; },
    get box() { return box; },
    get cut() { return cut; },
    /** The cut set as sorted text: a cheap key for caching what is built for it. */
    get cutText() { return cutText; },
    get walls() { return wallMode; },
    get focusRoom() { return focusRoom; },
    get paused() { return paused; },
    sim, cam, stats,

    /** Run the world's own acts (createWorld does, unless startActs is false). */
    startActs() { for (const a of current.doc.acts) sim.act(a.who, a, { doc: true }).catch(report); },

    /**
     * One frame of dtMs at time now (ms): step the camera and the sim, then say what to draw.
     * @returns {{ render: boolean, shadows: boolean, cut: Set<string>|null }}   cut: the new cut set, when it changed
     */
    tick(now, dtMs) {
      if (paused) return NONE;
      stats.frames++;
      // a camera that was moving at the start of this step changed the pose, even on the step that brings it to rest
      const moving = !!(cam.turn || cam.zooming || cam.moving);
      stepCamera(cam, dtMs);
      const busy = sim.step(dtMs / 1000);
      const moved = bodiesMoved() || fading(dtMs / 1000);
      const cutChanged = cutNow();
      const ambient = idleFps > 0 && last.size > 0 && now - lastDraw >= 1000 / idleFps - 1;
      if (!(moving || busy || moved || cutChanged || pending.render || ambient)) return NONE;
      const shadows = moved || cutChanged || pending.shadows;
      lastDraw = now;
      pending.render = pending.shadows = false;
      stats.renders++;
      if (shadows) stats.shadows++;
      return { render: true, shadows, cut: cutChanged ? cut : null };
    },

    /**
     * Change the world without a restart: next is a World (defineWorld) or a doc (the packs stay). It is validated
     * whole first (a WorldError leaves everything as it was), then diffed against the current doc; the diff also names
     * objects whose built place changed with the lot (a floor laid or lifted under them). The sim keeps
     * running (see sim.apply); the caller rebuilds only what the diff names. The same doc again is a no-op: null.
     * @returns {import("../model/diff.js").WorldDiff | null}
     */
    apply(next) {
      const nextWorld = next?.doc ? next : fromJSON(next, current.packs);
      const k = JSON.stringify(nextWorld.doc);
      const samePacks = nextWorld.packs.length === current.packs.length && nextWorld.packs.every((p, i) => p === current.packs[i]);
      if (k === key && samePacks) return null;
      // characters that exist already are where the sim has them: their doc `at` and acts are not checked by position
      const diff = diffWorld(current.doc, nextWorld.doc);
      const r = analyse(nextWorld, { live: new Set(sim.characters()), moved: new Set([...diff.objects.added, ...diff.objects.changed]) });
      if (errorsOf(r.problems).length) throw new WorldError(r.problems, `world '${nextWorld.doc.id}'`);
      if (!samePacks) diff.packs = true;
      // an object's height comes from the floor under it, so a lot edit can move an object its doc entry never named
      if (diff.lot) for (const o of r.lot.objects) {
        const was = lot.objects.find((x) => x.id === o.id);
        if (was && !diff.objects.changed.includes(o.id) && placed(was) !== placed(o)) diff.objects.changed.push(o.id);
      }
      lot = r.lot; catalog = r.catalog; nav = createNav(lot);
      sim.apply(lot, nav, diff);
      if (diff.lot) {
        lotRev++;
        box = indoorBox(lot);
        cam.bounds = lotBounds(lot);
        cam.focus = [Math.min(cam.focus[0], lot.w), Math.min(cam.focus[1], lot.d)]; // a lot that shrank; no refit
      }
      current = nextWorld; key = k;
      for (const a of diff.acts) sim.act(a.who, a, { doc: true }).catch(report);
      invalidate({ shadows: true });
      return diff;
    },

    // The camera. None of these refits: only fit() and fitBox() pick a zoom, and only when called.
    rotate(dir) { rotateCamera(cam, dir); invalidate(); },
    zoom(step) { zoomCamera(cam, step); invalidate(); },
    pan(dx, dy) { panCamera(cam, dx, dy); invalidate(); },
    focusOn(x, z, { ease = true } = {}) { if (ease) focusCamera(cam, [x, z]); else { cam.moving = null; cam.focus = [x, z]; } invalidate(); },
    fitBox(b, { ease = true } = {}) { fitCamera(cam, b, { ease }); invalidate(); },
    fit({ ease = false } = {}) { fitCamera(cam, box, { ease }); invalidate(); },
    /** The view's size: CSS px the camera draws and device px per CSS px (see view/size.js). Never refits. */
    resize({ w, h, dpr = cam.dpr }) { if (w === cam.w && h === cam.h && dpr === cam.dpr) return; cam.w = w; cam.h = h; cam.dpr = dpr; invalidate(); },
    /** The edges a host's panels cover (CSS px): the view centres in the rest and fit() fits into it. Never refits. */
    setInsets(insets) { insetCamera(cam, insets); invalidate(); },
    /** Paused, nothing steps (camera, characters, host systems) and nothing draws; resuming draws once. */
    pause(on) { paused = !!on; if (!paused) invalidate(); },
    setWalls(mode, room = null) { if (WALL_MODES.includes(mode)) wallMode = mode; focusRoom = room; invalidate(); },
    invalidate,
    /** A room's tiles as a box, for fitBox; null for an unknown room. */
    roomBox(id) {
      const r = lot.rooms.find((x) => x.id === id);
      if (!r) return null;
      const xs = r.tiles.map((t) => t[0]), zs = r.tiles.map((t) => t[1]);
      return { minX: Math.min(...xs), minZ: Math.min(...zs), maxX: Math.max(...xs) + 1, maxZ: Math.max(...zs) + 1 };
    },
  };
  return driver;
}

const placed = (o) => JSON.stringify([o.pos, o.anchors, o.slots]);
const lotBounds = (lot) => ({ minX: 0, minZ: 0, maxX: lot.w, maxZ: lot.d });

// The floored part of the lot (what the view fits), or the whole lot when nothing is floored.
function indoorBox(lot) {
  let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
  for (const k of lot.floor.keys()) { const [x, z] = k.split(",").map(Number); minX = Math.min(minX, x); minZ = Math.min(minZ, z); maxX = Math.max(maxX, x + 1); maxZ = Math.max(maxZ, z + 1); }
  return minX === Infinity ? lotBounds(lot) : { minX, minZ, maxX, maxZ };
}
