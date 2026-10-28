// A large undyed linen rug for a team's desk island: a felt border round a cool linen field, a shade under the oak
// floor so it reads against it, with oat and charcoal bands near its short ends.
import { defineObject } from "@hq/world/model";

const T = 0.013;                 // a flat weave, thin enough to lie under the desk legs
const HX = 2.3, HZ = 1.7;        // half the overall size: 4.6 x 3.4
const B = 0.12;                  // the border's width
const CX = HX - B, CZ = HZ - B;  // the field's half-sizes

// a flat piece over x0..x1 and z0..z1, standing on the floor: its bottom is the floor, so that face is left out
function flat(k, part, [x0, x1], [z0, z1], color) {
  k.box(part, [x1 - x0, T, z1 - z0], [(x0 + x1) / 2, 0, (z0 + z1) / 2], color, { omit: ["-y"] });
}

// the field, cut across by bands: oat, charcoal, oat near each short end
const FIELD = [
  [-CX, -1.95, "rug-field"], [-1.95, -1.9, "oat"], [-1.9, -1.85, "charcoal"], [-1.85, -1.8, "oat"],
  [-1.8, 1.8, "rug-field"],
  [1.8, 1.85, "oat"], [1.85, 1.9, "charcoal"], [1.9, 1.95, "oat"], [1.95, CX, "rug-field"],
];

export default defineObject({
  id: "rug-linen",
  footprint: [5, 4],
  height: 0.02,
  tags: ["rug"],
  blocks: false,
  build(k) {
    // the border: two long strips across the full width, two short ones between them
    flat(k, "border", [-HX, HX], [CZ, HZ], "felt");
    flat(k, "border", [-HX, HX], [-HZ, -CZ], "felt");
    flat(k, "border", [-HX, -CX], [-CZ, CZ], "felt");
    flat(k, "border", [CX, HX], [-CZ, CZ], "felt");
    for (const [x0, x1, color] of FIELD) flat(k, "field", [x0, x1], [-CZ, CZ], color);
  },
});
