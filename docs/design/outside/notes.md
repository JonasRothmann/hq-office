# The land around the office

Two seeded surroundings for the 3D office: a valley (`nature`) and a town (`city`). They frame the office and
never reach into its lot. Code: `src/client/office/outside/` (`gen.js` and `city.js` generate it, `scenery.js` and
the land pack in `land/` draw it on the engine). Tests: `test/client/outside.test.ts`.

These notes were written for the first office's renderer, since removed. Its half that drew the land (`build.js`,
`city-build.js`, `movers.js`, `palette.js`, `outside.js` below), the lab that measured it and the script that took the
JPEGs in this folder went with it; the JPEGs stay as a record. `bun scripts/office-shots.ts` shoots the land on the
real page today (`docs/screens/office-wide-*.jpg` and `office-city-*.jpg`).

## How it works

`gen.js` is pure, with no three.js. `generate({ mode, seed, lot })` returns plain data. The seed (a number or any
string) feeds a mulberry32 generator and a small value-noise fbm, so the same input always gives the same layout.

- **The lot is a hole.** The lot is the building's bounds plus the garden that other lanes draw. Nothing is placed
  inside it, and the terrain grid has lines on its edges, so the build cuts a clean hole. Everything stays above
  y = -0.115, so the office's own ground plane (y = -0.12, 60 m past the bounds) never covers a river or a road.
- **The sight rule.** At 30°, a thing h metres tall hides about 1.75·h of ground behind it. A tree, hill or
  building d metres from the lot is at most `sight(d) = (d + 3) / 1.75` tall, so nothing outside ever hides the
  building, at any of the four turns.
- **The extent.** The layout covers the lot plus 64 m on every side. Every material mixes toward the background
  between 34 and 60 m from the lot (`uFade`). The land has no hard edge, and a 60 × 40 m campus at its fitted far
  zoom just reaches the haze in the corners.
- **Nature.** A Catmull-Rom river bends round one corner of the lot (the corner is chosen by the seed). It meanders
  and is pushed to stay at least 7 m plus its banks from the lot. A path leaves the middle of the door side
  (`lot.door`, default `"s"`). Where it meets the river, an arched footbridge spans the water. A pond is added
  sometimes. The terrain is a 2 m grid: a plateau at the lot's level, rising over 7 m to fbm hills that grow with
  distance and flatten into a valley along the water. The build bakes the key light's slope shading and a soft shade
  under each tree into the vertex colours. Trees are a jittered grid that thickens away from the clearing, in six
  kinds (conifer, birch, maple, red maple, shrub). Rocks lie by the water and on hilltops, flowers in the meadow
  noise, reeds on the banks, and tufts in drifts.
- **City (Copenhagen-ish, `city.js`; the cues and their sources are in `copenhagen.md`).** Road centre lines ring
  the lot's block, so the lot is exactly one block's interior. Blocks of 18–30 m are added outward. Every street is a
  6 m carriageway, a 1.8 m bike track a kerb above it on each side, and a 2.6 m pavement a kerb above that. On every
  arm of every junction the track carries on as a blue band and the zebra lies in line with the pavement; car stop
  lines stand behind both. Some streets are setts, the rest asphalt with centre dashes. A built block is a perimeter
  block: a continuous row of painted houses (3 to 6 storeys where the sight rule lets them rise, neighbours never the
  same colour, about a third red brick) along every street, round a courtyard of trees. Roofs are slate or tile
  gables along the street, mansards, now and then flat; some carry dormers, chimneys, a wall dormer with its own
  gable, or at a corner a stepped gable or a turret under a copper cap. A third of the ground floors are shops, many
  under awnings. One block by the lot is often a square (setts, a fountain or a statue, trees in rows, benches, café
  tables), a few further out are parks, and one building out where it may rise has a copper mansard and a tower with
  a copper spire.
- **The canal.** The first block out on one side (chosen by the seed) is the canal block, one long block with no
  cross streets: a narrow quay, 11 m of water, a wide quay with café tables under parasols, a row of narrow canal
  houses with their gables (often stepped) to the water, and a strip of yard. The quays are an embankment 0.47 m
  above the pavement; the water stays above the office's ground plane. Footbridges carry the two streets either side
  of the lot over the water. Up to 8 boats (a two-masted wooden ship, small sailboats, open motor boats) are moored
  along the quays and bob. Bollards line the quay edges, with a lamp post every third.
- **Lamps** hang from wires across the street, house to house, or from a slim mast at the kerb where one side has
  no house. The canal's street, with no houses on either side, is lit from the posts on the quays.
- **Movers.** Each car drives a loop round a rectangle of blocks in the right-hand lane, turning at the junctions
  (a clockwise loop is on the inside). One or two yellow buses run a wider loop. No loop crosses the canal. Cyclists
  (more of them than cars, some on box-front cargo bikes) ride the bike tracks round rectangles of blocks: a
  clockwise loop rides the inside and turns right on the track; an anticlockwise loop rides the outside and turns left
  in two steps across the blue bands. Each person walks the middle of the pavement round one or two blocks and
  crosses on the zebras, or along the far quay, or over the two footbridges. Bikes lean in rows against the houses. At
  run time (`movers.js`), vehicles slow for corners, follow at a distance by their length, give way at a junction
  (the lower number goes first when two wait on each other; nothing waits longer than 5 s) and stop for anyone on a
  zebra or a blue band in front of them. Walkers and riders follow the ground's height: road, track, pavement, quay
  and the arch of a bridge.

`build.js` turns a layout into meshes (the town through `city-build.js`). The terrain or the streets is one
vertex-coloured mesh; the town's streets, quays, bridges and street things share it, and its "ground" material draws
setts and granite slabs from world position, fading the joints out where they would be smaller than a pixel. Every repeated
thing is an InstancedMesh. Water is a ribbon with a drifting sheen. Night uses `palette.js`'s moonlit set: unlit
glowing windows (about 60 % lit), lamp heads and pools of light, and car lights. `outside.js` mounts it, owns the
scene background while mounted (the fade colour must be the colour behind it), and cross-fades (380 ms down, rebuild,
380 ms up) on a change of mode, seed or lot.

`growLot(lot, prev)` decides when the lot needs new land. It rounds the lot out to 4 m with 0.5 m to spare, and keeps
the previous land while the office's lot fits in it with no side more than 18 m too big. A side the office grew past
gets 10 m of headroom, so offices added one at a time regenerate the land every second or third office.

## Cost (outside only, measured in the lab with the stand-in hidden)

| | Draw calls | Triangles |
| --- | --- | --- |
| Nature, 24 × 14 m building | 12 | 99k |
| Nature, 60 × 40 m campus | 12 | 108k |
| City, 24 × 14 m building, day / night | 28 / 30 | 127k to 135k |
| City, 60 × 40 m campus, day | 27 | 147k |

Generation takes 25–90 ms for nature (river and path distances are bucketed) and under 10 ms for the city. Nothing
casts a real-time shadow. An InstancedMesh is culled as a whole, so these counts hold at every zoom. Parked bikes are the
town's biggest triangle cost, so racks stand only in short rows near the lot.
