// A gable roof's two end walls, one unit long (x) and wide (z) at their foot and √3/2 tall: a triangle at each end of
// the ridge, white for the wall's colour. The land scales its height by the roof's over GABLE_H.
import { defineObject } from "@hq/world/model";

export const GABLE_H = Math.sqrt(3) / 2;
const R = 1 / Math.sqrt(3); // a three-sided cylinder of this radius is a triangle one unit wide at its foot

export default defineObject({
  id: "gable-end",
  kind: "scenery",
  height: GABLE_H,
  build(k) {
    // turned so the axis runs to -x and a corner points up; each end is 4 cm thick, inside the unit
    for (const x of [-0.46, 0.5]) k.cyl("end", R, 0.04, [x, R / 2, 0], "#ffffff", { seg: 3, rot: [0, 0, Math.PI / 2] });
  },
});
