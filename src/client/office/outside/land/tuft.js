// A tuft of long grass: five blades leaning out, half a metre tall.
import { defineObject } from "@hq/world/model";
import { cone } from "./look/shapes.js";

export default defineObject({
  id: "tuft",
  kind: "scenery",
  height: 0.5,
  build(k) {
    for (const [x, z, h, rx, rz, c] of [
      [0, 0, 0.5, 0.1, 0.15, "tuft"],
      [0.09, 0.05, 0.4, -0.3, 0.35, "tuft-2"],
      [-0.08, 0.06, 0.44, 0.35, -0.3, "tuft"],
      [0.03, -0.09, 0.36, -0.4, -0.1, "tuft-2"],
      [-0.05, -0.05, 0.3, 0.2, 0.4, "tuft-2"],
    ]) cone(k, "blade", 0.06, h, [x, 0, z], c, { seg: 3, rot: [rx, 0, rz] });
  },
});
