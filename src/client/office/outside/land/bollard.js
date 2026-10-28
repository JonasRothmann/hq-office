// An iron bollard, 0.42 m of post under a ball top, 0.66 m high.
import { defineObject } from "@hq/world/model";
import { ball } from "./look/shapes.js";

export default defineObject({
  id: "bollard",
  kind: "scenery",
  height: 0.66,
  build(k) {
    k.cyl("post", 0.11, 0.42, [0, 0, 0], "iron", { seg: 6 });
    ball(k, "cap", 0.13, [0, 0.4, 0], "iron");
  },
});
