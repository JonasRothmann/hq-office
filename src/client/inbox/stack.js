// The stack: the owner's inbox (S.inbox) as one floating list, as tall as its content. Blocking questions first, then
// open ones, then HQ's updates and the rooms. A short question is answered on its card; anything longer opens in the
// reader beside it. The filter (Needs you, All, Rooms) is kept in this browser.
import { on } from "../core/bus.js";
import { $, keepPlace, keepScroll, pageScrolls, toast } from "../core/dom.js";
import { S } from "../core/state.js";
import { esc, setHTML, setText } from "../core/format.js";
import { linkify } from "../core/text.js";
import { post } from "../core/net.js";
import { chime, messageChime } from "../sound/sound.js";
import { drafts, opened } from "./drafts.js";
import { age } from "./clock.js";
import { askOf, canSend, laneColor, pick, sendAnswer, sendLabel } from "../reader/ask.js";
import { close, current, show } from "../reader/shell.js";
import { goRoom } from "../rooms/index.js";

const list = $("hud"), below = $("below");
const FILTERS = ["needs", "all", "rooms"];
export let filter = (() => { try { const f = localStorage.getItem("hq-filter"); return FILTERS.includes(f) ? f : "needs"; } catch { return "needs"; } })();
export let focusKey = null; // the card J and K move between

export function setFilter(f) {
  if (!FILTERS.includes(f) || f === filter) return;
  filter = f;
  try { localStorage.setItem("hq-filter", f); } catch {}
  render();
}

const GROUPS = [
  ["blocking", "Blocking"],
  ["open", "Open"],
  ["updates", "From HQ"],
  ["rooms", "Rooms"],
];
// Needs you keeps the item the reader shows listed while it shows, even once it is read.
export const shown = () => {
  const reading = readerKey(current);
  return (S?.inbox ?? []).filter((i) => filter === "all" || (filter === "rooms" ? i.kind === "room" : i.needsYou || i.key === reading));
};
const PRIO = ["URGENT", "HIGH", "", "LOW"];

// ---- the cards ----

function shapeChips(i) {
  const s = i.shape ?? {}, out = [];
  if (s.lines > 3) out.push(`${s.lines} lines`);
  if (s.tables) out.push(s.tables === 1 ? "table" : `${s.tables} tables`);
  if (s.code) out.push(s.code === 1 ? "code" : `${s.code} code blocks`);
  if (i.links?.length) out.push(i.links.length === 1 ? "1 link" : `${i.links.length} links`);
  return out.map((t) => `<span class="shape">${esc(t)}</span>`).join("");
}
function laneHead(i) {
  return `<span class="dot" style="background:${laneColor(i.lane)}"></span><b class="lname">${esc(i.lane || "HQ")}</b>`;
}

function askCard(i) {
  const a = askOf(i.ref);
  if (!a) return "";
  const d = drafts.get(a.id) || {}, blocking = i.group === "blocking";
  const prio = PRIO[i.priority] ? `<span class="tag prio p${i.priority}">${PRIO[i.priority]}</span>` : "";
  const lock = blocking && i.locked ? `<span class="tag waits" title="${esc(i.lane)} cannot go on without the answer">${esc(i.lane)} waits</span>` : "";
  // Short: its options and the send button on the card. Long: a preview and what the reader holds.
  const quick = i.short
    ? `${a.options.length ? `<div class="sopts">${a.options.map((o, n) => `<button class="opt${d.opt === o ? " sel" : ""}" type="button" data-opt="${esc(o)}">${n < 9 ? `<kbd>${n + 1}</kbd>` : ""}${esc(o)}${a.recommended === o ? `<span class="pick">HQ PICK</span>` : ""}</button>`).join("")}</div>` : ""}
       <div class="qfoot"><button class="link" type="button" data-reply>Reply…</button><button class="send${a.kind !== "decision" ? " go" : ""}" type="button" data-quick${canSend(a, d) ? "" : " disabled"}>${sendLabel(a)}</button></div>`
    : `${i.preview ? `<p class="pv">${esc(i.preview)}</p>` : ""}<div class="shapes">${shapeChips(i)}<span class="open">Open ›</span></div>`;
  return `<article class="item ask${blocking ? " blocking" : ""}${i.short ? " short" : ""}" data-key="${esc(i.key)}" data-ask="${a.id}" data-lane="${esc(a.lane || "")}" data-created="${a.created_at}" data-due="${a.due || ""}">
    <div class="meta">${laneHead(i)}${prio}${lock}${(a.secrets ?? []).length ? `<span class="tag secret">SECRETS</span>` : ""}<span class="due"></span><span class="spacer"></span><span class="timer"></span></div>
    <h3 class="st">${linkify(i.title)}</h3>${quick}
  </article>`;
}
function updateCard(i) {
  return `<article class="item upd${i.unread ? " unread" : ""}" data-key="${esc(i.key)}" data-upd="${i.ref}">
    <div class="meta">${laneHead(i)}${i.unread ? `<span class="tag new">NEW</span>` : ""}<span class="spacer"></span><span class="age" data-since="${i.at}"></span></div>
    <h3 class="st">${linkify(i.title)}</h3>${i.preview && i.preview !== i.title ? `<p class="pv">${esc(i.preview)}</p>` : ""}
  </article>`;
}
function roomCard(i) {
  const r = (S.rooms ?? []).find((x) => x.slug === i.ref), n = r?.unread ?? 0;
  return `<article class="item rrow${n ? " unread" : ""}${r?.archivedAt ? " archived" : ""}" data-key="${esc(i.key)}" data-room="${esc(i.ref)}">
    <div class="meta"><span class="rk">ROOM</span><b class="lname">${esc(i.lane || "")}</b>${r?.members?.length ? `<span class="plus">+${r.members.length}</span>` : ""}${n ? `<span class="tag new">${n} NEW</span>` : ""}<span class="spacer"></span>${i.at ? `<span class="age" data-since="${i.at}"></span>` : ""}</div>
    <h3 class="st">${esc(i.title)}</h3>${i.preview ? `<p class="pv">${esc(i.preview)}</p>` : ""}
  </article>`;
}
const CARD = { question: askCard, update: updateCard, room: roomCard };

function emptyHtml() {
  if (filter === "rooms") return `<div class="empty"><b>No rooms yet.</b>HQ opens one with hud room create.</div>`;
  if (filter === "all") return `<div class="empty"><b>Nothing here yet.</b>Questions, HQ's updates and rooms land here.</div>`;
  return `<div class="empty"><b>Nothing waits on you.</b>Every worker is at its desk or waiting on HQ or CI. Questions land here.</div>`;
}

export function render() {
  if (!S?.inbox) return;
  const items = shown();
  for (const b of $("filters").querySelectorAll("[data-filter]")) {
    b.classList.toggle("on", b.dataset.filter === filter);
    b.setAttribute("aria-selected", String(b.dataset.filter === filter));
  }
  const needs = S.inbox.filter((i) => i.kind === "question").length, rooms = S.inbox.filter((i) => i.kind === "room" && i.unread).length;
  setText($("fNeeds"), needs || "");
  setText($("fRooms"), rooms || "");
  const unreadUpdates = items.some((i) => i.kind === "update" && i.unread);
  const html = items.length ? GROUPS.map(([g, label]) => {
    const its = items.filter((i) => i.group === g);
    if (!its.length) return "";
    const action = g === "updates" && unreadUpdates ? `<button class="link" type="button" data-readall>Mark all read</button>` : "";
    return `<div class="grp ${g}"><h4>${label} <span class="n">${its.length}</span></h4>${action}</div>${its.map((i) => CARD[i.kind](i)).join("")}`;
  }).join("") : emptyHtml();
  // What you read stays put: on a desktop the list scrolls itself, under 1151px the page does.
  const place = pageScrolls() ? keepPlace(list, "data-key") : keepScroll(list, "data-key");
  setHTML(list, html);
  place();
  if (focusKey && !items.some((i) => i.key === focusKey)) focusKey = null;
  marks();
  renderBelow();
}
// The focused card (J and K) and the one the reader shows.
export const readerKey = (c) => (c ? `${c.kind === "question" ? "ask" : c.kind}:${c.ref}` : null);
function marks() {
  const on = readerKey(current);
  for (const el of list.querySelectorAll(".item")) {
    el.classList.toggle("focus", el.dataset.key === focusKey);
    el.classList.toggle("on", el.dataset.key === on);
  }
}

// A question below the fold: a red pill at the stack's foot goes to the next one.
export function renderBelow() {
  const edge = list.getBoundingClientRect().bottom;
  const hidden = [...list.querySelectorAll(".ask")].filter((el) => el.getBoundingClientRect().bottom > edge + 1);
  below.hidden = !hidden.length || list.scrollHeight <= list.clientHeight;
  setText(below, `+${hidden.length} ${hidden.length === 1 ? "QUESTION" : "QUESTIONS"} OUT OF VIEW`);
  below.onclick = () => hidden[0]?.scrollIntoView({ behavior: "smooth", block: "start" });
}
list.addEventListener("scroll", renderBelow, { passive: true });
new ResizeObserver(renderBelow).observe(list);

// ---- opening, moving, answering ----

const itemByKey = (key) => (S?.inbox ?? []).find((i) => i.key === key) ?? null;
// Opens an item in the reader: "question:12", "update:5", "room:slug", or a pill's "tell" and "work".
export function open(key, opts = {}) {
  const [kind, ...rest] = String(key).split(":"), ref = rest.join(":");
  if (kind === "room") { goRoom(ref); if (opts.focus) setTimeout(() => document.querySelector("#roomView .rsend textarea")?.focus(), 0); return; }
  if (kind === "question" || kind === "ask") show("question", Number(ref), opts);
  else if (kind === "update") show("update", Number(ref), opts);
  else show(kind, null, opts);
}
const keyToReader = (key) => key.replace(/^ask:/, "question:");
// J and K: the next or previous card; the reader follows when it is open.
export function move(step) {
  const keys = shown().map((i) => i.key);
  if (!keys.length) return;
  const from = focusKey ?? readerKey(current);
  const at = keys.indexOf(from);
  focusKey = keys[at < 0 ? (step > 0 ? 0 : keys.length - 1) : Math.max(0, Math.min(keys.length - 1, at + step))];
  marks();
  list.querySelector(`[data-key="${CSS.escape(focusKey)}"]`)?.scrollIntoView({ block: "nearest" });
  if (current && ["question", "update", "room"].includes(current.kind)) open(keyToReader(focusKey));
}
export const focused = () => itemByKey(focusKey);
export const openFocused = (opts) => { if (focusKey) open(keyToReader(focusKey), opts); };

list.addEventListener("click", async (e) => {
  const t = e.target;
  if (t.closest("[data-select]") || t.closest("a")) return;
  if (t.closest("[data-readall]")) { try { await post("/api/updates/read-all", {}); } catch (err) { toast(err.message); } return; }
  const card = t.closest(".item");
  if (!card) return;
  focusKey = card.dataset.key;
  const id = Number(card.dataset.ask);
  const opt = t.closest(".opt");
  if (opt && id) { pick(id, opt.dataset.opt); return; }
  const quick = t.closest("[data-quick]");
  if (quick && id) { sendAnswer(id, quick); return; }
  open(keyToReader(card.dataset.key), { focus: !!t.closest("[data-reply]") });
});
$("filters").addEventListener("click", (e) => { const b = e.target.closest("[data-filter]"); if (b) setFilter(b.dataset.filter); });

// A pick (here or in the reader) redraws that card's options and its send button.
on("draft", (id) => {
  const card = list.querySelector(`.ask.short[data-ask="${id}"]`), a = askOf(id);
  if (!card || !a) return;
  const d = drafts.get(id) || {};
  for (const b of card.querySelectorAll(".opt")) b.classList.toggle("sel", b.dataset.opt === d.opt);
  const send = card.querySelector("[data-quick]");
  if (send) send.disabled = !canSend(a, d);
});
on("reader", () => (filter === "needs" ? render() : marks()));

// ---- what is new: the chime, and the stack back on what needs you ----

let seenAsks = null, seenUpdates = null;
function announce(keys) {
  if (!keys || keys.has("open")) {
    const ids = new Set(S.open.map((a) => a.id));
    if (seenAsks && S.open.some((a) => !seenAsks.has(a.id))) { chime(); if (filter === "rooms") setFilter("needs"); }
    seenAsks = ids;
  }
  if (!keys || keys.has("updates")) {
    const unread = new Set((S.updates ?? []).filter((u) => !u.read_at).map((u) => u.id));
    if (seenUpdates && [...unread].some((id) => !seenUpdates.has(id))) messageChime();
    seenUpdates = unread;
  }
}

on("state", (S, keys) => {
  announce(keys);
  if (!keys || keys.has("inbox") || keys.has("open") || keys.has("lanes")) render();
});

// The top bar's FROM HQ opens the newest update (or All, to show them).
document.addEventListener("click", (e) => {
  const go = e.target.closest("[data-go]");
  if (go?.dataset.go === "updates") {
    const u = (S?.inbox ?? []).find((i) => i.kind === "update" && i.unread) ?? (S?.inbox ?? []).find((i) => i.kind === "update");
    if (!u?.unread && filter !== "all") setFilter("all");
    if (u) open(`update:${u.ref}`);
    return;
  }
  const read = e.target.closest("[data-read]");
  if (read) { open(read.dataset.read); return; }
  const pill = e.target.closest("[data-open]");
  if (pill) {
    const kind = pill.dataset.open;
    if (current?.kind === kind) { close(); return; }
    open(kind, { focus: kind === "tell" });
  }
});
// The reader the page had open before a reload opens again once the state is in.
const reopen = opened;
if (reopen) { const off = on("state", () => { off(); if (reopen.kind !== "room") open(`${reopen.kind}:${reopen.ref ?? ""}`.replace(/:$/, "")); }); }
