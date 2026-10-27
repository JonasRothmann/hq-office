// The simulation: a lot's placed objects and characters as entities in an ECS, acts turned into step queues, and the
// systems run in order. Headless and pure; createWorld adds the three.js side (one render-sync pass per frame).
import { createEcs } from "./ecs.js";
import { STEP_SYSTEMS, LAST_SYSTEMS } from "./systems/index.js";
import { RIG } from "../anim/clips.js";
import { planAct } from "../nav/act.js";
import { WorldError, problem } from "../model/problems.js";
import { facingAngle, poseOf } from "./motion.js";

/**
 * Components the engine uses (all plain data):
 *   placed    { type, tiles, facing }            a placed object
 *   character { look }                           a character
 *   body      { x, z, ry, hips }                 where a character is (metres, radians)
 *   anim      { clip, t, from, fadeT }           the clip playing and the cross-fade out of the last
 *   queue     { steps }                          steps still to start
 *   holding   { object, slot }                   the slot it has reserved
 *   stand | walk | turn | enter | loop | ...     the step in progress, one at a time
 *
 * @param {object} lot   from buildLot
 * @param {object} nav   from createNav
 * @param {{ systems?: import("./ecs.js").System[], emit?: (name: string, data: any) => void }} [opts]
 * @stability experimental
 */
export function createSim(lot, nav, opts = {}) {
  const ecs = createEcs();
  for (const s of [...STEP_SYSTEMS, ...(opts.systems ?? []), ...LAST_SYSTEMS]) ecs.system(s);
  const listeners = new Set();
  const waiting = new Map();
  const emit = (name, data) => {
    if (name === "act") { const done = waiting.get(data.who); waiting.delete(data.who); done?.(); }
    opts.emit?.(name, data);
    for (const fn of listeners) fn(name, data);
  };
  const ctx = { lot, nav, emit };

  for (const o of lot.objects) ecs.add(o.id, "placed", { type: o.type, tiles: o.tiles, facing: o.facing });
  for (const c of lot.characters) {
    ecs.add(c.id, "character", { look: c.look });
    ecs.add(c.id, "body", { x: c.tile[0] + 0.5, z: c.tile[1] + 0.5, ry: facingAngle(c.facing), hips: RIG.hip });
    ecs.add(c.id, "anim", { clip: "idle", t: 0, from: null, fadeT: 0 });
  }

  const tileOf = (b) => [Math.floor(b.x), Math.floor(b.z)];
  const stopSteps = (id) => { for (const k of ecs.stepKinds()) ecs.remove(id, k); ecs.remove(id, "queue"); };

  /** Plan an act and queue its steps; resolves when the character is in place, rejects with a WorldError. */
  function act(id, a) {
    const body = ecs.get(id, "body");
    if (!body || !ecs.has(id, "character")) return Promise.reject(new WorldError([problem("act.who", "act", `no character '${id}'`, `use one of: ${ecs.query("character").map(([c]) => c).join(", ")}`)]));
    const held = ecs.get(id, "holding");
    if (held) { nav.release(held.object, held.slot, id); ecs.remove(id, "holding"); }
    const plan = planAct(lot, nav, { id, tile: tileOf(body) }, a);
    if (plan.problem) return Promise.reject(new WorldError([plan.problem], "act"));
    if (plan.hold) { nav.reserve(plan.hold.object, plan.hold.slot, id); ecs.add(id, "holding", plan.hold); }
    const steps = [...plan.steps];
    if (body.hips < RIG.hip - 0.01) steps.unshift({ kind: "stand" });
    stopSteps(id);
    ecs.add(id, "queue", { steps });
    waiting.get(id)?.();
    return new Promise((resolve) => waiting.set(id, resolve));
  }

  const stepNow = (id) => ecs.stepKinds().find((k) => ecs.has(id, k)) ?? null;
  return {
    ecs, act,
    /** Advance by dt seconds; true while anything moves. */
    step: (dt) => ecs.step(dt, ctx),
    character(id) {
      const b = ecs.get(id, "body"), a = ecs.get(id, "anim");
      return b && { id, x: b.x, z: b.z, ry: b.ry, hips: b.hips, clip: a.clip, step: stepNow(id) };
    },
    characters: () => ecs.query("character").map(([id]) => id),
    pose: (id) => poseOf(ecs.get(id, "anim")),
    on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  };
}
