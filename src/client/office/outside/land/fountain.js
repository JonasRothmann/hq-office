// A round fountain, 4.6 m across: a stone basin with its water 2 mm below the rim, a central pillar and a bowl, 1.92 m high.
import { defineObject } from "@hq/world/model";

const RIM = 0.45, R = 2.12, T = 0.36; // the rim's top, the ring's middle radius and its thickness

export default defineObject({
  id: "fountain",
  kind: "scenery",
  height: 1.92,
  build(k) {
    k.cyl("base", 2.3, 0.22, [0, 0, 0], "stone", { seg: 10 });
    // the rim: eight blocks in a ring; neighbours' tops differ by 2 mm so their overlaps never share a plane
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4, top = RIM + (i % 2) * 0.002;
      k.box("rim", [T, top - 0.22, 2 * R * Math.sin(Math.PI / 8) + 0.02], [R * Math.cos(a), 0.22, R * Math.sin(a)], "stone", { rot: [0, -a, 0], omit: ["-y"] });
    }
    k.cyl("water", 1.9, 0.248, [0, 0.2, 0], "city-water", { seg: 8 });
    k.cyl("pillar", 0.28, 1.2, [0, 0.4, 0], "stone", { seg: 6 });
    k.cyl("bowl", 0.02, 0.3, [0, 1.6, 0], "stone", { top: 0.95, seg: 8 });
    k.cyl("bowl-water", 0.82, 0.02, [0, 1.9, 0], "city-water", { seg: 8 });
  },
});
