// A low moss mound, radius 1 m before the land scales it.
import { defineObject } from "@hq/world/model";
import { ball } from "./look/shapes.js";

export default defineObject({
  id: "moss",
  kind: "scenery",
  height: 0.64,
  build(k) {
    ball(k, "moss", 1, [0, 0, 0], "moss", { sy: 0.32, seg: 5 });
  },
});
