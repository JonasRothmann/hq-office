// Routes for asks. The router loads every file in this folder; see src/server/router.ts.
import { db } from "../db.ts";
import { event } from "../events.ts";
import { json } from "../json.ts";
import { bump } from "../push.ts";
import { answerAsk, createAsk, setTier, TierLocked } from "../asks.ts";
import type { Route } from "../router.ts";

const routes: Route[] = [
  { method: "POST", path: "/api/asks", handle: ({ body }) => ({ id: createAsk(body) }) },
  { method: "POST", pattern: /^\/api\/asks\/(\d+)\/answer$/, handle: ({ body, m }) => {
    answerAsk(Number(m[1]), String(body.answer ?? "").trim() || "done");
  } },
  // Raw, so that a tier change on a locked ask answers 409 rather than the router's 400.
  { method: "POST", pattern: /^\/api\/asks\/(\d+)\/tier$/, raw: true, handle: async ({ req, m }) => {
    const body = await req.json().catch(() => ({}));
    try {
      const out = setTier(Number(m[1]), body);
      bump();
      return json(out);
    } catch (e) {
      return json({ error: (e as Error).message }, e instanceof TierLocked ? 409 : 400);
    }
  } },
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
