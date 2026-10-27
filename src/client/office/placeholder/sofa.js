// The sofa's placeholder: a low block with a back, two tiles wide. Its front (+z) is where you sit.
import { defineObject } from "@hq/world/model";

export default defineObject({
  id: "sofa",
  footprint: [2, 1],
  height: 0.8,
  tags: ["placeholder", "seat"],
  build(k) {
    k.box("base", [1.8, 0.42, 0.8], [0, 0, 0.05], "block", { omit: ["-y"] });
    k.box("back", [1.8, 0.38, 0.2], [0, 0.42, -0.25], "edge", { omit: ["-y"] });
  },
});
