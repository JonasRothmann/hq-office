// An open motor boat, 3.9 m long and 1.5 m beam: a white hull, three timber benches with backs, a steel console.
import { defineObject } from "@hq/world/model";

const TOP = 0.28; // the deck's height above the waterline

// The hull: boxes along z, each a share of the length (from, to) and of the beam; white, with a timber deck on top.
function hull(k, L, B, top, segs) {
  for (const [a, b, w] of segs) {
    const len = (b - a) * L, z = ((a + b) / 2) * L, wd = B * w;
    k.box("hull", [wd, top + 0.24, len], [0, -0.32, z], "#ffffff");
    k.box("deck", [wd * 0.92, 0.08, len * 0.96], [0, top - 0.08, z], "deck", { omit: ["-y"] });
  }
}

export default defineObject({
  id: "boat-motor",
  kind: "scenery",
  height: 0.7,
  build(k) {
    hull(k, 3.9, 1.5, TOP, [[-0.5, -0.2, 1], [-0.2, 0.15, 1], [0.15, 0.36, 0.7], [0.36, 0.5, 0.3]]);
    for (const z of [-1.0, 0.0, 0.9]) {
      k.box("seat", [0.94, 0.08, 0.32], [0, TOP, z], "deck", { omit: ["-y"] });
      k.box("seat", [0.94, 0.3, 0.06], [0, TOP + 0.08, z - 0.16], "deck", { omit: ["-y"] });
    }
    k.box("console", [0.5, 0.42, 0.3], [0, TOP, -1.45], "steel", { omit: ["-y"] });
  },
});
