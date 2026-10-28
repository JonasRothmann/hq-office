# Status: 3D office, question tiers and the new HUD

This branch delivers question tiers, go to the lead, the new HUD, attachments and threads, the @hq/world engine, and the 3D office with its status signals. It is draft PR 1 on the owner's fork. Decisions are D1 to D22 in `docs/decisions.md`. The spec is `docs/spec-3d-office.md`.

## What it delivers

| Feature | What the owner gets | Decision |
| --- | --- | --- |
| Question tiers | A question is blocking or non-blocking, with a priority. A blocking question's tier is locked. The owner (from the page, key M) or HQ (`hud tier`) moves a non-blocking question between tiers or changes its priority. | D2 |
| Go to the lead | A question can go to the asking lane's lead first. It reaches the owner on a timeout or when the lead escalates. It is off until the owner sets askRoute=lead. Each hop has a token. Another agent's text is always quoted. | D20 |
| The HUD | The stack and the reader (design B, chosen by the owner). Keys for every step. Drafts kept across reloads. Light and dark themes. A phone layout. The page works without three.js at /?world=off. | D17 |
| Attach and threads | A + menu on every send box. Uploads are served as URLs on this server. A reply thread on each question and update. Reopen an answered question. | D19, amended by D22 |
| The engine | @hq/world in packages/world, its own package with a pure model, a hybrid ECS, instanced batches, and no drawing while the view is still. | D16 |
| The office | Team rooms of four desks that grow with the lane tree. A Japandi interior. The land round it is nature or a Copenhagen-like town. The OUTSIDE setting: nature, city, off, or REROLL. | D12, D14, D15, D18 |
| Office status | A warm lamp per team room at night. A paper lantern on each live desk, in its status colour. A round badge over a worker: red ! waits on the owner, amber waits on HQ's turn, blue clock is waiting, orange clock waits on its lead. A worker waiting on the owner stands and waves. Subagents are balls that stay readable at any zoom. The desk chip shows subagents, model, effort and context. | D21 |
| One office | The classic renderer is deleted. The engine office is the only office. | D21 |

## Tests (state at the end)

- Full `bun test` on the merged branch: 1038 pass, 2 fail in one run under heavy machine load. `ask-scope.test.ts` timed out under load and passed alone; the other was the phone room test below.
- `rooms.test.ts` (phone room scroll) depended on timing. The cause: the room did not watch its sections for late content. It is fixed, with a test that fails without the fix. `rooms.test.ts` now passes 9 of 9.
- After the last fixes: `world.test.ts` 16 of 16 (new tests for lane removal, rename, theme flips and badge clicks). `packages/world` tests 286 of 286. `test:hud` 478 of 478 after the review fixes. `modules.test.ts` 167 of 167.
- `test:world` now runs every office and engine test.

## Reviews

- Engine: two independent reviews. Every must-fix item is fixed.
- HUD, go to the lead, and the server and HUD half of the final branch: independent reviews. Every must-fix and should-fix item is fixed with a test (D22). An upgrade from main's database was proven safe on a copy. Secret values never reach the database, logs, listings or the page.
- Office half of the final branch: no must-fix items. Four should-fix items were fixed: a console error on lane removal, a badge that could not be clicked, furniture that swallowed a click on a worker, and missing tests for lane changes. No leaks over five grow-to-24-and-back rounds. A still office draws nothing.

## Cost

Draw calls at 1440 by 900, fitted.

| Lanes | OUTSIDE off | Nature | City |
| --- | --- | --- | --- |
| 4 | 87 | 138 | 162 |
| 12 | 149 | 202 | 224 |
| 24 | 207 | 258 | 282 |

The owner accepted these as they are.

## Table changes

Additive only. The `asks` table gained tier columns (D2) and `holder` and `answered_by` (D20). A new table, `ask_routes`, was added (D20). The owner approved the go-to-lead table change in the proposal. Old rows read as the owner's.

## Look at first

- The office: `docs/screens/office-wide-dark.jpg`, `office-near-dark.jpg`, `office-reader-light.jpg`, `office-city-light.jpg`.
- The HUD: `docs/screens/hud-light-4-question.jpg`, `hud-light-4-attach.jpg`, `hud-phone-reader.jpg`.
- To run it: `bun server.ts` with a throwaway `HUD_DATA_DIR`, then open the page.

## Known and left for later

- Traffic in the town does not stop at junctions. Walkers' legs do not swing. Paving is flat colour.
- The near zoom shows the office only, not the land.
- A 12-lane office beside the open reader fits only at the far zoom. There it is small, and the desk chips cover much of it.
- Links to a room (`#room/slug`) are left for later. The optional walk to the lead's desk is a setting, and it is off.
- The inbox and reader folders import each other.
- Thread rooms are never archived. A room named `thread-qN` made before the upgrade becomes that question's thread.
- With askRoute=lead, any local agent that can call the API can make itself a lead (D22).
- D18 and D19 still describe the state before D21 and D22. Those later decisions supersede them.
