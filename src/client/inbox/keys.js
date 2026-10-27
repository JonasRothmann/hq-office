// The keys, live only while no text field has focus: J and K move through the stack, Enter opens, 1 to 9 pick an
// option, R replies, ⌘Enter sends, M opens the tier menu, T is Tell HQ, Esc steps back, ? lists them. Q and E are the
// office's (they turn it). They act on one target, marked KEYS: the card used last, or the reader. A held key repeats
// only J and K: a repeated ⌘Enter, Enter or pick is dropped. ⌘U (attach) works in a text field too, and a dropped or
// pasted file goes to the same target.
import { $, toast } from "../core/dom.js";
import { S } from "../core/state.js";
import { openMenu, setDropTarget } from "../images/images.js";
import { askOf, pick, pickInReader, ready, sendAnswer, sendInReader, toggleMenu, touched } from "../reader/ask.js";
import { sendReplyInReader } from "../reader/update.js";
import { close, current } from "../reader/shell.js";
import { focused, keyTarget, move, open, openFocused } from "./stack.js";

const KEYS = [
  ["J / K", "Next or previous card. With the reader open, it follows."],
  ["Enter", "Open the selected card in the reader."],
  ["1 – 9", "Pick that option."],
  ["R", "Reply: open the card with the cursor in its box."],
  ["⌘ Enter", "Send the answer."],
  ["M", "The tier and priority menu."],
  ["T", "Tell HQ."],
  ["Q / E", "Turn the office a quarter."],
  ["Esc", "Close the menu, then the reader, then the worker card."],
  ["?", "This list."],
];
let dialog = null;
function help() {
  if (!dialog) {
    dialog = document.createElement("dialog");
    dialog.className = "keys glass";
    dialog.innerHTML = `<h3>KEYS</h3><dl>${KEYS.map(([k, v]) => `<dt><kbd>${k}</kbd></dt><dd>${v}</dd>`).join("")}</dl><p>They work while no text field has the cursor. Keys act on the card or reader marked KEYS: the one you used last. A file you drop or paste goes there too. A long question is answered only in the reader.</p><form method="dialog"><button class="btn">CLOSE</button></form>`;
    dialog.addEventListener("click", (e) => { if (e.target === dialog) dialog.close(); });
    document.body.append(dialog);
  }
  dialog.showModal();
}

const typing = (t) => t instanceof HTMLElement && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable);
// Enter on a control is the control's own.
const control = (t) => t instanceof Element && !!t.closest("a, button, summary, input, textarea, select, [role=tab], [role=button], [contenteditable]");
// The question the keys act on: the reader's when the reader is the target, else the target card's. A long card is
// answered only in the reader, so it is no target for ⌘Enter or 1 to 9.
function target() {
  const t = keyTarget();
  if (t?.where === "reader") return current?.kind === "question" ? { id: current.ref, inReader: true } : null;
  return t?.item?.kind === "question" ? { id: t.item.ref, inReader: false, short: t.item.short } : null;
}
const openFirst = () => toast("A LONG QUESTION IS ANSWERED IN THE READER: ENTER OPENS IT.");

// The send box of the keys' target, by its composer key: a question's id, "upd:ID", "room:SLUG", or Tell HQ's "note".
const BOX = { question: (ref) => String(ref), update: (ref) => `upd:${ref}`, room: (ref) => `room:${ref}`, tell: () => "note" };
function targetBox() {
  const t = keyTarget();
  const item = t?.where === "stack" ? t.item : t?.where === "reader" && current ? { kind: current.kind, ref: current.ref } : null;
  if (!item || !BOX[item.kind]) return { key: "note", title: "Tell HQ", el: null };
  const title = item.kind === "tell" ? "Tell HQ" : (S?.inbox ?? []).find((i) => i.kind === item.kind && String(i.ref) === String(item.ref))?.title ?? "";
  const el = t.where === "stack" ? document.querySelector(`#hud .item[data-key="${CSS.escape(t.item.key)}"]`) : $("reader");
  return { key: BOX[item.kind](item.ref), title, el };
}
setDropTarget(targetBox);
// ⌘U: the + menu of the box with the cursor, else of the keys' target, opened in the reader when the stack shows no box.
function attachKey(e) {
  const box = e.target.closest?.("[data-composer]");
  if (box) { openMenu(box.dataset.composer); return; }
  const t = targetBox();
  if (openMenu(t.key)) return;
  if (keyTarget()?.where === "stack") openFocused(); else open("tell");
  setTimeout(() => openMenu(targetBox().key), 0);
}

document.addEventListener("keydown", (e) => {
  if (e.defaultPrevented || document.querySelector("dialog[open]")) return;
  const mod = e.metaKey || e.ctrlKey;
  if (mod && !e.altKey && !e.shiftKey && (e.key === "u" || e.key === "U")) { e.preventDefault(); if (!e.repeat) attachKey(e); return; }
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
    if (e.repeat) return;
    if (keyTarget()?.where === "reader" && current?.kind === "update") { sendReplyInReader(); return; }
    const t = target();
    if (!t) return;
    if (t.inReader) { sendInReader(); return; }
    if (!t.short) { openFirst(); return; }
    const a = askOf(t.id);
    if (a && ready(a)) sendAnswer(a.id, document.querySelector(`.ask[data-ask="${a.id}"] [data-quick]`));
    return;
  }
  if (mod) return;
  const k = e.key;
  if (k === "j" || k === "J") { e.preventDefault(); move(1); return; }
  if (k === "k" || k === "K") { e.preventDefault(); move(-1); return; }
  if (e.repeat) return;
  if (k === "Enter") { if (!control(e.target) && focused()) { e.preventDefault(); openFocused(); } }
  else if (/^[1-9]$/.test(k)) {
    const t = target();
    if (!t) return;
    e.preventDefault();
    if (t.inReader) pickInReader(Number(k) - 1);
    else if (!t.short) openFirst();
    else { const a = askOf(t.id); if (a?.options[Number(k) - 1]) pick(a.id, a.options[Number(k) - 1]); }
  } else if (k === "r" || k === "R") {
    e.preventDefault();
    if (keyTarget()?.where === "stack") openFocused({ focus: true });
    else { if (current?.kind === "question") touched(current.ref); document.querySelector("#reader .rview:not([hidden]) .rv-foot textarea")?.focus(); }
  } else if (k === "m" || k === "M") {
    const t = target();
    if (!t) return;
    e.preventDefault();
    if (!t.inReader) open(`question:${t.id}`);
    toggleMenu();
  } else if (k === "t" || k === "T") { e.preventDefault(); open("tell", { focus: true }); }
  else if (k === "?") { e.preventDefault(); help(); }
});
