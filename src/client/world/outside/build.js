// An outside layout (gen.js) to three.js: the terrain or the streets as single vertex-coloured meshes, everything
// repeated (trees, building parts, windows, lamps, cars, people) as InstancedMeshes, water with a moving sheen.
// buildOutside(layout, palette, uniforms) -> { group, update(now, dt), dispose(), counts }.
import { THREE, Parts, material, instanced, color, at, poolTexture } from "./parts.js";
import * as M from "./models.js";
import { TAG, LEVEL, ROAD, STOREY, WATER, sampleGrid } from "./gen.js";
import { Movers } from "./movers.js";

export function buildOutside(layout, P, U) {
  const group = new THREE.Group();
  group.name = "outside";
  const mats = new Map();
  const mat = (kind, o) => { const k = kind + (o ? JSON.stringify(Object.keys(o)) : ""); if (!mats.has(k)) mats.set(k, material(U, kind, o)); return mats.get(k); };
  const add = (o) => { if (o) group.add(o); return o; };
  const lot = layout.lot;
  U.uLot.value.set(lot.minX, lot.minZ, lot.maxX, lot.maxZ);
  U.uFade.value.set(layout.fade.from, layout.fade.to);
  U.uMoon.value.set(P.moon);
  const ctx = { P, U, mat, add, group, layout };
  const movers = layout.mode === "city" ? buildCity(ctx) : buildNature(ctx);
  return {
    group,
    update(now, dt) { U.uTime.value = now / 1000; movers?.update(dt); },
    dispose() {
      group.traverse((o) => o.geometry?.dispose());
      for (const m of mats.values()) m.dispose();
    },
  };
}

const tint = new THREE.Color();
const T = (hex, k = 1) => tint.set(hex).multiplyScalar(k);
const grey = (k) => tint.setRGB(k, k, k);

// ---- nature --------------------------------------------------------------------------------------------------------

function buildNature({ P, U, mat, add, layout }) {
  const N = P.nature;
  U.uSheen.value.set(N.sheen);
  const t = layout.terrain, lot = layout.lot;
  const nx = t.xs.length, nz = t.zs.length;

  // Terrain: one mesh, a hole where the lot is, colours from the tags with a little noise and a lighter hilltop.
  {
    const pos = new Float32Array(nx * nz * 3), col = new Float32Array(nx * nz * 3);
    const base = N.ground.map((h) => new THREE.Color(h));
    const c = new THREE.Color();
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const k = j * nx + i, h = t.h[k];
      pos.set([t.xs[i], h, t.zs[j]], k * 3);
      c.copy(base[t.tag[k]] ?? base[1]).multiplyScalar(1 + t.tone[k] * 0.16 + Math.min(0.08, Math.max(0, h - 1.5) * 0.015));
      col.set([c.r, c.g, c.b], k * 3);
    }
    const idx = [];
    for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
      const mx = (t.xs[i] + t.xs[i + 1]) / 2, mz = (t.zs[j] + t.zs[j + 1]) / 2;
      if (mx > lot.minX && mx < lot.maxX && mz > lot.minZ && mz < lot.maxZ) continue;
      const a = j * nx + i, b = a + 1, d = a + nx, e = d + 1;
      if ((i + j) % 2) idx.push(a, d, e, a, e, b); else idx.push(a, d, b, b, d, e);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    g.computeBoundingSphere();
    const mesh = new THREE.Mesh(g, mat("lit"));
    mesh.name = "terrain";
    mesh.receiveShadow = true;
    add(mesh);
  }

  // Water: a ribbon down the river (aFlow: metres along, -1..1 across) and the pond, at one level.
  {
    const w = new Parts();
    w.flow = [];
    const R = layout.water.river, y = layout.water.level;
    let along = 0;
    const edge = (i) => {
      const a = R[Math.max(0, i - 1)], b = R[Math.min(R.length - 1, i + 1)];
      const tx = b.x - a.x, tz = b.z - a.z, tl = Math.hypot(tx, tz) || 1, half = R[i].w + WATER.bank + 0.4;
      return { l: [R[i].x + (tz / tl) * half, R[i].z - (tx / tl) * half], r: [R[i].x - (tz / tl) * half, R[i].z + (tx / tl) * half] };
    };
    let prev = edge(0);
    for (let i = 1; i < R.length; i++) {
      const cur = edge(i), seg = Math.hypot(R[i].x - R[i - 1].x, R[i].z - R[i - 1].z);
      const a0 = along, a1 = along + seg;
      const A = [prev.l[0], y, prev.l[1]], B = [prev.r[0], y, prev.r[1]], C = [cur.l[0], y, cur.l[1]], D = [cur.r[0], y, cur.r[1]];
      // up-facing triangles: (A, B, D) and (A, D, C) if the river runs one way, else flipped
      const up = (B[0] - A[0]) * (D[2] - A[2]) - (B[2] - A[2]) * (D[0] - A[0]) < 0;
      const tri = (p, q, r, fp, fq, fr) => { w.pos.push(...p, ...q, ...r); w.flow.push(...fp, ...fq, ...fr); };
      if (up) { tri(A, B, D, [a0, -1], [a0, 1], [a1, 1]); tri(A, D, C, [a0, -1], [a1, 1], [a1, -1]); }
      else { tri(A, D, B, [a0, -1], [a1, 1], [a0, 1]); tri(A, C, D, [a0, -1], [a1, -1], [a1, 1]); }
      prev = cur; along = a1;
    }
    const pond = layout.water.pond;
    if (pond) {
      const n = 24, cs = Math.cos(pond.ry), sn = Math.sin(pond.ry);
      const pt = (k, s) => { const a = (k / n) * Math.PI * 2, u = Math.cos(a) * (pond.rx + WATER.bank) * s, v = Math.sin(a) * (pond.rz + WATER.bank) * s; return [pond.x + u * cs + v * sn, y, pond.z - u * sn + v * cs]; };
      for (let k = 0; k < n; k++) {
        const C0 = [pond.x, y, pond.z], A = pt(k, 1), B = pt(k + 1, 1);
        const up = (A[0] - C0[0]) * (B[2] - C0[2]) - (A[2] - C0[2]) * (B[0] - C0[0]) < 0;
        const f = (p) => [p[0] * 0.6, Math.min(1, Math.hypot(p[0] - pond.x, p[2] - pond.z) / (pond.rx + WATER.bank))];
        if (up) { w.pos.push(...C0, ...A, ...B); w.flow.push(...f(C0), ...f(A), ...f(B)); }
        else { w.pos.push(...C0, ...B, ...A); w.flow.push(...f(C0), ...f(B), ...f(A)); }
      }
    }
    const c = color(N.water);
    for (let k = 0; k < w.pos.length / 3; k++) w.col.push(c.r, c.g, c.b);
    const mesh = new THREE.Mesh(w.geometry(), mat("water"));
    mesh.name = "water";
    mesh.renderOrder = 1;
    add(mesh);
  }

  // The path (a ribbon laid on the ground, in runs between the water) and the bridge, in one mesh.
  {
    const s = new Parts();
    const pts = layout.path.points, hw = layout.path.width / 2;
    const yAt = (x, z) => sampleGrid(t, x, z) + 0.05;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      if (len > 2.5) continue; // the gap the bridge spans
      const nx_ = -(b.z - a.z) / len, nz_ = (b.x - a.x) / len;
      const w0 = hw * (0.9 + 0.2 * Math.sin(i * 1.7)), w1 = hw * (0.9 + 0.2 * Math.sin((i + 1) * 1.7));
      const A = [a.x + nx_ * w0, yAt(a.x + nx_ * w0, a.z + nz_ * w0), a.z + nz_ * w0], B = [a.x - nx_ * w0, yAt(a.x - nx_ * w0, a.z - nz_ * w0), a.z - nz_ * w0];
      const C = [b.x + nx_ * w1, yAt(b.x + nx_ * w1, b.z + nz_ * w1), b.z + nz_ * w1], D = [b.x - nx_ * w1, yAt(b.x - nx_ * w1, b.z - nz_ * w1), b.z - nz_ * w1];
      const up = (B[0] - A[0]) * (D[2] - A[2]) - (B[2] - A[2]) * (D[0] - A[0]) < 0;
      if (up) s.pos.push(...A, ...B, ...D, ...A, ...D, ...C); else s.pos.push(...A, ...D, ...B, ...A, ...C, ...D);
      const c = color((i * 7) % 5 ? N.path : N.pathEdge);
      for (let k = 0; k < 6; k++) s.col.push(c.r, c.g, c.b);
    }
    const br = layout.bridge;
    if (br) bridge(s, br, N.bridge);
    if (!s.empty) { const m = new THREE.Mesh(s.geometry(), mat("lit")); m.name = "path"; m.receiveShadow = true; add(m); }
  }

  // Trees by kind, rocks, flowers, reeds.
  const kinds = [...new Set(layout.trees.map((x) => x.kind))].sort();
  for (const kind of kinds) {
    const items = layout.trees.filter((x) => x.kind === kind);
    add(instanced(`trees:${kind}`, M.tree(kind, P.trees), mat("lit"), items, (x) => at(x.x, x.y, x.z, x.ry, 0, 0, x.s, x.s, x.s), (x) => grey(x.tone)));
  }
  add(instanced("rocks", M.rock(N.rock), mat("lit"), layout.rocks, (x) => at(x.x, x.y, x.z, x.ry, 0, 0, x.s, x.s, x.s), (x) => grey(x.tone)));
  add(instanced("flowers", M.flower(), mat("lit"), layout.flowers, (x) => at(x.x, x.y, x.z), (x) => T(N.flowers[x.c % N.flowers.length])));
  add(instanced("reeds", M.reed(N.reed, P.night ? "#4a4a40" : "#7a5a3a"), mat("lit"), layout.reeds, (x) => at(x.x, x.y, x.z, x.ry, 0, 0, x.s, x.s, x.s)));
  return null;
}

// A small arched footbridge: deck planks rising to the middle, posts and a rail either side.
function bridge(s, br, C) {
  const n = 9, L = br.length, cs = Math.sin(br.ry), cc = Math.cos(br.ry);
  // the deck runs from bank to bank and arches up to `rise` in the middle
  const yAt = (u) => { const k = Math.min(1, Math.max(0, u / L + 0.5)); const end = br.y0 + (br.y1 - br.y0) * k; return end + (br.rise - end) * Math.sin(k * Math.PI); };
  for (let k = 0; k < n; k++) {
    const u = -L / 2 + (L * (k + 0.5)) / n;
    const x = br.x + cs * u, z = br.z + cc * u, y = yAt(u);
    const slope = Math.atan2(yAt(u + 0.1) - yAt(u - 0.1), 0.2);
    s.box(br.width, 0.12, L / n + 0.04, C.deck, x, y - 0.06, z, br.ry, { rx: -slope });
  }
  for (const side of [-1, 1]) {
    for (let k = 0; k <= 4; k++) {
      const u = -L / 2 + 0.3 + ((L - 0.6) * k) / 4;
      const x = br.x + cs * u + cc * side * (br.width / 2 - 0.06), z = br.z + cc * u - cs * side * (br.width / 2 - 0.06);
      s.box(0.1, 0.62, 0.1, C.post, x, yAt(u) - 0.05, z, br.ry);
    }
    for (let k = 0; k < 6; k++) {
      const u = -L / 2 + 0.3 + ((L - 0.6) * (k + 0.5)) / 6;
      const x = br.x + cs * u + cc * side * (br.width / 2 - 0.06), z = br.z + cc * u - cs * side * (br.width / 2 - 0.06);
      const slope = Math.atan2(yAt(u + 0.1) - yAt(u - 0.1), 0.2);
      s.box(0.09, 0.08, (L - 0.6) / 6 + 0.06, C.rail, x, yAt(u) + 0.55, z, br.ry, { rx: -slope });
    }
  }
}

// ---- city ----------------------------------------------------------------------------------------------------------

function buildCity({ P, U, mat, add, layout }) {
  const C = P.city, G = P.glow, night = P.night;
  const lot = layout.lot;
  const road = LEVEL.road, walk = LEVEL.walk;

  // The ground: blocks, pavements with kerbs, roads, junctions, markings, zebras, tree pits, soft shadows under houses.
  {
    const s = new Parts();
    for (const b of layout.blocks) {
      const o = b.outer, i = b.inner;
      if (b.kind !== "lot") s.quad(i.minX, i.minZ, i.maxX, i.maxZ, walk, C.ground[b.ground]);
      if (b.kind === "park") { const cx = (i.minX + i.maxX) / 2, cz = (i.minZ + i.maxZ) / 2; s.quad(cx - 1.1, i.minZ, cx + 1.1, i.maxZ, walk + 0.004, C.ground.gravel); s.quad(i.minX, cz - 1.1, i.maxX, cz + 1.1, walk + 0.004, C.ground.gravel); }
      // the pavement ring: a slab from the road up to the pavement, the kerb's top a lighter line
      for (const r of [[o.minX, o.minZ, o.maxX, i.minZ], [o.minX, i.maxZ, o.maxX, o.maxZ], [o.minX, i.minZ, i.minX, i.maxZ], [i.maxX, i.minZ, o.maxX, i.maxZ]]) {
        s.box(r[2] - r[0], walk - road + 0.005, r[3] - r[1], C.walk, (r[0] + r[2]) / 2, road - 0.005, (r[1] + r[3]) / 2);
      }
      const k = 0.2, y = walk + 0.003;
      s.quad(o.minX, o.minZ, o.maxX, o.minZ + k, y, C.kerb); s.quad(o.minX, o.maxZ - k, o.maxX, o.maxZ, y, C.kerb);
      s.quad(o.minX, o.minZ, o.minX + k, o.maxZ, y, C.kerb); s.quad(o.maxX - k, o.minZ, o.maxX, o.maxZ, y, C.kerb);
    }
    for (const r of [...layout.roads, ...layout.junctions]) s.quad(r.minX, r.minZ, r.maxX, r.maxZ, road, C.road);
    const SW = ROAD.walk, ym = road + 0.004;
    for (const r of layout.roads) {
      const z = r.dir === "z";
      const a = (z ? r.minZ : r.minX) + SW + 0.8, b = (z ? r.maxZ : r.maxX) - SW - 0.8, c = z ? (r.minX + r.maxX) / 2 : (r.minZ + r.maxZ) / 2;
      for (let u = a; u + 1.5 <= b; u += 3) z ? s.quad(c - 0.07, u, c + 0.07, u + 1.5, ym, C.mark) : s.quad(u, c - 0.07, u + 1.5, c + 0.07, ym, C.mark);
      // stop lines across the right-hand lane, before each zebra
      if (z) { s.quad(c, a - 0.6, c + 2.8, a - 0.35, ym, C.mark); s.quad(c - 2.8, b + 0.35, c, b + 0.6, ym, C.mark); }
      else { s.quad(a - 0.6, c - 2.8, a - 0.35, c, ym, C.mark); s.quad(b + 0.35, c, b + 0.6, c + 2.8, ym, C.mark); }
    }
    for (const c of layout.crossings) {
      const across = c.dir === "x"; // walkers cross along x: the bars run along z
      const len = across ? c.maxX - c.minX : c.maxZ - c.minZ;
      for (let u = 0.35; u + 0.45 <= len - 0.2; u += 0.9) {
        if (across) s.quad(c.minX + u, c.minZ + 0.2, c.minX + u + 0.45, c.maxZ - 0.2, ym, C.mark);
        else s.quad(c.minX + 0.2, c.minZ + u, c.maxX - 0.2, c.minZ + u + 0.45, ym, C.mark);
      }
    }
    for (const tr of layout.trees) if (tr.kind === "street") s.quad(tr.x - 0.5, tr.z - 0.5, tr.x + 0.5, tr.z + 0.5, walk + 0.004, C.pit);
    const shadow = color(C.ground.gravel).clone().multiplyScalar(0.78).getHexString();
    for (const b of layout.buildings) s.quad(b.x - b.w / 2 - 0.35, b.z - b.d / 2 - 0.35, b.x + b.w / 2 + 0.35, b.z + b.d / 2 + 0.35, walk + 0.002, `#${shadow}`);
    const m = new THREE.Mesh(s.geometry(), mat("lit"));
    m.name = "streets";
    m.receiveShadow = true;
    add(m);
  }

  // Buildings: walls, plinths, roofs (flat, gabled, hipped), roof things, balconies, windows and doors, awnings.
  const B = layout.buildings;
  const wallOf = (b) => C.walls[b.wall][b.tint % C.walls[b.wall].length];
  add(instanced("walls", M.unitBox(), mat("lit"), B, (b) => at(b.x, b.y, b.z, 0, 0, 0, b.w, b.h, b.d), (b) => T(wallOf(b))));
  add(instanced("plinths", M.unitBox(), mat("lit"), B, (b) => at(b.x, b.y, b.z, 0, 0, 0, b.w + 0.06, 0.45, b.d + 0.06), (b) => T(C.base[b.wall])));
  const flat = B.filter((b) => b.roof === "flat"), gable = B.filter((b) => b.roof === "gable"), hip = B.filter((b) => b.roof === "hip");
  add(instanced("roofs:flat", M.unitBox(), mat("lit"), flat, (b) => at(b.x, b.y + b.h, b.z, 0, 0, 0, b.w + 0.2, 0.22, b.d + 0.2), () => T(C.flatRoof)));
  const roofAt = (b, o = 0.35) => at(b.x, b.y + b.h, b.z, b.ridge === "x" ? 0 : Math.PI / 2, 0, 0, (b.ridge === "x" ? b.w : b.d) + o, b.roofH, (b.ridge === "x" ? b.d : b.w) + o);
  add(instanced("roofs:gable", M.gableSlopes(), mat("lit"), gable, (b) => roofAt(b), (b) => T(C.roofs[b.roofTint % C.roofs.length])));
  add(instanced("roofs:ends", M.gableEnds(), mat("lit"), gable, (b) => roofAt(b, -0.02), (b) => T(wallOf(b), 0.94)));
  add(instanced("roofs:hip", M.hipRoof(), mat("lit"), hip, (b) => roofAt(b, 0.5), (b) => T(C.roofs[b.roofTint % 2])));

  const things = [], panes = [], awnings = [];
  for (const b of B) facade(b, things, panes, awnings, C, G, night);
  add(instanced("things", M.unitBox(), mat("lit"), things, (x) => at(x.x, x.y, x.z, x.ry ?? 0, 0, 0, x.w, x.h, x.d), (x) => T(x.c)));
  const paneGeo = night ? M.windowPane("#7a7a7a", "#ffffff") : M.windowPane(C.frame, C.glass);
  add(instanced("windows", paneGeo, mat(night ? "glow" : "lit"), panes, (x) => at(x.x, x.y, x.z, x.ry, 0, 0, x.w, x.h, 1), (x) => T(x.c)));
  add(instanced("awnings", M.awning(), mat("lit"), awnings, (x) => at(x.x, x.y, x.z, x.ry, 0, 0, x.w, 1, 1), (x) => T(C.awnings[x.c % C.awnings.length])));

  // Street lamps and trees.
  add(instanced("lamps", M.lampPole("#ffffff"), mat("lit"), layout.lamps, (l) => at(l.x, walk, l.z, l.ry), () => T(C.lamp)));
  add(instanced("lamps:heads", M.lampHead("#ffffff"), mat("glow"), layout.lamps, (l) => at(l.x, walk, l.z, l.ry), () => T(night ? G.lamp : C.lampHead)));
  if (night) {
    const pools = new THREE.PlaneGeometry(5, 5).rotateX(-Math.PI / 2);
    pools.setAttribute("color", new THREE.Float32BufferAttribute(new Array(pools.attributes.position.count * 3).fill(1), 3));
    add(instanced("lamps:pools", pools, mat("add", { map: poolTexture() }), layout.lamps, (l) => at(l.x + Math.sin(l.ry) * 1.0, road + 0.03, l.z + Math.cos(l.ry) * 1.0), () => T("#ffd596", 0.55)));
  }
  const kinds = [...new Set(layout.trees.map((x) => x.kind))].sort();
  for (const kind of kinds) {
    const items = layout.trees.filter((x) => x.kind === kind);
    add(instanced(`trees:${kind}`, M.tree(kind, P.trees), mat("lit"), items, (x) => at(x.x, x.y, x.z, x.ry, 0, 0, x.s, x.s, x.s), (x) => grey(x.tone)));
  }

  return new Movers(layout, P, { mat, add });
}

// Windows, doors, shop fronts, awnings, balconies and roof things for one building, into the instance lists.
function facade(b, things, panes, awnings, C, G, night) {
  let seed = b.seed >>> 0;
  const R = () => { seed = (Math.imul(seed ^ (seed >>> 15), 2246822519) + 0x9e3779b9) >>> 0; return seed / 4294967296; };
  const lit = (k) => (k < 0.5 ? G.window : k < 0.62 ? G.window2 : G.unlit);
  const sides = [
    { n: "n", L: b.w, x: (u) => b.x + u, z: () => b.z - b.d / 2 - 0.03, ry: Math.PI, ox: 0, oz: -1 },
    { n: "s", L: b.w, x: (u) => b.x - u, z: () => b.z + b.d / 2 + 0.03, ry: 0, ox: 0, oz: 1 },
    { n: "e", L: b.d, x: () => b.x + b.w / 2 + 0.03, z: (u) => b.z + u, ry: Math.PI / 2, ox: 1, oz: 0 },
    { n: "w", L: b.d, x: () => b.x - b.w / 2 - 0.03, z: (u) => b.z - u, ry: -Math.PI / 2, ox: -1, oz: 0 },
  ];
  const wide = b.style === "office";
  const step = wide ? 2.0 : b.style === "house" ? 2.6 : 2.3;
  for (const s of sides) {
    const n = Math.floor((s.L - 0.8) / step);
    if (n < 1) continue;
    const front = s.n === b.front;
    const gableEnd = b.roof === "gable" && ((b.ridge === "x" && (s.n === "e" || s.n === "w")) || (b.ridge === "z" && (s.n === "n" || s.n === "s")));
    for (let f = 0; f < b.floors; f++) {
      const y0 = b.y + f * STOREY;
      for (let k = 0; k < n; k++) {
        const u = -s.L / 2 + (s.L * (k + 0.5)) / n;
        const px = s.x(u), pz = s.z(u);
        if (f === 0 && front) {
          const mid = k === Math.floor(n / 2);
          if (b.shop) {
            if (mid) panes.push({ x: px, y: y0 + 1.05, z: pz, ry: s.ry, w: 0.95, h: 2.0, c: night ? G.unlit : C.door });
            else panes.push({ x: px, y: y0 + 1.2, z: pz, ry: s.ry, w: s.L / n - 0.3, h: 1.7, c: night ? G.window2 : "#ffffff" });
            continue;
          }
          if (mid) { panes.push({ x: px, y: y0 + 1.05, z: pz, ry: s.ry, w: 0.95, h: 2.0, c: night ? G.unlit : C.door }); continue; }
        }
        const h = wide ? 1.35 : 1.2, w = wide ? step - 0.35 : 0.9;
        const k2 = R();
        panes.push({ x: px, y: y0 + 1.55, z: pz, ry: s.ry, w, h, c: night ? lit(k2) : "#ffffff" });
        // balconies on the front of flats, every other window above the ground floor
        if (b.style === "flats" && front && f > 0 && k % 2 === 0) {
          things.push({ x: px + s.ox * 0.38, y: y0 + 0.05, z: pz + s.oz * 0.38, ry: s.ry, w: 1.5, h: 0.1, d: 0.75, c: C.base.plaster });
          things.push({ x: px + s.ox * 0.74, y: y0 + 0.15, z: pz + s.oz * 0.74, ry: s.ry, w: 1.5, h: 0.55, d: 0.05, c: C.frame });
        }
      }
    }
    // a little window up in a gable end
    if (gableEnd && s.L > 4) panes.push({ x: s.x(0), y: b.y + b.h + b.roofH * 0.35, z: s.z(0), ry: s.ry, w: 0.7, h: 0.6, c: night ? lit(R()) : "#ffffff" });
    if (front && b.awning !== null && b.shop) {
      awnings.push({ x: s.x(0) + s.ox * 0.0, y: b.y + 2.35, z: s.z(0) + s.oz * 0.0, ry: s.ry, w: Math.min(s.L - 0.6, 6), c: b.awning });
      // a sign above the awning
      things.push({ x: s.x(0) + s.ox * 0.08, y: b.y + 2.55, z: s.z(0) + s.oz * 0.08, ry: s.ry, w: Math.min(2.4, s.L * 0.4), h: 0.45, d: 0.08, c: C.awnings[(b.awning + 2) % C.awnings.length] });
    }
  }
  // roof things on flat roofs: air units, a water tank, a vent
  if (b.roof === "flat") {
    const top = b.y + b.h + 0.22;
    for (let k = 0; k < b.top + (b.floors >= 4 ? 1 : 0); k++) {
      const x = b.x + (R() - 0.5) * (b.w - 2), z = b.z + (R() - 0.5) * (b.d - 2);
      const tank = k === 0 && b.floors >= 4;
      things.push(tank ? { x, y: top, z, w: 1.4, h: 1.1, d: 1.4, c: "#b9b6ae" } : { x, y: top, z, w: 1.0, h: 0.6, d: 0.7, c: "#c9c7c0" });
    }
  }
}
