// The anim system: advance every playing clip and its cross-fade. Runs after the step systems have chosen clips. It is
// busy while a cross-fade runs, including the step that ends it, so the view draws the clip it fades into.
import { FADE } from "../motion.js";

export default {
  name: "anim",
  run(ecs, dt) {
    let busy = false;
    for (const [, anim] of ecs.query("anim")) {
      if (anim.from && anim.fadeT < FADE) busy = true;
      anim.t += dt; anim.fadeT += dt;
    }
    return busy;
  },
};
