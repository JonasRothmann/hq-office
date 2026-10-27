// A path paver, 1.1 m by 0.5 m and 3 cm thick.
import { defineObject } from "@hq/world/model";

export default defineObject({
  id: "paver",
  kind: "scenery",
  height: 0.03,
  build(k) {
    k.box("paver", [1.1, 0.03, 0.5], [0, 0, 0], "paver");
  },
});
