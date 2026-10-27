// The town (city.js) to three.js: the streets, quays, bridges and street things as one vertex-coloured mesh with setts
// and slabs drawn by the "ground" material, the canal as moving water, the houses as InstancedMeshes (walls, roofs,
// stepped gables, windows, awnings, dormers), lamps hung on wires, trees, and the movers (movers.js).
import { THREE, Parts, instanced, color, at, poolTexture } from "./parts.js";
import { awning, gableEnds, gableSlopes, hangingLamp, hipRoof, spire, stepGable, tree, unitBox, windowPane } from "./models.js";
import { LEVEL, ROAD, STOREY } from "../../office/outside/gen.js";
import { Movers } from "./movers.js";

const tint = new THREE.Color();
const T = (hex, k = 1) => tint.set(hex).multiplyScalar(k);
const grey = (k) => tint.setRGB(k, k, k);
const shrink = (r, k) => ({ minX: r.minX + k, minZ: r.minZ + k, maxX: r.maxX - k, maxZ: r.maxZ - k });
const union = (...rs) => ({ minX: Math.min(...rs.map((r) => r.minX)), minZ: Math.min(...rs.map((r) => r.minZ)), maxX: Math.max(...rs.map((r) => r.maxX)), maxZ: Math.max(...rs.map((r) => r.maxZ)) });
function hash(a, b) {
  let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
// Some streets are laid in setts, the rest asphalt; the same street keeps its surface from junction to junction.
export const isSetts = (r) => hash(r.line * 3 + (r.dir === "x" ? 1 : 0), 17) < 0.35;

export function buildCity({ P, U, mat, add, layout }) {
  const C = P.city, G = P.glow, night = P.night;
  const { road, bike: bikeY, walk, quay, canal: waterY } = LEVEL;
  const BK = ROAD.bike;
  U.uSheen.value.set(C.sheen);
  const cn = layout.canal, rowCanal = cn.side === "n" || cn.side === "s";

  // ---- the ground: one mesh ----
  const s = new Parts();
  s.pave = [];
  const ring = (o, i, y0, y1, hex) => {
    for (const r of [[o.minX, o.minZ, o.maxX, i.minZ], [o.minX, i.maxZ, o.maxX, o.maxZ], [o.minX, i.minZ, i.minX, i.maxZ], [i.maxX, i.minZ, o.maxX, i.maxZ]]) {
      if (r[2] - r[0] > 1e-3 && r[3] - r[1] > 1e-3) s.box(r[2] - r[0], y1 - y0, r[3] - r[1], hex, (r[0] + r[2]) / 2, y0, (r[1] + r[3]) / 2);
    }
  };
  const edges = (r, y, w, hex) => {
    s.quad(r.minX, r.minZ, r.maxX, r.minZ + w, y, hex); s.quad(r.minX, r.maxZ - w, r.maxX, r.maxZ, y, hex);
    s.quad(r.minX, r.minZ, r.minX + w, r.maxZ, y, hex); s.quad(r.maxX - w, r.minZ, r.maxX, r.maxZ, y, hex);
  };
  for (const b of layout.blocks) {
    const o = b.outer, k = shrink(o, BK), i = b.inner, yw = walk + 0.002;
    if (b.kind === "far") { s.quad(o.minX, o.minZ, o.maxX, o.maxZ, walk, C.ground.yard); continue; }
    // the bike track a kerb above the road, the pavement a kerb above the track: granite kerbs on both edges
    ring(o, k, road - 0.005, bikeY, C.bike);
    ring(k, i, bikeY - 0.005, walk, C.kerb);
    edges(o, bikeY + 0.003, 0.14, C.kerb);
    edges(k, walk + 0.004, 0.16, C.kerb);
    s.quad(k.minX + 0.16, k.minZ + 0.16, k.maxX - 0.16, i.minZ, yw, C.walk, 3); s.quad(k.minX + 0.16, i.maxZ, k.maxX - 0.16, k.maxZ - 0.16, yw, C.walk, 3);
    s.quad(k.minX + 0.16, i.minZ, i.minX, i.maxZ, yw, C.walk, 4); s.quad(i.maxX, i.minZ, k.maxX - 0.16, i.maxZ, yw, C.walk, 4);
    if (b.kind === "built") s.quad(i.minX, i.minZ, i.maxX, i.maxZ, yw, C.ground[b.ground]);
    if (b.kind === "square") s.quad(i.minX, i.minZ, i.maxX, i.maxZ, yw, C.setts, 1);
    if (b.kind === "park") {
      const cx = (i.minX + i.maxX) / 2, cz = (i.minZ + i.maxZ) / 2;
      s.quad(i.minX, i.minZ, i.maxX, i.maxZ, yw, C.ground.grass);
      s.quad(cx - 1.1, i.minZ, cx + 1.1, i.maxZ, yw + 0.002, C.ground.gravel); s.quad(i.minX, cz - 1.1, i.maxX, cz + 1.1, yw + 0.002, C.ground.gravel);
    }
  }
  // the canal block: an embankment (the quays, the canal row and its yard) either side of the water
  {
    const near = cn.quays[0], far = union(cn.quays[1], cn.row, cn.back);
    for (const r of [near, far]) s.box(r.maxX - r.minX, quay - road + 0.01, r.maxZ - r.minZ, C.quayWall, (r.minX + r.maxX) / 2, road - 0.01, (r.minZ + r.maxZ) / 2);
    const along = rowCanal ? 1 : 2, yq = quay + 0.003;
    s.quad(near.minX, near.minZ, near.maxX, near.maxZ, yq, C.quay, along);
    s.quad(cn.quays[1].minX, cn.quays[1].minZ, cn.quays[1].maxX, cn.quays[1].maxZ, yq, C.quay, along);
    s.quad(cn.row.minX, cn.row.minZ, cn.row.maxX, cn.row.maxZ, yq, C.ground.yard);
    s.quad(cn.back.minX, cn.back.minZ, cn.back.maxX, cn.back.maxZ, yq, C.ground.grass);
    edges(near, yq + 0.002, 0.28, C.quayEdge);
    edges(cn.quays[1], yq + 0.002, 0.28, C.quayEdge);
  }
  // roads, junctions, markings: centre dashes on asphalt, car stop lines pulled back behind the zebra, the bike track
  // carried over each junction arm in blue
  for (const r of layout.roads) s.quad(r.minX, r.minZ, r.maxX, r.maxZ, road, isSetts(r) ? C.setts : C.road, isSetts(r) ? (r.dir === "x" ? 1 : 2) : 0);
  for (const r of layout.junctions) s.quad(r.minX, r.minZ, r.maxX, r.maxZ, road, C.road);
  const ym = road + 0.004, back = BK + ROAD.walk;
  for (const r of layout.roads) {
    const z = r.dir === "z";
    const a = (z ? r.minZ : r.minX) + back + 0.8, b = (z ? r.maxZ : r.maxX) - back - 0.8, c = z ? (r.minX + r.maxX) / 2 : (r.minZ + r.maxZ) / 2;
    if (!isSetts(r)) for (let u = a; u + 1.5 <= b; u += 3) z ? s.quad(c - 0.07, u, c + 0.07, u + 1.5, ym, C.mark) : s.quad(u, c - 0.07, u + 1.5, c + 0.07, ym, C.mark);
    if (z) { s.quad(c, a - 0.6, c + 2.8, a - 0.35, ym, C.mark); s.quad(c - 2.8, b + 0.35, c, b + 0.6, ym, C.mark); }
    else { s.quad(a - 0.6, c - 2.8, a - 0.35, c, ym, C.mark); s.quad(b + 0.35, c, b + 0.6, c + 2.8, ym, C.mark); }
  }
  for (const c of layout.bikeCrossings) s.quad(c.minX, c.minZ, c.maxX, c.maxZ, ym, C.blue);
  for (const c of layout.crossings) {
    const across = c.dir === "x", len = across ? c.maxX - c.minX : c.maxZ - c.minZ;
    for (let u = 0.35; u + 0.45 <= len - 0.2; u += 0.9) {
      if (across) s.quad(c.minX + u, c.minZ + 0.2, c.minX + u + 0.45, c.maxZ - 0.2, ym, C.mark);
      else s.quad(c.minX + 0.2, c.minZ + u, c.maxX - 0.2, c.minZ + u + 0.45, ym, C.mark);
    }
  }
  for (const tr of layout.trees) if (tr.kind === "street") s.quad(tr.x - 0.45, tr.z - 0.45, tr.x + 0.45, tr.z + 0.45, walk + 0.005, C.pit);
  for (const br of cn.bridges) footbridge(s, br, C);
  for (const p of layout.props) prop(s, p, C);
  for (const sp of layout.spans) {
    const mx = (sp.x0 + sp.x1) / 2, mz = (sp.z0 + sp.z1) / 2, dip = sp.y - 0.35;
    s.rod(sp.x0, sp.y, sp.z0, mx, dip, mz, 0.035, C.wire);
    s.rod(mx, dip, mz, sp.x1, sp.y, sp.z1, 0.035, C.wire);
    if (sp.mast0) s.cyl(0.045, sp.y + 0.15 - walk, C.wire, sp.x0, walk, sp.z0, 5);
    if (sp.mast1) s.cyl(0.045, sp.y + 0.15 - walk, C.wire, sp.x1, walk, sp.z1, 5);
  }
  {
    const m = new THREE.Mesh(s.geometry(), mat("ground"));
    m.name = "streets";
    m.receiveShadow = true;
    add(m);
  }

  // ---- the canal: a ribbon of water, a little wider than the channel so the embankment walls stand in it ----
  {
    const w = new Parts();
    w.flow = [];
    const r = cn.water, pad = 0.3;
    const u0 = rowCanal ? r.minX : r.minZ, u1 = rowCanal ? r.maxX : r.maxZ;
    const a0 = (rowCanal ? r.minZ : r.minX) - pad, a1 = (rowCanal ? r.maxZ : r.maxX) + pad;
    const P3 = (u, a) => (rowCanal ? [u, waterY, a] : [a, waterY, u]);
    for (let u = u0; u < u1 - 1e-6; u += 3) {
      const v = Math.min(u1, u + 3);
      const A = P3(u, a0), B = P3(u, a1), Cc = P3(v, a0), D = P3(v, a1);
      const up = (B[0] - A[0]) * (D[2] - A[2]) - (B[2] - A[2]) * (D[0] - A[0]) < 0;
      const tri = (p, q, t, fp, fq, ft) => { w.pos.push(...p, ...q, ...t); w.flow.push(...fp, ...fq, ...ft); };
      if (up) { tri(A, B, D, [u, -1], [u, 1], [v, 1]); tri(A, D, Cc, [u, -1], [v, 1], [v, -1]); }
      else { tri(A, D, B, [u, -1], [v, 1], [u, 1]); tri(A, Cc, D, [u, -1], [v, -1], [v, 1]); }
    }
    const c = color(C.water);
    for (let k = 0; k < w.pos.length / 3; k++) w.col.push(c.r, c.g, c.b);
    const mesh = new THREE.Mesh(w.geometry(), mat("water"));
    mesh.name = "water";
    mesh.renderOrder = 1;
    add(mesh);
  }

  // ---- houses ----
  const B = layout.buildings;
  const wallOf = (b) => C.walls[b.wall % C.walls.length];
  add(instanced("walls", unitBox(), mat("lit"), B, (b) => at(b.x, b.y, b.z, 0, 0, 0, b.w, b.h, b.d), (b) => T(wallOf(b))));
  const grounded = B.filter((b) => b.style !== "gablet");
  add(instanced("plinths", unitBox(), mat("lit"), grounded, (b) => at(b.x, b.y, b.z, 0, 0, 0, b.w + 0.05, 0.55, b.d + 0.05), () => T(C.base)));
  const gable = B.filter((b) => b.roof === "gable"), hip = B.filter((b) => b.roof === "hip"), flat = B.filter((b) => b.roof === "flat");
  const roofAt = (b, o) => at(b.x, b.y + b.h, b.z, b.ridge === "x" ? 0 : Math.PI / 2, 0, 0, (b.ridge === "x" ? b.w : b.d) + o, b.roofH, (b.ridge === "x" ? b.d : b.w) + o);
  const roofHex = (b) => C.roofs[b.roofTint % C.roofs.length];
  add(instanced("roofs:gable", gableSlopes(), mat("lit"), gable, (b) => roofAt(b, b.steps ? 0.04 : 0.3), (b) => T(roofHex(b))));
  add(instanced("roofs:ends", gableEnds(), mat("lit"), gable.filter((b) => !b.steps), (b) => roofAt(b, -0.02), (b) => T(wallOf(b), 0.95)));
  add(instanced("roofs:hip", hipRoof(), mat("lit"), hip, (b) => roofAt(b, 0.4), (b) => T(roofHex(b))));
  add(instanced("roofs:flat", unitBox(), mat("lit"), flat, (b) => at(b.x, b.y + b.h, b.z, 0, 0, 0, b.w + 0.2, 0.3, b.d + 0.2), () => T(C.flatRoof)));
  // stepped gables at the ends of the ridge (a wall dormer's only at the street)
  const steps = [];
  for (const b of gable) {
    if (!b.steps) continue;
    const ends = b.ridge === "x" ? [["e", b.x + b.w / 2 - 0.12, b.z], ["w", b.x - b.w / 2 + 0.12, b.z]] : [["s", b.x, b.z + b.d / 2 - 0.12], ["n", b.x, b.z - b.d / 2 + 0.12]];
    for (const [side, x, z] of ends) if (b.style !== "gablet" || side === b.front) steps.push({ b, x, z, ry: b.ridge === "x" ? Math.PI / 2 : 0, w: (b.ridge === "x" ? b.d : b.w) + 0.06 });
  }
  add(instanced("roofs:steps", stepGable(), mat("lit"), steps, (x) => at(x.x, x.b.y + x.b.h, x.z, x.ry, 0, 0, x.w, x.b.roofH, 1), (x) => T(wallOf(x.b))));
  add(instanced("roofs:spires", spire(), mat("lit"), layout.spires, (x) => at(x.x, x.y, x.z, 0, 0, 0, x.w * 0.95, x.h, x.w * 0.95), () => T(C.roofs[4])));

  const things = [], panes = [], awnings = [];
  for (const b of B) facade(b, things, panes, awnings, C, G, night);
  add(instanced("things", unitBox(), mat("lit"), things, (x) => at(x.x, x.y, x.z, x.ry ?? 0, 0, 0, x.w, x.h, x.d), (x) => T(x.c)));
  const paneGeo = night ? windowPane("#7a7a7a", "#ffffff") : windowPane(C.frame, C.glass);
  add(instanced("windows", paneGeo, mat(night ? "glow" : "lit"), panes, (x) => at(x.x, x.y, x.z, x.ry, 0, 0, x.w, x.h, 1), (x) => T(x.c)));
  add(instanced("awnings", awning(), mat("lit"), awnings, (x) => at(x.x, x.y, x.z, x.ry, 0, 0, x.w, 1, 1), (x) => T(C.awnings[x.c % C.awnings.length])));

  // ---- lamps on their wires, and their light at night ----
  const mids = layout.spans.map((sp) => ({ x: (sp.x0 + sp.x1) / 2, y: sp.y - 0.35, z: (sp.z0 + sp.z1) / 2, ground: road }));
  for (const p of layout.props) if (p.kind === "post") mids.push({ x: p.x, y: p.y + 4.35, z: p.z, ground: p.y });
  add(instanced("lamps", hangingLamp("#ffffff"), mat(night ? "glow" : "lit"), mids, (m) => at(m.x, m.y, m.z), () => T(night ? G.lamp : C.lampHead)));
  if (night) {
    const pool = () => { const g = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2); g.setAttribute("color", new THREE.Float32BufferAttribute(new Array(g.attributes.position.count * 3).fill(1), 3)); return g; };
    // pools under the lamps, and the canal carrying the light of the quay: long soft streaks across the water
    const glows = mids.map((m) => ({ x: m.x, y: m.ground + 0.03, z: m.z, sx: 6.5, sz: 6.5, k: 0.85 }));
    const wr = cn.water, wet = rowCanal ? (cn.side === "n" ? wr.minZ : wr.maxZ) : (cn.side === "w" ? wr.minX : wr.maxX);
    const toward = rowCanal ? (cn.side === "n" ? 1 : -1) : (cn.side === "w" ? 1 : -1);
    for (const b of B) {
      if (b.style !== "canal") continue;
      const u = rowCanal ? b.x : b.z, a = wet + toward * 3.2;
      glows.push(rowCanal ? { x: u, y: waterY + 0.02, z: a, sx: 1.3, sz: 6.5, k: b.shop ? 0.42 : 0.24 } : { x: a, y: waterY + 0.02, z: u, sx: 6.5, sz: 1.3, k: b.shop ? 0.42 : 0.24 });
    }
    const gl = add(instanced("glows", pool(), mat("add", { map: poolTexture() }), glows, (g) => at(g.x, g.y, g.z, 0, 0, 0, g.sx, 1, g.sz), (g) => T("#ffd596", g.k)));
    if (gl) gl.renderOrder = 2; // over the water, which is see-through too
  }

  // ---- trees ----
  const kinds = [...new Set(layout.trees.map((x) => x.kind))].sort();
  for (const kind of kinds) {
    const items = layout.trees.filter((x) => x.kind === kind);
    add(instanced(`trees:${kind}`, tree(kind, P.trees), mat("lit"), items, (x) => at(x.x, x.y, x.z, x.ry, 0, 0, x.s, x.s, x.s), (x) => grey(x.tone)));
  }

  return new Movers(layout, P, { mat, add });
}

// A footbridge over the canal: a low arch of stone with iron rails, from quay to quay.
function footbridge(s, br, C) {
  const n = 10, across = br.along === "z";
  const a0 = across ? br.minZ : br.minX, a1 = across ? br.maxZ : br.maxX, u = br.u, L = a1 - a0, w = across ? br.maxX - br.minX : br.maxZ - br.minZ;
  const y = (t) => LEVEL.quay + 0.55 * Math.sin(Math.PI * Math.min(1, Math.max(0, t)));
  const P = (a, side) => (across ? [u + side, a] : [a, u + side]);
  for (let k = 0; k < n; k++) {
    const t0 = k / n, t1 = (k + 1) / n, m = (t0 + t1) / 2;
    const [x, z] = P(a0 + L * m, 0);
    const slope = Math.atan2(y(t1) - y(t0), L / n);
    // the deck slab, thick enough to read as an arch from the side
    s.box(across ? w : L / n + 0.05, 0.32, across ? L / n + 0.05 : w, C.stone, x, y(m) - 0.3, z, 0, across ? { rx: -slope } : { rz: slope });
    for (const side of [-w / 2 + 0.08, w / 2 - 0.08]) {
      const [px, pz] = P(a0 + L * t0, side);
      s.box(0.07, 0.75, 0.07, C.iron, px, y(t0), pz);
      const [rx, rz] = P(a0 + L * m, side);
      s.box(across ? 0.06 : L / n + 0.02, 0.06, across ? L / n + 0.02 : 0.06, C.iron, rx, y(m) + 0.72, rz, 0, across ? { rx: -slope } : { rz: slope });
    }
  }
}

// Street things into the ground mesh: café tables under parasols, bollards, a fountain or a statue, benches.
function prop(s, p, C) {
  const { x, z, y } = p;
  switch (p.kind) {
    case "table": {
      const par = C.awnings[p.c % C.awnings.length];
      s.add(new THREE.CylinderGeometry(0.34, 0.34, 0.04, 8), "#e8e4da", at(x, y + 0.72, z));
      s.cyl(0.04, 0.72, C.iron, x, y, z, 4);
      // two chairs: a seat and a back each, facing the table
      for (const a of [0, Math.PI]) {
        const cx = x + Math.cos(a + p.ry) * 0.6, cz = z + Math.sin(a + p.ry) * 0.6, face = Math.atan2(x - cx, z - cz);
        s.box(0.32, 0.05, 0.32, C.bench, cx, y + 0.42, cz, face);
        s.box(0.32, 0.4, 0.05, C.bench, cx - Math.sin(face) * 0.15, y + 0.45, cz - Math.cos(face) * 0.15, face);
        s.cyl(0.025, 0.42, C.iron, cx, y, cz, 3);
      }
      s.cyl(0.03, 2.0, "#e8e4da", x, y, z, 4);
      s.cone(1.05, 0.38, par, x, y + 1.85, z, 8);
      break;
    }
    case "post":
      s.cyl(0.08, 0.3, C.iron, x, y, z, 6);
      s.cyl(0.05, 3.75, C.iron, x, y, z, 5);
      break;
    case "bollard":
      s.cyl(0.11, 0.42, C.iron, x, y, z, 6);
      s.add(new THREE.SphereGeometry(0.13, 6, 3), C.iron, at(x, y + 0.42, z));
      break;
    case "fountain":
      s.add(new THREE.CylinderGeometry(2.3, 2.4, 0.45, 14), C.stone, at(x, y + 0.22, z));
      s.add(new THREE.CylinderGeometry(2.0, 2.0, 0.04, 14), C.water, at(x, y + 0.44, z));
      s.cyl(0.28, 1.2, C.stone, x, y + 0.4, z, 8);
      s.cone(0.95, 0.35, C.stone, x, y + 1.95, z, 10, { rx: Math.PI });
      s.add(new THREE.CylinderGeometry(0.82, 0.82, 0.03, 10), C.water, at(x, y + 1.93, z));
      s.cyl(0.07, 0.75, "#e4eef0", x, y + 1.93, z, 5, 0.02);
      break;
    case "statue": {
      const cu = C.roofs[4];
      s.box(1.5, 1.9, 1.5, C.stone, x, y, z);
      s.box(1.75, 0.16, 1.75, C.quayEdge, x, y + 1.9, z);
      s.box(0.36, 0.85, 0.28, cu, x, y + 2.06, z);
      s.box(0.5, 0.75, 0.34, cu, x, y + 2.9, z);
      s.ico(0.17, cu, x, y + 3.82, z);
      s.rod(x + 0.28, y + 3.5, z, x + 0.55, y + 4.15, z + 0.1, 0.12, cu);
      break;
    }
    case "bench": {
      const ry = p.ry, cs = Math.cos(ry), sn = Math.sin(ry);
      s.box(1.3, 0.06, 0.42, C.bench, x, y + 0.4, z, ry);
      s.box(1.3, 0.38, 0.06, C.bench, x - sn * 0.2, y + 0.46, z - cs * 0.2, ry);
      for (const k of [-0.55, 0.55]) s.box(0.06, 0.4, 0.4, C.iron, x + cs * k, y, z - sn * k, ry);
      break;
    }
  }
}

// Windows, doors, shop fronts, awnings, dormers and chimneys for one house, into the instance lists.
function facade(b, things, panes, awnings, C, G, night) {
  let seed = b.seed >>> 0;
  const R = () => { seed = (Math.imul(seed ^ (seed >>> 15), 2246822519) + 0x9e3779b9) >>> 0; return seed / 4294967296; };
  const lit = (k) => (k < 0.5 ? G.window : k < 0.62 ? G.window2 : G.unlit);
  const day = "#ffffff";
  const all = {
    n: { L: b.w, x: (u) => b.x + u, z: () => b.z - b.d / 2 - 0.03, ry: Math.PI, ox: 0, oz: -1 },
    s: { L: b.w, x: (u) => b.x - u, z: () => b.z + b.d / 2 + 0.03, ry: 0, ox: 0, oz: 1 },
    e: { L: b.d, x: () => b.x + b.w / 2 + 0.03, z: (u) => b.z + u, ry: Math.PI / 2, ox: 1, oz: 0 },
    w: { L: b.d, x: () => b.x - b.w / 2 - 0.03, z: (u) => b.z - u, ry: -Math.PI / 2, ox: -1, oz: 0 },
  };
  const back = { n: "s", s: "n", e: "w", w: "e" }[b.front];
  const names = b.style === "tower" ? ["n", "s", "e", "w"] : b.style === "gablet" ? [b.front] : [b.front, back, ...b.ends];
  for (const nm of names) {
    const s = all[nm], front = nm === b.front;
    if (b.style === "gablet") {
      panes.push({ x: s.x(0), y: b.y + b.h - 1.2, z: s.z(0), ry: s.ry, w: 0.85, h: 1.3, c: night ? lit(R()) : day });
      if (b.roofH > 1.4) panes.push({ x: s.x(0), y: b.y + b.h + b.roofH * 0.3, z: s.z(0), ry: s.ry, w: 0.5, h: 0.55, c: night ? lit(R()) : day });
      continue;
    }
    if (b.style === "tower") {
      for (const f of [b.floors - 1, b.floors]) panes.push({ x: s.x(0), y: b.y + f * STOREY - 1.0, z: s.z(0), ry: s.ry, w: 0.6, h: 1.3, c: night ? lit(R()) : day });
      continue;
    }
    const n = Math.max(1, Math.floor((s.L - 0.4) / 1.7));
    for (let f = 0; f < b.floors; f++) {
      const y0 = b.y + f * STOREY;
      for (let k = 0; k < n; k++) {
        const u = -s.L / 2 + (s.L * (k + 0.5)) / n, px = s.x(u), pz = s.z(u);
        if (f === 0 && front) {
          const mid = k === Math.floor(n / 2);
          if (mid) panes.push({ x: px, y: y0 + 1.15, z: pz, ry: s.ry, w: 0.95, h: 2.0, c: night ? (b.shop ? G.shop : G.unlit) : C.door });
          else if (b.shop) panes.push({ x: px, y: y0 + 1.25, z: pz, ry: s.ry, w: s.L / n - 0.28, h: 1.85, c: night ? G.shop : day });
          else panes.push({ x: px, y: y0 + 1.7, z: pz, ry: s.ry, w: 0.8, h: 1.3, c: night ? lit(R()) : day });
          continue;
        }
        panes.push({ x: px, y: y0 + 1.62, z: pz, ry: s.ry, w: 0.8, h: 1.45, c: night ? lit(R()) : day });
      }
    }
    // windows up in a gable end
    const gableEnd = b.roof === "gable" && ((b.ridge === "x" && (nm === "e" || nm === "w")) || (b.ridge === "z" && (nm === "n" || nm === "s")));
    if (gableEnd && b.roofH > 1.6) {
      const y = b.y + b.h + b.roofH * 0.2;
      for (const u of s.L > 4.4 ? [-s.L * 0.17, s.L * 0.17] : [0]) panes.push({ x: s.x(u), y: y + 0.4, z: s.z(u), ry: s.ry, w: 0.62, h: 0.95, c: night ? lit(R()) : day });
      if (b.roofH > 3.4) panes.push({ x: s.x(0), y: b.y + b.h + b.roofH * 0.58, z: s.z(0), ry: s.ry, w: 0.5, h: 0.6, c: night ? lit(R()) : day });
    }
    if (front && b.shop) {
      if (b.awning !== null) awnings.push({ x: s.x(0), y: b.y + 2.5, z: s.z(0), ry: s.ry, w: Math.min(s.L - 0.5, 6.5), c: b.awning });
      else things.push({ x: s.x(0) + s.ox * 0.06, y: b.y + 2.45, z: s.z(0) + s.oz * 0.06, ry: s.ry, w: Math.min(2.6, s.L * 0.5), h: 0.42, d: 0.08, c: C.awnings[b.seed % C.awnings.length] });
    }
  }
  // dormers on the street slope of a gable along the street, each with its window and a cap in the roof's colour
  const roofHex = C.roofs[b.roofTint % C.roofs.length];
  if (b.dormers) {
    const s = all[b.front], deep = b.front === "n" || b.front === "s" ? b.d : b.w;
    const inset = 0.75, hs = (b.roofH * inset) / (deep / 2);
    const n = Math.max(1, Math.floor(s.L / 3));
    for (let k = 0; k < n; k++) {
      const u = -s.L / 2 + (s.L * (k + 0.5)) / n, fx = s.x(u) - s.ox * inset, fz = s.z(u) - s.oz * inset;
      const y = b.y + b.h + hs - 0.3;
      things.push({ x: fx - s.ox * 0.6, y, z: fz - s.oz * 0.6, ry: s.ry, w: 1.0, h: 1.05, d: 1.2, c: T(roofHex, 1.18).getStyle() });
      things.push({ x: fx - s.ox * 0.55, y: y + 1.05, z: fz - s.oz * 0.55, ry: s.ry, w: 1.2, h: 0.12, d: 1.4, c: roofHex });
      panes.push({ x: fx + s.ox * 0.01, y: y + 0.6, z: fz + s.oz * 0.01, ry: s.ry, w: 0.62, h: 0.62, c: night ? lit(R()) : day });
    }
  }
  // a chimney or two on the ridge
  if ((b.roof === "gable" || b.roof === "hip") && b.style !== "gablet" && b.style !== "civic" && R() < 0.65) {
    const along = b.ridge === "x", L = along ? b.w : b.d;
    for (const t of R() < 0.5 ? [-0.3] : [-0.32, 0.3]) {
      const x = along ? b.x + L * t : b.x, z = along ? b.z : b.z + L * t;
      things.push({ x, y: b.y + b.h + b.roofH * 0.55, z, w: 0.55, h: b.roofH * 0.45 + 0.75, d: 0.55, c: "#8e5a4a" });
    }
  }
  if (b.roof === "flat") things.push({ x: b.x + (R() - 0.5) * (b.w - 2), y: b.y + b.h + 0.3, z: b.z + (R() - 0.5) * (b.d - 2), w: 1.0, h: 0.6, d: 0.7, c: "#c9c7c0" });
}
