// A saloon car, 1.5 × 1.2 × 3.3 m: a white body and cabin, dark glass, a grey sill and four wheels.
import { defineObject } from "@hq/world/model";

export default defineObject({
  id: "car",
  kind: "scenery",
  height: 1.2,
  build(k) {
    k.box("body", [1.5, 0.5, 3.3], [0, 0.2, 0], "#ffffff");
    k.box("glass", [1.32, 0.42, 1.75], [0, 0.7, -0.15], "car-glass", { omit: ["-y"] });
    k.box("roof", [1.3, 0.07, 1.55], [0, 1.1, -0.18], "#ffffff");
    k.box("sill", [1.52, 0.12, 3.34], [0, 0.16, 0], "kerb");
    // a wheel's axis runs along x, so it starts at its centre plus half its width
    for (const x of [0.67, -0.67]) for (const z of [1.05, -1.05]) {
      k.cyl("wheel", 0.22, 0.2, [x + 0.1, 0.22, z], "tyre", { seg: 6, rot: [0, 0, Math.PI / 2] });
    }
  },
});
