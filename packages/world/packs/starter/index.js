// The starter pack: the engine's own objects for its examples, lab and tests. Kept small and generic; real worlds
// bring their own packs. Append new objects at the end of both lists, one import per line.
import { definePack } from "@hq/world/model";
import oak from "./oak.js";
import plaster from "./plaster.js";
import siding from "./siding.js";
import door from "./door.js";
import window from "./window.js";
import desk from "./desk.js";
import chair from "./chair.js";
import plant from "./plant.js";
import lamp from "./lamp.js";

export default definePack({
  id: "starter",
  objects: [
    oak,
    plaster,
    siding,
    door,
    window,
    desk,
    chair,
    plant,
    lamp,
  ],
});
