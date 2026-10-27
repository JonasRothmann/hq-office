// A copper spire on a lantern, one unit wide and about one tall: a drum, a flare, a lantern, a cone and a gold tip.
import { defineObject } from "@hq/world/model";
import { cone } from "./look/shapes.js";

export default defineObject({
  id: "spire",
  kind: "scenery",
  height: 1.06,
  build(k) {
    k.cyl("drum", 0.46, 0.2, [0, 0, 0], "#ffffff", { seg: 8 });
    cone(k, "flare", 0.44, 0.06, [0, 0.2, 0], "#ffffff", { seg: 8 });
    // 2 mm above the flare's foot, so their undersides do not share a plane
    k.cyl("lantern", 0.26, 0.138, [0, 0.202, 0], "#ffffff", { seg: 8 });
    cone(k, "cone", 0.3, 0.68, [0, 0.32, 0], "#ffffff", { seg: 8 });
    k.box("tip", [0.03, 0.08, 0.03], [0, 0.98, 0], "awning-1");
  },
});
