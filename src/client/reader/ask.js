// A question in the reader: who asks and how it waits (the tier and priority menu in the head), the whole body as
// markdown with folding sections, its links as cards, HQ's checklist and comments, then the options (1 to 9), the
// secrets it asks for and the answer box at the foot. Answering, here or from the stack, goes through sendAnswer.
import { emit, on } from "../core/bus.js";
import { toast } from "../core/dom.js";
import { S } from "../core/state.js";
import { STATUS_TEXT } from "../core/status.js";
import { clock, esc, setHTML } from "../core/format.js";
import { linkify } from "../core/text.js";
import { doc } from "../core/markdown.js";
import { post } from "../core/net.js";
import { drafts, secretDrafts } from "../inbox/drafts.js";
import { clearImages, composer, hasImages, imageKeys, notReady, withImages } from "../images/images.js";
import { editedTag, ledgerHtml, toggleOlder } from "../ledger/ledger.js";
import { linkCards } from "./links.js";
import { current, defineView, hide, show } from "./shell.js";

export const PRIORITIES = ["urgent", "high", "normal", "low"];
const PRIO_NAME = ["Urgent", "High", "Normal", "Low"];
export const askOf = (id) => S?.open.find((a) => a.id === id) ?? null;
export const itemOf = (key) => S?.inbox?.find((i) => i.key === key) ?? null;
export const sendLabel = (a) => (a.kind === "action" ? "DONE" : a.kind === "info" ? "OK" : "SEND");
export const laneColor = (name) => { const l = S?.lanes.find((x) => x.name === name); return (STATUS_TEXT[l?.status] ?? [null, "#8b8d98"])[1]; };
export const kindTag = (a) => `<span class="tag kind k-${esc(a.kind)}">${esc(String(a.kind).toUpperCase())}</span>`;

// An ask for secrets is answered with all of them, or (with none filled) in words, an image, or like any other ask.
export function canSend(a, d = drafts.get(a.id) || {}) {
  const want = a.secrets ?? [];
  const filled = want.filter((n) => secretDrafts.get(a.id)?.[n]).length;
  return want.length && filled ? filled === want.length : a.kind !== "decision" || !!d.opt || !!(d.text || "").trim() || hasImages(a.id);
}
// Sends in flight, by ask id: their buttons stay off until the server answers, whatever redraws them.
const sending = new Set();
// After an answer lands the reader moves on to the next question, and that one can have its send ready (an ACTION's
// DONE, an INFO's OK, a pick kept from before). A second ⌘Enter or a double click would answer it unseen. So a question
// the reader showed by itself is unconfirmed, and no send is ready until the owner does something to it: a click in
// its view, a pick, typing, R. No timer: it waits as long as the owner takes. A question the owner opened is confirmed.
const unconfirmed = new Set();
// Whether a send button is on: the answer is complete, it is not already on its way, and the owner has touched it.
export const ready = (a, d = drafts.get(a.id) || {}) => canSend(a, d) && !sending.has(a.id) && !unconfirmed.has(a.id);
// The owner did something to this question: it is confirmed.
export function touched(id) { if (unconfirmed.delete(id)) emit("draft", id); }
// Picks an option, or unpicks it; the stack and the reader both draw the pick.
export function pick(id, opt) {
  const d = drafts.get(id) || {};
  d.opt = d.opt === opt ? undefined : opt;
  drafts.set(id, d);
  unconfirmed.delete(id);
  emit("draft", id);
}
// The open questions in the stack's order: the one after id, else the one before it.
function nextQuestion(id) {
  const ids = (S?.inbox ?? []).filter((i) => i.kind === "question").map((i) => i.ref);
  const at = ids.indexOf(id);
  return ids[at + 1] ?? ids[at - 1] ?? null;
}

export async function sendAnswer(id, btn) {
  const ask = askOf(id);
  if (!ask || !ready(ask)) return;
  const d = drafts.get(id) || {};
  const wait = notReady(id);
  if (wait) { toast(wait); return; }
  const text = withImages(id, (d.text || "").trim());
  const answer = d.opt ? (text ? `${d.opt}. ${text}` : d.opt) : text || (ask.kind === "action" ? "done" : "seen");
  const values = secretDrafts.get(id);
  const next = nextQuestion(id);
  const reading = current?.kind === "question" && current.ref === id;
  sending.add(id);
  if (btn) btn.disabled = true;
  try {
    if (ask.secrets?.length && values && Object.values(values).some(Boolean)) {
      // Cleared at once, whatever the server says.
      secretDrafts.delete(id);
      for (const inp of el.querySelectorAll("[data-secret]")) inp.value = "";
      await post(`/api/asks/${id}/secrets`, { values, minutes: Number(d.minutes ?? 60), note: d.opt ? answer : text });
      toast("SECRETS SAVED. HQ HAS THE NAMES.");
    } else {
      await post(`/api/asks/${id}/answer`, { answer });
      toast("SENT. HQ HAS IT.");
    }
    drafts.delete(id);
    clearImages(id);
    sending.delete(id);
    // Answered from the reader: on to the next question, the way a list of them is read, unconfirmed.
    if (reading) { if (next != null && askOf(next)) show("question", next, { advanced: true }); else hide(); }
  } catch (err) {
    sending.delete(id);
    toast(err.message);
    emit("draft", id);
  }
}

// ---- the view ----

const el = document.createElement("section");
el.className = "rview askview";
el.dataset.view = "question";
el.setAttribute("aria-label", "Question");
el.innerHTML = `<header class="rv-head"><div class="meta"></div><h3 class="rv-title"></h3></header>
  <div class="rv-body"><div class="doc md"></div><div class="lcards"></div><div class="ledger"></div></div>
  <footer class="rv-foot"><div class="opts"></div><div class="asksec"></div><div class="rcomp"></div></footer>`;
const part = (c) => el.querySelector(`.${c}`);
let shownId = null, compFor = null, secFor = "", menuOpen = false, gone = false;

const LOCK = `<svg class="lock" viewBox="0 0 10 12" width="10" height="12" aria-hidden="true"><path d="M2.5 5V3.5a2.5 2.5 0 0 1 5 0V5" fill="none" stroke="currentColor" stroke-width="1.6"/><rect x="1" y="5" width="8" height="6.5" rx="1" fill="currentColor"/></svg>`;

// The head: the lane, where it sits, how it waits (a menu: the priority, the tier, who moved it), the ask's number and
// when it was asked.
function metaHtml(a) {
  const p = a.priority ?? 2, blocking = a.tier === "blocking", lane = a.lane ? esc(a.lane) : "";
  const l = S.lanes.find((x) => x.name === a.lane);
  const where = l?.level ? `${esc(String(l.level))}${l.path?.length ? ` · under ${esc(l.path[l.path.length - 1])}` : ""}` : "";
  const tier = blocking ? (a.tier_locked && lane ? `Blocking · ${lane} waits` : "Blocking") : lane ? `Open · ${lane} keeps working` : "Open";
  const at = a.tier_at ? ` ${new Date(a.tier_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hourCycle: "h23" })}` : "";
  const moved = a.tier_by && a.tier_by !== "lane" ? `<div class="moved">MOVED BY ${a.tier_by === "owner" ? "OWNER" : "HQ"}${at}</div>` : "";
  const move = a.tier_locked
    ? `<p class="lockwhy">${LOCK} ${lane || "The lane"} cannot go on without the answer, so it stays blocking until answered.</p>`
    : `<button class="btn-s tier-set" type="button" data-tier="${blocking ? "nonblocking" : "blocking"}">${blocking ? "MAKE NON-BLOCKING" : "MAKE BLOCKING"}</button>`;
  const menu = `<details class="tiermenu"${menuOpen ? " open" : ""}><summary title="Tier and priority (M)"><span class="tag tierchip${blocking ? " blocking" : ""}">${a.tier_locked ? LOCK : ""}${tier}</span><span class="tag prio p${p}">${PRIO_NAME[p]}</span></summary>
    <div class="pop"><div class="k">PRIORITY</div><div class="prios">${PRIORITIES.map((name, i) => `<button class="btn-s prio-set${i === p ? " on" : ""}" type="button" data-prio="${name}">${PRIO_NAME[i].toUpperCase()}</button>`).join("")}</div>
    <div class="k">TIER</div>${move}${moved}</div></details>`;
  return `<span class="dot" style="background:${laneColor(a.lane)}"></span>${a.lane ? `<button class="lname" type="button" data-select="${lane}">${lane}</button>` : `<b class="lname">HQ</b>`}${where ? `<span class="where">${where}</span>` : ""}${kindTag(a)}${menu}${editedTag(a.id)}${(a.secrets ?? []).length ? `<span class="tag secret">SECRETS</span>` : ""}<span class="due"></span><span class="spacer"></span><span class="idt">#${a.id} · asked ${clock(a.created_at)} · <span data-since="${a.created_at}"></span></span><button class="x" type="button" data-close aria-label="Close" title="Close (Esc)">Esc</button>`;
}

function optsHtml(a) {
  const d = drafts.get(a.id) || {};
  return a.options.map((o, i) => `<button class="opt${d.opt === o ? " sel" : ""}" type="button" data-opt="${esc(o)}">${i < 9 ? `<kbd>${i + 1}</kbd>` : ""}<span>${esc(o)}</span>${a.recommended === o ? `<span class="pick">HQ PICK</span>` : ""}</button>`).join("");
}

function secretsHtml(a) {
  const d = drafts.get(a.id) || {};
  return a.secrets.map((n) => `<label><span class="tag secret">${esc(n)}</span><input class="sin val" type="password" autocomplete="off" data-1p-ignore data-lpignore="true" data-bwignore placeholder="paste ${esc(n)}" data-secret="${esc(n)}"></label>`).join("")
    + `<label><span class="sk">READABLE FOR</span><input class="sin min" type="number" min="1" max="10080" step="1" autocomplete="off" data-secret-min value="${esc(d.minutes ?? 60)}"><span class="sk">MIN</span></label>`;
}

function render() {
  const a = askOf(shownId);
  if (!a) {
    // Answered somewhere else, or withdrawn: said once, and the box stays shut.
    if (!gone) { gone = true; setHTML(part("rcomp"), `<div class="gone">This question is no longer open.</div>`); part("opts").innerHTML = ""; part("asksec").innerHTML = ""; compFor = null; }
    return;
  }
  gone = false;
  el.dataset.ask = a.id;
  el.dataset.lane = a.lane || "";
  el.dataset.created = a.created_at;
  el.dataset.due = a.due || "";
  el.classList.toggle("blocking", a.tier === "blocking");
  setHTML(part("meta"), metaHtml(a));
  setHTML(part("rv-title"), linkify(a.title));
  part("doc").hidden = !a.body;
  setHTML(part("doc"), a.body ? doc(a.body) : "");
  setHTML(part("lcards"), linkCards(itemOf(`ask:${a.id}`)?.links));
  setHTML(part("ledger"), ledgerHtml(a.id));
  setHTML(part("opts"), optsHtml(a));
  // The secrets' inputs and the answer box are built once per question, so what is typed in them stays as it is.
  const sec = (a.secrets ?? []).join("\n");
  if (secFor !== `${a.id}:${sec}`) {
    secFor = `${a.id}:${sec}`;
    part("asksec").innerHTML = sec ? secretsHtml(a) : "";
    // Values being pasted are kept in memory only and put back as the input's value, never as markup.
    for (const inp of part("asksec").querySelectorAll("[data-secret]")) { const v = secretDrafts.get(a.id)?.[inp.dataset.secret]; if (v) inp.value = v; }
  }
  if (compFor !== a.id) {
    compFor = a.id;
    const d = drafts.get(a.id) || {};
    const hint = a.kind === "action" ? "Optional note for HQ" : a.options.length ? "Add detail, or your own answer" : "Your answer";
    part("rcomp").innerHTML = composer(a.id, `<textarea rows="1" placeholder="${hint}. ⌘↩ sends.">${esc(d.text || "")}</textarea>`, `<button class="send${a.kind !== "decision" ? " go" : ""}" type="button" data-send>${sendLabel(a)}</button>`);
  }
  const send = part("rcomp").querySelector("[data-send]");
  if (send) { send.disabled = !ready(a); send.textContent = sendLabel(a); send.title = unconfirmed.has(a.id) ? "Click or pick an option to answer this one" : ""; }
}

defineView("question", {
  el,
  show(id, { same, advanced }) {
    if (advanced) unconfirmed.add(id); else touched(id);
    if (!same) { shownId = id; compFor = null; secFor = ""; menuOpen = false; gone = false; part("rv-body").scrollTop = 0; }
    render();
  },
  render(keys) { if (!keys || ["open", "ledger", "inbox", "lanes"].some((k) => keys.has(k))) render(); },
  focus() { el.querySelector(".rcomp textarea")?.focus(); },
});
export const toggleMenu = () => { menuOpen = !menuOpen; render(); };
export const pickInReader = (n) => { const a = askOf(shownId); if (a?.options[n]) pick(a.id, a.options[n]); };
export const sendInReader = () => { const b = part("rcomp").querySelector("[data-send]"); if (b && !b.disabled) sendAnswer(shownId, b); };

// ---- input ----

el.addEventListener("click", async (e) => {
  const t = e.target;
  touched(shownId);
  const sum = t.closest(".tiermenu > summary");
  if (sum) { e.preventDefault(); toggleMenu(); return; }
  const opt = t.closest(".opt");
  if (opt) { pick(shownId, opt.dataset.opt); return; }
  const send = t.closest("[data-send]");
  if (send) { sendAnswer(shownId, send); return; }
  const more = t.closest("[data-ledger-more]");
  if (more) { toggleOlder(Number(more.dataset.ledgerMore)); render(); return; }
  // The owner moves an unlocked ask between tiers; HQ is told on the server. A locked one answers 409, said in a toast.
  const tier = t.closest(".tier-set");
  if (tier) {
    tier.disabled = true;
    try { await post(`/api/asks/${shownId}/tier`, { tier: tier.dataset.tier, by: "owner" }); }
    catch (err) { toast(err.message); tier.disabled = false; }
    return;
  }
  const prio = t.closest(".prio-set");
  if (prio && !prio.classList.contains("on")) {
    try { await post(`/api/asks/${shownId}/tier`, { priority: prio.dataset.prio, by: "owner" }); }
    catch (err) { toast(err.message); }
  }
});
el.addEventListener("input", (e) => {
  const a = askOf(shownId);
  if (!a) return;
  const d = drafts.get(a.id) || {};
  if (e.target.dataset.secretMin !== undefined) { d.minutes = e.target.value; drafts.set(a.id, d); }
  else if (e.target.dataset.secret !== undefined) secretDrafts.set(a.id, { ...secretDrafts.get(a.id), [e.target.dataset.secret]: e.target.value });
  else if (e.target.tagName === "TEXTAREA") { d.text = e.target.value; drafts.set(a.id, d); }
  else return;
  touched(a.id);
  part("rcomp").querySelector("[data-send]").disabled = !ready(a, d);
});
el.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); if (!e.repeat) sendInReader(); }
});

// A pick, from here or the stack, and a picked, uploaded or removed image can change what can be sent.
on("draft", (id) => { if (id === shownId) render(); });
on("attach", (key) => { if (key === String(shownId)) render(); });
// An edit that removed the picked option drops the pick, so SEND cannot send it; drafts of answered asks go.
on("state", (S, keys) => {
  if (keys && !keys.has("open")) return;
  for (const a of S.open) { const d = drafts.get(a.id); if (d?.opt && !a.options.includes(d.opt)) { delete d.opt; emit("draft", a.id); } }
  for (const id of unconfirmed) if (!S.open.some((a) => a.id === id)) unconfirmed.delete(id);
  for (const id of secretDrafts.keys()) if (!S.open.some((a) => a.id === id)) secretDrafts.delete(id);
  for (const key of imageKeys()) if (/^\d+$/.test(key) && !S.open.some((a) => String(a.id) === key)) clearImages(key);
});
