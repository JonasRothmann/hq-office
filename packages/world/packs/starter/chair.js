// A wooden chair with a cushion. Its front (+z) is where the knees point; it is sat on from the front or the sides.
import { defineObject } from "@hq/world/model";

const SEAT = 0.35;

export default defineObject({
  id: "chair",
  footprint: [1, 1],
  height: 0.75,
  tags: ["seat"],
  slots: { seat: { at: [0, 0.03], y: SEAT + 0.03, facing: "s", stand: [[0, 1], [1, 0], [-1, 0]], clip: "sit" } },
  anchors: { above: [0, 1.3, 0] },
  instance: true,
  build(k) {
    for (const x of [-0.17, 0.17]) for (const z of [-0.17, 0.17]) k.box("leg", [0.04, SEAT - 0.04, 0.04], [x, 0, z], "wood-dark");
    k.box("seat", [0.44, 0.04, 0.42], [0, SEAT - 0.04, 0], "wood");
    k.box("cushion", [0.4, 0.03, 0.36], [0, SEAT, 0.02], "fabric");
    k.box("back", [0.4, 0.36, 0.04], [0, SEAT, -0.19], "wood", { rot: [-0.12, 0, 0] });
  },
});
