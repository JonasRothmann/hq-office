// A box-front cargo bike, 2.4 m long along +z: a wooden box between the rider and a small front wheel, white frame.
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
  id: "cargo-bike",
  kind: "scenery",
  height: 1.0,
  build(k) {
    k.cyl("wheel", 0.2, 0.05, [0.025, 0.2, 1.38], "tyre", { seg: 6, rot: [0, 0, Math.PI / 2] });
    k.cyl("wheel", 0.28, 0.05, [0.025, 0.28, -0.55], "tyre", { seg: 6, rot: [0, 0, Math.PI / 2] });
    rod(k, "tube", [0, 0.3, -0.06], [0, 0.26, 1.38], 0.06, "#ffffff");   // the long low frame
    rod(k, "tube", [0, 0.3, -0.06], [0, 0.8, -0.24], 0.05, "#ffffff");
    rod(k, "tube", [0, 0.3, -0.06], [0, 0.28, -0.55], 0.04, "#ffffff");
    rod(k, "steerer", [0, 0.3, 0.2], [0, 0.92, 0.26], 0.05, "#ffffff");  // up to the bars
    k.box("bars", [0.5, 0.04, 0.05], [0, 0.9, 0.24], "tyre");
    k.box("saddle", [0.12, 0.05, 0.22], [0, 0.8, -0.26], "tyre");
    k.box("cargo", [0.66, 0.42, 0.8], [0, 0.3, 0.86], "cargo");
    k.box("plank", [0.58, 0.04, 0.72], [0, 0.72, 0.86], "bench", { omit: ["-y"] });
  },
});
