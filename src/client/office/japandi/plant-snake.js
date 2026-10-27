// A snake plant: twelve upright sword leaves in a loose fan out of a charcoal pot. Each leaf is a broad lower part and a
// narrower tip, turned and tilted a little; some carry a pale edge stripe.
import { defineObject } from "@hq/world/model";

const POT_R = 0.1, POT_H = 0.2;
const LEN = [0.62, 0.8, 0.5, 0.85, 0.68, 0.45, 0.74, 0.56, 0.82, 0.48, 0.7, 0.6]; // leaf lengths, 0.45 to 0.85 m
const STRIPED = [2, 5, 8, 11];       // the leaves with a pale edge
const W = 0.07, T = 0.015;           // the lower part: 7 cm wide, 1.5 cm thick
const TIP_W = 0.035, TIP_T = 0.012;  // the tip: half as wide

// a leaf's axis, its width and its front, after the turn psi about y and the tilt th (rot [0, psi, th], as the monstera's lean)
const axis = (psi, th) => [-Math.sin(th) * Math.cos(psi), Math.cos(th), Math.sin(th) * Math.sin(psi)];
const across = (psi, th) => [Math.cos(th) * Math.cos(psi), Math.sin(th), -Math.cos(th) * Math.sin(psi)];
const front = (psi) => [Math.sin(psi), 0, Math.cos(psi)];

// a point s up the leaf's axis, u across its width and w out of its front, from its foot
const point = (foot, psi, th, s, u = 0, w = 0) => {
  const a = axis(psi, th), x = across(psi, th), z = front(psi);
  return foot.map((c, j) => c + s * a[j] + u * x[j] + w * z[j]);
};

export default defineObject({
  id: "plant-snake",
  footprint: [1, 1],
  height: 0.9,
  tags: ["decor", "green"],
  instance: true,
  build(k) {
    k.cyl("pot", POT_R, POT_H, [0, 0, 0], "charcoal", { top: POT_R * 1.12, seg: 12 });
    k.cyl("soil", POT_R * 1.02, 0.01, [0, POT_H - 0.013, 0], "soil", { seg: 12 });
    LEN.forEach((L, i) => {
      // the feet sit low in the pot, out of sight, at different heights; the outer leaves lean further
      const x0 = -0.04 + i * 0.0073;
      const foot = [x0, 0.03 + ((i * 5) % 7) * 0.003, 0.02 * Math.sin(i * 1.7)];
      const th = 0.05 + (0.15 * Math.abs(x0)) / 0.04;
      // the left leaves turn one way and the right ones the other, each to its own angle, so no two share a rotation
      const psi = i < 6 ? -0.3 + i * 0.07 : Math.PI - 0.26 + (i - 6) * 0.07;
      const rot = [0, psi, th];
      const colour = i % 2 ? "moss" : "leaf-dark";

      const lowH = (2 * L) / 3, tipS = lowH - 0.01;
      k.box("leaf", [W, lowH, T], foot, colour, { rot });
      k.box("tip", [TIP_W, L - tipS, TIP_T], point(foot, psi, th, tipS), colour, { rot });
      // the pale edge: a thin box 2 mm in front of the leaf, near its right-hand edge
      if (STRIPED.includes(i)) {
        const s0 = 0.16, s1 = lowH - 0.03;
        k.box("edge", [0.006, s1 - s0, 0.002], point(foot, psi, th, s0, 0.027, 0.0105), "leaf-pale", { rot });
      }
    });
  },
});
