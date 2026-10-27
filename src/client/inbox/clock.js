// The page clock: how long each question has waited, due times, the oldest wait in the top bar, the blink, the
// secrets' countdowns. It wakes only for the next visible change, never on a fixed timer and never while hidden.
import { emit } from "../core/bus.js";
import { $ } from "../core/dom.js";
import { S } from "../core/state.js";
import { clock, dur, setClass, setText } from "../core/format.js";
import { renderSecretTimes } from "../secrets/secrets.js";

// "now", "14m", "2h 5m", "3d": a question's wait on its card, by the minute.
export function age(ms) {
  const m = Math.floor(Math.max(0, ms) / 60000), h = Math.floor(m / 60), d = Math.floor(h / 24);
  if (d) return `${d}d`;
  if (h) return m % 60 ? `${h}h ${m % 60}m` : `${h}h`;
  return m ? `${m}m` : "now";
}

const BLINKING = ".urgent.alert .count, .ask.hot .timer";
export function tick() {
  const now = Date.now();
  for (const el of document.querySelectorAll(".ask[data-created], .askview[data-created]")) {
    const waited = now - Number(el.dataset.created);
    el.classList.toggle("warm", waited > 5 * 60000 && waited <= 30 * 60000);
    el.classList.toggle("hot", waited > 30 * 60000);
    const t = el.querySelector(":scope .timer");
    if (t) setText(t, age(waited));
    const due = Number(el.dataset.due), de = el.querySelector(":scope .due");
    if (due && de) { setText(de, due > now ? `DUE ${clock(due)}` : `OVERDUE ${clock(due)}`); setClass(de, "due" + (due <= now ? " late" : "")); }
  }
  for (const el of document.querySelectorAll("[data-since]")) setText(el, age(now - Number(el.dataset.since)));
  if (S) {
    const own = S.open.filter((a) => !a.holder), oldest = own.length ? Math.min(...own.map((a) => a.created_at)) : null;
    const waited = oldest ? now - oldest : 0;
    setClass($("sOld"), "old" + (waited > 30 * 60000 ? " hot" : waited > 5 * 60000 ? " warm" : ""));
    setText($("sOld").querySelector(".v"), oldest ? dur(waited) : "-");
  }
  const phase = Math.floor(now / 250) % 4, step = phase === 0 ? "" : phase === 2 ? "blink-2" : "blink-1";
  for (const el of document.querySelectorAll(".blink-1, .blink-2")) if (!el.matches(BLINKING)) el.classList.remove("blink-1", "blink-2");
  for (const el of document.querySelectorAll(BLINKING)) { el.classList.toggle("blink-1", step === "blink-1"); el.classList.toggle("blink-2", step === "blink-2"); }
  renderSecretTimes();
  emit("tick");
}

// The next visible change: the oldest wait in the top bar by the second (under an hour), every other age by the
// minute, a due time passing, the next blink step while something blinks, a secret's countdown while it shows.
let timer = null;
export function scheduleTick() {
  clearTimeout(timer);
  timer = null;
  if (!S || document.hidden) return;
  const now = Date.now();
  let wait = Infinity;
  const own = S.open.filter((a) => !a.holder);
  if (own.length) {
    const waited = now - Math.min(...own.map((a) => a.created_at)), step = waited < 3600_000 ? 1000 : 60_000;
    wait = step - (waited % step);
  }
  for (const el of document.querySelectorAll("[data-created], [data-since]")) {
    const waited = now - Number(el.dataset.created ?? el.dataset.since);
    wait = Math.min(wait, 60_000 - (waited % 60_000));
  }
  for (const el of document.querySelectorAll("[data-due]")) { const due = Number(el.dataset.due); if (due > now) wait = Math.min(wait, due - now); }
  if (document.querySelector(BLINKING)) wait = Math.min(wait, 250 - (now % 250));
  if (!$("tellView").hidden && document.querySelector("#secretList [data-exp]")) wait = Math.min(wait, 1000 - (now % 1000));
  if (wait < Infinity) timer = setTimeout(() => { tick(); scheduleTick(); }, wait + 5);
}
document.addEventListener("visibilitychange", () => { if (!document.hidden && S) tick(); scheduleTick(); });
