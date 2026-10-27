// The primitive kit: an object's build(k) records boxes and cylinders as plain data, so the lint, the footprint
// checks and the tests see exactly what will be drawn, and render turns the list into three.js meshes. Pure.
//
// A primitive's `at` is the centre of its BOTTOM face, in the object's frame (origin at the footprint's centre on the
// floor, front toward +z). `rot` is [rx, ry, rz] in radians about that point, applied Y, then X, then Z (three.js
// Euler order "YXZ").

/** @typedef {{ shape: "box"|"cyl", part: string, size: number[], at: number[], m: number[], color: string,
 *              finish: "matte"|"glow"|"glass", r?: number, top?: number, seg?: number, owner?: string }} Primitive */

// 3×3 rotation matrices, row-major.
export const IDENTITY = [1, 0, 0, 0, 1, 0, 0, 0, 1];
export function mul3(a, b) {
  const o = new Array(9);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) o[r * 3 + c] = a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c];
  return o;
}
export const apply3 = (m, [x, y, z]) => [m[0] * x + m[1] * y + m[2] * z, m[3] * x + m[4] * y + m[5] * z, m[6] * x + m[7] * y + m[8] * z];
export function rotY(t) { const c = Math.cos(t), s = Math.sin(t); return clean([c, 0, s, 0, 1, 0, -s, 0, c]); }
export function rotX(t) { const c = Math.cos(t), s = Math.sin(t); return clean([1, 0, 0, 0, c, -s, 0, s, c]); }
export function rotZ(t) { const c = Math.cos(t), s = Math.sin(t); return clean([c, -s, 0, s, c, 0, 0, 0, 1]); }
export const eulerYXZ = ([rx = 0, ry = 0, rz = 0] = []) => mul3(mul3(rotY(ry), rotX(rx)), rotZ(rz));
// Quarter turns give exact zeros and ones, so axis-aligned faces stay exactly axis-aligned.
function clean(m) { return m.map((v) => (Math.abs(v) < 1e-12 ? 0 : Math.abs(Math.abs(v) - 1) < 1e-12 ? Math.sign(v) : v)); }

export class Kit {
  constructor() {
    /** @type {Primitive[]} */
    this.prims = [];
  }

  // A box w × h × d standing on `at`.
  box(part, [w, h, d], at, color, { rot, finish = "matte" } = {}) {
    this.prims.push({ shape: "box", part, size: [w, h, d], at: [...at], m: eulerYXZ(rot), color, finish });
    return this;
  }

  // A cylinder of radius r (top radius `top`) and height h standing on `at`.
  cyl(part, r, h, at, color, { top = r, seg = 10, rot, finish = "matte" } = {}) {
    this.prims.push({ shape: "cyl", part, size: [2 * Math.max(r, top), h, 2 * Math.max(r, top)], r, top, seg, at: [...at], m: eulerYXZ(rot), color, finish });
    return this;
  }

  // A box that gives light (lamp shades, screens): drawn unlit, never darker at night.
  glow(part, size, at, color, opts = {}) {
    return this.box(part, size, at, color, { ...opts, finish: "glow" });
  }

  // A thin pane that lets light through (window glass).
  glass(part, size, at, color = "glass", opts = {}) {
    return this.box(part, size, at, color, { ...opts, finish: "glass" });
  }
}

// The primitive moved into a parent frame: turned by matrix `m` about the origin, then moved by `t`.
export function place(p, m, t, owner) {
  const a = apply3(m, p.at);
  return { ...p, at: [a[0] + t[0], a[1] + t[1], a[2] + t[2]], m: mul3(m, p.m), owner: owner ?? p.owner };
}

// The eight corners of a box primitive (or the bounding box of a cylinder), in its parent's frame.
export function corners(p) {
  const [w, h, d] = p.size;
  const out = [];
  for (const x of [-w / 2, w / 2]) for (const y of [0, h]) for (const z of [-d / 2, d / 2]) {
    const v = apply3(p.m, [x, y, z]);
    out.push([v[0] + p.at[0], v[1] + p.at[1], v[2] + p.at[2]]);
  }
  return out;
}

// The axis-aligned bounds of a primitive list: { min: [x, y, z], max: [x, y, z] }.
export function bounds(prims) {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const p of prims) for (const c of corners(p)) for (let i = 0; i < 3; i++) { min[i] = Math.min(min[i], c[i]); max[i] = Math.max(max[i], c[i]); }
  return { min, max };
}
