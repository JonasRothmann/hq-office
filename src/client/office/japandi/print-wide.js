// A framed landscape print on a wall: a thin oak edge round an oat mat, a brush ring in charcoal that is not quite closed,
// a rust seal in the lower right corner and a sand horizon line across the bottom third. It hangs, so it does not block;
// its back is 5 mm clear of the wall's face (z = -0.425 in a tile against the wall).
import { defineObject } from "@hq/world/model";

const CY = 1.6;             // the print's centre, above the floor
const BACK = -0.42;         // the frame's back, 5 mm off the wall
const FW = 0.8, FH = 0.5;   // the frame's outside size
const EDGE = 0.03;          // the frame's border and depth

const RING_R = 0.14;        // the brush ring's radius
const RING_N = 14;          // short strokes round it
const RING_SPAN = Math.PI * 2 * 0.86; // the ring covers 86 % of a circle; the rest is the gap
const RING_A0 = 0.6;        // where the first stroke starts, in radians
const RING_Z0 = -0.4095;    // the first stroke's middle depth, just in front of the mat
const STEP_Z = 0.001;       // each stroke 1 mm further forward than the last

export default defineObject({
  id: "print-wide",
  footprint: [1, 1],
  height: 1.9,
  blocks: false,
  tags: ["decor", "wall"],
  build(k) {
    // the frame: four oak boxes, the top and bottom spanning the full width
    k.box("edge", [FW, EDGE, EDGE], [0, CY + FH / 2 - EDGE, BACK], "oak-edge");
    k.box("edge", [FW, EDGE, EDGE], [0, CY - FH / 2, BACK], "oak-edge");
    for (const x of [-1, 1]) k.box("edge", [EDGE, FH - 2 * EDGE, EDGE], [x * (FW / 2 - EDGE / 2), CY - FH / 2 + EDGE, BACK], "oak-edge");

    // the mat, set 2 mm behind the frame's back so the two never share a plane
    const MW = FW - 2 * EDGE - 0.01, MH = FH - 2 * EDGE - 0.01; // 5 mm clear of the frame on each side
    k.box("mat", [MW, MH, 0.006], [0, CY - MH / 2, BACK + 0.002], "oat");

    // the brush ring: each stroke a short charcoal box turned to lie on the ring, its thickness varying a little
    for (let i = 0; i < RING_N; i++) {
      const step = RING_SPAN / RING_N;
      const a = RING_A0 + (i + 0.5) * step;               // the stroke's angle round the ring
      const len = RING_R * step * 0.85;                   // 85 % of its slot: a small break between strokes, so none overlap
      const t = 0.010 + 0.005 * Math.sin((Math.PI * (i + 0.5)) / RING_N) + (i % 2) * 0.0015;
      // the box turns about its bottom-face centre, so `at` sits half a stroke back from the ring point
      const cx = RING_R * Math.cos(a), cy = CY + RING_R * Math.sin(a);
      const at = [cx + (Math.sin(a) * len) / 2, cy - (Math.cos(a) * len) / 2];
      k.box("stroke", [t, len, 0.004], [at[0], at[1], RING_Z0 + i * STEP_Z], "charcoal", { rot: [0, 0, a] });
    }

    // the rust seal, 2 mm proud of the mat in the lower right corner
    k.box("seal", [0.04, 0.04, 0.004], [0.27, CY - MH / 2 + 0.03, -0.41], "rust");

    // the sand horizon: a thin line across the bottom third of the mat, behind the ring
    k.box("horizon", [MW - 0.04, 0.003, 0.003], [0, CY - MH / 2 + MH / 3 / 2, -0.412], "sand");
  },
});
