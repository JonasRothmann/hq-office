// A stone water basin about 0.5 m high: water in a stone bowl, a bamboo spout, a ladle across it and three stones round it.
import { defineObject } from "@hq/world/model";
import { ball } from "./look/shapes.js";

export default defineObject({
  id: "basin",
  kind: "scenery",
  height: 0.5,
  build(k) {
    k.cyl("bowl", 0.32, 0.3, [0, 0, 0], "garden-stone-2", { top: 0.28, seg: 7 });
    k.cyl("water", 0.24, 0.02, [0, 0.29, 0], "basin-water", { seg: 7 });
    k.box("spout", [0.04, 0.04, 0.6], [0, 0.36, -0.22], "bamboo", { rot: [0.2, 0, 0] });
    k.box("ladle", [0.02, 0.02, 0.36], [0.05, 0.31, 0], "ladle", { rot: [0, 0.6, 0], omit: ["-y"] });
    for (const [x, z, r] of [[0.42, 0, 0.12], [-0.05, 0.42, 0.17], [-0.41, -0.11, 0.12]]) {
      ball(k, "stone", r, [x, 0, z], "garden-stone", { sy: 0.5, seg: 4 });
    }
  },
});
