# Working on @hq/world (for agents)

Read this before adding an object, a room or a world. Each task below takes minutes and ends with a check that proves it.

`<engine>` below is this package's folder (`packages/world` from the host repo's root). Every other path is relative
to the folder you stand in, and the tools work from any folder. World and pack files are `.js` or `.mjs`.

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

1. Make `<your-pack>/<id>.js`, in your own pack's folder outside the engine (`<engine>/packs/starter` is the
   engine's own):

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

   Colours are palette tokens or hex. A token is the engine's (`src/catalog/palette.js`) or one your pack's
   `palette` names. `check.ts` names an unknown token, or an unknown clip, and the nearest one.
   `bun <engine>/tools/catalog.ts <your-pack>/index.js` lists objects.
   `k.cyl(part, r, h, at, colour, { top, seg })` makes cylinders and cones. `k.glow` makes lit parts (screens,
   shades) and `k.glass` makes panes.
2. Add `import sideTable from "./side-table.js";` at the end of the pack's imports and `sideTable,` at the end of
   `objects`.
3. Something to sit on or use gets a slot:
   `slots: { seat: { at: [0, 0.03], y: 0.38, facing: "s", stand: [[0, 1], [1, 0], [-1, 0]], clip: "sit" } }`.
   `at` is where the user ends up, in metres from the footprint's centre, and it must lie inside the footprint
   (within ±w/2, ±d/2). `y` is the hip rest height above the floor. `facing` is in the object's frame, where `"s"` is
   toward its front. `stand` lists the tiles (offsets from the slot's tile) to walk to first, in order.
4. Check it: `bun <engine>/tools/check.ts <your-pack>/index.js`. It names any part past the footprint, a slot outside
   it, any size that looks like centimetres, any flat parts lying in one plane (they z-fight; parts that share a
   name are told apart as `'shelf' #2`, in build order), and any file missing from `index.js`.
5. See it: put it in a world and run `bun <engine>/tools/shot.ts <your-world>.world.js --zoom 2 --out x.jpg`, then
   look at the image.

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

A wall finish can carry bands under its plaster (skirting, battens, a rail), listed from the floor up:
`defineObject({ id: "panelled", kind: "wall", color: "plaster", bands: [{ to: 0.1, color: "oak-dark" }, { to: 0.8,
color: "oak", pattern: "battens" }] })`. `to` is metres above the floor, each higher than the last. The engine cuts
the walls and posts at those heights, so no band lies on the wall as a second face.

## Add a world

Copy `examples/tiny-house.world.js` (examples are for people; the tests use their own copy in `test/fixtures/`, so
an example can change freely). A world is `defineWorld({ format: 1, id, packs, lot, floors, walls, openings,
rooms, objects, characters, acts })`. Objects take `{ id, type, at: [x, z], facing }`, where `at` is the footprint's
north-west tile after turning and `facing` is where its front points. Then:

```sh
bun <engine>/tools/check.ts my.world.js --map && bun <engine>/tools/shot.ts my.world.js --advance 6000 --out my.jpg
```

`--map` prints the lot as text: `,` ground, `.` floor, a letter per object, a digit per character, `|` and `-`
walls, `D` doors, `W` windows. Read it before you take a shot. Acts in a world file are `sit`, `use`, `walk` and
`visit` (`{ who, do: "visit", target, wait, then: { do: "sit", ... } }`).

## Worked example: a sofa in your own pack, two in a world

Your files live outside the engine. Here they sit in `den/`:

```
den/cozy/sofa.js      the object
den/cozy/index.js     the pack
den/den.world.js      the world
```

`den/cozy/sofa.js`, a two-seat sofa on a 2×1 footprint, one slot per seat:

```js
// A two-seat sofa: a base on short feet, two seat cushions, a back and two arms. Its front (+z) is where you sit.
import { defineObject } from "@hq/world/model";

export default defineObject({
  id: "sofa",
  footprint: [2, 1],
  height: 0.85,
  tags: ["seat"],
  slots: {
    left: { at: [-0.45, 0.1], y: 0.48, facing: "s", stand: [[0, 1]], clip: "sit" },
    right: { at: [0.45, 0.1], y: 0.48, facing: "s", stand: [[0, 1]], clip: "sit" },
  },
  build(k) {
    for (const x of [-0.85, 0.85]) for (const z of [-0.3, 0.38]) k.box("foot", [0.06, 0.1, 0.06], [x, 0, z], "wood-dark");
    k.box("base", [1.8, 0.3, 0.8], [0, 0.1, 0.05], "sofa", { omit: ["-y"] });
    for (const x of [-0.45, 0.45]) k.box("cushion", [0.86, 0.08, 0.58], [x, 0.4, 0.14], "cushion", { omit: ["-y"] });
    k.box("back", [1.8, 0.45, 0.2], [0, 0.4, -0.25], "sofa", { omit: ["-y"] });
    for (const x of [-0.95, 0.95]) k.box("arm", [0.1, 0.55, 0.8], [x, 0.1, 0.05], "sofa-dark");
  },
});
```

The cushions and the back stand on the base, so their bottoms would lie in the base's top plane. `omit: ["-y"]`
leaves those faces out, and the cushions sit forward of the back so their tops never meet it. `check.ts` names
both clashes if you leave them in.

`den/cozy/index.js`, the pack and its own colours, one map per theme with the same tokens in each:

```js
// The cozy pack: a sofa, and the colours it names, for day and night.
import { definePack } from "@hq/world/model";
import sofa from "./sofa.js";

export default definePack({
  id: "cozy",
  palette: {
    light: { sofa: "#7d9a8c", "sofa-dark": "#5f7c6f" },
    dark: { sofa: "#6f8a7e", "sofa-dark": "#536d62" },
  },
  objects: [
    sofa,
  ],
});
```

A pack's tokens belong to it: `sofa` here is `cozy/sofa` inside the engine, so another pack's `sofa` never clashes.

`den/den.world.js`, one room, two sofas facing each other, two people who sit down:

```js
// The den: one room with a door, two sofas facing each other, and two people who sit down on them.
import { defineWorld, rect } from "@hq/world/model";
import starter from "@hq/world/packs/starter";
import cozy from "./cozy/index.js";

export default defineWorld({
  format: 1,
  id: "den",
  packs: [starter, cozy],
  lot: { w: 10, d: 8 },
  floors: [{ rect: [1, 1, 8, 6], finish: "starter/oak" }],
  walls: [{ path: rect(1, 1, 8, 6), finish: "starter/plaster", outside: "starter/siding" }],
  openings: [{ type: "starter/door", at: [6, 6], side: "s" }],
  objects: [
    { id: "sofa-1", type: "cozy/sofa", at: [2, 2], facing: "s" },
    { id: "sofa-2", type: "cozy/sofa", at: [2, 5], facing: "n" },
    { id: "plant-1", type: "starter/plant", at: [7, 2], facing: "s" },
  ],
  characters: [{ id: "ada", at: [6, 5], facing: "n" }, { id: "bo", at: [7, 5], facing: "n" }],
  acts: [{ who: "ada", do: "sit", target: "sofa-1", slot: "left" }, { who: "bo", do: "sit", target: "sofa-2", slot: "right" }],
});
```

Check and look, from any folder (here, the one that holds `den/`; paths are relative to where you stand):

```sh
bun <engine>/tools/check.ts den/cozy/index.js den/den.world.js --map
bun <engine>/tools/shot.ts den/den.world.js --zoom 2 --advance 8000 --out den.jpg
```

`check.ts` prints `pack cozy (...): ok`, `world den (...): ok`, then the map:

```
  2   ,|. a a . . . c .|,
  ...
  5   ,|. b b . . 1 2 .|,
       +-+-+-+-+-+D+-+-+
```

Open `den.jpg`: Ada sits on `sofa-1`'s left seat and Bo on `sofa-2`'s right seat. If
`check.ts` fails, its message says what to change: a tile that is free for the whole footprint, the nearest colour
token, or which faces lie in one plane. `test/tools.test.ts` runs this from three folders.

## Add a behaviour

What moves lives in an ECS (`src/sim/`). Entities are ids; components are plain JSON; systems run in a fixed order.
An act becomes a `queue` of steps, and each step kind is a component that one system runs and removes when done.
A held seat is the character's `holding` component (`{ object, slot }`), so `sim.ecs.toJSON()` carries it and
nothing else keeps a copy. Nav plans paths only; `planAct(lot, nav, who, act, { holder })` asks the sim who holds a
slot.

- **A new act made of existing steps** (walk, turn, enter, wait, then, loop): plan it in `src/nav/act.js`, the way
  `visit` is planned, and add its name to `ACTS`. Do not add a system.
- **A new step kind in the engine**: add `src/sim/systems/<kind>.js`
  (`export default { name, step: "<kind>", run(ecs, dt, { lot, nav, emit }) { ... } }`). In `run`, query
  `ecs.query("<kind>", "body", "anim")`, return true while it is still moving, and `ecs.remove(id, "<kind>")` when
  it is done. Add it to the end of `STEP_SYSTEMS` in `src/sim/systems/index.js`. `wait.js` is the smallest example.
  A system that throws is switched off and logged once with its name, so a broken one shows up as a stopped behaviour.
- **A behaviour that belongs to the host** (anything about its own domain): do not edit the package. Pass
  `createWorld(canvas, world, { systems: [mySystem] })` and put your data in your own components
  (`world.sim.ecs.add(id, "myThing", {...})`).
- Test it headless: `createSim(lot, nav)` from `@hq/world/model`, then `sim.act(...)` and `sim.step(1 / 60)` in a loop
  (see `test/sim.test.ts`). `sim.ecs.toJSON()` is the whole state.

## Add a pack

A folder with `index.js` (`export default definePack({ id, objects: [...], palette: { light: { oak: "#..." },
dark: { oak: "#..." } } })`) and one file per object. Both palette maps name the same tokens. Name the pack in a
world's `packs`. No engine file changes. `check.ts path/to/index.js` checks it. The worked example above is a whole
pack.

## Change a world while it runs

`world.apply(nextDoc)` validates the whole doc, diffs it and rebuilds only what changed (an object whose height
moved with the floor under it counts as changed). Characters keep walking; one whose seat or target went away plans
again or gets a `cancel` event, and one left inside an object walks off it. A character that already exists is not
checked against its doc `at` (a spawn tile only), and its acts are checked without a position: an act the sim
cannot start is a `cancel` event with `refused: true` and the reason, not a refused edit. The same doc twice is a
no-op. Tests of an edit run headless: `test/view.test.ts` and `test/edits.test.ts` drive the same code with no
browser.

## Change the engine

Say so up front. Keep the pure half pure: `src/model`, `lot`, `catalog`, `nav`, `anim`, `camera`, `arch`, `lint`,
`sim` and `view` never import three.js, so `bun test` checks them without a browser. `src/world/create.js` only does
what the view driver (`src/view/driver.js`) tells it: what to draw, when, and whether the shadow map is stale. If you change an export, update `api.txt` and
`CHANGELOG.md` in the same commit. Run `bun test` in the package, `tools/proof.ts`, and look at the shots.
