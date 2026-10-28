// Primitives to three.js meshes: each box or cylinder becomes flat-shaded triangles with vertex colours (palette
// tokens resolved, a baked darkening at the foot of vertical faces) and world-mapped UVs, merged into one mesh per
// material (finish and pattern).
import * as THREE from "three";
import { corners, apply3, BOX_FACES } from "../catalog/kit.js";
import { resolveColor } from "../catalog/palette.js";

const _c = new THREE.Color();
const FOOT = 0.14;   // metres above a part's base that the contact darkening fades over
const FOOT_DARK = 0.78;

class Bucket {
  constructor() { this.pos = []; this.nor = []; this.col = []; this.uv = []; }
  tri(a, b, c, n, rgb, shade) {
    for (const v of [a, b, c]) {
      this.pos.push(v[0], v[1], v[2]);
      this.nor.push(n[0], n[1], n[2]);
      const k = shade(v, n);
      this.col.push(rgb[0] * k, rgb[1] * k, rgb[2] * k);
      // world-mapped: floors by x and z, walls by their run and height; one repeat per metre
      const ax = Math.abs(n[0]), ay = Math.abs(n[1]);
      if (ay > 0.5) this.uv.push(v[0], -v[2]); else if (ax > 0.5) this.uv.push(v[2], v[1]); else this.uv.push(v[0], v[1]);
    }
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(this.uv, 2));
    g.computeBoundingSphere();
    return g;
  }
}

const linear = (hex) => { _c.set(hex); return [_c.r, _c.g, _c.b]; };

// Map "finish|pattern" (or "finish|pattern|outdoor", for parts marked outdoor) → BufferGeometry.
export function primsToGeometries(prims, palette) {
  const buckets = new Map();
  const bucket = (finish, pattern, outdoor) => {
    const key = `${finish}|${pattern && pattern !== "plain" ? pattern : ""}${outdoor ? "|outdoor" : ""}`;
    if (!buckets.has(key)) buckets.set(key, new Bucket());
    return buckets.get(key);
  };
  for (const p of prims) {
    const base = p.base ?? p.at[1]; // a wall cut at its bands darkens from the wall's foot, not each stretch's
    const shade = (v, n) => (p.finish === "glow" || p.finish === "light" || Math.abs(n[1]) > 0.5 ? 1 : FOOT_DARK + (1 - FOOT_DARK) * Math.min(1, (v[1] - base) / FOOT));
    if (p.shape === "box") {
      const c = corners(p);
      for (const f of BOX_FACES) {
        if (p.omit?.includes(f.key)) continue;
        const style = p.faces?.[f.key];
        const rgb = linear(resolveColor(style?.color ?? p.color, palette));
        const n = apply3(p.m, f.n);
        const [a, b, cc, d] = f.quad.map((k) => c[k]);
        const B = bucket(p.finish, style?.pattern, p.outdoor);
        B.tri(a, b, cc, n, rgb, shade);
        B.tri(a, cc, d, n, rgb, shade);
      }
    } else if (p.shape === "cyl") {
      const rgb = linear(resolveColor(p.color, palette));
      const B = bucket(p.finish, null, p.outdoor);
      const h = p.size[1], seg = p.seg;
      const pt = (r, y, i) => { const a = (i / seg) * Math.PI * 2; const v = apply3(p.m, [Math.cos(a) * r, y, Math.sin(a) * r]); return [v[0] + p.at[0], v[1] + p.at[1], v[2] + p.at[2]]; };
      const top = apply3(p.m, [0, 1, 0]), bottom = apply3(p.m, [0, -1, 0]);
      for (let i = 0; i < seg; i++) {
        const b0 = pt(p.r, 0, i), b1 = pt(p.r, 0, i + 1), t0 = pt(p.top, h, i), t1 = pt(p.top, h, i + 1);
        const e1 = sub(b1, b0), e2 = sub(t0, b0);
        const n = norm(cross(e2, e1));
        if (p.top > 0) { B.tri(b0, t0, t1, n, rgb, shade); }
        B.tri(b0, t1, b1, p.top > 0 ? n : norm(cross(sub(t1, b0), sub(b1, b0))), rgb, shade);
        const c0 = [p.at[0] + top[0] * h, p.at[1] + top[1] * h, p.at[2] + top[2] * h];
        if (p.top > 0) B.tri(c0, t1, t0, top, rgb, shade);
        if (!p.omit?.includes("-y")) B.tri([...p.at], b0, b1, bottom, rgb, shade);
      }
    }
  }
  const out = new Map();
  for (const [k, b] of buckets) out.set(k, b.geometry());
  return out;
}

// The material for a bucket key ("finish|pattern", with "|outdoor" for outdoor parts). outdoor: every part is.
export function materialFor(materials, key, outdoor = false) {
  const [finish, pattern, place] = key.split("|");
  return materials.get(finish, pattern || null, { outdoor: outdoor || place === "outdoor" });
}

// One group of meshes for a primitive list.
export function primsToGroup(prims, palette, materials, { cast = true, receive = true, name = "" } = {}) {
  const group = new THREE.Group();
  group.name = name;
  for (const [key, geo] of primsToGeometries(prims, palette)) {
    const [finish] = key.split("|");
    const mesh = new THREE.Mesh(geo, materialFor(materials, key));
    mesh.castShadow = cast && finish !== "glass" && finish !== "light";
    mesh.receiveShadow = receive && finish !== "glow" && finish !== "light";
    mesh.userData.finish = finish;
    group.add(mesh);
  }
  return group;
}

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(...a) || 1; return a.map((x) => x / l); };
