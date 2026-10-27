// A painted steel column radiator on a wall under a window: sixteen slim columns between a header pipe along the top and
// one along the bottom, two brackets behind it, and at its right end a brass valve with a brushed pipe that runs down
// into the floor. It hangs, so it does not block; its back is 5 mm clear of the wall's face (z = -0.425).
import { defineObject } from "@hq/world/model";

const W = 0.86;                    // the radiator's width, end to end
const BOTTOM = 0.12;               // the underside of the bottom header, above the floor
const TOP = BOTTOM + 0.6;          // the top of the top header: 0.72 m, under the sill at 0.8 m
const R = 0.016;                   // a header's radius
const BACK = -0.41, DEPTH = 0.09;  // the back of the columns and their depth
const CZ = BACK + DEPTH / 2;       // the headers' and columns' centre line, front to back
const COLS = 16, COL_W = 0.024;    // the columns, and each one's width
const Y_LO = BOTTOM + R, Y_HI = TOP - R;   // the columns run from one header's axis to the other's
const COL_SPAN = 0.78;             // from the first column's centre to the last's
const YB = Y_LO;                   // the valve sits on the bottom header's axis

export default defineObject({
  id: "radiator",
  footprint: [1, 1],
  height: 0.76,
  blocks: false,
  tags: ["decor", "wall"],
  build(k) {
    // the columns: every other one in the shade, so the run reads as separate fins
    for (let i = 0; i < COLS; i++) {
      const x = -COL_SPAN / 2 + (i * COL_SPAN) / (COLS - 1);
      k.box("column", [COL_W, Y_HI - Y_LO, DEPTH], [x, Y_LO, CZ], i % 2 ? "radiator-shade" : "radiator");
    }

    // the headers: one along the top and one along the bottom, each turned to run along x
    k.cyl("header", R, W, [W / 2, Y_HI, CZ], "radiator", { rot: [0, 0, Math.PI / 2], seg: 12 });
    k.cyl("header", R, W, [W / 2, Y_LO, CZ], "radiator", { rot: [0, 0, Math.PI / 2], seg: 12 });

    // two brackets behind the columns, in the gaps between them, holding the radiator to the wall
    for (const x of [-0.208, 0.208]) k.box("bracket", [COL_W, 0.05, 0.05], [x, 0.66, CZ - 0.03], "steel");

    // the valve on the bottom header's right end, a stem on top, and the brushed pipe down to the floor
    k.cyl("valve", 0.022, 0.06, [0.47, YB, CZ], "brass", { rot: [0, 0, Math.PI / 2], seg: 12 });
    k.cyl("stem", 0.011, 0.04, [0.44, YB - 0.008, CZ], "brass", { seg: 8 });
    k.cyl("pipe", 0.009, YB, [0.44, 0, CZ], "brushed", { seg: 8 });
  },
});
