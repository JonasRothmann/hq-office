// A lit sign high on a wall: つくる ("make") in lit strokes on a smoked oak board. It hangs, so it does not block; its back
// is 5 mm clear of the wall's face (z = -0.425 in a tile against the wall). Every stroke stands 2 mm proud of the board,
// and each one is 2 mm further forward than the last, so no two strokes share a plane.
import { defineObject } from "@hq/world/model";

const CY = 1.95;            // the board's centre, above the floor
const BOARD_H = 0.38;       // the board is 0.94 m wide and 0.38 m tall
const BOARD_W = 0.94;
const BACK = -0.42;         // the board's back, 5 mm off the wall
const FRONT = -0.39;        // the board's front, 3 cm on
const PROUD = 0.002;        // strokes and edge stand 2 mm proud of the board
const STEP = 0.002;         // each stroke sits 2 mm further forward than the last
const T = 0.025;            // a stroke is 2.5 cm wide
const DEPTH = 0.004;        // and 4 mm deep

// the kana, each in its own frame (metres, x right, y up, centred on the glyph): one polyline per glyph
const TSU = [[-0.09, 0.095], [0.07, 0.1], [0.1, 0.02], [0.03, -0.107], [-0.1, -0.107]];
const KU = [[0.075, 0.107], [-0.07, 0], [0.075, -0.107]];

// the loop of る: seven points on a ring, 300 degrees round from where the return stroke meets it
const LOOP = Array.from({ length: 7 }, (_, i) => {
  const a = ((225 + 50 * i) * Math.PI) / 180;
  return [0.04 + 0.05 * Math.cos(a), -0.05 + 0.05 * Math.sin(a)];
});
const RU = [[-0.06, 0.107], [0.07, 0.107], [-0.09, -0.02], ...LOOP];

// the three kana side by side: x of each glyph's centre, then its strokes
const KANA = [[-0.27, TSU], [0, KU], [0.27, RU]];

// one stroke from a to b (glyph points, offset to the sign's centre), the n-th of the sign: a box turned about its
// bottom-centre, its back 2 mm further out than the stroke before it
function stroke(k, n, cx, [x0, y0], [x1, y1]) {
  const dx = x1 - x0, dy = y1 - y0;
  const len = Math.hypot(dx, dy) + T * 0.6;           // a little long, so the joins close
  const a = Math.atan2(dy, dx);
  const mx = cx + (x0 + x1) / 2, my = CY + (y0 + y1) / 2;
  const z = FRONT + PROUD + STEP * n + DEPTH / 2;     // the box's middle
  // the box's bottom-centre sits half a stroke width back from the middle, along its own "down"
  k.glow("stroke", [len, T, DEPTH], [mx + (Math.sin(a) * T) / 2, my - (Math.cos(a) * T) / 2, z], "sign-glow", { rot: [0, 0, a] });
}

export default defineObject({
  id: "sign",
  footprint: [1, 1],
  height: 2.16,
  blocks: false,
  tags: ["decor", "wall", "light"],
  anchors: { light: [0, 1.95, -0.15] },
  build(k) {
    // the smoked oak board, its back on z = -0.42
    k.box("board", [BOARD_W, BOARD_H, FRONT - BACK], [0, CY - BOARD_H / 2, (BACK + FRONT) / 2], "smoked");

    // a thin smoked-dark edge round the board: four bands, each 2 mm proud of the board's front
    const EZ = FRONT + PROUD / 2, EW = 0.02;
    const TOP = CY + BOARD_H / 2;
    k.box("edge", [BOARD_W, EW, PROUD], [0, TOP - EW, EZ], "smoked-dark");
    k.box("edge", [BOARD_W, EW, PROUD], [0, CY - BOARD_H / 2, EZ], "smoked-dark");
    for (const x of [-BOARD_W / 2 + EW / 2, BOARD_W / 2 - EW / 2]) {
      k.box("edge", [EW, BOARD_H - 2 * EW, PROUD], [x, CY - BOARD_H / 2 + EW, EZ], "smoked-dark");
    }

    // the lit strokes of つくる, numbered across the three kana so each one sits in its own plane
    let n = 0;
    for (const [cx, line] of KANA) {
      for (let i = 1; i < line.length; i++) stroke(k, n++, cx, line[i - 1], line[i]);
    }
  },
});
