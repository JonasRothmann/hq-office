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
