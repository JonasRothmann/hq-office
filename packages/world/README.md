# @hq/world

An engine for Sims-like 3D lots in the browser. You describe a lot as data: tiles, floors, walls on tile edges, doors and
windows, objects from a catalog, characters, and what they do. The engine checks it, finds the rooms, plans walks
through doors, and draws it with three.js in the Sims 1 view: orthographic, 30° down, four 90° turns, three zooms, and
walls up, cut away or down.

There is no build step. The modules are plain ES modules. three.js is a peer: the host's import map maps `three` to
its one copy.

```js
import { createWorld } from "@hq/world";
import house from "./tiny-house.world.js";

const world = createWorld(canvas, house, { theme: "light", time: "14:00", walls: "cutaway" });
world.bindInput(canvas);                       // drag to pan, wheel to zoom, click to pick
world.camera.rotate(1);                        // a quarter turn; the camera's height and focus never move
await world.act("ada", { do: "sit", target: "chair-1", clip: "type" });
world.act("ada", { do: "visit", target: "chair-3", wait: 4, then: { do: "sit", target: "chair-1", clip: "type" } });
world.on("pick", (hit) => console.log(hit));   // { kind: "object" | "character" | "tile", id, tile }
world.camera.fitBox(world.roomBox("kitchen")); // eased; camera.focusOn(x, z) centres on a point
world.apply(nextDoc);                          // an edited doc: only what changed is rebuilt, the sim keeps running
```

## Edits at run time

`world.apply(next)` takes a World or a plain doc. It validates the whole doc first; a `WorldError` changes nothing.
Then it diffs the doc against the current one (`diffWorld`) and rebuilds only the objects, characters or
architecture that changed, plus any object whose height moved with the floor under it. The sim keeps running:
characters keep their place and their act. A character whose target or held seat is gone, or whose route is now
shut, plans the act again, and drops it (a `cancel` event) when it cannot. A character on a tile that an object now
covers walks off it, and so does one whose act was dropped while it sat in an object that changed. A character
outside a lot that shrank is the one case that moves at once. Applying the same doc twice does nothing and returns
`null`.

A doc's `characters[].at` is the spawn tile only. Once a character exists, the edit does not check that tile, and
it checks the character's acts without a position: the act must name a known act, clip, object and slot. An act
starts when the next doc adds it. If the sim cannot start it (a held seat, no way there), the edit still applies
and the host gets `cancel` with `{ who, problem, act, refused: true }`. A save loaded with `sim.ecs.load` is checked
against the lot the same way: a seat whose object is gone is let go, and its holder stands up and steps clear.

## Scenery

The land round a lot (a garden, a valley, a town) is scenery: data drawn round the lot, never walked, picked or
linted with it. Pass it as `createWorld(canvas, world, { scenery })`, give the world a `scenery` field, or call
`world.setScenery(s)` when the land changes. Its pieces are objects of kind `"scenery"` (no footprint), placed freely:

```js
world.setScenery({
  pieces: [{ type: "land/birch", at: [-3, 0, 4], ry: 0.6, s: 1.1, tint: "#e6e6e6", shadow: true }],
  fields: [{ xs, zs, h, color, hole: { minX: 0, minZ: 0, maxX: lot.w, maxZ: lot.d } }],   // a height field
  strips: [{ points: [[x, y, z, halfWidth], ...], color: "land/water", finish: "glass" }],  // a river, a path
  movers: [{ type: "land/car", route: [[x, y, z], ...], speed: 4, at: [0, 30], tint: ["land/car-1", "land/car-4"] }],
  fade: { box: { minX: -8, minZ: -8, maxX: 40, maxZ: 30 }, from: 34, to: 60 },
  shade: { minX: -8, minZ: -8, maxX: 40, maxZ: 30 }, ground: true,
});
```

Pieces of one type and params are one instanced mesh per material; a `tint` multiplies a copy's colours, so a piece
is white where its tint should show. Movers go round their closed loop at their speed and cast no shadows. They are
ambient motion: they draw at `idleFps`, and at `idleFps` 0 they stand still. Everything outdoors, the lot's own ground
too, takes no light from lamps (they are indoors, and shine through walls) and fades into the background past `fade`.
`checkScenery(scenery, catalog)` names each mistake and its fix.

## Finishes

A floor or wall finish is `defineObject({ id, kind: "floor" | "wall", color, pattern })`. Patterns are `plain`,
`planks`, `tiles`, `boards` and `battens`. A wall finish may add `bands` from the floor up, such as a skirting, a
slatted dado and a rail: `bands: [{ to: 0.1, color: "oak-dark" }, { to: 0.76, color: "oak", pattern: "battens" },
{ to: 0.8, color: "oak-dark" }]`. Each band shows up to `to` metres above the floor, and the finish shows above the
last one. A cut wall shows the bands under its kerb.

The engine draws the wall caps, the ground and the background in its own tokens (`cap`, `ground`, `ground-dark`,
`foundation`, `bg`). A pack recolours them for every world that uses it with `definePack({ overrides: { light: { cap:
"#4a3a2e" }, dark: { cap: "#3a2e25" } } })`, and a world doc's own `palette: { light, dark }` recolours any token over
that.

An object tagged `wall` (a clock, a print) hangs on the wall behind it, on the side opposite its facing. The view
hides it while that wall is cut (`hangsOnCut`). An object with a `light` anchor lights the room by night as a warm
downlight in the `lamp` colour.

## Entries

| Entry | What | Runs in |
| --- | --- | --- |
| `@hq/world` | everything below, plus `createWorld` (three.js) | browser |
| `@hq/world/model` | world files, packs, validation, rooms, nav, acts, the sim (an ECS of objects and characters), camera rig, cutaway, architecture as primitives, coplanar lint, rig and clips | Bun and browser (no three.js) |
| `@hq/world/packs/starter` | the starter pack: oak floor, plaster, siding, door, window, desk, chair, plant, lamp | Bun and browser |

The full list of exported names is `api.txt`. The design and its reasons are in the host repo's
`docs/engine/rfc.md`.

## Tools

Paths are relative to the current directory, and the tools work from any folder. World and pack files are `.js` or
`.mjs`; the tools refuse any other file and say so. The lab and `shot.ts` serve the
folder that holds the world and every file it imports (or `--root`).

```sh
bun packages/world/tools/check.ts path/to/x.world.js --map  # validate, check packs, lint for z-fighting, draw the lot; exit 1 on errors
bun packages/world/tools/check.ts path/to/pack/index.js     # check a pack's objects and that index.js lists every file
bun packages/world/tools/catalog.ts [path/to/pack/index.js]  # list objects: footprint, slots, anchors, tags
bun packages/world/tools/shot.ts path/to/x.world.js --rot 1 --zoom 2 --theme dark --time 21:00 --walls cutaway --advance 6000 --out x.jpg
bun packages/world/tools/serve.ts                            # the lab: http://127.0.0.1:4791/?world=/path/x.world.js
bun packages/world/tools/proof.ts --out shots                # the turn, pan, wall-mode, walk, night, sizing and idle proofs
cd packages/world && bun test                                # the package's tests (no browser, no three.js)
```

`shot.ts` and `proof.ts` need Chrome (`CHROME_BIN` if it is not in the usual place); WebGL runs on SwiftShader, so no
GPU is needed. The tools find three.js through `--three`, `HQ_WORLD_THREE`, a `node_modules/three`, or a host's
`src/client/vendor/three/three.module.min.js`.

## Promises

- The camera's height is constant during a turn, and the focus stays on the same screen point; turns never refit or zoom.
- The canvas's backing store is exactly its device-pixel box (ResizeObserver's `devicePixelContentBoxSize`, or a
  size rounded to device pixels where the browser has none), at DPR 1, 1.5 and 2 and at fractional sizes.
  Where the browser has no device-pixel box (Safari), only the size is rounded, not the canvas's place on the page.
  A canvas whose left or top edge falls between device pixels is then resampled by the browser. There, put the
  canvas on whole device pixels: full size, or at a whole-pixel offset inside its parent.
- At rest, the picture sits on whole device pixels, so panning moves it by whole pixels and nothing shimmers.
- Shadow filtering is fixed to the world, never to the screen.
- No two same-facing faces overlap in a plane, in any rotation, wall mode or turn; `check.ts` fails if a pack adds one.
- Frames are drawn at display rate while the camera or a character moves, and not at all while the view is still.
  Moving scenery draws at `idleFps` too, and holds still at 0.
  A clip looping in place (typing, breathing) is not motion: it draws at `idleFps` (default 0, never). The shadow
  map is redrawn only when a character moved, the cut walls changed, or an edit, theme or time change asked.
- A system that throws is logged once with its name and switched off; the loop and the other systems keep running.

## Versioning

`0.x`: a minor version may break the API, a patch never does. The API is the names in `api.txt` plus the world
format (`format: 1`). `test/api.test.ts` fails when they change, until `api.txt` and `CHANGELOG.md` change too.

Licence: MIT, like the host repo. All models are original, built from boxes and cylinders in code.
