// The scenery drawn (view/scenery.js plans it): each batch of pieces and each mover as instanced meshes, one per
// material; height fields and ribbons as single vertex-coloured meshes. Everything takes the outdoor materials (no lamp
// light, the fade). update(t) puts the movers where they are at t seconds. Movers cast no shadows, so moving them
// never redraws the shadow map.
import * as THREE from "three";
import { buildPrims } from "../catalog/define.js";
import { resolveColor } from "../catalog/palette.js";
import { primsToGeometries, materialFor } from "./meshes.js";
import { moverPlaces } from "../view/scenery.js";

const _o = new THREE.Object3D(), _c = new THREE.Color();

export function buildScenery(plan, catalog, palette, materials) {
  const group = new THREE.Group();
  group.name = "scenery";
  const geometries = [];
  const tintOf = (t) => _c.set(t ? resolveColor(t, palette) : "#ffffff");

  // n copies of a catalog piece, an instanced mesh per material
  function instanced(name, type, params, n, cast) {
    const meshes = [];
    for (const [key, geo] of primsToGeometries(buildPrims(catalog.get(type), params), palette)) {
      const finish = key.split("|")[0];
      const mesh = new THREE.InstancedMesh(geo, materialFor(materials, key, true), n);
      mesh.name = name;
      mesh.castShadow = cast && finish !== "glass";
      mesh.receiveShadow = finish !== "glow";
      mesh.userData.finish = finish;
      geometries.push(geo);
      group.add(mesh);
      meshes.push(mesh);
    }
    return meshes;
  }

  for (const b of plan.batches) {
    const meshes = instanced(`scenery:${b.type}`, b.type, b.params, b.items.length, b.shadow);
    const tinted = b.items.some((it) => it.tint);
    for (const m of meshes) {
      b.items.forEach((it, i) => {
        _o.position.set(...it.at); _o.rotation.set(0, it.ry, 0); _o.scale.set(...it.s); _o.updateMatrix();
        m.setMatrixAt(i, _o.matrix);
        if (tinted) m.setColorAt(i, tintOf(it.tint));
      });
      m.computeBoundingSphere();
    }
  }

  const movers = plan.movers.map((mv) => {
    const meshes = instanced(`scenery:${mv.key}`, mv.type, mv.params, mv.at.length, false);
    for (const m of meshes) {
      m.frustumCulled = false; // its copies go round the whole loop
      if (mv.tints) mv.tints.forEach((t, i) => m.setColorAt(i, tintOf(t)));
    }
    return { mv, meshes };
  });

  for (const f of plan.fields) add(fieldGeometry(f, palette), "matte", "scenery:field");
  for (const s of plan.strips) add(stripGeometry(s, palette), s.finish ?? "matte", "scenery:strip");
  function add(geo, finish, name) {
    const mesh = new THREE.Mesh(geo, materials.get(finish, null, { outdoor: true }));
    mesh.name = name;
    mesh.receiveShadow = finish === "matte";
    if (finish === "glass") mesh.renderOrder = 1;
    geometries.push(geo);
    group.add(mesh);
  }

  let last = null;
  function update(t) {
    if (t === last) return;
    last = t;
    for (const { mv, meshes } of movers) {
      const places = moverPlaces(mv, t);
      for (const m of meshes) {
        places.forEach(([x, y, z, ry], i) => { _o.position.set(x, y, z); _o.rotation.set(0, ry, 0); _o.scale.set(1, 1, 1); _o.updateMatrix(); m.setMatrixAt(i, _o.matrix); });
        m.instanceMatrix.needsUpdate = true;
      }
    }
  }

  return {
    group, update,
    counts: () => ({ pieces: plan.batches.reduce((a, b) => a + b.items.length, 0), batches: plan.batches.length, movers: plan.movers.reduce((a, m) => a + m.at.length, 0) }),
    dispose() { for (const g of geometries) g.dispose(); group.traverse((o) => { if (o.isInstancedMesh) o.dispose(); }); },
  };
}

const linear = (hex) => { _c.set(hex); return [_c.r, _c.g, _c.b]; };

// A height field: one vertex per grid point, triangles per cell (split along alternating diagonals), cells inside the
// hole left out.
function fieldGeometry(f, palette) {
  const nx = f.xs.length, nz = f.zs.length;
  const pos = new Float32Array(nx * nz * 3), col = new Float32Array(nx * nz * 3);
  const one = Array.isArray(f.color) ? null : linear(resolveColor(f.color, palette));
  const cache = new Map();
  const rgb = (c) => { if (!cache.has(c)) cache.set(c, linear(resolveColor(c, palette))); return cache.get(c); };
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i, c = one ?? rgb(f.color.length === 1 ? f.color[0] : f.color[k]), t = f.tone?.[k] ?? 1;
    pos.set([f.xs[i], f.h[k], f.zs[j]], k * 3);
    col.set([c[0] * t, c[1] * t, c[2] * t], k * 3);
  }
  const idx = [], hole = f.hole;
  for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const mx = (f.xs[i] + f.xs[i + 1]) / 2, mz = (f.zs[j] + f.zs[j + 1]) / 2;
    if (hole && mx > hole.minX && mx < hole.maxX && mz > hole.minZ && mz < hole.maxZ) continue;
    const a = j * nx + i, b = a + 1, d = a + nx, e = d + 1;
    if ((i + j) % 2) idx.push(a, d, e, a, e, b); else idx.push(a, d, b, b, d, e);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

// A ribbon: the points joined by quads of their half widths, facing up.
function stripGeometry(s, palette) {
  const c = linear(resolveColor(s.color, palette)), P = s.points;
  const pos = [], col = [], nor = [];
  const side = (i) => {
    const a = P[Math.max(0, i - 1)], b = P[Math.min(P.length - 1, i + 1)];
    const tx = b[0] - a[0], tz = b[2] - a[2], tl = Math.hypot(tx, tz) || 1, h = P[i][3];
    return [[P[i][0] + (tz / tl) * h, P[i][1], P[i][2] - (tx / tl) * h], [P[i][0] - (tz / tl) * h, P[i][1], P[i][2] + (tx / tl) * h]];
  };
  let prev = side(0);
  for (let i = 1; i < P.length; i++) {
    const cur = side(i);
    const [A, B] = prev, [C, D] = cur;
    // two triangles, wound to face up
    for (const tri of up(A, B, D) ? [[A, B, D], [A, D, C]] : [[A, D, B], [A, C, D]]) for (const v of tri) { pos.push(...v); col.push(...c); nor.push(0, 1, 0); }
    prev = cur;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.computeBoundingSphere();
  return g;
}
const up = (A, B, D) => (B[0] - A[0]) * (D[2] - A[2]) - (B[2] - A[2]) * (D[0] - A[0]) < 0;
