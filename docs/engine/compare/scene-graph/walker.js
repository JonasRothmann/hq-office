// The rival design for the ECS comparison (docs/engine/rfc.md 2.12): characters as one plain state object each and
// one step interpreter, the way phase 1's createWorld ran them, pulled out of the renderer so it runs headless.
import { planAct } from "../../../../packages/world/src/nav/act.js";
import { RIG, CLIPS } from "../../../../packages/world/src/anim/clips.js";
import { WorldError } from "../../../../packages/world/src/model/problems.js";
import { WALK_SPEED, TURN_RATE, facingAngle, wrap, ease, floorAt, turnToward, setClip } from "../../../../packages/world/src/sim/motion.js";

export function createWalkers(lot, nav, emit = () => {}) {
  const chars = new Map();
  for (const c of lot.characters) {
    chars.set(c.id, { id: c.id, x: c.tile[0] + 0.5, z: c.tile[1] + 0.5, ry: facingAngle(c.facing), hips: RIG.hip,
      anim: { clip: "idle", t: 0, from: null, fadeT: 0 }, steps: [], si: 0, stepState: null, holding: null });
  }
  const waiting = new Map();
  const tileOf = (c) => [Math.floor(c.x), Math.floor(c.z)];

  function act(id, a) {
    const c = chars.get(id);
    if (!c) return Promise.reject(new WorldError([{ code: "act.who", severity: "error", path: "act", message: `no character '${id}'`, fix: `use one of: ${[...chars.keys()].join(", ")}` }]));
    if (c.holding) { nav.release(c.holding.object, c.holding.slot, id); c.holding = null; }
    const plan = planAct(lot, nav, { id, tile: tileOf(c) }, a);
    if (plan.problem) return Promise.reject(new WorldError([plan.problem], "act"));
    if (plan.hold) { nav.reserve(plan.hold.object, plan.hold.slot, id); c.holding = plan.hold; }
    const steps = [...plan.steps];
    if (c.hips < RIG.hip - 0.01) steps.unshift({ kind: "stand" });
    c.steps = steps; c.si = 0; c.stepState = null;
    return new Promise((resolve) => waiting.set(id, resolve));
  }

  function update(c, dt) {
    let busy = false;
    while (c.si < c.steps.length) {
      const s = c.steps[c.si];
      if (!c.stepState) c.stepState = { t: 0, i: 1, from: [c.x, c.z], hips: c.hips };
      const st = c.stepState;
      st.t += dt;
      if (s.kind === "stand") {
        setClip(c.anim, "idle");
        const k = Math.min(1, st.t / 0.4);
        c.hips = st.hips + (RIG.hip - st.hips) * ease(k);
        if (k < 1) { busy = true; break; }
      } else if (s.kind === "walk") {
        setClip(c.anim, "walk");
        let left = WALK_SPEED * dt;
        while (left > 0 && st.i < s.points.length) {
          const [tx, tz] = s.points[st.i];
          const dx = tx - c.x, dz = tz - c.z, d = Math.hypot(dx, dz);
          if (d > 1e-6) c.ry = turnToward(c.ry, Math.atan2(dx, dz), TURN_RATE * dt * 1.5);
          if (d <= left) { c.x = tx; c.z = tz; left -= d; st.i++; } else { c.x += (dx / d) * left; c.z += (dz / d) * left; left = 0; }
        }
        if (st.i < s.points.length) { busy = true; break; }
      } else if (s.kind === "turn") {
        setClip(c.anim, "idle");
        c.ry = turnToward(c.ry, facingAngle(s.facing), TURN_RATE * dt);
        if (Math.abs(wrap(c.ry - facingAngle(s.facing))) > 1e-3) { busy = true; break; }
      } else if (s.kind === "enter") {
        setClip(c.anim, s.clip);
        const k = Math.min(1, st.t / (CLIPS[s.clip]?.dur ?? 0.5));
        c.x = st.from[0] + (s.to[0] - st.from[0]) * ease(k);
        c.z = st.from[1] + (s.to[1] - st.from[1]) * ease(k);
        const seat = s.y !== undefined ? s.y - floorAt(lot, c.x, c.z) + 0.06 : RIG.hip;
        c.hips = st.hips + (seat - st.hips) * ease(k);
        c.ry = turnToward(c.ry, facingAngle(s.facing), TURN_RATE * dt);
        if (k < 1) { busy = true; break; }
      } else if (s.kind === "wait") {
        setClip(c.anim, "idle");
        if (st.t < s.s) { busy = true; break; }
      } else if (s.kind === "loop") {
        setClip(c.anim, s.clip);
        const done = waiting.get(c.id);
        if (done) { waiting.delete(c.id); emit("act", { who: c.id, clip: s.clip }); done(); }
        break;
      }
      c.si++;
      c.stepState = null;
    }
    c.anim.t += dt;
    c.anim.fadeT += dt;
    return busy;
  }

  return {
    act,
    step(dt) { let busy = false; for (const c of chars.values()) busy = update(c, dt) || busy; return busy; },
    get: (id) => chars.get(id),
    toJSON: () => Object.fromEntries([...chars].map(([id, c]) => [id, { ...c, anim: { ...c.anim, from: null } }])),
  };
}
