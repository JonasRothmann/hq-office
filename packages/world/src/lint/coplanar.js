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
  const named = new Map(), nth = [];
  for (const p of prims) { const k = `${p.owner ?? ""}|${p.part}`; named.set(k, (named.get(k) ?? 0) + 1); nth.push(named.get(k)); }
  const part = (i) => { const p = prims[i]; return { owner: p.owner, part: p.part, ...(named.get(`${p.owner ?? ""}|${p.part}`) > 1 ? { n: nth[i] } : {}) }; };
  return clashes(prims).map(({ i, j, ...rest }) => ({ a: part(i), b: part(j), ...rest }));
}

// The clashes by primitive index ({ i, j, normal, offset, area }), in the lint's order. candidates picks a sorted
// group's pairs to clip: nearPairs, or allPairs (the plain scan, which the tests compare it with).
export function clashes(prims, candidates = nearPairs) {
  const faces = [];
  prims.forEach((p, i) => { for (const f of facesOf(p)) { f.i = i; f.key = `${Math.round(f.n[0] * 1e4)},${Math.round(f.n[1] * 1e4)},${Math.round(f.n[2] * 1e4)}`; f.box = boxOf(f.pts); faces.push(f); } });
  const groups = new Map();
  for (const f of faces) { if (!groups.has(f.key)) groups.set(f.key, []); groups.get(f.key).push(f); }
  const out = [];
  for (const group of groups.values()) {
    group.sort((a, b) => a.d - b.d);
    for (const [i, j] of candidates(group)) {
      const A = group[i], B = group[j];
      const o = clipPoly(ccw(flatten(A.pts, A.n)), ccw(flatten(B.pts, A.n)));
      const ar = o.length >= 3 ? area(o) : 0;
      if (ar > MIN_AREA) out.push({ i: A.i, j: B.i, normal: A.n.map((x) => +x.toFixed(3)), offset: +A.d.toFixed(4), area: +ar.toFixed(5) });
    }
  }
  return out;
}

// The plain scan: every pair of faces of two primitives closer than COPLANAR_EPS whose boxes meet.
export function allPairs(group) {
  const out = [];
  for (let i = 0; i < group.length; i++) {
    for (let j = i + 1; j < group.length && group[j].d - group[i].d < COPLANAR_EPS; j++) {
      if (group[i].i !== group[j].i && !apart(group[i].box, group[j].box)) out.push([i, j]);
    }
  }
  return out;
}

// The pairs [i, j] (i < j, ascending) of a group sorted by d that may overlap: closer than COPLANAR_EPS in d, of two
// primitives, with boxes neither apart nor meeting only at an edge. Every desk top of a lot lies in one plane, so comparing all of a plane's faces
// is quadratic; instead the group is cut into runs of nearly equal d (a pair always falls in one run), and each run
// is swept along the in-plane axis it spreads most on, comparing a face only with those whose span there meets its.
// The clashes are the same as allPairs gives, in the same order (lint.test.ts).
function nearPairs(group) {
  const out = [];
  for (let s = 0; s < group.length;) {
    let e = s + 1;
    while (e < group.length && group[e].d - group[e - 1].d < COPLANAR_EPS) e++;
    if (e - s > 1) sweepRun(group, s, e, out);
    s = e;
  }
  return out.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
}

function sweepRun(group, s, e, out) {
  const spread = [0, 1, 2].map((k) => {
    let lo = Infinity, hi = -Infinity;
    for (let i = s; i < e; i++) { lo = Math.min(lo, group[i].box[0][k]); hi = Math.max(hi, group[i].box[1][k]); }
    return hi - lo;
  });
  const ax = spread.indexOf(Math.max(...spread));
  const order = [];
  for (let i = s; i < e; i++) order.push(i);
  order.sort((a, b) => group[a].box[0][ax] - group[b].box[0][ax]);
  for (let x = 0; x < order.length; x++) {
    const A = group[order[x]];
    for (let y = x + 1; y < order.length; y++) {
      const B = group[order[y]];
      if (B.box[0][ax] > A.box[1][ax] + COPLANAR_EPS) break;
      if (A.i === B.i || Math.abs(A.d - B.d) >= COPLANAR_EPS || apart(A.box, B.box) || meetOnlyAtEdge(A, B)) continue;
      out.push(order[x] < order[y] ? [order[x], order[y]] : [order[y], order[x]]);
    }
  }
}

// A face's bounding box, [min, max]; two boxes are apart when they miss each other on some axis by more than the
// plane tolerance (faces that touch along an edge still go to the clip, which finds no area).
function boxOf(pts) {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const p of pts) for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], p[k]); max[k] = Math.max(max[k], p[k]); }
  return [min, max];
}
function apart([amin, amax], [bmin, bmax]) {
  for (let k = 0; k < 3; k++) if (amax[k] < bmin[k] - COPLANAR_EPS || bmax[k] < amin[k] - COPLANAR_EPS) return true;
  return false;
}

// Two faces square to an axis are rectangles in their boxes, so what they share is the boxes' overlap in the other
// two axes. Under half of MIN_AREA (faces that meet along an edge: stacked wall stretches, a post beside its wall)
// they cannot overlap, and the clip is skipped. A turned object's normals are off an axis by about 1e-16.
const SQUARE = 1 - 1e-9;
function meetOnlyAtEdge(A, B) {
  const k = A.n.findIndex((x) => Math.abs(x) > SQUARE);
  if (k < 0 || !(Math.abs(B.n[k]) > SQUARE)) return false;
  let shared = 1;
  for (let a = 0; a < 3; a++) if (a !== k) shared *= Math.max(0, Math.min(A.box[1][a], B.box[1][a]) - Math.max(A.box[0][a], B.box[0][a]));
  return shared < MIN_AREA / 2;
}

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
