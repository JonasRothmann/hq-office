// A birch: a slim pale trunk with a dark mark and a light, airy crown of two balls, about 4.5 m tall.
import { defineObject } from "@hq/world/model";
import { ball } from "./look/shapes.js";

export default defineObject({
  id: "tree-birch",
  kind: "scenery",
  height: 4.6,
  build(k) {
    k.cyl("trunk", 0.08, 3.3, [0, 0, 0], "birch-trunk", { top: 0.05, seg: 5 });
    k.box("mark", [0.18, 0.06, 0.18], [0, 1.1, 0], "birch-mark", { rot: [0, 0.6, 0] });
    ball(k, "crown", 0.85, [0, 2.45, 0], "birch-leaf", { sy: 1.3 });
    ball(k, "crown", 0.66, [0.38, 1.95, 0.22], "birch-leaf-2", { sy: 1.2, seg: 5 });
  },
});
