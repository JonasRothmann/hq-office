// An ASCII map of a lot, so an agent sees where things are before it places more: walls on tile edges, doors and
// windows, objects by letter, characters by digit, floors. check.ts --map prints it. Pure.
import { parseEdge } from "../model/grid.js";

const LETTERS = "abcdefghijklmnopqrstuvwxyzABCEFGHIJKLMNOPQRSTUVXYZ"; // no D or W: those mark doors and windows

/**
 * Each tile is one character with its west edge to its left and its north edge above it:
 *   .  floor     ,  ground     a-z A-Z  an object (see the legend)     1-9  a character
 *   | -  a wall   D  a door (an opening you walk through)   W  a window (one you do not)   +  where walls meet
 * x runs east along the top, z runs south down the side.
 * @param {import("./lot.js").Lot} lot
 * @param {{ characters?: { id: string, x: number, z: number }[] }} [opts]   where characters are now (default: the lot's)
 * @returns {string}
 * @stability experimental
 */
export function lotMap(lot, { characters } = {}) {
  const W = lot.w * 2 + 1, H = lot.d * 2 + 1;
  const g = Array.from({ length: H }, (_, r) => Array.from({ length: W }, (_, c) => (r % 2 && c % 2 ? "," : " ")));
  for (const k of lot.floor.keys()) { const [x, z] = k.split(",").map(Number); g[z * 2 + 1][x * 2 + 1] = "."; }
  const legend = [];
  lot.objects.forEach((o, i) => {
    const c = LETTERS[i] ?? "*";
    for (const [x, z] of o.tiles) g[z * 2 + 1][x * 2 + 1] = c;
    legend.push(`${c}  ${o.id} (${o.type}) at (${o.tiles[0]}) facing ${o.facing}${o.tiles.length > 1 ? `, covers ${o.tiles.map((t) => `(${t})`).join(" ")}` : ""}${o.def.blocks ? "" : ", walkable"}`);
  });
  const who = characters ?? lot.characters.map((c) => ({ id: c.id, x: c.tile[0] + 0.5, z: c.tile[1] + 0.5 }));
  who.forEach((c, i) => {
    const d = i < 9 ? String(i + 1) : "@";
    g[Math.floor(c.z) * 2 + 1][Math.floor(c.x) * 2 + 1] = d;
    legend.push(`${d}  ${c.id} at (${Math.floor(c.x)},${Math.floor(c.z)})`);
  });
  for (const [key, wall] of lot.walls) {
    const { axis, x, z } = parseEdge(key);
    const mark = wall.opening ? (wall.opening.def.passable ? "D" : "W") : axis === "h" ? "-" : "|";
    if (axis === "h") { g[z * 2][x * 2 + 1] = mark; g[z * 2][x * 2] = "+"; g[z * 2][x * 2 + 2] = "+"; }
    else { g[z * 2 + 1][x * 2] = mark; g[z * 2][x * 2] = "+"; g[z * 2 + 2][x * 2] = "+"; }
  }
  const head = "     " + Array.from({ length: lot.w }, (_, x) => ` ${x % 10}`).join("");
  const rows = g.map((r, i) => (i % 2 ? String((i - 1) / 2).padStart(3) + "  " : "     ") + r.join("").replace(/\s+$/, ""));
  const rooms = lot.rooms.map((r) => `${r.id} (${r.tiles.length} tiles, from (${r.tiles[0]}))`).join(", ");
  return [head, ...rows, "", ...legend, ...(rooms ? [`rooms: ${rooms}`] : [])].join("\n");
}
