// The glass shell's own small behaviour: the feed folds to its tab row (kept in this browser) and opens again when
// one of its tabs is asked for; Esc closes the worker card until a worker is selected again.
import { $ } from "../core/dom.js";

const KEY = "hq-feed-folded";
const feed = $("feed"), fold = $("feedFold"), card = $("card");

function setFolded(on) {
  feed.classList.toggle("folded", on);
  fold.setAttribute("aria-expanded", String(!on));
  fold.title = on ? "Open" : "Fold";
  try { if (on) localStorage.setItem(KEY, "1"); else localStorage.removeItem(KEY); } catch {}
}
setFolded((() => { try { return localStorage.getItem(KEY) === "1"; } catch { return false; } })());
fold.addEventListener("click", () => setFolded(!feed.classList.contains("folded")));

document.addEventListener("click", (e) => {
  // FROM HQ in the pill, or a feed tab: show what was asked for
  if (e.target.closest("[data-tab]") && feed.classList.contains("folded")) setFolded(false);
  if (e.target.closest("[data-select]")) card.removeAttribute("data-closed");
});
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape" || e.defaultPrevented || document.querySelector("dialog[open]")) return;
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
  card.setAttribute("data-closed", "");
});
