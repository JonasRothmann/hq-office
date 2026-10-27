// A street bench, 1.3 m long and facing +z: a timber seat and back on two iron frames, 0.84 m high.
import { defineObject } from "@hq/world/model";

export default defineObject({
  id: "bench",
  kind: "scenery",
  height: 0.84,
  build(k) {
    for (const x of [-0.6, 0.6]) k.box("leg", [0.06, 0.4, 0.36], [x, 0, 0], "iron");
    k.box("seat", [1.3, 0.06, 0.42], [0, 0.4, 0], "bench", { omit: ["-y"] });
    k.box("back", [1.3, 0.38, 0.06], [0, 0.46, -0.19], "bench", { omit: ["-y"] });
  },
});
