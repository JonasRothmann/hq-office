// A low lounge chair for a reading corner: an ash frame on four splayed legs with arms on two side rails, a deep linen
// seat, a linen back cushion leaning back on an ash board, a rust throw folded over one arm, and a short stack of books
// on the floor beside it. Its front (+z) is where you sit.
import { defineObject } from "@hq/world/model";

const BASE_TOP = 0.18;   // the frame's top; the seat cushion sits on it
const SEAT_TOP = 0.36;   // the seat cushion's top
const ARM_TOP = 0.555;   // the side rails' top

export default defineObject({
  id: "lounge-chair",
  footprint: [1, 1],
  height: 0.85,
  blocks: true,
  tags: ["seat", "signature"],
  slots: { seat: { at: [0, 0.05], y: 0.4, facing: "s", stand: [[0, 1]], clip: "sit" } },
  build(k) {
    // four legs, splayed: each leans out at the floor, so its top sits inside the frame. The tilt lifts a corner
    // of each foot by a few mm, so the feet start 5 mm up and the frame still stands on them
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      k.box("leg", [0.03, 0.14, 0.03], [sx * 0.34, 0.005, sz * 0.32], "ash", { rot: [-sz * 0.1, 0, sx * 0.1] });
    }
    k.box("base", [0.78, 0.04, 0.8], [0, 0.14, 0], "ash");

    // the arms: a post at each front and back corner, and a side rail on top of each pair
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) k.box("arm-post", [0.035, ARM_TOP - 0.035 - BASE_TOP, 0.035], [sx * 0.38, BASE_TOP, sz * 0.34], "ash");
      k.box("arm-rail", [0.035, 0.035, 0.78], [sx * 0.38, ARM_TOP - 0.035, -0.01], "ash");
    }

    // the back board the back cushion leans on, a little wider than the seat; its foot sinks into the frame
    k.box("back-board", [0.74, 0.44, 0.03], [0, 0.16, -0.36], "ash-edge");

    // the seat: a deep linen cushion, its bottom left out since it stands on the frame
    k.box("seat-cushion", [0.66, SEAT_TOP - BASE_TOP, 0.68], [0, BASE_TOP, 0.02], "linen", { omit: ["-y"] });

    // the back cushion leans back about its bottom edge, against the board
    k.box("back-cushion", [0.6, 0.44, 0.13], [0, 0.345, -0.195], "linen", { rot: [-0.2, 0, 0], omit: ["-y"] });

    // a rust throw folded over the left arm: a fold across the rail, and a drape down its outer side
    k.box("throw-fold", [0.1, 0.035, 0.34], [-0.38, ARM_TOP, -0.02], "rust", { omit: ["-y"] });
    k.box("throw-drape", [0.02, 0.21, 0.34], [-0.4065, 0.33, -0.02], "rust");

    // three books on the floor beside the chair, each on the one under it
    k.box("book", [0.13, 0.03, 0.19], [0.42, 0, 0.19], "indigo");
    k.box("book", [0.12, 0.025, 0.18], [0.42, 0.03, 0.2], "oat", { rot: [0, 0.1, 0], omit: ["-y"] });
    k.box("book", [0.11, 0.025, 0.17], [0.42, 0.055, 0.19], "sage", { rot: [0, -0.06, 0], omit: ["-y"] });
  },
});
