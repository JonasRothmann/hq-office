# The Sims 1 look: a reference for our own 3D office

Purpose: build an original low-poly three.js office that reads as The Sims (2000) at a glance (spec §3-5, D1, D9).
No EA asset is used, copied or downloaded. FreeSO and FreeSims are MPL-2.0: we read their code for numbers and copy
none of it into this MIT repo. Values marked *inferred* are our reading of the cited code, not a stated figure.

Most numbers come from FreeSO, an open reimplementation whose engine "support[s] both TSO and TS1 game files", with
[Simitone](https://github.com/riperiperi/Simitone) restoring TS1 play on it ([FreeSO README](https://github.com/riperiperi/FreeSO)).
`WorldUnitsPerTile = 3` throughout ([WorldState.cs](https://github.com/riperiperi/FreeSO/blob/master/TSOClient/tso.world/WorldState.cs)).

## 1. Camera and projection

- Sims are 3D; the house and objects are pre-rendered and shown dimetrically ([Wikipedia](https://en.wikipedia.org/wiki/The_Sims_(video_game))).
- Orthographic. The view pitches **30°** down from horizontal and yaws to **45°, 135°, 225° or 315°**
  ([WorldCamera.cs](https://github.com/riperiperi/FreeSO/blob/master/TSOClient/tso.world/Utils/WorldCamera.cs)).
  sin 30° = 0.5, so a tile projects to an exact **2:1 diamond** (not the 26.57° pixel-art convention).
- **Three zooms**, Far/Medium/Near ([WorldZoom.cs](https://github.com/riperiperi/FreeSO/blob/master/TSOClient/tso.world/Model/WorldZoom.cs)).
  Tile diamonds: **32×16, 64×32, 128×64 px** ([WorldState.cs](https://github.com/riperiperi/FreeSO/blob/master/TSOClient/tso.world/WorldState.cs)).
  One tile edge = √(w²/2) = **22.6, 45.3, 90.5 px**; each step doubles.
- **Four rotations**, 90° apart, Shift+< / Shift+>; zoom with +/- or the wheel; Home/End cycle wall modes
  ([EA controls](https://help.ea.com/en/articles/the-sims/the-sims-legacy-collection/the-sims-legacy-controls)).

## 2. Walls

- Height **2.95 tiles**, thickness **0.15 tiles** (half-thickness 0.075 each side of the tile edge); floors stack
  every 2.95 tiles ([WallComponentRC.cs](https://github.com/riperiperi/FreeSO/blob/master/TSOClient/tso.world/RC/WallComponentRC.cs)).
  At Near zoom a full wall is 2.95 × 90.5 × cos 30° ≈ **231 px** tall.
- Three modes: no walls, cutaway, full walls ([Wikipedia, cutaway drawing](https://en.wikipedia.org/wiki/Cutaway_drawing)).
  Walls down cuts every tile; walls up cuts none ([UILotControl.cs](https://github.com/riperiperi/FreeSO/blob/master/TSOClient/tso.client/UI/Panels/UILotControl.cs)).
- A cut wall drops to **12 % of full height** (≈ 0.35 tiles) ([WallComponentRC.cs](https://github.com/riperiperi/FreeSO/blob/master/TSOClient/tso.world/RC/WallComponentRC.cs)).
- Cutaway rule: a wall tile is cut when a "cut room" lies within 4-5 tiles of it along the camera's view direction,
  so only walls between the camera and the room drop ([VMArchitectureTools.cs](https://github.com/riperiperi/FreeSO/blob/master/TSOClient/tso.simantics/Utils/VMArchitectureTools.cs),
  `GenerateRoomCut`). Cut rooms are the last 3 indoor rooms under the cursor, plus a 5×5-tile box around it shifted
  2 tiles toward the camera; on touch screens Simitone cuts every indoor room on the floor
  ([Simitone UILotControl.cs](https://github.com/riperiperi/Simitone/blob/master/Client/Simitone/Simitone.Client/UI/Panels/UILotControl.cs)).
  At the edge of a cut a wall stays up, and a wall cut on one side only uses a transition piece, down at one end and up at the other
  ([WallComponent.cs](https://github.com/riperiperi/FreeSO/blob/master/TSOClient/tso.world/Components/WallComponent.cs)).
- Caps: the wall top is a flat strip in **#97784C** (151, 120, 76). Faces on one axis are drawn at **0.85**
  brightness, the other at 1.0, so the two wall directions always differ in tone ([WallComponentRC.cs](https://github.com/riperiperi/FreeSO/blob/master/TSOClient/tso.world/RC/WallComponentRC.cs)).
- Doors and windows are wall objects: where a cut wall has a door, the wall segment is not drawn
  ([WallComponent.cs](https://github.com/riperiperi/FreeSO/blob/master/TSOClient/tso.world/Components/WallComponent.cs)).

## 3. Proportions

- No official metric. A community estimate puts a tile at 2-3 ft, about 1 yard, for later games
  ([ModTheSims](https://modthesims.info/t/613930)). **We set 1 tile = 1 m.**
- Person: FreeSO picks a Sim with a box ±2 world units around the pelvis
  ([WorldPlatform3D.cs](https://github.com/riperiperi/FreeSO/blob/master/TSOClient/tso.world/Platform/WorldPlatform3D.cs)),
  so an adult is *inferred* at about **4 units = 1.33 tiles**, roughly **0.45 of wall height**. Tall walls next to
  small people are part of the read.
- Furniture is not specified in metres (it is pre-rendered sprites). Scale real ratios to the person: desk 0.42 ×
  height, seat 0.26 ×, counter 0.51 × (*our estimate*). Footprints snap to whole tiles; diagonal walls block both
  halves of a tile ([Wikipedia](https://en.wikipedia.org/wiki/The_Sims_(video_game))).

## 4. How it was drawn, and what to mimic

- Objects: 8-bit paletted sprites with optional **z-buffer** and **alpha** channels
  ([SPR2.cs](https://github.com/riperiperi/FreeSO/blob/master/TSOClient/tso.files/Formats/IFF/Chunks/SPR2.cs)).
  A draw group has **12 entries: 4 rotations × 3 zooms**. Front and back sprites are mirrored for two of the
  rotations ([woobsha tutorial](https://woobsha.com/diy-litobj02PC.htm)).
- People: SKN meshes split into body parts, with heads separate from bodies. Skins are **256-colour BMPs at 256², 128²
  or 64²** ([simfreaks](https://simfreaks.com/jerome/guides/uk_guide2.htm)). We found no published triangle count.
  *Our estimate* is a few hundred per body, and faces and clothes live in the texture.
- People are lit flat by their room's light colour, with no directional term in the default path
  ([AvatarComponent.cs](https://github.com/riperiperi/FreeSO/blob/master/TSOClient/tso.world/Components/AvatarComponent.cs)).
  FreeSO adds small floor shadow quads under two skeleton bones, one per light
  ([Avatar.cs](https://github.com/riperiperi/FreeSO/blob/master/TSOClient/tso.vitaboy.engine/Avatar.cs)).
- The floor grid is drawn only in build mode ([TerrainComponent.cs](https://github.com/riperiperi/FreeSO/blob/master/TSOClient/tso.world/Components/TerrainComponent.cs)).
  In live mode only the tile pattern shows.
- Mimic cheaply: an `OrthographicCamera` at the angles above. Flat-shaded Lambert or Standard materials
  (roughness 1, metalness 0). Bake the wall-axis tint (1.0 / 0.85) into the material colour. Use vertex-colour AO
  darkening at wall bases and under furniture, and a soft blob decal under each worker instead of real-time person
  shadows. Textures ≤ 256 px with linear filtering: crisp, not pixelated. No outlines: pre-rendered
  sprites have none.

## 5. Palette and light

- Lighting is per room: each room carries `OutsideLight` (window light) and `AmbientLight` (lamps)
  ([RoomLighting.cs](https://github.com/riperiperi/FreeSO/blob/master/TSOClient/tso.world/Model/RoomLighting.cs)).
  A room without lamps goes dark at night while its neighbour glows.
- Outside light by time of day ([TimeOfDayConfig.cs](https://github.com/riperiperi/FreeSO/blob/master/TSOClient/tso.common/Rendering/TimeOfDayConfig.cs)):
  day **#FFFFFF**, sunrise and sunset **#D96D32**, dusk **#575757**, night **#3E5898** (50, 70, 122 × 1.25),
  each converted to linear with gamma 2.2.
- The floor and wall colours of the original are content, not engine values. Use the spec's palette tokens, but
  darken `wall-cap` toward #97784C for contrast with the wall face.

## 6. Motifs to avoid (stay original, D1)

- The **plumbob**: a floating diamond over the head, green, white or red for mood and blue for grouped Sims, and a
  key element of the logo ([SnootySims](https://snootysims.com/wiki/trivia-time-amazing-plumbob-facts-from-start-to-sims-4/)).
  Our waiting marker must not be a floating diamond or octahedron in any colour.
- The **pie menu** (radial interaction menu) and the bottom-left **control panel** (UCP) with portraits, mood and
  needs ([UIPieMenu.cs](https://github.com/riperiperi/FreeSO/blob/master/TSOClient/tso.client/UI/Panels/UIPieMenu.cs),
  [UIUCP.cs](https://github.com/riperiperi/FreeSO/blob/master/TSOClient/tso.client/UI/Panels/UIUCP.cs)).
- The Live / Build / Buy mode trio and their buttons ([EA controls](https://help.ea.com/en/articles/the-sims/the-sims-legacy-collection/the-sims-legacy-controls)).
- The logo, the UI fonts, Simoleons and the § sign, Simlish, thought balloons with icons, and the names "Sim" and
  "Maxis" in our UI.

## 7. FreeSims

- An "open source engine used for The Sims", under **MPL-2.0** ([LICENSE.md](https://github.com/francot514/FreeSims/blob/master/LICENSE.md)).
  It "still requires the game files": the Complete or Legacy Collection installed in the default path
  ([README](https://github.com/francot514/FreeSims)).
- Its tree holds a few content files (`SimsVille/Content/Objects/npcs.far`, `nhood.BMP`) of unstated origin. Do not
  fetch them. FreeSO itself "does not contain any copyrighted material" and loads the original files
  ([FreeSO README](https://github.com/riperiperi/FreeSO)).
- MPL-2.0 is file-level copyleft: we take numbers, never code.

## Build to these numbers

| Item | Value |
| --- | --- |
| Projection | `OrthographicCamera`, pitch **30°** (replaces the spec's ~35°), yaw 45° + n·90° |
| Zoom (px per metre) | far 22.6, medium 45.3, near 90.5; continuous between, snap targets at these three |
| Ortho frustum | height = canvas px ÷ px-per-metre: at 1080 px, **47.7 / 23.9 / 11.9 m** |
| Unit | 1 m = 1 tile |
| Wall full height | **2.95 m**, thickness **0.15 m** |
| Wall cutaway height | **0.35 m** (12 %); near-side walls of every office cut, back walls full |
| Wall cap | flat top strip, day #97784C |
| Wall face tint | x-axis faces × 1.0, z-axis faces × 0.85 |
| Office cell | 5 × 4 m (5 × 4 tiles); HQ suite 7 × 5 m |
| Person (standing) | **1.35 m** (0.45 of wall); scale people and furniture together, never walls |
| Desk / seat / counter | **0.57 / 0.35 / 0.69 m** |
| Light, day | hemisphere sky #FFF6E8, ground #B9A58A, ≈ 70 % of total; warm key #FFF1DC, soft 1024 px shadow map |
| Light, dusk | key tinted toward #D96D32 |
| Light, night | ambient #3E5898 at ≈ 15 %; warm point lights (#FFCF8A, range ≈ 3 m) per lamp, per office |
| Material | `MeshLambertMaterial` (or Standard, roughness 1, metalness 0), `flatShading`, textures ≤ 256 px |

## What makes it read as Sims 1 (ranked)

1. A fixed orthographic 30° view at 45°, 2:1 tile diamonds, 90° rotation steps and three zoom steps.
2. Cutaway: back walls full height, near walls cut to a low stub with a dark cap.
3. Tall walls next to small people (wall ≈ 2.2 × person).
4. Even, soft interior light: the two wall directions differ in tone, people are lit flat, and there are no hard
   shadows.
5. Chunky furniture snapped to a 1 m tile grid, in four facings.
6. Per-room light at night: lit offices glow amid blue-dark ones.
7. A warm white day, an orange dusk and a blue night.
8. Low-poly people with painted textures, with detail in the texture and not in the geometry.
