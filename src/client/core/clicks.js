// Clicks delegated from the whole document: select a worker, COPY on a code box, MORE/LESS on a clipped text (the
// bus hears "more" and the panel showing it draws it again).
import { select } from "../card/card.js";
import { copyCode, expanded } from "./text.js";
import { emit } from "./bus.js";

document.addEventListener("click", (e) => {
  const sel = e.target.closest("[data-select]");
  if (sel) { select(sel.dataset.select, true); return; }
  const copy = e.target.closest(".copy");
  if (copy) { copyCode(copy); return; }
  const more = e.target.closest(".more[data-more]");
  if (more) {
    const key = more.dataset.more;
    if (expanded.has(key)) expanded.delete(key); else expanded.add(key);
    emit("more", key);
  }
});
