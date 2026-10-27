// An update from HQ in the reader: the whole body as markdown, its links as cards, the owner's replies under it, and
// a box to reply to HQ. Opening one marks it read. A reply is an ordinary note that starts with
//   re: #u12 ("first words of the update")
// so the server needs nothing new and HQ reads what the reply answers.
import { on } from "../core/bus.js";
import { toast } from "../core/dom.js";
import { S } from "../core/state.js";
import { clock, esc, setHTML } from "../core/format.js";
import { linkify } from "../core/text.js";
import { doc, markdown } from "../core/markdown.js";
import { post } from "../core/net.js";
import { replies } from "../inbox/drafts.js";
import { clearImages, composer, hasImages, notReady, withImages } from "../images/images.js";
import { itemOf, laneColor } from "./ask.js";
import { linkCards } from "./links.js";
import { defineView } from "./shell.js";

export const REF = /^re: #([un])(\d+)(?: \("([^"\n]*)"\))?[ \t]*/;
const short = (s, n) => { const t = String(s ?? "").replace(/```[\s\S]*?```/g, "[code]").replace(/\s+/g, " ").trim(); return t.length > n ? t.slice(0, n - 1) + "…" : t; };
const key = (id) => `upd:${id}`;
const updateOf = (id) => (S?.updates ?? []).find((u) => u.id === id) ?? null;
// Read here: the tint stays until another item is opened, so what was new still shows as new.
const fresh = new Set(), readSent = new Set();

const el = document.createElement("section");
el.className = "rview updview";
el.dataset.view = "update";
el.setAttribute("aria-label", "Update from HQ");
el.innerHTML = `<header class="rv-head"><div class="meta"></div><h3 class="rv-title"></h3></header>
  <div class="rv-body"><div class="doc md"></div><div class="lcards"></div><div class="replies"></div></div>
  <footer class="rv-foot"><div class="rcomp"></div></footer>`;
const part = (c) => el.querySelector(`.${c}`);
let shownId = null, compFor = null;

function render() {
  const u = updateOf(shownId);
  if (!u) { setHTML(part("rcomp"), `<div class="gone">This update is no longer listed.</div>`); compFor = null; return; }
  el.dataset.upd = u.id;
  if (!u.read_at && !readSent.has(u.id)) {
    readSent.add(u.id);
    fresh.add(u.id);
    post(`/api/updates/${u.id}/read`, {}).catch(() => readSent.delete(u.id));
  }
  setHTML(part("meta"), `<span class="dot" style="background:${laneColor(u.lane)}"></span>${u.lane ? `<button class="lname" type="button" data-select="${esc(u.lane)}">${esc(u.lane)}</button>` : `<b class="lname">HQ</b>`}<span class="tag">FROM HQ</span>${fresh.has(u.id) ? `<span class="tag new">NEW</span>` : ""}<span class="spacer"></span><span class="idt">${clock(u.at)}</span><button class="x" type="button" data-close aria-label="Close" title="Close (Esc)">Esc</button>`);
  setHTML(part("rv-title"), linkify(u.title));
  part("doc").hidden = !u.body;
  setHTML(part("doc"), u.body ? doc(u.body) : "");
  setHTML(part("lcards"), linkCards(itemOf(`update:${u.id}`)?.links));
  // The owner's replies to it, oldest first, and whether HQ has each one.
  const mine = (S.notes ?? []).map((n) => ({ n, r: n.text.match(REF) })).filter(({ r }) => r && r[1] === "u" && Number(r[2]) === u.id).sort((a, b) => a.n.at - b.n.at);
  setHTML(part("replies"), mine.length ? `<div class="k">YOUR REPLIES</div>${mine.map(({ n, r }) => `<article class="msg you" data-msg="n${n.id}"><div class="meta"><span class="who">YOU</span><span class="tag">${clock(n.at)}</span><span class="seen${n.acked_at ? " ok" : ""}">${n.acked_at ? "HQ HAS IT" : "NOT PICKED UP YET"}</span></div><div class="text md">${markdown(n.text.slice(r[0].length), true)}</div></article>`).join("")}` : "");
  if (compFor !== u.id) {
    compFor = u.id;
    part("rcomp").innerHTML = composer(key(u.id), `<textarea rows="1" placeholder="Reply to HQ about this. ⌘↩ sends.">${esc(replies.get(u.id) || "")}</textarea>`, `<button class="send go" type="button" data-rsend>REPLY</button>`);
  }
  sendState();
}
function sendState() {
  const b = part("rcomp").querySelector("[data-rsend]");
  if (b) b.disabled = !(replies.get(shownId) || "").trim() && !hasImages(key(shownId));
}

async function send(btn) {
  const u = updateOf(shownId), k = key(shownId);
  const text = withImages(k, (replies.get(shownId) || "").trim());
  if (!u || !text) return;
  const wait = notReady(k);
  if (wait) { toast(wait); return; }
  btn.disabled = true;
  try {
    await post("/api/notes", { text: `re: #u${u.id} ("${short(u.title || u.body, 50).replace(/"/g, "'")}") ${text}` });
    replies.delete(u.id);
    clearImages(k);
    const ta = part("rcomp").querySelector("textarea");
    if (ta) ta.value = "";
    toast("SENT TO HQ.");
  } catch (err) { toast(err.message); }
  sendState();
}

defineView("update", {
  el,
  show(id, { same }) {
    if (!same) { shownId = id; compFor = null; part("rv-body").scrollTop = 0; }
    render();
  },
  render(keys) { if (!keys || ["updates", "notes", "inbox", "lanes"].some((k) => keys.has(k))) render(); },
  focus() { el.querySelector(".rcomp textarea")?.focus(); },
  left() { fresh.clear(); },
});

el.addEventListener("click", (e) => { const b = e.target.closest("[data-rsend]"); if (b) send(b); });
el.addEventListener("input", (e) => { if (e.target.tagName === "TEXTAREA") { replies.set(shownId, e.target.value); sendState(); } });
el.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); const b = part("rcomp").querySelector("[data-rsend]"); if (b && !b.disabled) send(b); }
});
on("attach", (k) => { if (k === key(shownId)) sendState(); });
export const sendReplyInReader = () => { const b = part("rcomp").querySelector("[data-rsend]"); if (b && !b.disabled) send(b); };
