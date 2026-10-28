// A tall stoneware floor vase with five bare twigs arranged in it, three tipped with a rust or leaf bud.
import { defineObject } from "@hq/world/model";
import { ball } from "./look/shapes.js";

const TWIGS = [
  { a: 0.5, lean: 0.1, bud: "rust" },
  { a: 1.76, lean: 0.22, bud: null },
  { a: 3.02, lean: 0.05, bud: "leaf" },
  { a: 4.28, lean: 0.3, bud: null },
  { a: 5.54, lean: 0.16, bud: "rust" },
];

export default defineObject({
  id: "vase",
  footprint: [1, 1],
  height: 1.43,
  tags: ["decor"],
  instance: true,
  build(k) {
    k.cyl("body", 0.12, 0.3, [0, 0, 0], "stone", { top: 0.1, seg: 12 });
    k.cyl("shoulder", 0.1, 0.1, [0, 0.3, 0], "stone", { top: 0.06, seg: 12 });
    k.cyl("neck", 0.06, 0.1, [0, 0.4, 0], "stone", { top: 0.055, seg: 10 });
    // each twig stands on its foot inside the neck and leans out at its own angle; the tip reaches about 1.4 m
    TWIGS.forEach(({ a, lean, bud }, i) => {
      const L = 0.94 / Math.cos(lean);
      const foot = [Math.cos(a) * 0.012, 0.44 + i * 0.006, Math.sin(a) * 0.012];
      k.box("twig", [0.012, L, 0.012], foot, "branch", { rot: [0, Math.PI - a, lean] });
      if (!bud) return;
      const tip = [
        foot[0] + Math.sin(lean) * Math.cos(a) * L,
        foot[1] + Math.cos(lean) * L,
        foot[2] + Math.sin(lean) * Math.sin(a) * L,
      ];
      ball(k, "bud", 0.028, [tip[0], tip[1] - 0.028, tip[2]], bud, { sy: 0.8, bands: 3, seg: 8 });
    });
  },
});
