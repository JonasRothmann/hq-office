// A span of wire, one unit long (x): the land scales it along x to the distance it strings between two walls.
import { defineObject } from "@hq/world/model";

export default defineObject({
  id: "wire",
  kind: "scenery",
  height: 0.02,
  build(k) {
    k.box("wire", [1, 0.02, 0.02], [0, 0, 0], "wire");
  },
});
