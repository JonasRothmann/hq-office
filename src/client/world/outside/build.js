// An outside layout (gen.js) to three.js: the terrain or the streets as single vertex-coloured meshes, everything
// repeated (trees, building parts, windows, lamps, cars, people) as InstancedMeshes, water with a moving sheen.
// buildOutside(layout, palette, uniforms) -> { group, update(now, dt), dispose(), counts }.
import { THREE, Parts, material, instanced, color, at } from "./parts.js";
import { flower, tuft, reed, rock, tree } from "./models.js";
import { WATER, sampleGrid } from "./gen.js";
import { buildCity } from "./city-build.js";

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
    const shadeAt = treeShade(layout.trees);
    const H = (i, j) => t.h[Math.min(nz - 1, Math.max(0, j)) * nx + Math.min(nx - 1, Math.max(0, i))];
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const k = j * nx + i, h = t.h[k];
      pos.set([t.xs[i], h, t.zs[j]], k * 3);
      // the sun's side of a hill a little lighter, the far side darker (the key light comes from the front left)
      const gx = (H(i + 1, j) - H(i - 1, j)) / ((t.xs[Math.min(nx - 1, i + 1)] - t.xs[Math.max(0, i - 1)]) || 1);
      const gz = (H(i, j + 1) - H(i, j - 1)) / ((t.zs[Math.min(nz - 1, j + 1)] - t.zs[Math.max(0, j - 1)]) || 1);
      const nl = Math.hypot(gx, 1, gz), lit = (-gx * SUN[0] + SUN[1] - gz * SUN[2]) / nl - SUN[1];
      const slope = Math.max(0.8, Math.min(1.16, 1 + lit * 1.1));
      c.copy(base[t.tag[k]] ?? base[1]).multiplyScalar((1 + t.tone[k] * 0.16) * slope * shadeAt(t.xs[i], t.zs[j]));
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
      const c = color(N.path);
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
    add(instanced(`trees:${kind}`, tree(kind, P.trees), mat("lit"), items, (x) => at(x.x, x.y, x.z, x.ry, 0, 0, x.s, x.s, x.s), (x) => grey(x.tone)));
  }
  add(instanced("rocks", rock(N.rock), mat("lit"), layout.rocks, (x) => at(x.x, x.y, x.z, x.ry, 0, 0, x.s, x.s, x.s), (x) => grey(x.tone)));
  add(instanced("flowers", flower(N.reed), mat("lit"), layout.flowers, (x) => at(x.x, x.y, x.z, x.ry ?? 0), (x) => T(N.flowers[x.c % N.flowers.length])));
  add(instanced("tufts", tuft(N.tuft, N.tuft2), mat("lit"), layout.tufts ?? [], (x) => at(x.x, x.y, x.z, x.ry, 0, 0, x.s, x.s, x.s)));
  add(instanced("reeds", reed(N.reed, P.night ? "#4a4a40" : "#7a5a3a"), mat("lit"), layout.reeds, (x) => at(x.x, x.y, x.z, x.ry, 0, 0, x.s, x.s, x.s)));
  return null;
}

// Toward the key light (scene.js puts it at x - 16, y 24, z + 17 from the office).
const SUN = (() => { const v = [-16, 24, 17], l = Math.hypot(...v); return v.map((a) => a / l); })();

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
