// A clump of seven thin grass blades arching out from the root, about 30 cm high.
import { defineObject } from "@hq/world/model";

export default defineObject({
  id: "grass-clump",
  kind: "scenery",
  height: 0.3,
  build(k) {
    for (let i = 0; i < 7; i++) {
      const a = i * 0.9, h = 0.3 - (i % 3) * 0.05, lean = 0.35 + (i % 3) * 0.15;
      // the blade's tip leans toward its outward direction a
      k.box("blade", [0.04, h, 0.008], [Math.cos(a) * 0.02, 0, Math.sin(a) * 0.02], i % 2 ? "grass" : "grass-2", {
        rot: [0, Math.PI - a, lean],
        omit: ["-y"],
      });
    }
  },
});
