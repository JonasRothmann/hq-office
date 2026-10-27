# Changelog

All notable changes to `@hq/world`'s public API (the names in `api.txt` and the world format).

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
