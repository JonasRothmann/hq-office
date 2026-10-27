// Today's 3D office's view of the layout: the layout itself (rooms, seating, walls, stages) lives in
// src/client/office/layout.js; this file adds what only this renderer uses (desks at sub-tile places, the cutaway,
// the diff that says what to rebuild). It goes when the engine's world is the default (docs/engine/rfc.md, 12).
import { ROOM, SEATS, SUITE, BREAK_W, CORRIDOR, COURT, WING_MAX, WALL_H, KERB_H, STAGES, INDOOR, stageFor, teamOf, tileMap, plan } from "../office/layout.js";

export { ROOM, SEATS, SUITE, BREAK_W, CORRIDOR, COURT, WING_MAX, WALL_H, KERB_H, STAGES, stageFor, teamOf, tileMap, plan };

// The four desks of a team room in its own frame (back wall at z = 0): two facing pairs, an island in the middle.
// x, z: the desk's centre; ry: the desk's turn (at 0 its worker sits on the +z side and faces -z, toward the back
// wall); out: which side of the island (in the desk's own x) is the room's wall, where its worker stands to wave.
// The back pair fills first: those workers face the door, and the camera at the default view.
export const DESKS = [
  { x: 2.8, z: 2.14, ry: Math.PI, out: 1 },
  { x: 4.2, z: 2.14, ry: Math.PI, out: -1 },
  { x: 2.8, z: 2.86, ry: 0, out: -1 },
  { x: 4.2, z: 2.86, ry: 0, out: 1 },
];

// Rooms with something in them: a wall that would hide one of these is cut. A corridor alone does not cut a wall.
const CONTENT = new Set(["team", "hq", "break"]);
const key = (x, z) => `${x},${z}`;

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

// A desk's place in the world: its centre and its turn (the room's turn plus the desk's own).
export function deskPlace(room, seat) {
  const d = DESKS[seat];
  const w = toWorld(room, d.x, d.z);
  return { x: w.x, z: w.z, ry: w.ry + d.ry, out: d.out };
}

// What changed between two plans: desks that are new (to rise) and whether the rooms or the seating moved at all.
export function diff(prev, next) {
  const before = new Set(prev?.desks.filter((d) => !d.vacant).map((d) => d.lane) ?? []);
  const sig = (p) => p ? p.rooms.map((r) => `${r.id}@${r.x},${r.z},${r.w},${r.d}`).join("|") + "/" + p.desks.map((d) => `${d.lane}@${d.room}:${d.seat}${d.vacant ? "-" : ""}`).join("|") : "";
  return { added: next.desks.filter((d) => !d.vacant && !before.has(d.lane)).map((d) => d.lane), moved: sig(prev) !== sig(next) };
}
