// A two-tile kitchen run against the back wall: oak doors on a plinth, a worktop with a sink and tap, a steel kettle,
// a coffee machine, a fruit bowl, a tile splashback and an open oak shelf of ceramics.
import { defineObject } from "@hq/world/model";
import { ball } from "./look/shapes.js";

const PLINTH_TOP = 0.08;     // the cabinet stands on a recessed plinth
const COUNTER = 0.69;        // the worktop's top
const WORK_Z = -0.11;        // the worktop's centre, back at the wall
const FRONT = 0.16;          // the cabinet front
const DOOR_Z = FRONT + 0.0075; // door fronts stand 1.5 cm proud of the carcass
const SHELF_Y = 1.35;

export default defineObject({
  id: "kitchenette",
  footprint: [2, 1],
  height: 1.52,
  tags: ["surface"],
  build(k) {
    k.box("plinth", [1.78, PLINTH_TOP, 0.5], [0, 0, -0.16], "smoked-dark");
    k.box("carcass", [1.82, 0.57, 0.58], [0, PLINTH_TOP, -0.13], "oak");
    k.box("counter", [1.84, 0.04, 0.62], [0, COUNTER - 0.04, WORK_Z], "counter");

    const doors = [-0.683, -0.228, 0.228, 0.683];
    for (const x of doors) k.box("door", [0.444, 0.5, 0.015], [x, 0.12, DOOR_Z], "oak-light");
    for (const x of [-0.455, 0, 0.455]) k.box("groove", [0.006, 0.49, 0.02], [x, 0.125, FRONT + 0.01], "smoked-light");
    for (const x of [-0.505, -0.05, 0.05, 0.505]) k.box("pull", [0.014, 0.12, 0.02], [x, 0.38, DOOR_Z + 0.01], "smoked");

    k.box("basin", [0.4, 0.04, 0.3], [0.5, COUNTER - 0.038, WORK_Z], "brushed");
    k.cyl("tap", 0.015, 0.168, [0.5, COUNTER + 0.002, -0.36], "brushed", { seg: 6 });
    k.box("tap-spout", [0.02, 0.02, 0.12], [0.5, 0.86, -0.3], "brushed");

    k.cyl("kettle-base", 0.08, 0.02, [-0.25, COUNTER, -0.16], "steel", { seg: 10 });
    k.cyl("kettle", 0.07, 0.17, [-0.25, COUNTER + 0.02, -0.16], "steel", { top: 0.05, seg: 10 });
    k.box("kettle-handle", [0.025, 0.12, 0.05], [-0.175, COUNTER + 0.1, -0.16], "steel");

    k.box("coffee", [0.32, 0.3, 0.3], [-0.65, COUNTER, -0.2], "steel");
    k.box("coffee-cap", [0.26, 0.02, 0.26], [-0.65, COUNTER + 0.3, -0.2], "brushed");
    k.box("coffee-panel", [0.2, 0.1, 0.01], [-0.65, COUNTER + 0.14, -0.045], "brushed");
    k.box("coffee-tray", [0.24, 0.02, 0.12], [-0.65, COUNTER, 0.02], "brushed");

    k.cyl("fruit-bowl", 0.13, 0.05, [0.12, COUNTER, -0.2], "ceramic", { top: 0.15, seg: 12 });
    for (const [dx, dz, color] of [[-0.05, 0.02, "rust"], [0.05, 0.02, "ochre"], [0, -0.07, "leaf"]]) {
      ball(k, "fruit", 0.04, [0.12 + dx, COUNTER + 0.04, -0.2 + dz], color, { seg: 10 });
    }

    k.box("splashback", [1.82, SHELF_Y - COUNTER, 0.012], [0, COUNTER, -0.41], "ceramic");

    k.box("shelf", [1.8, 0.03, 0.22], [0, SHELF_Y, -0.31], "oak");
    const top = SHELF_Y + 0.03;
    k.cyl("vase", 0.04, 0.14, [-0.6, top, -0.32], "ceramic", { top: 0.03, seg: 10 });
    k.cyl("jar", 0.05, 0.1, [-0.3, top, -0.33], "clay", { seg: 10 });
    k.cyl("bowl", 0.07, 0.05, [0.1, top, -0.3], "charcoal", { top: 0.09, seg: 12 });
    k.cyl("cup", 0.03, 0.06, [0.45, top, -0.34], "ceramic", { seg: 8 });
  },
});
