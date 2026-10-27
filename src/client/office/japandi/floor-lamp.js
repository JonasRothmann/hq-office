// A tripod floor lamp: three oak legs leaning in to a steel cord and a linen drum shade.
import { defineObject } from "@hq/world/model";

const LEG = 1.18, SPREAD = 0.14, LEAN = 0.12;

export default defineObject({
  id: "floor-lamp",
  footprint: [1, 1],
  height: 1.4,
  tags: ["light"],
  anchors: { light: [0, 1.25, 0] },
  build(k) {
    // each leg stands on the floor at SPREAD from the axis and leans so its top meets the axis
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.4;
      k.box("leg", [0.02, LEG, 0.02], [Math.sin(a) * SPREAD, 0.004, Math.cos(a) * SPREAD], "oak",
        { rot: [-Math.cos(a) * LEAN, 0, Math.sin(a) * LEAN] });
    }
    k.cyl("cord", 0.006, 0.2, [0, 1.2, 0], "steel", { seg: 3 });
    k.cyl("shade", 0.17, 0.22, [0, 1.16, 0], "washi-glow", { top: 0.15, seg: 12, finish: "glow" });
  },
});
