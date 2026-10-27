# Changelog

All notable changes to `@hq/world`'s public API (the names in `api.txt` and the world format).

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
