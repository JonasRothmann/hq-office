# Spec: question tiers and the 3D office

Status: accepted for the overnight build of 2026-10-26. Decisions and their reasons are in `docs/decisions.md`.

This spec covers two changes. The backend gives every question a blocking tier and a priority. The frontend is
rewritten: a three.js office fills the window, and the panels float over it as frosted glass. The question panel
stays the point of the page, so every outcome below is checked against one rule: an open question is never harder to
see or to answer than it was before.

## 1. Outcomes

Each outcome is checkable. "Test" means `bun test` covers it. "Browser" means a check in Chrome against a running
server with a throwaway data dir, with a screenshot saved under `docs/screens/`.

### Backend: tiers and priorities

| # | Outcome | Check |
| --- | --- | --- |
| B1 | Every ask has a tier (`blocking` or `nonblocking`), a priority (`urgent`, `high`, `normal`, `low`) and a lock flag. Asks made before the change read as `nonblocking`, `normal`, unlocked. | Test |
| B2 | `hud ask --blocking` makes a locked blocking ask. Nobody can move a locked ask out of `blocking`; the route answers 409 and says why. | Test |
| B3 | An unlocked ask can be moved between tiers and re-prioritised by the owner (from the page) or by HQ (`hud tier ID ...`). Each move records who moved it and when, and the card shows it. | Test, Browser |
| B4 | When the owner moves an ask, HQ is told in one line (through the existing outbox), so it can tell the lane. A move by HQ is not echoed back to HQ. | Test |
| B5 | `/api/state` orders open asks: blocking first, then by priority, then by due time, then oldest first. | Test |
| B6 | A lane with an open blocking ask carries `blocking: n` in state, whether or not it is working. Its status word follows the old rule, so a working lane stays `moving` and still shows that it is blocked on a question. | Test |
| B7 | The question panel shows blocking asks in their own group at the top and non-blocking asks below, every card fully rendered. A non-blocking ask is never collapsed, hidden or scrolled behind another panel. | Browser |
| B8 | The tables change additively only: new columns with defaults on `asks`, one new table for lane vitals. Nothing is dropped or renamed. A database from v0.10.1 opens and keeps every answer. | Test (opens a v0.10.1 database) |

### Backend: lane vitals (for the desk HUD)

| # | Outcome | Check |
| --- | --- | --- |
| V1 | For a Claude Code lane on this machine, the server reads the model, the context in use (tokens), and the running subagents (count and model each) from the agent's own session transcript, located from herdr's `agent_session` and `foreground_cwd`. It reads only the tail of the file and only these fields. | Test (fixture transcript) |
| V2 | Any lane can report its own vitals: `hud lane NAME --model M --effort E --subagents N --context USED[/MAX]`. A report wins over what the transcript says, until the transcript changes. | Test |
| V3 | Effort comes from a report, else from the transcript (each assistant line carries `effort`), else from the Claude settings the agent runs under (`effortLevel`), else it is unknown. Unknown is shown as a dash, never guessed. | Test |
| V4 | Vitals are in `/api/state` as `S.vitals[laneName]`. No transcript text ever reaches the state, the database or a log. | Test |

### Frontend

| # | Outcome | Check |
| --- | --- | --- |
| F1 | A three.js scene fills the whole window behind everything. Every panel is HTML over it. The page has no page scroll. | Browser |
| F2 | Panels are frosted glass (blur and saturation of what is behind, a light inner edge, a soft shadow), dense like Linear: 13 px text, 28 to 32 px rows. Light and dark themes, following the system unless the owner picks one. The 3D office relights for each: day and night. | Browser (both themes) |
| F3 | Every lane has its own office: its own floor, walls, desk, chair, poster, plant. More lanes add more offices along corridors; the floor never just gets bigger. | Browser at 1, 4, 9 and 18 lanes |
| F4 | Walls cut away: the two walls nearer the camera are low (a 0.4 m kerb), the two far walls are full height. Rotating the view in 90° steps recomputes which walls are low. | Browser |
| F5 | Interior: light oak floors and desks, off-white walls, black steel legs, paper lanterns, shoji screens, low plants, tatami-style rugs, original posters. Reads as a small Scandinavian and Japanese startup. | Browser, owner's eye |
| F6 | Each desk has a HUD readable at a glance: lane name and status, model, effort, number of running subagents, and context in use as a bar with a number. | Browser |
| F7 | Waiting and working look different at a glance, in shape and not only in colour. Working: seated, typing, screen lit. Waiting on the owner: standing beside the desk facing the camera with a raised hand, a red marker over the head, the desk lamp red. | Browser (side by side) |
| F8 | Running subagents are small balls, Sims 1 style, hopping around their lane's desk, coloured by model family. Finished ones fade out. | Browser |
| F9 | Clicking a worker opens its card. Hovering a desk lifts its HUD. Esc closes. | Browser |
| F10 | The question panel is never covered: at 1440x900, 1280x800 and on a phone, the centre of every open question card is the topmost element at its point. | Test (Chrome) |
| F11 | Original art only: every model, texture and poster is made in this repo. No copied models, names, logos or UI elements from a real game. | Review |

### Delivery

| # | Outcome | Check |
| --- | --- | --- |
| D1 | `bun test` passes. Tests that hashed the old pixel room are replaced by tests of the new room (scene draws, one office per lane, walls cut, HUD per desk). | Test |
| D2 | `docs/STATUS.md` says what was built, what was decided, and what the owner should look at first. | File |
| D3 | One draft PR on the fork. Nothing pushed to upstream, nothing merged. | `gh` |

## 2. The tier model

```
ask
  tier:        "blocking" | "nonblocking"
  priority:    0 urgent | 1 high | 2 normal | 3 low
  tier_locked: 0 | 1           -- 1 when the asking lane said --blocking
  tier_by:     "lane" | "hq" | "owner" | null   -- who last set tier or priority
  tier_at:     epoch ms | null
```

- **Blocking.** The lane that asked cannot go on with that piece of work until it has the answer. It is locked: the
  owner and HQ cannot move it to non-blocking, only answer it. The lane is not frozen: it keeps working on whatever
  else it has, so a lane can be both "working" and "blocked on a question". Priority can still change.
- **Non-blocking.** The lane goes on without the answer. The owner or HQ can move it to blocking (an owner saying
  "stop that until I answer") and back, and change its priority. Such an ask stays unlocked, because a person put it
  there, not the lane.
- **Default.** `hud ask` with no flag makes a non-blocking, normal ask. This keeps today's behaviour: an open ask on
  an idle lane still makes it `needs_you`.
- **Lane status.** `laneStatus` keeps its rule. A new field `blocking` (count of open blocking asks) is added to each
  lane. The room shows a lane that is working and blocked as working with a red badge on its HUD.
- **Writes.** `POST /api/asks` accepts `tier`, `priority`. `POST /api/asks/:id/tier` takes `{ tier?, priority?, by }`
  and answers 409 for a tier change on a locked ask. `hud tier ID blocking|nonblocking [--priority P]` and
  `hud ask ... --blocking --priority P`.
- **Storage.** Five columns added to `asks` with defaults, in `db.ts` like the earlier `secrets` and `parent`
  columns: `tier`, `priority`, `tier_locked`, `tier_by`, `tier_at`. Additive only (see decisions).

## 3. The visual system

### Look

The target is Sims 1 (2000): a fixed three-quarter view from above, soft even light, slightly warm, crisp low-poly
furniture, walls that drop away so you look into rooms like a doll's house. Our version is cleaner and brighter: a
Nordic and Japanese startup, not a suburban house.

- **Camera.** Orthographic, 45° azimuth, 30° elevation (the exact 2:1 of the original; see `docs/research/sims1-look.md`). Pan by drag, zoom by wheel or pinch within limits,
  rotate in 90° steps (Q and E, or buttons). It eases to fit all offices when lanes come and go.
- **Light.** Day: a warm key light with soft shadows, a cool sky fill, gentle ambient. Night (dark theme): a dim blue
  ambient; desk lamps, monitors and lanterns carry the light.
- **Materials.** Flat-shaded or very lightly lit standard materials, no textures larger than 256 px, posters drawn on
  canvases in code. No external model files: every model is built from primitives in code.
- **3D or 2D.** 3D for architecture, furniture, workers and subagent balls. 2D where text or icons must stay crisp:
  the desk HUD (HTML positioned over the desk), the marker over a waiting worker (a sprite), and posters (canvas
  textures).

### Palette (world)

| Token | Day | Night | Use |
| --- | --- | --- | --- |
| floor-oak | #d9b98c | #6b5a45 | office floors |
| floor-corridor | #e8e4dc | #3a3b40 | corridors |
| wall | #f3efe7 | #4a4a52 | wall faces |
| wall-cap | #c9b28f | #6e6250 | the top of the cut wall |
| steel | #2b2b2e | #1c1c1f | desk legs, lamp |
| tatami | #c8c48e | #5d5b40 | rugs |
| plant | #5f8a5a | #39553a | plants |
| accent-poster | #e4572e, #2e86ab, #f2c14e | same, dimmer | posters |

### Status (shared by the world and the UI)

| Status | Colour | Worker pose |
| --- | --- | --- |
| needs_you / blocked | #e5484d | standing beside the desk, facing the camera, hand raised; red marker |
| hq_turn | #f5a524 | seated, leaning back, arms folded; amber marker |
| waiting (CI, other) | #3e63dd | seated, leaning back; blue marker |
| moving (working) | #30a46c | seated, typing; screen lit; no marker |
| done | #12a594 | at the break area or leaning back with a mug |
| parked, gone, stale | #8b8d98 | chair empty or worker asleep; lights low |

### Glass (UI)

Tokens on `:root`, overridden for dark under `prefers-color-scheme` and `[data-theme]`:

| Token | Light | Dark |
| --- | --- | --- |
| --glass-bg | rgba(255,255,255,0.62) | rgba(24,25,30,0.60) |
| --glass-blur | blur(24px) saturate(180%) | blur(24px) saturate(160%) |
| --glass-edge | inset 0 1px 0 rgba(255,255,255,0.75), 0 0 0 1px rgba(15,20,30,0.08) | inset 0 1px 0 rgba(255,255,255,0.08), 0 0 0 1px rgba(0,0,0,0.5) |
| --glass-shadow | 0 10px 30px rgba(15,20,30,0.14) | 0 10px 30px rgba(0,0,0,0.45) |
| --text | #16181d | #ececf1 |
| --text-2 | #5b5f6a | #a0a3ad |
| --row | 30px | 30px |
| --radius | 14px panels, 8px controls | same |

Font: Inter (13 px body, 12 px meta, 11 px labels in small caps weight 600), JetBrains Mono for numbers in the HUD.
Status colours as above, at 12% alpha for fills.

### Layout

- The world: a `<canvas>` fixed to the full window, `z-index: 0`.
- The question column: a glass panel on the left, full height less margins, 420 px wide (360 px under 1280 px). Tabs
  (Questions, Messages, Work, Rooms), the list, and Tell HQ docked at its foot. Nothing else may overlap it.
- The status pill: top right. Waiting on you, working, on HQ, from HQ, machines, settings, theme, sound.
- The feed: bottom right, collapsible.
- The worker card: a glass popover beside the selected desk, never over the question column.
- A conference room: a glass sheet over the world area (right of the question column), as today.
- Phone: the question column fills the screen, the world shows as a strip above it.

## 4. The desk HUD and subagent balls

- **HUD.** One HTML chip per desk, projected from a point above the desk each frame, culled when off screen. Rows:
  name and status dot; `model · effort`; subagent dots with a count; a context bar (`84k / 200k`). Hover lifts it
  and shows the full name and lane title. When zoomed out it collapses to name, status and the context bar.
- **Balls.** One sphere of 0.12 m per running subagent, coloured by model family (Opus violet #8e4ec6, Sonnet teal
  #12a594, Haiku amber #f5a524, other grey). Each hops on a small arc around the desk with its own phase; one that
  finishes shrinks and fades over 600 ms. At most 8 balls per desk; the HUD count is exact.

## 5. Room growth

Like Game Dev Tycoon, the company moves into bigger premises as it grows, and like the brief asks, growth means more
rooms, never one bigger floor.

- **Office.** A 5 m by 4 m cell with its own floor, four walls and a door to the corridor. One lane per office.
- **HQ suite.** A 7 m by 5 m office at the head of the plan for HQ and the owner's own desk.
- **Stages,** by lane count:
  1. Studio (1 to 3): HQ suite and a short hall with offices on one side.
  2. Floor (4 to 8): a corridor with offices on both sides, and a break area (kitchen counter, sofa) where done
     workers go.
  3. Wings (9 to 16): one wing per top-level team in the lane tree, each its own corridor off a central hall.
  4. Campus (17 and more): more wings in a grid, with courtyards (gravel, a maple) between them.
- **Stable places.** A lane keeps its office while it exists. Offices are assigned in the order lanes appear,
  grouped by team; a stage change re-lays the plan once and animates it.
- **Arrival.** A new office rises from the floor over 800 ms; a removed lane's office dims and empties, then folds
  away on the next stage change.

## 6. Code layout

New and replaced client folders, each owned by one lane of work:

| Folder | Owner | What |
| --- | --- | --- |
| `src/client/vendor/three/` | lead | three.js r186, bundled and minified once, MIT |
| `src/client/world/` | 3D lane | scene, camera, lights, plan (growth), rooms, walls, furniture, workers, picking |
| `src/client/desk-hud/` | HUD lane | the desk chips and the subagent balls |
| `src/client/theme/` | glass lane | light, dark, system; sets `data-theme`; emits `theme` on the bus |
| `public/index.html`, `core/*.css`, every feature stylesheet | glass lane | the glass shell |
| `src/server/vitals.ts`, `routes/vitals.ts`, `schema/lane_vitals.sql` | HUD lane | lane vitals |
| `src/server/asks.ts`, `routes/asks.ts`, `state.ts` (order), `db.ts` (columns), `hud.ts`, `questions/*.js` | tiers lane | tiers |

The world talks to other areas only through the bus and one small module, `src/client/world/api.js`:

```js
export const THREE;                       // the vendored module
export function onFrame(fn) {}            // fn(now, dt) after the scene updates, before render
export function deskAnchor(lane) {}       // THREE.Vector3 above the lane's desk, or null
export function project(v3) {}            // { x, y, visible } in CSS pixels
export function addToWorld(obj, lane) {}  // parent an object to a lane's office group
// bus: "world:ready", "world:select" (lane name), "world:layout" (lane names in their offices)
```

The old canvas room (`src/client/room/`) and its pixel tests are retired in the same change.
