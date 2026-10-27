// A potted bush: a terracotta pot and three stacked cones of leaves.
import { defineObject } from "@hq/world/model";

export default defineObject({
  id: "plant",
  footprint: [1, 1],
  height: 1.25,
  tags: ["decor", "green"],
  instance: true,
  lod: { far: "box" },
  build(k) {
    k.cyl("pot", 0.16, 0.3, [0, 0, 0], "pot", { top: 0.19, seg: 10 });
    k.cyl("soil", 0.175, 0.015, [0, 0.3, 0], "soil", { seg: 10 });
    k.cyl("leaves-low", 0.3, 0.5, [0, 0.32, 0], "leaf-dark", { top: 0, seg: 7 });
    k.cyl("leaves-mid", 0.24, 0.45, [0, 0.58, 0], "leaf", { top: 0, seg: 7, rot: [0, 0.4, 0] });
    k.cyl("leaves-top", 0.15, 0.35, [0, 0.88, 0], "leaf", { top: 0, seg: 7, rot: [0, 0.9, 0] });
  },
});
