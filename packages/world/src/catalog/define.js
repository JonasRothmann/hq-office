// The catalog: defineObject (one object, opening or finish), definePack (a named list of them) and createCatalog (the
// objects one world can use, ids prefixed by pack). There is no global registry: each world builds its own catalog
// from the packs it names, so load order never matters and two packs cannot silently claim one id. A pack's colour
// tokens are its own: stored as "<pack>/<token>" for light and dark, so two packs never overwrite each other's. Pure.
import { Kit, bounds } from "./kit.js";
import { PALETTES, isHex } from "./palette.js";
import { problem, closest } from "../model/problems.js";
import { CLIPS, clipProblem } from "../anim/clips.js";
import { lintCoplanar, describePairs } from "../lint/coplanar.js";
import { WALL_H, WALL_T, SIDES } from "../model/grid.js";

const KINDS = ["object", "opening", "floor", "wall"];
const PATTERNS = ["plain", "planks", "tiles", "boards", "battens"];
const MAX_SIZE = 6; // metres: anything larger is almost certainly centimetres

/**
 * @typedef {object} SlotDef
 * @property {[number, number]} at        where the user ends up, metres in the object's frame
 * @property {"n"|"e"|"s"|"w"} facing    which way the user faces, in the object's frame ("s" = toward its front)
 * @property {[number, number][]} stand  tiles (offsets from the slot's tile, object frame) to stand on first, in order
 * @property {string} clip               the clip the user loops there ("sit", "type", "idle")
 * @property {number} [y]                the user's root height there (a seat's height), metres above the floor
 */

/**
 * @typedef {object} ObjectDef
 * @property {string} id
 * @property {"object"|"opening"|"floor"|"wall"} kind
 * @property {[number, number]} [footprint]   tiles, before turning
 * @property {number} [height]
 * @property {boolean} [blocks]
 * @property {string[]} [tags]
 * @property {Record<string, SlotDef>} [slots]
 * @property {Record<string, [number, number, number]>} [anchors]
 * @property {boolean} [instance]
 * @property {{ far?: "box"|"hide" }} [lod]
 * @property {(k: Kit, params: object) => void} [build]
 * @property {number} [width]   an opening's hole width (metres)
 * @property {number} [sill]    an opening's bottom above the floor (0 for a door)
 * @property {number} [head]    an opening's top above the floor
 * @property {boolean} [passable] whether characters walk through an opening
 * @property {string} [color]   a finish's colour token
 * @property {"plain"|"planks"|"tiles"|"boards"|"battens"} [pattern]
 * @property {{ to: number, color: string, pattern?: string }[]} [bands]  a wall finish's bands from the floor up:
 *   each shows up to `to` metres above the floor top; the finish's own colour and pattern show above the last
 */

/** @stability stable  @returns {ObjectDef} */
export function defineObject(def) {
  const kind = def.kind ?? "object";
  const out = { kind, tags: [], ...def };
  if (kind === "object") Object.assign(out, { blocks: def.blocks ?? true, slots: def.slots ?? {}, anchors: def.anchors ?? {} });
  if (kind === "opening") Object.assign(out, { passable: def.passable ?? false, sill: def.sill ?? 0 });
  return Object.freeze(out);
}

/**
 * @typedef {{ light: Record<string, string>, dark: Record<string, string> }} PackPalette   token → hex, per theme
 * @typedef {{ id: string, objects: ObjectDef[], palette: PackPalette }} Pack
 */

// The tokens a pack's palette names (both themes).
const tokensOf = (palette) => [...new Set(Object.values(themesOf(palette)).flatMap((m) => Object.keys(m)))];
// { light, dark } as given; a flat map (the old form, which checkPack reports) stands for both.
const themesOf = (palette = {}) => (palette.light || palette.dark ? { light: palette.light ?? {}, dark: palette.dark ?? {} } : { light: palette, dark: palette });

/**
 * A pack: its objects with ids prefixed by the pack's id, and its palette: { light: { token: hex }, dark: {...} }.
 * Objects and finishes in the pack name their own tokens bare ("cushion"); they resolve to "<pack>/cushion".
 * @stability stable  @returns {Pack}
 */
export function definePack({ id, objects, palette = { light: {}, dark: {} } }) {
  const own = Object.freeze(tokensOf(palette));
  const local = (c) => (typeof c === "string" && own.includes(c) ? `${id}/${c}` : c);
  return Object.freeze({
    id, palette,
    objects: objects.map((o) => Object.freeze({
      ...o, id: o.id.includes("/") ? o.id : `${id}/${o.id}`, pack: id, tokens: own, ...(o.color ? { color: local(o.color) } : {}),
      ...(Array.isArray(o.bands) ? { bands: o.bands.map((b) => (b && typeof b === "object" ? { ...b, color: local(b.color) } : b)) } : {}),
    })),
  });
}

/**
 * @typedef {object} Catalog
 * @property {(id: string) => ObjectDef|undefined} get
 * @property {(id: string) => boolean} has
 * @property {(filter?: { kind?: string, tag?: string }) => ObjectDef[]} list
 * @property {(theme: string) => Record<string, string>} palette
 * @property {object[]} problems
 */

/** @stability stable  @returns {Catalog} */
export function createCatalog(packs) {
  const byId = new Map(), problems = [];
  const extra = { light: {}, dark: {} };
  packs.forEach((pack, pi) => {
    if (!pack?.id || !Array.isArray(pack.objects)) {
      problems.push(problem("pack.shape", `packs[${pi}]`, "this is not a pack", "import a pack's index.js (its default export is definePack({ id, objects }))"));
      return;
    }
    for (const o of pack.objects) {
      if (byId.has(o.id)) problems.push(problem("catalog.duplicate", `packs[${pi}]`, `${o.id} is defined by pack '${byId.get(o.id).pack}' and again by pack '${pack.id}'`, "rename one of them; ids are per pack, so two packs never need the same id"));
      else byId.set(o.id, o);
    }
    for (const [theme, map] of Object.entries(themesOf(pack.palette))) for (const [k, v] of Object.entries(map)) extra[theme][`${pack.id}/${k}`] = v;
  });
  return {
    get: (id) => byId.get(id),
    has: (id) => byId.has(id),
    ids: () => [...byId.keys()],
    list: ({ kind, tag } = {}) => [...byId.values()].filter((o) => (!kind || o.kind === kind) && (!tag || o.tags.includes(tag))),
    palette: (theme = "light") => ({ ...(PALETTES[theme] ?? PALETTES.light), ...(extra[theme] ?? extra.light) }),
    problems,
  };
}

// The primitives an object or opening builds, in its own frame; a bare token the object's pack defines becomes
// "<pack>/<token>".
export function buildPrims(def, params = {}) {
  const k = new Kit();
  def.build?.(k, params);
  if (!def.tokens?.length) return k.prims;
  const local = (c) => (def.tokens.includes(c) ? `${def.pack}/${c}` : c);
  return k.prims.map((p) => ({ ...p, color: local(p.color), ...(p.faces ? { faces: Object.fromEntries(Object.entries(p.faces).map(([f, st]) => [f, { ...st, color: local(st.color) }])) } : {}) }));
}

// "Did you mean" for an unknown catalog id.
export function suggest(catalog, id, kind) {
  const ids = catalog.list(kind ? { kind } : {}).map((o) => o.id);
  const near = closest(id, ids);
  return near.length ? `did you mean ${near.join(" or ")}?` : `known ${kind ?? ""} ids: ${ids.slice(0, 12).join(", ")}`;
}

// Everything wrong with a pack's definitions: its palette, shapes, footprints, colour tokens, slots and their clips,
// coplanar parts. Pure; the file listing is checked by tools/check.ts and the pack test, which can read the folder.
// The result is kept per pack (packs are frozen), so validating a world again costs nothing.
const checked = new WeakMap();
/** @stability stable */
export function checkPack(pack) {
  if (pack && typeof pack === "object" && checked.has(pack)) return checked.get(pack);
  const out = packProblems(pack);
  if (pack && typeof pack === "object") checked.set(pack, out);
  return out;
}

function packProblems(pack) {
  const out = [];
  const pal = pack.palette ?? {};
  if (Object.keys(pal).length && !(pal.light && pal.dark)) out.push(problem("pack.palette", `${pack.id}.palette`, "the palette is not split by theme", `write palette: { light: { token: "#hex" }, dark: { token: "#hex" } }; a token needs a colour in both`));
  else {
    const light = Object.keys(pal.light ?? {}), dark = Object.keys(pal.dark ?? {});
    for (const t of light.filter((t) => !dark.includes(t))) out.push(problem("pack.palette", `${pack.id}.palette.dark`, `token '${t}' has a light colour but no dark one`, `add ${JSON.stringify(t)}: "#hex" to palette.dark`));
    for (const t of dark.filter((t) => !light.includes(t))) out.push(problem("pack.palette", `${pack.id}.palette.light`, `token '${t}' has a dark colour but no light one`, `add ${JSON.stringify(t)}: "#hex" to palette.light`));
    for (const [theme, map] of Object.entries(pal)) for (const [t, v] of Object.entries(map ?? {})) if (!isHex(v)) out.push(problem("pack.palette", `${pack.id}.palette.${theme}.${t}`, `${JSON.stringify(v)} is not a hex colour`, `write it as "#rrggbb"`));
  }
  // the tokens this pack's objects may name: the engine's, and the pack's own (bare, or with the pack's prefix)
  const own = tokensOf(pal);
  const known = new Set([...Object.keys(PALETTES.light), ...own.map((t) => `${pack.id}/${t}`)]);
  const colour = (c, where, part) => {
    if (typeof c !== "string" || isHex(c) || known.has(c)) return;
    const bare = c.startsWith(`${pack.id}/`) ? c.slice(pack.id.length + 1) : c;
    const near = closest(bare, [...Object.keys(PALETTES.light), ...own]);
    out.push(problem("color.token", where, `${part}colour '${c}' is not a palette token (it would draw magenta)`, near.length ? `did you mean ${near.join(" or ")}?` : `use a token from the engine's palette (src/catalog/palette.js) or add it to this pack's palette: { light: { ${JSON.stringify(bare)}: "#hex" }, dark: { ... } }`));
  };
  pack.objects.forEach((o, i) => {
    const at = `${pack.id}.objects[${i}] (${o.id})`;
    const local = o.id.split("/").pop();
    if (!/^[a-z0-9][a-z0-9-]*$/.test(local)) out.push(problem("object.id", at, `id '${local}' has characters other than a-z, 0-9 and -`, `rename it, for example '${local.toLowerCase().replace(/[^a-z0-9-]+/g, "-")}'`));
    if (!KINDS.includes(o.kind)) { out.push(problem("object.kind", at, `kind '${o.kind}' is not one of ${KINDS.join(", ")}`, "set kind to one of those")); return; }
    if (o.kind === "floor" || o.kind === "wall") {
      if (typeof o.color !== "string") out.push(problem("finish.color", at, "a finish needs a colour", `add color: "plaster" (a palette token) or a hex colour`));
      else colour(o.color, at, "");
      if (o.pattern && !PATTERNS.includes(o.pattern)) out.push(problem("finish.pattern", at, `pattern '${o.pattern}' is unknown`, `use one of ${PATTERNS.join(", ")}`));
      if (o.bands !== undefined) checkBands(o, at, colour, out);
      return;
    }
    if (typeof o.build !== "function") { out.push(problem("object.build", at, "no build(k) function", "add build(k) { k.box(\"part\", [w, h, d], [x, y, z], \"wood\"); }")); return; }
    let prims;
    try { prims = buildPrims(o); } catch (e) { out.push(problem("object.build", at, `build threw: ${e.message}`, "fix build so it runs with no params")); return; }
    for (const p of prims) {
      colour(p.color, `${at} part '${p.part}'`, "");
      for (const [face, st] of Object.entries(p.faces ?? {})) colour(st.color, `${at} part '${p.part}'`, `face ${face} `);
      if (p.size.some((s) => !(s > 0))) out.push(problem("prim.size", `${at} part '${p.part}'`, `size ${JSON.stringify(p.size)} has a zero or negative side`, "give every side a positive size in metres"));
      if (p.size.some((s) => s > MAX_SIZE)) out.push(problem("prim.units", `${at} part '${p.part}'`, `size ${JSON.stringify(p.size)} is over ${MAX_SIZE} m`, "sizes are metres, not centimetres: 45 cm is 0.45"));
    }
    if (o.kind === "object") checkObject(o, prims, at, out);
    else checkOpening(o, prims, at, out);
    for (const line of describePairs(lintCoplanar(prims))) out.push(problem("prim.coplanar", at, line, "they will z-fight (flicker); move one by at least 2 mm along the normal, or make a flat part a box at least 1 cm thick that stands on the other"));
  });
  return out;
}

function checkBands(o, at, colour, out) {
  const example = `bands: [{ to: 0.1, color: "oak-dark" }, { to: 0.8, color: "oak", pattern: "battens" }]`;
  if (o.kind !== "wall") { out.push(problem("finish.bands", at, "only a wall finish has bands", "remove bands, or make it kind: \"wall\"")); return; }
  if (!Array.isArray(o.bands)) { out.push(problem("finish.bands", at, "bands is not a list", `write ${example}, from the floor up`)); return; }
  let last = 0;
  o.bands.forEach((b, i) => {
    const where = `${at} band ${i}`;
    if (!b || typeof b !== "object") { out.push(problem("finish.bands", where, `${JSON.stringify(b)} is not a band`, `write { to: 0.8, color: "oak" }: to is metres above the floor`)); return; }
    if (typeof b.to !== "number" || !(b.to > last && b.to < WALL_H)) out.push(problem("finish.bands", where, `to ${JSON.stringify(b.to)} is not above the band under it (${last} m) and below the wall's top (${WALL_H} m)`, "list bands from the floor up, each to higher than the last, in metres (80 cm is 0.8)"));
    else last = b.to;
    if (typeof b.color !== "string") out.push(problem("finish.bands", where, "a band needs a colour", `add color: "oak" (a palette token) or a hex colour`));
    else colour(b.color, where, "");
    if (b.pattern !== undefined && !PATTERNS.includes(b.pattern)) out.push(problem("finish.pattern", where, `pattern '${b.pattern}' is unknown`, `use one of ${PATTERNS.join(", ")}`));
  });
}

function checkObject(o, prims, at, out) {
  const [w, d] = o.footprint ?? [];
  if (!Number.isInteger(w) || !Number.isInteger(d) || w < 1 || d < 1 || w > MAX_SIZE || d > MAX_SIZE) {
    out.push(problem("object.footprint", at, `footprint ${JSON.stringify(o.footprint)} is not whole tiles`, "set footprint: [w, d] in whole tiles, for example [1, 1] or [2, 1]"));
    return;
  }
  const tol = 0.0005;
  for (const p of prims) {
    const b = bounds([p]);
    const over = [];
    if (b.min[0] < -w / 2 - tol || b.max[0] > w / 2 + tol) over.push(`x ${b.min[0].toFixed(3)}..${b.max[0].toFixed(3)} (footprint ±${w / 2})`);
    if (b.min[2] < -d / 2 - tol || b.max[2] > d / 2 + tol) over.push(`z ${b.min[2].toFixed(3)}..${b.max[2].toFixed(3)} (footprint ±${d / 2})`);
    if (b.min[1] < -tol) over.push(`y starts at ${b.min[1].toFixed(3)}, below the floor`);
    if (over.length) out.push(problem("prim.outside", `${at} part '${p.part}'`, `reaches past its footprint: ${over.join("; ")}`, "shrink or move the part (at is the centre of its BOTTOM face, in metres from the footprint's centre), or widen the footprint"));
  }
  const top = prims.length ? bounds(prims).max[1] : 0;
  if (o.height !== undefined && top > o.height + 0.01) out.push(problem("object.height", at, `parts reach ${top.toFixed(2)} m, above height ${o.height}`, `set height: ${Math.ceil(top * 100) / 100}`, "warning"));
  for (const [name, s] of Object.entries(o.slots ?? {})) {
    const sp = `${at} slot '${name}'`;
    if (!Array.isArray(s.at) || Math.abs(s.at[0]) > w / 2 || Math.abs(s.at[1]) > d / 2) out.push(problem("slot.at", sp, `at ${JSON.stringify(s.at)} is outside the footprint`, `put it within ±${w / 2}, ±${d / 2}`));
    if (!SIDES.includes(s.facing)) out.push(problem("slot.facing", sp, `facing '${s.facing}' is not n, e, s or w`, "facing is in the object's frame: \"s\" faces the object's front"));
    if (!Array.isArray(s.stand) || !s.stand.length) out.push(problem("slot.stand", sp, "no stand tiles", "add stand: [[0, 1]] (the tile in front), and side tiles as fallbacks"));
    else if (o.blocks && w === 1 && d === 1 && s.stand.some(([x, z]) => x === 0 && z === 0)) out.push(problem("slot.stand", sp, "a stand tile is the object's own tile, which blocks walking", "stand on a neighbouring tile, such as [0, 1]"));
    if (typeof s.clip !== "string") out.push(problem("slot.clip", sp, "no clip", "add clip: \"sit\", \"type\" or \"idle\""));
    else if (!CLIPS[s.clip]) out.push(clipProblem(s.clip, `${sp}.clip`));
  }
}

function checkOpening(o, prims, at, out) {
  const room = 1 - WALL_T;
  if (!(o.width > 0 && o.width <= room)) out.push(problem("opening.width", at, `width ${o.width} does not fit between the wall posts`, `use a width up to ${room} m`));
  if (!(o.head > o.sill && o.head <= WALL_H - 0.1)) out.push(problem("opening.head", at, `sill ${o.sill} and head ${o.head} do not make a hole in a ${WALL_H} m wall`, `keep 0 <= sill < head <= ${WALL_H - 0.1}`));
  for (const p of prims) {
    const b = bounds([p]);
    if (b.min[0] < -room / 2 - 0.0005 || b.max[0] > room / 2 + 0.0005) out.push(problem("prim.outside", `${at} part '${p.part}'`, `reaches x ${b.min[0].toFixed(3)}..${b.max[0].toFixed(3)}, into the wall posts (±${room / 2})`, "keep an opening's parts within its wall segment"));
  }
}
