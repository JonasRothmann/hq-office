// Acts: "sit on chair-1" or "walk to (4, 6)" turned into steps the world runs: walk a path, turn, enter the slot with
// a transition clip, then loop the slot's clip. Pure.
import { tileKey } from "../model/grid.js";
import { simplify } from "./nav.js";
import { problem } from "../model/problems.js";

/**
 * @typedef {{ kind: "walk", points: [number, number][] }
 *   | { kind: "turn", facing: "n"|"e"|"s"|"w" }
 *   | { kind: "enter", to: [number, number], y: number, facing: "n"|"e"|"s"|"w", clip: string, object: string, slot: string }
 *   | { kind: "loop", clip: string }} Step
 */

const centre = ([x, z]) => [x + 0.5, z + 0.5];
const ENTER = { sit: "sit-down" };

// { steps } or { problem } when the act cannot be done (no such object, slot taken, no way there).
/** @stability stable */
export function planAct(lot, nav, who, act, path = "acts") {
  const from = who.tile;
  if (act.do === "walk") {
    const tiles = nav.path(from, [act.to]);
    if (!tiles) return { problem: problem("act.unreachable", path, `${who.id} cannot walk from (${from}) to (${act.to})`, "check that a door connects the two rooms and the tile is free") };
    return { steps: [{ kind: "walk", points: simplify(tiles).map(centre) }, { kind: "loop", clip: "idle" }] };
  }
  const o = lot.objects.find((x) => x.id === act.target);
  if (!o) return { problem: problem("act.target", path, `no object '${act.target}'`, `use one of: ${lot.objects.filter((x) => Object.keys(x.slots).length).map((x) => x.id).join(", ") || "(none with slots)"}`) };
  const slotName = act.slot ?? Object.keys(o.slots)[0];
  const slot = o.slots[slotName];
  if (!slot) return { problem: problem("act.slot", path, `${o.id} (${o.type}) has no slot '${act.slot}'`, `its slots: ${Object.keys(o.slots).join(", ") || "none"}`) };
  const holder = nav.holder(o.id, slotName);
  if (holder && holder !== who.id) return { problem: problem("act.taken", path, `${o.id}'s ${slotName} is held by ${holder}`, "pick another object or wait until it is free") };
  const stands = slot.stand.filter(([x, z]) => nav.walkable(x, z));
  const tiles = stands.length ? nav.path(from, stands) : null;
  if (!tiles) return { problem: problem("act.unreachable", path, `${who.id} at (${from}) cannot reach ${o.id}'s ${slotName}: stand tiles ${JSON.stringify(slot.stand)} are blocked or cut off`, "clear a stand tile (move what is on it) or connect the rooms with a door") };
  const steps = [];
  if (tiles.length > 1) steps.push({ kind: "walk", points: simplify(tiles).map(centre) });
  steps.push({ kind: "turn", facing: slot.facing });
  steps.push({ kind: "enter", to: slot.at, y: slot.y, facing: slot.facing, clip: ENTER[slot.clip] ?? slot.clip, object: o.id, slot: slotName });
  steps.push({ kind: "loop", clip: slot.clip });
  return { steps, slot: slotName, stand: tiles[tiles.length - 1] };
}

export const standKey = (t) => tileKey(t[0], t[1]);
