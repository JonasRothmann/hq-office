# How HQ Office is laid out

HQ Office used to be two files: `index.html` (about 2,800 lines of CSS, markup and one script) and `server.ts`
(routes, schema, queries, herdr sync, machine stats, the push stream and the score). Every feature touched both, so
two agents working at the same time edited the same files and overwrote each other. This layout gives every area its
own file, keeps the contracts between them in a few small modules, and lets a new feature arrive as new files.

The split was done by `scripts/restructure.ts`, mechanically: every statement kept its text, its comments and its
order. Only `export`, the imports and a few setters were added. The page computed the same styles as before the split.
Since then the pixel room has been replaced by a three.js office (`src/client/world/`).

## The map

```
server.ts                 entry: one import, so `bun server.ts` still starts everything
hud.ts                    HQ's CLI (unchanged)
bin/hud-plugin.ts         the herdr plugin's entry; bin/service.ts (service mode), bin/hud-command.ts (installs hud)
src/hq-guide.ts           the HQ guide and its one-line reminder (hud guide, the plugin's greet, messages to HQ)
public/index.html         the page shell: head, markup, <script type="module" src="/src/client/main.js">
src/client/               the page, plain ES modules and stylesheets, served as they are
  main.js                 loads every built-in area in the old order
  core/                   shared by every area: state, net, bus, formatting, rich text, base styles, layout
  world/                  the 3D office (three.js): plan, rooms, furniture, people, camera, scene, api
  office-view/            the office on the @hq/world engine, behind the OFFICE setting (D18): view.js
  theme/                  light, dark or system theme
  vendor/three/           three.js r186, vendored (the page's import map points "three" here)
  inbox/                  the owner's inbox: the stack, the pills, the keys, drafts and the page clock
  reader/                 the reader beside the stack: one item in full (on a phone, a full-screen sheet)
  topbar/ card/ images/ sound/ settings/ secrets/ work-board/ ledger/ hq-link/ blocked/ phone/ rooms/ desk-hud/
                          one folder per panel or feature: its module(s) and its stylesheet
  <feature>/index.js      a new feature: loaded by the page on its own
src/server/               the server, one file per concern
  main.ts                 loads every module in the old order, starts the timers
  config.ts db.ts push.ts router.ts page.ts json.ts http.ts
  herdr.ts lanes.ts asks.ts updates.ts events.ts inbox.ts owner-inbox.ts score.ts state.ts machines.ts
  routes/                 one file per resource: a list of { method, path | prefix | pattern, handle }
  schema/                 one .sql file per table, applied at startup
  machine-stats.sh        the machine sampler (runs here or over ssh)
test/                     the tests that were there, unchanged
  server/ client/         the server starts and serves; modules link; the page works; the office draws
scripts/                  restructure.ts (the split), room-hash.ts (Chrome, test server and clock tools for browser tests),
                          world-lab.ts, world-shots.ts, world-page-shots.ts, shell-shots.ts (the lab and screenshots)
docs/                     this file
```

## The page's layout

On a desktop (1151px and wider) the page is a grid of three columns (core/layout.css). The stack is on the left, from
the top of the window, as tall as its content. The status pill is top right. Under it, the reader sits beside the
stack, about 640px wide, and never covers it. The worker card and the pills are bottom right. The office is drawn in
the space right of the stack and under the status pill.

Under 1151px the page scrolls as one. On a phone the world is a strip at the top, the stack is below it, and the
reader is a full-screen sheet.

## Module boundaries and contracts

Each file says in its first line what it is for. A module imports exactly what it uses, so its import list is its
interface: what it depends on is visible at the top, and a renamed or moved name fails the link test at once.

The contracts, the things several areas agree on, each live in one small module and change rarely:

| Contract | Where | What it is |
| --- | --- | --- |
| The state | `src/server/state.ts` builds it, `src/client/core/state.js` holds it (`S`, `CONFIG`) | the one object the page draws from |
| Writes | `src/client/core/net.js` (`post`), `src/server/router.ts` | POST with `x-hud: 1`; the reply is JSON; every write bumps the version |
| Events on the page | `src/client/core/bus.js` | `state`, `tick`, `theme`, `world:ready`, `world:select`, ...: where a feature hooks in |
| Status words and colours | `src/client/core/status.js`, `src/server/lanes.ts` (`laneStatus`) | `needs_you`, `hq_turn`, `moving`, ... |
| The office's door | `src/client/world/api.js` | `THREE`, `onFrame`, `deskAnchor`, `project`, `addToWorld`; the `world:*` events |
| The office's layout | `src/client/world/plan.js` | pure: rooms, walls, cutaway, growth stages by lane count |
| The office's colours and poses | `src/client/world/look.js` | colour tokens per theme, status colours, poses |

Mutable state that another module changes has a setter in the module that owns it (`setS`, ...): an imported binding is read-only, and a setter makes every outside write visible in a search.

## How a feature arrives as new files

- Page: a folder `src/client/<name>/` with `index.js` (and any `.css`). The server links every stylesheet under
  `src/client` and loads every `<name>/index.js` after `main.js` when it serves the shell, so nothing else is edited.
  The feature imports what it reads and listens on the bus: `on("state", ...)`, `on("tick", ...)`,
  `onFrame((now, dt) => ...)` from `world/api.js` for something drawn in or over the office.
- Server: `src/server/<name>.ts` for the logic, `src/server/routes/<name>.ts` for its routes (the router loads every
  file there), `src/server/schema/<table>.sql` for its tables, and `addStatePart("<name>", () => ...)` for its part
  of `/api/state`.

## Ownership for parallel lanes

A lane owns its feature's folder and files. Two lanes never edit the same file at the same time. The shared files
(the contracts above, `main.js`, `main.ts`, `router.ts`, `page.ts`, `db.ts`, `config.ts`, `public/index.html`,
`core/layout.css`, `core/base.css`, `core/controls.css`) change only in a lane that says so up front, as a small
change of their own, merged before the work that needs it. `AGENTS.md` has the rules in full.

## Trade-offs

**No build step.** The browser loads the modules as they are and Bun serves them. Measured on localhost, headless
Chrome, the same seeded state:

| | before (one file) | after (modules) |
| --- | --- | --- |
| requests on a cold load | 2 | 60 |
| bytes on a cold load | 196 KB | 229 KB (body 211 KB: import lines and headers) |
| bytes on a reload | 196 KB | 27 KB (unchanged files answer 304) |
| DOMContentLoaded, cold / warm | 9 ms / 6 ms | 17 ms / 13 ms |
| server start to first /api/state | 27 ms | 31 ms |

The page is local and its budget is a human's (about 100 ms); 8 ms more on load is not visible, a reload moves 86%
fewer bytes, and there is nothing to run before a change shows. `modulepreload` links were tried and saved about
2 ms, which is noise, so they are not used. A bundler would bring the request count back to 2 but adds a build that
every lane must run, a second copy of the code to keep in step, and source maps to debug through. It would be worth it
if the page were served over a slow network; it is not.

**ES modules, not several classic scripts.** Classic scripts sharing globals would have been a smaller change, but
every name would stay global and every file could reach into every other one. Modules make the dependencies explicit
and checkable, which is what lets two agents work without reading the whole page first. The cost was the setters for
the eight bindings written across modules, and modules being strict (the split checks for undeclared assignments).

**Load order.** Modules run their imports first. `main.js` lists the areas in the order the old script ran them,
and the split checks that nothing reads another module's `let` or `const` before that module has run.

**Stylesheets per area.** The rules were split by selector and are linked `core/` first, then by path. The old
order and the new differ, so the split relied on the rules' selectors not tying on the same property; the computed
style of every element in six states at two sizes is identical before and after.

**Routes in files, not a table in one file.** Each route file is a plain list, loaded by the router at start. Two
lanes adding routes add or edit different files. Routes must not overlap (the split checked the moved ones).

**The schema as files.** One `CREATE TABLE IF NOT EXISTS` file per table, applied in name order at start. A change to
an existing table is still a careful by-hand migration; the files only make new tables collision-free.

## How it was checked

- `test/smoke.test.ts` (the old routes) passes unchanged.
- `test/server/start.test.ts`: the server starts from the root, the shell links every stylesheet core-first and
  loads `main.js`, every client file is served with its type and revalidates to 304, nothing outside `src/client`
  is served, and `/api/state` has every key the page reads.
- `test/client/modules.test.ts`: every import resolves to a file and to a name that file exports, every module is
  reached from `main.js` or a feature's `index.js`, every file opens with a comment.
- `test/client/page.test.ts`: in Chrome at 1440x900, no console errors, no page scroll, an answer and a note reach
  the server, the tabs, the worker card, settings and sound respond.
- `test/client/world-plan.test.ts`: the office's plan (team rooms of four, stable desks, walls, cutaway, growth
  stages), pure, no browser.
- `test/client/world.test.ts`: in Chrome with WebGL on SwiftShader (`startChrome({ webgl: true })` from
  `scripts/room-hash.ts`): one desk per lane in team rooms at 1, 4, 9 and 18 lanes, a team of six in two rooms, the
  canvas draws, the walls nearest the camera are low and recomputed after a turn, clicking a worker opens its card and
  Esc closes it, and the office rests while a room covers it. Run it with `bun test --timeout 90000 test/client/world.test.ts`.

The split was also run on a copy of another lane's branch (a new page section, new routes, a new root module and
its tests): it placed the new work in its own module, file and route file, and the branch's tests passed. The
split's own check hashed the page's computed styles and canvas before and after; that check, and the pixel room it
hashed, are gone.

## Running the split again

`scripts/restructure.ts` works from whatever `index.html` and `server.ts` hold, so it runs on a main that has
moved on. Its plan names every top-level binding it knows; anything new goes with the statement above it, or, under
a new section header, into a module of its own, and is listed for review. It refuses to write anything when it finds
something it cannot place (an unknown route shape, a destructuring write to a shared binding, a load-order read), and
ends with a checklist.
