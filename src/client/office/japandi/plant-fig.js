// A fiddle-leaf fig: a bare trunk in a ceramic pot, with broad flattened leaves up its top half.
import { defineObject } from "@hq/world/model";
import { ball } from "./look/shapes.js";

const POT_R = 0.17, POT_H = 0.34;
const LEAVES = ["leaf", "leaf-dark", "leaf-light", "leaf-pale"];

export default defineObject({
  id: "plant-fig",
  footprint: [1, 1],
  height: 1.7,
  tags: ["decor", "green"],
  instance: true,
  build(k) {
    k.cyl("pot", POT_R, POT_H, [0, 0, 0], "ceramic", { top: POT_R * 1.12, seg: 12 });
    k.cyl("soil", POT_R * 1.02, 0.01, [0, POT_H - 0.013, 0], "soil", { seg: 12 });
    k.cyl("trunk", 0.018, 1.32, [0, 0.3, 0], "branch", { top: 0.012, seg: 6 });
    // the leaves spread round the trunk on the golden angle, so no two line up; each sits at its own height
    for (let i = 0; i < 14; i++) {
      const t = i / 13, a = i * 2.39;
      const y = 0.8 + i * 0.06 + (i % 2) * 0.011;
      const reach = 0.2 + 0.08 * Math.sin(Math.PI * t);
      ball(k, "leaf", 0.12, [Math.cos(a) * reach, y - 0.06, Math.sin(a) * reach], LEAVES[i % 4], { sy: 0.5, bands: 4, seg: 8 });
    }
  },
});
