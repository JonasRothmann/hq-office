// A timber deck, 2.4 m by 3.6 m by default: boards 14 cm wide along z, 6 cm tall, every 16 cm across x, two oaks alternating.
import { defineObject } from "@hq/world/model";

export default defineObject({
  id: "deck",
  kind: "scenery",
  height: 0.06,
  build(k, p = {}) {
    const w = p.w ?? 2.4, d = p.d ?? 3.6;
    for (let n = 0; n * 0.16 + 0.14 <= w + 1e-9; n++) {
      k.box("board", [0.14, 0.06, d], [-w / 2 + 0.07 + n * 0.16, 0, 0], n % 2 ? "garden-deck-2" : "garden-deck");
    }
  },
});
