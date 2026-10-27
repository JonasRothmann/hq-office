// Scenery, pure: the land round a lot as data (pieces placed freely, height fields, ribbons, movers on loops), checked
// against a catalog and planned into batches; where each mover is at a time. The scenery is drawn but never walked,
// picked or linted with the lot. render/scenery.js draws the plan; the driver keeps its clock (view/driver.js).

import { problem } from "../model/problems.js";
import { isHex } from "../catalog/palette.js";
import { suggest } from "../catalog/define.js";

/**
 * @typedef {{ minX: number, minZ: number, maxX: number, maxZ: number }} Box
 * @typedef {object} SceneryPiece   one copy of a scenery object (kind "scenery")
 * @property {string} type                     its catalog id
 * @property {[number, number, number]} at     where its origin stands, metres in the lot's frame
 * @property {number} [ry]                     its turn about y, radians (its front, +z, turns toward +x)
 * @property {number | [number, number, number]} [s]   its scale, one number or per axis
 * @property {string} [tint]                   a palette token or hex that multiplies its colours (white parts take it)
 * @property {object} [params]                 passed to the object's build(k, params); each set of params is a batch
 * @property {boolean} [shadow]                it casts shadows (default false; the sun's shadows cover `shade`)
 * @typedef {object} SceneryField   a height field: a grid of vertices, one height and colour each
 * @property {number[]} xs                     the grid's x lines, ascending
 * @property {number[]} zs                     the grid's z lines, ascending
 * @property {number[]} h                      heights, row by row (z outer, x inner): xs.length × zs.length
 * @property {string[]} color                  a palette token or hex per vertex, or one for all
 * @property {number[]} [tone]                 a brightness per vertex (1 is as is)
 * @property {Box} [hole]                      cells whose middle lies inside are left out (the lot)
 * @typedef {object} SceneryStrip   a ribbon along a line: a path, a river
 * @property {[number, number, number, number][]} points   x, y, z and the half width there
 * @property {string} color
 * @property {"matte"|"glass"|"glow"} [finish]           glass outdoors is water: nearly opaque, no shadow
 * @typedef {object} SceneryMover   copies of an object that go round a loop at a steady speed
 * @property {string} type
 * @property {[number, number, number][]} route           a closed loop of points (the last joins the first)
 * @property {number} speed                               metres a second
 * @property {number[]} at                                each copy's start, metres along the loop
 * @property {string | string[]} [tint]                   one for all, or one per copy
 * @property {object} [params]
 * @typedef {object} Scenery
 * @property {string} [id]
 * @property {SceneryPiece[]} [pieces]
 * @property {SceneryField[]} [fields]
 * @property {SceneryStrip[]} [strips]
 * @property {SceneryMover[]} [movers]
 * @property {{ box: Box, from: number, to: number }} [fade]   fade into the background from `from` to `to` metres
 *   outside `box`
 * @property {Box} [shade]       the ground the sun's shadows cover, besides the lot (it costs shadow detail)
 * @property {boolean} [ground]  the scenery draws the land round the lot, so the engine leaves out its own
 */

const finite = (v) => typeof v === "number" && Number.isFinite(v);
const triple = (v) => Array.isArray(v) && v.length === 3 && v.every(finite);
const isBox = (b) => b && ["minX", "minZ", "maxX", "maxZ"].every((k) => finite(b[k])) && b.maxX > b.minX && b.maxZ > b.minZ;
const FINISHES = ["matte", "glass", "glow"];

/**
 * Everything wrong with a scenery, against the catalog of the world it surrounds. Every problem names the path (such
 * as `scenery.pieces[3].type`) and a fix.
 * @stability experimental  @returns {import("../model/problems.js").Problem[]}
 */
export function checkScenery(scenery, catalog) {
  const out = [];
  if (!scenery || typeof scenery !== "object") return [problem("scenery.shape", "scenery", "the scenery is not an object", "pass { pieces: [{ type, at: [x, y, z] }] }, or null for none")];
  const tokens = new Set(Object.keys(catalog.palette("light")));
  const colour = (c, where) => {
    if (typeof c === "string" && (isHex(c) || tokens.has(c))) return;
    out.push(problem("scenery.color", where, `${JSON.stringify(c)} is not a palette token or a hex colour`, "use a token a pack names (\"<pack>/<token>\") or \"#rrggbb\""));
  };
  const type = (t, where) => {
    const def = catalog.get(t);
    if (!def) { out.push(problem("scenery.type", where, `'${t}' is not in the catalog`, suggest(catalog, String(t), "scenery"))); return; }
    if (def.kind !== "scenery") out.push(problem("scenery.type", where, `'${t}' is a ${def.kind}, not a scenery piece`, "define it with defineObject({ kind: \"scenery\", ... })"));
  };
  const list = (k) => {
    if (scenery[k] === undefined) return [];
    if (Array.isArray(scenery[k])) return scenery[k];
    out.push(problem("scenery.shape", `scenery.${k}`, `${k} is not a list`, `write ${k}: [...]`));
    return [];
  };
  list("pieces").forEach((p, i) => {
    const at = `scenery.pieces[${i}]`;
    type(p?.type, `${at}.type`);
    if (!triple(p?.at)) out.push(problem("scenery.at", `${at}.at`, `at ${JSON.stringify(p?.at)} is not [x, y, z]`, "write at: [x, y, z] in metres, in the lot's frame"));
    if (p?.ry !== undefined && !finite(p.ry)) out.push(problem("scenery.ry", `${at}.ry`, `ry ${JSON.stringify(p.ry)} is not a number`, "ry is a turn about y in radians"));
    if (p?.s !== undefined && !(finite(p.s) && p.s > 0) && !(triple(p.s) && p.s.every((v) => v > 0))) out.push(problem("scenery.s", `${at}.s`, `s ${JSON.stringify(p.s)} is not a positive scale`, "write s: 1.2, or s: [sx, sy, sz]"));
    if (p?.tint !== undefined) colour(p.tint, `${at}.tint`);
  });
  list("fields").forEach((f, i) => {
    const at = `scenery.fields[${i}]`;
    const ok = Array.isArray(f?.xs) && Array.isArray(f?.zs) && f.xs.length > 1 && f.zs.length > 1;
    if (!ok) { out.push(problem("scenery.field", at, "xs and zs are not lists of two or more lines", "write xs: [x0, x1, ...], zs: [z0, z1, ...], ascending")); return; }
    const n = f.xs.length * f.zs.length;
    if (!Array.isArray(f.h) || f.h.length !== n || !f.h.every(finite)) out.push(problem("scenery.field", `${at}.h`, `h has ${f.h?.length} heights, not ${n} (xs × zs)`, "give one height per vertex, row by row: z outer, x inner"));
    const colours = Array.isArray(f.color) ? f.color : [f.color];
    if (colours.length !== 1 && colours.length !== n) out.push(problem("scenery.field", `${at}.color`, `color has ${colours.length} entries, not 1 or ${n}`, "give one colour, or one per vertex"));
    for (const c of new Set(colours)) colour(c, `${at}.color`);
    if (f.tone !== undefined && (!Array.isArray(f.tone) || f.tone.length !== n)) out.push(problem("scenery.field", `${at}.tone`, `tone has ${f.tone?.length} entries, not ${n}`, "give one brightness per vertex, or leave tone out"));
    if (f.hole !== undefined && !isBox(f.hole)) out.push(problem("scenery.field", `${at}.hole`, "hole is not a box", "write hole: { minX, minZ, maxX, maxZ }"));
  });
  list("strips").forEach((s, i) => {
    const at = `scenery.strips[${i}]`;
    if (!Array.isArray(s?.points) || s.points.length < 2 || !s.points.every((p) => Array.isArray(p) && p.length === 4 && p.every(finite))) out.push(problem("scenery.strip", `${at}.points`, "points is not a list of two or more [x, y, z, half]", "write points: [[x, y, z, halfWidth], ...]"));
    colour(s?.color, `${at}.color`);
    if (s?.finish !== undefined && !FINISHES.includes(s.finish)) out.push(problem("scenery.strip", `${at}.finish`, `finish '${s.finish}' is unknown`, `use one of ${FINISHES.join(", ")}`));
  });
  list("movers").forEach((m, i) => {
    const at = `scenery.movers[${i}]`;
    type(m?.type, `${at}.type`);
    if (!Array.isArray(m?.route) || m.route.length < 2 || !m.route.every(triple)) out.push(problem("scenery.route", `${at}.route`, "route is not a loop of two or more [x, y, z]", "write route: [[x, y, z], ...]; the last point joins the first"));
    else if (!(loopOf(m.route).length > 0)) out.push(problem("scenery.route", `${at}.route`, "the route has no length", "give points that are apart"));
    if (!finite(m?.speed)) out.push(problem("scenery.speed", `${at}.speed`, `speed ${JSON.stringify(m?.speed)} is not a number`, "speed is metres a second"));
    if (!Array.isArray(m?.at) || !m.at.every(finite)) out.push(problem("scenery.at", `${at}.at`, "at is not a list of numbers", "at: one start per copy, in metres along the route"));
    const tints = m?.tint === undefined ? [] : Array.isArray(m.tint) ? m.tint : [m.tint];
    if (Array.isArray(m?.tint) && Array.isArray(m?.at) && m.tint.length !== m.at.length) out.push(problem("scenery.tint", `${at}.tint`, `${m.tint.length} tints for ${m.at.length} copies`, "give one tint, or one per copy"));
    for (const c of new Set(tints)) colour(c, `${at}.tint`);
  });
  if (scenery.fade !== undefined && !(isBox(scenery.fade?.box) && finite(scenery.fade.from) && finite(scenery.fade.to) && scenery.fade.to > scenery.fade.from)) out.push(problem("scenery.fade", "scenery.fade", "fade is not { box, from, to } with to past from", "write fade: { box: { minX, minZ, maxX, maxZ }, from: 30, to: 60 }"));
  if (scenery.shade !== undefined && !isBox(scenery.shade)) out.push(problem("scenery.shade", "scenery.shade", "shade is not a box", "write shade: { minX, minZ, maxX, maxZ }"));
  return out;
}

/**
 * The scenery as the renderer draws it: pieces grouped into batches (one per type, params and shadow), each an
 * instanced mesh; the movers with their loops measured. Assumes checkScenery found no errors.
 * @stability experimental
 */
export function planScenery(scenery) {
  const batches = new Map();
  for (const p of scenery.pieces ?? []) {
    const shadow = !!p.shadow;
    const key = `${p.type}|${p.params ? JSON.stringify(p.params) : ""}|${shadow ? 1 : 0}`;
    if (!batches.has(key)) batches.set(key, { key, type: p.type, params: p.params ?? {}, shadow, items: [] });
    batches.get(key).items.push({ at: p.at, ry: p.ry ?? 0, s: scaleOf(p.s), tint: p.tint ?? null });
  }
  const movers = (scenery.movers ?? []).map((m, i) => {
    const loop = loopOf(m.route);
    const tints = m.tint === undefined ? null : Array.isArray(m.tint) ? m.tint : m.at.map(() => m.tint);
    return { key: `mover:${i}:${m.type}`, type: m.type, params: m.params ?? {}, speed: m.speed, at: m.at, tints, ...loop };
  });
  return {
    batches: [...batches.values()], movers,
    fields: scenery.fields ?? [], strips: scenery.strips ?? [],
    fade: scenery.fade ?? null, shade: scenery.shade ?? null, ground: !!scenery.ground,
  };
}

const scaleOf = (s) => (s === undefined ? [1, 1, 1] : typeof s === "number" ? [s, s, s] : s);

// A closed loop's points and the distance to each along it: { points, cum, length }.
function loopOf(route) {
  const points = route.map((p) => [...p]);
  if (points.length > 2 && same(points[0], points.at(-1))) points.pop();
  const cum = [0];
  for (let i = 1; i <= points.length; i++) {
    const a = points[i - 1], b = points[i % points.length];
    cum.push(cum[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]));
  }
  return { points, cum, length: cum.at(-1) };
}
const same = (a, b) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];

/**
 * Where each copy of a planned mover is at time t (seconds): [x, y, z, ry] per copy, ry turning its front (+z) along
 * the loop. A copy starts at its `at` and goes round at the mover's speed, for ever.
 * @stability experimental  @returns {[number, number, number, number][]}
 */
export function moverPlaces(mover, t) {
  const { points, cum, length, speed } = mover;
  return mover.at.map((start) => {
    const d = ((((start + speed * t) % length) + length) % length);
    let lo = 0, hi = points.length - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (cum[mid] <= d) lo = mid; else hi = mid - 1; }
    const a = points[lo], b = points[(lo + 1) % points.length], seg = cum[lo + 1] - cum[lo] || 1, k = (d - cum[lo]) / seg;
    return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k, Math.atan2(b[0] - a[0], b[2] - a[2]) + (speed < 0 ? Math.PI : 0)];
  });
}
