// A flat granite step stone, 60 cm across and 3 cm thick.
import { defineObject } from "@hq/world/model";

export default defineObject({
  id: "step-stone",
  kind: "scenery",
  height: 0.03,
  build(k) {
    k.cyl("stone", 0.3, 0.03, [0, 0, 0], "step-stone", { seg: 7 });
  },
});
