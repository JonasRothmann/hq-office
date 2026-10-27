// A boro patchwork rug for under a desk pair: indigo and pale patches of uneven sizes tiling a field, with an indigo border.
import { defineObject } from "@hq/world/model";

const T = 0.013;                 // a flat cloth, thin enough to lie under the desk legs
const HX = 1.3, HZ = 0.8;        // half the overall size: 2.6 x 1.6
const B = 0.1;                   // the border's width
const CX = HX - B, CZ = HZ - B;  // the field's half-sizes: 2.4 x 1.4

// a flat piece over x0..x1 and z0..z1, standing on the floor: its bottom is the floor, so that face is left out
function flat(k, part, [x0, x1], [z0, z1], color) {
  k.box(part, [x1 - x0, T, z1 - z0], [(x0 + x1) / 2, 0, (z0 + z1) / 2], color, { omit: ["-y"] });
}

// the patches, in three rows from the back; each row's widths add up to the field's 2.4
const PATCHES = [
  [-CX, -0.6, -CZ, -0.2, "indigo-light"], [-0.6, -0.1, -CZ, -0.2, "linen"], [-0.1, CX, -CZ, -0.2, "oat"],
  [-CX, -0.6, -0.2, 0.3, "indigo-pale"], [-0.6, 0.5, -0.2, 0.3, "indigo"], [0.5, CX, -0.2, 0.3, "linen"],
  [-CX, -0.1, 0.3, CZ, "indigo-light"], [-0.1, 0.5, 0.3, CZ, "oat"], [0.5, CX, 0.3, CZ, "indigo-pale"],
];

export default defineObject({
  id: "rug-boro",
  footprint: [3, 2],
  height: 0.02,
  tags: ["rug"],
  blocks: false,
  build(k) {
    // the border: two long strips across the full width, two short ones between them
    flat(k, "border", [-HX, HX], [CZ, HZ], "indigo");
    flat(k, "border", [-HX, HX], [-HZ, -CZ], "indigo");
    flat(k, "border", [-HX, -CX], [-CZ, CZ], "indigo");
    flat(k, "border", [CX, HX], [-CZ, CZ], "indigo");
    for (const [x0, x1, z0, z1, color] of PATCHES) flat(k, "patch", [x0, x1], [z0, z1], color);
  },
});
