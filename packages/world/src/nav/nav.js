// Navigation on the tile grid: which tiles are free, A* through doors (never through walls or windows), and slot
// reservations so two characters never sit in one chair. Pure.
import { tileKey, edgeBetween } from "../model/grid.js";

const STEPS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

/**
 * @typedef {object} Nav
 * @property {(x: number, z: number) => boolean} walkable
 * @property {(ax: number, az: number, bx: number, bz: number) => boolean} canStep   one step, 4 or 8 neighbours
 * @property {(from: [number, number], goals: [number, number][]) => [number, number][]|null} path  tiles, start first
 * @property {(objectId: string, slot: string, who: string) => boolean} reserve
 * @property {(objectId: string, slot: string, who: string) => void} release
 * @property {(objectId: string, slot: string) => string|null} holder
 */

/** @stability stable  @returns {Nav} */
export function createNav(lot) {
  const { w, d } = lot;
  const walkable = (x, z) => x >= 0 && z >= 0 && x < w && z < d && !lot.blocked.has(tileKey(x, z));
  const wallOn = (e) => lot.walls.get(e);
  const crossable = (e) => { const wall = wallOn(e); return !wall || !!wall.opening?.def.passable; };
  const open = (e) => !wallOn(e); // no wall at all (diagonal moves never squeeze through a door)

  function canStep(ax, az, bx, bz) {
    if (!walkable(bx, bz)) return false;
    const dx = bx - ax, dz = bz - az;
    if (dx === 0 || dz === 0) return crossable(edgeBetween(ax, az, bx, bz));
    if (!walkable(ax + dx, az) || !walkable(ax, az + dz)) return false;
    return open(edgeBetween(ax, az, ax + dx, az)) && open(edgeBetween(ax + dx, az, bx, bz)) && open(edgeBetween(ax, az, ax, az + dz)) && open(edgeBetween(ax, az + dz, bx, bz));
  }

  // A* with octile distance to the nearest goal; ties broken by insertion order, so paths are deterministic.
  function path(from, goals) {
    const goalSet = new Set(goals.map(([x, z]) => tileKey(x, z)));
    if (!goalSet.size) return null;
    const h = ([x, z]) => Math.min(...goals.map(([gx, gz]) => { const a = Math.abs(gx - x), b = Math.abs(gz - z); return Math.max(a, b) + (Math.SQRT2 - 1) * Math.min(a, b); }));
    const start = tileKey(...from);
    const g = new Map([[start, 0]]), prev = new Map([[start, null]]);
    const open = [{ t: from, f: h(from), n: 0 }];
    let n = 0;
    const closed = new Set();
    while (open.length) {
      let bi = 0;
      for (let i = 1; i < open.length; i++) if (open[i].f < open[bi].f - 1e-9 || (Math.abs(open[i].f - open[bi].f) <= 1e-9 && open[i].n < open[bi].n)) bi = i;
      const { t } = open.splice(bi, 1)[0];
      const k = tileKey(...t);
      if (closed.has(k)) continue;
      closed.add(k);
      if (goalSet.has(k)) {
        const out = [];
        for (let c = k; c; c = prev.get(c)) out.unshift(c.split(",").map(Number));
        return out;
      }
      for (const [dx, dz] of STEPS) {
        const nx = t[0] + dx, nz = t[1] + dz;
        if (!canStep(t[0], t[1], nx, nz)) continue;
        const nk = tileKey(nx, nz);
        const ng = g.get(k) + (dx && dz ? Math.SQRT2 : 1);
        if (ng < (g.get(nk) ?? Infinity) - 1e-9) {
          g.set(nk, ng);
          prev.set(nk, k);
          open.push({ t: [nx, nz], f: ng + h([nx, nz]), n: ++n });
        }
      }
    }
    return null;
  }

  const held = new Map();
  return {
    walkable, canStep, path,
    reserve(objectId, slot, who) {
      const k = `${objectId}:${slot}`;
      if (held.has(k) && held.get(k) !== who) return false;
      held.set(k, who);
      return true;
    },
    release(objectId, slot, who) { const k = `${objectId}:${slot}`; if (held.get(k) === who) held.delete(k); },
    holder: (objectId, slot) => held.get(`${objectId}:${slot}`) ?? null,
  };
}

// Straight runs merged: only the tiles where the direction changes, plus both ends.
export function simplify(tiles) {
  if (tiles.length <= 2) return tiles;
  const out = [tiles[0]];
  for (let i = 1; i < tiles.length - 1; i++) {
    const [ax, az] = out[out.length - 1], [bx, bz] = tiles[i], [cx, cz] = tiles[i + 1];
    if (Math.sign(bx - ax) !== Math.sign(cx - bx) || Math.sign(bz - az) !== Math.sign(cz - bz)) out.push(tiles[i]);
  }
  out.push(tiles[tiles.length - 1]);
  return out;
}
