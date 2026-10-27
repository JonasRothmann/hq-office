// A head: a white skin ball with a dark cap of hair just above and behind it, its middle at p.y (1.36 m by default).
import { defineObject } from "@hq/world/model";
import { ball } from "./look/shapes.js";

export default defineObject({
  id: "head",
  kind: "scenery",
  height: 1.54,
  build(k, p = {}) {
    const y = p.y ?? 1.36;
    ball(k, "skin", 0.15, [0, y - 0.165, 0], "#ffffff", { sy: 1.1 });
    ball(k, "hair", 0.158, [0, y - 0.076, -0.025], "hair-0", { sy: 0.8 });
  },
});
