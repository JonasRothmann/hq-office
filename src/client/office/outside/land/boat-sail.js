// A sailing boat, 4.6 m long and 1.6 m beam, one mast to 4.8 m: a white hull, a small cabin, a furled sail.
import { defineObject } from "@hq/world/model";

const TOP = 0.3; // the deck's height above the waterline

// The hull: boxes along z, each a share of the length (from, to) and of the beam; white, with a timber deck on top.
function hull(k, L, B, top, segs) {
  for (const [a, b, w] of segs) {
    const len = (b - a) * L, z = ((a + b) / 2) * L, wd = B * w;
    k.box("hull", [wd, top + 0.24, len], [0, -0.32, z], "#ffffff");
    k.box("deck", [wd * 0.92, 0.08, len * 0.96], [0, top - 0.08, z], "deck", { omit: ["-y"] });
  }
}

export default defineObject({
  id: "boat-sail",
  kind: "scenery",
  height: 4.8,
  build(k) {
    hull(k, 4.6, 1.6, TOP, [[-0.5, -0.18, 1], [-0.18, 0.2, 1], [0.2, 0.38, 0.62], [0.38, 0.5, 0.3]]);
    k.box("cabin", [0.9, 0.38, 1.3], [0, TOP, 0.2], "#ffffff", { omit: ["-y"] });
    k.cyl("mast", 0.05, 4.8 - TOP, [0, TOP, 0.75], "mast", { top: 0.04, seg: 5 });
    // the boom runs aft from the mast, with the furled sail on it
    k.box("boom", [0.06, 0.06, 1.6], [0, 1.3, -0.05], "mast");
    k.box("sail", [0.2, 0.24, 1.4], [0, 1.36, -0.05], "sail", { omit: ["-y"] });
  },
});
