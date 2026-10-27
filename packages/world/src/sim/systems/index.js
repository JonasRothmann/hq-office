// The engine's systems in the order they run each step: start steps, run them, then advance the clips. A host's own
// systems (createSim's `systems` option) run after the step systems and before anim.
import sequence from "./sequence.js";
import stand from "./stand.js";
import walk from "./walk.js";
import turn from "./turn.js";
import enter from "./enter.js";
import loop from "./loop.js";
import anim from "./anim.js";

export const STEP_SYSTEMS = [sequence, stand, walk, turn, enter, loop];
export const LAST_SYSTEMS = [anim];
