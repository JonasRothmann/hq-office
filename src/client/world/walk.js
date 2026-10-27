// Paths for workers who leave their desk: out of the office door, along corridors, into the break area and back.
// Pure (no three.js): a breadth-first search over the plan's one-metre tiles, crossing walls only at doors.
import { tileMap } from "./plan.js";

const key = (x, z) => `${x},${z}`;
const OPEN = new Set(["corridor", "break"]);
const STEPS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

// From a point (world x, z) to the room `goal` (its id): the tile centres on the way, the first tile inside the goal
// last, with straight runs merged. Only the room the walk starts in, corridors, the break area and the goal are
// walked through. null when there is no way.
export function route(p, fromX, fromZ, goal) {
  const tiles = p.tiles ?? (p.tiles = tileMap(p.rooms));
  const solid = p.solid ?? (p.solid = new Set(p.walls.filter((w) => !w.door).map((w) => `${w.dir}:${w.x}:${w.z}`)));
  const start = [Math.floor(fromX), Math.floor(fromZ)];
  const home = tiles.get(key(...start));
  const walkable = (r) => r && (r === home || OPEN.has(r.kind) || r.id === goal);
  const prev = new Map([[key(...start), null]]);
  const queue = [start];
  for (let i = 0; i < queue.length; i++) {
    const [x, z] = queue[i];
    if (tiles.get(key(x, z))?.id === goal) {
      const out = [];
      for (let c = [x, z]; c; c = prev.get(key(...c))) out.unshift({ x: c[0] + 0.5, z: c[1] + 0.5 });
      return straighten(out);
    }
    for (const [dx, dz] of STEPS) {
      const nx = x + dx, nz = z + dz, k = key(nx, nz);
      if (prev.has(k) || !walkable(tiles.get(k))) continue;
      // the wall between two tiles: a "z" wall at the larger x for a step along x, an "x" wall at the larger z
      if (solid.has(dx ? `z:${Math.max(x, nx)}:${z}` : `x:${x}:${Math.max(z, nz)}`)) continue;
      prev.set(k, [x, z]);
      queue.push([nx, nz]);
    }
  }
  return null;
}

// Drops the middle of every straight run, so a walker turns only at corners.
function straighten(pts) {
  return pts.filter((p, i) => {
    if (i === 0 || i === pts.length - 1) return true;
    const a = pts[i - 1], b = pts[i + 1];
    return (p.x - a.x) * (b.z - p.z) !== (p.z - a.z) * (b.x - p.x);
  });
}
