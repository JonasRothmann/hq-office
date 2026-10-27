// A small garden pine about 2.2 m: a short trunk and three stacked cones.
import { defineObject } from "@hq/world/model";

export default defineObject({
  id: "pine",
  kind: "scenery",
  height: 2.2,
  build(k) {
    k.cyl("trunk", 0.08, 0.5, [0, 0, 0], "pine-trunk", { seg: 6 });
    [[0.95, 0.35], [0.75, 0.85], [0.5, 1.3]].forEach(([r, y], i) => {
      k.cyl("tier", r, 0.9, [0, y, 0], i % 2 ? "pine-leaf" : "pine-leaf-2", { top: 0.02, seg: 7 });
    });
  },
});
