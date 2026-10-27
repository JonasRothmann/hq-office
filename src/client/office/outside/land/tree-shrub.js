// A shrub: three low balls and no trunk, about 0.9 m tall.
import { defineObject } from "@hq/world/model";
import { ball } from "./look/shapes.js";

export default defineObject({
  id: "tree-shrub",
  kind: "scenery",
  height: 0.94,
  build(k) {
    ball(k, "crown", 0.72, [0, -0.098, 0], "shrub-leaf", { sy: 0.72 });
    ball(k, "crown", 0.55, [0.48, -0.0925, 0.22], "shrub-leaf-2", { sy: 0.75 });
    ball(k, "crown", 0.45, [-0.38, -0.06, -0.2], "shrub-leaf-2", { sy: 0.8 });
  },
});
