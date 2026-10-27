// A street tree: a slim trunk and two crown balls, about 4 m tall.
import { defineObject } from "@hq/world/model";
import { ball } from "./look/shapes.js";

export default defineObject({
  id: "tree-round",
  kind: "scenery",
  height: 4.08,
  build(k) {
    k.cyl("trunk", 0.11, 1.9, [0, 0, 0], "round-trunk", { top: 0.08, seg: 5 });
    ball(k, "crown", 1.25, [0, 1.825, 0], "round-leaf", { sy: 0.9 });
    ball(k, "crown", 0.85, [0.55, 1.735, 0.35], "round-leaf-2", { sy: 0.85 });
  },
});
