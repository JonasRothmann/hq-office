// Tell HQ in the reader: the note box at its foot with the last note and whether HQ has it, what was sent and
// answered today, and the secrets drop (names and deadlines only).
import { on } from "../core/bus.js";
import { $, toast } from "../core/dom.js";
import { S } from "../core/state.js";
import { clock, esc, setHTML } from "../core/format.js";
import { clipText, linkify } from "../core/text.js";
import { post } from "../core/net.js";
import { attachButton, chipsHTML, clearImages, hasImages, notReady, withImages } from "../images/images.js";
import { liveSecrets, lostSecrets, renderSecrets } from "../secrets/secrets.js";
import { scheduleTick } from "../inbox/clock.js";
import { defineView } from "./shell.js";

// Something HQ could not take yet (S.hq.held, see hq-link): said in red, not as "not picked up yet".
const held = (ref) => (S.hq?.held ?? []).some((h) => h.ref === ref);
const HELD = `<span style="color:var(--red)">· HELD: HQ isn't receiving</span>`;
function noteMark(n) {
  if (!n.acked_at && held(`note:${n.id}`)) return HELD;
  return `<span style="color:${n.acked_at ? "var(--green)" : "var(--amber)"}">${n.acked_at ? "· HQ has it" : "· not picked up yet"}</span>`;
}
// One list, newest first: your notes and HQ's answers interleaved by time.
function logRows() {
  const notes = S.notes.slice(0, 5).map((n) => ({ at: n.at, html: `<div><b>${clock(n.at)} YOU</b>${clipText(n.text, `n${n.id}`)} ${noteMark(n)}</div>` }));
  const answered = S.answered.slice(0, 8).map((a) => ({ at: a.answered_at, html: `<div><b>${clock(a.answered_at)} ${a.status === "withdrawn" ? "WITHDRAWN" : "ANSWERED"}</b>${esc(a.lane ? a.lane + ": " : "")}${linkify(a.title)} → <strong>${clipText(a.answer, `a${a.id}`)}</strong> ${held(`ask:${a.id}`) && !a.acked_at ? HELD : `<span style="color:${a.acked_at ? "var(--green)" : "var(--amber)"}">${a.status === "withdrawn" ? "" : a.acked_at ? "· HQ acted" : "· HQ to act"}</span>`}</div>` }));
  return [...notes, ...answered].sort((a, b) => (b.at ?? 0) - (a.at ?? 0)).map((r) => r.html).join("") || `<div class="none">Nothing yet today.</div>`;
}

function render() {
  if (!S) return;
  const n = S.notes[0];
  setHTML($("lastNote"), n ? `<b>LAST ${clock(n.at)}</b>${esc(n.text)} ${noteMark(n)}` : `<span class="none">Nothing sent yet today.</span>`);
  setHTML($("log"), logRows());
  const live = liveSecrets().length, lost = lostSecrets().length;
  setHTML($("secCount"), (live ? `<span class="tag secret">${live}</span>` : "") + (lost ? ` <span class="tag secret lost">${lost} LOST</span>` : ""));
  renderSecrets();
  scheduleTick(); // the secrets' countdowns need the page clock while they show
}

defineView("tell", {
  el: $("tellView"),
  show: render,
  render(keys) { if (!keys || ["notes", "answered", "secrets", "secretsLost", "hq"].some((k) => keys.has(k))) render(); },
  focus() { $("noteText").focus(); },
});
// The last note shows on the Tell HQ pill's view only, but a note can be sent before it was ever opened.
on("state", (S, keys) => { if (!keys || keys.has("notes") || keys.has("hq")) render(); });
on("more", render);

$("compose").addEventListener("submit", async (e) => {
  e.preventDefault();
  const typed = $("noteText").value.trim();
  if (!typed && !hasImages("note")) return;
  const wait = notReady("note");
  if (wait) { toast(wait); return; }
  try {
    await post("/api/notes", { text: withImages("note", typed) });
    $("noteText").value = "";
    $("noteText").style.height = "";
    clearImages("note");
    toast(S.hq?.ok === false ? "KEPT. HQ ISN'T RECEIVING; IT GOES WHEN HQ IS BACK." : "SENT TO HQ.");
  } catch (err) { toast(err.message); }
});
$("noteText").addEventListener("keydown", (e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); $("compose").requestSubmit(); } });
// The photo button, the same on every send box, and the images kept from before a reload.
document.querySelector("#compose .acts").insertAdjacentHTML("afterbegin", attachButton("note"));
setHTML(document.querySelector('[data-chips="note"]'), chipsHTML("note"));
