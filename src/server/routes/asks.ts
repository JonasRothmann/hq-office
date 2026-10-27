// Routes for asks. The router loads every file in this folder; see src/server/router.ts.
import { db } from "../db.ts";
import { event } from "../events.ts";
import { json } from "../json.ts";
import { bump } from "../push.ts";
import { answerAsk, askAndRoute, setTier, TierLocked } from "../asks.ts";
import { leads } from "../ask-routes.ts";
import { Forbidden, NotHolder } from "../lead-router.ts";
import type { Ctx, Route } from "../router.ts";

// A raw POST, so that a refusal of a locked tier or of HQ escalating what the owner holds answers 409, and a lead's
// wrong or old token 403, rather than the router's 400.
const guarded = (run: (body: any, m: RegExpMatchArray) => unknown) => async ({ req, m }: Ctx) => {
  const body = await req.json().catch(() => ({}));
  try {
    const out = run(body, m);
    bump();
    return json(out ?? { ok: true });
  } catch (e) {
    return json({ error: (e as Error).message }, e instanceof Forbidden ? 403 : e instanceof TierLocked || e instanceof NotHolder ? 409 : 400);
  }
};

const routes: Route[] = [
  { method: "POST", path: "/api/asks", handle: ({ body }) => askAndRoute(body) },
  // No `token` and no `by`: the owner, from the page. `token`: the lead holding it (hud answer ID TEXT --token T).
  { method: "POST", pattern: /^\/api\/asks\/(\d+)\/answer$/, raw: true, handle: guarded((body, m) => {
    answerAsk(Number(m[1]), String(body.answer ?? "").trim() || "done", { token: body.token, by: body.by });
  }) },
  // `token`: the lead holding it (hud escalate ID --token T). `hq: true`: HQ (hud escalate ID --hq).
  { method: "POST", pattern: /^\/api\/asks\/(\d+)\/escalate$/, raw: true, handle: guarded((body, m) => leads.escalate(Number(m[1]), body)) },
  // What a lead holds (hud held --token T): the token of any question it holds names the lead.
  { method: "GET", path: "/api/asks/held", handle: ({ url }) => {
    try {
      return json(leads.held(url.searchParams.get("token")));
    } catch (e) {
      return json({ error: (e as Error).message }, 403);
    }
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
