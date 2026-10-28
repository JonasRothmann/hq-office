// A tea corner against the back wall: a low tansu cabinet with a tea tray, an incense dish and a bonsai, and a hanging scroll above.
import { defineObject } from "@hq/world/model";
import { ball } from "./look/shapes.js";

const TOP = 0.5;     // the cabinet's top; its back is at z = -0.4, clear of the wall's face at -0.425
const CZ = -0.2;     // the cabinet's centre, front to back

export default defineObject({
  id: "tea-corner",
  footprint: [2, 1],
  height: 1.85,
  tags: ["tea", "decor"],
  build(k) {
    // the tansu: four steel feet, a smoked body, two drawers 2 mm proud of its front, a steel pull on each
    for (const x of [-0.52, 0.52]) for (const z of [-0.34, -0.06]) k.box("foot", [0.05, 0.05, 0.05], [x, 0, z], "steel");
    k.box("cabinet", [1.2, 0.45, 0.4], [0, 0.05, CZ], "smoked");
    for (const x of [-0.29, 0.29]) k.box("drawer", [0.56, 0.36, 0.012], [x, 0.1, 0.008], "smoked-dark");
    for (const x of [-0.07, 0.07]) k.box("pull", [0.08, 0.03, 0.02], [x, 0.265, 0.024], "steel");

    // the tray: a teapot and two cups
    k.box("tray", [0.42, 0.02, 0.28], [0.15, TOP, -0.15], "smoked");
    ball(k, "teapot", 0.06, [0.05, TOP + 0.02, -0.2], "charcoal", { sy: 0.8, bands: 3, seg: 10 });
    k.cyl("lid", 0.018, 0.012, [0.05, 0.616, -0.2], "charcoal", { seg: 10 });
    k.box("spout", [0.08, 0.016, 0.016], [0.1, 0.56, -0.2], "charcoal");
    for (const [x, z] of [[0.24, -0.22], [0.3, -0.06]]) {
      k.cyl("cup", 0.035, 0.07, [x, TOP + 0.02, z], "ceramic", { top: 0.04, seg: 8 });
      k.cyl("tea", 0.03, 0.01, [x, 0.575, z], "smoked", { seg: 8 });
    }

    // a stone incense dish with one stick
    k.cyl("dish", 0.05, 0.02, [-0.35, TOP, -0.2], "stone", { top: 0.045, seg: 10 });
    k.box("stick", [0.006, 0.05, 0.006], [-0.35, TOP + 0.02, -0.2], "smoked-light");

    // a bonsai in a shallow clay pot: a leaning trunk and three flattened leaf balls
    k.cyl("pot", 0.09, 0.05, [0.46, TOP, -0.2], "clay", { top: 0.08, seg: 12 });
    k.cyl("soil", 0.075, 0.006, [0.46, TOP + 0.05, -0.2], "soil", { top: 0.07, seg: 12 });
    k.box("trunk", [0.02, 0.15, 0.02], [0.455, TOP + 0.056, -0.2], "branch", { rot: [0, 0, 0.25] });
    ball(k, "leaf", 0.065, [0.38, 0.6, -0.2], "leaf-dark", { sy: 0.45, bands: 3, seg: 10 });
    ball(k, "leaf", 0.06, [0.5, 0.64, -0.17], "leaf-dark", { sy: 0.45, bands: 3, seg: 10 });
    ball(k, "leaf", 0.06, [0.43, 0.68, -0.23], "leaf-dark", { sy: 0.45, bands: 3, seg: 10 });

    // the hanging scroll: a smoked rod at the top (it hangs from 1.85), a linen mount, a paper panel, a heavier rod at the foot
    k.box("rod-top", [0.44, 0.02, 0.024], [0, 1.83, -0.395], "smoked");
    for (const x of [-0.22, 0.22]) ball(k, "knob", 0.014, [x, 1.826, -0.395], "smoked-dark", { bands: 2, seg: 8 });
    k.box("mount", [0.36, 0.85, 0.01], [0, 0.95, -0.405], "linen");
    k.box("paper", [0.28, 0.7, 0.01], [0, 1.02, -0.393], "paper");
    k.box("rod-foot", [0.42, 0.03, 0.03], [0, 0.92, -0.395], "smoked");
    for (const x of [-0.21, 0.21]) ball(k, "knob", 0.015, [x, 0.925, -0.395], "smoked-dark", { bands: 2, seg: 8 });

    // the ink: a bare branch of four thin boxes, each 2 mm in front of the last so no two faces share a plane
    k.box("trunk", [0.014, 0.36, 0.01], [-0.06, 1.06, -0.381], "ink", { rot: [0, 0, -0.2] });
    k.box("branch", [0.012, 0.1, 0.01], [-0.036, 1.178, -0.379], "ink", { rot: [0, 0, 0.7] });
    k.box("branch", [0.012, 0.11, 0.01], [-0.016, 1.276, -0.377], "ink", { rot: [0, 0, -0.8] });
    k.box("branch", [0.012, 0.08, 0.01], [0, 1.354, -0.375], "ink", { rot: [0, 0, 0.3] });
    // three rust blossoms on the branch tips
    k.box("blossom", [0.02, 0.02, 0.012], [0.075, 1.38, -0.362], "rust");
    k.box("blossom", [0.02, 0.02, 0.012], [-0.115, 1.255, -0.36], "rust");
    k.box("blossom", [0.02, 0.02, 0.012], [-0.03, 1.44, -0.358], "rust");
  },
});
