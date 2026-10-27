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
world.on("pick", (hit) => console.log(hit));   // { kind: "object" | "character" | "tile", id, tile }
```

## Entries

| Entry | What | Runs in |
| --- | --- | --- |
| `@hq/world` | everything below, plus `createWorld` (three.js) | browser |
| `@hq/world/model` | world files, packs, validation, rooms, nav, acts, camera rig, cutaway, architecture as primitives, coplanar lint, rig and clips | Bun and browser (no three.js) |
| `@hq/world/packs/starter` | the starter pack: oak floor, plaster, siding, door, window, desk, chair, plant, lamp | Bun and browser |

The full list of exported names is `api.txt`. The design and its reasons are in the host repo's
`docs/engine/rfc.md`.

## Tools

Run them from the folder that holds your world files (or pass `--root`).

```sh
bun packages/world/tools/check.ts path/to/x.world.js        # validate, check packs, lint for z-fighting; exit 1 on errors
bun packages/world/tools/check.ts path/to/pack/index.js     # check a pack's objects and that index.js lists every file
bun packages/world/tools/catalog.ts [path/to/pack/index.js]  # list objects: footprint, slots, anchors, tags
bun packages/world/tools/shot.ts path/to/x.world.js --rot 1 --zoom 2 --theme dark --time 21:00 --walls cutaway --advance 6000 --out x.jpg
bun packages/world/tools/serve.ts                            # the lab: http://127.0.0.1:4791/?world=/path/x.world.js
bun packages/world/tools/proof.ts --out shots                # the turn, pan, wall-mode, walk and night proofs
cd packages/world && bun test                                # the package's tests (no browser, no three.js)
```

`shot.ts` and `proof.ts` need Chrome (`CHROME_BIN` if it is not in the usual place); WebGL runs on SwiftShader, so no
GPU is needed. The tools find three.js through `--three`, `HQ_WORLD_THREE`, a `node_modules/three`, or a host's
`src/client/vendor/three/three.module.min.js`.

## Promises

- The camera's height is constant during a turn, and the focus stays on the same screen point; turns never refit or zoom.
- At rest, the picture sits on whole device pixels, so panning moves it by whole pixels and nothing shimmers.
- Shadow filtering is fixed to the world, never to the screen.
- No two same-facing faces overlap in a plane, in any rotation, wall mode or turn; `check.ts` fails if a pack adds one.
- Frames are drawn at display rate while anything moves and not at all while the view is still.

## Versioning

`0.x`: a minor version may break the API, a patch never does. The API is the names in `api.txt` plus the world
format (`format: 1`). `test/api.test.ts` fails when they change, until `api.txt` and `CHANGELOG.md` change too.

Licence: MIT, like the host repo. All models are original, built from boxes and cylinders in code.
