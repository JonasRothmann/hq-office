// A café table under a parasol: a round top on an iron post, two chairs facing it, a white canopy 2.2 m up.
import { defineObject } from "@hq/world/model";
import { cone } from "./look/shapes.js";

export default defineObject({
  id: "cafe-table",
  kind: "scenery",
  height: 2.23,
  build(k) {
    k.cyl("post", 0.04, 0.72, [0, 0, 0], "iron", { seg: 4 });
    k.cyl("top", 0.34, 0.04, [0, 0.72, 0], "frame", { seg: 8 });
    k.cyl("pole", 0.03, 1.24, [0, 0.76, 0], "iron", { seg: 4 });
    cone(k, "canopy", 1.05, 0.38, [0, 1.85, 0], "#ffffff", { seg: 8 });
    // each chair at x ±0.6 turns to face the table; its back is on its far side (-z in its own frame)
    for (const x of [-0.6, 0.6]) {
      const f = Math.atan2(-x, 0), c = Math.cos(f), s = Math.sin(f);
      const at = (lx, lz, y) => [x + c * lx + s * lz, y, -s * lx + c * lz];
      k.box("seat", [0.32, 0.05, 0.32], at(0, 0, 0.42), "bench", { rot: [0, f, 0], omit: ["-y"] });
      k.box("back", [0.32, 0.4, 0.05], at(0, -0.145, 0.47), "bench", { rot: [0, f, 0], omit: ["-y"] });
      k.cyl("leg", 0.025, 0.42, at(0, 0, 0), "iron", { seg: 4 });
    }
  },
});
