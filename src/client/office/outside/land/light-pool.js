// A pool of lamp light on the ground, 1 m across before the land scales it: warm by night, nothing by day.
import { defineObject } from "@hq/world/model";

export default defineObject({
  id: "light-pool",
  kind: "scenery",
  height: 0.01,
  build(k) {
    // only its top is drawn; the light finish fades it out from the middle
    k.light("pool", [1, 0.01, 1], [0, 0, 0], "lamp-pool", { omit: ["-y", "-x", "+x", "-z", "+z"] });
  },
});
