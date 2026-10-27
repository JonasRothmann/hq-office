// The coplanar lint: faces that lie in the same plane, face the same way and overlap. The GPU cannot tell which is
// in front, so they z-fight (flicker as the camera moves). Pure: it reads primitive lists, never three.js.
import { corners, apply3, BOX_FACES } from "../catalog/kit.js";

export const COPLANAR_EPS = 0.001;   // faces closer than 1 mm count as one plane
const MIN_AREA = 1e-6;               // m²: touching along an edge is not overlapping

// Every planar face of a primitive: { n: [x, y, z] outward, d: n·p, pts: [[x, y, z], ...] }.
export function facesOf(p) {
  if (p.shape === "box") {
    const c = corners(p);
    return BOX_FACES.filter((f) => !p.omit?.includes(f.key)).map((f) => {
      const n = apply3(p.m, f.n);
      const pts = f.quad.map((k) => c[k]);
      return { n, d: dot(n, pts[0]), pts };
    });
  }
  if (p.shape === "cyl") {
    const out = [];
    for (const [y, r, sign] of [[0, p.r, -1], [p.size[1], p.top, 1]]) {
      if (r <= 0) continue;
      const pts = [];
      for (let i = 0; i < p.seg; i++) {
        const a = (i / p.seg) * Math.PI * 2;
        const v = apply3(p.m, [Math.cos(a) * r, y, Math.sin(a) * r]);
        pts.push([v[0] + p.at[0], v[1] + p.at[1], v[2] + p.at[2]]);
      }
      const n = apply3(p.m, [0, sign, 0]);
      out.push({ n, d: dot(n, pts[0]), pts });
    }
    return out;
  }
  return [];
}

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

// The faces' points in 2D coordinates of their plane, ordered round their centre (faces are convex).
function flatten(pts, n) {
  const u = Math.abs(n[0]) < 0.9 ? norm(cross(n, [1, 0, 0])) : norm(cross(n, [0, 1, 0]));
  const v = cross(n, u);
  const flat = pts.map((p) => [dot(p, u), dot(p, v)]);
  const cx = flat.reduce((s, p) => s + p[0], 0) / flat.length, cy = flat.reduce((s, p) => s + p[1], 0) / flat.length;
  return flat.sort((a, b) => Math.atan2(a[1] - cy, a[0] - cx) - Math.atan2(b[1] - cy, b[0] - cx));
}
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(...a); return a.map((x) => x / l); };

function area(poly) {
  let s = 0;
  for (let i = 0; i < poly.length; i++) { const [x1, y1] = poly[i], [x2, y2] = poly[(i + 1) % poly.length]; s += x1 * y2 - x2 * y1; }
  return Math.abs(s) / 2;
}

// Sutherland-Hodgman: the part of convex `subject` inside convex `clip` (both counter-clockwise).
function clipPoly(subject, clip) {
  let out = subject;
  for (let i = 0; i < clip.length && out.length; i++) {
    const [ax, ay] = clip[i], [bx, by] = clip[(i + 1) % clip.length];
    const inside = ([x, y]) => (bx - ax) * (y - ay) - (by - ay) * (x - ax) >= -1e-12;
    const cut = ([px, py], [qx, qy]) => {
      const a1 = by - ay, b1 = ax - bx, c1 = a1 * ax + b1 * ay;
      const a2 = qy - py, b2 = px - qx, c2 = a2 * px + b2 * py;
      const det = a1 * b2 - a2 * b1;
      return [(b2 * c1 - b1 * c2) / det, (a1 * c2 - a2 * c1) / det];
    };
    const input = out;
    out = [];
    for (let j = 0; j < input.length; j++) {
      const p = input[j], q = input[(j + 1) % input.length];
      if (inside(q)) { if (!inside(p)) out.push(cut(p, q)); out.push(q); }
      else if (inside(p)) out.push(cut(p, q));
    }
  }
  return out;
}

/**
 * n: which part of that name it is, in build order (1, 2, ...), when the owner has more than one part of that name.
 * @typedef {{ owner?: string, part: string, n?: number }} CoplanarPart
 * @typedef {{ a: CoplanarPart, b: CoplanarPart, normal: number[], offset: number, area: number }} CoplanarPair
 */

// Pairs of same-facing faces closer than COPLANAR_EPS that overlap by more than MIN_AREA.
// Faces facing opposite ways (two boxes touching) are fine: one is always culled.
/** @returns {CoplanarPair[]} */
export function lintCoplanar(prims) {
  const faces = [];
  const named = new Map(), nth = [];
  for (const p of prims) { const k = `${p.owner ?? ""}|${p.part}`; named.set(k, (named.get(k) ?? 0) + 1); nth.push(named.get(k)); }
  const part = (i) => { const p = prims[i]; return { owner: p.owner, part: p.part, ...(named.get(`${p.owner ?? ""}|${p.part}`) > 1 ? { n: nth[i] } : {}) }; };
  prims.forEach((p, i) => { for (const f of facesOf(p)) faces.push({ ...f, i, key: f.n.map((x) => Math.round(x * 1e4)).join(","), box: boxOf(f.pts) }); });
  const groups = new Map();
  for (const f of faces) { if (!groups.has(f.key)) groups.set(f.key, []); groups.get(f.key).push(f); }
  const pairs = [];
  for (const group of groups.values()) {
    group.sort((a, b) => a.d - b.d);
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length && group[j].d - group[i].d < COPLANAR_EPS; j++) {
        const A = group[i], B = group[j];
        // every desk top in a lot lies in one plane: faces whose boxes are apart cannot overlap, so skip the clip
        if (A.i === B.i || apart(A.box, B.box)) continue;
        const pa = flatten(A.pts, A.n), pb = flatten(B.pts, A.n);
        const o = clipPoly(ccw(pa), ccw(pb));
        const ar = o.length >= 3 ? area(o) : 0;
        if (ar > MIN_AREA) {
          pairs.push({ a: part(A.i), b: part(B.i), normal: A.n.map((x) => +x.toFixed(3)), offset: +A.d.toFixed(4), area: +ar.toFixed(5) });
        }
      }
    }
  }
  return pairs;
}

// A face's bounding box, [min, max]; two boxes are apart when they miss each other on some axis by more than the
// plane tolerance (faces that touch along an edge still go to the clip, which finds no area).
function boxOf(pts) {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const p of pts) for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], p[k]); max[k] = Math.max(max[k], p[k]); }
  return [min, max];
}
const apart = ([amin, amax], [bmin, bmax]) => [0, 1, 2].some((k) => amax[k] < bmin[k] - COPLANAR_EPS || bmax[k] < amin[k] - COPLANAR_EPS);

function ccw(poly) {
  let s = 0;
  for (let i = 0; i < poly.length; i++) { const [x1, y1] = poly[i], [x2, y2] = poly[(i + 1) % poly.length]; s += x1 * y2 - x2 * y1; }
  return s < 0 ? [...poly].reverse() : poly;
}

const who = (x) => `${x.owner ? `${x.owner} ` : ""}'${x.part}'${x.n ? ` #${x.n}` : ""}`;

export function describePair(p) {
  return `${who(p.a)} and ${who(p.b)} share a plane (normal ${p.normal.join(",")}, offset ${p.offset}) over ${p.area} m²`;
}

/** One line per two parts that clash, however many planes they share (#n names a part whose name repeats). */
export function describePairs(pairs) {
  const by = new Map();
  for (const p of pairs) { const k = `${who(p.a)}|${who(p.b)}`; if (by.has(k)) by.get(k).more++; else by.set(k, { p, more: 0 }); }
  return [...by.values()].map(({ p, more }) => describePair(p) + (more ? `, and ${more} more plane${more > 1 ? "s" : ""}` : ""));
}
