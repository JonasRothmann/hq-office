// Acts: "sit on chair-1", "walk to (4, 6)" or "visit desk-3, wait, then sit" turned into steps the world runs: walk
// a path, turn, wait, enter the slot with a transition clip, then loop the slot's clip. Pure.
import { simplify } from "./nav.js";
import { problem, closest } from "../model/problems.js";
import { CLIPS } from "../anim/clips.js";

/**
 * @typedef {{ kind: "walk", points: [number, number][] }
 *   | { kind: "turn", facing: "n"|"e"|"s"|"w" }
 *   | { kind: "enter", to: [number, number], y: number, facing: "n"|"e"|"s"|"w", clip: string, object: string, slot: string }
 *   | { kind: "wait", s: number }
 *   | { kind: "then", act: object }
 *   | { kind: "loop", clip: string }} Step
 */

export const ACTS = ["sit", "use", "walk", "visit"];
const centre = ([x, z]) => [x + 0.5, z + 0.5];
const ENTER = { sit: "sit-down" };

/**
 * { steps, hold?, stand? } (hold: the slot to reserve) or { problem } when the act cannot be done (no such object,
 * slot taken, no way there).
 * @param {{ at?: string, holder?: (object: string, slot: string) => string|null }} [opts]
 *   at: the path problems name; holder: who holds a slot now (the sim's `holding` components)
 * @stability stable
 */
export function planAct(lot, nav, who, act, { at = "acts", holder = () => null } = {}) {
  const path = at;
  if (!ACTS.includes(act?.do)) {
    const near = closest(String(act?.do), ACTS);
    return { problem: problem("act.do", `${path}.do`, `'${act?.do}' is not an act`, `use ${near.length ? near.join(" or ") : ACTS.join(", ")}`) };
  }
  if (act.clip !== undefined && !CLIPS[act.clip]) return { problem: clipProblem(act.clip, `${path}.clip`) };
  const from = who.tile;
  if (act.do === "walk") {
    const tiles = nav.path(from, [act.to]);
    if (!tiles) return { problem: problem("act.unreachable", path, `${who.id} cannot walk from (${from}) to (${act.to})`, "check that a door connects the two rooms and the tile is free") };
    return { steps: [{ kind: "walk", points: simplify(tiles).map(centre) }, { kind: "loop", clip: act.clip ?? "idle" }], stand: tiles[tiles.length - 1] };
  }
  if (act.do === "visit") return planVisit(lot, nav, who, act, path, holder);
  const o = lot.objects.find((x) => x.id === act.target);
  if (!o) return { problem: problem("act.target", path, `no object '${act.target}'`, `use one of: ${lot.objects.filter((x) => Object.keys(x.slots).length).map((x) => x.id).join(", ") || "(none with slots)"}`) };
  const slotName = act.slot ?? Object.keys(o.slots)[0];
  const slot = o.slots[slotName];
  if (!slot) return { problem: problem("act.slot", path, `${o.id} (${o.type}) has no slot '${act.slot}'`, `its slots: ${Object.keys(o.slots).join(", ") || "none"}`) };
  const held = holder(o.id, slotName);
  if (held && held !== who.id) return { problem: problem("act.taken", path, `${o.id}'s ${slotName} is held by ${held}`, "pick another object or wait until it is free") };
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

// A clip name that is not in CLIPS, with the nearest names.
export function clipProblem(clip, path) {
  const near = closest(String(clip), Object.keys(CLIPS));
  return problem("clip.unknown", path, `'${clip}' is not a clip`, near.length ? `did you mean ${near.join(" or ")}?` : `use one of: ${Object.keys(CLIPS).join(", ")}`);
}

// Visit: walk to a free tile beside an object, face it, wait, then do `then` (another act) from there, or stand idle.
// { do: "visit", target: "desk-3", wait: 4, then: { do: "sit", target: "chair-1", clip: "type" } }
// `then` is checked now (and its slot held from now on), but planned when the wait ends, from where the visitor
// stands then, so an edit to the world in the meantime is seen.
const SIDE_OF = { "1,0": "w", "-1,0": "e", "0,1": "n", "0,-1": "s" };
function planVisit(lot, nav, who, act, path, holder) {
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
  const next = planAct(lot, nav, { id: who.id, tile: stand }, act.then, { at: `${path}.then`, holder });
  return next.problem ? next : { steps: [...steps, { kind: "then", act: act.then }], hold: next.hold, stand: next.stand };
}
