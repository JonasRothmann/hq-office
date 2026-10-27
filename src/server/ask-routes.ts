// Go to the lead, wired to the server: the router (lead-router.ts) on hud.db and the real clock, typing in through
// herdr the way rooms do (promptAgent, and rooms' `away` rule), HQ told through its outbox. Checked after every change
// of the state, every 5 s, and once at start, so a restart picks up where it was: every time is absolute.
import { OWNER } from "./config.ts";
import { db } from "./db.ts";
import { bump, listeners } from "./push.ts";
import { event } from "./events.ts";
import { notifyHq } from "./hq-link.ts";
import { promptAgent } from "./herdr.ts";
import { away } from "./rooms.ts";
import { getSettings } from "./settings.ts";
import { createLeadRouter } from "./lead-router.ts";

export const leads = createLeadRouter({
  db,
  prompt: promptAgent,
  away,
  notifyHq: (text) => notifyHq(text),
  event,
  bump,
  owner: OWNER,
  defaultRoute: () => (getSettings().askRoute === "lead" ? "lead" : "owner"),
});

let queued = false;
function checkSoon() {
  if (queued) return;
  queued = true;
  queueMicrotask(() => {
    queued = false;
    leads.check();
  });
}
listeners.add(checkSoon);
setInterval(checkSoon, 5_000);
checkSoon();

// GET /api/asks/held: what a lead holds; with a wait, until it holds something or the time is up.
export async function waitHeld(lane: string, waitMs: number) {
  const deadline = Date.now() + waitMs;
  let found = leads.held(lane);
  while (!found.length && Date.now() < deadline) {
    await new Promise<void>((resolve) => {
      const done = () => {
        listeners.delete(done);
        clearTimeout(t);
        resolve();
      };
      const t = setTimeout(done, deadline - Date.now());
      listeners.add(done);
    });
    found = leads.held(lane);
  }
  return { lane, asks: found };
}
