// Acts: "sit on chair-1", "walk to (4, 6)" or "visit desk-3, wait, then sit" turned into steps the world runs: walk
// a path, turn, wait, enter the slot with a transition clip, then loop the slot's clip. Pure.
import { simplify } from "./nav.js";
import { problem } from "../model/problems.js";

/**
 * @typedef {{ kind: "walk", points: [number, number][] }
 *   | { kind: "turn", facing: "n"|"e"|"s"|"w" }
 *   | { kind: "enter", to: [number, number], y: number, facing: "n"|"e"|"s"|"w", clip: string, object: string, slot: string }
 *   | { kind: "wait", s: number }
 *   | { kind: "loop", clip: string }} Step
 */

const centre = ([x, z]) => [x + 0.5, z + 0.5];
const ENTER = { sit: "sit-down" };

// { steps, hold? } (hold: the slot to reserve) or { problem } when the act cannot be done (no such object, slot taken, no way there).
/** @stability stable */
export function planAct(lot, nav, who, act, path = "acts") {
  const from = who.tile;
  if (act.do === "walk") {
    const tiles = nav.path(from, [act.to]);
    if (!tiles) return { problem: problem("act.unreachable", path, `${who.id} cannot walk from (${from}) to (${act.to})`, "check that a door connects the two rooms and the tile is free") };
    return { steps: [{ kind: "walk", points: simplify(tiles).map(centre) }, { kind: "loop", clip: "idle" }] };
  }
  if (act.do === "visit") return planVisit(lot, nav, who, act, path);
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
  steps.push({ kind: "loop", clip: act.clip ?? slot.clip });
  return { steps, hold: { object: o.id, slot: slotName }, stand: tiles[tiles.length - 1] };
}

// Visit: walk to a free tile beside an object, face it, wait, then do `then` (another act) from there, or stand idle.
// { do: "visit", target: "desk-3", wait: 4, then: { do: "sit", target: "chair-1", clip: "type" } }
const SIDE_OF = { "1,0": "w", "-1,0": "e", "0,1": "n", "0,-1": "s" };
function planVisit(lot, nav, who, act, path) {
  const o = lot.objects.find((x) => x.id === act.target);
  if (!o) return { problem: problem("act.target", path, `no object '${act.target}'`, `use one of: ${lot.objects.map((x) => x.id).join(", ")}`) };
  const own = new Set(o.tiles.map(([x, z]) => `${x},${z}`));
  const beside = o.tiles.flatMap(([x, z]) => [[x + 1, z], [x - 1, z], [x, z + 1], [x, z - 1]]).filter(([x, z]) => !own.has(`${x},${z}`) && nav.walkable(x, z));
  const tiles = beside.length ? nav.path(who.tile, beside) : null;
  if (!tiles) return { problem: problem("act.unreachable", path, `${who.id} at (${who.tile}) cannot reach a free tile beside ${o.id}`, "clear a tile next to it or connect the rooms with a door") };
  const stand = tiles[tiles.length - 1];
  const [ox, oz] = o.tiles.find(([x, z]) => Math.abs(x - stand[0]) + Math.abs(z - stand[1]) === 1);
  const steps = [];
  if (tiles.length > 1) steps.push({ kind: "walk", points: simplify(tiles).map(centre) });
  steps.push({ kind: "turn", facing: SIDE_OF[`${stand[0] - ox},${stand[1] - oz}`] });
  steps.push({ kind: "wait", s: act.wait ?? 3 });
  if (!act.then) return { steps: [...steps, { kind: "loop", clip: "idle" }], stand };
  const next = planAct(lot, nav, { id: who.id, tile: stand }, act.then, `${path}.then`);
  return next.problem ? next : { steps: [...steps, ...next.steps], hold: next.hold, stand: next.stand };
}
