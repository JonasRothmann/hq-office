// A street lamp about 3.6 m: a base, a pole, an arm out over +z and a head at its end with a glowing underside.
import { defineObject } from "@hq/world/model";

export default defineObject({
  id: "lamp-post",
  kind: "scenery",
  height: 3.6,
  build(k) {
    k.cyl("base", 0.09, 0.25, [0, 0, 0], "iron", { seg: 7 });
    k.cyl("pole", 0.05, 3.29, [0, 0.25, 0], "iron", { seg: 6 });
    k.box("arm", [0.06, 0.06, 1.05], [0, 3.5, 0.5], "iron");
    k.box("head", [0.24, 0.1, 0.42], [0, 3.4, 1.0], "lamp-head");
    k.glow("lamp", [0.2, 0.02, 0.36], [0, 3.38, 1.0], "lamp-glow");
  },
});
