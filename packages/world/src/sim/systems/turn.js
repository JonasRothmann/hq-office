// The turn step: stand and turn to face n, e, s or w.
import { TURN_RATE, facingAngle, wrap, turnToward, setClip } from "../motion.js";

export default {
  name: "turn",
  step: "turn",
  run(ecs, dt) {
    let busy = false;
    for (const [id, t, body, anim] of ecs.query("turn", "body", "anim")) {
      setClip(anim, "idle");
      const to = facingAngle(t.facing);
      body.ry = turnToward(body.ry, to, TURN_RATE * dt);
      if (Math.abs(wrap(body.ry - to)) > 1e-3) busy = true; else ecs.remove(id, "turn");
    }
    return busy;
  },
};
