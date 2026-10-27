// The cutaway rule: which wall edges drop to the kerb for a rotation and a wall mode. Pure.
//
// up: none. down: every edge. cutaway: an edge is cut when the tile behind it (seen from the camera) is indoors, so
// the near walls of every room drop, or when a full wall there would hide indoor tiles within REACH behind it. With a
// focus room, only walls in front of that room drop.
import { WALL_H, tileKey, parseEdge } from "../model/grid.js";

export const WALL_MODES = ["up", "cutaway", "down"];
// How far behind itself a full wall hides the floor along the view (30° pitch, 45° azimuth): about 3.6 m.
const REACH = WALL_H / Math.tan(Math.PI / 6) / Math.SQRT2;

// The signs of the camera's x and z offset from what it looks at, for a rotation (azimuth 45° + rot·90°).
export function cameraSide(rot) {
  return [{ sx: 1, sz: 1 }, { sx: 1, sz: -1 }, { sx: -1, sz: -1 }, { sx: -1, sz: 1 }][((rot % 4) + 4) % 4];
}

/** @stability stable  @returns {Set<string>} cut edge keys */
export function cutaway(lot, { mode = "cutaway", rot = 0, focus = null } = {}) {
  const cut = new Set();
  if (mode === "up") return cut;
  if (mode === "down") { for (const k of lot.walls.keys()) cut.add(k); return cut; }
  const { sx, sz } = cameraSide(rot);
  const roomOf = (x, z) => lot.roomAt.get(tileKey(Math.floor(x), Math.floor(z)));
  const hides = (id) => id !== undefined && id !== "outside" && (!focus || id === focus);
  for (const k of lot.walls.keys()) {
    const { axis, x, z } = parseEdge(k);
    const far = axis === "h" ? roomOf(x + 0.5, sz > 0 ? z - 0.5 : z + 0.5) : roomOf(sx > 0 ? x - 0.5 : x + 0.5, z + 0.5);
    if (hides(far)) { cut.add(k); continue; }
    search: for (const u of [0.15, 0.5, 0.85]) {
      const px = axis === "h" ? x + u : x, pz = axis === "h" ? z : z + u;
      for (let t = 0.3; t <= REACH; t += 0.35) if (hides(roomOf(px - sx * t, pz - sz * t))) { cut.add(k); break search; }
    }
  }
  return cut;
}
