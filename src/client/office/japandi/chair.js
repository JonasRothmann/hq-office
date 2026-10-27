// A task chair on five castors, in oat fabric on a blackened steel frame. Its front (+z) is where the knees point.
import { defineObject } from "@hq/world/model";

const SEAT_BOTTOM = 0.29;    // the seat's steel plate sits on the gas lift; the fabric pad rests on the plate
const SEAT_TOP = 0.35;

export default defineObject({
  id: "chair",
  footprint: [1, 1],
  height: 0.75,
  tags: ["seat"],
  slots: { seat: { at: [0, 0.03], y: 0.38, facing: "s", stand: [[0, 1], [1, 0], [-1, 0]], clip: "sit" } },
  anchors: { above: [0, 1.3, 0] },
  instance: true,
  build(k) {
    // five castors on radiating legs; each leg's bottom sits on the floor-side of its wheel
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const sx = Math.sin(a), sz = Math.cos(a);
      k.box("leg", [0.03, 0.03, 0.2], [sx * 0.12, 0.03, sz * 0.12], "steel", { rot: [0, a, 0], omit: ["-y"] });
      k.cyl("castor", 0.022, 0.04, [sx * 0.21, 0, sz * 0.21], "steel", { seg: 6 });
    }
    k.cyl("gas-lift", 0.022, SEAT_BOTTOM - 0.06 - 0.02, [0, 0.06, 0], "steel", { seg: 6 });
    k.box("plate", [0.26, 0.02, 0.44], [0, SEAT_BOTTOM - 0.02, -0.02], "steel");
    k.box("seat", [0.42, SEAT_TOP - SEAT_BOTTOM, 0.38], [0, SEAT_BOTTOM, 0.02], "oat");

    // the back: a steel post from the plate and a fabric back that leans a little
    k.box("back-post", [0.03, 0.17, 0.03], [0, SEAT_BOTTOM, -0.2], "steel");
    k.box("back", [0.38, 0.27, 0.05], [0, 0.46, -0.22], "oat", { rot: [-0.1, 0, 0] });

    // arms: posts on the seat, pads on top
    for (const sx of [-1, 1]) {
      k.box("arm-post", [0.025, 0.14, 0.025], [sx * 0.2, SEAT_TOP, -0.02], "steel");
      k.box("arm-pad", [0.04, 0.02, 0.2], [sx * 0.2, SEAT_TOP + 0.14, 0.01], "steel");
    }
  },
});
