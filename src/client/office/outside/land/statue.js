// An abstract statue, 4 m high: a stone plinth with a quay-edge cap and a copper figure of stacked boxes and a ball head.
import { defineObject } from "@hq/world/model";
import { ball } from "./look/shapes.js";

export default defineObject({
  id: "statue",
  kind: "scenery",
  height: 4.0,
  build(k) {
    k.box("plinth", [1.5, 1.9, 1.5], [0, 0, 0], "stone");
    k.box("cap", [1.75, 0.16, 1.75], [0, 1.9, 0], "quay-edge", { omit: ["-y"] });
    k.box("legs", [0.36, 0.85, 0.28], [0, 2.06, 0], "roof-4", { omit: ["-y"] });
    k.box("torso", [0.5, 0.75, 0.34], [0, 2.91, 0], "roof-4", { omit: ["-y"] });
    k.box("arm", [0.14, 0.72, 0.14], [0.28, 3.0, 0], "roof-4", { rot: [0, 0, -0.45] });
    ball(k, "head", 0.17, [0, 3.66, 0], "roof-4");
  },
});
