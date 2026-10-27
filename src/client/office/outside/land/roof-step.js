// A stepped gable end, one unit wide at its foot and 1.07 m tall: five steps, each 0.3 deep (z).
import { defineObject } from "@hq/world/model";

export default defineObject({
  id: "roof-step",
  kind: "scenery",
  height: 1.07,
  build(k) {
    for (let i = 0; i < 5; i++) {
      const half = 0.5 * (1 - i / 5) + 0.03;
      // each step sits 2 mm further back than the one below, so their front and back faces never share a plane
      k.box(`step-${i}`, [2 * half, 0.27, 0.3], [0, i / 5, 0.002 * i], "#ffffff", { omit: ["-y"] });
    }
  },
});
