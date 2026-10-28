// The office's layout, pure (no three.js, no engine): lanes in; team rooms of up to four desks, the HQ suite, the hall,
// the break area, walls, doors and the growth stage out, with stable places. The world doc generator (plan.js here)
// reads it.
//
// Units are metres and one tile is one metre. x runs east, z runs south; a room is a rect of whole tiles.
// A team (a top-level lane and everyone under it in the lane tree) shares a room; a team of more than four opens
// another room next to its first. Lanes with no tree fill rooms of four in the order they appear.
// Stages (spec section 5), by team rooms: 1 studio (1 room), 2 floor (2-4), 3 wings (5-8), 4 campus (9+).

export const ROOM = { w: 7, d: 5 };
export const SEATS = 4;
export const SUITE = { w: 7, d: 5 };
export const BREAK_W = 5;
export const CORRIDOR = 2;
export const COURT = 4;
export const WING_MAX = 4;
export const WALL_H = 2.95;
export const KERB_H = 0.35;
export const STAGES = ["", "studio", "floor", "wings", "campus"];

export const INDOOR = new Set(["team", "hq", "corridor", "break"]);
const OPEN = (a, b) => (a.kind === "corridor" || a.kind === "break") && (b.kind === "corridor" || b.kind === "break");

export function stageFor(rooms) {
  return rooms <= 1 ? 1 : rooms <= 4 ? 2 : rooms <= 8 ? 3 : 4;
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

// Each live lane's team key: its team's name when the team has two lanes or more, else null (a lane on its own, which
// shares a room of four with the other lanes on their own).
function teamKeys(live, byName, hq) {
  const team = new Map(live.map((l) => [l.name, teamOf(l.name, byName, hq)]));
  const size = new Map();
  for (const t of team.values()) size.set(t, (size.get(t) ?? 0) + 1);
  return new Map([...team].map(([lane, t]) => [lane, size.get(t) > 1 ? t : null]));
}

// The seating from scratch: teams in the order their first lane appeared, each in rooms of four; the lanes on their own
// fill shared rooms of four, in the order they appear. A seating is [{ team, seats: [{ lane, vacant }] }].
function seatFresh(live, keys) {
  const groups = new Map();
  for (const l of live) {
    const k = keys.get(l.name);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(l.name);
  }
  const rooms = [];
  for (const [team, names] of groups) {
    for (let i = 0; i < names.length; i += SEATS) rooms.push({ team, seats: names.slice(i, i + SEATS).map((lane) => ({ lane, vacant: false })) });
  }
  return rooms;
}

// The seating after the last one: every lane keeps its desk; a lane that left leaves its desk empty; a new lane takes
// a free desk in a room where its team sits, else in a room opened for its team (or for lanes on their own), else an
// empty room, else a new room at the end. A lane that comes back takes its old desk again.
function seatAfter(prev, live, keys, team) {
  const liveSet = new Set(live.map((l) => l.name));
  const rooms = prev.map((r) => ({ team: r.team, seats: r.seats.map((s) => ({ lane: s.lane, vacant: !liveSet.has(s.lane) })) }));
  const seated = new Map();
  rooms.forEach((r, i) => r.seats.forEach((s) => seated.set(s.lane, i)));
  const freeSeat = (r) => r.seats.length < SEATS || r.seats.some((s) => s.vacant);
  const sit = (r, lane) => {
    const i = r.seats.findIndex((s) => s.vacant);
    if (i >= 0) r.seats[i] = { lane, vacant: false };
    else r.seats.push({ lane, vacant: false });
  };
  for (const l of live) {
    const back = seated.get(l.name);
    if (back !== undefined) {
      const s = rooms[back].seats.find((s) => s.lane === l.name);
      if (s) { s.vacant = false; continue; }
    }
    const k = keys.get(l.name), t = team.get(l.name);
    const room = rooms.find((r) => freeSeat(r) && r.seats.some((s) => !s.vacant && team.get(s.lane) === t))
      ?? rooms.find((r) => freeSeat(r) && r.team === k)
      ?? rooms.find((r) => r.seats.every((s) => s.vacant));
    if (room) {
      if (room.seats.every((s) => s.vacant)) { room.team = k; room.seats = []; }
      sit(room, l.name);
      seated.set(l.name, rooms.indexOf(room));
    } else {
      rooms.push({ team: k, seats: [{ lane: l.name, vacant: false }] });
      seated.set(l.name, rooms.length - 1);
    }
  }
  return rooms;
}

const rect = (id, kind, x, z, w, d, extra = {}) => ({ id, kind, x, z, w, d, ...extra });

// A team room whose back wall is on side `back` ("n" or "s"); its door is on the opposite side, right of the island.
const teamRoom = (seating, i, x, z, back) => rect(`room:${i}`, "team", x, z, ROOM.w, ROOM.d, {
  team: seating.team, index: i, back,
  seats: seating.seats.map((s) => ({ ...s })),
  lanes: seating.seats.filter((s) => !s.vacant).map((s) => s.lane),
  door: back === "n" ? { side: "s", at: 5, width: 1 } : { side: "n", at: 1, width: 1 },
});

// The building's front door, on the outer wall toward the default view (south): the hall's at the studio stage, the
// break area's on a floor, each hall's end in wings (a campus's second column of wings has no other way in). The
// garden's path and the land's path lead to it.
const FRONT = (at, width = 1) => ({ side: "s", at, width });

function layout(stage, seating) {
  const rooms = [];
  const n = seating.length;
  if (stage === 1) {
    // the HQ suite and one team room side by side, a hall along their fronts
    rooms.push(rect("hq", "hq", -SUITE.w, 0, SUITE.w, SUITE.d, { back: "n", door: { side: "s", at: 5, width: 1 } }));
    rooms.push(rect("hall", "corridor", -SUITE.w, ROOM.d, SUITE.w + ROOM.w, CORRIDOR, { door: FRONT(SUITE.w - 1) }));
    seating.forEach((s, i) => rooms.push(teamRoom(s, i, i * ROOM.w, 0, "n")));
  } else if (stage === 2) {
    // a corridor with team rooms on both sides, the suite at its west end, the break area at its east end
    const cols = Math.ceil(n / 2);
    rooms.push(rect("hq", "hq", -SUITE.w, ROOM.d + CORRIDOR - SUITE.d, SUITE.w, SUITE.d, { back: "n", door: { side: "e", at: SUITE.d - CORRIDOR, width: CORRIDOR } }));
    rooms.push(rect("hall", "corridor", 0, ROOM.d, cols * ROOM.w, CORRIDOR));
    rooms.push(rect("break", "break", cols * ROOM.w, 0, BREAK_W, ROOM.d * 2 + CORRIDOR, { back: "n", door: FRONT(3) }));
    seating.forEach((s, i) => {
      const col = i >> 1;
      rooms.push(i % 2 === 0 ? teamRoom(s, i, col * ROOM.w, 0, "n") : teamRoom(s, i, col * ROOM.w, ROOM.d + CORRIDOR, "s"));
    });
  } else {
    // wings: rows of up to WING_MAX team rooms, each along its own corridor off a central hall, courts between them;
    // a campus has two columns of wings, across a court from each other
    const wings = [];
    for (let i = 0; i < n; i += WING_MAX) wings.push(seating.slice(i, i + WING_MAX).map((s, k) => ({ s, i: i + k })));
    const cols = stage === 4 ? 2 : 1;
    const pitch = ROOM.d + CORRIDOR + COURT; // one wing and the court after it
    const colW = CORRIDOR + WING_MAX * ROOM.w + COURT;
    rooms.push(rect("hq", "hq", -SUITE.w, -SUITE.d, SUITE.w, SUITE.d, { back: "n", door: { side: "s", at: 5, width: 2 } }));
    rooms.push(rect("break", "break", -SUITE.w, 0, SUITE.w - CORRIDOR, ROOM.d + CORRIDOR, { back: "w" }));
    for (let c = 0; c < cols; c++) {
      const hallX = c * colW - CORRIDOR;
      const inCol = wings.filter((_, j) => j % cols === c);
      if (!inCol.length) continue;
      const end = (inCol.length - 1) * pitch + ROOM.d + CORRIDOR;
      rooms.push(rect(`hall:${c}`, "corridor", hallX, 0, CORRIDOR, end, { door: FRONT(0, CORRIDOR) }));
      if (c > 0) rooms.push(rect(`court:col${c}`, "court", hallX - COURT, 0, COURT, end));
    }
    wings.forEach((w, j) => {
      const c = j % cols, r = Math.floor(j / cols);
      const x0 = c * colW, z0 = r * pitch;
      rooms.push(rect(`wing:${j}`, "corridor", x0, z0 + ROOM.d, w.length * ROOM.w, CORRIDOR));
      w.forEach(({ s, i }, k) => rooms.push(teamRoom(s, i, x0 + k * ROOM.w, z0, "n")));
      // the court between this wing and the next one down: as long as the longer of the two, so it never sticks out
      const below = wings[j + cols];
      if (below) rooms.push(rect(`court:${j}`, "court", x0, z0 + ROOM.d + CORRIDOR, Math.max(w.length, below.length) * ROOM.w, COURT));
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
// Within a stage the seating only changes where it must (see seatAfter); when the rooms in use call for another stage,
// the plan is laid out again from the live lanes, grouped by team.
export function plan(lanes, prev = null, opts = {}) {
  const hq = opts.hq ?? "hq";
  const byName = new Map(lanes.map((l) => [l.name, l]));
  const live = lanes.filter((l) => l.name !== hq);
  const keys = teamKeys(live, byName, hq);
  const team = new Map(live.map((l) => [l.name, teamOf(l.name, byName, hq)]));
  const inUse = (s) => s.filter((r) => r.seats.some((x) => !x.vacant)).length;
  let seating = prev?.seating ? seatAfter(prev.seating, live, keys, team) : null;
  let stage = seating ? stageFor(inUse(seating)) : 0;
  if (!seating || stage !== prev.stage) {
    seating = seatFresh(live, keys);
    stage = stageFor(seating.length);
  }
  const rooms = layout(stage, seating);
  const tiles = tileMap(rooms);
  const { walls, bounds } = wallsOf(rooms, tiles);
  const teamRooms = rooms.filter((r) => r.kind === "team").sort((a, b) => a.index - b.index);
  // one desk per seat, in the room's order and the seats' order
  const desks = teamRooms.flatMap((r) => r.seats.map((s, seat) => ({ lane: s.lane, vacant: s.vacant, room: r.id, seat, team: team.get(s.lane) ?? r.team })));
  return { stage, stageName: STAGES[stage], seating, rooms, teamRooms, desks, walls, bounds, hq: rooms.find((r) => r.kind === "hq") };
}
