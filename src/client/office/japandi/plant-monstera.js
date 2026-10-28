// A monstera: eight long stems rise from a clay pot and arch out, each ending in a broad split leaf that lies a little
// downhill. Each leaf is five flat lobes side by side, with a thin slit between them.
import { defineObject } from "@hq/world/model";

const POT_R = 0.14, POT_H = 0.22;
const LEAVES = 8;
const LOBE_W = 0.05, SLIT = 0.012, LOBE_T = 0.01; // a lobe's width, the slit between lobes, its thickness
const LOBE_V0 = [0.05, 0.02, 0, 0.02, 0.05];      // where each lobe starts along its leaf: the heart's notch
const LOBE_V1 = [0.23, 0.31, 0.35, 0.31, 0.23];   // where it ends: about 0.3 m across and 0.35 m long
const LEAF_DOWN = 0.4;                            // how far a leaf slopes down from its stem, in radians
const COLOURS = ["leaf", "leaf-dark", "leaf", "leaf-light", "leaf-dark", "leaf", "leaf-dark", "leaf-light"];

// A stem that stands on its foot (at) and leans toward azimuth a by theta: rot turns about the foot, so this
// rotation (yaw PI - a, then tilt theta) points the top outward at a
const lean = (a, theta) => [0, Math.PI - a, theta];

// A leaf that faces outward at azimuth a and slopes down by delta. Its length runs outward along the leaf's +z,
// its width across it along +x, and its face up along +y.
const tilt = (a, delta) => [delta, Math.PI / 2 - a, 0];

// A point turned by rot = [rx, ry, rz], the same turn the kit gives a part: Z, then X, then Y.
function turn([x, y, z], [rx, ry, rz]) {
  const cz = Math.cos(rz), sz = Math.sin(rz), cx = Math.cos(rx), sx = Math.sin(rx), cy = Math.cos(ry), sy = Math.sin(ry);
  [x, y] = [cz * x - sz * y, sz * x + cz * y];
  [y, z] = [cx * y - sx * z, sx * y + cx * z];
  [x, z] = [cy * x + sy * z, -sy * x + cy * z];
  return [x, y, z];
}

export default defineObject({
  id: "plant-monstera",
  footprint: [1, 1],
  height: 1.18,
  tags: ["decor", "green"],
  instance: true,
  build(k) {
    k.cyl("pot", POT_R, POT_H, [0, 0, 0], "clay", { top: POT_R * 1.12, seg: 12 });
    k.cyl("soil", POT_R * 1.02, 0.01, [0, POT_H - 0.013, 0], "soil", { seg: 12 });
    for (let i = 0; i < LEAVES; i++) {
      // 22.5 degrees off the axes, so no leaf points square at a wall; the stems alternate in height
      const a = (i * 2 * Math.PI) / LEAVES + Math.PI / 8;
      const odd = i % 2;
      const theta = 0.12, L = 0.66 + 0.08 * odd;
      const foot = [Math.cos(a) * 0.03, 0.2, Math.sin(a) * 0.03];
      k.box("stem", [0.014, L, 0.014], foot, "leaf-dark", { rot: lean(a, theta) });
      // the stem's top is where the leaf joins it
      const q = [
        foot[0] + Math.sin(theta) * Math.cos(a) * L,
        foot[1] + Math.cos(theta) * L,
        foot[2] + Math.sin(theta) * Math.sin(a) * L,
      ];
      // every lobe of this leaf shares the leaf's tilt, so the five lie on one plane, side by side
      const rot = tilt(a, LEAF_DOWN);
      for (let j = 0; j < 5; j++) {
        const u = (j - 2) * (LOBE_W + SLIT);
        const v0 = LOBE_V0[j], v1 = LOBE_V1[j];
        // the lobe's bottom centre sits half a thickness under the leaf's plane, so the plane runs through its middle
        const p = turn([u, -LOBE_T / 2, (v0 + v1) / 2], rot);
        k.box("lobe", [LOBE_W, LOBE_T, v1 - v0], [q[0] + p[0], q[1] + p[1], q[2] + p[2]], COLOURS[i], { rot });
      }
    }
  },
});
