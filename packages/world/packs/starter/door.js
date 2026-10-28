// A door: a hole 0.84 m wide and 2.16 m tall, a frame 2 cm proud of the wall on both sides, and a leaf standing ajar.
// In an opening's frame x runs along the wall, z across it, and y = 0 is the floor.
import { defineObject } from "@hq/world/model";

const W = 0.84, H = 2.16, F = 0.06, DEPTH = 0.17; // DEPTH > the wall's 0.15, so frame faces never lie in wall faces

export default defineObject({
  id: "door",
  kind: "opening",
  width: W,
  sill: 0,
  head: H,
  passable: true,
  tags: ["door"],
  build(k) {
    for (const s of [-1, 1]) k.box("jamb", [F, H - F, DEPTH], [s * (W / 2 - F / 2), 0, 0], "trim");
    k.box("head", [W, F, DEPTH], [0, H - F, 0], "trim");
    // the leaf, hinged at the west jamb and open 70° toward +z
    const a = -1.2, hx = -(W / 2 - F), half = (W - 2 * F) / 2;
    k.box("leaf", [W - 2 * F, H - F - 0.02, 0.04], [hx + half * Math.cos(a), 0.01, -half * Math.sin(a)], "wood", { rot: [0, a, 0] });
  },
});
