// The office plan, pure (no three.js): lanes in; rooms, walls, doors and the growth stage out, with stable places.
//
// Units are metres and one tile is one metre. x runs east, z runs south; a room is a rect of whole tiles.
// Stages (spec section 5): 1 studio (1-3 lanes), 2 floor (4-8), 3 wings (9-16), 4 campus (17+).

export const OFFICE = { w: 5, d: 4 };
export const SUITE = { w: 7, d: 5 };
export const CORRIDOR = 2;
export const COURT = 4;
export const WING_MAX = 5;
export const WALL_H = 2.95;
export const KERB_H = 0.35;
export const STAGES = ["", "studio", "floor", "wings", "campus"];

const INDOOR = new Set(["office", "hq", "corridor", "break"]);
// Rooms with something in them: a wall that would hide one of these is cut. A corridor alone does not cut a wall.
const CONTENT = new Set(["office", "hq", "break"]);
const OPEN = (a, b) => (a.kind === "corridor" || a.kind === "break") && (b.kind === "corridor" || b.kind === "break");

export function stageFor(n) {
  return n <= 3 ? 1 : n <= 8 ? 2 : n <= 16 ? 3 : 4;
}

// A lane's team: its top-level ancestor among the lanes (a lane with no parent, or whose parent is HQ, is its own team).
export function teamOf(name, byName, hq = "hq") {
  let cur = byName.get(name);
  for (let hops = 0; cur && hops < 32; hops++) {
    const p = cur.parent;
    if (!p || p === hq || !byName.has(p)) return cur.name;
    cur = byName.get(p);
  }
  return name;
}

// The order of offices. Within one stage it only grows: a lane keeps its slot, a removed lane leaves a vacant slot,
// a new lane is appended. A stage change starts over from the live lanes, grouped by team.
function slotsFor(live, byName, stage, prev, hq) {
  const team = (n) => teamOf(n, byName, hq);
  if (prev && prev.stage === stage) {
    const liveSet = new Set(live.map((l) => l.name));
    const slots = prev.slots.map((s) => ({ lane: s.lane, team: liveSet.has(s.lane) ? team(s.lane) : s.team, vacant: !liveSet.has(s.lane) }));
    const known = new Set(slots.map((s) => s.lane));
    for (const l of live) if (!known.has(l.name)) slots.push({ lane: l.name, team: team(l.name), vacant: false });
    // a lane that left and came back takes its old slot again
    return slots;
  }
  const teams = [];
  const byTeam = new Map();
  for (const l of live) {
    const t = team(l.name);
    if (!byTeam.has(t)) { byTeam.set(t, []); teams.push(t); }
    byTeam.get(t).push(l.name);
  }
  return teams.flatMap((t) => byTeam.get(t).map((lane) => ({ lane, team: t, vacant: false })));
}

const rect = (id, kind, x, z, w, d, extra = {}) => ({ id, kind, x, z, w, d, ...extra });

// An office whose back wall is on side `back` ("n" or "s"); its door is on the opposite side.
const office = (slot, i, x, z, back) => rect(`office:${slot.lane}`, "office", x, z, OFFICE.w, OFFICE.d, {
  lane: slot.lane, team: slot.team, vacant: slot.vacant, index: i, back,
  door: back === "n" ? { side: "s", at: 3, width: 1 } : { side: "n", at: 1, width: 1 },
});

// Wings: one wing per team, split at WING_MAX, numbered in the order they were opened (so a new wing never moves an
// older one).
function wingsOf(slots) {
  const wings = [];
  const open = new Map();
  slots.forEach((s, i) => {
    let w = open.get(s.team);
    if (!w || w.slots.length >= WING_MAX) { w = { team: s.team, slots: [] }; wings.push(w); open.set(s.team, w); }
    w.slots.push({ slot: s, i });
  });
  return wings;
}

function layout(stage, slots) {
  const rooms = [];
  const n = slots.length;
  if (stage === 1) {
    const len = Math.max(n * OFFICE.w, 3);
    rooms.push(rect("hq", "hq", -SUITE.w, 0, SUITE.w, SUITE.d, { back: "n", door: { side: "e", at: 4, width: 1 } }));
    rooms.push(rect("hall", "corridor", 0, OFFICE.d, len, CORRIDOR));
    slots.forEach((s, i) => rooms.push(office(s, i, i * OFFICE.w, 0, "n")));
  } else if (stage === 2) {
    const cols = Math.ceil(n / 2);
    rooms.push(rect("hq", "hq", -SUITE.w, 2, SUITE.w, SUITE.d, { back: "n", door: { side: "e", at: 2, width: 2 } }));
    rooms.push(rect("hall", "corridor", 0, OFFICE.d, cols * OFFICE.w, CORRIDOR));
    rooms.push(rect("break", "break", cols * OFFICE.w, 0, 5, OFFICE.d * 2 + CORRIDOR, { back: "n" }));
    slots.forEach((s, i) => {
      const col = i >> 1;
      rooms.push(i % 2 === 0 ? office(s, i, col * OFFICE.w, 0, "n") : office(s, i, col * OFFICE.w, OFFICE.d + CORRIDOR, "s"));
    });
  } else {
    const wings = wingsOf(slots);
    const cols = stage === 4 ? 2 : 1;
    const pitch = OFFICE.d + CORRIDOR + COURT; // one wing and the court after it
    const colW = CORRIDOR + WING_MAX * OFFICE.w + COURT;
    rooms.push(rect("hq", "hq", -SUITE.w, -SUITE.d, SUITE.w, SUITE.d, { back: "n", door: { side: "s", at: 5, width: 2 } }));
    rooms.push(rect("break", "break", -SUITE.w, 0, SUITE.w - CORRIDOR, OFFICE.d + CORRIDOR, { back: "w" }));
    for (let c = 0; c < cols; c++) {
      const hallX = c * colW - CORRIDOR;
      const inCol = wings.filter((_, j) => j % cols === c);
      if (!inCol.length) continue;
      const end = (inCol.length - 1) * pitch + OFFICE.d + CORRIDOR;
      rooms.push(rect(`hall:${c}`, "corridor", hallX, 0, CORRIDOR, end));
      // a campus: the second building stands across a gravel court from the first
      if (c > 0) rooms.push(rect(`court:col${c}`, "court", hallX - COURT, 0, COURT, end));
    }
    wings.forEach((w, j) => {
      const c = j % cols, r = Math.floor(j / cols);
      const x0 = c * colW, z0 = r * pitch;
      rooms.push(rect(`wing:${j}`, "corridor", x0, z0 + OFFICE.d, w.slots.length * OFFICE.w, CORRIDOR, { team: w.team }));
      w.slots.forEach(({ slot, i }, k) => rooms.push(office(slot, i, x0 + k * OFFICE.w, z0, "n")));
      // the court between this wing and the next one down: as long as the longer of the two, so it never sticks out
      const below = wings[j + cols];
      if (below) rooms.push(rect(`court:${j}`, "court", x0, z0 + OFFICE.d + CORRIDOR, Math.max(w.slots.length, below.slots.length) * OFFICE.w, COURT));
    });
  }
  return rooms;
}

const key = (x, z) => `${x},${z}`;

export function tileMap(rooms) {
  const m = new Map();
  for (const r of rooms) for (let x = r.x; x < r.x + r.w; x++) for (let z = r.z; z < r.z + r.d; z++) m.set(key(x, z), r);
  return m;
}

function onDoor(r, dir, x, z) {
  const d = r?.door;
  if (!d) return false;
  if (dir === "x" && (d.side === "n" || d.side === "s")) {
    const lineZ = d.side === "n" ? r.z : r.z + r.d;
    return z === lineZ && x >= r.x + d.at && x < r.x + d.at + d.width;
  }
  if (dir === "z" && (d.side === "w" || d.side === "e")) {
    const lineX = d.side === "w" ? r.x : r.x + r.w;
    return x === lineX && z >= r.z + d.at && z < r.z + d.at + d.width;
  }
  return false;
}

// Every wall as a one-tile segment. dir "x" runs from (x,z) to (x+1,z) between tiles (x,z-1) [a] and (x,z) [b];
// dir "z" runs from (x,z) to (x,z+1) between tiles (x-1,z) [a] and (x,z) [b].
function wallsOf(rooms, tiles) {
  const walls = [];
  const indoor = (r) => r && INDOOR.has(r.kind);
  let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
  for (const r of rooms) { minX = Math.min(minX, r.x); minZ = Math.min(minZ, r.z); maxX = Math.max(maxX, r.x + r.w); maxZ = Math.max(maxZ, r.z + r.d); }
  const consider = (dir, x, z, a, b) => {
    if (!indoor(a) && !indoor(b)) return;
    if (a === b) return;
    if (indoor(a) && indoor(b) && OPEN(a, b)) return;
    walls.push({ dir, x, z, a: indoor(a) ? a.id : null, b: indoor(b) ? b.id : null, door: onDoor(a, dir, x, z) || onDoor(b, dir, x, z) });
  };
  for (let x = minX; x <= maxX; x++) for (let z = minZ; z < maxZ; z++) consider("z", x, z, tiles.get(key(x - 1, z)), tiles.get(key(x, z)));
  for (let z = minZ; z <= maxZ; z++) for (let x = minX; x < maxX; x++) consider("x", x, z, tiles.get(key(x, z - 1)), tiles.get(key(x, z)));
  return { walls, bounds: { minX, minZ, maxX, maxZ } };
}

// lanes: [{ name, parent, status }] in the order they appeared. prev: the plan this one follows, for stable places.
export function plan(lanes, prev = null, opts = {}) {
  const hq = opts.hq ?? "hq";
  const byName = new Map(lanes.map((l) => [l.name, l]));
  const live = lanes.filter((l) => l.name !== hq);
  const stage = stageFor(live.length);
  const slots = slotsFor(live, byName, stage, prev, hq);
  const rooms = layout(stage, slots);
  const tiles = tileMap(rooms);
  const { walls, bounds } = wallsOf(rooms, tiles);
  const offices = rooms.filter((r) => r.kind === "office");
  return { stage, stageName: STAGES[stage], slots, rooms, walls, bounds, offices, hq: rooms.find((r) => r.kind === "hq") };
}

// The camera's side for a rotation: the signs of its x and z offset from what it looks at (azimuth 45° + rot·90°).
export function cameraSide(rot) {
  const r = ((rot % 4) + 4) % 4;
  return [{ sx: 1, sz: 1 }, { sx: 1, sz: -1 }, { sx: -1, sz: -1 }, { sx: -1, sz: 1 }][r];
}

// Cutaway, the Sims rule: a wall drops to a kerb when a room lies right behind it (seen from the camera: the near
// walls of every room), or when it would hide a room with something in it further back. A full wall at full height
// hides the ground up to WALL_H / tan 30° behind it along the view, about 3.6 m on each axis.
export function wallCuts(p, rot) {
  const { sx, sz } = cameraSide(rot);
  const tiles = p.tiles ?? (p.tiles = tileMap(p.rooms));
  const at = (x, z) => tiles.get(key(Math.floor(x), Math.floor(z)));
  const reach = WALL_H / Math.tan(Math.PI / 6) / Math.SQRT2;
  return p.walls.map((w) => {
    const far = w.dir === "x" ? at(w.x + 0.5, sz > 0 ? w.z - 0.5 : w.z + 0.5) : at(sx > 0 ? w.x - 0.5 : w.x + 0.5, w.z + 0.5);
    if (far && INDOOR.has(far.kind)) return true;
    for (const u of [0.15, 0.5, 0.85]) {
      const px = w.dir === "x" ? w.x + u : w.x, pz = w.dir === "x" ? w.z : w.z + u;
      for (let t = 0.3; t <= reach; t += 0.35) {
        const r = at(px - sx * t, pz - sz * t);
        if (r && CONTENT.has(r.kind)) return true;
      }
    }
    return false;
  });
}

// A point in a room's own frame (back wall at local z = 0, door side at z = d) to world x, z and a y rotation.
export function toWorld(room, lx, lz) {
  switch (room.back) {
    case "s": return { x: room.x + room.w - lx, z: room.z + room.d - lz, ry: Math.PI };
    case "w": return { x: room.x + lz, z: room.z + room.d - lx, ry: Math.PI / 2 };
    case "e": return { x: room.x + room.w - lz, z: room.z + lx, ry: -Math.PI / 2 };
    default: return { x: room.x + lx, z: room.z + lz, ry: 0 };
  }
}

// Where the desk is in an office, in its own frame, and the point the desk HUD hangs from.
export const DESK = { x: 2, z: 0.62, w: 1.7, d: 0.72 };
export const HUD_POINT = { x: 2, y: 2.25, z: 1.0 };

// What changed between two plans: offices that are new (to rise) and whether the rooms moved at all.
export function diff(prev, next) {
  const before = new Set(prev?.offices.map((o) => o.id) ?? []);
  const sig = (p) => p?.rooms.map((r) => `${r.id}@${r.x},${r.z},${r.w},${r.d},${r.vacant ? 1 : 0}`).join("|") ?? "";
  return { added: next.offices.filter((o) => !before.has(o.id)).map((o) => o.lane), moved: sig(prev) !== sig(next) };
}
