// A floor lamp: a steel pole on a round foot under a glowing paper shade.
import { defineObject } from "@hq/world/model";

export default defineObject({
  id: "lamp",
  footprint: [1, 1],
  height: 1.5,
  tags: ["light"],
  anchors: { light: [0, 1.3, 0] },
  build(k) {
    k.cyl("foot", 0.15, 0.03, [0, 0, 0], "steel", { seg: 12 });
    k.cyl("pole", 0.015, 1.22, [0, 0.03, 0], "steel", { seg: 6 });
    k.glow("shade", [0.34, 0.26, 0.34], [0, 1.2, 0], "shade");
  },
});
