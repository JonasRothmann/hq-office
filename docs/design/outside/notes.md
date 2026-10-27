# The land around the office

Two seeded surroundings for the 3D office: a valley (`nature`) and a town (`city`). They frame the office and
never reach into its lot. Code: `src/client/world/outside/`. Tests: `test/client/outside.test.ts`. Lab:
`bun scripts/world-lab.ts`, then open `/docs/design/world-lab.html?scene=outside&mode=city&seed=7&lot=24x14`.
Shots: `bun scripts/world-shots.ts --only=outside-` writes the JPEGs in this folder.

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
- **City.** Road centre lines ring the lot's block, so the lot is exactly one block's interior. Blocks of 17–31 m are
  added outward. Every road has two 3 m lanes, 3 m pavements with kerbs, centre dashes, stop lines and a zebra on
  every arm of every junction, in line with the pavements. Blocks are built round their edge: a row facing each
  street and a yard in the middle. Some blocks are parks. A building is a house (hipped or gabled), a shop (awning,
  sign, shop window), flats (balconies) or an office (ribbon windows, roof tanks), in timber, plaster or concrete.
  Lamps and street trees stand on the kerb side.
- **Movers.** Each car drives a loop round a rectangle of blocks in the right-hand lane, turning at the junctions
  (a clockwise loop is on the inside). Each person walks the middle of the pavement round one or two blocks and
  crosses on the zebras. At run time (`movers.js`), cars slow for corners, follow at a distance, give way at a
  junction (the lower number goes first when two wait on each other; nothing waits longer than 5 s) and stop for
  anyone on a zebra.

`build.js` turns a layout into meshes. The terrain or the streets is one vertex-coloured mesh. Every repeated
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
| City, day / night | 22 / 24 | 63k to 74k |

Generation takes 25–90 ms for nature (river and path distances are bucketed) and under 5 ms for the city. A frame's
`update` (40 cars, 60 people) takes about 0.1 ms. Nothing casts a real-time shadow. An InstancedMesh is culled as a whole, so these counts hold at every zoom.

## Wiring it into the world (for the lead, at merge time)

In `src/client/world/world.js`:

```js
import { mountOutside } from "./outside/outside.js";

// The garden round the building that belongs to the office (the lot scatter, the garden lane). Nothing outside
// comes nearer than this to the plan's bounds.
const LOT_MARGIN = 6;
const lotOf = (b) => ({ minX: b.minX - LOT_MARGIN, minZ: b.minZ - LOT_MARGIN, maxX: b.maxX + LOT_MARGIN, maxZ: b.maxZ + LOT_MARGIN, door: "s" });

// in mountWorld, beside the other state:
let outside = null, outsideMode = opts.outside ?? "nature", outsideSeed = opts.outsideSeed ?? "hq";

// in build(), right after sc.setLights(L, p.bounds):
if (outsideMode !== "off") {
  if (!outside) outside = mountOutside(sc.scene, { mode: outsideMode, seed: outsideSeed, lot: lotOf(p.bounds), theme: L });
  else outside.setLot(lotOf(p.bounds)); // a no-op unless the office outgrew its land
}

// in setTheme(t), before `if (p) build();`:
outside?.setTheme(L);

// in tick(), just before runFrame(now, dt):
outside?.update(now, dt);

// a new API method, listed in `api`:
function setOutside(mode, seed) {
  outsideMode = mode ?? outsideMode; outsideSeed = seed ?? outsideSeed;
  if (outsideMode === "off") { outside?.dispose(); outside = null; if (p) sc.setLights(L, p.bounds); }
  else if (!outside && p) outside = mountOutside(sc.scene, { mode: outsideMode, seed: outsideSeed, lot: lotOf(p.bounds), theme: L });
  else { outside?.setMode(outsideMode); outside?.setSeed(outsideSeed); }
  dirty = true;
}

// in dispose(): outside?.dispose();
```

`theme: L` passes the look tokens, so the lawn round the lot takes `L.ground.base` and the night takes `L.moon`, the
same as the garden. In `src/client/world/index.js`, delete the bare `import "./outside/outside.js";` (it is there
only so the module check reaches the folder before world.js imports it). Then pass the setting:

```js
world = mountWorld(canvas, { theme: effectiveTheme(), hq: hq.name, insets: insets(), outside: settings.outside, outsideSeed: settings.outsideSeed ?? (CONFIG.owner || "hq") });
on("settings", (s) => { world.setPerformance(s.performance); world.setOutside(s.outside, s.outsideSeed ?? (CONFIG.owner || "hq")); });
```

In `src/client/settings/prefs.js`, add `outside: "nature"` to `DEFAULTS` and `OUTSIDE_CHOICES = ["nature", "city",
"off"]`, checked in `withDefaults` like `performance`. Add `outside: OUTSIDE_CHOICES` to `SETTING_OPTIONS` in
`panel.js`. No server change is needed: settings are free-form keys. The owner's name as the seed gives every
installation its own land, stable across reloads. An optional `outsideSeed` setting lets the owner reroll it.

Notes for the wiring:

- In POWER SAVER the world draws only when something changes, so the outside's cars and water stand still. Leave
  them out of `busy`.
- `LOT_MARGIN` must cover whatever the garden lane draws round the building. Today `scatterLot` reaches about 4.5 m
  past the bounds. If the garden grows, raise the margin. The outside follows on its next regeneration.
- `outside.layout.path.entry` is where the nature path meets the lot's edge (the middle of the door side). A garden
  path that ends there joins it.
- `world.inspect()` can report `outside?.inspect()` (mode, seed, generated lot, meshes, instances) for tests.
