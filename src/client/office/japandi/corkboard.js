// A corkboard on a team room's wall: an oak frame round a cork panel, with six cards and a photo pinned to it. Each one
// stands 2 mm further forward than the last, a few are turned a little, and a round pin holds each. It hangs, so it does
// not block; its back is 5 mm clear of the wall's face (z = -0.425 in a tile against the wall).
import { defineObject } from "@hq/world/model";

const CY = 1.5;                  // the cork's centre, above the floor
const CW = 0.84, CH = 0.58;      // the cork's width and height
const EDGE = 0.04;               // the frame's border
const BACK = -0.42;              // the frame's back, 5 mm off the wall
const CORK_BACK = BACK + 0.002;  // the cork stands 2 mm in front of the frame's back
const CORK_FRONT = CORK_BACK + 0.012;
const STEP = 0.002;              // each card stands 2 mm further forward than the last
const CARD = 0.003;              // a card's thickness
const PIN_R = 0.006, PIN_H = 0.007;
const PIN_COLORS = ["rust", "indigo", "brass"];

// the cards from the back forward: token, width, height, centre x and y, turn about z, and ink lines as [width, y] on them
const CARDS = [
  ["paper", 0.16, 0.12, -0.27, 1.66, 0.06, []],
  ["oat", 0.12, 0.09, -0.06, 1.68, -0.04, [[0.09, 0.025], [0.07, 0], [0.085, -0.025]]],
  ["ochre", 0.09, 0.09, 0.33, 1.7, -0.1, []],
  ["sage", 0.14, 0.1, -0.3, 1.36, -0.03, []],
  ["blush", 0.1, 0.13, -0.04, 1.38, 0, [[0.07, 0.035], [0.08, 0.015], [0.05, -0.005]]],
  ["indigo-pale", 0.12, 0.11, 0.26, 1.35, 0.12, []],
];

// a plate of size [w, h, d] centred on (x, y), its back on the plane z, turned rz about its centre
// (a box turns about its bottom centre, so that point is moved to keep the centre where it was asked for)
const plate = (k, part, [w, h, d], x, y, back, color, rz = 0) => {
  const s = Math.sin(rz), c = Math.cos(rz);
  k.box(part, [w, h, d], [x + (s * h) / 2, y - (c * h) / 2, back + d / 2], color, { rot: [0, 0, rz] });
};

// a point (lx, ly) along a card centred on (x, y) and turned rz
const onCard = (x, y, rz, lx, ly) => [x + lx * Math.cos(rz) - ly * Math.sin(rz), y + lx * Math.sin(rz) + ly * Math.cos(rz)];

// a round pin on a plane z, turned to face the room (a cylinder runs from its bottom centre toward +z)
const pin = (k, [x, y], z, color) => k.cyl("pin", PIN_R, PIN_H, [x, y, z], color, { seg: 8, rot: [Math.PI / 2, 0, 0] });

export default defineObject({
  id: "corkboard",
  footprint: [1, 1],
  height: 1.9,
  blocks: false,
  tags: ["decor", "wall"],
  build(k) {
    // the oak frame: a top and a bottom bar, and a bar each side
    plate(k, "frame", [CW + 2 * EDGE, EDGE, 0.03], 0, CY + CH / 2 + EDGE / 2, BACK, "oak-edge");
    plate(k, "frame", [CW + 2 * EDGE, EDGE, 0.03], 0, CY - CH / 2 - EDGE / 2, BACK, "oak-edge");
    for (const sx of [-1, 1]) plate(k, "frame", [EDGE, CH, 0.03], (sx * (CW + EDGE)) / 2, CY, BACK, "oak-edge");
    plate(k, "cork", [CW, CH, CORK_FRONT - CORK_BACK], 0, CY, CORK_BACK, "cork");

    // each card one step further forward; a round pin near its top edge, and its ink lines 2 mm in front
    CARDS.forEach(([token, w, h, x, y, rz, lines], i) => {
      const back = CORK_FRONT + STEP * i, front = back + CARD;
      plate(k, "card", [w, h, CARD], x, y, back, token, rz);
      pin(k, onCard(x, y, rz, 0, h / 2 - 0.015), front, PIN_COLORS[i % 3]);
      for (const [lw, ly] of lines) {
        const [ix, iy] = onCard(x, y, rz, -w / 2 + 0.015 + lw / 2, ly);
        plate(k, "ink", [lw, 0.01, 0.002], ix, iy, front + 0.002, "ink", rz);
      }
    });

    // the photo: a paper mat with a picture 2 mm in front of it, the frontmost thing on the board
    const pBack = CORK_FRONT + STEP * CARDS.length, pFront = pBack + CARD;
    plate(k, "photo", [0.2, 0.15, CARD], 0.18, 1.6, pBack, "paper", 0.08);
    plate(k, "picture", [0.17, 0.12, 0.002], 0.18, 1.6, pFront + 0.002, "indigo-light", 0.08);
    pin(k, onCard(0.18, 1.6, 0.08, 0, 0.0675), pFront, "indigo");
  },
});
