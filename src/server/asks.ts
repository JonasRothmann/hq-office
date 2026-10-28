// Asks: HQ's questions, and answering them.
import { checkMinutes, checkName, checkValue } from "./secrets.ts";
import { expiresText } from "../client/secrets/expiry.js";
import { OWNER } from "./config.ts";
import { db } from "./db.ts";
import type { Ask } from "./types.ts";
import { secrets } from "./push.ts";
import { event } from "./events.ts";
import { notifyHq } from "./hq-link.ts";
import { leads } from "./ask-routes.ts";
import { answerNotice, routeOf } from "./lead-router.ts";

// ---- tiers: blocking or not, and a priority (docs/spec-3d-office.md, section 2) ----

export const TIERS = ["blocking", "nonblocking"] as const;
export type Tier = (typeof TIERS)[number];
export const PRIORITIES = ["urgent", "high", "normal", "low"] as const; // the index is the stored number

function tierOf(v: unknown): Tier | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  if (!TIERS.includes(v as Tier)) throw new Error("tier must be blocking or nonblocking");
  return v as Tier;
}

// A name (urgent, high, normal, low) or its number (0 to 3).
function priorityOf(v: unknown): number | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  const byName = PRIORITIES.indexOf(String(v).toLowerCase() as (typeof PRIORITIES)[number]);
  if (byName >= 0) return byName;
  const n = Number(v);
  if (Number.isInteger(n) && n >= 0 && n < PRIORITIES.length) return n;
  throw new Error("priority must be urgent, high, normal or low");
}

// When an answer is due, as ms since 1970, or null. The page puts it in an HTML attribute, so only a number is stored
// (review finding 1). hud sends ms; a caller may also send digits, HH:MM (today, local time, as hud reads it) or an ISO
// date or date-time (Date.parse reads it; without a zone, a date-time is local). Anything else is refused, and the
// route answers 400. Only ISO goes to Date.parse, because Bun's reads "-5" or "x 1" as a date.
const DUE_HELP = "due must be a time: HH:MM today, a date or date-time such as 2026-11-02 or 2026-11-02T17:00, or ms since 1970";
const ISO = /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;
function dueOf(v: unknown): number | null {
  if (v === undefined || v === null || v === "") return null;
  let at = NaN;
  if (typeof v === "number") at = v;
  else if (typeof v === "string") {
    const s = v.trim();
    const hhmm = s.match(/^(\d{1,2}):(\d{2})$/);
    if (/^\d+$/.test(s)) at = Number(s);
    else if (hhmm) at = Number(hhmm[1]) < 24 && Number(hhmm[2]) < 60 ? new Date().setHours(Number(hhmm[1]), Number(hhmm[2]), 0, 0) : NaN;
    else if (ISO.test(s)) at = Date.parse(s);
  }
  if (!Number.isFinite(at) || at <= 0) throw new Error(DUE_HELP);
  return Math.round(at);
}

// A tier change refused because the asking lane locked the ask as blocking; the route answers 409.
export class TierLocked extends Error {}

export function createAsk(body: any) {
  return askAndRoute(body).id;
}

// Writes the ask, then routes it: to the asking lane's lead first, or to the owner (decision D20). `to` is lead or
// owner; without it, the owner's askRoute setting decides (the owner by default).
export function askAndRoute(body: any) {
  if (!body.title) throw new Error("title is required");
  const to = routeOf(body.to);
  if (to === "lead" && !body.lane) throw new Error("--to lead needs --lane: the asking lane, whose lead gets it");
  const wanted = [...new Set<string>((body.secrets ?? []).map(checkName))];
  const tier = tierOf(body.tier) ?? "nonblocking";
  const priority = priorityOf(body.priority) ?? 2;
  const due = dueOf(body.due);
  // Never the caller's: an agent cannot backdate a question, or put a string where the page expects a time.
  const created = Date.now();
  // Whoever asks with --blocking cannot go on without the answer, so the ask is locked there (decision D3).
  const locked = tier === "blocking";
  const res = db
    .query("INSERT INTO asks (lane, kind, title, body, options, recommended, link, due, created_at, secrets, tier, priority, tier_locked, tier_by, tier_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .run(
      body.lane ?? null,
      body.kind ?? "decision",
      body.title,
      body.body ?? null,
      body.options?.length ? JSON.stringify(body.options) : null,
      body.recommended ?? null,
      body.link ?? null,
      due,
      created,
      wanted.length ? JSON.stringify(wanted) : null,
      tier,
      priority,
      locked ? 1 : 0,
      locked ? "lane" : null,
      locked ? created : null,
    );
  event("hq", `asked: ${body.title}`, body.lane);
  const id = Number(res.lastInsertRowid);
  return { id, ...leads.route(id, to) };
}

// The owner (no token, no `by`) or the lead holding it (the token typed in with it: hud answer --token T) answers. Any
// token or `by` makes the caller a lead, so a blank `by` is never the owner; a wrong or old token is Forbidden (403),
// checked first so the refusal says nothing about the ask. HQ hears every answer and who gave it. An ask that went to a
// lead has its answer typed into the asking lane, and HQ hears it is already there.
export function answerAsk(id: number, answer: string, as: { token?: unknown; by?: unknown } = {}) {
  const lead = as.token != null || as.by != null ? leads.authorize(id, as.token, as.by) : null;
  const ask = db.query("SELECT * FROM asks WHERE id = ?").get(id) as Ask | null;
  if (!ask) throw new Error(`no ask ${id}`);
  // The owner lost a race with the lead's answer: the page keeps the owner's text and offers it as a follow-up.
  if (ask.status === "answered" && ask.answered_by) throw new Error(`ask ${id} was answered first by ${ask.answered_by}: "${ask.answer}"`);
  if (ask.status !== "open") throw new Error(`ask ${id} is already ${ask.status}`);
  db.query("UPDATE asks SET status = 'answered', answer = ?, answered_at = ?, answered_by = ? WHERE id = ?").run(answer, Date.now(), lead, id);
  event(lead ?? OWNER, `answered "${ask.title}": ${answer}`, ask.lane);
  if (!leads.answered(id)) notifyHq(answerNotice({ ...ask, answer, answered_by: lead }), `ask:${id}`);
}

// The owner (from the page) or HQ (hud tier) moves an open ask between tiers or re-prioritises it. A locked ask
// cannot leave blocking. A move by the owner is told to HQ in one line, so it can tell the lane; HQ's own is not.
export function setTier(id: number, body: any) {
  const by = body.by;
  if (by !== "owner" && by !== "hq") throw new Error("by must be owner or hq");
  const tier = tierOf(body.tier);
  const priority = priorityOf(body.priority);
  if (tier === undefined && priority === undefined) throw new Error("nothing to change: give a tier (blocking or nonblocking) or a priority");
  const ask = db.query("SELECT * FROM asks WHERE id = ?").get(id) as Ask | null;
  if (!ask) throw new Error(`no ask ${id}`);
  if (ask.status !== "open") throw new Error(`ask ${id} is already ${ask.status}`);
  if (tier && tier !== ask.tier && ask.tier_locked)
    throw new TierLocked(`ask ${id} is locked as blocking: the lane that asked cannot go on without the answer, so it stays blocking until answered (its priority can still change)`);
  const next = { tier: tier ?? (ask.tier as Tier), priority: priority ?? (ask.priority as number) };
  const view = { id, tier: next.tier, priority: PRIORITIES[next.priority], locked: !!ask.tier_locked };
  if (next.tier === ask.tier && next.priority === ask.priority) return view;
  db.query("UPDATE asks SET tier = ?, priority = ?, tier_by = ?, tier_at = ? WHERE id = ?").run(next.tier, next.priority, by, Date.now(), id);
  const what = [next.tier !== ask.tier && `to ${next.tier}`, next.priority !== ask.priority && `priority ${PRIORITIES[next.priority]}`].filter(Boolean).join(", ");
  event(by === "owner" ? OWNER : "hq", `moved ask #${id} ${what}: ${ask.title}`, ask.lane);
  if (by === "owner") notifyHq(`HUD ask #${id}${ask.lane ? ` (${ask.lane})` : ""}: the owner set "${ask.title}" to ${next.tier}, priority ${PRIORITIES[next.priority]} (was ${ask.tier}, ${PRIORITIES[ask.priority]})`);
  // Raised to blocking urgent while a lead holds it: it goes to the owner now (decision D20).
  leads.retiered(id);
  return view;
}

// An ask that requests secrets is answered with their values: each one goes to the secret store, and the
// answer HQ gets (and the database keeps) names them only.
export function answerWithSecrets(id: number, body: any) {
  const ask = db.query("SELECT * FROM asks WHERE id = ?").get(id) as Ask | null;
  if (!ask) throw new Error(`no ask ${id}`);
  if (ask.status !== "open") throw new Error(`ask ${id} is already ${ask.status}`);
  const wanted: string[] = ask.secrets ? JSON.parse(ask.secrets) : [];
  if (!wanted.length) throw new Error(`ask ${id} requests no secrets`);
  const minutes = checkMinutes(body.minutes);
  const values = wanted.map((name) => {
    try {
      return checkValue(body.values?.[name]);
    } catch (e) {
      throw new Error(`${name}: ${(e as Error).message}`);
    }
  });
  const set = wanted.map((name, i) => secrets.set(name, values[i], minutes, "owner"));
  const note = String(body.note ?? "").trim();
  answerAsk(id, `secrets set: ${wanted.join(", ")}, ${expiresText(set[0].expiresAt)}; read with: hud secret get NAME | <command>${note ? `. ${note}` : ""}`);
}
