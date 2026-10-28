// A long low oak tea table on two smoked plank ends: a smoked tray with a teapot and two cups, and a stone dish.
import { defineObject } from "@hq/world/model";
import { ball } from "./look/shapes.js";

const TOP_Y = 0.28;          // the top's underside; the top is 4 cm thick, so its top is at 0.32
const TRAY_Y = 0.32;         // the tray stands on the top
const TEA = { x: 0.18, z: -0.02 };

export default defineObject({
  id: "tea-table",
  footprint: [2, 1],
  height: 0.46,
  tags: ["surface"],
  build(k) {
    k.box("top", [1.4, 0.04, 0.6], [0, TOP_Y, 0], "oak");
    for (const x of [-0.64, 0.64]) k.box("plank-end", [0.04, TOP_Y, 0.5], [x, 0, 0], "smoked");
    k.box("stretcher", [1.22, 0.03, 0.03], [0, 0.06, 0], "smoked");

    k.box("tray", [0.7, 0.02, 0.4], [0, TRAY_Y, 0], "smoked");
    ball(k, "pot", 0.06, [TEA.x, TRAY_Y + 0.02, TEA.z], "charcoal", { sy: 0.8 });
    k.cyl("lid", 0.02, 0.012, [TEA.x, TRAY_Y + 0.02 + 0.096, TEA.z], "charcoal", { seg: 10 });
    k.cyl("knob", 0.008, 0.01, [TEA.x, TRAY_Y + 0.02 + 0.108, TEA.z], "charcoal", { seg: 6 });
    k.box("spout", [0.08, 0.018, 0.018], [TEA.x + 0.075, TRAY_Y + 0.052, TEA.z], "charcoal");
    k.box("handle", [0.02, 0.08, 0.012], [TEA.x - 0.065, TRAY_Y + 0.05, TEA.z], "charcoal");

    k.cyl("cup", 0.035, 0.07, [-0.18, TRAY_Y + 0.02, -0.06], "ceramic", { top: 0.04, seg: 8 });
    k.cyl("cup", 0.035, 0.07, [-0.06, TRAY_Y + 0.02, 0.09], "ceramic", { top: 0.04, seg: 8 });

    k.cyl("dish", 0.06, 0.02, [0.5, TOP_Y + 0.04, 0.1], "stone", { seg: 12 });
  },
});
