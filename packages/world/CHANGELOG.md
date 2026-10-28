# Changelog

All notable changes to `@hq/world`'s public API (the names in `api.txt` and the world format).

## [Unreleased]

### Changed (breaking: the next release is 0.3.0)

- Zoom has 15 stops instead of three. `ZOOMS` is a geometric ladder from 11.3 to 128 px per metre (16·2^(k/4) for
  k = -2..12, rounded to 0.1), each stop about 2^(1/4) (19 %) closer than the last, and `cam.zoom` (and
  `camera.state.zoom`, `inspect().zoom`, the `zoom` option of `createWorld` and the driver) is an index into it. The
  two stops below 16 let a wide lot fit beside a host's panel. The old three steps are stops 4, 8 and 12, at the same
  px per metre. The new export `ZOOM_STOPS` names them: `{ far: 4, mid: 8, near: 12 }`; use the names, not the
  numbers. A caller that passed 0, 1 or 2 passes `ZOOM_STOPS.far`, `.mid` or `.near`. The default zoom of
  `createCamera` is `mid`. When no stop fits, `fitCamera` and `camera.fitBox` take the furthest stop, now 11.3 px/m.
- `fitCamera` and `camera.fitBox` pick the closest stop of the whole ladder that fits at every rotation, so fits are
  tighter.
- `zoomCamera(cam, step, at)` and `camera.zoom(step, at)` take an optional viewport point in CSS px: the ground
  point under it stays under it through the zoom, and the focus is clamped to the bounds as a pan's is. Without
  `at` the zoom centres on the focus, as before. A zoom mid-zoom retargets from the scale it has reached; a turn
  mid-zoom keeps its target stop and the focus it ends on. A zoom to the stop it already has does nothing.
- `bindInput` zooms toward the cursor. Wheel deltas add up, and each 100 px (about one mouse notch) is one stop; a
  pinch (a wheel event with `ctrlKey`) takes one stop per 17.3, so it keeps up with the fingers. One event moves at
  most one stop. The 220 ms throttle is gone.
- The lab takes `?zoom=far|mid|near` or an index, and `+`, `=` and `-` zoom by one stop. `shot.ts --zoom` takes the
  same.

### Added

- Scenery (experimental): the land round a lot, as data. `createWorld(canvas, world, { scenery })` (or a world that
  carries `scenery`) and `view.setScenery(s)` draw it; it is never walked, picked or linted with the lot. A scenery
  has `pieces` (`{ type, at: [x, y, z], ry, s, tint, params, shadow }`: objects of the new kind `"scenery"`, placed
  freely, drawn as one instanced mesh per type, params and material, a `tint` token or hex multiplying each copy),
  `fields` (height fields with a colour and tone per vertex and a `hole` for the lot), `strips` (ribbons such as
  paths and rivers; outdoor `glass` is water; all the ribbons of a finish are one mesh), `movers` (copies of a piece
  going round a closed loop at a speed; the movers of a type and params share one instanced mesh per material),
  `fade` (everything outdoors fades into the background between `from` and `to` metres outside a box), `shade` (the
  ground the sun's shadows cover besides the lot) and `ground` (the scenery draws the land, so the engine leaves out
  its own). `checkScenery(scenery, catalog)` names each mistake with its path and a fix; `createWorld` and
  `setScenery` throw a `WorldError` on one. `planScenery` and `moverPlaces(mover, t)` are the pure plan and where
  each mover is at a time. New in `api.txt`: `checkScenery`, `planScenery`, `moverPlaces`.
- `bob` on a scenery mover: the mover rises and falls by `h` over `period`, and `roll` (about its length) and `pitch`
  (about its width) take slower periods of their own, so a boat can bob at its mooring. Every field is optional:
  `{ h, roll, pitch, period, phase }`, with defaults of 0.035 m, 0.03 rad, 0.012 rad, 5.7 s and 0 s. Each copy after
  the first runs 1.7 s further ahead. At speed 0 the copies stay where `at` puts them, facing along the route (a
  two-point route gives a boat its heading). `moverPlaces` returns `[x, y, z, ry, roll, pitch]` for a mover that
  bobs, and `[x, y, z, ry]` otherwise. `checkScenery` names a bad `bob` with the code `scenery.bob`. No new exports.
- `k.light(part, size, at, color)` and the finish `"light"`: a soft pool of light on the ground. It is unlit and
  added to what lies under it, brightest at its object's origin and gone 0.5 m from it (scale the object to size the
  pool), and casts and takes no shadow. Black adds nothing, so a token that is black by day shows only by night.
- `defineObject({ kind: "scenery" })`: a piece of scenery. It has no footprint, slots or anchors, and its parts may
  be up to 40 m (a house) instead of 6. `checkPack` checks its colours, sizes and coplanar parts. Placed on the lot,
  it is refused with a fix that says where it goes.
- Moving scenery is ambient motion, like a clip looping in place: it draws at `idleFps` and never redraws the
  shadow map (movers cast no shadows). Its clock runs only while `idleFps` is above 0, so at 0 the land holds still
  (a power saver) instead of jumping ahead when something else draws. `view.setIdleFps(fps)` changes the rate while
  the view runs. `inspect()` reports `scenery: { pieces, batches, movers, time }`.
- `createWorld` takes `pickable(id)`: a hit on an object or character it refuses is skipped, and `pick` returns what
  is behind it, so a piece in front of a character no longer swallows the click. Default: everything is pickable.

### Fixed

- Lamps no longer light the ground outside through the walls. A lamp is a spot light with no shadow, so it lit
  everything in its cone. Outdoor surfaces (the lot's ground, the land round it and all scenery) now use outdoor
  materials that leave spot lights out. A primitive marked `outdoor: true` takes them; the lamps light only indoors.

- The engine's own colours can be recoloured. `definePack({ overrides: { light, dark } })` names engine tokens (the
  wall caps `cap`, the ground `ground` and `ground-dark`, the slab's sides `foundation`, the background `bg`, or any
  other in `PALETTES`) for every world that uses the pack; a later pack wins. A world doc's optional `palette`
  (`{ light, dark }`) recolours any token, the engine's or a pack's (`"<pack>/<token>"`), over the packs. `checkPack`
  names a bad `overrides` map (`pack.overrides`: not split by theme, a token in one theme only, not hex, not an
  engine token, or the pack's own token) and `validateWorld` a bad doc palette (`world.palette`). `createCatalog`
  takes `{ palette }` as a second argument. `diffWorld` reports `palette: true` when only the doc's colours changed,
  and `apply` recolours everything. A doc without a palette is unchanged, and `api.txt` did not change.
- `hangsOnCut(object, cut)`: whether a placed object tagged `wall` (a clock, a print, a radiator) hangs on a wall
  that is cut. Such an object hangs on the wall behind it, on the side opposite its facing. `createWorld` hides it
  while that wall is cut, so nothing floats over a kerb, and a pick passes through it. A batched one shrinks its
  instance to nothing, the way hover does, and hover never brings it back while the wall is cut.
- Lamps light by night as warm downlights: each light anchor is a soft cone aimed straight down, so it makes a pool
  under the lamp and does not burn a white patch on the wall beside a lamp in a corner. Night keeps less of the
  day's fill (ambient and sky), so rooms are darker away from their lamps. The lamp's colour is the `lamp` token.
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
- Insets for a host whose panels cover part of the canvas: `createWorld(..., { insets: { left, top, right, bottom } })`
  and `view.camera.setInsets(insets)`, in CSS px. The view centres in the free part and `fit()` picks the zoom that
  fits there. `setInsets` never refits on its own. `createCamera` takes `insets` too, and the camera state carries
  them. The names in `api.txt` did not change.
- `view.pause(on)`: while paused nothing steps (camera, characters, host systems) and nothing draws; resuming draws
  once. `inspect().paused` says which. For a view the host has covered, such as a sheet over it on a phone.
- `view.addLamp(at, opts?)`: a lamp of the host's, at `at` ([x, y, z] in world space). It is lit like a light
  anchor's: a spot light aimed straight down, with no shadow, its intensity times the night factor (dark by day, lit
  by night), and outdoor surfaces leave it out. `opts` is `{ color, intensity, reach, angle, penumbra, decay }`; the
  defaults are the engine's lamp (intensity 4.2, reach 6 m), and without a `color` it takes the palette's `lamp` and
  follows it through `setTheme` and `setTime`. It returns `{ set({ intensity?, color? }), remove() }`; both request a
  frame, and `color: null` follows the palette again. The lamp stays through `apply`, `setTheme`, `setTime` and
  `setScenery`, and `dispose` removes it. Adding or removing a light makes three.js recompile its shaders, so keep a
  lamp and set its intensity to 0 rather than remove it and add it again. `addLamp` is a method of the view, so
  `api.txt` did not change.
- `createWorld(canvas, world, { hoverTarget })`: `hoverTarget(hit)` maps what the pointer is over (what `pick`
  returns, or null) to the id of the object whose highlight shows, or null for none. The default is the object hit
  (`hit?.kind === "object" ? hit.id : null`), as before. `view.hover` still returns and emits the raw pick; only the
  highlight changes. An id that is not an object's (unknown, or a character's) highlights nothing.

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
