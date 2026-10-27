// The office as a world doc for @hq/world, pure (no three.js, no DOM): the lanes in /api/state in, a WorldDoc out.
// Team rooms, the HQ suite, the hall and the break area come from the layout (layout.js) as walls, floors and doors;
// each lane gets a desk, a chair and a worker with stable ids, and an act for its status (acts.js). Called again with
// the last result each time the lanes change, it keeps every place it can, so `world.apply(next)` has a small diff.
import { plan as layoutOf, INDOOR } from "./layout.js";
import { SEATS_AT, TEAM_ROOM, SUITE_AT, BREAK_AT, FOOT, frameSize, place, tileAt, sideOf } from "./furnish.js";
import { actFor, rowOf } from "./acts.js";

export const PACKS = ["starter", "placeholder"];
const MARGIN = 2; // tiles of ground round the building
const WALL = { finish: "starter/plaster", outside: "starter/siding" };
const LOUNGE = new Set(["corridor", "break"]);

export const deskId = (lane) => `desk:${lane}`;
export const chairId = (lane) => `chair:${lane}`;
export const workerId = (lane) => `lane:${lane}`;

// lanes: [{ name, parent, status }] in the order they appeared (HQ's own lane may be among them). prev: the last
// result, so desks keep their places. opts.hq: HQ's lane name; opts.hqStatus: its status when it is not a lane here.
// Returns { doc, layout }.
export function officeDoc(lanes, prev = null, opts = {}) {
  const hq = opts.hq ?? "hq";
  const layout = layoutOf(lanes, prev?.layout ?? null, { hq });
  const { minX, minZ, maxX, maxZ } = layout.bounds;
  const o = { x: MARGIN - minX, z: MARGIN - minZ };
  const status = new Map(lanes.map((l) => [l.name, l.status]));
  const doc = {
    format: 1, id: "office", packs: PACKS,
    lot: { w: maxX - minX + 2 * MARGIN, d: maxZ - minZ + 2 * MARGIN },
    floors: layout.rooms.filter((r) => INDOOR.has(r.kind)).map((r) => ({ rect: [r.x + o.x, r.z + o.z, r.w, r.d], finish: "starter/oak" })),
    walls: wallPaths(layout.walls, o),
    openings: [...doors(layout.walls, o), ...windows(layout, o)],
    rooms: labels(layout, o),
    objects: [], characters: [], acts: [],
  };

  // workers: one per live desk, and HQ in its suite
  const workers = [];
  const seat = (room, lane, at, vacant) => {
    doc.objects.push({ id: deskId(lane), ...place(room, { type: "starter/desk", at: at.desk, facing: at.deskFacing }, o) });
    doc.objects.push({ id: chairId(lane), ...place(room, { type: "starter/chair", at: at.chair, facing: at.chairFacing }, o) });
    if (!vacant) workers.push({ lane, beside: tileAt(room, at.beside, o) });
  };
  const furnish = (room, list) => { for (const obj of list) doc.objects.push({ id: `${obj.id}:${room.id}`, ...place(room, obj, o) }); };
  if (layout.hq) {
    seat(layout.hq, hq, SUITE_AT.seat, false);
    furnish(layout.hq, SUITE_AT.objects);
  }
  for (const room of layout.teamRooms) {
    room.seats.forEach((s, i) => seat(room, s.lane, SEATS_AT[i], s.vacant));
    furnish(room, TEAM_ROOM.objects);
  }
  const lounge = layout.rooms.find((r) => r.kind === "break") ?? layout.rooms.find((r) => r.id === "hall");
  if (lounge.kind === "break") furnish(lounge, BREAK_AT.objects(frameSize(lounge)[0]));

  const statusOf = (lane) => (lane === hq ? opts.hqStatus ?? status.get(hq) ?? "moving" : status.get(lane));
  const spot = spotsFor(workers.filter((w) => rowOf(statusOf(w.lane)).place === "break"), freeTiles(lounge, doc, layout, o));
  for (const w of workers) {
    const id = workerId(w.lane);
    doc.characters.push({ id, at: w.beside, facing: "s", look: lookOf(w.lane) });
    doc.acts.push(actFor(id, statusOf(w.lane), { chair: chairId(w.lane), beside: w.beside, spot: spot.get(w.lane) ?? w.beside }));
  }
  return { doc, layout };
}

// The layout's one-tile wall segments, merged into straight runs.
function wallPaths(segments, o) {
  const lines = new Map();
  for (const w of segments) {
    const k = `${w.dir}:${w.dir === "x" ? w.z : w.x}`;
    if (!lines.has(k)) lines.set(k, []);
    lines.get(k).push(w.dir === "x" ? w.x : w.z);
  }
  const paths = [];
  for (const [k, list] of lines) {
    const [dir, at] = [k[0], Number(k.slice(2))];
    const ends = (a, b) => (dir === "x" ? [[a + o.x, at + o.z], [b + o.x, at + o.z]] : [[at + o.x, a + o.z], [at + o.x, b + o.z]]);
    list.sort((a, b) => a - b);
    let start = list[0];
    list.forEach((v, i) => {
      if (list[i + 1] === v + 1) return;
      paths.push({ path: ends(start, v + 1), ...WALL });
      start = list[i + 1];
    });
  }
  return paths;
}

// A door on every door segment: on the north side of the tile south of an "x" segment, the west side of the tile
// east of a "z" one.
const doors = (segments, o) => segments.filter((w) => w.door).map((w) => ({ type: "starter/door", at: [w.x + o.x, w.z + o.z], side: w.dir === "x" ? "n" : "w" }));

// Windows on a team room's back wall, where that wall faces the outdoors.
function windows(layout, o) {
  const outer = new Set(layout.walls.filter((w) => !w.door && (!w.a || !w.b)).map((w) => `${w.dir}:${w.x}:${w.z}`));
  const out = [];
  for (const room of layout.teamRooms) {
    for (const at of TEAM_ROOM.windows) {
      const [x, z] = tileAt(room, at, o), side = sideOf(room, "n");
      const px = x - o.x, pz = z - o.z;
      const seg = { n: `x:${px}:${pz}`, s: `x:${px}:${pz + 1}`, w: `z:${px}:${pz}`, e: `z:${px + 1}:${pz}` }[side];
      if (outer.has(seg)) out.push({ type: "starter/window", at: [x, z], side });
    }
  }
  return out;
}

// One label per room the engine finds: each team room, the suite, and each run of hall and break area with no wall
// between its parts (named for the break area when it holds one).
function labels(layout, o) {
  const out = layout.rooms.filter((r) => r.kind === "team" || r.kind === "hq").map((r) => ({ at: [r.x + o.x, r.z + o.z], id: r.id, name: r.kind === "hq" ? "HQ" : `Team room ${r.index + 1}` }));
  const open = layout.rooms.filter((r) => LOUNGE.has(r.kind));
  const touch = (a, b) => (a.x + a.w === b.x || b.x + b.w === a.x ? Math.min(a.z + a.d, b.z + b.d) > Math.max(a.z, b.z) : a.z + a.d === b.z || b.z + b.d === a.z ? Math.min(a.x + a.w, b.x + b.w) > Math.max(a.x, b.x) : false);
  const seen = new Set();
  for (const first of open) {
    if (seen.has(first)) continue;
    const group = [first];
    seen.add(first);
    for (let i = 0; i < group.length; i++) for (const r of open) if (!seen.has(r) && touch(group[i], r)) { seen.add(r); group.push(r); }
    const r = group.find((g) => g.kind === "break") ?? group[0];
    out.push({ at: [r.x + o.x, r.z + o.z], id: r.id, name: r.kind === "break" ? "Break area" : "Hall" });
  }
  return out;
}

// The tiles of the lounge where a worker can stand: not under an object and not in a doorway.
function freeTiles(room, doc, layout, o) {
  const used = new Set();
  for (const obj of doc.objects) {
    const [fx, fz] = FOOT[obj.type] ?? [1, 1];
    const [w, d] = obj.facing === "e" || obj.facing === "w" ? [fz, fx] : [fx, fz];
    for (let x = 0; x < w; x++) for (let z = 0; z < d; z++) used.add(`${obj.at[0] + x},${obj.at[1] + z}`);
  }
  for (const w of layout.walls.filter((w) => w.door)) {
    used.add(`${w.x + o.x},${w.z + o.z}`);
    used.add(w.dir === "x" ? `${w.x + o.x},${w.z - 1 + o.z}` : `${w.x - 1 + o.x},${w.z + o.z}`);
  }
  const out = [];
  for (let z = room.z + o.z; z < room.z + room.d + o.z; z++) for (let x = room.x + o.x; x < room.x + room.w + o.x; x++) if (!used.has(`${x},${z}`)) out.push([x, z]);
  return out;
}

// Each idle worker's spot: a tile picked by its name, or the next free one after it, so a worker keeps its spot while
// others come and go. Workers past the number of tiles get none.
function spotsFor(idle, tiles) {
  const taken = new Set(), out = new Map();
  for (const w of idle) {
    for (let i = 0, start = hash(w.lane) % Math.max(tiles.length, 1); i < tiles.length; i++) {
      const t = (start + i) % tiles.length;
      if (taken.has(t)) continue;
      taken.add(t);
      out.set(w.lane, tiles[t]);
      break;
    }
  }
  return out;
}

function hash(s) {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.codePointAt(0), 16777619);
  return h >>> 0;
}

// A worker's look, picked by its lane's name from warm, muted colours (the office's own).
const LOOKS = {
  skin: ["#f3cfb0", "#e8b892", "#d29a6e", "#b27a50", "#8a5a3a", "#5e3b26"],
  hair: ["#2a1d15", "#4a3020", "#7a4b28", "#b07a3e", "#d9bf86", "#1d1d22", "#9a968f"],
  shirt: ["#a65a3c", "#c39a4e", "#5c6a4e", "#34405a", "#e2d8c6", "#94a088", "#55657e", "#6b5442"],
  pants: ["#2e2f33", "#34405a", "#4a4f5c", "#c4b49a", "#5c6250", "#6b5646"],
};
export function lookOf(name) {
  const h = hash(name);
  return Object.fromEntries(Object.entries(LOOKS).map(([k, list], i) => [k, list[(h >>> (i * 5)) % list.length]]));
}
