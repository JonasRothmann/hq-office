// The long dining table of the break area: an oak top on two smoked slab legs, three ash chairs behind it, an oak bench
// in front, and on top a vase of twigs, two mugs and a folded newspaper.
import { defineObject } from "@hq/world/model";

const TOP_Y = 0.70;          // the top's underside; the top is 4 cm thick, so its top is at 0.74
const TOP_H = 0.74;
const LIFT = 0.002;          // things standing on the top sit 2 mm clear of it (cylinders cannot omit a face)
const CHAIR_Z = -0.74;       // the chairs' seat centre, behind the table's back edge
const BENCH_Z = 0.70;        // the bench's centre, along the front

// an ash chair facing the table (+z): four legs, a seat, two rails in the back, and a linen or rust pad on the seat
function chair(k, cx, pad) {
  const z = CHAIR_Z;
  for (const x of [-0.18, 0.18]) {
    k.box("leg", [0.03, 0.42, 0.03], [cx + x, 0, z + 0.17], "ash");           // front legs stop under the seat
    k.box("back-post", [0.03, 0.88, 0.03], [cx + x, 0, z - 0.17], "ash");     // back posts run up to the top
  }
  k.box("seat", [0.42, 0.03, 0.40], [cx, 0.42, z], "ash", { omit: ["-y"] });
  for (const y of [0.62, 0.80]) k.box("rail", [0.36, 0.04, 0.02], [cx, y, z - 0.17], "ash-edge");
  if (pad) k.box("pad", [0.36, 0.025, 0.34], [cx, 0.45, z + 0.01], pad, { omit: ["-y"] });
}

export default defineObject({
  id: "dining-table",
  footprint: [4, 2],
  height: 1.2,
  blocks: true,
  tags: ["table", "break"],
  build(k) {
    // the table: a 3 m oak top on two smoked slab legs set in from the ends, with a stretcher between them
    k.box("top", [3.0, 0.04, 0.9], [0, TOP_Y, 0], "oak", { omit: ["-y"] });
    for (const x of [-1.1, 1.1]) k.box("leg", [0.05, TOP_Y, 0.62], [x, 0, 0], "smoked");
    k.box("stretcher", [2.2, 0.04, 0.03], [0, 0.16, 0], "smoked");

    // three chairs along the back; the first and the last have a seat pad
    chair(k, -0.9, "linen");
    chair(k, 0, null);
    chair(k, 0.9, "rust");

    // a long low oak bench along the front on two smoked legs
    k.box("bench-seat", [2.6, 0.04, 0.32], [0, 0.41, BENCH_Z], "oak", { omit: ["-y"] });
    for (const x of [-1.0, 1.0]) k.box("bench-leg", [0.05, 0.41, 0.28], [x, 0, BENCH_Z], "smoked");

    // on the top: a ceramic vase of three thin twigs, two grey mugs and a folded newspaper lying flat
    const vx = -0.75, vz = -0.05, mouth = TOP_H + LIFT + 0.17;
    k.cyl("vase", 0.05, 0.17, [vx, TOP_H + LIFT, vz], "ceramic", { top: 0.035, seg: 12 });
    for (let i = 0; i < 3; i++) {
      const a = i * 2.1 + 0.4, lean = 0.22 + i * 0.12, len = 0.28 - i * 0.03;
      k.box("twig", [0.008, len, 0.008], [vx, mouth - 0.01, vz], "branch", { rot: [Math.sin(a) * lean, 0, Math.cos(a) * lean] });
    }

    for (const [mx, mz] of [[0.2, -0.12], [0.42, 0.12]]) {
      k.cyl("mug", 0.04, 0.09, [mx, TOP_H + LIFT, mz], "ceramic-grey", { seg: 10 });
      k.box("handle", [0.012, 0.05, 0.02], [mx + 0.045, TOP_H + LIFT + 0.02, mz], "ceramic-grey");
    }

    k.box("newspaper", [0.3, 0.01, 0.42], [0.8, TOP_H, 0.05], "paper", { omit: ["-y"], rot: [0, 0.15, 0] });
  },
});
