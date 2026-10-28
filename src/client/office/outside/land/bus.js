// A city bus, 1.75 × 2.41 × 7.6 m: a white body with a dark band of windows, a light roof and a dark underside.
import { defineObject } from "@hq/world/model";

export default defineObject({
  id: "bus",
  kind: "scenery",
  height: 2.41,
  build(k) {
    k.box("body", [1.75, 1.1, 7.6], [0, 0.22, 0], "#ffffff");
    k.box("glass", [1.77, 0.78, 6.9], [0, 1.25, -0.25], "car-glass");
    k.box("windscreen", [1.6, 0.75, 0.05], [0, 1.2, 3.79], "car-glass");
    k.box("roof", [1.75, 0.3, 7.6], [0, 2.03, 0], "#ffffff", { omit: ["-y"] });
    k.box("roof-trim", [1.5, 0.08, 6.8], [0, 2.33, 0], "lamp-head", { omit: ["-y"] });
    k.box("underside", [1.77, 0.14, 7.62], [0, 0.2, 0], "charcoal");
    for (const x of [0.75, -0.75]) for (const z of [2.6, -2.4]) {
      k.cyl("wheel", 0.3, 0.22, [x + 0.11, 0.3, z], "tyre", { seg: 5, rot: [0, 0, Math.PI / 2] });
    }
  },
});
