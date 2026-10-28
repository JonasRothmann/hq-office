// A head: just the white skin ball, its middle at p.y (1.36 m by default); the hair is hair.js.
import { defineObject } from "@hq/world/model";
import { ball } from "./look/shapes.js";

export default defineObject({
  id: "head",
  kind: "scenery",
  height: 1.54,
  build(k, p = {}) {
    const y = p.y ?? 1.36;
    ball(k, "skin", 0.15, [0, y - 0.165, 0], "#ffffff", { sy: 1.1 });
  },
});
