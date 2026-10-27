// The enter step: move from the stand tile into a slot (onto a seat) while its transition clip plays, lowering the
// hips to the slot's height.
import { RIG, CLIPS } from "../../anim/clips.js";
import { TURN_RATE, ease, facingAngle, floorAt, turnToward, setClip } from "../motion.js";

export default {
  name: "enter",
  step: "enter",
  run(ecs, dt, { lot }) {
    let busy = false;
    for (const [id, e, body, anim] of ecs.query("enter", "body", "anim")) {
      e.from ??= [body.x, body.z];
      e.hips0 ??= body.hips;
      e.t += dt;
      setClip(anim, e.clip);
      const k = Math.min(1, e.t / (CLIPS[e.clip]?.dur ?? 0.5));
      body.x = e.from[0] + (e.to[0] - e.from[0]) * ease(k);
      body.z = e.from[1] + (e.to[1] - e.from[1]) * ease(k);
      const seat = e.y !== undefined ? e.y - floorAt(lot, body.x, body.z) + 0.06 : RIG.hip;
      body.hips = e.hips0 + (seat - e.hips0) * ease(k);
      body.ry = turnToward(body.ry, facingAngle(e.facing), TURN_RATE * dt);
      if (k < 1) busy = true; else ecs.remove(id, "enter");
    }
    return busy;
  },
};
