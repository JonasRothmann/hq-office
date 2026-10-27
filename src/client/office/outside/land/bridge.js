// A small arched footbridge along z: a timber deck arched between two banks, five posts and six rail pieces a side.
import { defineObject } from "@hq/world/model";

export default defineObject({
  id: "bridge",
  kind: "scenery",
  height: 1.5,
  build(k, p = {}) {
    const L = Math.min(p.length ?? 6, 30), W = p.width ?? 1.7;
    const y0 = p.y0 ?? 0.3, y1 = p.y1 ?? 0.3, rise = p.rise ?? 0.85;
    // the deck's height at z = u: from the -z bank, up to the rise in the middle, down to the +z bank
    const yAt = (u) => {
      const f = Math.min(1, Math.max(0, u / L + 0.5));
      const end = y0 + (y1 - y0) * f;
      return end + (rise - end) * Math.sin(f * Math.PI);
    };
    const slope = (u) => Math.atan2(yAt(u + 0.1) - yAt(u - 0.1), 0.2);
    // planks touch end to end (no overlap), so no two share a face plane
    for (let i = 0; i < 9; i++) {
      const u = -L / 2 + (L * (i + 0.5)) / 9;
      k.box("deck", [W, 0.12, L / 9], [0, yAt(u) - 0.06, u], "bridge-deck", { rot: [-slope(u), 0, 0] });
    }
    for (const side of [-1, 1]) {
      const x = side * (W / 2 - 0.06);
      for (let i = 0; i <= 4; i++) {
        const u = -L / 2 + 0.3 + ((L - 0.6) * i) / 4;
        k.box("post", [0.1, 0.62, 0.1], [x, yAt(u) - 0.05, u], "bridge-post");
      }
      for (let i = 0; i < 6; i++) {
        const u = -L / 2 + 0.3 + ((L - 0.6) * (i + 0.5)) / 6;
        k.box("rail", [0.09, 0.08, (L - 0.6) / 6], [x, yAt(u) + 0.55, u], "bridge-rail", { rot: [-slope(u), 0, 0] });
      }
    }
  },
});
