// A tall window in a thin blackened steel frame: six panes in two columns and three rows, split by one mullion and two
// transoms. In an opening's frame x runs along the wall, z across it, and y = 0 is the floor.
import { defineObject } from "@hq/world/model";

const W = 0.84, SILL = 0.8, HEAD = 2.45;
const F = 0.04, DEPTH = 0.17;             // the frame: 4 cm bars, DEPTH > the wall's 0.15
const MULLION = 0.02, MULLION_D = 0.05;   // the bars inside the frame: 2 cm wide, 5 cm deep
const TRANSOM = 0.02;
const INNER_H = HEAD - SILL - 2 * F;      // between the rails
const PANE_H = (INNER_H - 2 * TRANSOM) / 3;
const PANE_W = (W / 2 - F) - MULLION / 2; // one column, from the mullion to the jamb
const COL = MULLION / 2 + PANE_W / 2;     // a column's centre, either side of the mullion
const rowY = (i) => SILL + F + i * (PANE_H + TRANSOM);

export default defineObject({
  id: "window",
  kind: "opening",
  width: W,
  sill: SILL,
  head: HEAD,
  passable: false,
  tags: ["window"],
  build(k) {
    k.box("rail", [W, F, DEPTH], [0, SILL, 0], "steel");
    k.box("rail", [W, F, DEPTH], [0, HEAD - F, 0], "steel");
    for (const s of [-1, 1]) k.box("jamb", [F, INNER_H, DEPTH], [s * (W / 2 - F / 2), SILL + F, 0], "steel");
    k.box("mullion", [MULLION, INNER_H, MULLION_D], [0, SILL + F, 0], "steel");
    // each transom is cut at the mullion, so the two bars never share a face
    for (const i of [0, 1]) for (const s of [-1, 1]) {
      k.box("transom", [PANE_W, TRANSOM, MULLION_D], [s * COL, rowY(i) + PANE_H, 0], "steel");
    }
    for (const i of [0, 1, 2]) for (const s of [-1, 1]) {
      k.glass("pane", [PANE_W, PANE_H, 0.01], [s * COL, rowY(i), 0]);
    }
  },
});
