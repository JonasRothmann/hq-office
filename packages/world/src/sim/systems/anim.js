// The anim system: advance every playing clip and its cross-fade. Runs after the step systems have chosen clips.
export default {
  name: "anim",
  run(ecs, dt) {
    for (const [, anim] of ecs.query("anim")) { anim.t += dt; anim.fadeT += dt; }
  },
};
