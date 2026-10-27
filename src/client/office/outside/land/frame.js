// A window's surround behind and round a 1 × 1 pane: a frame, a sill at its foot and a mullion in front.
// Only the fronts of the frame and the mullion are drawn, as the pane's.
import { defineObject } from "@hq/world/model";

const BACK = ["-z", "-x", "+x", "-y", "+y"]; // every face but the front

export default defineObject({
  id: "frame",
  kind: "scenery",
  height: 1.07,
  build(k) {
    k.box("frame", [1.14, 1.14, 0.03], [0, -0.07, -0.03], "frame", { omit: BACK });
    k.box("sill", [1.24, 0.06, 0.12], [0, -0.06, 0.03], "frame", { omit: ["-z", "-y"] });
    k.box("mullion", [0.05, 1, 0.02], [0, 0, 0.03], "frame", { omit: BACK });
  },
});
