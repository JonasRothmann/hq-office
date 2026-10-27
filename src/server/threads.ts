// Threads: the owner replies to a lane on any question or update, and reopens an answered question. A thread is a room
// with a slug the HUD keeps (thread-q12 for question #12, thread-u5 for update #5), opened on the first reply and owned
// by the item's lane. So a reply goes the rooms' way (typed into the lane by herdr, kept while the lane is away,
// RETRY when it failed) and the lane answers with hud room say. No table of its own (docs/decisions.md, D19).
import { OWNER } from "./config.ts";
import { db } from "./db.ts";
import { event } from "./events.ts";
import { notifyHq } from "./hq-link.ts";
import { deliver, ownerWrite } from "./rooms.ts";
import { oneLine, quoteAgentText } from "../agent-text.ts";

export type ItemKind = "question" | "update";
export const threadSlug = (kind: ItemKind, ref: number) => `thread-${kind === "question" ? "q" : "u"}${ref}`;

type Item = { lane: string | null; title: string };
function itemOf(kind: unknown, ref: number): Item & { kind: ItemKind } {
  if (kind !== "question" && kind !== "update") throw new Error("a thread is on a question or an update");
  const row = (kind === "question" ? db.query("SELECT lane, title FROM asks WHERE id = ?") : db.query("SELECT lane, title FROM updates WHERE id = ?")).get(ref) as Item | null;
  if (!row) throw new Error(`no ${kind} #${ref}`);
  return { ...row, kind };
}

// The thread's room follows its item, set before every post into it: owned by the item's lane as it is now (HQ moves a
// question with hud update --lane), or HQ for an item without one, with no other member lane, and open again if HQ
// archived it. Opened on the first post.
function follow(kind: ItemKind, ref: number, item: Item) {
  const slug = threadSlug(kind, ref);
  db.query("INSERT INTO rooms (slug, title, owner, created_at) VALUES (?, ?, ?, ?) ON CONFLICT (slug) DO UPDATE SET title = excluded.title, owner = excluded.owner, archived_at = NULL")
    .run(slug, `Re: ${item.title}`.slice(0, 200), item.lane || "hq", Date.now());
  db.query("DELETE FROM room_members WHERE slug = ?").run(slug);
  return slug;
}

// The owner's reply, to the item's lane (the default) or to HQ.
export function reply(kind: unknown, ref: number, body: any) {
  const item = itemOf(kind, ref);
  const lane = item.lane || "hq";
  const to = String(body.to ?? "").trim() || lane;
  if (to !== lane && to.toLowerCase() !== "hq") throw new Error(`a reply on this ${item.kind} goes to ${lane} or HQ`);
  const { slug, id } = db.transaction(() => {
    const slug = follow(item.kind, ref, item);
    return { slug, id: ownerWrite(slug, { text: body.text, to, reply: body.reply }) };
  })();
  deliver(id);
  return { slug, id };
}

// An answered question opens again. The answer is cleared so HQ and the lane wait for a new one; it stays in the thread
// (the lane is told there) and in the event log. A withdrawn question stays withdrawn: HQ took it back. A checklist
// that closed itself stays closed: its items are done. The owner reopened it, so the owner holds it: a lead that
// answered it (D20) no longer does, and its hop stays closed. All or nothing: the reopen and the thread's message are
// written together, and only then typed into the lane and told to HQ.
const cut = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
export function reopen(id: number) {
  const ask = db.query("SELECT id, lane, title, status, answer, answered_by FROM asks WHERE id = ?").get(id) as { id: number; lane: string | null; title: string; status: string; answer: string | null; answered_by: string | null } | null;
  if (!ask) throw new Error(`no ask ${id}`);
  if (ask.status !== "answered") throw new Error(`ask ${id} is ${ask.status}: only an answered question can be reopened`);
  const items = db.query("SELECT COUNT(*) AS n, COUNT(done_at) AS done FROM ask_items WHERE ask_id = ?").get(id) as { n: number; done: number };
  if (items.n && items.done === items.n) {
    throw new Error(`question #${id} closed itself because every item on its checklist is done, so it cannot be reopened. To ask for more work, reply in its thread and HQ can ask a new question`);
  }
  // The title and the old answer are cut short, so the message always fits a room's cap (the event log keeps the whole
  // answer). A lead's answer (D20) is another agent's text: quoted, so no line of it reads as the HUD's own.
  const title = cut(oneLine(ask.title), 200);
  const answer = cut(ask.answer ?? "", 500);
  const said = ask.answered_by
    ? `${OWNER} reopened question #${id} ("${title}"). The answer ${oneLine(ask.answered_by)} gave no longer stands; a new answer follows. It was:\n${quoteAgentText(answer)}`
    : `${OWNER} reopened question #${id} ("${title}"). The answer "${answer}" no longer stands; a new answer follows.`;
  const { slug, message } = db.transaction(() => {
    db.query("UPDATE asks SET status = 'open', answer = NULL, answered_at = NULL, answered_by = NULL, holder = NULL, acked_at = NULL WHERE id = ? AND status = 'answered'").run(id);
    event(OWNER, `reopened "${ask.title}" (the answer was: ${ask.answer ?? ""})`, ask.lane);
    const slug = follow("question", id, ask);
    return { slug, message: ownerWrite(slug, { text: said, to: ask.lane || "hq" }) };
  })();
  deliver(message);
  if (ask.lane) notifyHq(`HUD ask #${id} (${oneLine(ask.lane)}): ${said}`, `ask:${id}`);
  return { id, slug };
}
