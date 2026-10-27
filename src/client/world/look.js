// The world's look (Japandi): colour and material tokens per theme (day, night), status colours and poses.

// Status colours, shared with the UI (spec section 3).
export const STATUS = {
  needs_you: "#e5484d", blocked: "#e5484d", hq_turn: "#f5a524", waiting: "#3e63dd",
  moving: "#30a46c", done: "#12a594", parked: "#8b8d98", gone: "#8b8d98", stale: "#8b8d98",
};
export const MODEL = { opus: "#8e4ec6", sonnet: "#12a594", haiku: "#f5a524", other: "#8b8d98" };

// A subagent's family: the server's own word when it sent one, else read from the model id.
export function modelFamily(model = "", family = null) {
  if (family && family in MODEL) return family;
  const m = String(model).toLowerCase();
  return m.includes("opus") ? "opus" : m.includes("sonnet") ? "sonnet" : m.includes("haiku") ? "haiku" : "other";
}

// What a worker does for a status: the pose says it before the colour does.
//   work  seated, leaning in, typing          raise  standing beside the desk, facing the camera, hand up
//   fold  seated, leaning back, arms folded   lean   seated, leaning back, hands behind the head
//   mug   leaning back with a mug              sleep  slumped on the desk          away  chair empty
// Two more are not a status: walk (on the way to the break area and back) and sip (standing there with a mug).
export function poseOf(status) {
  switch (status) {
    case "moving": return "work";
    case "needs_you": case "blocked": return "raise";
    case "hq_turn": return "fold";
    case "waiting": return "lean";
    case "done": return "mug";
    case "stale": return "sleep";
    default: return "away";
  }
}

// The marker over a head: a round badge with a glyph and a short tail. Never a diamond. A lane that works while one
// of its questions blocks it keeps working and wears the red badge (spec B6, F7).
export function markerOf(status, blocking = 0) {
  switch (status) {
    case "needs_you": case "blocked": return { color: STATUS.needs_you, glyph: "!" };
    case "hq_turn": return { color: STATUS.hq_turn, glyph: "hq" };
    case "waiting": return { color: STATUS.waiting, glyph: "clock" };
    default: return blocking > 0 ? { color: STATUS.needs_you, glyph: "!" } : null;
  }
}

// People: skin, hair, a wardrobe in the Japandi palette (oat, sand, off-white, charcoal, smoked brown, and muted
// indigo, rust, sage, ochre), picked per lane by its name.
const PEOPLE = {
  skin: ["#f3cfb0", "#e8b892", "#d29a6e", "#b27a50", "#8a5a3a", "#5e3b26", "#f6dcc6"],
  hair: ["#2a1d15", "#4a3020", "#7a4b28", "#b07a3e", "#d9bf86", "#1d1d22", "#9a968f", "#8a4a2e", "#d8d2c4"],
  pants: ["#2e2f33", "#34405a", "#4a4f5c", "#c4b49a", "#5c6250", "#26272a", "#6b5646", "#d8ccb6"],
  tops: ["#a65a3c", "#c39a4e", "#5c6a4e", "#34405a", "#e2d8c6", "#94a088", "#b98b72", "#55657e", "#efe9dd", "#6b5442", "#7d4a36", "#4f5e60", "#cbb898", "#2f2f32"],
  shoes: ["#efe9dd", "#2b2b2e", "#6b4a33", "#efe9dd", "#7d4a36", "#c4b49a"],
};

// What the studio is made of: pale oak and ash, smoked oak, blackened steel, plaster, linen and wool, stone and
// ceramics, paper, a few muted earth colours, pots and greens (day; night keeps them). The old names stay where the
// props use them: walnut is the smoked oak, navy the indigo, mustard the ochre, forest the moss, chrome brushed steel.
const STUDIO = {
  oak: "#dbc49e", oakLight: "#e9dbbf", oakDark: "#6a5443", ply: "#e8dcc4", plyEdge: "#b49a76", walnut: "#4f3f33",
  plaster: "#f2ece2", warmGrey: "#d6cfc4", sand: "#d3c7b2", black: "#2b2a28", chrome: "#a9a7a1",
  oatmeal: "#ded3bf", wool: "#b9b1a4", rust: "#a65a3c", sage: "#94a088", mustard: "#c39a4e", navy: "#34405a",
  forest: "#5c6a4e", blush: "#c49a86", cord: "#d3c39c", felt: "#a39b8c", paper: "#f6efe0",
  charcoal: "#3a3937", stone: "#a8a196", clay: "#b98a6a", linen: "#e6ddcc", ink: "#26272a",
  pots: ["#b98a6a", "#ece6db", "#3d3b38", "#d2c4ac", "#8a7a68"],
  leaf: ["#5d7a4f", "#4d6b44", "#6b8757", "#43603f", "#7a9064"], leafPale: "#8fa874", olive: "#8a9a74",
  mugs: ["#efe9dd", "#a65a3c", "#34405a", "#c9bfae", "#94a088", "#3a3937"],
  spines: ["#34405a", "#a65a3c", "#e6dccb", "#c9b79c", "#94a088", "#3a3937", "#d8ccb6", "#6e6a63", "#7d4a36", "#efe9dd", "#5c6a4e", "#b8a78a", "#c39a4e", "#8f877a"],
};

const LOOK = {
  shirts: ["#e9e4da", "#3f4a5a", "#8aa39b", "#c9b79c", "#5c6f8a", "#d7a68a", "#2f3a33", "#b9c4cc"],
  day: {
    bg: "#9cb37c", ground: { base: "#9fb67d", alt: "#91a970", kind: "grass" },
    court: { base: "#e4ded1", alt: "#d3ccbc", kind: "raked" }, path: "#d9d2c3",
    plinth: "#cfc8ba",
    floor: {
      office: { base: "#e6d4b2", alt: "#dcc7a2", line: "#b49d7a", kind: "planks" },
      hq: { base: "#e6d4b2", alt: "#dcc7a2", line: "#b49d7a", kind: "planks" },
      // one-metre stone tiles with dark joints, so corridors read apart from the oak offices at the far zoom
      corridor: { base: "#d9d2c4", alt: "#c9c1b1", line: "#958b78", kind: "cement" },
      break: { base: "#e3dccf", alt: "#cdc3b2", line: "#a79b87", kind: "terrazzo" },
    },
    // warm white plaster over a band of pale oak battens to a smoked-oak rail at the window sills, a smoked skirting
    wall: { face: "#f2ece2", alt: "#e6ded0", trim: "#d8c39e", gap: "#6d5a46", rails: "#6a5443", rail: 0.8, kind: "band" },
    cladding: { base: "#3d3c38", alt: "#363531", line: "#252420", kind: "boards" },
    cap: "#4f4338",
    wood: "#dcc29a", woodEdge: "#c4a77a", steel: "#2b2b2e",
    chair: { seat: "#e9e4da", frame: "#2b2b2e" },
    rug: { base: "#cdc890", alt: "#c2bd84", line: "#4a4a3a", kind: "tatami" },
    plant: { leaf: "#5f8a5a", leaf2: "#4e7a4a", pot: "#efece6" },
    lantern: { paper: "#f6efe0", frame: "#3a3530" },
    shelf: "#d9c095", books: ["#3f4a5a", "#c9b79c", "#8aa39b", "#e9e4da", "#d7a68a"],
    screen: "#23262d", screenFrame: "#2b2b2e",
    counter: { top: "#f2efe8", body: "#dcc29a" }, sofa: "#c9c0ae", sofaCushion: "#d8d0bf",
    shoji: { frame: "#c4a77a", paper: "#f7f3e8" }, accent: "#a65a3c",
    tree: { leaf: "#b8442c", leaf2: "#d0603a", trunk: "#4a3a2e" },
    moon: null,
    light: { amb: "#fff8ef", ambI: 2.0, sky: "#fffaf2", ground: "#c8bca8", hemi: 0.75, key: "#fff4e4", keyI: 0.95, room: 0.0, shadow: 0.3 },
  },
  // A lawn under the moon, blue-lit and never black: `moon` is added to everything outdoors (ground, lot, courts).
  night: {
    bg: "#26374a", ground: { base: "#55805c", alt: "#4c7653", kind: "grass" },
    court: { base: "#6a6f78", alt: "#60656e", kind: "raked" }, path: "#4a4f5a",
    moon: "#3c5a80",
    light: { amb: "#3e5898", ambI: 1.0, sky: "#4a64a8", ground: "#1b2030", hemi: 0.45, key: "#8aa0d8", keyI: 0.35, room: 0.6, shadow: 0.0 },
  },
};

// The tokens for a theme: night keeps the day's materials (they are what things are made of) and changes the ground
// and the light, so lit offices glow among dark ones.
export function lookFor(theme = "light") {
  const night = theme === "dark";
  return { night, shirts: LOOK.shirts, people: PEOPLE, studio: STUDIO, ...LOOK.day, ...(night ? LOOK.night : {}) };
}

// A small stable hash, so a lane's looks (shirt, hair, poster) never change between loads.
export function hash(s) {
  let h = 2166136261;
  for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export const pick = (arr, h, salt = 0) => arr[(((h >>> (salt % 24)) ^ (salt * 2654435761)) >>> 0) % arr.length];

// An independent 32-bit draw per salt from one hash (a murmur-style finaliser), so a lane's picks do not move together.
export function draw(h, salt) {
  let x = (h ^ Math.imul(salt + 1, 0x9e3779b9)) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b) >>> 0;
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35) >>> 0;
  return (x ^ (x >>> 16)) >>> 0;
}

// What a worker wears and looks like, from its name: skin, hair (a colour and one of nine cuts), a top (sweater,
// shirt, hoodie, tee, cardigan, breton stripes, blazer) in a colour, trousers, shoes, and now and then glasses, a
// beard, freckles, a beanie or headphones round the neck. L: the theme's tokens (lookFor).
export function appearance(name, L) {
  const h = hash(name), P = L.people;
  const r = (salt, n) => draw(h, salt) % n;
  const one = (arr, salt) => arr[r(salt, arr.length)];
  const hairStyle = r(3, 9);
  const top = one(["sweater", "shirt", "hoodie", "tee", "cardigan", "stripes", "sweater", "blazer", "tee"], 7);
  const skin = one(P.skin, 1);
  let hair = one(P.hair, 5);
  if (P.skin.indexOf(skin) >= 4 && ["#d9bf86", "#b07a3e", "#8a4a2e", "#d8d2c4"].includes(hair)) hair = "#1d1d22";
  const topColor = one(P.tops, 9);
  let inner = one(["#efe9dd", "#2f2f32", "#c39a4e", "#e2d8c6"], 17);
  if (inner === topColor) inner = "#efe9dd";
  let pants = one(P.pants, 13);
  if (pants === topColor) pants = P.pants[(P.pants.indexOf(pants) + 1) % P.pants.length];
  return {
    skin, hair, hairStyle,
    beard: [0, 6, 7, 8].includes(hairStyle) && r(11, 3) === 0,
    glasses: r(13, 4) === 0 ? one(["#26272a", "#6b4a33", "#4f3f33"], 19) : null,
    freckles: r(15, 5) === 0 && P.skin.indexOf(skin) <= 1,
    lashes: [1, 2, 3, 5].includes(hairStyle),
    beanie: r(21, 10) === 0 ? one(["#a65a3c", "#c39a4e", "#34405a", "#5c6a4e", "#d8ccb6"], 23) : null,
    top, topColor, inner, pants,
    shoes: one(P.shoes, 15),
    stripe: one(["#34405a", "#a65a3c", "#2f2f32"], 25),
    headphones: r(17, 5) === 0,
  };
}
