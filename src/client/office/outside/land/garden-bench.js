// An oak bench 1.4 m long, facing +z: a seat, a slightly reclined back and two steel legs.
import { defineObject } from "@hq/world/model";

export default defineObject({
  id: "garden-bench",
  kind: "scenery",
  height: 0.75,
  build(k) {
    k.box("seat", [1.4, 0.04, 0.4], [0, 0.38, 0], "garden-oak");
    k.box("back", [1.4, 0.3, 0.04], [0, 0.42, -0.2], "garden-oak", { rot: [-0.1, 0, 0], omit: ["-y"] });
    for (const s of [-1, 1]) k.box("leg", [0.05, 0.4, 0.36], [s * 0.6, 0, 0], "steel");
  },
});
