// A window pane facing +z: a 1 × 1 metre sheet of light that glows at night. Only its front is drawn (thousands of
// windows line the town, and nothing sees their sides).
import { defineObject } from "@hq/world/model";

const BACK = ["-z", "-x", "+x", "-y", "+y"]; // every face but the front

export default defineObject({
  id: "pane",
  kind: "scenery",
  height: 1,
  build(k) {
    k.glow("pane", [1, 1, 0.02], [0, 0, 0], "#ffffff", { omit: BACK });
  },
});
