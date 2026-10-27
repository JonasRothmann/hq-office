// A snake plant: upright pointed blades out of a charcoal pot.
import { defineObject } from "@hq/world/model";

const POT_R = 0.1, POT_H = 0.2;
const BLADE_COLOURS = ["leaf-dark", "olive"];

export default defineObject({
  id: "plant-snake",
  footprint: [1, 1],
  height: 0.9,
  tags: ["decor", "green"],
  instance: true,
  build(k) {
    k.cyl("pot", POT_R, POT_H, [0, 0, 0], "charcoal", { top: POT_R * 1.12, seg: 12 });
    k.cyl("soil", POT_R * 1.02, 0.01, [0, POT_H - 0.013, 0], "soil", { seg: 12 });
    // nine blades in a loose ring, each a triangle cone that leans a little outward; the feet sit at different
    // heights inside the pot, so their bottoms never share a plane
    for (let i = 0; i < 9; i++) {
      const a = i * 2.4, r = 0.02 + (i % 3) * 0.025;
      const h = 0.5 + ((i * 7) % 5) * 0.06, lean = 0.05 + (i % 4) * 0.035;
      const at = [Math.cos(a) * r, 0.13 + i * 0.003, Math.sin(a) * r];
      k.cyl("blade", 0.022, h, at, BLADE_COLOURS[i % 2], { top: 0, seg: 3, rot: [0, Math.PI - a, lean] });
    }
  },
});
