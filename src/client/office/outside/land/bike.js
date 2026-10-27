// A bicycle pointing along +z, 1.56 m wheel to wheel: white frame tubes, dark tyres, bars and saddle.
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
  id: "bike",
  kind: "scenery",
  height: 0.95,
  build(k) {
    for (const z of [-0.5, 0.5]) k.cyl("wheel", 0.28, 0.05, [0.025, 0.28, z], "tyre", { seg: 6, rot: [0, 0, Math.PI / 2] });
    rod(k, "tube", [0, 0.74, -0.16], [0, 0.76, 0.4], 0.05, "#ffffff");   // top tube
    // the tubes lie in one plane, so the down and seat tubes sit 1.2 cm either side of it (no shared faces)
    rod(k, "tube", [0.012, 0.74, 0.4], [0.012, 0.3, -0.04], 0.05, "#ffffff");    // down tube
    rod(k, "tube", [-0.012, 0.3, -0.04], [-0.012, 0.8, -0.2], 0.05, "#ffffff");  // seat tube
    rod(k, "tube", [0, 0.3, -0.04], [0, 0.28, -0.5], 0.04, "#ffffff");   // chain stay
    rod(k, "tube", [0, 0.74, -0.16], [0, 0.28, -0.5], 0.035, "#ffffff"); // seat stay
    rod(k, "fork", [0, 0.92, 0.42], [0, 0.28, 0.5], 0.04, "#ffffff");
    k.box("bars", [0.5, 0.04, 0.05], [0, 0.9, 0.4], "tyre");
    k.box("saddle", [0.12, 0.05, 0.22], [0, 0.8, -0.22], "tyre");
  },
});
