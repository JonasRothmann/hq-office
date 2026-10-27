// The wait step: stand idle for s seconds (a visit's pause at someone's desk).
import { setClip } from "../motion.js";

export default {
  name: "wait",
  step: "wait",
  run(ecs, dt) {
    let busy = false;
    for (const [id, w, anim] of ecs.query("wait", "anim")) {
      setClip(anim, "idle");
      w.t += dt;
      if (w.t < w.s) busy = true; else ecs.remove(id, "wait");
    }
    return busy;
  },
};
