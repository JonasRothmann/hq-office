// A low ash desk on blackened steel sled legs, two tiles wide: a screen on an oak riser, a keyboard, a mouse on a felt
// pad, a notebook and a mug. Its front (+z) is where its worker sits; the back edge meets the desk opposite.
import { defineObject } from "@hq/world/model";

const TOP = 0.57;            // desk height for 1.35 m people (the old office's DESK_H)
const W = 1.56, D = 0.72;
const Z = -0.08;             // the top's centre: pushed back, so a facing pair reads as one island
const BACK = Z - D / 2, FRONT = Z + D / 2;
const UNDER = TOP - 0.042;   // the underside of the edge band

export default defineObject({
  id: "desk",
  footprint: [2, 1],
  height: 1.05,
  tags: ["work", "surface"],
  anchors: { hud: [0, 1.35, 0], screen: [0.06, 0.86, BACK + 0.18] },
  instance: true,
  build(k) {
    k.box("top", [W, 0.03, D], [0, TOP - 0.03, Z], "ash");
    k.box("edge", [W + 0.008, 0.012, D + 0.008], [0, UNDER, Z], "ash-edge");
    // sled legs: a runner on the floor, two posts on it, a rail on the posts under the top; runners and rails are
    // narrower than the posts so their sides never share a plane
    for (const sx of [-1, 1]) {
      const x = sx * (W / 2 - 0.06);
      k.box("runner", [0.026, 0.025, D - 0.06], [x, 0, Z], "steel");
      for (const z of [BACK + 0.05, FRONT - 0.05]) k.box("post", [0.03, UNDER - 0.055, 0.03], [x, 0.025, z], "steel");
      k.box("rail", [0.026, 0.03, D - 0.12], [x, UNDER - 0.03, Z], "steel");
    }
    k.box("cable-tray", [W * 0.55, 0.06, 0.1], [0, UNDER - 0.07, BACK + 0.09], "steel");

    // the screen on an oak riser, facing the worker
    const sx = 0.06, sz = BACK + 0.15;
    k.box("riser", [0.42, 0.07, 0.18], [sx, TOP, sz], "oak");
    k.box("stand-foot", [0.12, 0.012, 0.09], [sx, TOP + 0.07, sz], "steel-light");
    k.box("stand-neck", [0.035, 0.07, 0.025], [sx, TOP + 0.082, sz - 0.02], "steel-light");
    k.box("monitor", [0.54, 0.32, 0.022], [sx, TOP + 0.13, sz], "ink");
    k.glow("screen", [0.5, 0.28, 0.004], [sx, TOP + 0.15, sz + 0.013], "screen-glow");
    k.box("code", [0.22, 0.012, 0.002], [sx - 0.1, TOP + 0.37, sz + 0.0175], "screen-code");
    k.box("code", [0.3, 0.012, 0.002], [sx - 0.06, TOP + 0.34, sz + 0.0175], "screen-code");
    k.box("code", [0.16, 0.012, 0.002], [sx - 0.13, TOP + 0.31, sz + 0.0175], "screen-code");

    // keyboard, a felt pad with the mouse, a notebook with a pen, a mug
    k.box("keyboard", [0.38, 0.016, 0.12], [sx, TOP, FRONT - 0.22], "ceramic");
    k.box("keys", [0.35, 0.006, 0.095], [sx, TOP + 0.016, FRONT - 0.22], "paper-edge");
    k.box("pad", [0.22, 0.01, 0.18], [sx + 0.33, TOP, FRONT - 0.2], "felt");
    k.box("mouse", [0.05, 0.02, 0.08], [sx + 0.33, TOP + 0.01, FRONT - 0.2], "ceramic");
    k.box("notebook", [0.17, 0.014, 0.22], [-W / 2 + 0.24, TOP, FRONT - 0.2], "indigo", { rot: [0, 0.25, 0] });
    k.box("pages", [0.16, 0.01, 0.21], [-W / 2 + 0.24, TOP + 0.014, FRONT - 0.2], "paper", { rot: [0, 0.25, 0] });
    k.box("pen", [0.008, 0.008, 0.13], [-W / 2 + 0.33, TOP + 0.024, FRONT - 0.22], "ink", { rot: [0, -0.3, 0] });
    k.cyl("mug", 0.035, 0.08, [W / 2 - 0.14, TOP, Z - 0.02], "clay", { seg: 8 });
    k.box("mug-handle", [0.012, 0.04, 0.03], [W / 2 - 0.1, TOP + 0.02, Z - 0.02], "clay");
    k.cyl("tea", 0.03, 0.01, [W / 2 - 0.14, TOP + 0.068, Z - 0.02], "smoked", { seg: 8 });
  },
});
