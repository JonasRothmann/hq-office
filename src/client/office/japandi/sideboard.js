// A low smoked-oak sideboard on short steel legs against the back wall: four sliding doors (one in ochre) with fine
// grooves, and on top a vase of bare twigs tipped with leaves, a stack of books and a stone bowl.
import { defineObject } from "@hq/world/model";
import { ball } from "./look/shapes.js";

const W = 1.6, D = 0.38;
const BACK = -0.41, FRONT = BACK + D;  // the back stands 1 cm off the wall
const CZ = (BACK + FRONT) / 2;
const LEG = 0.12, TOP = 0.46;          // the body stands on its legs and tops out at 46 cm
const DOOR_Y = LEG + 0.02, DOOR_H = TOP - LEG - 0.04;

export default defineObject({
  id: "sideboard",
  footprint: [2, 1],
  height: 0.93,
  tags: ["storage", "surface"],
  build(k) {
    for (const sx of [-1, 1]) for (const z of [BACK + 0.05, FRONT - 0.05]) {
      k.box("leg", [0.025, LEG, 0.025], [sx * (W / 2 - 0.06), 0, z], "steel");
    }
    k.box("body", [W, TOP - LEG, D], [0, LEG, CZ], "smoked");

    // four doors across the front, each a finger's width short of the next; the last is ochre and has no grooves
    const n = 4, dw = (W - 0.06) / n;
    for (let i = 0; i < n; i++) {
      const fx = -W / 2 + 0.03 + dw * (i + 0.5);
      const ochre = i === n - 1;
      k.box("door", [dw - 0.012, DOOR_H, 0.012], [fx, DOOR_Y, FRONT + 0.006], ochre ? "ochre" : "oak");
      if (ochre) continue;
      for (let g = 1; g < 4; g++) {
        k.box("groove", [0.006, DOOR_H - 0.04, 0.004], [fx - dw / 2 + g * (dw / 4), DOOR_Y + 0.02, FRONT + 0.014], "smoked-light");
      }
    }

    // the vase, three bare twigs leaning out of it, each tipped with a leaf
    const vx = -0.46, vz = -0.2, neck = TOP + 0.16;
    k.cyl("vase", 0.05, 0.16, [vx, TOP, vz], "charcoal", { top: 0.035, seg: 10 });
    for (let i = 0; i < 3; i++) {
      const a = i * 2.1 + 0.4, lean = 0.22 + i * 0.12, len = 0.3 - i * 0.04;
      const rz = Math.cos(a) * lean, rx = Math.sin(a) * lean;
      const foot = neck - 0.01;
      k.box("twig", [0.01, len, 0.01], [vx, foot, vz], "branch", { rot: [rx, 0, rz] });
      // the twig's tip: rotated by rz, then rx (the box turns about its foot)
      const tipX = vx - Math.sin(rz) * len, tipY = foot + Math.cos(rz) * Math.cos(rx) * len, tipZ = vz + Math.cos(rz) * Math.sin(rx) * len;
      ball(k, "leaf", 0.035, [tipX, tipY - 0.021, tipZ], i % 2 ? "rust" : "leaf", { sy: 0.6, bands: 3, seg: 8 });
    }

    // two books lying flat, and a stone bowl
    ["indigo", "linen", "sage"].forEach((c, j) => k.box("book", [0.22, 0.03, 0.16], [0.42, TOP + j * 0.03, -0.16], c, { rot: [0, (j - 1) * 0.05, 0] }));
    k.cyl("bowl", 0.06, 0.045, [0.05, TOP, -0.18], "stone", { top: 0.085, seg: 12 });
  },
});
