// The keys, live only while no text field has focus: J and K move through the stack, Enter opens, 1 to 9 pick an
// option, R replies, ⌘Enter sends, E opens the tier menu, T is Tell HQ, Esc steps back, ? lists them.
import { $ } from "../core/dom.js";
import { drafts } from "./drafts.js";
import { askOf, canSend, pick, pickInReader, sendAnswer, sendInReader, toggleMenu } from "../reader/ask.js";
import { sendReplyInReader } from "../reader/update.js";
import { close, current } from "../reader/shell.js";
import { focused, move, open, openFocused } from "./stack.js";

const KEYS = [
  ["J / K", "Next or previous card. With the reader open, it follows."],
  ["Enter", "Open the card in the reader."],
  ["1 – 9", "Pick that option."],
  ["R", "Reply: open the card with the cursor in its box."],
  ["⌘ Enter", "Send the answer."],
  ["E", "The tier and priority menu."],
  ["T", "Tell HQ."],
  ["Esc", "Close the menu, then the reader, then the worker card."],
  ["?", "This list."],
];
let dialog = null;
function help() {
  if (!dialog) {
    dialog = document.createElement("dialog");
    dialog.className = "keys glass";
    dialog.innerHTML = `<h3>KEYS</h3><dl>${KEYS.map(([k, v]) => `<dt><kbd>${k}</kbd></dt><dd>${v}</dd>`).join("")}</dl><p>They work while no text field has the cursor.</p><form method="dialog"><button class="btn">CLOSE</button></form>`;
    dialog.addEventListener("click", (e) => { if (e.target === dialog) dialog.close(); });
    document.body.append(dialog);
  }
  dialog.showModal();
}

const typing = (t) => t instanceof HTMLElement && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable);
// The question the keys act on: the reader's, else the focused short card's.
function target() {
  if (current?.kind === "question") return { id: current.ref, inReader: true };
  const i = focused();
  return i?.kind === "question" ? { id: i.ref, inReader: false } : null;
}

document.addEventListener("keydown", (e) => {
  if (e.defaultPrevented || document.querySelector("dialog[open]")) return;
  const mod = e.metaKey || e.ctrlKey;
  if (e.key === "Escape") {
    const menu = document.querySelector("#reader .tiermenu[open]");
    if (menu) { e.preventDefault(); toggleMenu(); return; }
    if (typing(e.target)) { e.target.blur(); return; }
    if (!$("settings").hidden) return;
    if (current) { e.preventDefault(); close(); return; }
    $("card").setAttribute("data-closed", "");
    return;
  }
  if (typing(e.target) || e.altKey) return;
  if (e.key === "Enter" && mod) {
    e.preventDefault();
    if (current?.kind === "update") { sendReplyInReader(); return; }
    const t = target();
    if (t?.inReader) sendInReader();
    else if (t) { const a = askOf(t.id); if (a && canSend(a, drafts.get(a.id) || {})) sendAnswer(a.id, document.querySelector(`.ask[data-ask="${a.id}"] [data-quick]`)); }
    return;
  }
  if (mod) return;
  const k = e.key;
  if (k === "j" || k === "J") { e.preventDefault(); move(1); }
  else if (k === "k" || k === "K") { e.preventDefault(); move(-1); }
  else if (k === "Enter") { if (focused()) { e.preventDefault(); openFocused(); } }
  else if (/^[1-9]$/.test(k)) {
    const t = target();
    if (!t) return;
    e.preventDefault();
    if (t.inReader) pickInReader(Number(k) - 1);
    else { const a = askOf(t.id); if (a?.options[Number(k) - 1]) pick(a.id, a.options[Number(k) - 1]); }
  } else if (k === "r" || k === "R") {
    e.preventDefault();
    if (focused() && !current) openFocused({ focus: true });
    else document.querySelector("#reader .rview:not([hidden]) .rv-foot textarea")?.focus();
  } else if (k === "e" || k === "E") {
    const t = target();
    if (!t) return;
    e.preventDefault();
    if (!t.inReader) open(`question:${t.id}`);
    toggleMenu();
  } else if (k === "t" || k === "T") { e.preventDefault(); open("tell", { focus: true }); }
  else if (k === "?") { e.preventDefault(); help(); }
});
