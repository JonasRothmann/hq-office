// The kitchenette's placeholder: a counter-height block against the wall, two tiles wide. Its front (+z) faces the room.
import { defineObject } from "@hq/world/model";

export default defineObject({
  id: "kitchenette",
  footprint: [2, 1],
  height: 0.9,
  tags: ["placeholder", "surface"],
  build(k) {
    k.box("block", [1.9, 0.86, 0.6], [0, 0, -0.18], "block", { omit: ["-y"] });
    k.box("top", [1.94, 0.04, 0.64], [0, 0.86, -0.18], "edge");
  },
});
