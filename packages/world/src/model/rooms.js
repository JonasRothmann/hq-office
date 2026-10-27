// Rooms, found from the walls: a flood fill over tiles that crosses only edges with no wall. A region touching the
// lot's border is outdoors; every other region is a room. Doors and windows sit on walls, so they bound rooms too.
import { tileKey, edgeBetween, pathEdges } from "./grid.js";

/** @typedef {{ id: string, name?: string, tiles: [number, number][], bounds: { x: number, z: number, w: number, d: number }, labelled: boolean }} Room */

// rooms: Room[]; at: Map tileKey → room id ("outside" for outdoors).
/** @stability stable */
export function detectRooms(doc, walls = wallEdgeSet(doc)) {
  const { w, d } = doc.lot;
  const at = new Map();
  const rooms = [];
  const steps = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (let z = 0; z < d; z++) {
    for (let x = 0; x < w; x++) {
      if (at.has(tileKey(x, z))) continue;
      const tiles = [[x, z]], seen = new Set([tileKey(x, z)]);
      let border = false;
      for (let i = 0; i < tiles.length; i++) {
        const [tx, tz] = tiles[i];
        if (tx === 0 || tz === 0 || tx === w - 1 || tz === d - 1) border = true;
        for (const [dx, dz] of steps) {
          const nx = tx + dx, nz = tz + dz;
          if (nx < 0 || nz < 0 || nx >= w || nz >= d) continue;
          const k = tileKey(nx, nz);
          if (seen.has(k) || walls.has(edgeBetween(tx, tz, nx, nz))) continue;
          seen.add(k);
          tiles.push([nx, nz]);
        }
      }
      // a region on the border of the lot is outdoors, unless walls close it along the border itself
      const closed = !border || tiles.every(([tx, tz]) => (tx > 0 || walls.has(`v:${tx},${tz}`)) && (tz > 0 || walls.has(`h:${tx},${tz}`)) && (tx < w - 1 || walls.has(`v:${tx + 1},${tz}`)) && (tz < d - 1 || walls.has(`h:${tx},${tz + 1}`)));
      const id = closed ? `room:${x},${z}` : "outside";
      for (const k of seen) at.set(k, id);
      if (closed) {
        const xs = tiles.map((t) => t[0]), zs = tiles.map((t) => t[1]);
        const bx = Math.min(...xs), bz = Math.min(...zs);
        rooms.push({ id, tiles, bounds: { x: bx, z: bz, w: Math.max(...xs) - bx + 1, d: Math.max(...zs) - bz + 1 }, labelled: false });
      }
    }
  }
  // labels rename rooms
  for (const label of doc.rooms ?? []) {
    const id = at.get(tileKey(label.at[0], label.at[1]));
    const room = rooms.find((r) => r.id === id);
    if (!room || room.labelled) continue;
    for (const [tx, tz] of room.tiles) at.set(tileKey(tx, tz), label.id);
    Object.assign(room, { id: label.id, name: label.name ?? label.id, labelled: true });
  }
  return { rooms, at };
}

export function wallEdgeSet(doc) {
  const s = new Set();
  for (const wall of doc.walls ?? []) if (Array.isArray(wall.path)) for (const e of pathEdges(wall.path)) s.add(e);
  return s;
}
