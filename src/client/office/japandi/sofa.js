// A low two-seat sofa on a smoked oak plinth: a sofa base, two seat cushions, a back, two arms and a rust and an indigo
// throw leaning on the back. Its front (+z) is where you sit; its back may stand against a wall.
import { defineObject } from "@hq/world/model";

const SEAT = 0.42;           // the top of the seat cushions

export default defineObject({
  id: "sofa",
  footprint: [2, 1],
  height: 0.8,
  tags: ["seat"],
  slots: {
    left: { at: [-0.45, 0.1], y: 0.42, facing: "s", stand: [[0, 1]], clip: "sit" },
    right: { at: [0.45, 0.1], y: 0.42, facing: "s", stand: [[0, 1]], clip: "sit" },
  },
  build(k) {
    for (const x of [-0.86, 0.86]) for (const z of [-0.33, 0.33]) k.box("leg", [0.05, 0.1, 0.05], [x, 0, z], "smoked");
    k.box("plinth", [1.82, 0.06, 0.82], [0, 0.1, 0], "smoked");
    k.box("sofa", [1.82, 0.18, 0.8], [0, 0.16, 0], "sofa", { omit: ["-y"] });

    // cushions, back and arms all stand on the base's top or sides; their bottoms are left out
    for (const x of [-0.405, 0.405]) k.box("sofa-cushion", [0.8, SEAT - 0.34, 0.6], [x, 0.34, 0.1], "sofa-cushion", { omit: ["-y"] });
    k.box("back", [1.82, 0.28, 0.2], [0, 0.34, -0.3], "sofa", { omit: ["-y"] });
    for (const x of [-0.85, 0.85]) k.box("arm", [0.14, 0.26, 0.66], [x, 0.34, 0.08], "sofa", { omit: ["-y"] });

    // throws lean back against the back cushion, one either side
    k.box("throw", [0.42, 0.36, 0.1], [-0.36, 0.43, -0.11], "rust", { rot: [-0.2, 0.1, 0] });
    k.box("throw", [0.42, 0.36, 0.1], [0.36, 0.43, -0.11], "indigo", { rot: [-0.2, -0.1, 0] });
  },
});
