// A monstera: long stems fanning out of a clay pot, each ending in a large flat leaf.
import { defineObject } from "@hq/world/model";

const POT_R = 0.14, POT_H = 0.22;
const STEMS = 6;

// A part that stands on its foot (at) and leans toward azimuth a by theta: rot turns about the foot, so this
// rotation (yaw PI - a, then tilt theta) points the top outward at a
const lean = (a, theta) => [0, Math.PI - a, theta];

export default defineObject({
  id: "plant-monstera",
  footprint: [1, 1],
  height: 1.18,
  tags: ["decor", "green"],
  instance: true,
  build(k) {
    k.cyl("pot", POT_R, POT_H, [0, 0, 0], "clay", { top: POT_R * 1.12, seg: 12 });
    k.cyl("soil", POT_R * 1.02, 0.01, [0, POT_H - 0.013, 0], "soil", { seg: 12 });
    for (let i = 0; i < STEMS; i++) {
      const a = (i * 2 * Math.PI) / STEMS + 0.3;
      const theta = 0.2 + (i % 3) * 0.06, L = 0.8 + (i % 2) * 0.15;
      const foot = [Math.cos(a) * 0.02, 0.19 + i * 0.004, Math.sin(a) * 0.02];
      k.box("stem", [0.014, L, 0.014], foot, "leaf-dark", { rot: lean(a, theta) });
      const tip = [
        foot[0] + Math.sin(theta) * Math.cos(a) * L,
        foot[1] + Math.cos(theta) * L,
        foot[2] + Math.sin(theta) * Math.sin(a) * L,
      ];
      // a flat leaf lying across the stem's end, turned a little so the stems do not look stamped
      const leafColour = ["leaf", "leaf-light", "leaf-dark"][i % 3];
      k.box("leaf", [0.24, 0.012, 0.17], [tip[0], tip[1] - 0.006, tip[2]], leafColour, { rot: [0.1, -a + i * 0.5, 0.2] });
    }
  },
});
