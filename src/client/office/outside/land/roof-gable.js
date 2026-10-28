// A gable roof's two slopes, one unit long (x, along the ridge), wide (z) and tall; the land tints them the roof's
// colour and puts the ends (gable-end.js) in the wall's.
import { defineObject } from "@hq/world/model";

// The slabs are 4 cm thick, their tops run from the eaves (z ±0.5, y 0.018) to the ridge (y 1); the undersides
// meet y = 0 at the eaves. Slope angle, slab length, and the bottom middle of each slab (its top middle less 4 cm).
const SLOPE = 1.0998, SLAB_LEN = 1.1018, SLAB_Y = 0.4909, SLAB_Z = 0.2144;

export default defineObject({
  id: "roof-gable",
  kind: "scenery",
  height: 1,
  build(k) {
    k.box("slope-front", [1, 0.04, SLAB_LEN], [0, SLAB_Y, SLAB_Z], "#ffffff", { rot: [SLOPE, 0, 0], omit: ["-y"] });
    // 1 cm narrower than the front one, so their end faces do not share a plane where they meet at the ridge
    k.box("slope-back", [0.99, 0.04, SLAB_LEN], [0, SLAB_Y, -SLAB_Z], "#ffffff", { rot: [-SLOPE, 0, 0], omit: ["-y"] });
  },
});
