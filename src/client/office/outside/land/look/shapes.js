// Shapes the kit has no call for, built from its cylinders: a ball (crowns, bushes, rocks; two bands make a low-poly
// diamond) and a cone. Each takes the kit first, like k.box.

// A ball of radius r whose bottom stands on `at`, squashed or stretched by sy, in `bands` rings of `seg` sides.
export function ball(k, part, r, [x, y, z], color, { sy = 1, bands = 2, seg = 6, finish = "matte" } = {}) {
  const h = (2 * r * sy) / bands;
  for (let i = 0; i < bands; i++) {
    const t0 = -1 + (2 * i) / bands, t1 = -1 + (2 * (i + 1)) / bands;
    const r0 = Math.max(r * Math.sqrt(1 - t0 * t0), 0.002), r1 = Math.max(r * Math.sqrt(1 - t1 * t1), 0.002);
    k.cyl(part, r0, h, [x, y + i * h, z], color, { top: r1, seg, finish });
  }
}

// A cone of radius r and height h standing on `at` (a conifer's tier, a spire, a blade of grass).
export function cone(k, part, r, h, at, color, { seg = 7, rot } = {}) {
  k.cyl(part, r, h, at, color, { top: 0.002, seg, ...(rot ? { rot } : {}) });
}
