// The simulation: a lot's characters as entities in an ECS, acts turned into step queues, and the systems run in
// order. Every bit of running state is a component (where each character is, what it does, which slot it holds), so
// ecs.toJSON() saves it all. apply() takes an edited lot without a restart. Headless and pure; createWorld adds the
// three.js side (one render-sync pass per frame).
import { createEcs } from "./ecs.js";
import { STEP_SYSTEMS, LAST_SYSTEMS } from "./systems/index.js";
import { RIG } from "../anim/clips.js";
import { planAct } from "../nav/act.js";
import { WorldError, problem } from "../model/problems.js";
import { facingAngle, poseOf } from "./motion.js";

/**
 * Components the engine uses (all plain data):
 *   character { look }                           a character
 *   body      { x, z, ry, hips }                 where a character is (metres, radians)
 *   anim      { clip, t, from, fadeT }           the clip playing and the cross-fade out of the last
 *   doing     { act }                            the act in progress (replanned when an edit gets in its way)
 *   holding   { object, slot }                   the slot it holds: the only record of a reservation
 *   queue     { steps }                          steps still to start
 *   stand | walk | turn | enter | wait | then | loop | ...   the step in progress, one at a time
 *
 * Events (opts.emit and on()): "act" { who, clip } when an act is done; "cancel" { who, problem } when an act could
 * not go on; "error" { system, message } when a system threw and was switched off.
 *
 * @param {object} lot   from buildLot
 * @param {object} nav   from createNav
 * @param {{ systems?: import("./ecs.js").System[], emit?: (name: string, data: any) => void }} [opts]
 * @stability experimental
 */
export function createSim(lot, nav, opts = {}) {
  const listeners = new Set();
  const waiting = new Map();   // id → { resolve, reject }: promises are not state, so they stay outside the ECS
  const emit = (name, data) => {
    if (name === "act") settle(data.who);
    opts.emit?.(name, data);
    for (const fn of listeners) fn(name, data);
  };
  const ecs = createEcs({ onError: (system, e) => {
    console.error(`@hq/world: system '${system}' threw and is switched off: ${e?.message ?? e}`);
    emit("error", { system, message: String(e?.message ?? e) });
  }, onLoad: () => reconcile(new Set()) });
  for (const s of [...STEP_SYSTEMS, ...(opts.systems ?? []), ...LAST_SYSTEMS]) ecs.system(s);
  const ctx = { lot, nav, emit, replan: (id, a) => { const p = start(id, a); if (p) cancel(id, p); }, cancel: (id, p) => cancel(id, p) };

  function settle(id, error) {
    const w = waiting.get(id);
    if (!w) return;
    waiting.delete(id);
    if (error) w.reject(error); else w.resolve();
  }

  function spawn(c) {
    ecs.add(c.id, "character", { look: c.look });
    ecs.add(c.id, "body", { x: c.tile[0] + 0.5, z: c.tile[1] + 0.5, ry: facingAngle(c.facing), hips: RIG.hip });
    ecs.add(c.id, "anim", { clip: "idle", t: 0, from: null, fadeT: 0 });
  }
  for (const c of lot.characters) spawn(c);

  const tileOf = (b) => [Math.floor(b.x), Math.floor(b.z)];
  const stopSteps = (id) => { for (const k of ecs.stepKinds()) ecs.remove(id, k); ecs.remove(id, "queue"); };
  /** Who holds a slot: read from the `holding` components. */
  const holder = (object, slot) => ecs.query("holding").find(([, h]) => h.object === object && h.slot === slot)?.[0] ?? null;

  // Plan an act from where the character is and queue it. Returns the problem, changing nothing, when it cannot be
  // done; its own hold never blocks it.
  function start(id, a) {
    const body = ecs.get(id, "body");
    const others = (o, s) => { const h = holder(o, s); return h === id ? null : h; };
    const plan = planAct(ctx.lot, ctx.nav, { id, tile: tileOf(body) }, a, { at: "act", holder: others });
    if (plan.problem) return plan.problem;
    if (plan.hold) ecs.add(id, "holding", { ...plan.hold }); else ecs.remove(id, "holding");
    const steps = structuredClone(plan.steps);
    if (body.hips < RIG.hip - 0.01) steps.unshift({ kind: "stand" });
    stopSteps(id);
    ecs.add(id, "queue", { steps });
    ecs.add(id, "doing", { act: structuredClone(a) });
    return null;
  }

  // Stop an act that cannot go on: stand up, let go of the slot, idle, and reject the act's promise. A character left
  // inside an object (a seat that became something else) walks off it.
  function cancel(id, p) {
    const body = ecs.get(id, "body");
    stopSteps(id);
    ecs.remove(id, "holding");
    ecs.remove(id, "doing");
    const steps = [{ kind: "loop", clip: "idle", done: true }];
    if (body && body.hips < RIG.hip - 0.01) steps.unshift({ kind: "stand" });
    if (body) ecs.add(id, "queue", { steps });
    settle(id, new WorldError([p], "act"));
    emit("cancel", { who: id, problem: p });
    if (body && !ctx.nav.walkable(...tileOf(body))) stepOff(id, body);
  }

  /** Plan an act and queue its steps; resolves when the character is in place, rejects with a WorldError. */
  function act(id, a) {
    if (!ecs.has(id, "body") || !ecs.has(id, "character")) return Promise.reject(new WorldError([problem("act.who", "act", `no character '${id}'`, `use one of: ${ecs.query("character").map(([c]) => c).join(", ")}`)]));
    const p = start(id, a);
    if (p) return Promise.reject(new WorldError([p], "act"));
    settle(id); // the act this one replaces is over
    return new Promise((resolve, reject) => waiting.set(id, { resolve, reject }));
  }

  // The tiles a walk still has to cross, step by step, are all open in the current lot.
  function routeOpen(id) {
    const runs = [];
    const w = ecs.get(id, "walk");
    if (w) runs.push(w.points.slice(Math.max(0, (w.i ?? 1) - 1)));
    for (const s of ecs.get(id, "queue")?.steps ?? []) if (s.kind === "walk") runs.push(s.points);
    return runs.every((pts) => pts.every((p, i) => i === 0 || stepsOpen(ctx.nav, pts[i - 1], p)));
  }
  const busy = (id) => ecs.has(id, "queue") || ecs.stepKinds().some((k) => k !== "loop" && ecs.has(id, k));
  const targets = (a) => (a ? [a.target, ...targets(a.then)].filter(Boolean) : []);

  /**
   * Take an edited lot without a restart. diff is diffWorld(old doc, new doc). Characters keep walking; a walk whose
   * way is now shut, or an act whose object moved or went, is planned again from where the character is, or
   * cancelled when it cannot be done any more; a character left standing on a tile that is now blocked walks off it.
   * Nothing jumps, except a character outside a lot that shrank, which is moved onto the nearest tile inside.
   */
  function apply(nextLot, nextNav, diff) {
    ctx.lot = nextLot;
    ctx.nav = nextNav;
    for (const id of diff.characters.removed) {
      settle(id, new WorldError([problem("character.removed", "characters", `character '${id}' was removed`, "this act's character no longer exists")], "act"));
      ecs.despawn(id);
    }
    for (const c of nextLot.characters) if (!ecs.has(c.id, "character")) spawn(c);
    for (const id of diff.characters.changed) { const c = nextLot.characters.find((x) => x.id === id); if (c) ecs.get(id, "character").look = c.look; }
    const touched = new Set([...diff.objects.removed, ...diff.objects.changed]);
    if (!diff.lot && !diff.objects.added.length && !touched.size) return;
    reconcile(touched);
  }

  // Bring every character in line with the lot: inside it, its act's objects there and untouched, its route open, and
  // not inside an object. After an edit (touched: the objects it changed) or a load (a save may name objects this
  // lot does not have).
  function reconcile(touched) {
    const has = new Map(ctx.lot.objects.map((o) => [o.id, o]));
    const lost = (o, slot) => touched.has(o) || !has.has(o) || (slot !== undefined && !has.get(o).slots[slot]);
    for (const [id, body] of ecs.query("body")) {
      if (body.x < 0 || body.z < 0 || body.x >= ctx.lot.w || body.z >= ctx.lot.d) {
        body.x = Math.min(Math.max(body.x, 0.5), ctx.lot.w - 0.5);
        body.z = Math.min(Math.max(body.z, 0.5), ctx.lot.d - 0.5);
      }
      const doing = ecs.get(id, "doing")?.act;
      const hold = ecs.get(id, "holding");
      const hit = (hold && lost(hold.object, hold.slot)) || targets(doing).some((t) => lost(t));
      if (hit || (busy(id) && !routeOpen(id))) { if (doing) ctx.replan(id, doing); else cancel(id, problem("act.blocked", "act", `${id}'s way is shut`, "give it a new act")); continue; }
      if (!hold && !ctx.nav.walkable(...tileOf(body))) stepOff(id, body);
    }
  }

  // Walk to the nearest free tile (a character standing where an object now is). Not an act: no "act" event at the end.
  function stepOff(id, body) {
    const [x, z] = tileOf(body);
    for (let r = 1; r <= 6; r++) {
      const ring = [];
      for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) if (Math.max(Math.abs(dx), Math.abs(dz)) === r && ctx.nav.walkable(x + dx, z + dz)) ring.push([x + dx, z + dz]);
      const tiles = ring.length ? ctx.nav.path([x, z], ring) : null;
      if (tiles && !start(id, { do: "walk", to: tiles[tiles.length - 1] })) {
        ecs.remove(id, "doing");
        for (const s of ecs.get(id, "queue").steps) if (s.kind === "loop") s.done = true;
        return;
      }
    }
  }

  const stepNow = (id) => ecs.stepKinds().find((k) => ecs.has(id, k)) ?? null;
  return {
    ecs, act, apply,
    /** Advance by dt seconds; true while anything moves. */
    step: (dt) => ecs.step(dt, ctx),
    character(id) {
      const b = ecs.get(id, "body"), a = ecs.get(id, "anim");
      return b && { id, x: b.x, z: b.z, ry: b.ry, hips: b.hips, clip: a.clip, step: stepNow(id) };
    },
    characters: () => ecs.query("character").map(([id]) => id),
    /** Who holds a slot, from the `holding` components. */
    holder,
    pose: (id) => poseOf(ecs.get(id, "anim")),
    on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  };
}

// Every step between two tile centres of a simplified path (a straight or diagonal run) can still be taken.
function stepsOpen(nav, a, b) {
  let x = Math.floor(a[0]), z = Math.floor(a[1]);
  const bx = Math.floor(b[0]), bz = Math.floor(b[1]);
  while (x !== bx || z !== bz) {
    const nx = x + Math.sign(bx - x), nz = z + Math.sign(bz - z);
    if (!nav.canStep(x, z, nx, nz)) return false;
    x = nx; z = nz;
  }
  return true;
}
