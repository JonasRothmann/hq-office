// The reader: one item in full, beside the stack and never over it (on a phone, a full-screen sheet). A view is the
// reader's part for one kind of item (a question, an update, a room, Tell HQ, the work board); one shows at a time.
// The bus hears "reader" ({ kind, ref } or null) whenever what it shows changes.
import { emit, on } from "../core/bus.js";
import { $ } from "../core/dom.js";
import { setOpened } from "../inbox/drafts.js";

const reader = $("reader");
const views = new Map(); // kind -> { el, show(ref, opts), render(keys), focus(), close(), left() }
export let current = null;
const narrow = matchMedia("(max-width: 1150px)");

export function defineView(kind, view) {
  views.set(kind, view);
  if (!reader.contains(view.el)) reader.append(view.el);
  view.el.hidden = true;
}

// Shows an item; { focus: true } puts the cursor in its answer box.
export function show(kind, ref = null, opts = {}) {
  const view = views.get(kind);
  if (!view) return;
  const was = current, same = was?.kind === kind && was?.ref === ref;
  if (was && was.kind !== kind) views.get(was.kind)?.left?.();
  current = { kind, ref };
  setOpened(current);
  for (const [k, v] of views) v.el.hidden = k !== kind;
  reader.hidden = false;
  reader.dataset.view = kind;
  document.documentElement.classList.add("reading");
  view.show(ref, { ...opts, same });
  stage();
  if (!same) emit("reader", current);
  if (opts.focus) view.focus?.();
}

// Hides the reader whatever it shows. close() is the owner's way out: a view with its own (a room: its address) takes it.
export function hide() {
  if (!current) return;
  const view = views.get(current.kind);
  current = null;
  setOpened(null);
  reader.hidden = true;
  for (const v of views.values()) v.el.hidden = true;
  document.documentElement.classList.remove("reading");
  view?.left?.();
  stage();
  emit("reader", null);
}
export function close() {
  const view = current && views.get(current.kind);
  if (view?.close) view.close(); else hide();
}
export const viewOf = (kind) => views.get(kind);

// On a phone the reader covers the office: it rests meanwhile (world/index.js listens for "stage").
let covered = false;
function stage() {
  const now = !!current && narrow.matches;
  if (now === covered) return;
  covered = now;
  document.documentElement.classList.toggle("roomopen", now);
  emit("stage", now ? "room" : "office");
  fitViewport();
}
narrow.addEventListener("change", stage);

// On a phone the answer box stays above the keyboard: the reader follows the visible part of the screen.
const vv = window.visualViewport;
function fitViewport() {
  if (!vv || !covered) { reader.style.removeProperty("--vvh"); reader.style.removeProperty("--vvt"); reader.classList.remove("typing"); return; }
  reader.style.setProperty("--vvh", `${vv.height}px`);
  reader.style.setProperty("--vvt", `${vv.offsetTop}px`);
  reader.classList.toggle("typing", vv.height < innerHeight * 0.75);
}
vv?.addEventListener("resize", fitViewport);
vv?.addEventListener("scroll", fitViewport);

reader.addEventListener("click", (e) => { if (e.target.closest("[data-close]")) close(); });
on("state", (S, keys) => { if (current) views.get(current.kind)?.render(keys); });
