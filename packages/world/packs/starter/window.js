// A window: a hole from 0.9 m to 2.1 m, a frame 2 cm proud of the wall, two panes either side of a mullion.
// In an opening's frame x runs along the wall, z across it, and y = 0 is the floor.
import { defineObject } from "@hq/world/model";

const W = 0.8, SILL = 0.9, HEAD = 2.1, F = 0.05, DEPTH = 0.17, M = 0.03;

export default defineObject({
  id: "window",
  kind: "opening",
  width: W,
  sill: SILL,
  head: HEAD,
  passable: false,
  tags: ["window"],
  build(k) {
    const inner = HEAD - SILL - 2 * F;
    k.box("rail-low", [W, F, DEPTH], [0, SILL, 0], "trim");
    k.box("rail-high", [W, F, DEPTH], [0, HEAD - F, 0], "trim");
    for (const s of [-1, 1]) k.box("jamb", [F, inner, DEPTH], [s * (W / 2 - F / 2), SILL + F, 0], "trim");
    k.box("mullion", [M, inner, 0.05], [0, SILL + F, 0], "trim");
    const pane = W / 2 - F - M / 2;
    for (const s of [-1, 1]) k.glass("pane", [pane, inner, 0.01], [s * (M / 2 + pane / 2), SILL + F, 0]);
  },
});
