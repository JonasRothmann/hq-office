// A conference room in the reader: one place per piece of work, opened from the stack's Rooms, a room's pill, a link
// to #room/SLUG, or a card. Its head names who sits at the table and the linked work; under it the brief (folded
// after 12 lines), the shelf as cards and the thread, newest at the foot; the send box is pinned at the reader's foot
// (write to the owning lane or any lane in the room; the server types it into that lane). The address says which
// room is open, so Esc, the close button and the browser's back button all leave it.
import { $, keepScroll, showEdges, toast } from "../core/dom.js";
import { CONFIG, S } from "../core/state.js";
import { clock, esc, setHTML } from "../core/format.js";
import { expanded } from "../core/text.js";
import { post } from "../core/net.js";
import { on } from "../core/bus.js";
import { STATUS_TEXT } from "../core/status.js";
import { clearImages, composer, hasImages, notReady, openPreview, withImages } from "../images/images.js";
import { markdown, FOLD } from "../core/markdown.js";
import { current, defineView, hide, show as showItem } from "../reader/shell.js";

const store = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} };
// Rooms 0.9 remembered the open room here, and 0.10 the rail's fold; a room's address is its #room/SLUG now.
store("hq-room", null);
store("hq-room-rail", null);

const view = document.createElement("section");
view.className = "rview roomview";
view.id = "roomView";
view.dataset.view = "room";
view.setAttribute("aria-label", "Conference room");
view.innerHTML = `<header class="rv-head">
    <div class="meta"><b class="rv-kind">ROOM</b><span class="who"></span><span class="works"></span><span class="spacer"></span><button class="x" type="button" data-room-back aria-label="Leave the room" title="Leave the room (Esc)">Esc</button></div>
    <h3 class="rv-title"></h3>
    <div class="rvseats" aria-label="At the table"></div>
  </header>
  <div class="rv-body rbody">
    <section class="rbrief"></section>
    <section class="rshelf"></section>
    <section class="rthread" aria-label="Thread"></section>
  </div>
  <footer class="rv-foot rsend"></footer>`;
const part = (cls) => view.querySelector(`.${cls}`);
const body = part("rbody"), thread = part("rthread");

let openSlug = null; // the room in the reader
const sending = new Set(); // rooms whose message is on its way
let detail = null; // the open room, as /api/rooms/SLUG gave it
let fetching = "";
let stick = true; // the room opens at its newest message
let sendFor = null; // the room the send box was built for
const fresh = new Set(); // lanes' messages that were new when shown: tinted until you leave the room
const seenSent = new Map(); // slug -> the rev a "seen" was sent for
const briefOpen = new Set(); // rooms whose long brief is unfolded
// Unsent text per room, its To and the message it replies to; kept across a reload.
const drafts = new Map((() => { try { return JSON.parse(sessionStorage.getItem("hq-room-drafts") || "[]"); } catch { return []; } })());
const keepDrafts = () => { try { sessionStorage.setItem("hq-room-drafts", JSON.stringify([...drafts].filter(([, d]) => d.text || d.reply || d.to))); } catch {} };
addEventListener("pagehide", keepDrafts);
document.addEventListener("visibilitychange", () => { if (document.hidden) keepDrafts(); });
const draft = (slug) => drafts.get(slug) ?? drafts.set(slug, { text: "", to: "", reply: null }).get(slug);
const key = (slug) => `room:${slug}`;

export const roomOf = (slug) => (S?.rooms ?? []).find((r) => r.slug === slug) ?? null;
const short = (s, n) => { const t = String(s ?? "").replace(/```[\s\S]*?```/g, "[code]").replace(/\[image: [^\]]+\]/g, "[image]").replace(/\s+/g, " ").trim(); return t.length > n ? t.slice(0, n - 1) + "…" : t; };
export function ago(t) { const m = Math.floor((Date.now() - t) / 60000), h = Math.floor(m / 60); return m < 1 ? "NOW" : h < 1 ? `${m}M AGO` : h < 48 ? `${h}H AGO` : `${Math.floor(h / 24)}D AGO`; }

// ---- lanes: level, status, away ----

function laneInfo(name) {
  if (name === "hq") return { level: "HQ", label: "HQ", color: "#23233a", away: false };
  const l = (S?.lanes ?? []).find((x) => x.name === name);
  if (!l) return { level: "", label: "Not registered", color: "#6a6a82", away: true };
  const [label, color] = STATUS_TEXT[l.status] ?? [l.status, "#6a6a82"];
  // Away as the server decides it: herdr found no agent by this name (a lane can be away with a question open).
  return { level: l.level || "", label: l.herdr === "gone" ? `${label}, agent away` : label, color, away: l.herdr === "gone" };
}
export function laneChip(name, role = "") {
  const i = laneInfo(name);
  const sel = name === "hq" ? "" : ` data-select="${esc(name)}"`;
  return `<button class="rlane${i.away ? " away" : ""}" type="button"${sel} title="${esc(`${name}: ${i.label}`)}"><i style="background:${i.color}"></i><b>${esc(name)}</b>${i.level ? `<span class="lv">${esc(i.level.toUpperCase())}</span>` : ""}${role ? `<span class="role">${role}</span>` : ""}${i.away ? `<span class="aw">AWAY</span>` : ""}</button>`;
}

// ---- linked work, with its state on the work board ----

const WS = { stalled: "STALLED", owner: "WAITING ON YOU", ci: "WAITING ON CI", moving: "MOVING", paused: "PAUSED", done: "DONE" };
const WS_ORDER = ["stalled", "owner", "ci", "moving", "paused", "done"];
function work(r) {
  const items = S?.board?.items ?? [];
  return [
    ...r.issues.map((k) => ({ kind: "issue", key: k, item: items.find((i) => i.issue === k) ?? null })),
    ...r.prs.map((k) => { const item = items.find((i) => i.prs.some((p) => p.key === k)) ?? null; return { kind: "pr", key: k, item, pr: item?.prs.find((p) => p.key === k) ?? null }; }),
  ];
}
// The most urgent state among a room's work.
export const workState = (r) => WS_ORDER.find((s) => work(r).some((w) => w.item?.state === s)) ?? null;
export const WORK_WORD = WS;
function issueTag(k) {
  return CONFIG.linearWorkspace ? `<a class="tag key" href="https://linear.app/${esc(CONFIG.linearWorkspace)}/issue/${esc(k)}" target="_blank" rel="noopener">${esc(k)}</a>` : `<span class="tag key">${esc(k)}</span>`;
}
function prTag(k, p) {
  const num = k.split("#").pop(), repo = k.includes("#") ? k.split("#")[0] : CONFIG.githubRepo;
  const mark = !p ? "" : p.state === "MERGED" ? " MERGED" : p.state === "CLOSED" ? " CLOSED" : p.draft ? " DRAFT" : p.ci === "running" ? " CI…" : p.ci === "failed" ? " CI ✗" : p.state === "OPEN" ? " OPEN" : "";
  const cls = `tag pr${p?.state === "MERGED" ? " merged" : p?.draft ? " draft" : ""}`;
  return repo ? `<a class="${cls}" href="https://github.com/${esc(repo)}/pull/${esc(num)}" target="_blank" rel="noopener">#${esc(num)}${mark}</a>` : `<span class="${cls}">#${esc(num)}${mark}</span>`;
}
function workHtml(r) {
  return work(r).map((w) => {
    const state = w.item ? `<span class="tag ws ${esc(w.item.state)}" title="${esc(w.item.why)}">${esc(WS[w.item.state])}</span>` : `<span class="tag muted">NOT ON THE BOARD</span>`;
    // A PR's board state shows only when the room does not link its item's issue (which shows it already).
    const shown = w.kind === "issue" || !(w.item && r.issues.includes(w.item.issue));
    return `<span class="rwork">${w.kind === "issue" ? issueTag(w.key) : prTag(w.key, w.pr)}${shown ? state : ""}</span>`;
  }).join("");
}

// ---- the head: the room, its owner and work, who sits at the table ----

function renderHead(r) {
  setHTML(part("who"), `${laneChip(r.owner, "OWNER")}${r.members.length ? `<span class="plus">+${esc(r.members.length)} ${r.members.length === 1 ? "LANE" : "LANES"}</span>` : ""}${r.archivedAt ? `<span class="tag muted">ARCHIVED</span>` : ""}`);
  // A thread names the question or update it is on; that item opens in the reader, answered or not.
  setHTML(part("works"), r.thread ? `<button class="tag key" type="button" data-read="${esc(r.thread.kind)}:${esc(r.thread.ref)}">${r.thread.kind === "question" ? "QUESTION" : "UPDATE"} #${esc(r.thread.ref)}</button>` : workHtml(r));
  setHTML(part("rv-title"), esc(r.title));
  // The owner at the head of the table, then the owning lane and its members (a click selects one).
  setHTML(part("rvseats"), `<span class="k">AT THE TABLE</span><span class="rlane you" title="You, at the head of the table"><i></i><b>${esc(CONFIG.owner.trim() || "You")}</b><span class="role">HEAD</span></span>${[r.owner, ...r.members].map((n) => laneChip(n)).join("")}`);
}

// ---- the brief and the shelf ----

function renderBrief(d) {
  const head = `<div class="k"><span>BRIEF</span>${d?.briefAt ? `<span class="by">${esc(d.briefBy || "")} · ${esc(ago(d.briefAt))}</span>` : ""}</div>`;
  if (!d) { setHTML(part("rbrief"), head); return; }
  if (!d.brief) { setHTML(part("rbrief"), `${head}<div class="md none">No brief yet. The owning lane pins one with hud room brief ${esc(d.slug)}.</div>`); return; }
  // Folded after FOLD lines, so the thread is a short scroll away; unfolded, it stays so for this room.
  const lines = d.brief.split("\n").length, long = lines > FOLD, open = briefOpen.has(d.slug);
  setHTML(part("rbrief"), `${head}<div class="md${long && !open ? " clamp" : ""}">${markdown(d.brief)}</div>${long ? `<button class="more" type="button" data-brief-fold>${open ? "FOLD THE BRIEF" : `ALL ${esc(lines)} LINES`}</button>` : ""}`);
}

const icon = (paths) => `<svg viewBox="0 0 12 12" aria-hidden="true" shape-rendering="crispEdges">${paths}</svg>`;
const ICON = {
  "claude-artifact": icon(`<path d="M5 0h2v3H5zM5 9h2v3H5zM0 5h3v2H0zM9 5h3v2H9zM3 3h2v2H3zM7 3h2v2H7zM3 7h2v2H3zM7 7h2v2H7zM5 5h2v2H5z"/>`),
  link: icon(`<path d="M1 4h2v1H1zM0 5h1v3H0zM1 8h4v1H1zM5 5h1v3H5zM4 4h1v1H4zM6 3h4v1H6zM10 4h1v3h-1zM6 7h4v1H6zM6 4h1v3H6zM3 6h6v1H3z"/>`),
  file: icon(`<path d="M2 0h6v1H2zM8 1h1v1H8zM9 2h1v1H9zM10 3h1v9H10zM1 1h1v11H1zM2 11h8v1H2zM8 2h1v2h2v1H8zM3 5h5v1H3zM3 7h5v1H3zM3 9h4v1H3z"/>`),
};
const LABEL = { "claude-artifact": "CLAUDE ARTIFACT", link: "LINK", file: "FILE", image: "IMAGE" };
function host(u) { try { return new URL(u, location.href).host.replace(/^www\./, ""); } catch { return ""; } }
// A picture shows only when this HUD serves it (an upload or a room's file): one anywhere else is a link card, so a
// lane cannot make the owner's browser fetch an address it chose.
function ours(u) { try { const x = new URL(u, location.href); return x.origin === location.origin && /^\/(uploads|room-files)\//.test(x.pathname); } catch { return false; } }
function cardHtml(a) {
  const meta = `<span class="am">${esc(a.by || "")} · ${esc(ago(a.at))}</span>`;
  if (a.kind === "image" && ours(a.url)) {
    return `<div class="art image"><button type="button" class="aimg" data-art-preview="${esc(a.id)}" aria-label="See ${esc(a.title)} full screen"><img src="${esc(a.url)}" alt="" loading="lazy"></button><div class="at" title="${esc(a.title)}">${esc(a.title)}</div><div class="af">${meta}</div></div>`;
  }
  const kind = a.kind === "image" ? "link" : a.kind;
  const ext = kind === "file" ? (a.url.match(/\.([a-z0-9]{1,8})$/i)?.[1] ?? "").toUpperCase() : "";
  const label = kind === "file" ? `${ext || "FILE"} FILE` : kind === "link" ? host(a.url) || "LINK" : LABEL[kind];
  return `<div class="art ${esc(kind)}"><div class="ak">${ICON[kind] ?? ICON.link}<span>${esc(label)}</span></div><div class="at" title="${esc(a.title)}">${esc(a.title)}</div><div class="af">${meta}<a class="btn-s open" href="${esc(a.url)}" target="_blank" rel="noopener">OPEN</a></div></div>`;
}
function renderShelf(d) {
  const items = d?.artifactList ?? [];
  setHTML(part("rshelf"), `<div class="k"><span>SHELF${items.length ? ` (${items.length})` : ""}</span></div>${items.length
    ? `<div class="cards">${[...items].reverse().map(cardHtml).join("")}</div>`
    : `<div class="none">Nothing on the shelf yet. Lanes add Claude artifacts, links, images and files with hud room artifact.</div>`}`);
}

// ---- the thread ----

function deliveryHtml(m) {
  if (m.delivery === "sent") return `<span class="seen ok">DELIVERED</span>`;
  if (m.delivery === "away") return `<span class="seen kept" title="Kept: it goes to ${esc(m.to)} when herdr sees the lane again">AWAY · KEPT</span>`;
  if (m.delivery === "failed") return `<span class="seen bad" title="${esc(m.error || "")}">NOT DELIVERED</span><button class="btn-s" type="button" data-room-retry="${esc(m.id)}">RETRY</button>`;
  return `<span class="seen">SENDING…</span>`;
}
// A message's text as markdown with its line breaks kept. A long one without code shows its first part and MORE.
const LONG = 600;
function textHtml(m) {
  const t = m.text, k = `room${m.id}`;
  if (t.length <= LONG || t.includes("```")) return markdown(t, true);
  const open = expanded.has(k);
  return `${markdown(open ? t : t.slice(0, LONG).replace(/\s+\S*$/, "") + "…", true)}<button class="more" type="button" data-more="${esc(k)}">${open ? "LESS" : "MORE"}</button>`;
}
function messageHtml(m, byId, live) {
  const lane = m.who !== "owner";
  const p = m.reply ? byId.get(m.reply) : null;
  const quote = p ? `<div class="quote">↩ ${p.who === "owner" ? "you" : esc(p.who)} ${clock(p.at)}: ${esc(short(p.text, 80))}</div>` : m.reply ? `<div class="quote">↩ an earlier message</div>` : "";
  return `<article class="msg ${lane ? "lane" : "you"}${lane && (!m.read || fresh.has(m.id)) ? " unread" : ""}" data-rmsg="${esc(m.id)}">
      <div class="meta"><span class="who">${lane ? esc(m.who) : "YOU"}</span>${lane ? "" : `<span class="to">→ ${esc(m.to)}</span>`}<span class="tag">${esc(clock(m.at))}</span>${lane ? "" : deliveryHtml(m)}${lane && live ? `<button class="btn-s" type="button" data-room-reply="${esc(m.id)}">REPLY</button>` : ""}</div>
      ${quote}<div class="text md">${textHtml(m)}</div>
    </article>`;
}
let atEnd = true; // at the room's foot it stays there while the room settles around it (fonts, an image)
// The page's own move to the foot fires a scroll event a frame later, by when the room may have changed size: that
// event is not you scrolling away from the foot, so it leaves atEnd as it is.
let setTop = -1;
function toBottom() { body.scrollTop = body.scrollHeight; setTop = body.scrollTop; }
function renderThread(d, r) {
  if (!d) { setHTML(thread, `<div class="empty">LOADING…</div>`); return; }
  for (const m of d.messages) if (m.who !== "owner" && !m.read) fresh.add(m.id);
  const byId = new Map(d.messages.map((m) => [m.id, m]));
  const html = `<div class="k"><span>THREAD</span></div>` + (d.earlier ? `<div class="earlier">${esc(d.earlier)} EARLIER ${d.earlier === 1 ? "MESSAGE" : "MESSAGES"} NOT SHOWN</div>` : "")
    + (d.messages.map((m) => messageHtml(m, byId, !r.archivedAt)).join("") || `<div class="empty">No messages yet. Write to ${esc(r.owner)} below: it is typed into the lane, and its reply lands here.</div>`);
  // At the newest message (just opened, or within 40px of it), stay on it; reading older ones, what you read stays put.
  const pinned = stick || body.scrollHeight - body.scrollTop - body.clientHeight < 40, place = pinned ? null : keepScroll(body, "data-rmsg");
  setHTML(thread, html);
  if (pinned) toBottom(); else place();
  atEnd = pinned || body.scrollHeight - body.scrollTop - body.clientHeight < 40;
  stick = false;
  showEdges(body);
}

// ---- the send box ----

const lanesOf = (r) => [r.owner, ...r.members];
function renderSend(r) {
  const el = part("rsend");
  const d = draft(r.slug);
  if (!lanesOf(r).includes(d.to)) d.to = r.owner;
  if (r.archivedAt) {
    sendFor = null;
    setHTML(el, `<div class="none">This room is archived. HQ reopens it with hud room create ${esc(r.slug)}.</div>`);
    return;
  }
  const options = lanesOf(r).map((n) => `<option value="${esc(n)}"${n === d.to ? " selected" : ""}>${esc(n)}${n === r.owner ? " (owner)" : ""}${laneInfo(n).away ? " · away" : ""}</option>`).join("");
  if (sendFor !== r.slug) {
    sendFor = r.slug;
    el.innerHTML = `<div class="rto"><label>TO <select data-room-to aria-label="Send to">${options}</select></label><span class="tostate"></span></div>
      <div class="rquote"></div>
      ${composer(key(r.slug), `<textarea rows="1" placeholder="Write to the lane. ⌘↩ sends.">${esc(d.text)}</textarea>`, `<button class="send go" type="button" data-room-send>SEND</button>`)}`;
  } else {
    const sel = el.querySelector("[data-room-to]");
    if (sel.innerHTML !== options) { sel.innerHTML = options; sel.value = d.to; }
  }
  const away = laneInfo(d.to).away;
  setHTML(el.querySelector(".tostate"), away ? `<span class="aw">AWAY</span> kept until the lane is back` : `typed into ${esc(d.to)}`);
  const p = d.reply && detail?.messages.find((m) => m.id === d.reply);
  setHTML(el.querySelector(".rquote"), p ? `<span>↩ ${esc(p.who)} ${esc(clock(p.at))}: ${esc(short(p.text, 70))}</span><button class="btn-s" type="button" data-room-unreply aria-label="Do not reply to it">×</button>` : "");
  sendState();
}
function sendState() {
  const btn = part("rsend").querySelector("[data-room-send]");
  if (btn && openSlug) btn.disabled = sending.has(openSlug) || (!draft(openSlug).text.trim() && !hasImages(key(openSlug)));
}

// ---- drawing the room ----

function renderRoom() {
  const r = roomOf(openSlug);
  if (!r) return;
  const d = detail?.slug === r.slug ? detail : null;
  renderHead(r);
  renderBrief(d);
  renderShelf(d);
  renderThread(d, r);
  renderSend(r);
  // Seen: its lanes' messages stop counting as new (the tint stays until you leave the room).
  if (d && r.unread && seenSent.get(r.slug) !== r.rev && document.visibilityState === "visible") {
    seenSent.set(r.slug, r.rev);
    post(`/api/rooms/${encodeURIComponent(r.slug)}/seen`, {}).catch(() => seenSent.delete(r.slug));
  }
}

async function fetchRoom(slug) {
  const r = roomOf(slug);
  if (!r || (detail?.slug === slug && detail.rev === r.rev)) return;
  const want = `${slug}@${r.rev}`;
  if (fetching === want) return;
  fetching = want;
  try {
    const res = await fetch(`/api/rooms/${encodeURIComponent(slug)}`);
    if (res.ok && openSlug === slug) { detail = await res.json(); renderRoom(); }
  } catch {} finally { if (fetching === want) fetching = ""; }
}

defineView("room", {
  el: view,
  show(slug) {
    if (openSlug !== slug) { detail = null; fresh.clear(); stick = true; atEnd = true; sendFor = null; body.scrollTop = 0; }
    openSlug = slug;
    renderRoom();
    fetchRoom(slug);
  },
  render() { if (openSlug) { renderRoom(); fetchRoom(openSlug); } },
  focus() { part("rsend").querySelector("textarea")?.focus(); },
  close: () => leaveRoom(),
  // Another item took the reader, or it closed: the address stops naming the room.
  left() {
    openSlug = null;
    detail = null;
    fresh.clear();
    if (slugInHash()) history.replaceState(null, "", location.pathname + location.search);
  },
});

// ---- where you are: the address says it (#room/SLUG), and the reader follows it ----

const slugInHash = () => { const m = location.hash.match(/^#room\/([a-z0-9][a-z0-9-]{0,47})$/); return m ? m[1] : null; };
function route() {
  const slug = slugInHash();
  if (slug && !S) return; // a room's summary comes with the first state
  if (slug === openSlug && (!slug || current?.kind === "room")) return;
  if (slug && !roomOf(slug)) {
    toast(`NO ROOM ${slug.toUpperCase()}`);
    history.replaceState(null, "", location.pathname + location.search);
    if (current?.kind === "room") hide();
    return;
  }
  if (slug) showItem("room", slug);
  else if (current?.kind === "room") hide();
}
// Going to a room adds a step to the browser's history; moving from room to room replaces it, so one BACK always
// leaves the rooms.
export function goRoom(slug) {
  if (slugInHash() === slug) { route(); return; }
  const url = `${location.pathname}${location.search}#room/${slug}`;
  if (slugInHash()) history.replaceState(history.state, "", url);
  else history.pushState({ hqRoom: true }, "", url);
  route();
}
export function leaveRoom() {
  if (!slugInHash()) { if (current?.kind === "room") hide(); return; }
  if (history.state?.hqRoom) { history.back(); return; } // popstate routes
  history.replaceState(null, "", location.pathname + location.search);
  route();
}
// Another area (the stack) asks for a room through the bus: "room:go" (slug).
on("room:go", goRoom);
addEventListener("popstate", route);
addEventListener("hashchange", route);

// ---- sending ----

// A message clears only its own room's box: the reader may show another room by the time the server answers.
async function send(btn) {
  const slug = openSlug, d = draft(slug), k = key(slug);
  const text = withImages(k, d.text.trim());
  if (!text || sending.has(slug)) return;
  const wait = notReady(k);
  if (wait) { toast(wait); return; }
  sending.add(slug);
  btn.disabled = true;
  try {
    await post(`/api/rooms/${encodeURIComponent(slug)}/post`, { text, to: d.to, reply: d.reply });
    toast(laneInfo(d.to).away ? `KEPT FOR ${d.to.toUpperCase()}: IT IS AWAY.` : `SENT TO ${d.to.toUpperCase()}.`);
    d.text = "";
    d.reply = null;
    clearImages(k);
    sending.delete(slug);
    if (openSlug !== slug) return;
    const ta = part("rsend").querySelector("textarea");
    if (ta) ta.value = "";
    stick = true;
    renderSend(roomOf(slug));
  } catch (err) { sending.delete(slug); toast(err.message); sendState(); }
}

// ---- input ----

view.addEventListener("click", (e) => {
  const t = e.target;
  if (t.closest("[data-select]") || t.closest("a")) return; // a lane chip selects its worker; a link opens
  if (t.closest("[data-room-back]")) { leaveRoom(); return; }
  if (t.closest("[data-brief-fold]")) {
    if (briefOpen.has(openSlug)) briefOpen.delete(openSlug); else briefOpen.add(openSlug);
    renderBrief(detail);
    return;
  }
  const art = t.closest("[data-art-preview]");
  if (art) { const a = detail?.artifactList.find((x) => String(x.id) === art.dataset.artPreview); if (a) openPreview(a.url, a.title); return; }
  const reply = t.closest("[data-room-reply]");
  if (reply) {
    const m = detail?.messages.find((x) => String(x.id) === reply.dataset.roomReply), d = draft(openSlug);
    if (m) { d.reply = m.id; if (lanesOf(roomOf(openSlug)).includes(m.who)) d.to = m.who; }
    renderSend(roomOf(openSlug));
    part("rsend").querySelector("textarea")?.focus();
    return;
  }
  if (t.closest("[data-room-unreply]")) { draft(openSlug).reply = null; renderSend(roomOf(openSlug)); return; }
  const retry = t.closest("[data-room-retry]");
  if (retry) { retry.disabled = true; post(`/api/rooms/${encodeURIComponent(openSlug)}/messages/${retry.dataset.roomRetry}/retry`, {}).catch((err) => { toast(err.message); retry.disabled = false; }); return; }
  const sendBtn = t.closest("[data-room-send]");
  if (sendBtn) send(sendBtn);
});
view.addEventListener("keydown", (e) => {
  if (!e.target.closest?.(".rsend")) return;
  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); part("rsend").querySelector("[data-room-send]")?.click(); }
  if (e.key === "Escape" && openSlug && draft(openSlug).reply) { e.preventDefault(); draft(openSlug).reply = null; renderSend(roomOf(openSlug)); }
});
view.addEventListener("input", (e) => {
  if (e.target.tagName !== "TEXTAREA" || !openSlug || !e.target.closest(".rsend")) return;
  draft(openSlug).text = e.target.value;
  sendState();
});
view.addEventListener("change", (e) => {
  if (!e.target.matches("[data-room-to]") || !openSlug) return;
  draft(openSlug).to = e.target.value;
  renderSend(roomOf(openSlug));
});
const toEnd = () => { if (atEnd && openSlug) toBottom(); };
body.addEventListener("scroll", () => {
  if (body.scrollTop !== setTop) atEnd = body.scrollHeight - body.scrollTop - body.clientHeight < 40;
  setTop = -1;
  showEdges(body);
}, { passive: true });
body.addEventListener("load", toEnd, true);
new ResizeObserver(toEnd).observe(body);
on("attach", (k) => { if (openSlug && k === key(openSlug)) sendState(); });
on("more", (k) => { if (openSlug && String(k).startsWith("room") && detail) renderThread(detail, roomOf(openSlug)); });
on("state", (S, keys) => { if (!keys || keys.has("rooms")) route(); });
// The page loads this folder after main.js: the first state may be in already.
route();
// The page tells the test tools when this module has run.
window.__roomsReady = true;
