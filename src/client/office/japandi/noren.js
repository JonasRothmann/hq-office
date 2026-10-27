// A doorway with a noren: a hole 0.84 m wide and 2.16 m tall, smoked jambs and a head, and two indigo cloth panels hung
// from a rod under the head, each with a linen band across its lower third. Nothing closes it: it is passable.
import { defineObject } from "@hq/world/model";

const W = 0.84, H = 2.16, F = 0.04, DEPTH = 0.17; // DEPTH > the wall's 0.15, so frame faces never lie in wall faces
const ROD = 0.012, ROD_Y = H - F - 0.02 - ROD;    // the rod sits just under the head, 8 mm clear of it
const CLOTH_W = 0.37, CLOTH_H = 0.62, CLOTH_D = 0.01, GAP = 0.02; // a 2 cm gap between the two panels
const CLOTH_TOP = ROD_Y, CLOTH_BOT = CLOTH_TOP - CLOTH_H;
const BAND_Y = CLOTH_BOT + 0.07, BAND_H = 0.06;   // the linen band across the lower third

export default defineObject({
  id: "noren",
  kind: "opening",
  width: W,
  sill: 0,
  head: H,
  passable: true,
  tags: ["door"],
  build(k) {
    for (const s of [-1, 1]) k.box("jamb", [F, H - F, DEPTH], [s * (W / 2 - F / 2), 0, 0], "smoked");
    k.box("head", [W, F, DEPTH], [0, H - F, 0], "smoked");
    k.box("rod", [W - 2 * F, ROD, ROD], [0, ROD_Y, 0], "smoked-light");

    for (const s of [-1, 1]) {
      const x = s * (GAP / 2 + CLOTH_W / 2);
      k.box("cloth", [CLOTH_W, BAND_Y - CLOTH_BOT, CLOTH_D], [x, CLOTH_BOT, 0], "indigo");
      // the band is its own box, as wide and thick as the panel, stacked in it
      k.box("band", [CLOTH_W, BAND_H, CLOTH_D], [x, BAND_Y, 0], "linen");
      k.box("cloth", [CLOTH_W, CLOTH_TOP - BAND_Y - BAND_H, CLOTH_D], [x, BAND_Y + BAND_H, 0], "indigo");
    }
  },
});
