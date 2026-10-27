// The world's look (Nordic-Japanese): colour and material tokens per theme (day, night), status colours and poses.

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

// People: skin, hair and trousers, picked per lane by its name.
const PEOPLE = {
  skin: ["#f1c9a5", "#e0ac83", "#c68a5e", "#9a6440", "#6e4529", "#f6d7bd"],
  hair: ["#2a1d15", "#4a3020", "#7a4b28", "#c08a4a", "#e2c27a", "#1d1d22", "#8c8c94", "#a33a2a"],
  pants: ["#33384a", "#4b4f5c", "#5c4a3a", "#2d3e50", "#6b6f58", "#3d3d42"],
};

const LOOK = {
  shirts: ["#e9e4da", "#3f4a5a", "#8aa39b", "#c9b79c", "#5c6f8a", "#d7a68a", "#2f3a33", "#b9c4cc"],
  day: {
    bg: "#a9b893", ground: { base: "#a8b98c", alt: "#9aac7f", kind: "grass" },
    court: { base: "#e4ded1", alt: "#d3ccbc", kind: "raked" }, path: "#d9d2c3",
    plinth: "#cfc8ba",
    floor: {
      office: { base: "#e4cfa8", alt: "#d9c095", line: "#c4a77a", kind: "planks" },
      hq: { base: "#d4cf98", alt: "#c8c38a", line: "#6d6a45", kind: "tatami" },
      // one-metre stone tiles with dark joints, so corridors read apart from the oak offices at the far zoom
      corridor: { base: "#d9d2c4", alt: "#c9c1b1", line: "#958b78", kind: "cement" },
      break: { base: "#ece7de", alt: "#c9c2b4", line: "#a39b8b", kind: "terrazzo" },
    },
    wall: { face: "#f4f1ea", alt: "#ebe6dc", trim: "#d9c095", kind: "plain" },
    cladding: { base: "#cfb38a", alt: "#c4a77c", line: "#a88d66", kind: "boards" },
    cap: "#9a8462",
    wood: "#dcc29a", woodEdge: "#c4a77a", steel: "#2b2b2e",
    chair: { seat: "#e9e4da", frame: "#2b2b2e" },
    rug: { base: "#cdc890", alt: "#c2bd84", line: "#4a4a3a", kind: "tatami" },
    plant: { leaf: "#5f8a5a", leaf2: "#4e7a4a", pot: "#efece6" },
    lantern: { paper: "#f7f1e2", frame: "#3a3530" },
    shelf: "#d9c095", books: ["#3f4a5a", "#c9b79c", "#8aa39b", "#e9e4da", "#d7a68a"],
    screen: "#23262d", screenFrame: "#2b2b2e",
    counter: { top: "#f2efe8", body: "#dcc29a" }, sofa: "#c9c0ae", sofaCushion: "#d8d0bf",
    shoji: { frame: "#c4a77a", paper: "#f7f3e8" }, accent: "#c8553d",
    tree: { leaf: "#b8442c", leaf2: "#d0603a", trunk: "#4a3a2e" },
    moon: null,
    light: { amb: "#fff8ef", ambI: 2.0, sky: "#fffaf2", ground: "#c8bca8", hemi: 0.75, key: "#fff4e4", keyI: 0.95, room: 0.0, shadow: 0.3 },
  },
  // A lawn under the moon, blue-lit and never black: `moon` is added to everything outdoors (ground, lot, courts).
  night: {
    bg: "#2c3d55", ground: { base: "#6a8a80", alt: "#607f75", kind: "grass" },
    court: { base: "#6a6f78", alt: "#60656e", kind: "raked" }, path: "#4a4f5a",
    moon: "#4a6a94",
    light: { amb: "#3e5898", ambI: 1.0, sky: "#4a64a8", ground: "#1b2030", hemi: 0.45, key: "#8aa0d8", keyI: 0.35, room: 0.6, shadow: 0.0 },
  },
};

// The tokens for a theme: night keeps the day's materials (they are what things are made of) and changes the ground
// and the light, so lit offices glow among dark ones.
export function lookFor(theme = "light") {
  const night = theme === "dark";
  return { night, shirts: LOOK.shirts, people: PEOPLE, ...LOOK.day, ...(night ? LOOK.night : {}) };
}

// A small stable hash, so a lane's looks (shirt, hair, poster) never change between loads.
export function hash(s) {
  let h = 2166136261;
  for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export const pick = (arr, h, salt = 0) => arr[(((h >>> (salt % 24)) ^ (salt * 2654435761)) >>> 0) % arr.length];
