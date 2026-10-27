// The test house, a fixture: tests pin its paths, chairs and rooms, so change it only with them. Agents build in
// examples/ or their own folders, never here. Two rooms joined by a door, a desk, three chairs, plants, lamps and Ada.
import { defineWorld, rect } from "@hq/world/model";
import starter from "@hq/world/packs/starter";

export default defineWorld({
  format: 1,
  id: "test-house",
  packs: [starter],
  lot: { w: 14, d: 11 },
  floors: [{ rect: [2, 2, 10, 7], finish: "starter/oak" }],
  walls: [
    { path: rect(2, 2, 10, 7), finish: "starter/plaster", outside: "starter/siding" },
    { path: [[7, 2], [7, 9]], finish: "starter/plaster" },
  ],
  openings: [
    { type: "starter/door", at: [4, 8], side: "s" },
    { type: "starter/door", at: [6, 5], side: "e" },
    { type: "starter/window", at: [4, 2], side: "n" },
    { type: "starter/window", at: [9, 2], side: "n" },
    { type: "starter/window", at: [2, 6], side: "w" },
    { type: "starter/window", at: [11, 6], side: "e" },
  ],
  rooms: [
    { at: [3, 6], id: "study", name: "Study" },
    { at: [9, 6], id: "lounge", name: "Lounge" },
  ],
  objects: [
    { id: "desk-1", type: "starter/desk", at: [3, 3], facing: "s" },
    { id: "chair-1", type: "starter/chair", at: [3, 4], facing: "n" },
    { id: "lamp-1", type: "starter/lamp", at: [5, 3], facing: "s" },
    { id: "plant-1", type: "starter/plant", at: [2, 2], facing: "s" },
    { id: "plant-2", type: "starter/plant", at: [6, 8], facing: "s" },
    { id: "chair-2", type: "starter/chair", at: [10, 4], facing: "w" },
    { id: "chair-3", type: "starter/chair", at: [8, 4], facing: "e" },
    { id: "lamp-2", type: "starter/lamp", at: [11, 2], facing: "s" },
    { id: "plant-3", type: "starter/plant", at: [11, 8], facing: "s" },
  ],
  characters: [{ id: "ada", at: [9, 7], facing: "n", look: { shirt: "#c0714f", hair: "#2b1d16" } }],
  acts: [{ who: "ada", do: "sit", target: "chair-1", clip: "type" }],
});
