// Routes for asks. The router loads every file in this folder; see src/server/router.ts.
import { db } from "../db.ts";
import { event } from "../events.ts";
import { json } from "../json.ts";
import { bump } from "../push.ts";
import { answerAsk, askAndRoute, setTier, TierLocked } from "../asks.ts";
import { leads, waitHeld } from "../ask-routes.ts";
import { NotHolder } from "../lead-router.ts";
import type { Ctx, Route } from "../router.ts";

// A raw POST, so that a refusal of a locked tier or of a lane that does not hold the ask answers 409 rather than the
// router's 400.
const guarded = (run: (body: any, m: RegExpMatchArray) => unknown) => async ({ req, m }: Ctx) => {
  const body = await req.json().catch(() => ({}));
  try {
    const out = run(body, m);
    bump();
    return json(out ?? { ok: true });
  } catch (e) {
    return json({ error: (e as Error).message }, e instanceof TierLocked || e instanceof NotHolder ? 409 : 400);
  }
};

const routes: Route[] = [
  { method: "POST", path: "/api/asks", handle: ({ body }) => askAndRoute(body) },
  // No `by`: the owner, from the page. `by`: the lead holding it (hud answer ID TEXT --as LEAD).
  { method: "POST", pattern: /^\/api\/asks\/(\d+)\/answer$/, raw: true, handle: guarded((body, m) => {
    answerAsk(Number(m[1]), String(body.answer ?? "").trim() || "done", body.by);
  }) },
  { method: "POST", pattern: /^\/api\/asks\/(\d+)\/escalate$/, raw: true, handle: guarded((body, m) => leads.escalate(Number(m[1]), body.by, body.reason)) },
  // What a lead holds (hud held --as LEAD [--wait N]).
  { method: "GET", path: "/api/asks/held", handle: async ({ url }) => {
    const lane = (url.searchParams.get("lane") ?? "").trim();
    if (!lane) return json({ error: "lane is required: hud held --as LEAD" }, 400);
    return json(await waitHeld(lane, Math.min(Number(url.searchParams.get("wait")) || 0, 240) * 1000));
  } },
  { method: "POST", pattern: /^\/api\/asks\/(\d+)\/tier$/, raw: true, handle: guarded((body, m) => setTier(Number(m[1]), body)) },
  { method: "POST", pattern: /^\/api\/asks\/(\d+)\/withdraw$/, handle: ({ body, m }) => {
    db.query("UPDATE asks SET status = 'withdrawn', answer = ?, answered_at = ?, acked_at = ? WHERE id = ? AND status = 'open'").run(
      body.reason ?? "withdrawn by HQ",
      Date.now(),
      Date.now(),
      Number(m[1]),
    );
    event("hq", `withdrew ask #${m[1]}${body.reason ? `: ${body.reason}` : ""}`);
  } },
  { method: "POST", pattern: /^\/api\/asks\/(\d+)\/ack$/, handle: ({ m }) => {
    db.query("UPDATE asks SET acked_at = ? WHERE id = ?").run(Date.now(), Number(m[1]));
  } },
];
export default routes;
