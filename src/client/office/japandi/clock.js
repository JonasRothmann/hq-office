// A round wall clock high on a wall: a smoked oak rim, a paper face, twelve dots and two blackened hands. It hangs, so
// it does not block; its back is 5 mm clear of the wall's face (z = -0.425 in a tile against the wall).
import { defineObject } from "@hq/world/model";

const CY = 2.15;            // the face's centre, above the floor
const BACK = -0.42;         // the rim's back, 5 mm off the wall
const FACE = BACK + 0.036;  // the face's front: 4 mm in front of the rim's

// a disc of radius r and depth d whose back is at z: a cylinder turned to face the room (+z)
const disc = (k, part, r, d, z, color, seg = 20) => k.cyl(part, r, d, [0, CY, z], color, { seg, rot: [Math.PI / 2, 0, 0] });

export default defineObject({
  id: "clock",
  footprint: [1, 1],
  height: 2.35,
  blocks: false,
  tags: ["decor", "wall"],
  build(k) {
    disc(k, "rim", 0.17, 0.032, BACK, "smoked");
    disc(k, "face", 0.15, 0.032, BACK + 0.004, "paper");
    // twelve dots, the quarters larger; each stands 2 mm proud of the face
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2, s = i % 3 ? 0.012 : 0.022;
      k.box("dot", [s, s, 0.004], [Math.sin(a) * 0.125, CY + Math.cos(a) * 0.125 - s / 2, FACE + 0.004], "ink");
    }
    // the hands turn about the centre (a box turns about its bottom face's centre); the minute hand is 3 mm in front
    k.box("hand", [0.014, 0.075, 0.004], [0, CY, FACE + 0.004], "ink", { rot: [0, 0, 2.1] });
    k.box("hand", [0.01, 0.115, 0.004], [0, CY, FACE + 0.007], "ink", { rot: [0, 0, -0.5] });
    disc(k, "pin", 0.012, 0.012, FACE, "rust", 8);
  },
});
