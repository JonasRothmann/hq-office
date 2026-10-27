// The thread on a question or an update in the reader: the owner's replies to the lane (or HQ) and the lane's answers,
// each reply with how its delivery went (SENDING, DELIVERED, AWAY · KEPT, NOT DELIVERED with RETRY). A thread is a room
// the server keeps for the item (src/server/threads.ts), so this reads it the way the room view does and sends through
// /api/threads. The To chip picks the lane or HQ.
import { emit, on } from "../core/bus.js";
import { S } from "../core/state.js";
import { clock, esc } from "../core/format.js";
import { markdown } from "../core/markdown.js";
import { post } from "../core/net.js";
import { toast } from "../core/dom.js";

const loaded = new Map(); // slug -> the room as /api/rooms/SLUG gave it
const fetching = new Set(); // slug@rev
const seenSent = new Map(); // slug -> the rev a "seen" was sent for
const tos = new Map(); // "question:12" -> "eng" or "hq": who the next reply goes to

const itemOf = (kind, ref) => (S?.inbox ?? []).find((i) => i.kind === kind && String(i.ref) === String(ref)) ?? null;
const roomOf = (slug) => (S?.rooms ?? []).find((r) => r.slug === slug) ?? null;
export const slugOf = (kind, ref) => itemOf(kind, ref)?.thread?.slug ?? roomOf(`thread-${kind === "question" ? "q" : "u"}${ref}`)?.slug ?? null;

// The room's messages, fetched again when its rev moves; "thread" on the bus says one came in.
function detail(slug) {
  const r = roomOf(slug), have = loaded.get(slug);
  if (r && (!have || have.rev !== r.rev) && !fetching.has(`${slug}@${r.rev}`)) {
    const want = `${slug}@${r.rev}`;
    fetching.add(want);
    fetch(`/api/rooms/${encodeURIComponent(slug)}`).then((res) => (res.ok ? res.json() : null)).then((d) => {
      if (d) { loaded.set(slug, d); emit("thread", slug); }
    }).catch(() => {}).finally(() => fetching.delete(want));
  }
  return have ?? null;
}

function deliveryHtml(slug, m) {
  if (m.delivery === "sent") return `<span class="seen ok">DELIVERED</span>`;
  if (m.delivery === "away") return `<span class="seen kept" title="Kept: it goes to ${esc(m.to)} when herdr sees the lane again">AWAY · KEPT</span>`;
  if (m.delivery === "failed") return `<span class="seen bad" title="${esc(m.error || "")}">NOT DELIVERED</span><button class="btn-s" type="button" data-thread-retry="${esc(m.id)}" data-slug="${esc(slug)}">RETRY</button>`;
  return `<span class="seen">SENDING…</span>`;
}
const messageHtml = (slug, m) => {
  const lane = m.who !== "owner";
  return `<article class="msg ${lane ? "lane" : "you"}${lane && !m.read ? " unread" : ""}" data-tmsg="${esc(m.id)}" data-delivery="${esc(m.delivery || "")}">
    <div class="meta"><span class="who">${lane ? esc(m.who === "hq" ? "HQ" : m.who) : "YOU"}</span>${lane ? "" : `<span class="to">→ ${esc(m.to === "hq" ? "HQ" : m.to)}</span>`}<span class="tag">${clock(m.at)}</span>${lane ? "" : deliveryHtml(slug, m)}</div>
    <div class="text md">${markdown(m.text, true)}</div>
  </article>`;
};

// The thread's section in the reader, empty until there is one. Seeing it marks the lane's messages read.
export function threadHtml(kind, ref) {
  const slug = slugOf(kind, ref);
  if (!slug) return "";
  const d = detail(slug), r = roomOf(slug);
  if (d && r?.unread && seenSent.get(slug) !== r.rev && document.visibilityState === "visible") {
    seenSent.set(slug, r.rev);
    post(`/api/rooms/${encodeURIComponent(slug)}/seen`, {}).catch(() => seenSent.delete(slug));
  }
  const msgs = d?.messages ?? [];
  return `<div class="k"><span>THREAD</span>${d?.earlier ? `<span class="by">${d.earlier} earlier not shown</span>` : ""}</div>${d ? msgs.map((m) => messageHtml(slug, m)).join("") : `<div class="empty">LOADING…</div>`}`;
}

// Who a reply goes to: the item's lane by default for a question, HQ for an update (it came from HQ).
export function toOf(kind, ref, lane) {
  const k = `${kind}:${ref}`, to = tos.get(k);
  return to === "hq" || (to && to === lane) ? to : kind === "update" || !lane ? "hq" : lane;
}
export function toHtml(kind, ref, lane) {
  const to = toOf(kind, ref, lane), away = lane && (S?.lanes ?? []).find((l) => l.name === lane)?.herdr === "gone";
  const opts = [...(lane ? [[lane, `${lane}${away ? " · away" : ""}`]] : []), ["hq", "HQ"]];
  const state = to === "hq" ? (kind === "update" ? "a note to HQ" : "typed into HQ") : away ? `<span class="aw">AWAY</span> kept until the lane is back` : `typed into ${esc(to)}`;
  return `<div class="rto"><label>TO <select data-thread-to="${esc(`${kind}:${ref}`)}" aria-label="Reply to">${opts.map(([v, t]) => `<option value="${esc(v)}"${v === to ? " selected" : ""}>${esc(t)}</option>`).join("")}</select></label><span class="tostate">${state}</span></div>`;
}

// Sends a reply into the thread. Resolves with the lane it went to; throws with the server's reason.
export async function sendReply(kind, ref, text, to) {
  const out = await post(`/api/threads/${kind}/${ref}`, { text, to });
  const away = to !== "hq" && (S?.lanes ?? []).find((l) => l.name === to)?.herdr === "gone";
  toast(away ? `KEPT FOR ${to.toUpperCase()}: IT IS AWAY.` : `SENT TO ${to === "hq" ? "HQ" : to.toUpperCase()}.`);
  return out;
}

document.addEventListener("change", (e) => {
  const sel = e.target.closest?.("[data-thread-to]");
  if (!sel) return;
  tos.set(sel.dataset.threadTo, sel.value);
  emit("thread-to", sel.dataset.threadTo);
});
document.addEventListener("click", (e) => {
  const b = e.target.closest?.("[data-thread-retry]");
  if (!b) return;
  b.disabled = true;
  post(`/api/rooms/${encodeURIComponent(b.dataset.slug)}/messages/${b.dataset.threadRetry}/retry`, {}).catch((err) => { toast(err.message); b.disabled = false; });
});
