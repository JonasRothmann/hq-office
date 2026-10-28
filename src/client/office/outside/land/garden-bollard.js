// A black steel bollard, 55 cm high, with a glowing cap.
import { defineObject } from "@hq/world/model";

export default defineObject({
  id: "garden-bollard",
  kind: "scenery",
  height: 0.55,
  build(k) {
    k.cyl("post", 0.055, 0.5, [0, 0, 0], "steel", { seg: 6 });
    // the cap starts 1 cm into the post, so the two never share a face
    k.cyl("cap", 0.07, 0.06, [0, 0.49, 0], "bollard-glow", { top: 0.05, seg: 6, finish: "glow" });
  },
});
