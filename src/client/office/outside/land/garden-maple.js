// A Japanese maple about 2.5 m: a leaning trunk, three limbs and a wide crown of six flattened pads in tiers.
import { defineObject } from "@hq/world/model";
import { ball } from "./look/shapes.js";

export default defineObject({
  id: "garden-maple",
  kind: "scenery",
  height: 2.5,
  build(k) {
    k.cyl("trunk", 0.1, 1.0, [0, 0, 0], "garden-trunk", { top: 0.07, seg: 5, rot: [0, 0, 0.12] });
    k.box("limb", [0.07, 0.7, 0.07], [-0.13, 0.61, 0], "garden-trunk", { rot: [0, 0, -0.8] });
    k.box("limb", [0.06, 0.6, 0.06], [0.24, 0.67, 0], "garden-trunk", { rot: [0.3, 0, 0.7] });
    k.box("limb", [0.05, 0.6, 0.05], [0.14, 0.81, 0.1], "garden-trunk", { rot: [-0.4, 0, 0.9] });
    // lower tier, outside
    ball(k, "crown", 0.5, [0.75, 1.1, 0], "maple-red-1", { sy: 0.5, seg: 4 });
    ball(k, "crown", 0.5, [-0.375, 1.1, 0.65], "maple-red-3", { sy: 0.5, seg: 4 });
    ball(k, "crown", 0.5, [-0.375, 1.1, -0.65], "maple-red-0", { sy: 0.5, seg: 4 });
    // middle tier
    ball(k, "crown", 0.42, [0.16, 1.5, 0.37], "maple-red-2", { sy: 0.5, seg: 4 });
    ball(k, "crown", 0.42, [-0.3, 1.5, -0.2], "maple-red-1", { sy: 0.5, seg: 4 });
    // top
    ball(k, "crown", 0.42, [0, 2.05, 0], "maple-red-3", { sy: 0.5, seg: 4 });
  },
});
