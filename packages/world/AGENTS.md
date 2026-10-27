# Working on @hq/world (for agents)

Read this before adding an object, a room or a world. Each task below takes minutes and ends with a check that proves it.

## Rules

- The package imports nothing from outside itself except `three` (`test/boundary.test.ts`). It knows nothing about
  its host: no lanes, questions or HQ. It speaks lots, rooms, objects, slots, characters, acts and events.
- Code outside the package uses only `@hq/world`, `@hq/world/model` and `@hq/world/packs/starter`. No deep paths.
- Content (objects, finishes, worlds) goes in a pack outside the engine. The starter pack stays small and generic.
- One file per object. A pack's `index.js` and `api.txt` only grow at the end. Ids are per pack (`mypack/desk`).
- Never assign to three.js globals (`ShaderChunk`, `ColorManagement`). Patch a material's `onBeforeCompile`.
- Every file opens with a one-line comment saying what it is for. Original art only.
- Units are metres; one tile is one metre. x runs east, z runs south, y is up.

## Add an object

1. Make `packs/<pack>/<id>.js` (in your own pack; `starter` is the engine's):

   ```js
   // A side table: a square top on four legs.
   import { defineObject } from "@hq/world/model";

   export default defineObject({
     id: "side-table",
     footprint: [1, 1],                 // whole tiles, before turning
     height: 0.5,
     tags: ["surface"],
     build(k) {
       // the object's frame: origin at the footprint's centre on the floor, its front toward +z
       // k.box(part, [w, h, d], [x, y, z], colour): y is the BOTTOM of the part, not its centre
       k.box("top", [0.6, 0.04, 0.6], [0, 0.46, 0], "oak");
       for (const x of [-0.25, 0.25]) for (const z of [-0.25, 0.25]) k.box("leg", [0.04, 0.46, 0.04], [x, 0, z], "oak-dark");
     },
   });
   ```

   Colours are palette tokens (`bun tools/catalog.ts` lists objects; `src/catalog/palette.js` lists tokens) or hex.
   `k.cyl(part, r, h, at, colour, { top, seg })` makes cylinders and cones. `k.glow` makes lit parts (screens,
   shades) and `k.glass` makes panes.
2. Add `import sideTable from "./side-table.js";` at the end of the pack's imports and `sideTable,` at the end of
   `objects`.
3. Something to sit on or use gets a slot:
   `slots: { seat: { at: [0, 0.03], y: 0.38, facing: "s", stand: [[0, 1], [1, 0], [-1, 0]], clip: "sit" } }`.
   `at` is where the user ends up and `y` is the hip rest height above the floor. `facing` is in the object's frame,
   where `"s"` is toward its front. `stand` lists the tiles (offsets from the slot's tile) to walk to first, in order.
4. Check it: `bun tools/check.ts packs/<pack>/index.js`. It names any part past the footprint, any size that looks
   like centimetres, any flat parts lying in one plane (they z-fight), and any file missing from `index.js`.
5. See it: put it in a world and run `bun tools/shot.ts <world> --zoom 2 --out x.jpg`, then look at the image.

Flat things lying on other things (rugs, posters, keyboards) must be boxes at least 1 cm thick that stand on the
surface, or sit 2 mm clear of it. Never make two parts with faces in one plane, facing the same way.

## Add a room

Rooms are found from walls. Do not declare them; enclose them.

```js
walls: [{ path: rect(2, 2, 6, 5), finish: "starter/plaster", outside: "starter/siding" }, { path: [[5, 2], [5, 7]] }],
openings: [{ type: "starter/door", at: [4, 6], side: "s" }, { type: "starter/door", at: [4, 4], side: "e" }],
rooms: [{ at: [3, 3], id: "kitchen", name: "Kitchen" }],
floors: [{ rect: [2, 2, 6, 5], finish: "starter/oak" }],
```

A door or window sits on the wall edge on `side` of tile `at`. A room needs a door to be reachable, and `check.ts`
says which edge to use when it has none. A gap in a wall merges the room with the outdoors.

## Add a world

Copy `examples/tiny-house.world.js`. A world is `defineWorld({ format: 1, id, packs, lot, floors, walls, openings,
rooms, objects, characters, acts })`. Objects take `{ id, type, at: [x, z], facing }`, where `at` is the footprint's
north-west tile after turning and `facing` is where its front points. Then:

```sh
bun packages/world/tools/check.ts my.world.js && bun packages/world/tools/shot.ts my.world.js --advance 6000 --out my.jpg
```

## Add a pack

A folder with `index.js` (`export default definePack({ id, objects: [...], palette: { "mypack/oak": "#..." } })`)
and one file per object. Name it in a world's `packs`. No engine file changes. `check.ts path/to/index.js` checks it.

## Change the engine

Say so up front. Keep the pure half pure: `src/model`, `catalog`, `nav`, `anim`, `camera`, `arch` and `lint` never
import three.js, so `bun test` checks them without a browser. If you change an export, update `api.txt` and
`CHANGELOG.md` in the same commit. Run `bun test` in the package, `tools/proof.ts`, and look at the shots.
