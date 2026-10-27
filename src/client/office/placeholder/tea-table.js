// The low tea table's placeholder: a long, low block, two tiles wide.
import { defineObject } from "@hq/world/model";

export default defineObject({
  id: "tea-table",
  footprint: [2, 1],
  height: 0.35,
  tags: ["placeholder", "surface"],
  build(k) {
    k.box("block", [1.5, 0.35, 0.6], [0, 0, 0], "block");
  },
});
