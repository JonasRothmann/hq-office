// The land round the office as the engine's scenery, pure: the office's layout, a mode (nature, city or off) and a
// seed in; the garden on the lot (garden.js) and the valley or the town (gen.js) out, as pieces of the land pack
// (land/), height fields, ribbons and movers in the world's frame. The engine draws it round the lot and never walks,
// picks or lints it (docs/engine/rfc.md, section 12, step 6). The same input gives the same scenery.
//
// The generator works in the layout's frame with the old office's ground at y = -0.12; the world's lot is the layout
// moved by `o` (plan.js) with its ground at y = 0. `sink` moves everything as it goes in.
import { generate, growLot, seedOf, sampleGrid, LEVEL, WATER, ROAD, STOREY, TAG } from "./gen.js";
import { GABLE_H } from "./land/gable-end.js";
import { garden, frontDoor, REACH } from "./garden.js";
import { MARGIN } from "../plan.js";
import { PALETTE } from "./land/look/palette.js";

export const MODES = ["nature", "city", "off"];
// The lot's own ground in the garden's lawn, for a doc's `palette` while the land is shown: the garden band round the
// lot is drawn in the same token, so lot, garden and meadow read as one lawn.
export const LAWN = { light: { ground: PALETTE.light["ground-lawn"] }, dark: { ground: PALETTE.dark["ground-lawn"] } };
const DY = 0.12; // the generator's ground (y -0.12) to the world's (y 0)
const r3 = (v) => Math.round(v * 1000) / 1000;
const hex2 = (v) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, "0");
const grey = (k) => `#${hex2(k).repeat(3)}`;
const land = (token) => `land/${token}`;

// The land's lot round the office: REACH past the building, centred on the front door, so the land's path leaves
// from the middle of its front side. In the layout's frame.
export function lotOf(layout) {
  const b = layout.bounds, door = frontDoor(layout);
  const half = door === null ? null : Math.max(door - (b.minX - REACH), b.maxX + REACH - door);
  return {
    minX: half === null ? b.minX - REACH : door - half, minZ: b.minZ - REACH,
    maxX: half === null ? b.maxX + REACH : door + half, maxZ: b.maxZ + REACH, door: "s",
  };
}

// The generator's land for this layout, or null when the mode is off. prev: the last land, so an office that grows
// a room keeps the land round it (growLot).
export function landFor(layout, { mode = "nature", seed = "hq", prev = null } = {}) {
  if (mode === "off") return null;
  const m = mode === "city" ? "city" : "nature";
  const same = prev?.mode === m && prev?.seed === (typeof seed === "number" ? seed >>> 0 : seedOf(seed));
  return generate({ mode: m, seed, lot: growLot(lotOf(layout), same ? prev.lot : null) });
}

/**
 * The scenery round the office: the garden on the lot, and the land round it in `mode`. Null when the mode is off.
 * @param {{ bounds: { minX: number, minZ: number, maxX: number, maxZ: number }, walls: object[] }} layout  plan.js's layout
 * @param {{ mode?: "nature"|"city"|"off", seed?: string|number, land?: object }} [opts]  land: from landFor, to reuse
 */
export function outsideScenery(layout, opts = {}) {
  const mode = MODES.includes(opts.mode) ? opts.mode : "nature";
  if (mode === "off") return null;
  const L = opts.land ?? landFor(layout, { mode, seed: opts.seed ?? "hq" });
  const b = layout.bounds, o = { x: MARGIN - b.minX, z: MARGIN - b.minZ };
  const s = sink(o);
  const hole = s.box(L.lot);
  const lot = { minX: 0, minZ: 0, maxX: b.maxX - b.minX + 2 * MARGIN, maxZ: b.maxZ - b.minZ + 2 * MARGIN };
  // the garden's ground: the lot's own colour, from the lot's edge to the land's
  s.fields.push({
    xs: [hole.minX, 0, lot.maxX, hole.maxX], zs: [hole.minZ, 0, lot.maxZ, hole.maxZ],
    h: new Array(16).fill(0), color: "ground", hole: lot,
  });
  garden(s, layout, L.mode === "nature" ? L.path.entry : null);
  if (L.mode === "city") town(s, L); else nature(s, L);
  return {
    id: `outside:${L.mode}:${L.seed}`,
    pieces: s.pieces, fields: s.fields, strips: s.strips, movers: s.movers,
    fade: { box: hole, from: L.fade.from, to: L.fade.to },
    shade: hole, ground: true,
  };
}

// Where scenery goes in, moved into the world's frame on the way.
function sink(o) {
  const X = (x) => r3(x + o.x), Y = (y) => r3(y + DY), Z = (z) => r3(z + o.z);
  const s = {
    X, Y, Z, pieces: [], fields: [], strips: [], movers: [],
    box: (r) => ({ minX: X(r.minX), minZ: Z(r.minZ), maxX: X(r.maxX), maxZ: Z(r.maxZ) }),
    // a piece of the land pack at (x, y, z) in the generator's frame
    put(type, x, y, z, more = {}) {
      const p = { type: land(type), at: [X(x), Y(y), Z(z)] };
      if (more.ry) p.ry = r3(more.ry);
      if (more.s !== undefined && more.s !== 1) p.s = Array.isArray(more.s) ? more.s.map(r3) : r3(more.s);
      if (more.tint) p.tint = more.tint;
      if (more.params) p.params = more.params;
      if (more.shadow) p.shadow = true;
      s.pieces.push(p);
    },
    // a box from y0 to y1 over a rect (a slab of street, a kerb, a wall), as a tinted unit block
    slab(minX, minZ, maxX, maxZ, y0, y1, tint) {
      if (maxX - minX < 1e-3 || maxZ - minZ < 1e-3) return;
      s.put("block", (minX + maxX) / 2, y0, (minZ + maxZ) / 2, { s: [maxX - minX, y1 - y0, maxZ - minZ], tint });
    },
    // a flat patch whose top is at y (2 cm thick)
    quad(minX, minZ, maxX, maxZ, y, tint) { s.slab(minX, minZ, maxX, maxZ, y - 0.02, y, tint); },
    strip(points, color, finish) {
      if (points.length < 2) return;
      s.strips.push({ points: points.map(([x, y, z, h]) => [X(x), Y(y), Z(z), r3(h)]), color, ...(finish ? { finish } : {}) });
    },
    mover(type, route, speed, at, tint, params) {
      s.movers.push({ type: land(type), route: route.map(([x, y, z]) => [X(x), Y(y), Z(z)]), speed, at, ...(tint ? { tint } : {}), ...(params ? { params } : {}) });
    },
  };
  return s;
}

// ---- nature ---------------------------------------------------------------------------------------------------------

const GROUNDS = ["ground-lawn", "ground-grass", "ground-meadow", "ground-forest", "ground-bank", "ground-bed", "ground-dry"].map(land);
// Toward the key light, as the old office lit the valley: the sun's side of a hill a little lighter.
const SUN = (() => { const v = [-16, 24, 17], l = Math.hypot(...v); return v.map((a) => a / l); })();

function nature(s, L) {
  const t = L.terrain, nx = t.xs.length, nz = t.zs.length;
  const shadeAt = treeShade(L.trees);
  const H = (i, j) => t.h[Math.min(nz - 1, Math.max(0, j)) * nx + Math.min(nx - 1, Math.max(0, i))];
  const color = new Array(nx * nz), tone = new Array(nx * nz);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i;
    const gx = (H(i + 1, j) - H(i - 1, j)) / ((t.xs[Math.min(nx - 1, i + 1)] - t.xs[Math.max(0, i - 1)]) || 1);
    const gz = (H(i, j + 1) - H(i, j - 1)) / ((t.zs[Math.min(nz - 1, j + 1)] - t.zs[Math.max(0, j - 1)]) || 1);
    const nl = Math.hypot(gx, 1, gz), lit = (-gx * SUN[0] + SUN[1] - gz * SUN[2]) / nl - SUN[1];
    const slope = Math.max(0.8, Math.min(1.16, 1 + lit * 1.1));
    color[k] = GROUNDS[t.tag[k]] ?? GROUNDS[TAG.grass];
    tone[k] = r3((1 + t.tone[k] * 0.16) * slope * shadeAt(t.xs[i], t.zs[j]));
  }
  s.fields.push({ xs: t.xs.map(s.X), zs: t.zs.map(s.Z), h: t.h.map(s.Y), color, tone, hole: s.box(L.lot) });

  // the river, a little wider than its bed so the banks run under it, and the pond, at one level
  const y = L.water.level, R = L.water.river;
  s.strip(R.map((p) => [p.x, y, p.z, p.w + WATER.bank + 0.4]), land("water"), "glass");
  const pond = L.water.pond;
  if (pond) {
    // an ellipse as a ribbon along its long axis, as wide as the ellipse at each point
    const n = 12, c = Math.cos(pond.ry), sn = Math.sin(pond.ry), rx = pond.rx + WATER.bank, rz = pond.rz + WATER.bank;
    const pts = [];
    for (let k = 0; k <= n; k++) {
      const u = -rx + (2 * rx * k) / n, half = Math.max(0.05, rz * Math.sqrt(Math.max(0, 1 - (u / rx) ** 2)));
      pts.push([pond.x + u * c, y, pond.z - u * sn, half]);
    }
    s.strip(pts, land("water"), "glass");
  }

  // the path, in runs between the gaps the bridge spans, a little wider and narrower by turns
  const P = L.path.points, hw = L.path.width / 2;
  let run = [];
  for (let i = 0; i < P.length; i++) {
    if (i > 0 && Math.hypot(P[i].x - P[i - 1].x, P[i].z - P[i - 1].z) > 2.5) { s.strip(run, land("path")); run = []; }
    run.push([P[i].x, sampleGrid(t, P[i].x, P[i].z) + 0.05, P[i].z, hw * (0.9 + 0.2 * Math.sin(i * 1.7))]);
  }
  s.strip(run, land("path"));
  const br = L.bridge;
  if (br) s.put("bridge", br.x, -DY, br.z, { ry: br.ry, params: { length: r3(br.length), width: r3(br.width), y0: r3(br.y0 + DY), y1: r3(br.y1 + DY), rise: r3(br.rise + DY) } });

  for (const x of L.trees) s.put(`tree-${x.kind === "street" ? "round" : x.kind}`, x.x, x.y, x.z, { ry: x.ry, s: x.s, tint: grey(x.tone) });
  for (const x of L.rocks) s.put("rock", x.x, x.y, x.z, { ry: x.ry, s: x.s, tint: grey(x.tone) });
  for (const x of L.flowers) s.put("flower", x.x, x.y, x.z, { ry: x.ry ?? 0, tint: land(`flower-${x.c % 5}`) });
  for (const x of L.tufts ?? []) s.put("tuft", x.x, x.y, x.z, { ry: x.ry, s: x.s });
  for (const x of L.reeds) s.put("reed", x.x, x.y, x.z, { ry: x.ry, s: x.s });
}

// How much the trees darken the ground under them: a soft patch per tree, a little away from the sun.
function treeShade(trees) {
  const cell = 4, grid = new Map(), key = (i, j) => i * 100003 + j;
  for (const t of trees) {
    const k = key(Math.floor(t.x / cell), Math.floor(t.z / cell));
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k).push(t);
  }
  return (x, z) => {
    let dark = 0;
    const i0 = Math.floor(x / cell), j0 = Math.floor(z / cell);
    for (let i = i0 - 1; i <= i0 + 1; i++) for (let j = j0 - 1; j <= j0 + 1; j++) for (const t of grid.get(key(i, j)) ?? []) {
      const r = (t.kind === "shrub" ? 1.0 : 2.0) * t.s + 0.6;
      const d = Math.hypot(x - (t.x + 0.7 * t.s), z - (t.z - 0.55 * t.s));
      if (d < r) dark += (1 - d / r) * 0.9;
    }
    return 1 - 0.26 * Math.min(1, dark);
  };
}

// ---- the town ------------------------------------------------------------------------------------------------------

const shrink = (r, k) => ({ minX: r.minX + k, minZ: r.minZ + k, maxX: r.maxX - k, maxZ: r.maxZ - k });
const union = (...rs) => ({ minX: Math.min(...rs.map((r) => r.minX)), minZ: Math.min(...rs.map((r) => r.minZ)), maxX: Math.max(...rs.map((r) => r.maxX)), maxZ: Math.max(...rs.map((r) => r.maxZ)) });
function hash(a, b) {
  let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
// Some streets are laid in setts, the rest asphalt; the same street keeps its surface from junction to junction.
export const isSetts = (r) => hash(r.line * 3 + (r.dir === "x" ? 1 : 0), 17) < 0.35;
const YARD = { yard: "yard", grass: "city-grass", gravel: "gravel" };

function town(s, L) {
  const { road, bike: bikeY, walk, quay, canal: waterY } = LEVEL;
  const BK = ROAD.bike, T = (k) => land(k);
  const cn = L.canal, rowCanal = cn.side === "n" || cn.side === "s";

  // the ground: blocks of street, kerb and pavement
  const ring = (o, i, y0, y1, tint) => {
    s.slab(o.minX, o.minZ, o.maxX, i.minZ, y0, y1, tint); s.slab(o.minX, i.maxZ, o.maxX, o.maxZ, y0, y1, tint);
    s.slab(o.minX, i.minZ, i.minX, i.maxZ, y0, y1, tint); s.slab(i.maxX, i.minZ, o.maxX, i.maxZ, y0, y1, tint);
  };
  const edges = (r, y, w, tint) => {
    s.quad(r.minX, r.minZ, r.maxX, r.minZ + w, y, tint); s.quad(r.minX, r.maxZ - w, r.maxX, r.maxZ, y, tint);
    s.quad(r.minX, r.minZ + w, r.minX + w, r.maxZ - w, y, tint); s.quad(r.maxX - w, r.minZ + w, r.maxX, r.maxZ - w, y, tint);
  };
  for (const b of L.blocks) {
    const o = b.outer, k = shrink(o, BK), i = b.inner, yw = walk + 0.002;
    if (b.kind === "far") { s.quad(o.minX, o.minZ, o.maxX, o.maxZ, walk, T("yard")); continue; }
    // the bike track a kerb above the road, the pavement a kerb above the track: granite kerbs on both edges
    ring(o, k, road - 0.02, bikeY, T("bike-track"));
    ring(k, i, bikeY - 0.02, walk, T("kerb"));
    edges(o, bikeY + 0.003, 0.14, T("kerb"));
    s.quad(k.minX + 0.16, k.minZ + 0.16, k.maxX - 0.16, i.minZ, yw, T("walk")); s.quad(k.minX + 0.16, i.maxZ, k.maxX - 0.16, k.maxZ - 0.16, yw, T("walk"));
    s.quad(k.minX + 0.16, i.minZ, i.minX, i.maxZ, yw, T("walk")); s.quad(i.maxX, i.minZ, k.maxX - 0.16, i.maxZ, yw, T("walk"));
    if (b.kind === "built") s.quad(i.minX, i.minZ, i.maxX, i.maxZ, yw, T(YARD[b.ground] ?? "yard"));
    if (b.kind === "square") s.quad(i.minX, i.minZ, i.maxX, i.maxZ, yw, T("setts"));
    if (b.kind === "park") {
      const cx = (i.minX + i.maxX) / 2, cz = (i.minZ + i.maxZ) / 2;
      s.quad(i.minX, i.minZ, i.maxX, i.maxZ, yw, T("city-grass"));
      s.quad(cx - 1.1, i.minZ, cx + 1.1, i.maxZ, yw + 0.003, T("gravel"));
      s.quad(i.minX, cz - 1.1, cx - 1.1, cz + 1.1, yw + 0.003, T("gravel")); s.quad(cx + 1.1, cz - 1.1, i.maxX, cz + 1.1, yw + 0.003, T("gravel"));
    }
  }
  // the canal block: an embankment (the quays, the canal row and its yard) either side of the water
  {
    const near = cn.quays[0], far = union(cn.quays[1], cn.row, cn.back), yq = quay + 0.003;
    for (const r of [near, far]) s.slab(r.minX, r.minZ, r.maxX, r.maxZ, road - 0.01, quay, T("quay-wall"));
    for (const r of [near, cn.quays[1]]) s.quad(r.minX, r.minZ, r.maxX, r.maxZ, yq, T("quay"));
    s.quad(cn.row.minX, cn.row.minZ, cn.row.maxX, cn.row.maxZ, yq, T("yard"));
    s.quad(cn.back.minX, cn.back.minZ, cn.back.maxX, cn.back.maxZ, yq, T("city-grass"));
    edges(near, yq + 0.003, 0.28, T("quay-edge"));
    edges(cn.quays[1], yq + 0.003, 0.28, T("quay-edge"));
  }
  // roads and junctions; markings: centre dashes on asphalt, stop lines behind the zebras, the bike track carried over
  // each junction arm in blue
  for (const r of L.roads) s.quad(r.minX, r.minZ, r.maxX, r.maxZ, road, T(isSetts(r) ? "setts" : "road"));
  for (const r of L.junctions) s.quad(r.minX, r.minZ, r.maxX, r.maxZ, road, T("road"));
  const ym = road + 0.004, back = BK + ROAD.walk;
  for (const r of L.roads) {
    const z = r.dir === "z";
    const a = (z ? r.minZ : r.minX) + back + 0.8, b = (z ? r.maxZ : r.maxX) - back - 0.8, c = z ? (r.minX + r.maxX) / 2 : (r.minZ + r.maxZ) / 2;
    if (!isSetts(r)) for (let u = a; u + 1.5 <= b; u += 3) z ? s.quad(c - 0.07, u, c + 0.07, u + 1.5, ym, T("mark")) : s.quad(u, c - 0.07, u + 1.5, c + 0.07, ym, T("mark"));
    if (z) { s.quad(c, a - 0.6, c + 2.8, a - 0.35, ym, T("mark")); s.quad(c - 2.8, b + 0.35, c, b + 0.6, ym, T("mark")); }
    else { s.quad(a - 0.6, c - 2.8, a - 0.35, c, ym, T("mark")); s.quad(b + 0.35, c, b + 0.6, c + 2.8, ym, T("mark")); }
  }
  for (const c of L.bikeCrossings) s.quad(c.minX, c.minZ, c.maxX, c.maxZ, ym, T("bike-blue"));
  for (const c of L.crossings) {
    const across = c.dir === "x", len = across ? c.maxX - c.minX : c.maxZ - c.minZ;
    for (let u = 0.35; u + 0.45 <= len - 0.2; u += 0.9) {
      if (across) s.quad(c.minX + u, c.minZ + 0.2, c.minX + u + 0.45, c.maxZ - 0.2, ym, T("mark"));
      else s.quad(c.minX + 0.2, c.minZ + u, c.maxX - 0.2, c.minZ + u + 0.45, ym, T("mark"));
    }
  }
  for (const tr of L.trees) if (tr.kind === "street") s.quad(tr.x - 0.45, tr.z - 0.45, tr.x + 0.45, tr.z + 0.45, walk + 0.005, T("pit"));

  // the canal: a ribbon of water a little wider than the channel, so the embankment walls stand in it
  {
    const r = cn.water, pad = 0.3;
    if (rowCanal) s.strip([[r.minX, waterY, (r.minZ + r.maxZ) / 2, (r.maxZ - r.minZ) / 2 + pad], [r.maxX, waterY, (r.minZ + r.maxZ) / 2, (r.maxZ - r.minZ) / 2 + pad]], T("city-water"), "glass");
    else s.strip([[(r.minX + r.maxX) / 2, waterY, r.minZ, (r.maxX - r.minX) / 2 + pad], [(r.minX + r.maxX) / 2, waterY, r.maxZ, (r.maxX - r.minX) / 2 + pad]], T("city-water"), "glass");
  }
  // footbridges over it, quay to quay
  for (const br of cn.bridges) {
    const across = br.along === "z", L0 = across ? br.maxZ - br.minZ : br.maxX - br.minX, w = across ? br.maxX - br.minX : br.maxZ - br.minZ;
    const mid = across ? (br.minZ + br.maxZ) / 2 : (br.minX + br.maxX) / 2;
    s.put("bridge", across ? br.u : mid, -DY, across ? mid : br.u, { ry: across ? 0 : Math.PI / 2, params: { length: r3(L0), width: r3(w), y0: r3(quay + DY), y1: r3(quay + DY), rise: r3(quay + DY + 0.55) } });
  }

  // houses: walls, plinths, roofs, stepped gables, spires, and their fronts
  const roofOf = (b) => T(`roof-${b.roofTint % 5}`), wallOf = (b) => T(`wall-${b.wall % 12}`);
  for (const b of L.buildings) {
    s.put("block", b.x, b.y, b.z, { s: [b.w, b.h, b.d], tint: wallOf(b) });
    if (b.style !== "gablet") s.put("block", b.x, b.y, b.z, { s: [b.w + 0.05, 0.55, b.d + 0.05], tint: T("base") });
    const ry = b.ridge === "x" ? 0 : Math.PI / 2, len = b.ridge === "x" ? b.w : b.d, deep = b.ridge === "x" ? b.d : b.w, top = b.y + b.h;
    if (b.roof === "gable") {
      const o = b.steps ? 0.04 : 0.3;
      s.put("roof-gable", b.x, top, b.z, { ry, s: [len + o, b.roofH, deep + o], tint: roofOf(b) });
      if (!b.steps) s.put("gable-end", b.x, top, b.z, { ry, s: [len - 0.02, b.roofH / GABLE_H, deep - 0.02], tint: wallOf(b) });
      else {
        // stepped gables at the ends of the ridge (a wall dormer's only at the street)
        const ends = b.ridge === "x" ? [["e", b.x + b.w / 2 - 0.12, b.z], ["w", b.x - b.w / 2 + 0.12, b.z]] : [["s", b.x, b.z + b.d / 2 - 0.12], ["n", b.x, b.z - b.d / 2 + 0.12]];
        for (const [side, x, z] of ends) if (b.style !== "gablet" || side === b.front) s.put("roof-step", x, top, z, { ry: b.ridge === "x" ? Math.PI / 2 : 0, s: [deep + 0.06, b.roofH, 1], tint: wallOf(b) });
      }
    }
    if (b.roof === "hip") s.put("roof-hip", b.x, top, b.z, { ry, s: [len + 0.4, b.roofH, deep + 0.4], tint: roofOf(b) });
    if (b.roof === "flat") s.put("block", b.x, top, b.z, { s: [b.w + 0.2, 0.3, b.d + 0.2], tint: T("flat-roof") });
    facade(s, b);
  }
  for (const x of L.spires) s.put("spire", x.x, x.y, x.z, { s: [x.w * 0.95, x.h, x.w * 0.95], tint: T("roof-4") });

  // lamps on their wires, and on posts along the quays
  for (const sp of L.spans) {
    const mx = (sp.x0 + sp.x1) / 2, mz = (sp.z0 + sp.z1) / 2, dip = sp.y - 0.35;
    s.strip([[sp.x0, sp.y, sp.z0, 0.02], [mx, dip, mz, 0.02], [sp.x1, sp.y, sp.z1, 0.02]], T("wire"));
    s.put("lamp-hanging", mx, dip, mz);
    s.put("light-pool", mx, walk + 0.012, mz, { s: [6.5, 1, 6.5] });
    for (const [x, z, mast] of [[sp.x0, sp.z0, sp.mast0], [sp.x1, sp.z1, sp.mast1]]) if (mast) s.put("block", x, walk, z, { s: [0.09, sp.y + 0.15 - walk, 0.09], tint: T("wire") });
  }
  for (const p of L.props) {
    if (p.kind === "post") {
      s.put("lamp-post", p.x, p.y, p.z, { ry: p.ry });
      s.put("light-pool", p.x + Math.sin(p.ry) * 1.0, p.y + 0.012, p.z + Math.cos(p.ry) * 1.0, { s: [5, 1, 5] });
    } else if (p.kind === "table") s.put("cafe-table", p.x, p.y, p.z, { ry: p.ry, tint: T(`awning-${p.c % 5}`) });
    else s.put(p.kind, p.x, p.y, p.z, { ry: p.ry });
  }
  for (const x of L.trees) s.put(`tree-${x.kind === "street" ? "round" : x.kind}`, x.x, x.y, x.z, { ry: x.ry, s: x.s, tint: grey(x.tone) });
  for (const r of L.racks) s.put(r.cargo ? "cargo-bike" : "bike", r.x, walk, r.z, { ry: r.ry, tint: T(`bike-${r.paint % 7}`) });
  for (const x of L.boats) s.put(`boat-${x.kind}`, x.x, waterY, x.z, { ry: x.ry, tint: T(`boat-${x.paint % 6}`) });

  // the movers: cars on the road, walkers and riders stepping up and down with the ground
  for (const c of L.cars) {
    const route = c.path.map((p) => [p.x, road, p.z]);
    s.mover(c.kind, route, c.speed, [c.offset], c.kind === "bus" ? T("bus") : T(`car-${c.paint % 9}`));
    s.mover("car-lights", route, c.speed, [c.offset], null);
  }
  const groundOf = ground(L);
  for (const p of L.people) {
    const route = groundOf(p.path);
    s.mover("walker", route, p.speed, [p.offset], T(`shirt-${p.shirt % 10}`));
    s.mover("walker-legs", route, p.speed, [p.offset], T(`pants-${p.pants % 6}`));
    s.mover("head", route, p.speed, [p.offset], T(`skin-${p.skin % 6}`));
  }
  for (const c of L.cyclists) {
    const route = groundOf(c.path);
    s.mover(c.cargo ? "cargo-bike" : "bike", route, c.speed, [c.offset], T(`bike-${c.paint % 7}`));
    s.mover("rider", route, c.speed, [c.offset], T(`shirt-${c.shirt % 10}`));
    s.mover("head", route, c.speed, [c.offset], T(`skin-${c.skin % 6}`), { y: 1.5 });
  }
}

// Windows, doors, shop fronts, awnings, dormers and chimneys for one house. Panes are glass by day and lit by night
// through their tokens (pane-a and pane-b lit, pane-dark not).
function facade(s, b) {
  let seed = b.seed >>> 0;
  const R = () => { seed = (Math.imul(seed ^ (seed >>> 15), 2246822519) + 0x9e3779b9) >>> 0; return seed / 4294967296; };
  const lit = (k) => land(k < 0.5 ? "pane-a" : k < 0.62 ? "pane-b" : "pane-dark");
  // a pane centred at (x, y, z), w by h, facing ry, with its frame behind
  const pane = (x, y, z, ry, w, h, tint) => {
    s.put("pane", x, y - h / 2, z, { ry, s: [w, h, 1], tint });
    s.put("frame", x, y - h / 2, z, { ry, s: [w, h, 1] });
  };
  const thing = (x, y, z, ry, w, h, d, tint) => s.put("block", x, y, z, { ry, s: [w, h, d], tint });
  const all = {
    n: { L: b.w, x: (u) => b.x + u, z: () => b.z - b.d / 2 - 0.03, ry: Math.PI, ox: 0, oz: -1 },
    s: { L: b.w, x: (u) => b.x - u, z: () => b.z + b.d / 2 + 0.03, ry: 0, ox: 0, oz: 1 },
    e: { L: b.d, x: () => b.x + b.w / 2 + 0.03, z: (u) => b.z + u, ry: Math.PI / 2, ox: 1, oz: 0 },
    w: { L: b.d, x: () => b.x - b.w / 2 - 0.03, z: (u) => b.z - u, ry: -Math.PI / 2, ox: -1, oz: 0 },
  };
  const back = { n: "s", s: "n", e: "w", w: "e" }[b.front];
  const names = b.style === "tower" ? ["n", "s", "e", "w"] : b.style === "gablet" ? [b.front] : [b.front, back, ...b.ends];
  for (const nm of names) {
    const f = all[nm], front = nm === b.front;
    if (b.style === "gablet") {
      pane(f.x(0), b.y + b.h - 1.2, f.z(0), f.ry, 0.85, 1.3, lit(R()));
      if (b.roofH > 1.4) pane(f.x(0), b.y + b.h + b.roofH * 0.3, f.z(0), f.ry, 0.5, 0.55, lit(R()));
      continue;
    }
    if (b.style === "tower") {
      for (const fl of [b.floors - 1, b.floors]) pane(f.x(0), b.y + fl * STOREY - 1.0, f.z(0), f.ry, 0.6, 1.3, lit(R()));
      continue;
    }
    const n = Math.max(1, Math.floor((f.L - 0.4) / 1.7));
    for (let fl = 0; fl < b.floors; fl++) {
      const y0 = b.y + fl * STOREY;
      for (let k = 0; k < n; k++) {
        const u = -f.L / 2 + (f.L * (k + 0.5)) / n, px = f.x(u), pz = f.z(u);
        if (fl === 0 && front) {
          if (k === Math.floor(n / 2)) pane(px, y0 + 1.15, pz, f.ry, 0.95, 2.0, b.shop ? land("pane-b") : land("door"));
          else if (b.shop) pane(px, y0 + 1.25, pz, f.ry, f.L / n - 0.28, 1.85, land("pane-b"));
          else pane(px, y0 + 1.7, pz, f.ry, 0.8, 1.3, lit(R()));
          continue;
        }
        pane(px, y0 + 1.62, pz, f.ry, 0.8, 1.45, lit(R()));
      }
    }
    // windows up in a gable end
    const gableEnd = b.roof === "gable" && ((b.ridge === "x" && (nm === "e" || nm === "w")) || (b.ridge === "z" && (nm === "n" || nm === "s")));
    if (gableEnd && b.roofH > 1.6) {
      const y = b.y + b.h + b.roofH * 0.2;
      for (const u of f.L > 4.4 ? [-f.L * 0.17, f.L * 0.17] : [0]) pane(f.x(u), y + 0.4, f.z(u), f.ry, 0.62, 0.95, lit(R()));
      if (b.roofH > 3.4) pane(f.x(0), b.y + b.h + b.roofH * 0.58, f.z(0), f.ry, 0.5, 0.6, lit(R()));
    }
    if (front && b.shop) {
      if (b.awning !== null) s.put("awning", f.x(0), b.y + 2.05, f.z(0), { ry: f.ry, s: [Math.min(f.L - 0.5, 6.5), 1, 1], tint: land(`awning-${b.awning % 5}`) });
      else thing(f.x(0) + f.ox * 0.06, b.y + 2.45, f.z(0) + f.oz * 0.06, f.ry, Math.min(2.6, f.L * 0.5), 0.42, 0.08, land(`awning-${b.seed % 5}`));
    }
  }
  // dormers on the street slope of a gable along the street, each with its window and a cap in the roof's colour
  const roof = land(`roof-${b.roofTint % 5}`);
  if (b.dormers) {
    const f = all[b.front], deep = b.front === "n" || b.front === "s" ? b.d : b.w;
    const inset = 0.75, hs = (b.roofH * inset) / (deep / 2);
    const n = Math.max(1, Math.floor(f.L / 3));
    for (let k = 0; k < n; k++) {
      const u = -f.L / 2 + (f.L * (k + 0.5)) / n, fx = f.x(u) - f.ox * inset, fz = f.z(u) - f.oz * inset;
      const y = b.y + b.h + hs - 0.3;
      thing(fx - f.ox * 0.6, y, fz - f.oz * 0.6, f.ry, 1.0, 1.05, 1.2, land(`wall-${b.wall % 12}`));
      thing(fx - f.ox * 0.55, y + 1.05, fz - f.oz * 0.55, f.ry, 1.2, 0.12, 1.4, roof);
      pane(fx + f.ox * 0.01, y + 0.6, fz + f.oz * 0.01, f.ry, 0.62, 0.62, lit(R()));
    }
  }
  // a chimney or two on the ridge
  if ((b.roof === "gable" || b.roof === "hip") && b.style !== "gablet" && b.style !== "civic" && R() < 0.65) {
    const along = b.ridge === "x", L = along ? b.w : b.d;
    for (const t of R() < 0.5 ? [-0.3] : [-0.32, 0.3]) {
      const x = along ? b.x + L * t : b.x, z = along ? b.z : b.z + L * t;
      thing(x, b.y + b.h + b.roofH * 0.55, z, 0, 0.55, b.roofH * 0.45 + 0.75, 0.55, land("roof-2"));
    }
  }
  if (b.roof === "flat") thing(b.x + (R() - 0.5) * (b.w - 2), b.y + b.h + 0.3, b.z + (R() - 0.5) * (b.d - 2), 0, 1.0, 0.6, 0.7, land("lamp-head"));
}

// The ground under a loop, as the route a walker or rider follows: the loop's points, plus a point wherever the
// ground steps up or down (road, bike track, pavement, quay, the arch of a footbridge), sampled every STEP metres.
const STEP = 0.5;
function ground(L) {
  const cn = L.canal;
  const bridge = rectIndex(cn.bridges), raised = rectIndex([...cn.quays, cn.row, cn.back]);
  const carriage = rectIndex([...L.roads, ...L.junctions, ...L.crossings, ...L.bikeCrossings]), track = rectIndex(L.bikes);
  const yAt = (x, z) => {
    const br = bridge(x, z);
    if (br) { const t = br.along === "z" ? (z - br.minZ) / (br.maxZ - br.minZ) : (x - br.minX) / (br.maxX - br.minX); return LEVEL.quay + 0.02 + 0.55 * Math.sin(Math.PI * t); }
    if (raised(x, z)) return LEVEL.quay;
    if (carriage(x, z)) return LEVEL.road;
    return track(x, z) ? LEVEL.bike : LEVEL.walk;
  };
  return (path) => {
    const out = [];
    for (let i = 0; i < path.length; i++) {
      const a = path[i], b = path[(i + 1) % path.length], len = Math.hypot(b.x - a.x, b.z - a.z), n = Math.max(1, Math.ceil(len / STEP));
      let last = [a.x, yAt(a.x, a.z), a.z], kept = true;
      out.push(last);
      for (let k = 1; k < n; k++) {
        const x = a.x + ((b.x - a.x) * k) / n, z = a.z + ((b.z - a.z) * k) / n, cur = [x, yAt(x, z), z];
        // a step: the sample before it at the old height, the sample after it at the new
        if (Math.abs(cur[1] - last[1]) > 1e-3 || bridge(x, z)) {
          if (!kept) out.push(last);
          out.push(cur);
          kept = true;
        } else kept = false;
        last = cur;
      }
    }
    return out;
  };
}

// Rects bucketed by 8 m cells, for "which of these is (x, z) in".
function rectIndex(rects) {
  const cell = 8, grid = new Map(), key = (i, j) => i * 100003 + j;
  rects.forEach((r) => {
    for (let i = Math.floor(r.minX / cell); i <= Math.floor(r.maxX / cell); i++) for (let j = Math.floor(r.minZ / cell); j <= Math.floor(r.maxZ / cell); j++) {
      const k = key(i, j);
      if (!grid.has(k)) grid.set(k, []);
      grid.get(k).push(r);
    }
  });
  return (x, z) => (grid.get(key(Math.floor(x / cell), Math.floor(z / cell))) ?? []).find((r) => x > r.minX && x < r.maxX && z > r.minZ && z < r.maxZ);
}
