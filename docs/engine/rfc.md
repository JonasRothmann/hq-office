# RFC: `@hq/world`, an engine for Sims-like 3D worlds

Status: phase 1.5 (design, a thin proof, and the fixes from its review). Date: 2026-10-27.
Proof: `packages/world/`. Shots: `docs/engine/shots/`.

The 3D office grew lane by lane in `src/client/world/`. Layout, props, people, cutaway and rendering are tangled,
placement is hard-coded per room kind, and two defects the owner reported (the turn bobs, the view flickers) come from
that tangle. This RFC proposes a small engine for building lots the way a Sims-like game does, as an isolated package
the app uses through one public entry. The HQ office becomes the first world built on it.

Contents: 1 Goals. 2 The package boundary (decision D16). 3 Layers. 4 Public API. 5 World files. 6 The two defects.
7 Rendering quality and cost. 8 Agent DX. 9 Alternatives. 10 Migration. 11 Phase 1 proof. 12 Migration order.

## 1. Goals and non-goals

Goals:

- Lots on a 1 m tile grid: floors per tile, walls on tile edges, doors and windows as wall openings, rooms found from
  the walls, objects placed by catalog id, tile and facing, and characters that walk, sit and use things.
- The Sims 1 view (`docs/research/sims1-look.md`): orthographic, 30° pitch (2:1 tile diamonds), yaw 45° + n·90°,
  three zooms (22.6, 45.3, 90.5 px/m), walls 2.95 m with a 0.35 m kerb when cut, walls up / cutaway / down.
- A picture that holds still: no shimmer when panning, no bob when turning, no z-fighting, no frame cap judder.
- Agents can build worlds and objects in minutes, check them without a browser, and see them headlessly.

Non-goals: a general game engine, physics, terrain, multiple storeys (the model leaves room for a `level` field),
networking, a scripting VM, an editor UI, skinned meshes, loading third-party model files. Lanes, asks, HQ and the
bus are app concepts and never appear in the package.

## 2. The package boundary (D16)

The owner asked for the 3D world to be its own isolated package that the app uses. "Isolated" means, at minimum:

1. Its own folder with its own `package.json` (name, `exports`, three.js as a peer and nothing else), README, AGENTS
   guide, tests, lab and shot CLI.
2. It imports nothing from the app. A package test fails if any package file imports a path outside the package, or
   a bare name other than `three` (plus `node:`/`bun:` builtins in tools and tests).
3. The app reaches it only through the public entries named in `exports`. An app test fails on any deep import.
4. No build step. The browser resolves it through the import map, and three.js stays one shared copy.
5. It knows nothing about lanes, asks, the bus or HQ. It speaks lots, rooms, objects, slots, characters, actions and
   events.

### 2.1 Draft: three package shapes

**A. One package, engine and content.** `packages/world/` holds the engine, the Japandi catalog, the office layout
generator and the outside generator.

**B. An engine package; HQ content stays in the app.** `packages/world/` is generic. The Japandi catalog, the office
layout from the lane tree and the outside generator stay in the app under `src/client/world/`, written against the
public API.

**C. An engine package plus content-pack packages.** `packages/world/` is generic; `packages/world-japandi/` and
`packages/world-outside/` are packages of their own that register catalog entries and generators.

### 2.2 Critique of the draft

- A puts the office's look inside the engine. Every new chair is an engine change, a content lane edits the engine's
  folder, and "the package knows nothing about HQ" is false the day the office generator moves in. Rejected.
- C is the cleanest on paper. In practice each pack needs a `package.json`, an import-map line in
  `public/index.html` (a shared file), a route, a boundary test and an exports test. A lane that wants one new rug
  touches four shared places. With one consumer, that ceremony buys nothing yet.
- B is right for now, but as drafted it has gaps a sceptical reviewer would find:
  1. *Where do objects register?* A global registry makes import order matter and lets two packs claim `desk` without
     anyone noticing until the wrong desk renders.
  2. *Can the package's shot CLI and lab see app content?* If not, agents building the office cannot use the tools
     the package ships.
  3. *What stops an app pack from reaching into `render/materials.js` when it wants a helper?* Agents take the
     shortest path; a deep import will appear the first week.
  4. *The engine needs some objects for its own tests, lab and examples.* Where do they live without turning the
     engine into A?
  5. *Two copies of three.js* (one via the import map, one via a relative path in the package) break `instanceof`
     and double the download.
  6. *Global side effects.* The fix for the shadow flicker patches a shader chunk. Done globally, the engine would
     change how the app's other three.js code renders.

### 2.3 Revision: B with a pack contract (chosen)

- **One engine package**, `packages/world/`, named `@hq/world`. Generic, no HQ words.
- **Content comes in packs.** A pack is a module that default-exports `definePack({ id, objects, finishes, palette })`.
  Each object is one file that default-exports `defineObject({...})`. A pack imports only public entries
  (`@hq/world/model` for the pure define functions). A pack can live anywhere: in the app, in another package, or in
  the engine's own `packs/` folder.
- **No global registry.** A world names the packs it uses; `createCatalog(packs)` builds a catalog per world. Ids are
  namespaced by pack (`starter/desk`, `japandi/desk`). A duplicate id is an error that names both packs.
  Answers gap 1.
- **The starter pack** (`packages/world/packs/starter/`) holds the engine's own test and example objects: floor,
  wall finishes, door, window, desk, chair, plant, lamp. It is capped at about a dozen generic objects and is not
  where HQ content goes. Answers gap 4.
- **Objects need no imports.** `build(k, params)` receives the kit, which records primitives as data. Everything an
  object can do (boxes, cylinders, palette tokens, anchors) is on `k`. There is no helper worth deep-importing.
  Answers gap 3; the app and package boundary tests catch the rest.
- **Tools take any root.** `tools/shot.ts`, `tools/check.ts` and the lab serve a root folder (default: the current
  directory) plus the package at `/@hq/world/` with their own import map, so a world file in the app renders the same
  as an example in the package. Answers gap 2.
- **three.js is a peer.** Every package file imports the bare name `three`. The app's import map maps it once; the
  package's tools map it to the copy they find (`--three`, `HQ_WORLD_THREE`, `node_modules/three`, or the host's
  vendored copy). Answers gap 5.
- **No global mutation.** Shader patches go through each engine material's `onBeforeCompile`; a package test fails if
  any file assigns to `ShaderChunk`. Answers gap 6.
- **Promotion path to C.** When a second consumer appears, an app pack moves to `packages/world-<name>/` unchanged,
  because it already imports only public entries.

### 2.4 Layout

```
packages/world/
  package.json          @hq/world, "type": "module", exports ".", "./model", "./packs/starter"; peer three 0.186.x
  README.md             what it is, how to run the lab, the CLI and the tests
  AGENTS.md             the guide for agents: add an object, a room, a world, a pack
  CHANGELOG.md          the public API's history
  src/
    index.js            "@hq/world": everything, browser (imports three)
    model/index.js      "@hq/world/model": the pure half (no three.js), Bun and browser
    model/              world doc, validation, rooms, lot building, problems
    catalog/            defineObject, definePack, createCatalog, the primitive kit
    nav/                grid A*, slot reservation, action plans
    anim/               rig and clips as data, sampling and blending
    camera/             the Sims camera rig: pure state and maths
    arch/               architecture as primitives: floors, walls, openings, cutaway
    lint/               coplanar lint
    render/             three.js: renderer, lights and shadows, materials, meshes, characters, picking
    world/              createWorld: the composition a world author uses
  packs/starter/        the starter pack: index.js plus one file per object
  api.txt               the public API, one exported name per line (test/api.test.ts)
  examples/             tiny-house.world.js
  lab/index.html        loads any world file: ?world=/path/to/x.world.js (served by tools/serve.ts, which adds the
                        import map built from package.json's exports)
  tools/                serve.ts (the lab), shot.ts, proof.ts, check.ts, catalog.ts, chrome.ts (headless Chrome),
                        resolve.ts (lets Bun load world and pack files outside the package), pack-files.ts
  test/                 bun tests, pure (no three.js, no browser)
```

The lab lives in the package (`packages/world/lab/`), not in `docs/engine/lab.html` as first planned, so the package
carries its own lab like its own tests.

### 2.5 How the app serves it

Done in phase 1, as three small changes:

- **Import map** (`public/index.html`, a shared file; one line plus its comment): add
  `"@hq/world": "/packages/world/src/index.js"` and `"@hq/world/model": "/packages/world/src/model/index.js"` beside
  `"three"`. Exact entries, no trailing-slash prefix, so a browser cannot resolve a deep import either.
- **A route file** (`src/server/routes/packages.ts`, new, so no shared file changes): serves `.js` files under
  `packages/<name>/src/` and `packages/<name>/packs/` only, with the same no-cache and etag rules as `clientFile`.
  Tests, tools, examples and the lab are not served by the app. Checked against `server.ts` on a spare port:
  `/packages/world/src/index.js` is 200, `/packages/world/package.json` is 404.
- **`modules.test.ts`** (2.6).

Left for phase 2:

- **Autoreload** (`src/server/page.ts`, shared): open pages reload when `src/client` or `public` changes. Package
  edits do not trigger it until `page.ts` also watches `packages/`. That is a two-line change, named here and left
  for phase 2, when the app first imports the package.
- **Bun side**: nothing in the app server imports the package in phase 1. Bun resolves `@hq/world/model` by
  self-reference inside the package (its tests and the starter pack use it), but not from app files. The package's
  tools load app-side worlds and packs through `tools/resolve.ts`, which points `@hq/world...` at the exports on load.
  Step 2 (12) is the first time app tests import an app pack. The plan was `"workspaces": ["packages/*"]` in the
  root `package.json`, but that needs a `bun install` in every checkout and worktree before `bun test` passes. The
  root `tsconfig.json` maps the three public entries to their files instead (`compilerOptions.paths`, which Bun reads
  for JS too), so it works with no install. `test/client/world-package.test.ts` holds those paths equal to the
  package's exports.

### 2.6 How `modules.test.ts` treats it

`test/client/modules.test.ts` walks `src/client` only, so package files are never checked as page modules and it did
not flag them. The one change: it read exports only of `src/client` files, so an app import of `@hq/world` (mapped by
the import map to `packages/world/src/index.js`) would have crashed it. It now reads a module's exports when first
asked, following `export * from`, so the link check works across the boundary. The package checks its own links in
`packages/world/test/boundary.test.ts` with the same rules. The new `test/client/world-package.test.ts` checks the
boundary from the app side: no app file (`src/`, `scripts/`, `test/`, `bin/`, `public/`) imports a path into
`packages/world/` or a deep `@hq/world/...` name, every `@hq/world*` import-map entry points at the file its export
names, and the route serves the package's browser modules and nothing else. Both boundary tests were checked against a
planted violation (an app file deep-importing `render/stage.js`; a package file importing `src/client/core/state.js`)
and failed with the file, the import and the fix.

After the second review, both tests read imports with Bun's parser (`Bun.Transpiler.scan`), not regexes, so
spacing and quoting cannot hide one (`import{x}from"..."`, `export*from"..."`). Every JS and TS flavour is read
(`.mjs`, `.cjs`, `.mts`, `.tsx`), and HTML files by their scripts. Any `require`, `import.meta.require` or
`createRequire` fails, and so does an `import()` whose argument is not a literal, except in the files that load a
file the user names (`check.ts`, `catalog.ts`, the lab; on the app side, the router that loads its route files).
Each test keeps a list of probes, the ways past it the reviews found; each probe must fail and the clean tree must
pass.

### 2.7 Versioning and stability

- `packages/world/package.json` starts at `0.1.0`. While `0.x`, a minor bump may break the API; a patch never does.
- The public API is exactly the named exports of the `exports` entries plus the world-file format. A package test
  compares those names to `packages/world/api.txt`. Removing or renaming an export fails the test until `api.txt`
  and `CHANGELOG.md` change in the same commit, which makes a breaking change a visible decision.
- Exports carry `@stability stable` or `@stability experimental` in their JSDoc. `world.three` (the raw scene and
  renderer) is experimental and may change in any minor.
- World files carry `format: 1`. A future `format: 2` reads `format: 1` through a migration in `model/`; old world
  files never stop loading silently.

### 2.8 How a world author adds a content pack without touching the engine

1. Make a folder anywhere (`src/client/office/packs/japandi/`). Add one file per object, each
   `export default defineObject({...})`, importing `defineObject` from `@hq/world/model`.
2. Add `index.js`: `export default definePack({ id: "japandi", objects: [desk, chair, ...] })`.
3. List the pack in the world: `defineWorld({ packs: [japandi], ... })`.
4. `bun packages/world/tools/check.ts path/to/x.world.js` validates the world and lints every object; `tools/shot.ts`
   renders it. No engine file changes.

### 2.9 What an agent gets wrong, and what catches it

| Mistake | Caught by |
| --- | --- |
| Adds `sofa.js` but forgets to list it in the pack's `index.js` | `checkPack` (and the pack test): "packs/x/sofa.js is not in index.js; add `import sofa from "./sofa.js"` and list it in objects" |
| Builds geometry outside its footprint | validation: "starter/desk: box 'top' reaches x = 0.61, past the footprint's 0.5; widen footprint to [2, 1] or shrink the box" |
| Puts a rug or poster flat on another surface | coplanar lint: names both parts and says "lift one by at least 2 mm or give it 1 cm thickness" |
| Thinks `y` is the box's centre | the kit documents y as the bottom; lint and footprint errors print the box's real extents |
| Uses centimetres | sizes over 6 m and footprints that are not whole tiles are errors |
| Places a door where there is no wall | "opening 2 (starter/door) at tile (6,2) side e: no wall on that edge; the nearest wall edges are (6,1) e, (6,3) e" |
| Places a chair across a wall or on a desk | "objects[4] starter/chair covers tile (3,2), already used by desk-1; free tiles next to it: (3,3), (4,2)" |
| Mistypes an id | "unknown type starter/chiar; did you mean starter/chair?" |
| Leaves a room without a door | "room 'study' cannot be reached from outside; add an opening on one of its walls, for example ..." |
| Deep-imports `render/materials.js` from the app | `test/client/world-package.test.ts` |
| Imports app code from the package | `packages/world/test/boundary.test.ts` |
| Patches `ShaderChunk`, aliases `ShaderLib`, sets `Cache` or `Object3D.DEFAULT_UP` | `boundary.test.ts`: shared three.js state is named only at a listed read of a string |
| Sets `document.title` or writes `localStorage` from the engine | `boundary.test.ts`: runtime code touches no page state but `document.createElement` |
| Writes "lane" or "ask" into the engine | `boundary.test.ts` (no host concepts in the package) |

### 2.10 Second critique, after building the proof

Building B in `packages/world/` tested the revision against real tools. What changed:

1. *Bun cannot see the import map.* Inside the package, Bun resolves `@hq/world/model` by package self-reference, so
   the starter pack and the tests import it like any pack would. An app-side world or pack is outside the package, and
   Bun's runtime `onResolve` hook does not see bare names. `tools/resolve.ts` rewrites `@hq/world...` on load to
   the exports' files, and refuses names that are not exports. A world in any folder checks with `check.ts`.
2. *The lab's import map must not drift from `exports`.* `tools/serve.ts` builds it from `package.json` on every
   request, and `api.test.ts` checks that every export is mapped.
3. *The lint is only as good as what it reads.* Its first run reported 109 coplanar pairs in the tiny house. All
   were bottom faces at y = 0 (wall bottoms on slab bottoms), never visible. The primitive kit gained `omit` faces,
   so hidden faces are neither drawn nor linted. The lint also caught the first door and window, which were too wide
   for the space between the wall posts, and a chair back exactly as wide as its seat.
4. *A pack folder can drift from its index.* `checkPack` cannot read folders (it is pure), so `tools/pack-files.ts`
   checks that every file is imported and listed, and `check.ts` runs both.

### 2.11 Decision entry (D16, for `docs/decisions.md`)

> ## D16. The 3D world is an isolated package, `@hq/world`; HQ content stays in the app as packs
>
> The owner asked for the 3D world to be its own isolated package that the app uses. It lives in `packages/world/`
> with its own `package.json` (`exports`: `.`, `./model`, `./packs/starter`; three.js as a peer and nothing else),
> README, AGENTS guide, tests, lab and CLIs. It imports nothing from the app, and it knows nothing about lanes, asks,
> the bus or HQ: it speaks lots, rooms, objects, slots, characters, acts and events. The app reaches it only through
> the import map (`@hq/world`, `@hq/world/model`), which a new route file (`src/server/routes/packages.ts`) serves
> from `packages/*/src` and `packages/*/packs`. Tests on both sides fail on a crossing: a package file importing
> outside the package, or an app file deep-importing it.
>
> Three shapes were compared: one package with the engine and the office's content, an engine package with content
> kept in the app, and an engine package plus a package per content pack. The first makes every new chair an engine
> change. The third makes every new pack touch four shared places, for one consumer. The engine package with a pack
> contract was chosen. Content comes as packs (`definePack`, one file per object, ids prefixed by pack), catalogs
> are built per world with no global registry, and a pack imports only public entries. So HQ's Japandi pack, the
> office layout from the lane tree and the outside generator stay app-side, and any of them can later move to its own
> package unchanged. The public API is `api.txt` plus world format 1, versioned 0.x, and a test fails when it changes
> without the changelog.
>
> Inside the package, what moves runs in a small ECS of its own (`createEcs`, `createSim`; no dependency), and what
> stands still stays plain data. The lot (grid, floors, walls, openings, rooms) is a pure model with pure functions
> over it. Placed objects and characters are entities whose components are plain JSON (`body`, `anim`, `queue`,
> `holding`, one component per step in progress). Systems run in a fixed order, one file each (sequence, stand, walk,
> turn, enter, loop, wait, anim), and createWorld's three.js side only mirrors components onto meshes. Three designs
> were compared: a model plus a scene graph with one step interpreter, a pure ECS, and this hybrid. The interpreter
> and the hybrid were both built and given the same new behaviour, a visit to another desk (2.12). The interpreter
> is smaller (79 code lines against 207) and touched one file fewer. The hybrid lets a host add components and
> systems without editing the package, and its whole state saves and loads as JSON. The numbers were close, and the
> owner prefers an ECS, so the hybrid was chosen. The app's adapter sets components and passes its own systems; it
> never edits engine systems.

### 2.12 What moves: an ECS beside the lot model

The owner asked for an ECS if it makes sense. Performance is not the argument: a lot holds tens of characters and
hundreds of objects. The arguments are composition and agent DX:

- components are plain data, which suits world files, saves and tests;
- a system is one small file, which suits parallel lanes;
- queries suit tests and tools ("every chair has a seat slot").

The costs are indirection, the scene graph that three.js still needs, and the static parts (the grid, walls and
rooms), which are relational data that fit a model better than entities.

Three designs:

1. **Model plus scene graph.** The lot is a pure model. Each character is one plain state object, run by one step
   interpreter (a chain of `if (step.kind === ...)` cases). This is what phase 1's `createWorld` did, inside the
   renderer.
2. **Pure ECS.** Tiles, wall edges, openings and rooms are entities too. Rejected without a prototype. Room
   detection, the cutaway, the nav grid, the coplanar lint and validation each need the whole lot at once (edges
   between tiles, flood fills, every primitive), so each system would rebuild the same indexes from components.
   "Why is this wall here?" would span several stores.
3. **Hybrid.** The lot stays a pure model. Placed objects and characters are entities with plain-data components.
   An act becomes a queue of steps. Each step kind is a component, run by its own system. A host adds components and
   systems through `createWorld(..., { systems })`.

Designs 1 and 3 were both built headless, and both walk Ada from the lounge to chair-1 and sit her down to type
(`docs/engine/compare/compare.test.ts` checks that they end in the same place). Then the same new behaviour went
into both: the visit, a real upcoming feature. A worker walks to the lead's desk, stands, waits and walks back:
`{ do: "visit", target, wait, then }`. Whether the office uses it at all is the app's setting; the engine only
offers the act.

| Criterion | 1. Model plus scene graph | 3. Hybrid ECS (chosen) |
| --- | --- | --- |
| Walk and sit, code lines (shared planner 47 and motion 24 left out) | **79**, 1 file (`docs/engine/compare/scene-graph/walker.js`) | 207, 10 files (`ecs.js` 37, `sim/index.js` 53, 8 system files 117) |
| The visit: engine files touched | **2**: the planner (+26 lines), `walker.js` (+3: an `else if`) | 3: the planner (+26), a new `systems/wait.js` (14), the system list (+2) |
| A new step kind from the host, without editing the package | no: it is a case in `walker.js`, a package file | **yes**: a system in `opts.systems` and a component |
| Two lanes adding behaviours at once | both edit the same `if` chain | each adds a file; only the one-line list is shared |
| Headless tests | yes (both run in Bun) | yes, and a single system runs on its own over hand-made components |
| World file | the same in both: `characters` and `acts`; the visit is an act that `planAct` validates | the same |
| Saving the running state | plain objects, but needs a hand-written load; host state lives elsewhere | **`ecs.toJSON()` and `ecs.load()`**: `sim.test.ts` saves mid-walk, loads into a new sim and ends identically |

Reading the numbers: design 1 is 2.6 times smaller and touched one file fewer, both by small absolute margins (128
lines, one file). Design 3 is better on the two criteria that grow with the office: behaviours from the host across
the package boundary, and state as data. Headless testing is a tie. Both designs are pure, which phase 1's renderer
code was not, so most of that gain came from leaving the renderer, not from the ECS. That is close, and the
owner's preference breaks the tie: design 3.

The line counts above are from the day of the comparison. Since then the review asked that the comparison import
only the package's public entries, so the rival now carries its own copy of the motion helpers and its own map of
held seats: `walker.js` is 103 lines. The sim grew too (`sim/index.js` is 181 lines), for edits at run time, a
reservation that lives in a component and acts that fail cleanly (3.8, 3.10). The rival has none of that.

What the choice costs, and how it is contained:

- **The step order is spread out.** `sequence.js` starts a step only when a character holds no component of any
  registered step kind (`ecs.stepKinds()`). A queued step with no system cancels the act with a problem that names
  the fix (`step.unknown`: register a system with `step: "dance"`), and the character stands idle.
- **A system can break the loop.** It cannot any more: a system that throws is logged once with its name and
  switched off, and the other systems keep running (`ecs.disabled()` lists it).
- **A frame per step boundary.** When a step finishes mid-frame, the next one starts on the next frame. That costs
  16 ms per boundary, which no one can see; the rival carried the rest of the frame over.
- **Queries copy.** A query returns a fresh array of `[id, ...components]`, so systems may add and remove components
  while they iterate. At tens of entities the copy costs nothing measurable.

## 3. The layers

Each layer depends only on the layers above it in this list. Everything above `render` is pure (no three.js) and
runs in Bun tests.

| Layer | Pure | Knows | Does not know |
| --- | --- | --- | --- |
| `model` | yes | the world doc, tiles, edges, rooms, problems, the diff of two docs | geometry, three.js |
| `catalog` | yes | object definitions, packs and their palettes, the primitive kit | where objects are placed |
| `lot` | yes | the built lot: placement, slots in world space, analysis with fixes, the ASCII map | three.js |
| `arch` | yes | floors, walls and openings as primitives; the cutaway rule | three.js |
| `nav` | yes | walkable tiles, A*, slots, action plans | who holds a seat, animation, drawing |
| `anim` | yes | the rig, clips as keyframes, sampling, blending | meshes |
| `camera` | yes | the Sims camera rig: state, easing, pose, projection, pixel snap | three.js |
| `lint` | yes | coplanar faces in a primitive list | where they came from |
| `sim` | yes | an ECS of characters; the step systems; held seats; edits; saving its state | meshes, three.js |
| `view` | yes | the frame policy (when to draw, when shadows are stale), the canvas size, edits and the camera calls | three.js |
| `render` | no | three.js: renderer, lights, shadows, materials, meshes, characters | the world doc's rules |
| `world` | no | the three.js glue: does what the view driver returns; events | lanes, HQ |
| `ui` (in `render` and `world`) | no | projection for overlays, picking, hover | the app's DOM |

The key decision is that **geometry is data until the last step**. Architecture and objects produce primitive lists
(`{ shape: "box", size, at, rot, color, finish, part }`) in pure code. `render` turns them into merged three.js
geometry. So the coplanar lint, footprint checks and golden "what is built" tests all run in Bun in milliseconds,
on exactly what will be drawn.

### 3.1 model

- A lot is `w × d` tiles of 1 m. `x` runs east, `z` runs south, `y` is up. Tile `(x, z)` covers `[x, x+1) × [z, z+1)`.
- Floors paint rectangles of tiles with a floor finish. A floored tile stands on a slab whose top is `FLOOR_Y = 0.06`
  above the ground (a foundation), so floor and ground never share a plane.
- Walls are paths along grid lines (`[[1,1],[7,1],[7,6]]`), expanded into unit edges. An edge is named by a tile and a
  side: `{ at: [x, z], side: "n" | "e" | "s" | "w" }`; internally `h:x,z` (along x) or `v:x,z` (along z).
- Openings (doors, windows) sit on one wall edge, named the same way.
- Rooms are found, not declared: a flood fill over tiles that crosses edges without walls. A region that touches the
  lot's border is outdoors; every other region is a room. Rooms get stable ids from their first tile
  (`room:x,z`) unless a `rooms: [{ at, id, name }]` label names them.
- Objects: `{ id, type, at: [x, z], facing: "n" | "e" | "s" | "w" }`. `at` is the north-west tile of the footprint
  after turning. `facing` is where the object's front points (a chair's front is where the knees point).
- Characters: `{ id, at, facing, look }`. Starting actions: `acts: [{ who, do, target, slot }]`.
- Validation returns `Problem[]`: `{ code, severity: "error" | "warning", path, message, fix }`. Every message names
  what is wrong, where (a JSON path and a tile), and a concrete fix, often with coordinates.

### 3.2 catalog

`defineObject` takes:

```js
defineObject({
  id: "chair",                       // the pack adds its prefix: "starter/chair"
  kind: "object",                    // "object" | "opening" | "floor" | "wall"
  footprint: [1, 1],                 // tiles, w × d before turning
  height: 0.9,                       // for picking and the lint's bounds
  blocks: true,                      // its tiles block walking (a rug does not)
  tags: ["seat"],
  slots: { seat: { at: [0, -0.05], facing: "s", stand: [[0, 1], [1, 0], [-1, 0]], clip: "sit" } },
  anchors: { above: [0, 1.4, 0] },   // named points for overlays and attachments
  instance: true,                    // hint: many of these; draw instanced
  lod: { far: "box" },               // hint: at the far zoom draw its bounding box
  build(k, p) { k.box("seat", [0.44, 0.06, 0.42], [0, 0.42, 0], "fabric"); ... },
});
```

The kit `k` records primitives: `k.box(part, size, at, color, opts)`, `k.cyl(...)`, `k.glow(...)` (emissive), with
`y` the bottom of the part, in the object's local frame (origin at the footprint's centre on the floor, front +z).
Colours are palette tokens (`"wood"`, `"fabric"`, `"leaf"`) or hex. Openings define `width`, `sill`, `head`,
`passable` and build their frame in the edge's frame. Floor and wall finishes are `{ color, pattern }`.

### 3.3 nav

- A walk grid from the lot: a tile is free unless an object with `blocks` covers it. Moving between neighbours
  crosses an edge only if it has no wall or a passable opening; diagonals need both orthogonal moves open.
- A* with octile distance; paths are smoothed by dropping collinear tiles.
- Slots: an object's `slots` give where a character stands (`stand`, tile offsets tried in order), where it ends up
  (`at`), which way it faces and which clip it plays. Nav keeps no state: who holds a slot is the sim's `holding`
  component, and `planAct` asks through its `holder(objectId, slot)` option.
- `planAct(lot, nav, character, { do: "sit", target: "chair-1" }, { holder })` returns steps:
  `walk(path) → turn(facing) → enter(slot, clip) → loop(clip)`, plus the slot to hold. `{ do: "visit", target, wait,
  then }` plans `walk → turn → wait`, then the `then` act from the tile beside the target. The sim runs the steps.

### 3.4 anim

The rig is data: joints with parents and rest offsets (hips, spine, head, two arms with elbows, two legs with knees).
A clip is keyframes per joint (`[t, rx, ry, rz]`), an optional root offset, and `loop`. Clips in phase 1: `idle`,
`walk`, `sit-down`, `sit`, `type`, `wave`, `lean-back`, `drink`. `samplePose(clip, t)` and
`blendPose(a, b, w)` are pure; `render` applies a pose to a jointed mesh. Clip changes cross-fade over 0.2 s.

### 3.5 camera

The Sims camera, pure. State: `focus` (a ground point), `rot` (an integer), `az` (current azimuth), `zoom` (0, 1, 2)
and `ppm` (current pixels per metre). Rules:

- The camera orbits the focus at a fixed pitch of 30° and a fixed distance. Its height is
  `focus.y + D·sin 30°` at every frame, and the focus projects to the same screen point at every frame.
- A turn animates only the azimuth, along the arc, with an ease-in-out over 0.38 s. It never moves the focus and
  never changes the zoom. Fitting is done once (on load or on request), for the worst of the four rotations, so a
  turn never needs a refit.
- Zoom has three steps; between them the camera eases in log space, focus fixed.
- Panning moves the focus on the ground plane, clamped to the lot.
- At rest, the rendered focus is snapped so the whole picture lands on whole device pixels: the focus's screen
  coordinates are rounded to `1 / (ppm · dpr)` metres along screen x and `1 / (ppm · dpr · sin 30°)` along the
  ground's screen y. The logical focus keeps the exact value, so drags accumulate correctly. A pan then moves the
  picture by whole pixels, and a static scene renders identically, shifted.
- `project(pose, point)` and `unproject(pose, screen)` (to the ground plane) are pure, so overlays, picking of tiles
  and the tests use the same maths as the renderer.

### 3.6 arch and the cutaway

`buildArchitecture(lot, cut)` returns primitives with no overlapping coplanar faces, by construction:

- Every grid vertex that a wall touches gets a post `T × T` (`T = 0.15`). Every wall edge is a box of length
  `1 − T` between its posts. Segments and posts touch only face to face, never overlap. A post is as tall as the
  tallest wall beside it.
- The wall box's top face is the cap (its own colour); there is no separate cap box lying on the wall.
- Each side of a wall takes the finish of the space it faces: a room's interior finish or the exterior finish.
- An opening splits its segment into pieces around the hole. Frames are 2 cm deeper than the wall so their faces are
  never in the wall's planes.
- Floors are slabs from the ground to `FLOOR_Y`; the ground is a single plane at `y = 0`. Slab and wall bottoms are
  not emitted (never seen, and coplanar with the ground in the opposite direction).

`cutaway(lot, { mode, rot, focus })` returns the set of cut edges:

- `up`: none. `down`: every edge (walls drop to the kerb, 0.35 m).
- `cutaway`: an edge is cut when the tile behind it, seen from the camera, is indoors (the near walls of every room),
  or when a full wall there would hide a room within `2.95 / tan 30° / √2 ≈ 3.6 m` behind it. With `focus` set to a
  room id, only walls in front of that room are cut (per-room focus).
- During a turn, the cut set is the union of the old and the new rotation's sets, and the new set alone when the turn
  ends. Walls never scale; each edge is either full or kerb height, and the mesh is rebuilt (cached per key).

### 3.7 render

- `WebGLRenderer({ antialias: true })`: MSAA on the default framebuffer, `outputColorSpace` sRGB,
  `NeutralToneMapping` (keeps flat albedo hues), DPR capped at 2.
- Light rig: hemisphere (sky/ground) + ambient + one directional sun with shadows. `setTime("hh:mm")` moves the sun
  and blends its colour through day `#FFFFFF`, sunset `#D96D32`, dusk `#575757` and night `#3E5898`. Night keeps
  less of the day's fill. Each object with a `light` anchor has its own warm spot light aimed down (the `lamp` token),
  lit by night only and never batched.
- Shadows: one 2048² map. The shadow camera is orthographic, fitted to the lot's bounds in light space, and its
  centre is snapped to whole shadow texels, so a sun that moves (time of day) or a lot that grows never makes the
  shadows swim. The map redraws only when a caster moves (`autoUpdate = false`, `needsUpdate` on change).
- The PCF filter is patched per material (via `onBeforeCompile`, never globally) to rotate its taps by a fixed angle
  instead of `interleavedGradientNoise(gl_FragCoord.xy)`, with radius 1.5 texels. The penumbra is then fixed to the
  world, not to the screen.
- Materials: one Lambert material per finish class (matte, glow, glass), vertex colours from palette tokens, flat
  shading. Each theme (light, dark) is a palette.
- Meshes: architecture merged per finish class; objects of a type with two or more copies draw as one `InstancedMesh`
  per material, with an instance per object (`instance: false` opts out). Each object keeps an anchor group, so pick,
  hover and attach still work on it.
- Characters: one `SkinnedMesh` per character, bound to the rig's bones; casts real shadows (no blob decal lying on
  the floor).

### 3.8 sim

`createSim(lot, nav, { systems })` puts every character (`character`, `body`, `anim`) into an ECS (`createEcs`:
entities are ids, components are plain JSON per kind, systems run in a fixed order). Placed objects are not
entities: they are the lot's, and nothing about them changes while the sim runs. `act` plans with `planAct`, sets
`doing` (the act), `holding` (`{ object, slot }`, the seat it holds) and a `queue` of steps. The held seat exists
only as that component: `ecs.toJSON()` carries it, `ecs.load()` restores it, and two characters never hold one
seat. An act that cannot be planned changes nothing. `sequence` starts the next step as a component of its kind.
`stand`, `walk`, `turn`, `enter`, `wait`, `then` and `loop` each run their kind and remove it when it is done, and
`anim` advances the clips. `then` plans the visit's next act from where the character stands. A host's systems run
after the step systems and before `anim`. A system that throws is switched off and logged once with its name. Why an
ECS here and not for the lot: 2.12.

### 3.9 world and the view driver

`createWorld(canvas, world, opts)` validates the world (throws with every problem) and makes a view driver
(`src/view/driver.js`, pure). The driver owns the catalog, the lot, the nav grid, the sim, the camera and the cut
walls. Each frame, `driver.tick(now, dt)` steps the sim and the camera and returns `{ render, shadows, cut }`.
`createWorld` builds the architecture for the cut, the object groups and the character meshes, mirrors the sim onto
them, and draws only when the driver says so. The meshes hold no state of their own.

The frame policy is in the driver, so Bun tests count it:

- **Render** when the camera moves (a pan, a zoom, a turn, an eased focus), a body moves, a clip cross-fades, the cut
  walls change, or something asked (an edit, a theme or time change, a hover, `invalidate()`, `attach()`).
- **Draw the end of every motion.** The step that brings the camera to rest is drawn, so the last picture is the
  snapped pose on whole device pixels. The anim system is busy while a cross-fade runs, including the step that ends
  it, so the last picture of a walk is the idle clip and the last of a sit is the slot's clip. `settle.test.ts`
  checks a turn in each wall mode, a zoom, `fitBox`, `focusOn`, a walk and a sit.
- **Redraw the shadow map** only when a body moved or cross-faded, the cut walls changed, or an edit, theme or time
  change or `attach()` asked. A pan, a zoom or a hover never redraws it.
- **Nothing else draws.** A clip looping in place (typing, breathing) is not motion: it draws at `idleFps`
  (default 0, never) and never redraws shadows. No frame cap applies during interaction.

The canvas's backing store is its device-pixel box. A `ResizeObserver` on `device-pixel-content-box` gives it
exactly. Where a browser has none, the size is rounded to whole device pixels and the CSS size set to match, so the
browser never resamples the canvas. The renderer's pixel ratio is 1 and the camera takes the DPR (capped at 2).

### 3.10 Edits at run time

Two shapes were possible: an edit API (`addObject`, `moveObject`, `removeObject`, each validated) or one call that
takes the next whole doc and diffs it. The engine has the second: `world.apply(next)`.

- **The host already makes whole docs.** The office will be a generator from the lane tree to a `WorldDoc` (12,
  step 2). With `apply`, it calls the generator again and hands over the result. With an edit API, it would have to
  diff its own docs to find the calls, which is the same diff written once per host.
- **Idempotent for free.** The same doc twice is a no-op (`diffWorld` finds no change and `apply` returns `null`).
  A host that re-renders on every state change does no work when nothing moved.
- **Validation sees the whole result.** An edit API would validate one change at a time and could pass a sequence
  whose end state is invalid, or reject a valid end state halfway. `apply` validates the next doc whole; a
  `WorldError` changes nothing.
- **Only the diff is rebuilt.** `diffWorld(a, b)` names the objects and characters added, removed and changed, and
  whether the lot or the packs changed. An object's height comes from the floor under it, so when the lot changed,
  `apply` also names every object whose built place (position, anchors, slots) moved; the pure diff cannot see that.
  `createWorld` rebuilds those groups only, and the architecture only when the lot changed. App children attached
  to a rebuilt object stay attached.

The sim keeps running through an edit. New characters spawn at their `at`; removed ones are dropped (their act's
promise rejects). A character keeps its place and its act. If its held seat or target changed or went away, or its
route now crosses a blocked tile, it plans the act again from where it stands, and gets a `cancel` event when that
fails. A character on a tile that an object now covers walks off it. A character outside a lot that shrank is
moved inside; that is the only teleport. A character whose act is dropped while it stands in an object (its chair
became a plant) walks off it: `cancel` steps it clear. An act in the next doc that the current one did not have
starts; acts both docs share are not replayed. So a host sends a worker to a desk by adding the act to the doc it
generates.

**A doc's `characters[].at` is the spawn tile only.** Two choices were possible for a character that already
exists: check its acts from where the sim has it now, or not by position at all. The engine does the second.
`analyse(world, { live })` skips the `at` checks for live characters and checks their acts with `checkAct`, which
needs no position: a known act and clip, an object that exists, a slot it has. The reasons:

- The sim is the truth at run time. A check from the doc's `at` is a check from a stale place: it refused an edit
  that put a plant where a worker started an hour ago, so a generator would have to keep every spawn tile free.
- A check from the sim's live state would make an edit depend on a moment. A seat held for a second by a host act,
  or a worker halfway through a door, would refuse the whole doc, and the same doc would pass a frame later.
- Only the new acts run, and the sim plans each from where the character is when it starts. What it cannot start
  is reported per act: a `cancel` event `{ who, problem, act, refused: true }`. The host learns which act failed
  and why; the rest of the edit still applies.

New characters are still checked from their `at`, since that is where they appear. `check.ts` and `createWorld`
check every character that way. A save loaded with `sim.ecs.load` is checked against the lot by the same code that
runs after an edit: a seat whose object or slot is gone is let go, and its holder stands up and steps clear.

## 4. The public API

All of it is plain JS with JSDoc typedefs in `src/types.js`. `@hq/world/model` is the pure subset; `@hq/world`
re-exports it and adds the browser half.

```js
/** @typedef {[number, number]} Tile                         x, z in whole tiles */
/** @typedef {"n"|"e"|"s"|"w"} Side */
/** @typedef {{ code: string, severity: "error"|"warning", path: string, message: string, fix: string }} Problem */

/** @typedef {object} WorldDoc
 *  @property {1} format
 *  @property {string} id
 *  @property {string[]} packs                                 pack ids
 *  @property {{ w: number, d: number }} lot
 *  @property {{ rect: [number, number, number, number], finish: string }[]} floors
 *  @property {{ path: Tile[], finish?: string, outside?: string }[]} walls
 *  @property {{ type: string, at: Tile, side: Side }[]} openings
 *  @property {{ at: Tile, id: string, name?: string }[]} [rooms]
 *  @property {{ id: string, type: string, at: Tile, facing?: Side }[]} objects
 *  @property {{ id: string, at: Tile, facing?: Side, look?: object }[]} characters
 *  @property {{ who: string, do: string, target?: string, slot?: string }[]} [acts] */

/** @typedef {{ doc: WorldDoc, packs: Pack[] }} World */
/** @typedef {{ id: string, objects: ObjectDef[],
 *              palette?: { light: Record<string, string>, dark: Record<string, string> } }} Pack   tokens are the pack's own */
/** @typedef {{ shape: "box"|"cyl", part: string, size: number[], at: number[], rot?: number, color: string,
 *              finish?: "matte"|"glow"|"glass", owner?: string }} Primitive */
```

`@hq/world/model` (pure, stable unless marked):

| Export | Signature |
| --- | --- |
| `defineWorld` | `(spec) → World` |
| `defineObject` | `(def) → ObjectDef` |
| `definePack` | `({ id, objects, palette }) → Pack` |
| `createCatalog` | `(packs) → Catalog` (`get`, `has`, `list(filter)`, `problems`) |
| `validateWorld` | `(world) → Problem[]` |
| `checkPack` | `(pack) → Problem[]` (palette shape, colour tokens, clips, footprint, slots, coplanar parts) |
| `buildLot` | `(world, catalog) → Lot` (tiles, edges, rooms, placed objects with world slots) |
| `detectRooms` | `(doc) → Room[]` |
| `diffWorld` | `(docA, docB) → WorldDiff` (`same`, `lot`, `packs`, `objects`, `characters`, `acts`; experimental) |
| `lotMap` | `(lot, { characters }) → string` (the lot as ASCII, for `check.ts --map`) |
| `toJSON` / `fromJSON` | `(world) → string`, `(json, packs) → World` |
| `createNav` | `(lot) → Nav` (`path`, `walkable`, `canStep`; no state) |
| `ACTS`, `planAct` | `(lot, nav, character, act, { at, holder }) → { steps, hold? } \| { problem }` |
| `createEcs` | `({ onError }) → Ecs` (`add`, `get`, `has`, `remove`, `query`, `system`, `step`, `toJSON`, `load`, `disabled`; experimental) |
| `createSim` | `(lot, nav, { systems, emit }) → Sim` (`act`, `step`, `apply`, `character`, `ecs`; experimental) |
| `cutaway` | `(lot, { mode, rot, focus }) → Set<string>` |
| `buildArchitecture` | `(lot, cut, palette) → Primitive[]` |
| `lintCoplanar` | `(primitives) → Pair[]` |
| `RIG`, `CLIPS`, `samplePose`, `blendPose` | the rig and clips as data (experimental) |
| `createCamera`, `stepCamera`, `cameraPose`, `project`, `unproject`, `focusCamera` | the camera rig |
| `WALL_H`, `KERB_H`, `WALL_T`, `FLOOR_Y`, `PITCH`, `ZOOMS` | the numbers |

`@hq/world` adds:

```js
/** createWorld(canvas, world, { theme, time, walls, rot, zoom, clock: "raf"|"manual", idleFps, systems }) → WorldView
 *  WorldView:
 *   camera: { rotate(dir), zoom(step), pan(dxPx, dyPx), focusOn(x, z, { ease }), fitBox(box, { ease }), fit(),
 *             pose(), state }
 *   roomBox(roomId) → { minX, minZ, maxX, maxZ }      for camera.fitBox
 *   apply(nextWorldOrDoc) → WorldDiff | null         an edit at run time (3.10)
 *   invalidate({ shadows }?)                         request a frame for a change the engine cannot see
 *   setWalls(mode, focusRoom?), setTheme("light"|"dark"), setTime("14:00")
 *   act(characterId, act) → Promise<void>          walk to a slot and use it, or visit (walk, wait, then)
 *   character(id) → { x, z, ry, hips, clip, step }
 *   sim: { ecs, act, step, character, characters, pose, on }   the ECS (experimental)
 *   pick(clientX, clientY) → { kind: "object"|"character"|"tile", id?, tile } | null
 *   hover(clientX, clientY)                          highlights what pick would return
 *   project([x, y, z]) → { x, y, visible }           CSS px, snapped to device pixels
 *   anchor(entityId, name) → [x, y, z] | null        a named point of an object or character
 *   attach(object3d, entityId)                       parent app objects to an entity (experimental)
 *   on("frame"|"pick"|"hover"|"act"|"cancel"|"error"|"camera", fn) → off
 *   advance(ms)                                       with clock "manual": step and render (tests, shots)
 *   inspect() → { ..., size: { w, h, dpr, buffer }, stats: { renders, shadowRedraws, frames } }
 *   three: { renderer, scene, camera }              experimental escape hatch
 *   dispose() */
```

## 5. World files

A world is a JS module that default-exports `defineWorld({...})`. Its data is plain JSON (so `toJSON` round-trips
it); the module form exists so a world can import its packs and use small helpers:

```js
// examples/tiny-house.world.js: two rooms and a door, a desk, a chair and one character who sits down.
import { defineWorld, rect } from "@hq/world/model";
import starter from "@hq/world/packs/starter";

export default defineWorld({
  format: 1, id: "tiny-house", packs: [starter],
  lot: { w: 14, d: 11 },
  floors: [{ rect: [2, 2, 10, 7], finish: "starter/oak" }],
  walls: [{ path: rect(2, 2, 10, 7), finish: "starter/plaster", outside: "starter/siding" }, { path: [[7, 2], [7, 9]] }],
  openings: [{ type: "starter/door", at: [6, 5], side: "e" }, { type: "starter/door", at: [4, 8], side: "s" }, ...],
  rooms: [{ at: [3, 3], id: "study" }, { at: [8, 3], id: "lounge" }],
  objects: [{ id: "desk-1", type: "starter/desk", at: [3, 3], facing: "s" }, ...],
  characters: [{ id: "ada", at: [9, 7], facing: "n" }],
  acts: [{ who: "ada", do: "sit", target: "chair-1" }],
});
```

JSON or a JS DSL? JSON alone cannot import packs or compute a rectangle, and agents write JS fluently. A full DSL
(`house.room(...).door(...)`) hides the data and makes validation messages point at code instead of paths. The
module-with-data form keeps both: validation paths like `objects[3].at` point into the literal an agent wrote.

## 6. The two defects in the current code

### 6.1 "Rotating feels wrong: everything moves up and down"

The camera's world height is in fact constant: `camera.js:107-111` puts it at `target.y + sin(PITCH)·d`. What moves
up and down is the picture:

1. **The walls squash and rise during every turn.** `world.js:18` (`TURN_MS`) and `world.js:423-431` scale every
   upper wall group from full height down to the kerb and back up (`rooms.js:186` `setWallScale`), and the cut caps
   sink with them. Every wall in view moves vertically for 650 ms. This is the largest vertical motion on screen.
2. **A turn re-fits the view.** `camera.js:33-36` calls `fit()` on every turn while the view is fitting (the
   default). `fit()` (`camera.js:67-90`) picks a new focus (the centre of the box including walls 2.95 m up, solved
   back to the ground, `camera.js:85-88`) and a new zoom (`camera.js:82`) per rotation, because a non-square plan
   projects to a different size at each azimuth. So the room zooms and slides during a turn.
3. **The focus travels on a chord while the azimuth travels on the arc.** `camera.js:97-99` eases the azimuth and
   lerps the focus in a straight line by the same factor. Halfway through, the focus is about 29 % of the offset off
   the arc (1 − cos 45°), which shows as a vertical slide of the whole office.

Measured by replaying `camera.js` and the turn in `world.js` without three.js on the tiny house's bounds at
1280×800: the lot's centre slides 33.5 px down and back up during the turn (cause 3; the plan is near-square, so the
zoom happened not to change), and the squash moves the top of every upper wall 2.6 m × cos 30° × 89.7 px/m ≈ 200 px
down and up again (cause 1); together with the turn, the back wall's top edge sweeps 413 px of screen height.

The engine fixes all three by design (3.5, 3.6): walls never scale, a turn never refits or moves the focus, and only
the azimuth moves. The proof logs the camera height and the focus's screen position per frame.

### 6.2 "Everything's very flickery when I move around"

Checked against a read-only diagnosis (verified here in the vendored three.js), most likely first:

1. **Screen-fixed shadow dither.** `scene.js:13` uses `PCFShadowMap`; in r186 its five Vogel taps are rotated by
   `interleavedGradientNoise(gl_FragCoord.xy)` (in `three.module.min.js`, `shadowmap_pars_fragment`), with
   `radius = 4` (`scene.js:22`) spreading them ±4 texels. The noise is fixed to the screen while the room moves
   under it, so every penumbra crawls during a pan, and MSAA cannot help. `blurSamples` (`scene.js:23`) applies to
   VSM only.
2. **The frame cap stays on during interaction.** `world.js:25` caps at 30 fps (15 balanced), applied by
   `scene.js:51-63`. On a 120 Hz display each frame is held for four refreshes while the cursor moves: strobing.
   Panning sets the focus directly (`camera.js:62`), so the steps are visible.
3. **Coplanar faces.** Window frame sides are `T` deep (`rooms.js:153`, `rooms.js:158`), so their front and back
   faces lie in the wall's planes. During a turn the squashed uppers (`rooms.js:186`) are pressed into the kerbs
   (`rooms.js:131`) on the same planes. Wall ends are extended by half a thickness (`rooms.js:19-20`), so an end
   face lies in the crossing wall's face, lit with a different room light (`rooms.js:117-122`). Depth precision is
   otherwise fine (ortho, near 0.1, far 440: about 0.03 mm per step), so the 1-14 mm offsets of floors, rugs and
   pools are safe.
4. **The camera is never on the pixel grid.** `camera.js:61` and `camera.js:116-119` place the frustum at any
   sub-pixel offset, so every edge and texture is resampled differently each frame of a pan. Thin parts (keyboards,
   0.5-2 px wide) blink in and out. The desk HUD chips are rounded to whole CSS pixels
   (`src/client/desk-hud/index.js:135`) over that sub-pixel canvas, so they wobble against it by a device pixel.
5. Smaller: posters float until the cut swaps (`world.js:425-427`); the shadow map redraws every frame though
   nothing moves (`people.js:14`); the light sum (1.8 + 0.8 + 1.2) with no tone mapping clips.

Each one is impossible by construction in the engine: the shadow taps are world-fixed (3.7), the loop has no cap
during interaction (3.9), the architecture has no overlapping coplanar faces and the lint fails the build if any
appear (3.6, 8), and the camera snaps to device pixels at rest (3.5). For (5), the shadow map redraws only when a
character moves, the cut changes or an edit asks, and `test/view.test.ts` counts the redraws. The snap only helps if
the canvas's backing store is exactly its device pixels, so the engine sizes it from `devicePixelContentBoxSize`
(3.9). The proof measures it: two frames during a pan are compared after undoing the known whole-pixel shift, and
two screenshots (what the screen shows) are compared the same way at DPR 1, 1.5 and 2.

## 7. Rendering quality and cost

Costs are estimates for a 2020-era laptop GPU (Apple M1 or Intel Iris Xe) at 1440×900 CSS px, DPR 2.

| Part | Choice | Cost |
| --- | --- | --- |
| Anti-aliasing | MSAA 4× on the default framebuffer | ~free on tile-based Apple GPUs; 10-20 % fill on Iris Xe |
| Resolution | DPR capped at 2 | ×4 pixels vs DPR 1; the main GPU cost of everything below |
| Tone mapping | Neutral, exposure 1 | free (in the material shader) |
| Lights | ambient + hemisphere + 1 directional; by night one warm spot per lamp, no shadow | < 0.3 ms by day |
| Shadows | 2048² PCF, 5 taps, world-fixed rotation, lot-fitted, texel-snapped, redrawn only on change | ~0.5-1 ms per redraw; 5 taps per pixel otherwise |
| Contact darkening | baked vertex shade at wall bases and under objects | free |
| Materials | Lambert, vertex colours, ≤ 4 classes | one program each |
| Draw calls | architecture 3-4; one per type per class (a batch of instances), one per character | HQ at 12 lanes 42 calls, 83 with a shadow redraw; 24 lanes 54 and 107. With the polish pass's pieces: 55 and 109; 65 and 129 |
| Frame loop | render on change at display rate; nothing when still | 0 when idle |
| Later, optional | half-resolution SAO or GTAO | 2-6 ms; has its own noise, so only with a world-fixed pattern |
| Later, optional | edge outline (depth and normal) | ~1 ms |

The order of work is: stable first (no shimmer, no z-fighting, no judder), then soft (shadow radius, contact
darkening), then rich (time of day, lamps, AO) only if a laptop keeps 60 fps while panning.

## 8. Agent DX

- **A world file an agent can write and check.** `bun packages/world/tools/check.ts <world>` prints every problem
  with its fix and exits non-zero on errors. It also runs the coplanar lint on the world as built, for every rotation
  and wall mode.
- **Errors that name the fix** (2.9), each with a stable `code` so tests and agents can match on it.
- **A headless shot CLI.** `bun packages/world/tools/shot.ts <world> --rot 0..3 --zoom 0..2 --theme light|dark
  --time 14:00 --walls up|cutaway|down --out x.jpg`. It serves the root and the package, opens the lab in headless
  Chrome on SwiftShader (the same approach as `scripts/room-hash.ts`, reimplemented in `tools/chrome.ts` because the
  package may not import the app), steps the world with a manual clock and writes the frame.
- **A catalog listing.** `bun packages/world/tools/catalog.ts [pack-path...]` lists every object: id, kind,
  footprint, slots, anchors, tags.
- **Tests that check meaning, not pixels**: model validation, room detection, nav (every room reachable), the
  camera (height constant during a turn, focus fixed on screen, zoom unchanged, pan lands on whole pixels), the
  coplanar lint (zero pairs in the tiny house in every rotation and wall mode; a seeded window frame fails), packs
  (every file listed, ids namespaced, parts inside footprints), the boundary, and the API surface.
- **Golden images, later.** Phase 2 adds `tools/proof.ts` results as golden numbers (pan residual, camera height)
  rather than golden pixels, which SwiftShader under load makes noisy.
- **README and AGENTS guide** in the package teach: add an object (one file, list it, check, shot), a room (walls,
  a door, a label), a world (copy the example), and a pack.
- **Conventions for parallel agents.** One file per object. A pack's `index.js` and `api.txt` are append-only lists.
  Ids are namespaced by pack, so two packs never collide. Catalogs are built per world, so registration order never
  matters. A lane that changes the engine says so up front; a lane that adds content touches only its pack.

## 9. Alternatives considered

1. **A pure ECS, or none.** The draft rejected an ECS altogether: the hard parts (grid, walls, rooms, validation) are
   relational data, not components. That still holds for the lot, so a pure ECS (2.12, design 2) was rejected. For
   what moves, a model plus a step interpreter was built and measured against a hybrid ECS. It was smaller, but the
   hybrid was chosen (2.12).
2. **Building three.js objects directly in `build()` (as the current kit does)** instead of recording primitives.
   Simpler for one renderer, but the lint, footprint checks and golden tests would need a browser, and agents would
   reach for three.js internals. Recording primitives costs one conversion step and keeps the whole model testable
   in Bun.
3. **Pure JSON worlds instead of JS modules.** Safer to load, trivially serialisable, but packs must then be found by
   name through a resolver, and every rectangle is four numbers typed by hand. Chosen: JS modules whose data is
   JSON; `toJSON`/`fromJSON` cover storage and exchange.
4. **A global object registry instead of per-world catalogs.** Simpler to call, but order-dependent and collision
   prone under parallel lanes. Rejected (2.2).

## 10. Migration: the HQ office as a world on the engine

The office becomes an app-side generator that turns the lane tree into a world doc, plus an app-side pack, plus a thin
adapter that keeps today's `api.js` contract. Nothing in `src/client/world/` changes until two lanes now editing it
(the Japandi interior and the city outside) have merged.

| Today | Becomes | Kept, moved or deleted |
| --- | --- | --- |
| `plan.js` (lanes → rooms, desks, walls, doors) | `src/client/office/layout.js` (the layout, moved in step 2) and `plan.js`: lanes → a `WorldDoc` (rooms as wall paths, desks as objects with ids `desk:<lane>`, workers as characters `lane:<name>`) | logic kept, output changed to the doc |
| `plan.js` `wallCuts`, `cameraSide` | engine `cutaway` | deleted |
| `walk.js` (BFS) | engine `nav` | deleted |
| `camera.js` | engine `camera` | deleted |
| `scene.js` | engine `render` | deleted |
| `rooms.js` (walls, floors, windows) | engine `arch` + pack finishes and openings | deleted |
| `kit.js`, `textures.js` | engine kit and materials; textures as finish patterns | kit deleted, texture drawing moved into the pack's finishes |
| `furniture.js`, `look.js` | `src/client/office/packs/japandi/` (one file per object, palette in the pack) | content kept, reshaped into `defineObject` files |
| `people.js` | engine characters (rig, clips) + `look` per character from the lane name | poses become clips (`work` → `type`, `lean` → `lean-back`, `mug` → `drink`, `raise` → `wave`) |
| `balls.js` (subagent balls) | app-side, attached with `world.attach(mesh, "desk:<lane>")` and moved in `world.on("frame")` | kept, app-side |
| `api.js` (`deskAnchor`, `project`, `addToWorld`, `onFrame`, `world:*` events) | `src/client/office/adapter.js`: `deskAnchor(lane) = world.anchor("desk:" + lane, "hud")`, `project = world.project`, `addToWorld(obj, lane) = world.attach(obj, "desk:" + lane)`, `onFrame = world.on("frame")`; `world:select`/`hover` emitted on the bus from `world.on("pick"/"hover")`, mapping entity ids back to lanes; `world:layout` from the plan | contract kept, implementation replaced |
| `world.js` | `src/client/office/index.js`: mount, theme, insets, keys, buttons | kept in spirit, much shorter |
| `outside/` (gen.js, build.js) | an app-side generator that adds ground objects around the lot, or a `packages/world-outside/` pack when a second world wants it | the generator kept; its drawing moves to objects |
| The desk HUD | positions from `world.project(anchor)`, rounded to `1/dpr` (the engine's projection is pixel-snapped) | kept, rounding changed |

The engine already has `anchor` and `attach` on characters as well as objects, edits at run time (`apply`, 3.10),
and eased `focusOn` and `fitBox` for the room view. App children attached to an object stay attached when an edit
rebuilds it. The office still needs instancing for repeated objects (measured first, 12) and per-room light at
night. The order of the whole migration is in 12.

## 11. Phase 1 proof

`bun packages/world/tools/proof.ts --out docs/engine/shots` runs the tiny house in headless Chrome (SwiftShader,
1280×800, DPR 1). It writes the shots and `docs/engine/shots/proof.json`, and every number below comes from that
file.

**The turn** (`turn-strip.png`): six frames across a 90° turn, from az 45° to 135°.

| Frame | az | camera y | focus on screen | px/m |
| --- | --- | --- | --- | --- |
| 0 | 45.0° | 49.99999999999999 | 640, 400 | 45.3 |
| 1 | 47.9° | 49.99999999999999 | 640, 400 | 45.3 |
| 2 | 68.0° | 49.99999999999999 | 640, 400 | 45.3 |
| 3 | 112.0° | 49.99999999999999 | 640, 400 | 45.3 |
| 4 | 132.1° | 49.99999999999999 | 640, 400 | 45.3 |
| 5 | 135.0° | 49.99999999999999 | 640, 400 | 45.3 |

The camera's height (`100 · sin 30°`), the focus's screen point and the zoom are the same in every frame. Only the
azimuth moves. The old camera, replayed on the same bounds, slid the lot's centre 33.5 px and moved the wall tops
about 200 px (6.1).

**Panning** (two consecutive frames of a drag of 7.37, 3.11 CSS px at the near zoom; the second frame shifted back
by the camera's reported shift and compared with the first; about 975k overlapping pixels compared; "changed" means a channel
differs by more than 8/255):

| Configuration | Shift (device px) | Whole pixels | Changed pixels | Mean difference (/255) |
| --- | --- | --- | --- | --- |
| engine | 8, 3 | yes | **0** | 0.005 |
| engine, shadow radius 4 | 8, 3 | yes | **0** | 0.005 |
| no pixel snap | 7.37, 3.11 | no | 16,661 (1.70 %) | 0.642 |
| three's screen-space shadow dither, radius 4 | 8, 3 | yes | 618 (0.06 %) | 0.082 |
| old: no snap, screen dither, radius 4 | 7.37, 3.11 | no | 16,702 (1.71 %) | 0.647 |

The engine's frames are identical after the shift. Each old cause shows up on its own. Sub-pixel camera placement
changes 1.7 % of the picture per frame, mostly edges and thin parts. The screen-fixed shadow dither changes 618
pixels, all in penumbrae, even with a perfectly snapped camera. With world-fixed taps, a wide radius is stable too.
The coplanar causes (window frames, squashed walls, wall ends) are caught before rendering: `lint.test.ts` rebuilds
each one and the lint fails on it, and the tiny house has 0 pairs in all 12 views and 12 turn states.

**Wall modes** (`walls-strip.png`): up (0 cut edges), cutaway (24), down (41), and cutaway with focus on the lounge
(12; the study's near walls stay up).

**A character walks and sits** (`walk-sit-strip.png`): Ada starts idle in the lounge at (9.5, 7.5). She walks
diagonally to the inner door, through it at (7, 5) → (6, 5), and on to the chair's free side tile (4.5, 4.5), because
the chair's front tile is the desk. She turns to face north, sits down (hips 0.62 → 0.44 m) and loops `type`:

| t | clip | position |
| --- | --- | --- |
| 0.0 s | idle | 9.5, 7.5 |
| 1.2 s | walk | 8.4, 6.4 |
| 2.4 s | walk | 7.21, 5.5 |
| 3.6 s | walk | 5.65, 5.5 |
| 4.8 s | walk | 4.5, 4.5 |
| 7.0 s | type | 3.5, 4.47 (seated) |

**Night** (`night.jpg`, 21:30, dark theme): blue moonlight, the lamps' shades glow and light the floor round them,
and Ada types at the desk. `day.jpg` is the same view at 14:00. Draw calls: 27 for the whole lot, 2k triangles.

**Sizing, after phase 1.5** (`bun packages/world/tools/proof.ts --only sizing`): an 800×500 page, the canvas either
full size or a 640.4×400.6 CSS box at (10.3, 7.7). Two screenshots (what the screen shows, after the browser
composites the canvas) across a pan of (7.37, 3.11) CSS px, the second shifted back by the whole-pixel shift:

| Canvas | DPR | Backing store | Shift (device px) | Changed pixels | Mean difference (/255) |
| --- | --- | --- | --- | --- | --- |
| full | 1 | 800×500 | 7, 3 | 0 of 366,876 | 0.007 |
| full | 1.5 | 1200×750 | 11, 5 | 24 of 834,856 (0.003 %) | 0.017 |
| full | 2 | 1600×1000 | 15, 6 | 287 of 1,492,564 (0.019 %) | 0.007 |
| fractional | 1 | 641×400 | 7, 3 | 1 of 229,262 | 0.004 |
| fractional | 1.5 | 961×601 | 11, 5 | 1 of 524,116 | 0.085 |
| fractional | 2 | 1281×801 | 15, 6 | 0 of 938,404 | 0.072 |
| fractional, old sizing (`clientWidth × dpr`, floored) | 1.5 | 960×601 | 11, 5 | 200 (0.038 %) | 0.112 |

At DPR 1 the browser's `devicePixelContentBoxSize` matched and was used. Under Chrome's DPR emulation it reports
the unscaled box (800×500 at DPR 1.5), so the engine trusts it only when it is the CSS box times the DPR, within a
pixel, and otherwise rounds. The first run, before that check, drew at DPR 1 and let the browser scale up: 11.7 %
and 21.8 % of the screen changed per pan at DPR 1.5 and 2. A real HiDPI screen, where the reported box is right,
is not in this proof.

**Idle, after the second review** (the real clock, `--only idle`; the machine was loaded): still for 3 s, 180
frames, 0 renders, 0 shadow redraws. A walk to chair-2, 90 renders and 90 shadow redraws (10.8 s, 90 frames).
Seated again for 3 s: 4 renders and 4 shadow redraws, then none. Those 4 are the cross-fade into the sit clip,
which the act's promise does not wait for; before the fix they were never drawn. An `attach()`: 1 render and 1
shadow redraw. Headless (60 steps a second): still for 3 s, 0 renders; a walk and sit of 8 s, 344 renders, each with
a shadow redraw; a pan, 1 render and no shadow redraw; a turn, 23 renders (the last one is the snapped pose) and 2
shadow redraws in cutaway mode (one per cut change), none with walls up or down; a zoom, 16 renders; a `fitBox`, 26
renders; an edit or a theme change, 1 render and 1 shadow redraw.

**Draw calls, after step 5**: `bun packages/world/tools/proof.ts --only perf --worlds src/client/office/lab/office-4.world.js,src/client/office/lab/office-12.world.js,src/client/office/lab/office-24.world.js`
runs the three lab offices in headless Chrome (SwiftShader, 1280×800, zoom 0, walls cutaway). "With shadow redraw"
counts the shadow pass too. The old renderer's office was 148 calls at 12 lanes by that count (limit 220) and 275k
triangles (limit 450k). The ms per frame the tool prints is not a real measurement under SwiftShader.

| Lanes | Objects | Characters | Before: calls with shadow redraw / without | After: with / without | Triangles with / without (same before and after) |
| --- | --- | --- | --- | --- | --- |
| 4 | 23 | 5 | 187 / 94 | 53 / 27 | 36k / 18k |
| 12 | 69 | 13 | 497 / 249 | 83 / 42 | 83k / 42k |
| 24 | 101 | 25 | 861 / 431 | 107 / 54 | 130k / 66k |

A screenshot of the 12-lane office before and after differs in 10 pixels of 1,024,000 (day) and 5 (night). At 12 lanes
the scene now has 23 meshes for objects, 13 for characters and 6 for architecture (before: 100, 143, 6).

**Draw calls, after the polish pass** (merged onto step 5; same command): the Japandi pieces add object types, and
each new type is one more batch, so one call per material in each pass. At 12 lanes the objects are 36 meshes
instead of 23, and the calls 109 with a shadow redraw instead of 83 (13 more meshes, drawn twice).

| Lanes | Objects | Characters | Calls with shadow redraw / without | Triangles with / without |
| --- | --- | --- | --- | --- |
| 4 | 36 | 5 | 69 / 35 | 45k / 22k |
| 12 | 103 | 13 | 109 / 55 | 112k / 56k |
| 24 | 165 | 25 | 129 / 65 | 185k / 93k |

`--only idle` on the test house after the merge: still for 3 s, 0 renders; a walk and sit, 77 renders and 77 shadow
redraws; still again, 1; an `attach()`, 1 render and 1 shadow redraw. Pieces on cut walls hide in batches too: in
the 12-lane office 15 of its 25 wall pieces hide from the default view (17 turned half way round), a pick or hover
there never names them, and a doc palette recolours the batches.

**Tests**: `bun test packages/world docs/engine/compare test/client/modules.test.ts test/client/world-package.test.ts`
gives 288 pass, 0 fail (phase 1: 157; phase 1.5: 225). The package has 212 tests (phase 1: 94; phase 1.5: 162).
The second review's probes are package tests now: `settle.test.ts` (8; 7 failed before the fix), `edits.test.ts`
and `doc-at.test.ts`, and the boundary probe lists (31 in the package, 12 on the app side).

**What the proof does not show yet**: real-GPU timing (SwiftShader is a CPU rasteriser), a real HiDPI screen,
per-room light, and the HQ office itself.

## 12. Migration order

The review of phase 1 set this order. Each step ends in something a test proves, and no step starts before the one
above it has merged. Phase 1.5 is step 1, with the second review's fixes (0.2.1). Steps 2, 3, 5 and 6 are
done; step 4 has not started.

1. **Engine fixes (phase 1.5, done).** Edits at run time (`apply`, 3.10). A still view draws nothing and the shadow
   map redraws only on change (3.9). The canvas is sized to its device pixels (3.9). The boundary test closes the
   holes the review found (globals, `ShaderChunk` writes, `import()` of anything outside the package, deep imports
   from the app). Packs are checked for colour tokens and clips, and palettes are per theme and per pack. Held seats
   live in the ECS. Tests use their own fixture. The tools work from any folder, and `check.ts --map` draws the lot.
   A throwing system is switched off, not fatal. Eased `focusOn` and `fitBox`. After the second review (0.2.1): the
   end of every motion is drawn, a floor edit rebuilds what stands on it, a doc's `at` is a spawn tile only, a
   refused doc act is a `cancel` event, a cancel never leaves a character inside an object, a loaded save is
   checked against the lot, and the boundary tests read imports with Bun's parser. Still open from the reviews:
   avoidance between characters, `lod` (declared, unused), and `lot.js` importing nav and act.
2. **The lane tree to a `WorldDoc`, as a pure function.** `src/client/office/plan.js` takes the lane tree and returns
   a doc: team rooms as wall paths, one desk and chair per lane with stable ids, workers as characters, doors that
   connect every room. It runs headless in Bun. Tests cover 1 lane, a full team, several teams of uneven sizes, and N
   lanes for N up to the largest office the page supports. Each generated doc passes `validateWorld` and the
   coplanar lint, every room is reachable, and adding a lane changes only what the diff says (a desk, a chair, a
   worker, and the room when it grows). It does not render anything yet.

   **Done.** `officeDoc(lanes, prev, { hq, hqStatus })` in `src/client/office/plan.js` returns `{ doc, layout }`;
   the next call takes that result as `prev`. The parts:
   - `layout.js`: the lane tree to rooms, seats, walls, doors and stages. It is `src/client/world/plan.js`'s
     layout, moved unchanged. The old `plan.js` now imports it and keeps only what dies with the old renderer: the
     sub-tile desk places, the cutaway and its rebuild diff. The layout moved instead of being called in place
     because `src/client/world/` is deleted at step 4, and the generator must not depend on a folder that goes.
     Moving it now also gives one copy of the rules while both worlds run.
   - `furnish.js`: each room's furniture in the room's own frame (back wall north), turned onto the lot. Four
     seats per team room, two facing pairs either side of an aisle. A seat is a 2×1 desk, a chair and the tile
     at the island's outer end where its worker stands.
   - `acts.js`: the act per status, one row each. Working types at the desk; waiting on CI leans back there; a
     question for the owner stands up beside the desk and waves; done and parked go to the break area (the hall
     at the studio stage), to a spot picked by the lane's name, so a worker keeps its spot.
   - `placeholder/`: a pack of plain blocks with each piece's footprint and height. Step 3 replaced it with
     `japandi/` and deleted it.

   Ids: `desk:<lane>`, `chair:<lane>`, `lane:<lane>`, and `<piece>:<room>` for the rest. A lane that leaves keeps
   its desk and chair, empty, until another lane takes that seat. A worker spawns on the tile beside its desk.
   The lot is the layout's bounds plus 2 tiles of ground, so its origin moves only when the stage changes.
   `test/client/office-plan.test.ts` checks 1, 4, 5, 12 and 24 lanes, loose and in uneven teams (24 in teams is a
   campus), and a run of lanes that come and go across every stage. On each step the diff touches exactly the
   objects whose seat or room moved, the workers that joined or left, and the walls only when a room changed.
   A lane joining a room with a free desk is 2 objects, 1 worker and 1 act; a status change is 1 act.
   The generator found a layout bug: a campus's second column of wings had no door. Each column's hall now ends
   in a front door. One engine change came with it: the coplanar lint skips faces whose boxes are apart (the package's
   `CHANGELOG.md`, Unreleased), which made the 24-view lint of a 24-desk office 3 s instead of 16 s.
3. **The Japandi pack**: `furniture.js` and `look.js` reshaped into one `defineObject` file per piece, with a
   `{ light, dark }` palette, checked with `check.ts`.

   **Done.** The pack is `src/client/office/japandi/` (app content, outside the package), ids `japandi/<piece>`:
   desk, chair, sofa, tea table, kitchenette, bookshelf, sideboard, washi and ceramic pendants, floor lamp, fig,
   snake plant, monstera, a floor vase with branches, linen and boro rugs, a tatami lounge, a shoji screen, a tea
   corner with a scroll, the HQ workbench, a noren doorway, a steel window, oak, stone and terrazzo floors, charcoal
   cladding, and plaster with the wall band. Colours are in `look/palette.js`, the same materials by night with warmer
   light. The generator uses only this pack. The old renderer's geometry was copied as ideas, not imported.
   - The wall band needed one engine change: a wall finish may carry `bands` (`[{ to, color, pattern? }]` from the
     floor up), and a `battens` pattern. The plaster has a smoked skirting, oak battens and a smoked rail at the
     window sills (0.8 m). A cut wall shows the skirting and battens. See the package's `CHANGELOG.md`.
   - Rugs and pendants do not block (`blocks: false`), so they lie under desks and hang over them. Every rug piece
     leaves out its bottom face: it would share the floor plane with a desk leg's. A washi pendant has a 2×2
     footprint so its shade hangs over the middle of a facing pair of desks; a ceramic one is 2×1, over one desk.
   - Pieces in a corner keep within 0.92 m of their centre: a wall's face is 0.075 m inside the tile, and the tatami
     dais stops under a cut wall's top (0.41 m) so the two never share a plane.
   - Furniture changes reachability. In a team room the chairs close rows 1 and 4, so the back row and the east
     column stay clear. A break area's idle spots are now only the tiles reachable from a way into it.
   - The lab: `bun packages/world/tools/serve.ts`, then
     `/?world=/src/client/office/lab/office-12.world.js` (`&lanes=N`, `&status=S`). Shots are
     `docs/screens/office-engine-*.jpg`.
   - Cost: a 12-lane lot is about 2,200 primitives, 450 draw calls and 75k triangles. The bands make a wall four
     boxes instead of one, which makes the coplanar lint about a third slower. Step 5 brought the draw calls down
     (below).
   - The polish pass, against the old renderer's shots. Engine: a pack's `overrides` and a doc's `palette`
     recolour the engine's own tokens (the pack makes the wall tops smoked oak and the ground moss); lamps are warm
     downlights and night keeps less fill, so rooms pool under their lamps; a piece tagged `wall` hides while its
     wall is cut (`hangsOnCut`). Pack: the lit つくる sign, a clock, a corkboard, two prints and radiators, the long
     dining table, a bike, a dog in its bed, a record player and a lounge chair; plants with leaf clusters; a rug
     that shows on oak; cords that read. Each team room varies by index: a corkboard or a print between the windows,
     a clock and a print on the side walls, and a signature (the bike, the dog or the reading chair). Halls get a
     paper pendant every four tiles. Lights reach through walls (no point shadows), so a lamp by an outer wall
     warms the ground outside.
4. **The app adapter, behind a setting.** `src/client/office/adapter.js` keeps today's `api.js` contract on
   `world.anchor`, `project`, `attach` and `on`: the desk HUD chips, the subagent balls, picking and hover mapped
   back to lanes. On each state change it calls the generator and `world.apply(doc)`, which does nothing when the
   doc did not change. Lane state goes into components (a `lane` component on each worker) and the app's own
   systems (status, balls) go through `createWorld(..., { systems })`. The walk to the lead's desk is an optional
   setting: when it is on, the generator adds `{ do: "visit", target: leadDesk, wait, then: { do: "sit", target:
   ownChair, clip: "type" } }`. The setting chooses between this and today's world; the old world stays until the new
   one is the default. The small shared changes from 2.5 (`page.ts` watches `packages/`) land here, as their own
   commit.
5. **Instancing, measured.** Seed an office of 12 or more lanes and measure draw calls and frame time while panning
   and walking. Add `InstancedMesh` for `instance: true` objects only if the numbers ask for it, and report the
   before and after. Per-room light at night belongs here too.

   **Done.** `createWorld` draws the objects of a type with two or more copies as one `InstancedMesh` per material, an
   instance per object (the pure plan is `packages/world/src/view/batches.js`, tested in `test/batches.test.ts`);
   `instance: false` opts out. Every object keeps an anchor group, so pick, hover and attach still work: a pick on an
   instance names its object, hover lifts the object out of its batch and highlights its own copy, and an edit redraws
   only the types of the objects it touched. A character is one `SkinnedMesh` bound to the rig's bones, not a mesh per
   joint. At 12 lanes the draw calls with a shadow redraw went from 497 to 83 (without: 249 to 42), and at 24 lanes from
   861 to 107 (431 to 54). The triangles are the same before and after (12 lanes: 83k with a shadow redraw, 42k
   without). The lint is faster too: the coplanar lint sweeps each plane's runs along one axis, and `lintViews` lints
   every distinct primitive of all views once. `test/client/office-plan.test.ts` went from 33 s (14 s CPU) to about 5 s
   CPU, one 24-lane lint from about 0.6 s to 0.2 s, and its 24 views from about 6 s to under 1 s. Per-room light at night
   came with the polish pass (step 3): each lamp is its own warm downlight, outside the batches. A batched piece on a
   cut wall hides the way a hovered one does: its instance shrinks to nothing, and hover never shows it.
6. **The outside generator, last.** The city around the office becomes an app-side generator that adds ground
   objects around the lot, or a separate pack when a second world wants it.

   **Done.** How the engine shows land had three candidates. (a) Ground objects in the doc, as this step first said:
   the town is about 18,000 pieces and 350 movers, so every doc would carry them, `validateWorld`, nav and the
   coplanar lint would walk them, and an office that grows a room would diff the whole town. (b) A section of the
   world format with its own schema: the same size problem, and a format change for content the sim never touches.
   (c) **Scenery, chosen**: data the engine draws round the lot and never walks, picks or lints with it, passed as
   `createWorld(canvas, world, { scenery })`, a world's `scenery` field or `view.setScenery(s)`. It is pieces (objects
   of a new kind `"scenery"`: no footprint, parts up to 40 m, placed freely, each a type, `at`, `ry`, scale, tint and
   params), height fields, ribbons, movers on closed loops, a fade box and a `shade` box for the sun's shadows. The
   engine knows nothing of rivers or canals: the app's pure generator decides what goes where, and the `land` pack
   (`src/client/office/outside/land/`, app content like the Japandi pack) says what each piece looks like. Pieces of
   one type and params are one instanced mesh per material, and so are the movers of a type; ribbons of a finish are
   one mesh. `checkScenery` names each mistake with its path and a fix.
   - The generator moved, unchanged, to `src/client/office/outside/` (`gen.js`, `city.js`); the old renderer imports
     it from there and `test/client/outside.test.ts` still passes. `scenery.js` turns its layout into scenery in the
     lot's frame (the generator's ground was y = -0.12, the lot's is 0), centred on the front door as before.
     `garden.js` lays the old garden with land pieces. The lab: `&outside=nature|city|off&seed=S` on any lab office,
     and `office-12-nature.world.js`, `office-12-city.world.js`. While the land shows, the doc's palette gives the
     lot's ground the lawn's colour (`LAWN`), so lot, garden and meadow read as one lawn.
   - Frame policy: movers are ambient motion, like a clip looping in place. They draw at `idleFps` and never redraw
     the shadow map (they cast none). The scenery's clock runs only while `idleFps` is above 0, so in a power saver
     (`idleFps` 0) the town holds still instead of jumping ahead when something else draws; `view.setIdleFps(fps)`
     changes it live (the old page: smooth 30, balanced 15, saver 0). Movers follow their loops at a steady speed:
     cars no longer wait at junctions or zebras, and walkers' legs no longer swing.
   - The lamp leak: lamps are spot lights without shadows, so they lit the ground outside through the outer walls.
     Everything outdoors (the lot's ground, the land, all scenery) now leaves spot lights out of its lighting. Street
     lamps light the town with the new `light` finish instead: a soft additive pool, black (nothing) by day and warm by
     night through its token.
   - Cost, `proof.ts --only perf` at 12 lanes (limits 220 calls and 450k triangles with a shadow redraw): the town
     181 calls and 362k triangles (without a shadow redraw 112 and 302k), the valley 159 and 318k (90 and 258k);
     the office alone is 109 and 112k. A town has about 7,400 windows, so a pane and its frame draw only their
     fronts. Tested in `test/client/office-outside.test.ts` and the package's `test/scenery.test.ts`.

The page switches for good only when step 4's world is the default, and that change deletes
`src/client/world/{camera,scene,rooms,kit,walk}.js` and `plan.js`'s `wallCuts` and `cameraSide`. Golden numbers in
CI (the pan residual, the camera height, renders while still) come from `proof.ts` and can be added at any step.
