// A record player on a low smoked-oak cabinet against the back wall: two open cubbies behind a divider, full of records
// standing on their spines (four leaning), and on top an oak plinth with a brushed platter, a vinyl record with a rust
// label, a thin tonearm and two small ceramic speakers. It stands, so it blocks; its back is 1.5 cm off the wall.
import { defineObject } from "@hq/world/model";

const HALF = 0.67;                       // the inside of the cabinet, between its two sides (1.4 m wide outside)
const BACK = -0.41, FRONT = 0.01;        // the carcass's back and front: 0.42 m deep
const CZ = (BACK + FRONT) / 2;
const LEG = 0.06, TOP = 0.55;            // four short legs; the top stands at 55 cm
const PANEL = 0.03;                      // the boards are 3 cm thick
const INNER_BOT = LEG + PANEL, INNER_TOP = TOP - PANEL;   // the cubbies' floor and roof
const INNER_H = INNER_TOP - INNER_BOT;

// the records: 1.5 cm spines, 30 cm square, standing on the cubby floor and set 1 cm back from the front
const COLORS = ["rust", "indigo", "ochre", "sage", "charcoal", "oat", "blush"];
const REC_T = 0.015, REC_H = 0.3, REC_D = 0.3, PITCH = 0.021, UPRIGHT = 25;
const REC_Z = FRONT - 0.01 - REC_D / 2;
const EDGE = 0.0375;                     // from a side's inner face to the first record's centre: 3 cm clear and half a spine
const LEAN = 0.12;                       // radians: the leaning pair, which lean on the divider

export default defineObject({
  id: "record-player",
  footprint: [2, 1],
  height: 0.75,
  blocks: true,
  tags: ["decor", "signature"],
  build(k) {
    // the carcass: four legs, a bottom and a top board, two sides, a back and a divider; the front stays open
    for (const x of [-0.62, 0.62]) for (const z of [-0.37, -0.03]) k.box("leg", [0.04, LEG, 0.04], [x, 0, z], "steel");
    k.box("bottom", [2 * HALF, PANEL, FRONT - BACK], [0, LEG, CZ], "smoked");
    k.box("top", [2 * HALF, PANEL, FRONT - BACK], [0, INNER_TOP, CZ], "smoked");
    for (const x of [-HALF - PANEL / 2, HALF + PANEL / 2]) k.box("side", [PANEL, TOP - LEG, FRONT - BACK], [x, LEG, CZ], "smoked");
    k.box("back", [2 * HALF, INNER_H, 0.012], [0, INNER_BOT, BACK + 0.006], "smoked-dark");
    k.box("divider", [PANEL, INNER_H, FRONT - (BACK + 0.012)], [0, INNER_BOT, (BACK + 0.012 + FRONT) / 2], "smoked");

    // the records in each cubby: a row of upright ones from the outer side, and two leaning on the divider
    let n = 0;
    for (const s of [-1, 1]) {
      for (let i = 0; i < UPRIGHT; i++, n++) {
        k.box("record", [REC_T, REC_H, REC_D], [s * (HALF - EDGE - i * PITCH), INNER_BOT, REC_Z], COLORS[n % COLORS.length]);
      }
      // each leaning record is lifted 1 mm so its low corner stays clear of the floor board
      for (const d of [0.055, 0.09]) {
        k.box("record", [REC_T, REC_H, REC_D], [s * d, INNER_BOT + 0.001, REC_Z], COLORS[n++ % COLORS.length], { rot: [0, 0, s * LEAN] });
      }
    }

    // the turntable on the top: an oak plinth, a brushed platter, a vinyl record with a rust label, a tonearm and speakers
    const PX = -0.22, PZ = -0.2, PLATE = TOP + 0.05;   // the plinth stands 5 cm above the top; the platter sits on it
    k.box("plinth", [0.4, 0.05, 0.36], [PX, TOP, PZ], "oak", { omit: ["-y"] });
    k.cyl("platter", 0.15, 0.02, [PX, PLATE, PZ], "brushed", { seg: 24 });
    k.cyl("vinyl", 0.14, 0.006, [PX, PLATE + 0.02, PZ], "vinyl", { seg: 24 });
    k.cyl("label", 0.045, 0.002, [PX, PLATE + 0.026, PZ], "rust", { seg: 16 });

    // the tonearm turns about a post at the back right of the platter; its head reaches onto the record
    const pivot = [PX + 0.17, PZ - 0.1], head = [PX + 0.07, PZ + 0.02];
    const dx = head[0] - pivot[0], dz = head[1] - pivot[1];
    k.cyl("post", 0.014, 0.05, [pivot[0], PLATE, pivot[1]], "brushed", { seg: 10 });
    k.box("arm", [0.012, 0.012, Math.hypot(dx, dz)], [(pivot[0] + head[0]) / 2, PLATE + 0.042, (pivot[1] + head[1]) / 2], "brushed", { rot: [0, Math.atan2(dx, dz), 0] });

    // two small ceramic speakers on the right of the top
    for (const x of [0.33, 0.52]) k.cyl("speaker", 0.06, 0.18, [x, TOP, -0.2], "ceramic", { top: 0.045, seg: 14 });
  },
});
