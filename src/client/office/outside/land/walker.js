// A walking person's body, no legs or head: dark hips, a white torso and arms, a skin-coloured neck. 1.28 m high.
import { defineObject } from "@hq/world/model";

export default defineObject({
  id: "walker",
  kind: "scenery",
  height: 1.28,
  build(k) {
    k.box("hips", [0.36, 0.14, 0.2], [0, 0.6, 0], "iron");
    k.box("torso", [0.38, 0.5, 0.22], [0, 0.7, 0], "#ffffff");
    for (const x of [0.235, -0.235]) k.box("arm", [0.09, 0.46, 0.12], [x, 0.7, 0], "#ffffff");
    k.box("neck", [0.1, 0.1, 0.1], [0, 1.18, 0], "skin-1");
  },
});
