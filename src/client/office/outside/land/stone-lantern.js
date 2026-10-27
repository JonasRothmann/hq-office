// A stone lantern about 1.4 m: a plinth, a round post, a lit paper box between four corner posts, a flat cap, a roof and a knob.
import { defineObject } from "@hq/world/model";
import { ball } from "./look/shapes.js";

export default defineObject({
  id: "stone-lantern",
  kind: "scenery",
  height: 1.43,
  build(k) {
    k.box("plinth", [0.6, 0.14, 0.6], [0, 0, 0], "garden-stone");
    k.cyl("post", 0.11, 0.55, [0, 0.14, 0], "garden-stone-2", { seg: 8 });
    k.box("block", [0.46, 0.08, 0.46], [0, 0.69, 0], "garden-stone", { omit: ["-y"] });
    const by = 0.77;
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      k.box("corner", [0.08, 0.34, 0.08], [sx * 0.15, by, sz * 0.15], "garden-stone-2", { omit: ["-y"] });
    }
    k.glow("light", [0.24, 0.26, 0.24], [0, by + 0.04, 0], "lantern-paper");
    k.box("cap", [0.78, 0.07, 0.78], [0, by + 0.34, 0], "garden-stone", { omit: ["-y"] });
    // a four-sided roof
    k.cyl("roof", 0.5, 0.12, [0, by + 0.41, 0], "garden-stone-2", { top: 0.12, seg: 4, rot: [0, Math.PI / 4, 0] });
    ball(k, "knob", 0.07, [0, by + 0.52, 0], "garden-stone", { seg: 4 });
  },
});
