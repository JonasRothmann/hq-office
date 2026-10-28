// A two-masted sailing ship, 8.6 m long and 2.1 m beam, its masts to 7.4 m: a white hull, furled sails, a deckhouse.
import { defineObject } from "@hq/world/model";

const TOP = 0.7; // the deck's height above the waterline

// The hull: boxes along z, each a share of the length (from, to) and of the beam; white, with a timber deck on top.
function hull(k, L, B, top, segs) {
  for (const [a, b, w] of segs) {
    const len = (b - a) * L, z = ((a + b) / 2) * L, wd = B * w;
    k.box("hull", [wd, top + 0.24, len], [0, -0.32, z], "#ffffff");
    k.box("deck", [wd * 0.92, 0.08, len * 0.96], [0, top - 0.08, z], "deck", { omit: ["-y"] });
  }
}

export default defineObject({
  id: "boat-ship",
  kind: "scenery",
  height: 7.4,
  build(k) {
    hull(k, 8.6, 2.1, TOP, [[-0.5, -0.22, 1], [-0.22, 0.12, 1], [0.12, 0.34, 0.72], [0.34, 0.44, 0.45], [0.44, 0.5, 0.18]]);
    k.box("cabin", [1.1, 0.55, 1.6], [0, TOP, -1.9], "mast", { omit: ["-y"] });
    // two masts; each boom runs aft from its mast, with the furled sail on it
    for (const [z, tip, boomY, boom] of [[1.2, 7.4, 3.2, 1.7], [-0.9, 6.0, 2.6, 2.1]]) {
      k.cyl("mast", 0.07, tip - TOP, [0, TOP, z], "mast", { top: 0.05, seg: 5 });
      k.box("boom", [0.06, 0.06, boom], [0, boomY, z - boom / 2], "mast");
      k.box("sail", [0.22, 0.26, boom - 0.2], [0, boomY + 0.06, z - boom / 2], "sail", { omit: ["-y"] });
    }
    k.box("bowsprit", [0.07, 0.07, 2.0], [0, 0.8, 4.4], "mast", { rot: [-0.1, 0, 0] });
  },
});
