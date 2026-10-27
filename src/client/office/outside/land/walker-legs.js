// Two white legs, 0.62 m long, a little apart: one a step ahead of the other.
import { defineObject } from "@hq/world/model";

export default defineObject({
  id: "walker-legs",
  kind: "scenery",
  height: 0.62,
  build(k) {
    k.box("leg", [0.14, 0.62, 0.16], [0.09, 0, 0.06], "#ffffff");
    k.box("leg", [0.14, 0.62, 0.16], [-0.09, 0, -0.06], "#ffffff");
  },
});
