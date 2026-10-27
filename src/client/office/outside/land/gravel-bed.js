// A bed of raked gravel, 4 m by 1.6 m by default: a pale slab, raked lines along x, a stone in the middle, a moss island at each end.
import { defineObject } from "@hq/world/model";
import { ball } from "./look/shapes.js";

const PITCH = 0.16; // metres between raked lines
const STONE = 0.3; // the middle stone's radius; the lines stop short of it by 0.5 m more

export default defineObject({
  id: "gravel-bed",
  kind: "scenery",
  height: 0.016,
  build(k, p = {}) {
    const w = p.w ?? 4, d = p.d ?? 1.6;
    k.box("gravel", [w, 0.012, d], [0, 0, 0], "garden-gravel");
    const gap = STONE + 0.5, x0 = -w / 2 + 0.05, x1 = w / 2 - 0.05;
    for (let z = -d / 2 + 0.12; z < d / 2 - 0.06; z += PITCH) {
      const dz = Math.abs(z);
      const segs = dz < gap ? [[x0, -Math.sqrt(gap * gap - dz * dz)], [Math.sqrt(gap * gap - dz * dz), x1]] : [[x0, x1]];
      for (const [a, b] of segs) {
        if (b > a) k.box("rake", [b - a, 0.004, 0.022], [(a + b) / 2, 0.012, z], "garden-rake", { omit: ["-y"] });
      }
    }
    ball(k, "stone", STONE, [0, 0.008, 0], "garden-stone-2", { sy: 0.55, seg: 4 });
    ball(k, "moss", 0.45, [-w / 2 + 0.5, 0.008, d * 0.1], "moss", { sy: 0.32, seg: 4 });
    ball(k, "moss", 0.38, [w / 2 - 0.6, 0.008, -d * 0.1], "moss-2", { sy: 0.32, seg: 4 });
  },
});
