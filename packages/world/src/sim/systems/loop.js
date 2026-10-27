// The loop step: play the act's clip (sit, type, idle) until the next act; the first frame of it ends the act, so it
// emits "act" once. It never removes itself: a new act clears it.
import { setClip } from "../motion.js";

export default {
  name: "loop",
  step: "loop",
  run(ecs, dt, { emit }) {
    for (const [id, l, anim] of ecs.query("loop", "anim")) {
      setClip(anim, l.clip);
      if (!l.done) { l.done = true; emit("act", { who: id, clip: l.clip }); }
    }
  },
};
