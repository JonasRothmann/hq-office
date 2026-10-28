// A cap of hair over a head: white, so the land tints it per person with hair-0..hair-6; its middle follows head.js's p.y.
import { defineObject } from "@hq/world/model";
import { ball } from "./look/shapes.js";

export default defineObject({
  id: "hair",
  kind: "scenery",
  height: 1.54,
  build(k, p = {}) {
    const y = p.y ?? 1.36;
    ball(k, "hair", 0.158, [0, y - 0.076, -0.025], "#ffffff", { sy: 0.8 });
  },
});
