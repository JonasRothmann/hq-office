// The land around the office, pure (no three.js): mode, seed and the office's lot in; terrain, water, trees, roads,
// buildings and the loops that cars and people follow out, as plain data. The same input gives the same layout.
//
// Units are metres; x runs east, z runs south, y is up. The lot (the building plus the garden other lanes draw) is a
// hole: nothing here reaches into it. The office's own ground plane lies at y = -0.12; everything here stays above
// it (GROUND), so that plane never covers a river or a road. Past FADE.to metres from the lot everything has faded
// into the background colour, and the layout stops a little after that (PAD).

export const PAD = 64;
export const FADE = { from: 34, to: 60 };
export const GROUND = -0.115;
export const CELL = 2;
export const CAPS = { cars: 40, people: 60, trees: 1000, flowers: 520, rocks: 140, reeds: 280 };
// Sims scale (a person is 1.35 m): two lanes of 3 m, a 3 m pavement, a car 3.3 m long.
export const ROAD = { w: 6, walk: 3, lane: 1.5 };
export const LEVEL = { road: -0.11, walk: -0.05 };
export const WATER = { level: 0.17, bed: 0.0, bank: 3 };
export const STOREY = 2.95;
// The lot used for generating grows and shrinks in steps of this many metres (see growLot).
export const LOT_STEP = 6;

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
export const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const r2 = (v) => Math.round(v * 100) / 100;
const r3 = (v) => Math.round(v * 1000) / 1000;

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

// The lot to generate for: the office's lot rounded out to LOT_STEP with a metre to spare. While the office's lot
// still fits in the previous one, and that one is no more than two steps too big on any side, the previous one is
// kept, so an office that grows by a room does not reshuffle the land around it.
export function growLot(lot, prev = null) {
  const l = normLot(lot);
  if (prev) {
    const fits = l.minX >= prev.minX && l.minZ >= prev.minZ && l.maxX <= prev.maxX && l.maxZ <= prev.maxZ;
    const slack = Math.max(l.minX - prev.minX, l.minZ - prev.minZ, prev.maxX - l.maxX, prev.maxZ - l.maxZ);
    if (fits && slack <= 2 * LOT_STEP + 1 && prev.door === l.door) return prev;
  }
  const lo = (v) => Math.floor((v - 1) / LOT_STEP) * LOT_STEP, hi = (v) => Math.ceil((v + 1) / LOT_STEP) * LOT_STEP;
  return { minX: lo(l.minX), minZ: lo(l.minZ), maxX: hi(l.maxX), maxZ: hi(l.maxZ), door: l.door };
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
  const halfAt = (x, z) => { const n = nearestOnLine(x, z, riverPts); const a = riverPts[n.i], b = riverPts[n.i + 1] ?? a; return { d: n.d, w: a.w + (b.w - a.w) * n.t }; };

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
    const amp = 7.5 * smooth(8, 46, dl) * valley;
    const hill = Math.max(0, fbm(x / 40, z / 40, s + 1, 4) - 0.38) * 2.2;
    const detail = (fbm(x / 9, z / 9, s + 3, 2) - 0.5) * 0.35 * smooth(4, 14, dl);
    const land = 0.42 + amp * hill + detail;
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
  const pathD = (x, z) => nearestOnLine(x, z, path).d;
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
    const p = smooth(5, 22, dl) * (smooth(0.45, 0.62, forest) * 0.92 + 0.05);
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
    const cap = Math.max(0.5, (dl - 1) / 1.75) / tall;
    const scale = Math.min(cap, 0.8 + sc * 0.5 + (kind === "conifer" ? smooth(1, 5, h) * 0.3 : 0));
    trees.push({ kind, x: r2(x), z: r2(z), y: r3(h - 0.06), s: r2(scale), ry: r2(rot * 6.283), tone: r2(0.88 + sc * 0.2) });
  }
  trees = thin(trees, CAPS.trees, rng(s + 17));

  // Rocks by the water and on the hills, flowers in the meadows, reeds along the banks.
  const rocks = [], flowers = [], reeds = [];
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
    flowers.push({ x: r2(x), z: r2(z), y: r3(heightAt(x, z)), c: Math.floor(c * 5) });
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
    trees, rocks, flowers, reeds,
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

// ---- city ----------------------------------------------------------------------------------------------------------

export const SHIRTS = 10, PANTS = 6, SKINS = 6, HAIRS = 7, CAR_PAINTS = 9;

function city(R, s, lot, ext) {
  const RW = ROAD.w, SW = ROAD.walk, half = RW / 2;
  // Road centre lines: the ring round the lot's block, then blocks of varied size outward past the extent.
  const xs = [lot.minX - SW - half, lot.maxX + SW + half];
  while (xs[0] > ext.minX - 6) xs.unshift(r2(xs[0] - (RW + 2 * SW + 17 + R() * 14)));
  while (xs.at(-1) < ext.maxX + 6) xs.push(r2(xs.at(-1) + (RW + 2 * SW + 17 + R() * 14)));
  const zs = [lot.minZ - SW - half, lot.maxZ + SW + half];
  while (zs[0] > ext.minZ - 6) zs.unshift(r2(zs[0] - (RW + 2 * SW + 15 + R() * 11)));
  while (zs.at(-1) < ext.maxZ + 6) zs.push(r2(zs.at(-1) + (RW + 2 * SW + 15 + R() * 11)));
  const nx = xs.length, nz = zs.length;

  const roads = [], junctions = [], crossings = [], walks = [], blocks = [];
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz - 1; j++) roads.push({ ...rect(xs[i] - half, zs[j] + half, xs[i] + half, zs[j + 1] - half), dir: "z", line: i });
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx - 1; i++) roads.push({ ...rect(xs[i] + half, zs[j] - half, xs[i + 1] - half, zs[j] + half), dir: "x", line: j });
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
    const x = xs[i], z = zs[j];
    junctions.push({ ...rect(x - half, z - half, x + half, z + half), x, z });
    // a zebra crossing on every arm, in line with the pavements either side of it
    if (j > 0) crossings.push({ ...rect(x - half, z - half - SW, x + half, z - half), dir: "x" });
    if (j < nz - 1) crossings.push({ ...rect(x - half, z + half, x + half, z + half + SW), dir: "x" });
    if (i > 0) crossings.push({ ...rect(x - half - SW, z - half, x - half, z + half), dir: "z" });
    if (i < nx - 1) crossings.push({ ...rect(x + half, z - half, x + half + SW, z + half), dir: "z" });
  }

  const dLotRect = (r) => rectGap(r, lot);
  const buildings = [], trees = [], lamps = [];
  for (let i = 0; i < nx - 1; i++) for (let j = 0; j < nz - 1; j++) {
    const outer = rect(xs[i] + half, zs[j] + half, xs[i + 1] - half, zs[j + 1] - half);
    const inner = rect(outer.minX + SW, outer.minZ + SW, outer.maxX - SW, outer.maxZ - SW);
    walks.push(rect(outer.minX, outer.minZ, outer.maxX, outer.minZ + SW), rect(outer.minX, outer.maxZ - SW, outer.maxX, outer.maxZ));
    walks.push(rect(outer.minX, outer.minZ + SW, outer.minX + SW, outer.maxZ - SW), rect(outer.maxX - SW, outer.minZ + SW, outer.maxX, outer.maxZ - SW));
    const isLot = Math.abs(inner.minX - lot.minX) < 1e-6 && Math.abs(inner.minZ - lot.minZ) < 1e-6;
    const dl = dLotRect(inner);
    const visible = dl < FADE.to + 4;
    const kind = isLot ? "lot" : !visible ? "far" : R() < 0.13 ? "park" : "built";
    const block = { i, j, outer, inner, kind, ground: kind === "park" ? "grass" : R() < 0.45 ? "gravel" : "grass" };
    blocks.push(block);
    if (kind === "built") parcels(R, block, buildings, trees, lot);
    if (kind === "park") park(R, block, trees);
    if (!visible) continue;
    streetside(R, outer, lamps, trees, lot);
  }

  // Cars: loops round rectangles of blocks, on the right-hand lane, turning at the junctions.
  const vis = (r) => dLotRect(r) < 42;
  const cars = [];
  const roadLen = roads.filter(vis).reduce((a, r) => a + Math.max(r.maxX - r.minX, r.maxZ - r.minZ), 0);
  const nCars = Math.min(CAPS.cars, Math.max(8, Math.round(roadLen / 30)));
  for (let tries = 0; cars.length < nCars && tries < 400; tries++) {
    const i0 = Math.floor(R() * (nx - 1)), j0 = Math.floor(R() * (nz - 1));
    const i1 = Math.min(nx - 1, i0 + 1 + Math.floor(R() * 3)), j1 = Math.min(nz - 1, j0 + 1 + Math.floor(R() * 2));
    const box = rect(xs[i0], zs[j0], xs[i1], zs[j1]);
    if (!vis(box)) continue;
    const cw = R() < 0.5;
    const path = roundedLoop(box, cw ? -ROAD.lane : ROAD.lane, cw ? 1.6 : 2.8, cw);
    cars.push({ path, speed: r2(3.4 + R() * 1.6), offset: r2(R() * lineLength(path, true)), paint: Math.floor(R() * CAR_PAINTS), kind: R() < 0.3 ? "kei" : "car" });
  }

  // People: loops on the middle of the pavements round one or two blocks (the lot's too), over the zebras.
  const people = [];
  const nPeople = Math.min(CAPS.people, 30 + Math.floor(R() * 20));
  for (let tries = 0; people.length < nPeople && tries < 600; tries++) {
    const bi0 = Math.floor(R() * (nx - 1)), bj0 = Math.floor(R() * (nz - 1));
    const wide = R() < 0.35, tall = !wide && R() < 0.3;
    const bi1 = Math.min(nx - 2, bi0 + (wide ? 1 : 0)), bj1 = Math.min(nz - 2, bj0 + (tall ? 1 : 0));
    const outer = rect(xs[bi0] + half, zs[bj0] + half, xs[bi1 + 1] - half, zs[bj1 + 1] - half);
    if (dLotRect(outer) > 36) continue;
    const off = SW / 2 + (R() - 0.5) * 1.2;
    const box = rect(outer.minX + off, outer.minZ + off, outer.maxX - off, outer.maxZ - off);
    const cw = R() < 0.5;
    const path = roundedLoop(box, 0, 0.5, cw);
    people.push({ path, speed: r2(0.85 + R() * 0.5), offset: r2(R() * lineLength(path, true)), shirt: Math.floor(R() * SHIRTS), pants: Math.floor(R() * PANTS), skin: Math.floor(R() * SKINS), hair: Math.floor(R() * HAIRS) });
  }

  return { grid: { xs, zs, road: RW, walk: SW }, roads, junctions, crossings, walks, blocks, buildings, trees, lamps, cars, people };
}

// A closed loop round a rect grown by `grow` metres (negative shrinks it), corners rounded with radius r, as points.
// cw: clockwise seen from above with north up (east along the north side first). Traffic keeps right, so a clockwise
// car is on the inside of its loop and an anticlockwise one on the outside.
export function roundedLoop(b, grow, r, cw) {
  const minX = b.minX - grow, minZ = b.minZ - grow, maxX = b.maxX + grow, maxZ = b.maxZ + grow;
  // corners in clockwise order: NE, SE, SW, NW, each with the angle range of its arc (angles in x-z, 0 = +x)
  const C = [
    { x: maxX - r, z: minZ + r, a0: -Math.PI / 2, a1: 0 },
    { x: maxX - r, z: maxZ - r, a0: 0, a1: Math.PI / 2 },
    { x: minX + r, z: maxZ - r, a0: Math.PI / 2, a1: Math.PI },
    { x: minX + r, z: minZ + r, a0: Math.PI, a1: Math.PI * 1.5 },
  ];
  const pts = [];
  for (const c of C) for (let k = 0; k <= 5; k++) {
    const a = c.a0 + ((c.a1 - c.a0) * k) / 5;
    pts.push({ x: r2(c.x + Math.cos(a) * r), z: r2(c.z + Math.sin(a) * r) });
  }
  return cw ? pts : pts.reverse();
}

// Buildings round the edge of a block, facing its streets, with a yard in the middle. Near the office they stay low
// so they never hide it: a building d metres from the lot is at most about d / 1.75 tall.
function parcels(R, block, buildings, trees, lot) {
  const I = block.inner, W = I.maxX - I.minX, D = I.maxZ - I.minZ;
  const rowD = D < 20 ? D / 2 : clamp(D * 0.36, 8, 13);
  const colW = clamp(W * 0.28, 6, 11);
  const rows = [
    { r: rect(I.minX, I.minZ, I.maxX, I.minZ + rowD), front: "n", along: "x" },
    { r: rect(I.minX, I.maxZ - rowD, I.maxX, I.maxZ), front: "s", along: "x" },
  ];
  if (D - 2 * rowD >= 6 && W > 2 * colW + 4) {
    rows.push({ r: rect(I.minX, I.minZ + rowD, I.minX + colW, I.maxZ - rowD), front: "w", along: "z" });
    rows.push({ r: rect(I.maxX - colW, I.minZ + rowD, I.maxX, I.maxZ - rowD), front: "e", along: "z" });
  }
  const mood = R(); // a block of houses, of flats, or a mix
  for (const row of rows) {
    const len = row.along === "x" ? row.r.maxX - row.r.minX : row.r.maxZ - row.r.minZ;
    const cuts = [0];
    while (len - cuts.at(-1) > 13) cuts.push(cuts.at(-1) + 6.5 + R() * 6);
    cuts.push(len);
    if (cuts.length > 2 && cuts.at(-1) - cuts.at(-2) < 5) cuts.splice(cuts.length - 2, 1);
    for (let k = 0; k < cuts.length - 1; k++) {
      const a = cuts[k], b = cuts[k + 1];
      const p = row.along === "x" ? rect(row.r.minX + a, row.r.minZ, row.r.minX + b, row.r.maxZ) : rect(row.r.minX, row.r.minZ + a, row.r.maxX, row.r.minZ + b);
      const corner = k === 0 || k === cuts.length - 2;
      const b0 = building(R, p, row.front, corner && row.along === "x", mood, lot);
      if (b0) buildings.push(b0);
      else if (R() < 0.5) trees.push({ kind: "round", x: r2((p.minX + p.maxX) / 2), z: r2((p.minZ + p.maxZ) / 2), y: LEVEL.walk, s: 0.8, ry: r2(R() * 6.28), tone: 1 });
    }
  }
  // the yard in the middle: a tree or two, and a hedge along it
  const yard = rect(I.minX + (rows.length > 2 ? colW : 0), I.minZ + rowD, I.maxX - (rows.length > 2 ? colW : 0), I.maxZ - rowD);
  if (yard.maxX - yard.minX > 4 && yard.maxZ - yard.minZ > 3) {
    const n = 1 + Math.floor(R() * 3);
    for (let k = 0; k < n; k++) {
      const x = yard.minX + 1.5 + R() * Math.max(0.1, yard.maxX - yard.minX - 3), z = yard.minZ + 1.2 + R() * Math.max(0.1, yard.maxZ - yard.minZ - 2.4);
      const tall = Math.max(0.5, (rectGap(rect(x - 1, z - 1, x + 1, z + 1), lot) - 1) / 1.75) / 4.2;
      trees.push({ kind: R() < 0.15 ? "maple-red" : "round", x: r2(x), z: r2(z), y: LEVEL.walk, s: r2(Math.min(tall, 0.75 + R() * 0.4)), ry: r2(R() * 6.28), tone: r2(0.9 + R() * 0.15) });
    }
  }
}

const HEIGHT_PER = 1.75;
function building(R, p, front, corner, mood, lot) {
  const side = 0.3 + R() * 0.5, setback = R() < 0.45 ? 0.2 : 0.6 + R() * 1.6, rear = 0.8 + R() * 1.5;
  let f = { ...p };
  const along = front === "n" || front === "s" ? "x" : "z";
  if (along === "x") { f.minX += side; f.maxX -= side; } else { f.minZ += side; f.maxZ -= side; }
  if (front === "n") { f.minZ += setback; f.maxZ -= rear; }
  if (front === "s") { f.maxZ -= setback; f.minZ += rear; }
  if (front === "w") { f.minX += setback; f.maxX -= rear; }
  if (front === "e") { f.maxX -= setback; f.minX += rear; }
  const w = f.maxX - f.minX, d = f.maxZ - f.minZ;
  if (w < 4 || d < 4) return null;
  const dl = rectGap(f, lot);
  const maxH = Math.max(3.2, (dl - 1) / HEIGHT_PER);
  const roll = R();
  let style;
  if (corner && roll < 0.55) style = "shop";
  else if (mood < 0.35) style = roll < 0.75 ? "house" : "shop";
  else if (mood < 0.75) style = roll < 0.3 ? "house" : roll < 0.8 ? "flats" : "shop";
  else style = roll < 0.5 ? "office" : roll < 0.85 ? "flats" : "shop";
  const want = { house: 1 + (R() < 0.8 ? 1 : 0), shop: 2 + (R() < 0.4 ? 1 : 0), flats: 3 + Math.floor(R() * 3), office: 4 + Math.floor(R() * 3) }[style];
  const roof = style === "house" ? (R() < 0.55 ? "hip" : "gable") : style === "office" ? "flat" : R() < 0.35 ? "gable" : "flat";
  const roofH = roof === "flat" ? 0.3 : Math.min(w, d) * (roof === "hip" ? 0.32 : 0.42);
  const floors = clamp(Math.min(want, Math.floor((maxH - roofH) / STOREY)), 1, 6);
  const wall = { house: R() < 0.6 ? "timber" : "plaster", shop: R() < 0.4 ? "timber" : "plaster", flats: R() < 0.8 ? "plaster" : "concrete", office: R() < 0.6 ? "concrete" : "plaster" }[style];
  return {
    x: r2((f.minX + f.maxX) / 2), z: r2((f.minZ + f.maxZ) / 2), w: r2(w), d: r2(d), y: LEVEL.walk,
    floors, h: r2(floors * STOREY), roof, roofH: r2(roof === "flat" ? 0.3 : roofH), ridge: w >= d ? "x" : "z",
    style, wall, tint: Math.floor(R() * 6), roofTint: Math.floor(R() * 4), front, shop: style === "shop",
    awning: style === "shop" && R() < 0.8 ? Math.floor(R() * 5) : null, seed: Math.floor(R() * 1e9),
    top: roof === "flat" && floors >= 3 ? Math.floor(R() * 3) : 0,
  };
}

function park(R, block, trees) {
  const I = block.inner;
  for (let k = 0; k < 40; k++) {
    const x = I.minX + 1.5 + R() * (I.maxX - I.minX - 3), z = I.minZ + 1.5 + R() * (I.maxZ - I.minZ - 3), c = R();
    // a cross of gravel paths through the middle stays clear
    if (Math.abs(x - (I.minX + I.maxX) / 2) < 1.6 || Math.abs(z - (I.minZ + I.maxZ) / 2) < 1.6) continue;
    if (R() < 0.55) trees.push({ kind: c < 0.12 ? "maple-red" : c < 0.75 ? "round" : c < 0.9 ? "conifer" : "shrub", x: r2(x), z: r2(z), y: LEVEL.walk, s: r2(0.7 + R() * 0.45), ry: r2(R() * 6.28), tone: r2(0.9 + R() * 0.15) });
  }
}

// Lamps and street trees along a block's pavements, on the kerb side, clear of the corners (and so of the zebras).
function streetside(R, outer, lamps, trees, lot) {
  const SW = ROAD.walk, kerb = 0.45;
  const edges = [
    { a: { x: outer.minX, z: outer.minZ + kerb }, b: { x: outer.maxX, z: outer.minZ + kerb }, face: Math.PI },
    { a: { x: outer.minX, z: outer.maxZ - kerb }, b: { x: outer.maxX, z: outer.maxZ - kerb }, face: 0 },
    { a: { x: outer.minX + kerb, z: outer.minZ }, b: { x: outer.minX + kerb, z: outer.maxZ }, face: -Math.PI / 2 },
    { a: { x: outer.maxX - kerb, z: outer.minZ }, b: { x: outer.maxX - kerb, z: outer.maxZ }, face: Math.PI / 2 },
  ];
  for (const e of edges) {
    const len = Math.hypot(e.b.x - e.a.x, e.b.z - e.a.z);
    const ux = (e.b.x - e.a.x) / len, uz = (e.b.z - e.a.z) / len;
    const leafy = R() < 0.55;
    const n = Math.max(1, Math.round((len - 2 * SW) / 15));
    for (let k = 0; k < n; k++) {
      const t = SW + 1 + ((len - 2 * SW - 2) * (k + 0.5)) / n;
      lamps.push({ x: r2(e.a.x + ux * t), z: r2(e.a.z + uz * t), ry: r3(e.face) });
      if (!leafy) continue;
      for (const dt of [-3.8, 3.8]) {
        const tt = t + dt;
        if (tt < SW + 1 || tt > len - SW - 1) continue;
        const x = e.a.x + ux * tt, z = e.a.z + uz * tt;
        const nx = e.face === Math.PI / 2 ? -0.25 : e.face === -Math.PI / 2 ? 0.25 : 0, nz = e.face === Math.PI ? 0.25 : e.face === 0 ? -0.25 : 0;
        const px = x + nx, pz = z + nz;
        const tall = Math.max(0.45, (rectGap(rect(px - 1, pz - 1, px + 1, pz + 1), lot) - 0.5) / 1.75) / 4.2;
        trees.push({ kind: "street", x: r2(px), z: r2(pz), y: LEVEL.walk, s: r2(Math.min(tall, 0.62 + R() * 0.2)), ry: r2(R() * 6.28), tone: r2(0.9 + R() * 0.15) });
      }
    }
  }
}
