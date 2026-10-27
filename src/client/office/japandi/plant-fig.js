// A fiddle-leaf fig: a bare trunk in a ceramic pot, three short side branches near the top, and broad paddle leaves on
// short stalks at the branch tips and up the top of the trunk.
import { defineObject } from "@hq/world/model";

const POT_R = 0.17, POT_H = 0.34;
const TRUNK_TOP = 1.46;
const LEAVES = ["leaf", "leaf-dark", "leaf-light", "leaf-pale"];
const GOLDEN = 2.39;                                  // the golden angle: turns round the trunk never line up
const LEAF_L = 0.22, LEAF_W = 0.15, LEAF_T = 0.01, STALK = 0.05;

// three side branches, each on its own turn round the trunk, height and lift
const BRANCHES = [
  { y: 1.04, a: 0.4, e: 0.5, len: 0.26 },
  { y: 1.18, a: 0.4 + GOLDEN, e: 0.6, len: 0.24 },
  { y: 1.3, a: 0.4 + 2 * GOLDEN, e: 0.45, len: 0.22 },
];

// a unit direction from azimuth a (round the trunk) and elevation e (above the level)
const dir = (a, e) => [Math.cos(a) * Math.cos(e), Math.sin(e), Math.sin(a) * Math.cos(e)];
// the rot that turns a box's length (z) onto that direction: tilt about x, then yaw about y
const turn = (a, e) => [-e, Math.PI / 2 - a, 0];
// the point len along the direction from `from`
const along = (from, d, len) => [from[0] + d[0] * len, from[1] + d[1] * len, from[2] + d[2] * len];

// a thin part of length len running from `from` along (a, e)
function stick(k, part, from, a, e, len, size, color) {
  k.box(part, [size, size, len], along(from, dir(a, e), len / 2), color, { rot: turn(a, e) });
}

// a leaf on a short stalk that grows from `from` along (a, e); the leaf runs on from the stalk's end
function leafOn(k, i, from, a, e) {
  const d = dir(a, e), rot = turn(a, e);
  stick(k, "stalk", from, a, e, STALK, 0.008, "branch");
  k.box("leaf", [LEAF_W, LEAF_T, LEAF_L], along(from, d, STALK + LEAF_L / 2), LEAVES[i % 4], { rot });
}

export default defineObject({
  id: "plant-fig",
  footprint: [1, 1],
  height: 1.7,
  tags: ["decor", "green"],
  instance: true,
  build(k) {
    k.cyl("pot", POT_R, POT_H, [0, 0, 0], "ceramic", { top: POT_R * 1.12, seg: 12 });
    k.cyl("soil", POT_R * 1.02, 0.01, [0, POT_H - 0.013, 0], "soil", { seg: 12 });
    k.cyl("trunk", 0.018, TRUNK_TOP - 0.3, [0, 0.3, 0], "branch", { top: 0.012, seg: 6 });

    let n = 0;
    for (const b of BRANCHES) {
      const from = [0, b.y, 0];
      stick(k, "branch", from, b.a, b.e, b.len, 0.012, "branch");
      // four leaves fan out from each branch tip, a little apart in turn and in lift
      const tip = along(from, dir(b.a, b.e), b.len);
      for (let j = 0; j < 4; j++) leafOn(k, n++, tip, b.a + (j - 1.5) * 0.7, 0.55 + 0.18 * j);
    }
    // five leaves up the top of the trunk, each on its own golden turn
    const crown = [0, TRUNK_TOP - 0.04, 0];
    for (let j = 0; j < 5; j++) leafOn(k, n++, crown, j * GOLDEN + 0.2, 0.5 + 0.15 * j);
  },
});
