// A writing desk with a monitor and a keyboard, two tiles wide. Its front (+z) is where its user sits.
import { defineObject } from "@hq/world/model";

const TOP = 0.57; // desk height for 1.35 m people (Sims proportions)

export default defineObject({
  id: "desk",
  footprint: [2, 1],
  height: 1.0,
  tags: ["work", "surface"],
  anchors: { hud: [0, 1.35, 0], screen: [0, 0.8, -0.2] },
  instance: true,
  build(k) {
    k.box("top", [1.7, 0.04, 0.7], [0, TOP - 0.04, -0.05], "oak");
    for (const x of [-0.8, 0.8]) for (const z of [-0.35, 0.25]) k.box("leg", [0.05, TOP - 0.04, 0.05], [x, 0, z], "oak-dark");
    k.box("rail", [1.5, 0.08, 0.02], [0, TOP - 0.12, -0.36], "oak-dark");
    k.box("monitor-foot", [0.2, 0.012, 0.14], [0, TOP, -0.22], "steel");
    k.box("monitor-neck", [0.04, 0.07, 0.02], [0, TOP + 0.012, -0.24], "steel");
    k.box("monitor", [0.52, 0.32, 0.03], [0, TOP + 0.082, -0.24], "steel");
    k.glow("screen", [0.47, 0.27, 0.004], [0, TOP + 0.107, -0.222], "screen-on");
    k.box("keyboard", [0.4, 0.015, 0.13], [-0.05, TOP, 0.12], "paper");
    k.box("mouse", [0.05, 0.015, 0.08], [0.25, TOP, 0.13], "paper");
    k.cyl("mug", 0.035, 0.09, [0.6, TOP, -0.1], "fabric-warm", { seg: 8 });
  },
});
