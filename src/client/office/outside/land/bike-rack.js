// A bike rack: three steel hoops half a metre apart along x, 62 cm high.
import { defineObject } from "@hq/world/model";

export default defineObject({
  id: "bike-rack",
  kind: "scenery",
  height: 0.62,
  build(k) {
    for (const hx of [-0.5, 0, 0.5]) {
      for (const sz of [-0.3, 0.3]) k.box("post", [0.04, 0.58, 0.04], [hx, 0, sz], "steel");
      k.box("bar", [0.04, 0.04, 0.64], [hx, 0.58, 0], "steel", { omit: ["-y"] });
    }
  },
});
