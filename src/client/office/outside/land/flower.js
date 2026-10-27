// A flower: three short stems, two with a small bloom that takes the copy's tint.
import { defineObject } from "@hq/world/model";
import { ball, cone } from "./look/shapes.js";

export default defineObject({
  id: "flower",
  kind: "scenery",
  height: 0.31,
  build(k) {
    const stems = [[0, 0, 0.2], [0.2, 0.1, 0.15], [-0.12, 0.18, 0.17]];
    for (const [x, z, h] of stems) cone(k, "stem", 0.018, h, [x, 0, z], "reed", { seg: 3 });
    for (const [x, z, h] of stems.slice(0, 2)) ball(k, "bloom", 0.085, [x, h + 0.02 - 0.085, z], "#ffffff", { seg: 2 });
  },
});
