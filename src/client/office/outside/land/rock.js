// A rock: two flattened stones, about a metre across.
import { defineObject } from "@hq/world/model";
import { ball } from "./look/shapes.js";

export default defineObject({
  id: "rock",
  kind: "scenery",
  height: 0.52,
  build(k) {
    ball(k, "rock", 0.55, [0, -0.161, 0], "rock", { sy: 0.62, seg: 5 });
    ball(k, "rock", 0.32, [0.42, -0.092, 0.18], "rock", { sy: 0.6, seg: 5 });
  },
});
