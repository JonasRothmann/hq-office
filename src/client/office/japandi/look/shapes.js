// Shapes the kit has no call for, built from its cylinders: a ball (paper lanterns, leaves, bowls) as stacked rings.

// A ball of radius r whose bottom stands on `at`, squashed or stretched by sy, in `bands` rings.
// opts.finish "glow" makes it give light (a paper shade).
export function ball(k, part, r, [x, y, z], color, { sy = 1, bands = 4, seg = 10, finish = "matte" } = {}) {
  const h = (2 * r * sy) / bands;
  for (let i = 0; i < bands; i++) {
    const t0 = -1 + (2 * i) / bands, t1 = -1 + (2 * (i + 1)) / bands;
    const r0 = Math.max(r * Math.sqrt(1 - t0 * t0), 0.002), r1 = Math.max(r * Math.sqrt(1 - t1 * t1), 0.002);
    k.cyl(part, r0, h, [x, y + i * h, z], color, { top: r1, seg, finish });
  }
}
