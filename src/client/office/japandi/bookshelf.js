// An open ash bookcase against the back wall: two bays, six boards, rows of books, a few ceramics, and one bay left with a
// single vase and air around it.
import { defineObject } from "@hq/world/model";
import { ball } from "./look/shapes.js";

const W = 1.8, H = 1.8;
const T = 0.025;                     // sides and divider
const BT = 0.022;                    // boards
const BACK = -0.41, FRONT = -0.09;   // the wall side of the back panel; the front of the sides
const INNER = BACK + 0.01;           // the back panel is 1 cm thick
const EDGE = 0.008;                  // the sides' front edge strip
const BAY_W = W / 2 - T - T / 2;     // one bay, between a side and the divider
const P = (H - BT) / 5;              // board pitch: five bays

const SPINES = ["indigo", "rust", "linen", "sand", "charcoal", "sage", "ochre", "oat", "smoked-light"];

// A fixed sequence, so the bookcase is the same every time it is built.
function lcg(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

export default defineObject({
  id: "bookshelf",
  footprint: [2, 1],
  height: 1.8,
  tags: ["storage"],
  build(k) {
    const rnd = lcg(17);
    const pick = (list) => list[Math.floor(rnd() * list.length)];

    k.box("back", [W, H, 0.01], [0, 0, BACK + 0.005], "ash-edge");
    for (const sx of [-1, 1]) {
      const x = sx * (W / 2 - T / 2);
      k.box("side", [T, H, FRONT - EDGE - INNER], [x, 0, (INNER + FRONT - EDGE) / 2], "ash");
      k.box("side-edge", [T, H, EDGE], [x, 0, FRONT - EDGE / 2], "ash-edge");
    }
    k.box("divider", [T, H - 2 * BT, FRONT - 0.02 - INNER], [0, BT, (INNER + FRONT - 0.02) / 2], "ash");

    // boards sit 4 mm off the back panel and stop 1.2 cm behind the sides' front; the edge strip is their front
    const boardBack = INNER + 0.004, boardFront = FRONT - 0.012;
    for (let i = 0; i < 6; i++) {
      const y = i * P;
      k.box("board", [W - 2 * T, BT, boardFront - boardBack], [0, y, (boardBack + boardFront) / 2], "ash");
      k.box("board-edge", [W - 2 * T, BT, 0.008], [0, y, FRONT - 0.008], "ash-edge");
    }

    // the bays: left and right of the divider, each from the board below to the board above
    const bays = [];
    for (let r = 0; r < 5; r++) for (const bx0 of [-W / 2 + T, T / 2]) bays.push({ r, bx0 });
    for (const { r, bx0 } of bays) {
      const y = r * P + BT;
      if (r === 2 && bx0 > 0) {
        k.cyl("vase", 0.035, 0.2, [bx0 + BAY_W / 2, y, -0.22], "ceramic", { top: 0.025, seg: 10 });
        continue;
      }

      let x = bx0 + 0.03;
      const limit = bx0 + BAY_W * (0.5 + rnd() * 0.15);
      while (x < limit) {
        const bw = 0.022 + rnd() * 0.016;
        const bh = 0.2 + rnd() * 0.1;
        k.box("book", [bw, bh, 0.24], [x + bw / 2, y, -0.22], pick(SPINES));
        x += bw + 0.002;
      }

      const tx = (limit + bx0 + BAY_W) / 2;
      if ((r === 1 && bx0 < 0) || (r === 4 && bx0 > 0)) {
        // a lying stack of three, each a little turned
        ["indigo", "linen", "sand"].forEach((c, j) => k.box("lying", [0.2, 0.03, 0.15], [tx, y + j * 0.03, -0.22], c, { rot: [0, (j - 1) * 0.1, 0] }));
        continue;
      }
      const kind = Math.floor(rnd() * 3);
      if (kind === 0) k.cyl("vase", 0.035, 0.17, [tx, y, -0.22], pick(["ceramic", "charcoal", "clay"]), { top: 0.025, seg: 10 });
      else if (kind === 1) k.cyl("bowl", 0.05, 0.045, [tx, y, -0.22], "ceramic", { top: 0.08, seg: 12 });
      else ball(k, "ball", 0.04, [tx, y, -0.22], pick(["sand", "clay", "sage"]));
    }
  },
});
