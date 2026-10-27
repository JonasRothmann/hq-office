// A red maple: the maple's shape in autumn reds, about 4 m tall.
import { defineObject } from "@hq/world/model";
import { ball } from "./look/shapes.js";

export default defineObject({
  id: "tree-maple-red",
  kind: "scenery",
  height: 3.96,
  build(k) {
    k.cyl("trunk", 0.13, 1.7, [0, 0, 0], "red-trunk", { top: 0.09, seg: 5 });
    ball(k, "crown", 1.3, [0, 1.745, 0], "red-leaf", { sy: 0.85 });
    ball(k, "crown", 1.0, [0.75, 1.6, 0.3], "red-leaf-2", { sy: 0.85 });
    ball(k, "crown", 0.95, [-0.65, 1.7425, -0.35], "red-leaf-2", { sy: 0.85 });
  },
});
