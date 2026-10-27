// "@hq/world/model": the pure half of the engine (no three.js). Runs in Bun and in the browser: world files, packs,
// validation, rooms, nav, acts, the camera rig, architecture as primitives, the cutaway rule and the coplanar lint.
export { WALL_H, KERB_H, WALL_T, FLOOR_Y, SIDES, rect, sideEdge, tileKey } from "./grid.js";
export { problem, WorldError, formatProblems } from "./problems.js";
export { defineWorld, toJSON, fromJSON, FORMAT } from "./world.js";
export { detectRooms } from "./rooms.js";
export { analyse, validateWorld, buildLot } from "./lot.js";
export { defineObject, definePack, createCatalog, checkPack, buildPrims } from "../catalog/define.js";
export { PALETTES } from "../catalog/palette.js";
export { createNav } from "../nav/nav.js";
export { planAct } from "../nav/act.js";
export { cutaway, WALL_MODES } from "../arch/cutaway.js";
export { buildArchitecture, objectPrims, lotPrims } from "../arch/build.js";
export { lintCoplanar, describePair } from "../lint/coplanar.js";
export { RIG, CLIPS, samplePose, blendPose } from "../anim/clips.js";
export { PITCH, ZOOMS, createCamera, stepCamera, cameraPose, project, unproject, rotateCamera, zoomCamera, panCamera, fitCamera } from "../camera/rig.js";
