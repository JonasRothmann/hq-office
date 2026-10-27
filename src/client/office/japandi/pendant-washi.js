// A ribbed washi paper ovoid on a dark cord from the ceiling line. Its 2×2 footprint centres it over a facing
// pair of desks; it hangs, so it does not block.
import { defineObject } from "@hq/world/model";
import { ball } from "./look/shapes.js";

const R = 0.25, SY = 0.8, CY = 1.8;   // the shade: radius, squash, and its centre (the bottom stands at 1.6)
const TOP = CY + R * SY;               // 2.0, the shade's top

// the rib rings sit between the shade's band boundaries (every 6.7 cm), 6 mm tall, a few mm wider than the paper
const ribRadius = (y) => R * Math.sqrt(1 - ((y - CY) / (R * SY)) ** 2) + 0.005;
const RIBS = [1.68, 1.76, 1.84, 1.92];

export default defineObject({
  id: "pendant-washi",
  footprint: [2, 2],
  height: 2.9,
  blocks: false,
  tags: ["light"],
  anchors: { light: [0, CY, 0] },
  build(k) {
    k.cyl("rose", 0.05, 0.02, [0, 2.86, 0], "steel", { seg: 8 });
    k.cyl("cord", 0.009, 2.87 - TOP - 0.01, [0, TOP + 0.01, 0], "charcoal", { seg: 6 }); // thick enough to read from the camera
    ball(k, "shade", R, [0, CY - R * SY, 0], "washi-glow", { sy: SY, bands: 6, seg: 12, finish: "glow" });
    for (const y of RIBS) k.cyl("rib", ribRadius(y), 0.006, [0, y, 0], "paper-edge", { seg: 12, finish: "glow" });
    k.cyl("cap", 0.03, 0.02, [0, TOP, 0], "steel", { seg: 6 });
  },
});
