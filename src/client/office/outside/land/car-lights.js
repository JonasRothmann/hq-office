// The head and tail lights of a 3.3 m car: unlit glow boxes on its front and back faces.
import { defineObject } from "@hq/world/model";

export default defineObject({
  id: "car-lights",
  kind: "scenery",
  height: 0.62,
  build(k) {
    for (const x of [-0.5, 0.5]) {
      k.glow("head", [0.3, 0.12, 0.05], [x, 0.5, 1.66], "head-light");
      k.glow("tail", [0.28, 0.1, 0.05], [x, 0.52, -1.66], "tail-light");
    }
  },
});
