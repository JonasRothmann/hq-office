// A tall framed print on a wall: a thin smoked frame round a paper mat, and on the mat a rust sun above three hills (sage, moss,
// indigo). Each picture layer stands 2 mm further forward than the one behind, so no two faces share a plane. It hangs, so it
// does not block; its back is 5 mm clear of the wall's face (z = -0.425 in a tile against the wall).
import { defineObject } from "@hq/world/model";

const CY = 1.55;                // the frame's centre, above the floor
const W = 0.44, H = 0.6;        // the frame's outside size
const T = 0.03;                 // the frame's bars: 3 cm wide and 3 cm deep
const BACK = -0.42;             // the frame's back
const MAT_BACK = -0.41;         // the mat sits 1 cm behind the frame's front
const MAT_FRONT = MAT_BACK + 0.01;
const STEP = 0.002;             // each picture layer stands 2 mm further forward than the one behind
const SUN = MAT_FRONT + STEP;   // the sun is the furthest layer, behind the hills
const SAGE = SUN + STEP, MOSS = SAGE + STEP, INDIGO = MOSS + STEP;
const D = 0.008;                // a picture layer's depth
const HILL_FOOT = 1.34;         // the hills stand on this line, 6 cm above the mat's foot

// a hill: a wide base and a narrower step on its shoulder, both on the layer whose back is at z. The bases' undersides
// are hidden and lie in one plane, so they are left out.
const hill = (k, name, color, z, base, step) => {
  k.box(name, [base.w, base.top - HILL_FOOT, D], [base.x, HILL_FOOT, z], color, { omit: ["-y"] });
  k.box(`${name}-step`, [step.w, step.top - base.top, D], [step.x, base.top, z], color, { omit: ["-y"] });
};

export default defineObject({
  id: "print-tall",
  footprint: [1, 1],
  height: 1.9,
  blocks: false,
  tags: ["decor", "wall"],
  build(k) {
    // the frame: four bars round the mat
    k.box("frame", [W, T, T], [0, CY + H / 2 - T, BACK], "smoked");
    k.box("frame", [W, T, T], [0, CY - H / 2, BACK], "smoked");
    for (const s of [-1, 1]) k.box("frame", [T, H - 2 * T, T], [s * (W / 2 - T / 2), CY - H / 2 + T, BACK], "smoked");

    // the mat, with most of it left empty
    k.box("mat", [W - 2 * T, H - 2 * T, 0.01], [0, CY - H / 2 + T, MAT_BACK], "paper");

    // the sun: a disc turned to face the room, high on the mat
    k.cyl("sun", 0.055, D, [0.06, 1.66, SUN], "rust", { seg: 24, rot: [Math.PI / 2, 0, 0] });

    // the hills, the furthest and palest first; the nearest is lowest
    hill(k, "sage", "sage", SAGE, { x: -0.02, w: 0.28, top: 1.5 }, { x: -0.1, w: 0.12, top: 1.58 });
    hill(k, "moss", "moss", MOSS, { x: 0.03, w: 0.26, top: 1.46 }, { x: 0.11, w: 0.11, top: 1.53 });
    hill(k, "indigo", "indigo", INDIGO, { x: -0.04, w: 0.22, top: 1.4 }, { x: 0.06, w: 0.1, top: 1.45 });
  },
});
