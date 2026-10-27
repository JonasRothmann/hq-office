// A matt charcoal glazed dome on a steel cord, with a warm bulb under its rim. Its 2×1 footprint centres it over one
// desk or table; it hangs, so it does not block.
import { defineObject } from "@hq/world/model";
import { ball } from "./look/shapes.js";

const RIM = 1.7;                       // the dome's bottom edge

export default defineObject({
  id: "pendant-ceramic",
  footprint: [2, 1],
  height: 2.9,
  blocks: false,
  tags: ["light"],
  anchors: { light: [0, 1.64, 0] },
  build(k) {
    k.cyl("rose", 0.05, 0.02, [0, 2.86, 0], "steel", { seg: 8 });
    k.cyl("cord", 0.004, 2.87 - 1.96, [0, 1.96, 0], "steel", { seg: 3 });
    k.cyl("fitting", 0.03, 0.04, [0, 1.92, 0], "steel", { seg: 8 });
    // the dome in three stacked frustums, wide at the rim and narrowing to the fitting
    k.cyl("dome", 0.2, 0.08, [0, RIM, 0], "charcoal", { top: 0.14, seg: 14 });
    k.cyl("dome", 0.14, 0.08, [0, RIM + 0.08, 0], "charcoal", { top: 0.085, seg: 14 });
    k.cyl("dome", 0.085, 0.06, [0, RIM + 0.16, 0], "charcoal", { top: 0.04, seg: 14 });
    // the light: a glowing disc 3 mm above the rim's bottom plane, and a bulb just below the rim
    k.cyl("lens", 0.18, 0.01, [0, RIM + 0.003, 0], "bulb-glow", { seg: 14, finish: "glow" });
    ball(k, "bulb", 0.05, [0, 1.59, 0], "bulb-glow", { bands: 4, seg: 10, finish: "glow" });
  },
});
