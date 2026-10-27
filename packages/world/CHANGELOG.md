# Changelog

All notable changes to `@hq/world`'s public API (the names in `api.txt` and the world format).

## [Unreleased]

### Added

- A wall finish may declare `bands`: `[{ to, color, pattern? }]` from the floor up, for a skirting, battens or a
  rail under the plaster. `to` is metres above the floor top, each higher than the last and below `WALL_H`. Above
  the last band the finish's own colour and pattern show. `buildArchitecture` cuts each wall piece and post at the
  band heights of either side, so a stretch's face shows the band on its side; the faces between stretches are
  left out and the cap stays on top. A cut wall shows the bands under `KERB_H`. This is new in the world format;
  `api.txt` did not change.
- The pattern `battens`: upright timber battens about 4 cm wide with dark gaps.
- `checkPack` names a bad band (`finish.bands`: not a list, not ascending, out of range, no colour, or on a floor
  finish), an unknown band colour (`color.token`) and an unknown band pattern (`finish.pattern`).
- A primitive may carry `base`, the height its foot darkening counts from. The stretches of a cut wall carry the
  wall's foot, so the darkening does not start again at each band.
- `lintViews(lot, catalog, cuts)`: the coplanar lint of a lot in many views (cut sets), one pair list per cut,
  each equal to `lintCoplanar(lotPrims(lot, catalog, cut))`. It lints every distinct primitive of all the views
  once and lints a view again on its own only when it holds both parts of a clash. `check.ts` uses it: the 24
  views of a 24-lane office take under 1 s instead of about 6 s (measured on a loaded machine).

### Changed

- `createWorld` draws the objects of a type with two or more copies as one batch: an `InstancedMesh` per material,
  an instance per object. `instance: false` on a definition opts out; `instance: true` is now the default. Each
  object keeps an anchor group (`object:<id>`) for `attach()`, `pick` and `hover`; a batched object's meshes are its
  batch's (`batch:<type>`), so the anchor holds only what the host attached. Hover lifts the object out of its batch
  and highlights its own copy. An edit redraws only the types of the objects it touched. A character is one
  `SkinnedMesh` per material, bound to the rig's bones, instead of a mesh per joint. A 12-lane office draws 83 calls
  with a shadow redraw instead of 497 (42 instead of 249 without), 24 lanes 107 instead of 861; the triangles are
  the same, and a shot of the office differs in 10 pixels of a million. No export changed.
- `lintCoplanar` skips two faces in one plane when their bounding boxes are apart, before it clips them. The
  findings are the same; linting a lot with many like objects (an office of 24 desks, in 24 views) takes 3 s
  instead of 16 s. No export changed, so `api.txt` did not.
- `lintCoplanar` cuts each plane's faces into runs of nearly equal offset and sweeps each run along one axis, so it
  no longer compares every face of a plane with every other; it skips two square faces that meet only at an edge
  without clipping them. The pairs and their order are the same (`lint.test.ts` compares it with the plain scan).
  One lint of a 24-lane office: about 0.2 s instead of 0.6 s.

## [0.2.1] - 2026-10-27

### Added

- `describePairs(pairs)`: one line per two parts that share a plane, however many planes. Coplanar pairs name a part
  whose name repeats with its place in build order (`'shelf' #2`).
- `analyse(world, { live, moved })`, for edits at run time. `live` names characters that already exist; `moved`
  names the objects an edit added or changed.
- `sim.act(id, act, { doc: true })`: an act from the doc. A refusal is also a `cancel` event
  `{ who, problem, act, refused: true }`. `createWorld` and the driver start doc acts this way.
- `createEcs({ onLoad })`, told after `load()`.

### Fixed

- The step that ends a motion is drawn: the camera's snapped pose after a turn, zoom, `fitBox` or `focusOn`, and a
  clip's cross-fade to its end. The anim system is busy while a cross-fade runs, and a cross-fade redraws shadows.
  A still view still draws nothing.
- An edit that lays or lifts a floor rebuilds the objects whose height moved with it (`apply`'s diff names them).
- An edit no longer checks an existing character's doc `at`, and checks its acts without a position. A generator
  may put an object on a character's spawn tile once the character has left it.
- A doc act the sim refuses at run time emits `cancel` instead of only a console line.
- A cancelled act never leaves a character inside an object: `cancel` walks it off a blocked tile. The walk off is
  not an act and emits no `act` event.
- `sim.ecs.load` checks the save against the lot: a held seat whose object or slot is gone is let go, and its holder
  stands up and steps clear (a `cancel` event).
- `attach()` redraws shadows, so an attached object casts one at once.
- An overlap error names both objects. In an edit, it names the one the edit moved, and its fix places that one.
- `check.ts`, `catalog.ts` and `shot.ts` take `.js` and `.mjs` files and refuse others with a message that names
  the extensions.

## [0.2.0] - 2026-10-27

### Added

- `world.apply(next)`: change the world while it runs. It validates the whole doc, rebuilds only what changed and
  keeps the sim running. The same doc twice is a no-op. `diffWorld(a, b)` is the diff it uses; `sim.apply` is the
  sim's half.
- `world.camera.focusOn(x, z)` and `world.camera.fitBox(box)`, eased by default; `world.roomBox(id)`;
  `focusCamera` in the rig.
- `idleFps` option: how often a clip looping in place is drawn while nothing else moves. Default 0.
- `world.invalidate()`, for a host change the engine cannot see. `inspect()` reports `size` and `stats` (renders,
  shadow redraws, frames).
- `lotMap(lot)`, the lot as ASCII, and `check.ts --map`.
- `ACTS`, the act names a world file may use. `visit` works in world files.
- Pack palettes are checked: an unknown colour token or clip is an error that names the nearest one.

### Changed (breaking)

- A pack's `palette` is `{ light: {...}, dark: {...} }`, with the same tokens in both. Tokens are the pack's own
  (`oak` in pack `cozy` is `cozy/oak`), so two packs never clash, and a pack cannot replace an engine token.
- Reservations live in the sim, as each character's `holding` component. Nav no longer has `reserve`, `release` or
  `holder`; `planAct(lot, nav, who, act, { holder })` takes a function that says who holds a slot. The `placed`
  component is gone.
- A step kind with no system cancels the act (a `cancel` event, problem `step.unknown`) instead of throwing.
- A system that throws is logged once and switched off; the loop goes on.
- The canvas's backing store is its device-pixel box. Without `devicePixelContentBoxSize`, the engine sets the
  canvas's CSS size to a whole number of device pixels.
- A still view draws nothing, and the shadow map is redrawn only when a character moved, the cut changed or an edit
  asked. Before, every frame drew while anything was in the sim.
- `freeNear` (the fix for an overlap) looks for room for the whole footprint.

## [0.1.0] - 2026-10-27

### Added

- World files (`defineWorld`, format 1), packs (`defineObject`, `definePack`, `createCatalog`, `checkPack`), validation
  with fixes (`validateWorld`, `buildLot`), room detection, grid nav with slots and acts, the Sims camera rig, the
  cutaway rule, architecture as primitives, the coplanar lint, the rig and clips.
- `createWorld` for the browser: MSAA, Neutral tone mapping, a lot-fitted and texel-snapped sun shadow with
  world-fixed filtering, time of day, characters that walk and sit, picking, hover, projection, anchors.
- The starter pack: oak, plaster, siding, door, window, desk, chair, plant, lamp.
- The sim (experimental): `createEcs` and `createSim`, which make placed objects and characters entities with
  plain-data components, run one system per step kind, and save and load their state as JSON. `createWorld` takes
  `systems` for a host's own systems and exposes `sim`.
- The `visit` act: walk to a free tile beside an object, face it, wait, then do another act. `planAct` returns the
  slot to hold as `hold`.
