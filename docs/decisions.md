# Decisions: the 3D office and question tiers

The owner was away for this build and asked for every blocking call to be made and written down here with its reason.
Newest last. The spec these serve is `docs/spec-3d-office.md`.

## D1. The "original pixel art only" rule becomes "original art only"

The rewrite replaces the pixel room with a 3D office, which the owner asked for. The old rule existed so the page
never shipped copied sprites, names or logos from a real game. That reason still holds, so the rule keeps its point
and drops only the medium: original art only, made in this repo, in the spirit of late-90s life-sim games, never
copied models, sprites, textures, names, logos or UI from a real game. `AGENTS.md` changes in the same PR.

## D2. Tiers are new columns on `asks`, added the way earlier columns were

The owner allowed a table change if it is the simplest way, additive only. It is: the panel's order is one
`ORDER BY` in `state.ts`, and a side table would need a join in every reader of asks. The columns (`tier`,
`priority`, `tier_locked`, `tier_by`, `tier_at`) are added in `db.ts` with defaults, like `secrets` and `parent`
before them. Nothing is dropped or renamed, and existing asks read as non-blocking, normal, unlocked. The owner was
not available to confirm; this is said in the PR body.

## D3. A blocking ask is locked; a non-blocking one is movable

From the brief: a fully blocking question blocks its lane, and the lane cannot change that, but the lane keeps doing
its other work. A non-blocking one does not stop the lane, and the owner or HQ can move it between tiers later. So
the lock follows who made it blocking: the asking lane (`--blocking`) locks it; an owner or HQ who promotes a
non-blocking ask can demote it again. Priority is ordering only and can always change. If the owner meant that
nobody, including the asking lane, should be able to set blocking after the fact, this is one flag to change.

## D4. `hud ask` defaults to non-blocking

Today an open ask on an idle lane makes that lane `needs_you`, and HQ's habits are built on that. A default of
non-blocking keeps that behaviour exactly and adds blocking as a stronger, explicit signal.

## D5. Lane vitals come from the agent's own transcript, with self-report as override

herdr reports an agent's kind, status, session id and working directory, but not its model, effort, tokens or
subagents. Claude Code writes all of them into its session transcript (`~/.claude/projects/<cwd>/<session>.jsonl`
and a `subagents/` folder beside it). The server reads the tail of that file for the model and the last usage, and
the subagents folder for running subagents (running until its meta file says `finished`, or quiet for 10 minutes).
Current Claude 5 models run a 1M context window although their ids carry no `[1m]`, so the max comes from a small
table by model family. Other agents, and lanes on other machines, report through
`hud lane NAME --model --effort --subagents --context`. Effort is on every assistant line of the transcript (`effort`); the Claude settings' `effortLevel` is the fallback.
Transcript text never leaves `vitals.ts`. Vitals are kept in a new table, `lane_vitals`, so the `lanes` table is
untouched.

## D6. three.js is vendored, bundled once, served as a plain module

The repo has no build step and the page must work offline. three.js r186 ships no minified module build, so
`build/three.module.js` was bundled and minified once with `bun build --minify` into
`src/client/vendor/three/three.module.min.js` (750 KB, MIT licence beside it). An import map in the shell maps
`three` to it. No CDN.

## D7. Behaviour modules stay; the presentation is rewritten

"Full rewrite" is read as the whole look and layout: the world, the glass shell, every stylesheet, the desk HUD. The
modules that answer questions, send notes, upload images and handle secrets are tested and are the point of the
page; they keep their logic and IDs and get new markup and styles where the layout needs it. Rewriting them from
scratch overnight would risk the one thing the page must never break.

## D8. The suite's browser tests time out under this machine's load, not because of a defect

On a clean `main` (v0.10.1), `bun test` gave 212 pass, 33 fail, all 5 s timeouts in Chrome tests, while the load
average was 140 to 177 from other workspaces. The same files pass alone (`test/client/page.test.ts`: 4 pass). Browser
test files are therefore also run one file at a time, and both results are recorded in `docs/STATUS.md`.

## D9. Sims 1 is a reference for the look, not a source of assets

The owner pointed at FreeSims and suggested downloading sprites from the game. The game's sprites, models and
textures are EA's and cannot ship in an MIT repo, and D1 forbids copied art. The research reads how Sims 1 builds its
look (camera, projection, wall modes, proportions, palette, lighting, how people and objects are drawn) and records
measurable values in `docs/research/sims1-look.md`. The office is then built to those values with our own models.

## D10. Look B, Nordic-Japanese, over look A, Sims-faithful

The design round built both looks on the same camera, scale and cutaway, in day and night
(`docs/design/shots/`). B was chosen: pale oak, white walls, shoji, andon lanterns and tatami read as the small
Scandinavian and Japanese startup the brief asks for, while A's checker floors, red rugs and brick read as a
suburban house from 2000. B's calm palette also lets the status colours and the glass panels stand out. What makes
it read as Sims 1 (the 30° 2:1 view, tall back walls over small people, low capped front walls, per-room light) is
shared by both.

## D11. The pixel room's extras go with it

The hero, the hero's hat, the seasons and event rooms, the weather and the Office and Arena level themes were all
drawn by the pixel room. They are retired with it rather than ported, so the first 3D version is about the brief
(offices per lane, desk HUDs, subagents, waiting versus working). Their saved settings stay in the settings table,
untouched, so they can come back as 3D features without a migration.

## D12. Team rooms, not a room per lane

The owner looked at the first build and said lanes do not need their own rooms. With a 5 m by 4 m office per lane,
twelve lanes made a campus of small cells: the camera had to pull back so far that the workers were a few pixels
tall, and most of the floor was empty rooms. The plan now seats lanes at desks in team rooms of four (7 m by 5 m, two
facing pairs), one team per room, a second room for a team past four, and lanes with no tree sharing rooms of four.

- **Readable figures.** Twelve lanes are three rooms instead of twelve offices, so the view fits a third of the floor
  and every worker and desk chip is larger on screen. Growth still means more rooms, never one bigger floor; the
  stages count rooms.
- **A Sims-house feel.** A few lived-in rooms with people working side by side reads like a household in the
  reference; a row of identical one-person cells read like a storage unit.
- **Rooms that mirror the lane tree.** A top-level lane and everyone under it sit together, so the office shows
  who works with whom at a glance, which a room per lane never did.

What a lane owns is now its desk: `deskAnchor(lane)`, `addToWorld(obj, lane)`, the subagent balls and picking all
key on the desk, not the room. `window.__world` lists `rooms` (`{ id, team, lanes }`) and `desks` instead of
`offices`.

## D13. The interior: Nordic studio as the base, with Tokyo's best pieces grafted in

Two designers dressed the same showroom (`docs/design/nordic/`, `docs/design/tokyo/`) after the owner said the
office must first look like a proper, cool office. Nordic is the base: its people read as people (faces, hair,
varied clothes, clear poses), and its rooms feel lived in (bike, dog bed, enamel pendants, pinboard, books, plants
at three heights). Grafted from Tokyo: the wall band (skirting, timber battens, rail) that gives even the cut-down
walls detail, noren in doorways, the raised tatami lounge and tea corner in the break area, the pegboard workbench
with a 3D printer, the lit sign, and the stone lantern and maple in the garden. Together they make the Scandinavian
and Japanese mix the brief asks for.

## D14. Procedural surroundings: nature or city, seeded per installation

The owner asked for generated surroundings. A pure, seeded generator (`src/client/world/outside/gen.js`) makes a
river valley (hills, forest, a river with a bridge) or a neighbourhood (streets, crossings, other buildings, cars and
people walking), and `build.js` draws it with instancing (12 to 24 draw calls). The seed defaults to the owner's
name, so a page always shows the same place; a setting picks nature, city or off. The office's own lot and garden
stay with the interior; the generator never places anything on it, and it grows the land only when the office
outgrows it.

## D15. Japandi, not Nordic with grafts

The owner saw both showrooms and asked to merge them into one Japandi design, balanced half and half, instead of the
Nordic studio with a few Japanese pieces (D13). Japandi here means warm neutrals (oat, sand, warm white plaster, pale
oak and ash) with dark accents (smoked oak, charcoal, blackened steel) and a few muted earthy ones (rust, sage,
indigo, ochre); light timber, washi, linen, wool, stone and ceramics; fewer, better objects with room between them,
low furniture and clean lines. The walls carry Tokyo's band (skirting, battens, rail) under plaster, with slatted oak
feature walls and shoji screens as dividers; paper pendants and lanterns hang beside one or two dark-metal or ceramic
pendants; doorways have noren. Nordic's people stay (faces, hair, poses), dressed in the same palette. The lot's
garden is raked gravel, moss, a stone lantern, a maple, birches and a timber deck and path. D13's grafts stay; the
saturated Nordic colours and the clutter go. The "city" surroundings (D14) become Copenhagen, restyled in their own
lane.

## D17. The HUD as a stack and a reader: what was decided beyond the spec

The full-height column of four tabs is gone. The stack (`src/client/inbox/`) lists `S.inbox` as tall as its content;
the reader (`src/client/reader/`) shows one item in full beside it. These choices were made while building it:

- Layout. On a desktop the window is a grid of three columns: the stack (340px), the reader's column, and the dock
  (the worker card over the pills, 340px). The reader starts under the status pill, is at most 640px wide and as tall
  as its item. It never covers the stack. With the world on it stops 44px above the window's foot, where the world's
  turn buttons sit. `.desk` is the stack alone, so the world's inset is the stack's width; the reader floats over the
  office and the desk chips hide under it. Making the inset follow the open reader waits for the engine work.
- Needs you lists the blocking and open questions, unread updates and rooms with new lane messages. Its count is the
  number of open questions. The item the reader shows stays listed while it shows, even once it is read, so the
  reader and its card stay paired.
- A blocking question shows under every filter, Rooms included. The filter is kept in this browser, and a saved Rooms
  hid every question after a reload. We chose this over resetting the filter on load: a reset covers only a reload,
  while a question can also turn blocking, or arrive, under Rooms.
- A question is short when it has no secrets, at most four options, a body of at most 200 characters and no table,
  code or heading (`isShort` in `src/server/owner-inbox.ts`). A short card shows all of it: the body, its links as
  chips, its images as thumbnails, its options and SEND. Anything longer shows a preview, its shape (lines, tables,
  code, links) and opens in the reader. Every card and the reader's head name the kind: DECISION, ACTION or INFO.
- Answered from the reader, the reader moves on to the next question in the stack's order, or closes.
- FROM HQ is no longer a separate feed: updates are inbox items. The top bar's FROM HQ opens the newest unread one.
  SENT AND ANSWERED and the secrets drop moved into Tell HQ's view. Replying to an update stays (a note that starts
  with `re: #uID`); replying to your own note is dropped.
- A room in the reader is one scroll: its head (owner, work, who sits at the table), the brief folded after 12 lines
  with ALL N LINES, the shelf, the thread, and the send box pinned at the foot. The rail fold, the strip of room tabs
  and the phone's CHAT, BRIEF and SHELF tabs are gone. Pills show rooms with new messages (up to three) and the room
  that is open. On a desktop a room no longer pauses the office; on a phone the reader covers it and it rests.
- Keys work only while no text field has focus. Esc steps back in this order: a dialog, the tier menu, the text
  field, the reader, the worker card. J and K move through the stack; with the reader open it follows them. Enter
  opens the selected card, and only when no button, link or tab has focus: Enter on a control is the control's. M
  opens the tier and priority menu. Q and E stay the office's (they turn it), so no inbox key shadows them.
- The keys act on one target, marked KEYS: the card or the reader the owner used last (a click, a pick, J or K, a
  field). Cmd-Enter and 1 to 9 act on it and nothing else. A long card is never their target outside the reader:
  they say to open it first. Before, the reader's question won over a card just used, so a pick on one card and
  Cmd-Enter answered another.
- No send right after an answer. When an answer lands the next question can sit where the last one was with its send
  ready (an ACTION's DONE, an INFO's OK, a pick kept from before). For 1.2 s after an answer lands, no send button is
  on and Cmd-Enter sends nothing, except on a question the owner picked or typed in since. Held keys do not repeat a
  send or a pick. We chose this guard over making the advance wait for the send: the advance already waits for it,
  and the stray press comes after (a second Cmd-Enter, or a double click that lands on the next card's SEND).
- A send in flight keeps its button off until the server answers, whatever redraws it. A reply to an update and a
  message to a room clear only the box they were sent from, though the reader may have moved on.
- On a phone the reader covers the stack. A question that arrives meanwhile shows as a red banner at the reader's top
  (the newest one); a tap opens it. The chime alone was easy to miss.
- `S.inbox` is built from what `state()` already loaded (`S.open`, `S.updates`, `S.rooms`): a state part gets the
  state built so far. The shelves are read for the listed rooms only, once per state version. A link whose URL is
  only on the shelf of a room archived more than 7 days ago is no longer named after that shelf.
- Link cards are built only from what the server knows (the link's kind, host, who linked it, a shelf it is also
  on). Nothing is fetched from another site; a picture shows only when it is on this HUD.
