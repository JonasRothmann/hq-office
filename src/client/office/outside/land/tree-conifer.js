// A conifer: a short trunk and three stacked cones, about 4.8 m tall.
import { defineObject } from "@hq/world/model";
import { cone } from "./look/shapes.js";

export default defineObject({
  id: "tree-conifer",
  kind: "scenery",
  height: 4.8,
  build(k) {
    k.cyl("trunk", 0.14, 0.9, [0, 0, 0], "conifer-trunk", { seg: 5 });
    cone(k, "crown", 1.3, 2.4, [0, 0.6, 0], "conifer-leaf-2", { seg: 7 });
    cone(k, "crown", 1.0, 2.0, [0, 1.9, 0], "conifer-leaf", { seg: 7 });
    cone(k, "crown", 0.65, 1.6, [0, 3.2, 0], "conifer-leaf-2", { seg: 6 });
  },
});
