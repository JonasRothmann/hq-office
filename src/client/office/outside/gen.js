// The land around the office, pure (no three.js): mode, seed and the office's lot in; terrain, water, trees, roads,
// buildings and the loops that cars and people follow out, as plain data. The same input gives the same layout.
//
// Units are metres; x runs east, z runs south, y is up. The lot (the building plus the garden other lanes draw) is a
// hole: nothing here reaches into it. The office's own ground plane lies at y = -0.12; everything here stays above
// it (GROUND), so that plane never covers a river or a road. Past FADE.to metres from the lot everything has faded
// into the background colour, and the layout stops a little after that (PAD).

import { city } from "./city.js";

export { roundedLoop } from "./city.js";

export const PAD = 64;
export const FADE = { from: 34, to: 60 };
export const GROUND = -0.115;
export const CELL = 2;
export const CAPS = { cars: 30, people: 60, cyclists: 60, boats: 8, trees: 1000, flowers: 420, rocks: 140, reeds: 280, tufts: 900 };
// Sims scale (a person is 1.35 m): two lanes of 3 m, a bike track of 1.8 m each side, a 2.6 m pavement, a car 3.3 m.
export const ROAD = { w: 6, walk: 2.6, bike: 1.8, lane: 1.5 };
// The town's levels: the road, the bike track a kerb above it, the pavement a kerb above that, the canal's water
// (still above GROUND, so the office's ground plane never covers it) and its quays an embankment above.
export const LEVEL = { road: -0.11, bike: -0.08, walk: -0.05, canal: -0.1, quay: 0.42 };
export const WATER = { level: 0.17, bed: 0.0, bank: 3 };
export const STOREY = 2.95;
// The lot used for generating grows and shrinks in steps of this many metres (see growLot).
export const LOT_STEP = 4;

// ---- numbers -------------------------------------------------------------------------------------------------------

export function seedOf(s) {
  let h = 2166136261;
  for (const c of String(s ?? "")) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// mulberry32: small, fast, and the same on every engine.
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2(ix, iz, s) {
  let h = (Math.imul(ix, 374761393) + Math.imul(iz, 668265263) + Math.imul(s | 0, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// Value noise in 0..1 with smooth steps between lattice points, and a few octaves of it.
export function noise2(x, z, s) {
  const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz, s), b = hash2(ix + 1, iz, s), c = hash2(ix, iz + 1, s), d = hash2(ix + 1, iz + 1, s);
  return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
}
export function fbm(x, z, s, octaves = 4) {
  let v = 0, amp = 0.5, f = 1, n = 0;
  for (let i = 0; i < octaves; i++) { v += amp * noise2(x * f, z * f, s + i * 1013); n += amp; amp *= 0.5; f *= 2.03; }
  return v / n;
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// How tall something d metres out from the lot may stand without hiding the building: at 30° it hides about 1.75 ×
// its height of ground behind it, and the lot keeps at least GARDEN metres of garden round the building.
export const GARDEN = 3;
export const sight = (d) => Math.max(0.6, (d + GARDEN) / 1.75);
export const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const r2 = (v) => Math.round(v * 100) / 100;
const r3 = (v) => Math.round(v * 1000) / 1000;
const down2 = (v) => Math.floor(v * 100) / 100; // a size rounded down, so a cap still holds after rounding

// ---- rects and lines -----------------------------------------------------------------------------------------------

export const rect = (minX, minZ, maxX, maxZ) => ({ minX, minZ, maxX, maxZ });
export function distToRect(x, z, r) {
  const dx = Math.max(r.minX - x, 0, x - r.maxX), dz = Math.max(r.minZ - z, 0, z - r.maxZ);
  return Math.hypot(dx, dz);
}
export function rectGap(a, b) {
  const dx = Math.max(a.minX - b.maxX, 0, b.minX - a.maxX), dz = Math.max(a.minZ - b.maxZ, 0, b.minZ - a.maxZ);
  return Math.hypot(dx, dz);
}
// Strictly inside: a point on the edge is not in.
export const inside = (x, z, r, e = 0) => x > r.minX + e && x < r.maxX - e && z > r.minZ + e && z < r.maxZ - e;
export const overlaps = (a, b) => a.minX < b.maxX && b.minX < a.maxX && a.minZ < b.maxZ && b.minZ < a.maxZ;

// Distance from (x, z) to a polyline [{x, z}], with the segment and how far along it.
export function nearestOnLine(x, z, pts) {
  let best = Infinity, bi = 0, bt = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const dx = b.x - a.x, dz = b.z - a.z, L2 = dx * dx + dz * dz || 1;
    const t = clamp(((x - a.x) * dx + (z - a.z) * dz) / L2, 0, 1);
    const d = Math.hypot(a.x + dx * t - x, a.z + dz * t - z);
    if (d < best) { best = d; bi = i; bt = t; }
  }
  return { d: best, i: bi, t: bt };
}

// nearestOnLine for many queries near one line: segments bucketed by cell, each in every cell within `reach` of it.
// A point further than `reach` from the line gets { d: reach, far: true }.
export function lineIndex(pts, reach = 26, cell = 8) {
  const grid = new Map(), key = (i, j) => i * 100003 + j;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const i0 = Math.floor((Math.min(a.x, b.x) - reach) / cell), i1 = Math.floor((Math.max(a.x, b.x) + reach) / cell);
    const j0 = Math.floor((Math.min(a.z, b.z) - reach) / cell), j1 = Math.floor((Math.max(a.z, b.z) + reach) / cell);
    for (let gi = i0; gi <= i1; gi++) for (let gj = j0; gj <= j1; gj++) { const k = key(gi, gj); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(i); }
  }
  return (x, z) => {
    const list = grid.get(key(Math.floor(x / cell), Math.floor(z / cell)));
    let best = reach, bi = 0, bt = 0, far = true;
    for (const i of list ?? []) {
      const a = pts[i], b = pts[i + 1];
      const dx = b.x - a.x, dz = b.z - a.z, L2 = dx * dx + dz * dz || 1;
      const t = clamp(((x - a.x) * dx + (z - a.z) * dz) / L2, 0, 1);
      const d = Math.hypot(a.x + dx * t - x, a.z + dz * t - z);
      if (d < best) { best = d; bi = i; bt = t; far = false; }
    }
    return { d: best, i: bi, t: bt, far };
  };
}

// Catmull-Rom through control points, sampled every `step` metres or so.
function spline(ctrl, step) {
  const out = [];
  const P = (i) => ctrl[clamp(i, 0, ctrl.length - 1)];
  for (let i = 0; i < ctrl.length - 1; i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    const n = Math.max(2, Math.ceil(Math.hypot(p2.x - p1.x, p2.z - p1.z) / step));
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push({ x: f(p0.x, p1.x, p2.x, p3.x), z: f(p0.z, p1.z, p2.z, p3.z) });
    }
  }
  out.push({ ...ctrl[ctrl.length - 1] });
  return out;
}

export function lineLength(pts, closed = false) {
  let L = 0;
  for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z);
  if (closed && pts.length > 1) L += Math.hypot(pts[0].x - pts.at(-1).x, pts[0].z - pts.at(-1).z);
  return L;
}

// ---- the lot -------------------------------------------------------------------------------------------------------

export function normLot(lot) {
  const l = lot ?? { minX: -10, minZ: -6, maxX: 10, maxZ: 6 };
  return { minX: +l.minX, minZ: +l.minZ, maxX: +l.maxX, maxZ: +l.maxZ, door: ["n", "s", "e", "w"].includes(l.door) ? l.door : "s" };
}

// The lot to generate for: the office's lot rounded out to LOT_STEP with half a metre to spare. While the office's
// lot still fits in the previous one, with no side more than MAX_SLACK too big, the previous one is kept, so an
// office that grows by a room does not reshuffle the land round it. A side the office grew past gets AHEAD metres
// more, since offices are added on along it: a run of new rooms regenerates the land every second or third room.
export const AHEAD = 10, MAX_SLACK = 18;
export function growLot(lot, prev = null) {
  const l = normLot(lot);
  if (prev) {
    const fits = l.minX >= prev.minX && l.minZ >= prev.minZ && l.maxX <= prev.maxX && l.maxZ <= prev.maxZ;
    const slack = Math.max(l.minX - prev.minX, l.minZ - prev.minZ, prev.maxX - l.maxX, prev.maxZ - l.maxZ);
    if (fits && slack <= MAX_SLACK && prev.door === l.door) return prev;
  }
  const lo = (v) => Math.floor((v - 0.5) / LOT_STEP) * LOT_STEP, hi = (v) => Math.ceil((v + 0.5) / LOT_STEP) * LOT_STEP;
  const grew = (side) => (prev && prev.door === l.door ? (side === "minX" ? l.minX < prev.minX : side === "minZ" ? l.minZ < prev.minZ : side === "maxX" ? l.maxX > prev.maxX : l.maxZ > prev.maxZ) : false);
  return {
    minX: lo(l.minX) - (grew("minX") ? AHEAD : 0), minZ: lo(l.minZ) - (grew("minZ") ? AHEAD : 0),
    maxX: hi(l.maxX) + (grew("maxX") ? AHEAD : 0), maxZ: hi(l.maxZ) + (grew("maxZ") ? AHEAD : 0), door: l.door,
  };
}

// ---- the entry point -----------------------------------------------------------------------------------------------

export function generate({ mode = "nature", seed = 1, lot } = {}) {
  const L = normLot(lot);
  const s = typeof seed === "number" ? seed >>> 0 : seedOf(seed);
  const R = rng(s ^ (mode === "city" ? 0x9e3779b9 : 0x85ebca6b));
  const extent = rect(L.minX - PAD, L.minZ - PAD, L.maxX + PAD, L.maxZ + PAD);
  const base = { mode: mode === "city" ? "city" : "nature", seed: s, lot: L, extent, fade: { ...FADE }, ground: GROUND };
  return base.mode === "city" ? { ...base, ...city(R, s, L, extent) } : { ...base, ...nature(R, s, L, extent) };
}

// ---- nature --------------------------------------------------------------------------------------------------------

// Terrain tags: what the ground is at a vertex (the build turns them into colours).
export const TAG = { lawn: 0, grass: 1, meadow: 2, forest: 3, bank: 4, bed: 5, dry: 6 };

// A grid whose lines fall on the lot's edges, CELL apart outside it, so the lot is a clean hole.
function gridLines(lo, hi, eLo, eHi) {
  const out = [];
  for (let v = lo - CELL * Math.ceil((lo - eLo) / CELL); v < lo; v += CELL) out.push(v);
  const n = Math.max(1, Math.round((hi - lo) / CELL));
  for (let k = 0; k <= n; k++) out.push(lo + ((hi - lo) * k) / n);
  for (let v = hi + CELL; v <= eHi + 1e-6; v += CELL) out.push(v);
  return out.map(r3);
}

function nature(R, s, lot, ext) {
  const cx = (lot.minX + lot.maxX) / 2, cz = (lot.minZ + lot.maxZ) / 2;
  const hw = (lot.maxX - lot.minX) / 2, hd = (lot.maxZ - lot.minZ) / 2;
  const dLot = (x, z) => distToRect(x, z, lot);

  // The river bends round one corner of the lot, at least GAP from it. Drawn for the corner (+u, +v) and mirrored.
  const sx = R() < 0.5 ? 1 : -1, sz = R() < 0.5 ? 1 : -1;
  const W = (u, v) => ({ x: cx + sx * u, z: cz + sz * v });
  const G = 13 + R() * 5, far = PAD + 10;
  const ctrl = [
    W(-hw - far, hd + G + 6 + R() * 10),
    W(-hw - far * 0.45, hd + G + 2 + R() * 9),
    W(-hw * 0.3 + (R() - 0.5) * hw * 0.8, hd + G + R() * 4),
    W(hw + G * 0.6, hd + G * 0.6),
    W(hw + G + R() * 4, -hd * 0.3 + (R() - 0.5) * hd * 0.8),
    W(hw + G + 2 + R() * 9, -hd - far * 0.45),
    W(hw + G + 6 + R() * 10, -hd - far),
  ];
  let river = spline(ctrl, 1.5);
  // meander: a slow sideways swing along the river, then keep clear of the lot and smooth the kinks out
  const phase = R() * 6.28;
  river = river.map((p, i) => {
    const a = river[Math.max(0, i - 1)], b = river[Math.min(river.length - 1, i + 1)];
    const tx = b.x - a.x, tz = b.z - a.z, tl = Math.hypot(tx, tz) || 1;
    const k = Math.sin(i * 0.09 + phase) * 2.2 + (fbm(i * 0.05, 3.1, s + 11, 2) - 0.5) * 5;
    return { x: p.x - (tz / tl) * k, z: p.z + (tx / tl) * k };
  });
  const width = (i) => 2.3 + 1.1 * fbm(i * 0.04, 7.7, s + 13, 2);
  const MIN_GAP = 7;
  for (let pass = 0; pass < 4; pass++) {
    river = river.map((p, i) => {
      const need = MIN_GAP + width(i) + WATER.bank;
      const d = dLot(p.x, p.z);
      if (d >= need) return p;
      // push straight out from the nearest point of the lot
      const nx = clamp(p.x, lot.minX, lot.maxX), nz = clamp(p.z, lot.minZ, lot.maxZ);
      let ox = p.x - nx, oz = p.z - nz, ol = Math.hypot(ox, oz);
      if (ol < 1e-6) { ox = sx; oz = sz; ol = Math.SQRT2; }
      return { x: nx + (ox / ol) * need, z: nz + (oz / ol) * need };
    });
    if (pass < 3) river = river.map((p, i) => (i === 0 || i === river.length - 1 ? p : { x: (river[i - 1].x + 2 * p.x + river[i + 1].x) / 4, z: (river[i - 1].z + 2 * p.z + river[i + 1].z) / 4 }));
  }
  const riverPts = river.map((p, i) => ({ x: r2(p.x), z: r2(p.z), w: r2(width(i)) }));
  const nearRiver = lineIndex(riverPts);
  const halfAt = (x, z) => { const n = nearRiver(x, z); const a = riverPts[n.i], b = riverPts[n.i + 1] ?? a; return { d: n.d, w: n.far ? 0 : a.w + (b.w - a.w) * n.t }; };

  // The path: out from the middle of the door side, gently winding, over the river on a bridge if it meets it.
  const door = lot.door;
  const out = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] }[door];
  const start = door === "n" ? { x: cx, z: lot.minZ } : door === "s" ? { x: cx, z: lot.maxZ } : door === "e" ? { x: lot.maxX, z: cz } : { x: lot.minX, z: cz };
  const pathPhase = R() * 6.28;
  const path = [];
  for (let t = 0; t <= PAD + 4; t += 1.25) {
    const k = Math.sin(t / 8.5 + pathPhase) * 1.6 * smooth(0, 12, t) - Math.sin(pathPhase) * 1.6 * smooth(0, 12, t);
    path.push({ x: r2(start.x + out[0] * t - out[1] * k), z: r2(start.z + out[1] * t + out[0] * k) });
  }
  path[0] = { x: r2(start.x), z: r2(start.z) };
  // The bridge goes where the path is deepest in the first stretch of water it meets; a second stretch ends the path.
  let bridge = null;
  const wet = path.map((p) => { const h = halfAt(p.x, p.z); return { d: h.d, w: h.w, in: h.d < h.w + 0.6 }; });
  const first = wet.findIndex((w) => w.in);
  if (first > 0) {
    let k = first, best = first;
    while (k < path.length && wet[k].in) { if (wet[k].d < wet[best].d) best = k; k++; }
    const again = wet.findIndex((w, i) => i > k && w.in);
    if (again > 0) path.length = again;
    const a = path[Math.max(0, best - 3)], b = path[Math.min(path.length - 1, best + 3)];
    bridge = { x: path[best].x, z: path[best].z, ry: r3(Math.atan2(b.x - a.x, b.z - a.z)), length: r2(2 * (wet[best].w + WATER.bank * 0.75) + 1), width: 1.7 };
  }

  // A pond in a meadow, sometimes: clear of the lot, the river and the path.
  let pond = null;
  if (R() < 0.65) {
    for (let tries = 0; tries < 40 && !pond; tries++) {
      const ang = R() * Math.PI * 2, dist = 16 + R() * 16;
      const nx = clamp(cx + Math.cos(ang) * (hw + dist), ext.minX, ext.maxX), nz = clamp(cz + Math.sin(ang) * (hd + dist), ext.minZ, ext.maxZ);
      const rx = 3.6 + R() * 2.6, rz = 2.6 + R() * 1.8;
      const reach = Math.max(rx, rz) + WATER.bank;
      if (dLot(nx, nz) < reach + 8) continue;
      const h = halfAt(nx, nz);
      if (h.d - h.w < reach + 8) continue;
      if (nearestOnLine(nx, nz, path).d < reach + 4) continue;
      pond = { x: r2(nx), z: r2(nz), rx: r2(rx), rz: r2(rz), ry: r3(R() * Math.PI) };
    }
  }
  const pondD = (x, z) => {
    if (!pond) return Infinity;
    const c = Math.cos(pond.ry), sn = Math.sin(pond.ry);
    const u = ((x - pond.x) * c - (z - pond.z) * sn) / pond.rx, v = ((x - pond.x) * sn + (z - pond.z) * c) / pond.rz;
    return (Math.hypot(u, v) - 1) * Math.min(pond.rx, pond.rz); // roughly metres outside the shore line
  };

  // Terrain: a plateau at the lot's level, rising over a few metres to rolling hills that grow with distance and
  // flatten into a valley along the water. Heights stay above GROUND everywhere.
  const xs = gridLines(lot.minX, lot.maxX, ext.minX, ext.maxX), zs = gridLines(lot.minZ, lot.maxZ, ext.minZ, ext.maxZ);
  const forestAt = (x, z) => fbm(x / 26, z / 26, s + 7, 3);
  const meadowAt = (x, z) => fbm(x / 17 + 40, z / 17, s + 9, 3);
  function heightOf(x, z) {
    const dl = dLot(x, z);
    const rv = halfAt(x, z), dr = rv.d - rv.w, pd = pondD(x, z);
    const valley = smooth(2, 20, Math.min(dr, pd + 2));
    const hill = Math.max(0, fbm(x / 34, z / 34, s + 1, 4) - 0.36) * 2.4;
    const detail = (fbm(x / 9, z / 9, s + 3, 2) - 0.5) * 0.35 * smooth(4, 14, dl);
    const land = 0.42 + Math.min(sight(dl) * 0.8, 13 * hill * smooth(6, 34, dl)) * valley + detail;
    let h = GROUND + (land - GROUND) * smooth(0.5, 7.5, dl);
    const dw = Math.min(dr, pd);
    if (dw < WATER.bank) h = WATER.bed + (h - WATER.bed) * smooth(-0.8, WATER.bank, dw);
    return { h: Math.max(GROUND, h), dl, dw, rv };
  }
  const H = [], T = [], Tn = [];
  for (const z of zs) for (const x of xs) {
    const { h, dl, dw } = heightOf(x, z);
    let tag = TAG.grass;
    if (dl < 6) tag = TAG.lawn;
    else if (dw < 0.7) tag = TAG.bed;
    else if (dw < 1.9) tag = TAG.bank;
    else if (h > 3.6) tag = TAG.dry;
    else if (forestAt(x, z) > 0.56 && dl > 12) tag = TAG.forest;
    else if (meadowAt(x, z) > 0.58) tag = TAG.meadow;
    H.push(r3(h)); T.push(tag); Tn.push(r2(fbm(x / 6, z / 6, s + 5, 2) - 0.5));
  }
  const terrain = { xs, zs, h: H, tag: T, tone: Tn };
  const heightAt = (x, z) => sampleGrid(terrain, x, z);

  // Trees: a jittered grid, thick in the forest noise and thin near the clearing, never taller than the view over
  // the lot allows (a tree d metres out hides about 1.7 × its height of ground behind it).
  const nearPath = lineIndex(path, 12);
  const pathD = (x, z) => nearPath(x, z).d;
  const bridgeD = (x, z) => (bridge ? Math.hypot(x - bridge.x, z - bridge.z) - bridge.length / 2 : Infinity);
  let trees = [];
  const STEP = 3.1;
  for (let gz = ext.minZ; gz < ext.maxZ; gz += STEP) for (let gx = ext.minX; gx < ext.maxX; gx += STEP) {
    const x = gx + R() * STEP, z = gz + R() * STEP, roll = R(), sp = R(), sc = R(), rot = R();
    const dl = dLot(x, z);
    if (dl < 5 || dl > FADE.to + 2) continue;
    const rv = halfAt(x, z), dr = rv.d - rv.w;
    if (dr < WATER.bank + 0.6 || pondD(x, z) < WATER.bank + 0.6 || pathD(x, z) < 2.2 || bridgeD(x, z) < 2) continue;
    const forest = forestAt(x, z);
    const p = smooth(4, 13, dl) * (smooth(0.4, 0.56, forest) * 0.9 + 0.07) + (dl < 16 ? 0.12 * smooth(4, 8, dl) * smooth(0.35, 0.5, forest) : 0);
    if (roll > p) continue;
    const h = heightAt(x, z);
    const wet = dr < 10;
    let kind;
    if (dl < 12) kind = sp < 0.55 ? "shrub" : sp < 0.85 ? "birch" : "maple";
    else if (h > 2.4 && sp < 0.65) kind = "conifer";
    else if (forest > 0.6 && sp < 0.6) kind = "conifer";
    else if (wet && sp < 0.55) kind = "birch";
    else if (forest < 0.52 && sp < 0.4) kind = "shrub";
    else kind = sp < 0.1 ? "maple-red" : sp < 0.62 ? "maple" : sp < 0.82 ? "birch" : "conifer";
    const tall = { conifer: 5.2, birch: 4.6, maple: 4.2, "maple-red": 4.2, shrub: 1.3 }[kind];
    const cap = sight(dl - 1.3) / tall;
    const scale = Math.min(cap, 0.8 + sc * 0.5 + (kind === "conifer" ? smooth(1, 5, h) * 0.3 : 0));
    trees.push({ kind, x: r2(x), z: r2(z), y: r3(h - 0.06), s: down2(scale), ry: r2(rot * 6.283), tone: r2(0.88 + sc * 0.2) });
  }
  trees = thin(trees, CAPS.trees, rng(s + 17));

  // Rocks by the water and on the hills, flowers in the meadows, reeds along the banks.
  const rocks = [], flowers = [], reeds = [], tufts = [];
  for (let i = 0; i < 900 && rocks.length < CAPS.rocks; i++) {
    const x = ext.minX + R() * (ext.maxX - ext.minX), z = ext.minZ + R() * (ext.maxZ - ext.minZ), k = R(), sc = R();
    const dl = dLot(x, z);
    if (dl < 7 || dl > FADE.to) continue;
    const rv = halfAt(x, z), dr = rv.d - rv.w, h = heightAt(x, z);
    const byWater = dr > 0.8 && dr < WATER.bank + 1.5, onHill = h > 2.2;
    if (!(byWater && k < 0.5) && !(onHill && k < 0.25) && k > 0.04) continue;
    if (pathD(x, z) < 1.6 || bridgeD(x, z) < 1.5 || pondD(x, z) < 0.6) continue;
    rocks.push({ x: r2(x), z: r2(z), y: r3(h - 0.1), s: r2(0.35 + sc * (onHill ? 0.9 : 0.5)), ry: r2(R() * 6.28), tone: r2(0.85 + R() * 0.25) });
  }
  for (let i = 0; i < 6000 && flowers.length < CAPS.flowers; i++) {
    const x = ext.minX + R() * (ext.maxX - ext.minX), z = ext.minZ + R() * (ext.maxZ - ext.minZ), c = R();
    const dl = dLot(x, z);
    if (dl < 3 || dl > FADE.to - 4 || meadowAt(x, z) < 0.6) continue;
    const rv = halfAt(x, z);
    if (rv.d - rv.w < WATER.bank || pondD(x, z) < WATER.bank || pathD(x, z) < 1) continue;
    flowers.push({ x: r2(x), z: r2(z), y: r3(heightAt(x, z)), c: Math.floor(c * 5), ry: r2(R() * 6.28) });
  }
  // tufts of longer grass, in loose drifts, so the open ground is not a flat sheet
  for (let i = 0; i < 9000 && tufts.length < CAPS.tufts; i++) {
    const x = ext.minX + R() * (ext.maxX - ext.minX), z = ext.minZ + R() * (ext.maxZ - ext.minZ), k = R(), sc = R();
    const dl = dLot(x, z);
    if (dl < 1.5 || dl > FADE.to - 6 || fbm(x / 5, z / 5, s + 23, 2) < 0.5 + k * 0.12) continue;
    const rv = halfAt(x, z);
    if (rv.d - rv.w < WATER.bank - 0.5 || pondD(x, z) < WATER.bank - 0.5 || pathD(x, z) < 1.1 || bridgeD(x, z) < 1) continue;
    tufts.push({ x: r2(x), z: r2(z), y: r3(heightAt(x, z) - 0.03), s: r2(0.9 + sc * 0.7), ry: r2(R() * 6.28) });
  }
  const shore = (pts, wOf) => {
    for (let i = 1; i < pts.length - 1 && reeds.length < CAPS.reeds; i++) {
      const p = pts[i], a = pts[i - 1], b = pts[i + 1];
      const tx = b.x - a.x, tz = b.z - a.z, tl = Math.hypot(tx, tz) || 1;
      for (const side of [-1, 1]) {
        if (fbm(p.x / 7, p.z / 7 + side * 9, s + 21, 2) < 0.52 || R() < 0.35) continue;
        const off = wOf(i) + 0.9 + R() * 1.0;
        const x = p.x - (tz / tl) * off * side, z = p.z + (tx / tl) * off * side;
        if (dLot(x, z) < 4 || dLot(x, z) > FADE.to || bridgeD(x, z) < 1.2) continue;
        reeds.push({ x: r2(x), z: r2(z), y: r3(Math.max(WATER.level - 0.05, heightAt(x, z) - 0.05)), s: r2(0.7 + R() * 0.5), ry: r2(R() * 6.28) });
      }
    }
  };
  shore(riverPts, (i) => riverPts[i].w);
  if (pond) {
    const ring = Array.from({ length: 28 }, (_, k) => {
      const a = (k / 28) * Math.PI * 2, c = Math.cos(pond.ry), sn = Math.sin(pond.ry);
      const u = Math.cos(a) * pond.rx, v = Math.sin(a) * pond.rz;
      return { x: pond.x + u * c + v * sn, z: pond.z - u * sn + v * c };
    });
    shore(ring, () => 0);
  }

  const pathOut = path.filter((p) => { const h = halfAt(p.x, p.z); return h.d - h.w > 0.6 && pondD(p.x, p.z) > 0.5; });
  if (bridge) {
    const ends = [-1, 1].map((k) => heightAt(bridge.x + Math.sin(bridge.ry) * (bridge.length / 2) * k, bridge.z + Math.cos(bridge.ry) * (bridge.length / 2) * k));
    bridge.y0 = r3(ends[0]); bridge.y1 = r3(ends[1]);
    bridge.rise = r3(Math.max(ends[0], ends[1]) + 0.55);
  }
  return {
    terrain,
    water: { level: WATER.level, river: riverPts, pond },
    path: { points: pathOut, all: path, width: 1.4, entry: { x: r2(start.x), z: r2(start.z) } },
    bridge,
    trees, rocks, flowers, reeds, tufts,
  };
}

// Height on the terrain grid at (x, z), bilinear between its vertices.
export function sampleGrid(t, x, z) {
  const ix = clamp(upper(t.xs, x) - 1, 0, t.xs.length - 2), iz = clamp(upper(t.zs, z) - 1, 0, t.zs.length - 2);
  const fx = clamp((x - t.xs[ix]) / (t.xs[ix + 1] - t.xs[ix]), 0, 1), fz = clamp((z - t.zs[iz]) / (t.zs[iz + 1] - t.zs[iz]), 0, 1);
  const n = t.xs.length, h = (i, j) => t.h[j * n + i];
  return (h(ix, iz) * (1 - fx) + h(ix + 1, iz) * fx) * (1 - fz) + (h(ix, iz + 1) * (1 - fx) + h(ix + 1, iz + 1) * fx) * fz;
}
function upper(arr, v) { let lo = 0, hi = arr.length; while (lo < hi) { const m = (lo + hi) >> 1; if (arr[m] <= v) lo = m + 1; else hi = m; } return lo; }

// Keep at most `cap` items, dropped evenly at random so no side of the map loses more than another.
function thin(items, cap, R) {
  if (items.length <= cap) return items;
  const keep = cap / items.length;
  const out = items.filter(() => R() < keep);
  return out.slice(0, cap);
}
