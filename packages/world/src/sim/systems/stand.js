// The stand step: a seated character rises to standing hip height in 0.4 s.
import { RIG } from "../../anim/clips.js";
import { ease, setClip } from "../motion.js";

export default {
  name: "stand",
  step: "stand",
  run(ecs, dt) {
    let busy = false;
    for (const [id, s, body, anim] of ecs.query("stand", "body", "anim")) {
      s.hips0 ??= body.hips;
      s.t += dt;
      setClip(anim, "idle");
      const k = Math.min(1, s.t / 0.4);
      body.hips = s.hips0 + (RIG.hip - s.hips0) * ease(k);
      if (k < 1) busy = true; else ecs.remove(id, "stand");
    }
    return busy;
  },
};
