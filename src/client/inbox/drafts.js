// Unsent answers, replies and the note to HQ, kept across the page's own reloads, with the item the reader had open.
import { $ } from "../core/dom.js";
import { restoreImages, savedImages } from "../images/images.js";

export const drafts = new Map(); // ask id -> { opt, text, minutes }
// Secret values typed into a question, by ask id. Memory only: never in drafts, sessionStorage or the DOM's markup.
export const secretDrafts = new Map();
export const replies = new Map(); // update id -> the reply to HQ being written
export let opened = null; // what the reader shows: { kind, ref }, or null
export function setOpened(v) { opened = v; }

// Autoreload: the server stamps index.html's mtime into every state. A new stamp means the file changed. Unsent text,
// the open item and attached images (their paths on the HUD, never their bytes) are parked in sessionStorage so the
// reload does not eat them. So is any other reload, or a phone dropping the page while its camera is open: they are
// parked whenever the page is hidden too.
export function keepDrafts() {
  try { sessionStorage.setItem("hq-drafts", JSON.stringify({ drafts: [...drafts], note: $("noteText").value, replies: [...replies], opened, images: savedImages() })); } catch {}
}
addEventListener("pagehide", keepDrafts);
document.addEventListener("visibilitychange", () => { if (document.hidden) keepDrafts(); });
(() => {
  try {
    const d = JSON.parse(sessionStorage.getItem("hq-drafts") || "null");
    sessionStorage.removeItem("hq-drafts");
    if (!d) return;
    for (const [k, v] of d.drafts ?? []) drafts.set(k, v);
    for (const [k, v] of d.replies ?? []) replies.set(k, v);
    $("noteText").value = d.note || "";
    opened = d.opened ?? null;
    restoreImages(d.images);
  } catch {}
})();
