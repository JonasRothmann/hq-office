// A hipped roof one unit square at its foot and one tall: a four-sided cone with a small flat top.
import { defineObject } from "@hq/world/model";

export default defineObject({
  id: "roof-hip",
  kind: "scenery",
  height: 1,
  build(k) {
    k.cyl("roof", 0.7071, 1, [0, 0, 0], "#ffffff", { top: 0.12, seg: 4, rot: [0, Math.PI / 4, 0] });
  },
});
