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
