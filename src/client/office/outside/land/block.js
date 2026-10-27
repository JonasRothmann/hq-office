// A unit block: a wall, plinth or street slab, one metre cube (the land scales and tints it); its foot is hidden.
import { defineObject } from "@hq/world/model";

export default defineObject({
  id: "block",
  kind: "scenery",
  height: 1,
  build(k) {
    k.box("block", [1, 1, 1], [0, 0, 0], "#ffffff", { omit: ["-y"] });
  },
});
