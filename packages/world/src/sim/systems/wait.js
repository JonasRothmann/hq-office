// The wait step: stand idle for s seconds (a visit's pause at someone's desk). Waiting is not motion, so it never
// keeps the view drawing by itself.
import { setClip } from "../motion.js";

export default {
  name: "wait",
  step: "wait",
  run(ecs, dt) {
    for (const [id, w, anim] of ecs.query("wait", "anim")) {
      setClip(anim, "idle");
      w.t += dt;
      if (w.t >= w.s) ecs.remove(id, "wait");
    }
  },
};
