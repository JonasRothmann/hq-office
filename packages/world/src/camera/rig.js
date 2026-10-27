// The Sims camera, pure: orthographic, 30° pitch, yaw 45° + n·90°, a ladder of zoom stops, a ground-plane focus.
//
// Rules that keep the picture still:
//   - the camera orbits the focus at a fixed pitch and distance, so its height never changes;
//   - a turn animates only the azimuth, along the arc; it never moves the focus and never changes the zoom;
//   - a zoom eases the scale (in log space) between stops of a fixed ladder, about the focus or about a screen point:
//     the ground point under it stays under it; a new zoom mid-zoom retargets from where the scale is;
//   - only focusCamera and fitCamera move the focus on their own (eased, when asked); a pan, or a zoom toward the
//     cursor, moves it with the cursor;
//   - at rest, the rendered focus is snapped so the world lands on whole device pixels: a pan moves the picture by
//     whole pixels, and a still scene renders identically, shifted.

export const PITCH = Math.PI / 6;              // 30°: a tile projects to an exact 2:1 diamond
// px per metre: 16·2^(k/4) for k = 0..12, rounded to 0.1, so each stop is about 19 % closer than the last. The
// named stops are the old three steps (22.6, 45.3, 90.5).
export const ZOOMS = [16, 19, 22.6, 26.9, 32, 38.1, 45.3, 53.8, 64, 76.1, 90.5, 107.6, 128];
export const ZOOM_STOPS = Object.freeze({ far: 2, mid: 6, near: 10 });
export const TURN_MS = 380;
export const ZOOM_MS = 260;
export const FOCUS_MS = 420;
const DIST = 100;                               // metres from the focus; any value works for an orthographic camera
const SIN_P = Math.sin(PITCH), COS_P = Math.cos(PITCH);

export const azimuth = (rot) => Math.PI / 4 + rot * (Math.PI / 2);
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t) => 1 - Math.pow(1 - t, 3);

/**
 * @typedef {object} CameraState
 * @property {number} w      viewport width, CSS px
 * @property {number} h      viewport height, CSS px
 * @property {number} dpr    device pixels per CSS px
 * @property {number} rot    the rotation step (any integer)
 * @property {number} az     the current azimuth, radians
 * @property {number} zoom   the zoom stop: an index into ZOOMS (the target while a zoom eases)
 * @property {number} ppm    the current px per metre
 * @property {[number, number]} focus   ground x, z the view centres on
 * @property {{ minX: number, minZ: number, maxX: number, maxZ: number }|null} bounds   the focus is clamped to these
 * @property {{ x: number, y: number }} offset   where the focus sits on screen, CSS px from the viewport's centre
 * @property {Insets|null} insets   the edges of the viewport that a host's panels cover; the view fits the rest
 * @property {boolean} snap
 * @property {{ from: number, to: number, t: number }|null} turn         a turn in progress
 * @property {{ from: number, to: number, t: number, out: boolean, anchor: number[]|null, focus: number[] }|null} zooming
 *   a zoom in progress: px per metre from and to; out: a retarget, eased out from full speed; anchor: the ground point
 *   held under the cursor, and focus: the focus when the zoom began
 * @property {{ from: number[], to: number[], t: number }|null} moving   an eased focus move in progress
 */

/** @typedef {{ left: number, top: number, right: number, bottom: number }} Insets   CSS px */

/** @stability stable  @returns {CameraState} */
export function createCamera({ w = 800, h = 600, dpr = 1, rot = 0, zoom = ZOOM_STOPS.mid, focus = [0, 0], bounds = null, offset = { x: 0, y: 0 }, insets = null, snap = true } = {}) {
  const cam = { w, h, dpr, rot, az: azimuth(rot), zoom, ppm: ZOOMS[zoom], focus: [...focus], bounds, offset: { ...offset }, insets: null, snap, turn: null, zooming: null, moving: null };
  if (insets) insetCamera(cam, insets);
  return cam;
}

// The part of the viewport a host's panels leave free: the focus sits at its centre (the offset follows), and
// fitCamera fits a box into it. Nothing moves or refits on its own; the host calls fit again if it wants to.
export function insetCamera(cam, { left = 0, top = 0, right = 0, bottom = 0 } = {}) {
  cam.insets = { left, top, right, bottom };
  cam.offset = { x: (left - right) / 2, y: (top - bottom) / 2 };
}

/** @stability stable */
export function rotateCamera(cam, dir) {
  cam.rot += dir > 0 ? 1 : -1;
  cam.turn = { from: cam.az, to: azimuth(cam.rot), t: 0 };
}

// Ease to stop `step` of ZOOMS (clamped). With `at`, a point on the viewport in CSS px (the cursor), the ground point
// under it stays under it, and the focus is clamped to the bounds as a pan's is; without, the zoom centres on the
// focus. A zoom in progress is retargeted from the scale it has reached, eased out so it never stalls.
/** @stability stable */
export function zoomCamera(cam, step, at = null) {
  const z = Math.max(0, Math.min(ZOOMS.length - 1, Math.round(step)));
  if (z === cam.zoom) return;
  let anchor = null;
  if (at) {
    const t = cameraPose(cam).target; // from the picture as drawn: at rest, the snapped focus
    cam.focus = [t[0], t[2]];
    cam.moving = null; // the hand wins over an eased move
    anchor = groundAt(cam, at);
  }
  cam.zooming = { from: cam.ppm, to: ZOOMS[z], t: 0, out: !!cam.zooming, anchor, focus: [...cam.focus] };
  cam.zoom = z;
}

// The ground point (x, z) under a point on the viewport, from the logical focus.
function groundAt(cam, [sx, sy]) {
  const o = screenOffset(cam);
  const u = sx - cam.w / 2 - o.x, v = (sy - cam.h / 2 - o.y) / SIN_P;
  const ca = Math.cos(cam.az), sa = Math.sin(cam.az);
  return [cam.focus[0] + (ca * u + sa * v) / cam.ppm, cam.focus[1] + (-sa * u + ca * v) / cam.ppm];
}
const screenOffset = (cam) => ({ x: Math.round(cam.offset.x * cam.dpr) / cam.dpr, y: Math.round(cam.offset.y * cam.dpr) / cam.dpr });

export const WHEEL_STOP = 100;   // wheel deltaY (CSS px) per stop: about one mouse notch
const PINCH_STOP = 17.3;         // pinch (ctrlKey) deltaY per stop: a pinch scales by exp(-deltaY / 100); ln 2^(1/4) ≈ 0.173
const LINE_PX = 40, WHEEL_IDLE = 400;

// Wheel and pinch to zoom stops: deltas add up, and the total yields a stop each time it passes one stop's worth. One
// event gives at most one stop. A pause of WHEEL_IDLE ms or a change of direction starts the total again. `acc` is the
// caller's running total ({} to start). Returns the stops to move: +1 closer, -1 further, or 0.
export function wheelSteps(acc, { deltaY, deltaMode = 0, ctrlKey = false, timeStamp = 0 }) {
  const px = deltaY * (deltaMode === 1 ? LINE_PX : deltaMode === 2 ? 800 : 1);
  const d = Math.max(-1, Math.min(1, -px / (ctrlKey ? PINCH_STOP : WHEEL_STOP)));
  if (!d) return 0;
  if (!(timeStamp - (acc.at ?? -Infinity) <= WHEEL_IDLE) || d * acc.sum < 0) acc.sum = 0;
  acc.at = timeStamp;
  acc.sum += d;
  const n = Math.trunc(acc.sum + (acc.sum > 0 ? 1e-9 : -1e-9)) || 0;
  acc.sum -= n;
  return n;
}

// A drag of dx, dy CSS px: the ground under the cursor follows it.
/** @stability stable */
export function panCamera(cam, dx, dy) {
  cam.moving = null; // the hand wins over an eased move
  if (cam.zooming) cam.zooming.anchor = null; // and a zoom goes on about the focus
  const r = [Math.cos(cam.az), -Math.sin(cam.az)], f = [Math.sin(cam.az), Math.cos(cam.az)];
  cam.focus[0] -= (r[0] * dx) / cam.ppm + (f[0] * dy) / (cam.ppm * SIN_P);
  cam.focus[1] -= (r[1] * dx) / cam.ppm + (f[1] * dy) / (cam.ppm * SIN_P);
  clampFocus(cam);
}

function clampFocus(cam) {
  cam.focus = clampPoint(cam, cam.focus);
}
function clampPoint(cam, [x, z]) {
  const b = cam.bounds;
  return b ? [Math.max(b.minX, Math.min(b.maxX, x)), Math.max(b.minZ, Math.min(b.maxZ, z))] : [x, z];
}

// Move the focus to a ground point, eased over FOCUS_MS, and to zoom step `zoom` if given. A turn in progress goes on.
/** @stability stable */
export function focusCamera(cam, [x, z], { zoom } = {}) {
  if (cam.zooming) cam.zooming.anchor = null;
  cam.moving = { from: [...cam.focus], to: clampPoint(cam, [x, z]), t: 0 };
  if (zoom !== undefined && zoom !== cam.zoom) zoomCamera(cam, zoom);
}

// Centre on a box (the lot, a room) and pick the closest zoom stop at which it fits at EVERY rotation, so a turn
// never needs a refit. `height` is how tall the box's contents stand (walls). ease: glide there (focusCamera).
/** @stability stable */
export function fitCamera(cam, b, { height = 3.01, margin = 24, ease = false } = {}) {
  const focus = [(b.minX + b.maxX) / 2, (b.minZ + b.maxZ) / 2];
  let needW = 0, needH = 0;
  for (let rot = 0; rot < 4; rot++) {
    const az = azimuth(rot), ca = Math.cos(az), sa = Math.sin(az);
    for (const [x, z] of [[b.minX, b.minZ], [b.maxX, b.minZ], [b.minX, b.maxZ], [b.maxX, b.maxZ]]) for (const y of [0, height]) {
      const dx = x - focus[0], dz = z - focus[1];
      const u = dx * ca - dz * sa;
      const v = y * COS_P - (dx * sa + dz * ca) * SIN_P;
      needW = Math.max(needW, Math.abs(u) * 2);
      needH = Math.max(needH, Math.abs(v) * 2);
    }
  }
  const i = cam.insets ?? { left: 0, top: 0, right: 0, bottom: 0 };
  const freeW = cam.w - i.left - i.right, freeH = cam.h - i.top - i.bottom;
  let step = 0;
  for (let s = ZOOMS.length - 1; s >= 0; s--) if (needW * ZOOMS[s] <= freeW - margin * 2 && needH * ZOOMS[s] <= freeH - margin * 2) { step = s; break; }
  if (ease) { focusCamera(cam, focus, { zoom: step }); return step; }
  cam.focus = focus;
  cam.moving = null;
  cam.zoom = step;
  cam.ppm = ZOOMS[step];
  cam.zooming = null;
  return step;
}

// Advance the turn and the zoom by dt ms; true while anything still moves.
/** @stability stable */
export function stepCamera(cam, dt) {
  let moving = false;
  if (cam.turn) {
    cam.turn.t = Math.min(1, cam.turn.t + dt / TURN_MS);
    cam.az = cam.turn.from + (cam.turn.to - cam.turn.from) * easeInOut(cam.turn.t);
    if (cam.turn.t >= 1) { cam.az = cam.turn.to; cam.turn = null; } else moving = true;
  }
  if (cam.zooming) {
    const z = cam.zooming;
    z.t = Math.min(1, z.t + dt / ZOOM_MS);
    cam.ppm = Math.exp(Math.log(z.from) + (Math.log(z.to) - Math.log(z.from)) * (z.out ? easeOut : easeInOut)(z.t));
    if (z.t >= 1) { cam.ppm = z.to; cam.zooming = null; } else moving = true;
    // the anchor's offset from the focus, in metres, shrinks as the scale grows, so it keeps its place on screen; it
    // does not depend on the azimuth, so a turn mid-zoom ends on the same focus
    if (z.anchor) { const k = z.from / cam.ppm, [gx, gz] = z.anchor; cam.focus = clampPoint(cam, [gx + (z.focus[0] - gx) * k, gz + (z.focus[1] - gz) * k]); }
  }
  if (cam.moving) {
    const m = cam.moving;
    m.t = Math.min(1, m.t + dt / FOCUS_MS);
    const k = easeInOut(m.t);
    cam.focus = [m.from[0] + (m.to[0] - m.from[0]) * k, m.from[1] + (m.to[1] - m.from[1]) * k];
    if (m.t >= 1) { cam.focus = [...m.to]; cam.moving = null; } else moving = true;
  }
  return moving;
}

/**
 * @typedef {object} CameraPose
 * @property {[number, number, number]} position
 * @property {[number, number, number]} target     the rendered focus (snapped at rest)
 * @property {[number, number, number]} right
 * @property {[number, number, number]} up
 * @property {[number, number, number]} forward
 * @property {{ left: number, right: number, top: number, bottom: number }} frustum   metres
 * @property {number} ppm
 * @property {number} w
 * @property {number} h
 * @property {number} dpr
 * @property {boolean} snapped
 */

/** @stability stable  @returns {CameraPose} */
export function cameraPose(cam) {
  const az = cam.az, ca = Math.cos(az), sa = Math.sin(az);
  const right = [ca, 0, -sa];
  const forward = [-sa * COS_P, -SIN_P, -ca * COS_P];
  const up = cross(right, forward);
  let [fx, fz] = cam.focus;
  const atRest = !cam.turn && !cam.zooming && !cam.moving;
  const snapped = cam.snap && atRest;
  if (snapped) {
    // the focus's coordinates along screen right and screen up, rounded to whole device pixels
    const px = 1 / (cam.ppm * cam.dpr);
    const a = fx * right[0] + fz * right[2], b = fx * up[0] + fz * up[2];
    const da = Math.round(a / px) * px - a, db = Math.round(b / px) * px - b;
    // moving the focus away from the camera (-f) by δ raises it on screen by δ·sin(pitch)
    const f = [sa, ca];
    fx += right[0] * da - (f[0] * db) / SIN_P;
    fz += right[2] * da - (f[1] * db) / SIN_P;
  }
  const target = [fx, 0, fz];
  const position = [fx + sa * COS_P * DIST, SIN_P * DIST, fz + ca * COS_P * DIST];
  const { x: ox, y: oy } = screenOffset(cam);
  const frustum = { left: (-cam.w / 2 - ox) / cam.ppm, right: (cam.w / 2 - ox) / cam.ppm, top: (cam.h / 2 + oy) / cam.ppm, bottom: (-cam.h / 2 + oy) / cam.ppm };
  return { position, target, right, up, forward, frustum, ppm: cam.ppm, w: cam.w, h: cam.h, dpr: cam.dpr, snapped, offset: { x: ox, y: oy } };
}

// A world point to CSS px on the viewport: { x, y, depth }.
/** @stability stable */
export function project(pose, [x, y, z]) {
  const d = [x - pose.position[0], y - pose.position[1], z - pose.position[2]];
  const sx = dot(d, pose.right), sy = dot(d, pose.up);
  return { x: pose.w / 2 + pose.offset.x + sx * pose.ppm, y: pose.h / 2 + pose.offset.y - sy * pose.ppm, depth: dot(d, pose.forward) };
}

// CSS px on the viewport to the ground point (y = 0) under it.
/** @stability stable */
export function unproject(pose, [sx, sy], groundY = 0) {
  const u = (sx - pose.w / 2 - pose.offset.x) / pose.ppm, v = (pose.h / 2 + pose.offset.y - sy) / pose.ppm;
  const p0 = [0, 1, 2].map((i) => pose.position[i] + pose.right[i] * u + pose.up[i] * v);
  const t = (groundY - p0[1]) / pose.forward[1];
  return [p0[0] + pose.forward[0] * t, groundY, p0[2] + pose.forward[2] * t];
}

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
