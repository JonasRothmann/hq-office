// The walk step: follow the points of a planned path at walking speed, turning toward each.
import { WALK_SPEED, TURN_RATE, turnToward, setClip } from "../motion.js";

export default {
  name: "walk",
  step: "walk",
  run(ecs, dt) {
    let busy = false;
    for (const [id, w, body, anim] of ecs.query("walk", "body", "anim")) {
      w.i ??= 1;
      setClip(anim, "walk");
      let left = WALK_SPEED * dt;
      while (left > 0 && w.i < w.points.length) {
        const [tx, tz] = w.points[w.i];
        const dx = tx - body.x, dz = tz - body.z, d = Math.hypot(dx, dz);
        if (d > 1e-6) body.ry = turnToward(body.ry, Math.atan2(dx, dz), TURN_RATE * dt * 1.5);
        if (d <= left) { body.x = tx; body.z = tz; left -= d; w.i++; } else { body.x += (dx / d) * left; body.z += (dz / d) * left; left = 0; }
      }
      if (w.i < w.points.length) busy = true; else ecs.remove(id, "walk");
    }
    return busy;
  },
};
