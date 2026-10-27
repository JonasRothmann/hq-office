// Go to the lead, wired to the server: the router (lead-router.ts) on hud.db and the real clock, typing in through
// herdr the way rooms do (promptAgent, and rooms' `away` rule), HQ told through its outbox. Checked after every change
// of the state, every 5 s, and once at start, so a restart picks up where it was: every time is absolute.
import { OWNER } from "./config.ts";
import { db } from "./db.ts";
import { bump, listeners } from "./push.ts";
import { event } from "./events.ts";
import { notifyHq } from "./hq-link.ts";
import { HQ_AGENT, promptAgent } from "./herdr.ts";
import { away } from "./rooms.ts";
import { getSettings } from "./settings.ts";
import { createLeadRouter } from "./lead-router.ts";

export const leads = createLeadRouter({
  db,
  prompt: promptAgent,
  away,
  notifyHq: (text, ref) => notifyHq(text, ref),
  event,
  bump,
  owner: OWNER,
  hq: HQ_AGENT,
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
