// A kei van, 1.4 × 1.35 × 3.1 m: a white box body with dark glass, a grey sill and four wheels.
import { defineObject } from "@hq/world/model";

export default defineObject({
  id: "van",
  kind: "scenery",
  height: 1.4,
  build(k) {
    k.box("body", [1.4, 1.15, 3.1], [0, 0.2, 0], "#ffffff");
    k.box("glass", [1.42, 0.42, 1.9], [0, 0.82, -0.25], "car-glass");
    k.box("windscreen", [1.3, 0.42, 0.05], [0, 0.82, 1.56], "car-glass");
    k.box("sill", [1.42, 0.12, 3.14], [0, 0.16, 0], "kerb");
    for (const x of [0.62, -0.62]) for (const z of [1.0, -1.0]) {
      k.cyl("wheel", 0.21, 0.2, [x + 0.1, 0.21, z], "tyre", { seg: 6, rot: [0, 0, Math.PI / 2] });
    }
  },
});
