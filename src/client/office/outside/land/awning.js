// A striped shop awning, one unit wide (x): six stripes sloping out from the wall (+z) and down, with a valance.
import { defineObject } from "@hq/world/model";

export default defineObject({
  id: "awning",
  kind: "scenery",
  height: 0.65,
  build(k) {
    for (let i = 0; i < 6; i++) {
      const x = -0.5 + (i + 0.5) / 6, colour = i % 2 ? "#ffffff" : "#d6d3cc";
      // the stripe's foot sits so that its front edge meets the valance's top (0.22 m)
      k.box(`stripe-${i}`, [1 / 6, 0.04, 1.1], [x, 0.41375, 0.5], colour, { rot: [0.36, 0, 0], omit: ["-z"] });
      k.box(`valance-${i}`, [1 / 6, 0.22, 0.03], [x, 0, 1.01], colour);
    }
  },
});
