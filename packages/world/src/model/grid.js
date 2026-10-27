// The grid: the engine's numbers, tile and edge keys, sides and quarter turns. Pure, no three.js.
//
// Units are metres; one tile is one metre. x runs east, z runs south, y is up. Tile (x, z) covers [x, x+1) × [z, z+1).
// An edge is named "h:x,z" (along x, from (x, z) to (x+1, z): between tile (x, z-1) and tile (x, z)) or "v:x,z"
// (along z, from (x, z) to (x, z+1): between tile (x-1, z) and tile (x, z)).

export const WALL_H = 2.95;   // a full wall, floor to cap (Sims 1: 2.95 tiles)
export const KERB_H = 0.35;   // a cut wall (12 % of full height)
export const WALL_T = 0.15;   // wall thickness, centred on the tile edge
export const FLOOR_Y = 0.06;  // the top of a floor slab above the ground: floor and ground never share a plane
export const SIDES = ["n", "e", "s", "w"];

export const tileKey = (x, z) => `${x},${z}`;
export const parseTile = (k) => k.split(",").map(Number);

// The edge on `side` of tile (x, z).
export function sideEdge(x, z, side) {
  switch (side) {
    case "n": return `h:${x},${z}`;
    case "s": return `h:${x},${z + 1}`;
    case "w": return `v:${x},${z}`;
    case "e": return `v:${x + 1},${z}`;
    default: return null;
  }
}

// { axis, x, z } of an edge key.
export function parseEdge(key) {
  const [axis, rest] = key.split(":");
  const [x, z] = rest.split(",").map(Number);
  return { axis, x, z };
}

// The two tiles an edge separates: [before, after] (north then south for "h", west then east for "v").
export function edgeTiles(key) {
  const { axis, x, z } = parseEdge(key);
  return axis === "h" ? [[x, z - 1], [x, z]] : [[x - 1, z], [x, z]];
}

// The edge between two 4-neighbour tiles, or null when they are not neighbours.
export function edgeBetween(ax, az, bx, bz) {
  if (az === bz && Math.abs(ax - bx) === 1) return `v:${Math.max(ax, bx)},${az}`;
  if (ax === bx && Math.abs(az - bz) === 1) return `h:${ax},${Math.max(az, bz)}`;
  return null;
}

// Quarter turns: an object facing "s" is unturned (its front, local +z, points south); "e" is a quarter turn.
export const QUARTER = { s: 0, e: 1, n: 2, w: 3 };
export const SIDE_OF_QUARTER = ["s", "e", "n", "w"];
export const SIDE_VEC = { n: [0, -1], e: [1, 0], s: [0, 1], w: [-1, 0] };

// A local (x, z) vector turned by q quarter turns (the same turn as three.js rotation.y = q·π/2).
export function turn([lx, lz], q) {
  switch (((q % 4) + 4) % 4) {
    case 1: return [lz, -lx];
    case 2: return [-lx, -lz];
    case 3: return [-lz, lx];
    default: return [lx, lz];
  }
}

// A local side (where something faces in an object's own frame) to a world side, for an object turned q quarters.
export function turnSide(side, q) {
  const [x, z] = turn(SIDE_VEC[side], q);
  return Object.keys(SIDE_VEC).find((s) => SIDE_VEC[s][0] === Math.round(x) && SIDE_VEC[s][1] === Math.round(z));
}

// The unit edges of a wall path ([[x, z], ...], each leg along x or along z).
export function pathEdges(path) {
  const out = [];
  for (let i = 1; i < path.length; i++) {
    const [ax, az] = path[i - 1], [bx, bz] = path[i];
    if (az === bz) for (let x = Math.min(ax, bx); x < Math.max(ax, bx); x++) out.push(`h:${x},${az}`);
    else for (let z = Math.min(az, bz); z < Math.max(az, bz); z++) out.push(`v:${ax},${z}`);
  }
  return out;
}

// A closed wall path round a rectangle of tiles.
export function rect(x, z, w, d) {
  return [[x, z], [x + w, z], [x + w, z + d], [x, z + d], [x, z]];
}
