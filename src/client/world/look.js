// The world's looks: colour and material tokens per look (A Sims-faithful, B Nordic-Japanese) and per theme (day, night).

// Status colours, shared with the UI (spec section 3).
export const STATUS = {
  needs_you: "#e5484d", blocked: "#e5484d", hq_turn: "#f5a524", waiting: "#3e63dd",
  moving: "#30a46c", done: "#12a594", parked: "#8b8d98", gone: "#8b8d98", stale: "#8b8d98",
};
export const MODEL = { opus: "#8e4ec6", sonnet: "#12a594", haiku: "#f5a524", other: "#8b8d98" };

export function modelFamily(model = "") {
  const m = String(model).toLowerCase();
  return m.includes("opus") ? "opus" : m.includes("sonnet") ? "sonnet" : m.includes("haiku") ? "haiku" : "other";
}

// What a worker does for a status: the pose says it before the colour does.
//   work  seated, leaning in, typing          raise  standing beside the desk, facing the camera, hand up
//   fold  seated, leaning back, arms folded   lean   seated, leaning back, hands behind the head
//   mug   leaning back with a mug              sleep  slumped on the desk          away  chair empty
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

// The marker over a head: a round badge with a glyph and a short tail. Never a diamond.
export function markerOf(status) {
  switch (status) {
    case "needs_you": case "blocked": return { color: STATUS.needs_you, glyph: "!" };
    case "hq_turn": return { color: STATUS.hq_turn, glyph: "hq" };
    case "waiting": return { color: STATUS.waiting, glyph: "clock" };
    default: return null;
  }
}

// Shared by both looks: people, posters, status-driven bits.
const PEOPLE = {
  skin: ["#f1c9a5", "#e0ac83", "#c68a5e", "#9a6440", "#6e4529", "#f6d7bd"],
  hair: ["#2a1d15", "#4a3020", "#7a4b28", "#c08a4a", "#e2c27a", "#1d1d22", "#8c8c94", "#a33a2a"],
  pants: ["#33384a", "#4b4f5c", "#5c4a3a", "#2d3e50", "#6b6f58", "#3d3d42"],
};

const A = {
  name: "Sims-faithful",
  shirts: ["#c0413a", "#2f7fb5", "#e0a33a", "#4f9a5a", "#8e5aa8", "#e57b3a", "#3aa3a0", "#d8d2c4"],
  day: {
    bg: "#7da454", ground: { base: "#7fa650", alt: "#6d9443", kind: "grass" },
    court: { base: "#c9bfa7", alt: "#b3a88d", kind: "gravel" }, path: "#d7cdb6",
    plinth: "#a59a86",
    floor: {
      office: { base: "#c48f55", alt: "#b07c45", line: "#8d5e30", kind: "planks" },
      hq: { base: "#3f7f86", alt: "#386f76", line: "#2c5b61", kind: "carpet" },
      corridor: { base: "#ece4d0", alt: "#a8584a", line: "#7f4034", kind: "checker" },
      break: { base: "#ece4d0", alt: "#2f6f8a", line: "#245468", kind: "checker" },
    },
    wall: { face: "#efe0c2", alt: "#e2c99c", trim: "#9a6b3f", kind: "stripes" },
    cladding: { base: "#b4613f", alt: "#a65638", line: "#d8c8b0", kind: "brick" },
    cap: "#97784c",
    wood: "#a8703c", woodEdge: "#7d4f27", steel: "#2b2b2e",
    chair: { seat: "#b8443a", frame: "#3a3a3e" },
    rug: { base: "#b5553f", alt: "#e2b867", line: "#6e2e24", kind: "border" },
    plant: { leaf: "#4f8a3a", leaf2: "#3d7230", pot: "#b5623a" },
    lantern: { paper: "#f3dfb0", frame: "#5a3a22", kind: "floorlamp" },
    shelf: "#8a5a32", books: ["#b8443a", "#2f7fb5", "#e0a33a", "#4f9a5a", "#efe0c2"],
    screen: "#2b2f3a", screenFrame: "#d8d2c4",
    counter: { top: "#e8e2d4", body: "#c48f55" }, sofa: "#4f7f8a", sofaCushion: "#5f93a0",
    shoji: null, accent: "#b8443a",
    tree: { leaf: "#4f8a3a", leaf2: "#5f9a48", trunk: "#6a4a2c" },
    light: { amb: "#fff2e2", ambI: 1.95, sky: "#fff6e8", ground: "#b9a58a", hemi: 0.75, key: "#fff1dc", keyI: 1.05, room: 0.0, shadow: 0.38 },
  },
  night: {
    bg: "#1a2431", ground: { base: "#3b5532", alt: "#344c2c", kind: "grass" },
    court: { base: "#3a3d42", alt: "#33363a", kind: "gravel" }, path: "#3d3f44",
    light: { amb: "#3e5898", ambI: 1.0, sky: "#4a64a8", ground: "#1b2030", hemi: 0.45, key: "#8aa0d8", keyI: 0.35, room: 0.62, shadow: 0.0 },
  },
};

const B = {
  name: "Nordic-Japanese",
  shirts: ["#e9e4da", "#3f4a5a", "#8aa39b", "#c9b79c", "#5c6f8a", "#d7a68a", "#2f3a33", "#b9c4cc"],
  day: {
    bg: "#a9b893", ground: { base: "#a8b98c", alt: "#9aac7f", kind: "grass" },
    court: { base: "#e4ded1", alt: "#d3ccbc", kind: "raked" }, path: "#d9d2c3",
    plinth: "#cfc8ba",
    floor: {
      office: { base: "#e4cfa8", alt: "#d9c095", line: "#c4a77a", kind: "planks" },
      hq: { base: "#d4cf98", alt: "#c8c38a", line: "#6d6a45", kind: "tatami" },
      corridor: { base: "#dcd6cb", alt: "#d0c9bc", line: "#bdb5a6", kind: "cement" },
      break: { base: "#ece7de", alt: "#c9c2b4", line: "#a39b8b", kind: "terrazzo" },
    },
    wall: { face: "#f4f1ea", alt: "#ebe6dc", trim: "#d9c095", kind: "plain" },
    cladding: { base: "#cfb38a", alt: "#c4a77c", line: "#a88d66", kind: "boards" },
    cap: "#9a8462",
    wood: "#dcc29a", woodEdge: "#c4a77a", steel: "#2b2b2e",
    chair: { seat: "#e9e4da", frame: "#2b2b2e" },
    rug: { base: "#cdc890", alt: "#c2bd84", line: "#4a4a3a", kind: "tatami" },
    plant: { leaf: "#5f8a5a", leaf2: "#4e7a4a", pot: "#efece6" },
    lantern: { paper: "#f7f1e2", frame: "#3a3530", kind: "andon" },
    shelf: "#d9c095", books: ["#3f4a5a", "#c9b79c", "#8aa39b", "#e9e4da", "#d7a68a"],
    screen: "#23262d", screenFrame: "#2b2b2e",
    counter: { top: "#f2efe8", body: "#dcc29a" }, sofa: "#c9c0ae", sofaCushion: "#d8d0bf",
    shoji: { frame: "#c4a77a", paper: "#f7f3e8" }, accent: "#c8553d",
    tree: { leaf: "#b8442c", leaf2: "#d0603a", trunk: "#4a3a2e" },
    light: { amb: "#fff8ef", ambI: 2.0, sky: "#fffaf2", ground: "#c8bca8", hemi: 0.75, key: "#fff4e4", keyI: 0.95, room: 0.0, shadow: 0.3 },
  },
  night: {
    bg: "#182030", ground: { base: "#43523d", alt: "#3b4936", kind: "grass" },
    court: { base: "#3d3f44", alt: "#36383c", kind: "raked" }, path: "#3d3f44",
    light: { amb: "#3e5898", ambI: 1.0, sky: "#4a64a8", ground: "#1b2030", hemi: 0.45, key: "#8aa0d8", keyI: 0.35, room: 0.6, shadow: 0.0 },
  },
};

export const LOOKS = { a: A, b: B };

// The tokens for a look and a theme: night keeps the day's materials (they are what things are made of) and changes
// the ground and the light, so lit offices glow among dark ones.
export function lookFor(look = "b", theme = "light") {
  const L = LOOKS[look] ?? B;
  const night = theme === "dark";
  const t = { ...L.day, ...(night ? L.night : {}) };
  return { id: look in LOOKS ? look : "b", name: L.name, night, shirts: L.shirts, people: PEOPLE, ...t };
}

// A small stable hash, so a lane's looks (shirt, hair, poster) never change between loads.
export function hash(s) {
  let h = 2166136261;
  for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export const pick = (arr, h, salt = 0) => arr[(((h >>> (salt % 24)) ^ (salt * 2654435761)) >>> 0) % arr.length];
