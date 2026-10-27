// "@hq/world/model": the pure half of the engine (no three.js). Runs in Bun and in the browser: world files, packs,
// validation, rooms, nav, acts, the simulation (an ECS and its systems), the camera rig, architecture as primitives,
// the cutaway rule, the coplanar lint and the scenery (the land round a lot, as data).
export { WALL_H, KERB_H, WALL_T, FLOOR_Y, SIDES, rect, sideEdge, tileKey } from "./grid.js";
export { problem, WorldError, formatProblems } from "./problems.js";
export { defineWorld, toJSON, fromJSON, FORMAT } from "./world.js";
export { diffWorld } from "./diff.js";
export { detectRooms } from "./rooms.js";
export { analyse, validateWorld, buildLot } from "../lot/lot.js";
export { lotMap } from "../lot/map.js";
export { defineObject, definePack, createCatalog, checkPack, buildPrims } from "../catalog/define.js";
export { PALETTES } from "../catalog/palette.js";
export { createNav } from "../nav/nav.js";
export { planAct, ACTS } from "../nav/act.js";
export { createEcs } from "../sim/ecs.js";
export { createSim } from "../sim/index.js";
export { cutaway, hangsOnCut, WALL_MODES } from "../arch/cutaway.js";
export { buildArchitecture, objectPrims, lotPrims } from "../arch/build.js";
export { lintCoplanar, describePair, describePairs } from "../lint/coplanar.js";
export { lintViews } from "../lint/views.js";
export { RIG, CLIPS, samplePose, blendPose } from "../anim/clips.js";
export { PITCH, ZOOMS, createCamera, stepCamera, cameraPose, project, unproject, rotateCamera, zoomCamera, panCamera, fitCamera, focusCamera } from "../camera/rig.js";
export { checkScenery, planScenery, moverPlaces } from "../view/scenery.js";
