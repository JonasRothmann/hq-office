// A reed: four leaning stalks with a brown tip, about 1.2 m tall.
import { defineObject } from "@hq/world/model";
import { cone } from "./look/shapes.js";

export default defineObject({
  id: "reed",
  kind: "scenery",
  height: 1.17,
  build(k) {
    for (const [x, z, h, lean] of [[0, 0, 1.1, 0.08], [0.12, 0.06, 0.85, -0.12], [-0.1, 0.08, 0.95, 0.15], [0.04, -0.1, 0.75, -0.06]]) {
      cone(k, "stalk", 0.035, h, [x, 0, z], "reed", { seg: 3, rot: [lean, 0, lean * 0.6] });
    }
    k.box("tip", [0.07, 0.22, 0.07], [0, 0.95, 0.07], "reed-tip");
  },
});
