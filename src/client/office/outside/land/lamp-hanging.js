// A dome lamp hung from a wire at y = 0: its parts lie below it, with a glowing disc under the dome.
import { defineObject } from "@hq/world/model";

export default defineObject({
  id: "lamp-hanging",
  kind: "scenery",
  height: 0,
  build(k) {
    k.box("stem", [0.03, 0.45, 0.03], [0, -0.45, 0], "wire");
    k.cyl("dome", 0.34, 0.19, [0, -0.62, 0], "lamp-head", { top: 0.08, seg: 8 });
    k.cyl("glow", 0.3, 0.02, [0, -0.64, 0], "lamp-glow", { seg: 8, finish: "glow" });
  },
});
