// A rider sitting on the bike, leaning forward to the bars, in a white top and dark trousers; no head (the land adds one).
import { defineObject } from "@hq/world/model";

// A square rod t thick from a to b: a box along its length, its middle on the line between them.
function rod(k, part, [ax, ay, az], [bx, by, bz], t, color) {
  const dx = bx - ax, dy = by - ay, dz = bz - az, h = Math.hypot(dx, dz), L = Math.hypot(dx, dy, dz);
  const rot = [-Math.atan2(dy, h), Math.atan2(dx, dz), 0];
  // the box's up axis after the turn (rot applied to +y): it lifts the box's bottom face off the line by t / 2
  const lh = Math.hypot(dy, h), sx = -dy / lh, cx = h / lh, sy = h ? dx / h : 0, cy = h ? dz / h : 1;
  const up = [sy * sx, cx, cy * sx];
  const mid = [(ax + bx) / 2, (ay + by) / 2, (az + bz) / 2];
  k.box(part, [t, t, L], mid.map((v, i) => v - (t / 2) * up[i]), color, { rot });
}

export default defineObject({
  id: "rider",
  kind: "scenery",
  height: 1.4,
  build(k) {
    // the torso leans forward: from the saddle (y 0.85) up to the shoulders (y 1.35) over the bike's middle
    const lean = Math.atan2(0.2, 0.5);
    k.box("torso", [0.38, Math.hypot(0.5, 0.2), 0.22], [0, 0.85, -0.2], "#ffffff", { rot: [lean, 0, 0] });
    for (const s of [1, -1]) {
      rod(k, "arm", [s * 0.19, 1.25, -0.04], [s * 0.2, 0.9, 0.4], 0.09, "#ffffff");
      rod(k, "thigh", [s * 0.1, 0.85, -0.2], [s * 0.1, 0.56, 0.1], 0.13, "pants-0");
    }
    rod(k, "shin", [0.1, 0.56, 0.1], [0.1, 0.3, 0.1], 0.1, "pants-0");     // down to a pedal
    rod(k, "shin", [-0.1, 0.56, 0.1], [-0.1, 0.22, -0.1], 0.1, "pants-0");
  },
});
