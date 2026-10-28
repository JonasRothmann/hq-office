// A clipped round shrub, 60 cm across and 41 cm high.
import { defineObject } from "@hq/world/model";
import { ball } from "./look/shapes.js";

export default defineObject({
  id: "shrub-clipped",
  kind: "scenery",
  height: 0.41,
  build(k) {
    ball(k, "shrub", 0.3, [0, 0, 0], "clipped", { sy: 0.68, seg: 5 });
  },
});
