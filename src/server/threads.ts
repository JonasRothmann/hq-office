// Threads: the owner replies to a lane on any question or update, and reopens an answered question. A thread is a room
// with a slug the HUD keeps (thread-q12 for question #12, thread-u5 for update #5), opened on the first reply with the
// item's lane as its owner. So a reply goes the rooms' way (typed into the lane by herdr, kept while the lane is away,
// RETRY when it failed) and the lane answers with hud room say. No table of its own (docs/decisions.md, D19).
import { OWNER } from "./config.ts";
import { db } from "./db.ts";
import { event } from "./events.ts";
import { notifyHq } from "./hq-link.ts";
import { ownerPost, room } from "./rooms.ts";

export type ItemKind = "question" | "update";
export const threadSlug = (kind: ItemKind, ref: number) => `thread-${kind === "question" ? "q" : "u"}${ref}`;

type Item = { lane: string | null; title: string };
function itemOf(kind: unknown, ref: number): Item & { kind: ItemKind } {
  if (kind !== "question" && kind !== "update") throw new Error("a thread is on a question or an update");
  const row = (kind === "question" ? db.query("SELECT lane, title FROM asks WHERE id = ?") : db.query("SELECT lane, title FROM updates WHERE id = ?")).get(ref) as Item | null;
  if (!row) throw new Error(`no ${kind} #${ref}`);
  return { ...row, kind };
}

// The thread's room, opened once. Its owner is the item's lane, or HQ for an item without one.
function open(kind: ItemKind, ref: number, item: Item) {
  const slug = threadSlug(kind, ref);
  if (!room(slug)) {
    db.query("INSERT OR IGNORE INTO rooms (slug, title, owner, created_at) VALUES (?, ?, ?, ?)").run(slug, `Re: ${item.title}`.slice(0, 200), item.lane || "hq", Date.now());
  }
  return slug;
}

// The owner's reply, to the item's lane (the default) or to HQ.
export function reply(kind: unknown, ref: number, body: any) {
  const item = itemOf(kind, ref);
  const lane = item.lane || "hq";
  const to = String(body.to ?? "").trim() || lane;
  if (to !== lane && to.toLowerCase() !== "hq") throw new Error(`a reply on this ${item.kind} goes to ${lane} or HQ`);
  const slug = open(item.kind, ref, item);
  return { slug, ...ownerPost(slug, { text: body.text, to, reply: body.reply }) };
}

// An answered question opens again. The answer is cleared so HQ and the lane wait for a new one; it stays in the thread
// (the lane is told there) and in the event log. A withdrawn question stays withdrawn: HQ took it back. The owner
// reopened it, so the owner holds it: a lead that answered it (D20) no longer does, and its hop stays closed.
export function reopen(id: number) {
  const ask = db.query("SELECT id, lane, title, status, answer FROM asks WHERE id = ?").get(id) as { id: number; lane: string | null; title: string; status: string; answer: string | null } | null;
  if (!ask) throw new Error(`no ask ${id}`);
  if (ask.status !== "answered") throw new Error(`ask ${id} is ${ask.status}: only an answered question can be reopened`);
  db.query("UPDATE asks SET status = 'open', answer = NULL, answered_at = NULL, answered_by = NULL, holder = NULL, acked_at = NULL WHERE id = ? AND status = 'answered'").run(id);
  event(OWNER, `reopened "${ask.title}" (the answer was: ${ask.answer ?? ""})`, ask.lane);
  const said = `${OWNER} reopened question #${id} ("${ask.title}"). The answer "${ask.answer ?? ""}" no longer stands; a new answer follows.`;
  const slug = open("question", id, ask);
  ownerPost(slug, { text: said, to: ask.lane || "hq" });
  if (ask.lane) notifyHq(`HUD ask #${id} (${ask.lane}): ${said}`, `ask:${id}`);
  return { id, slug };
}
