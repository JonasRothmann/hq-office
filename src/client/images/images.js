// What is attached to a send box: the composer, its + menu (a file, an image, a link, an item from a room's shelf),
// drop and paste, re-encoding images, upload, the tray, the preview and the tokens.
import { $, toast } from "../core/dom.js";
import { emit } from "../core/bus.js";
import { S } from "../core/state.js";
import { esc, setHTML } from "../core/format.js";

// Every send box has a key: "note" (Tell HQ), an ask's id, "upd:ID" (an update) or "room:SLUG". What is attached to it
// shows in the box's tray (a thumbnail for an image, a card for anything else); the text stays clean. Files are uploaded
// as soon as they are picked, to this server. On send each one goes at the end of the text as a URL on this server
// ("[image: URL]", "[name](URL)"), so a lane on another machine can fetch it; never a path on this machine's disk.
const attached = new Map();
let seq = 0;
const listOf = (key) => attached.get(String(key)) ?? [];
const SIDE = 2048, QUALITY = 0.85, MAX = 10 * 1024 * 1024, KEEP = 1024 * 1024, MAX_FILE = 25 * 1024 * 1024;
const ACCEPTED = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);
const EXT_TYPE = { heic: "image/heic", heif: "image/heif", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", avif: "image/avif", bmp: "image/bmp", tif: "image/tiff", tiff: "image/tiff" };
const typeOf = (file) => file.type || EXT_TYPE[(file.name || "").split(".").pop().toLowerCase()] || "";
const stemOf = (name) => (name || "image").replace(/\.[^.]*$/, "") || "image";
const mb = (n) => `${(n / 1024 / 1024).toFixed(1)} MB`;

class Refused extends Error { constructor(label, message) { super(message); this.label = label; } }

async function decode(file) {
  try { return await createImageBitmap(file); } catch {}
  const url = URL.createObjectURL(file), img = new Image();
  try { img.src = url; await img.decode(); return img; } finally { URL.revokeObjectURL(url); }
}
const encode = (canvas, type) => new Promise((res) => canvas.toBlob(res, type, QUALITY));

// What is uploaded: a GIF, or an accepted image already small, as it is; anything else the browser can read
// (an iPhone's HEIC, a big PNG) scaled to at most 2048 px on its longest side, as JPEG, or WebP where that is smaller.
export async function prepare(file) {
  const type = typeOf(file), name = file.name || "image";
  if (!type.startsWith("image/")) throw new Refused("NOT AN IMAGE", `${name} is not an image.`);
  if (type === "image/gif") {
    if (file.size > MAX) throw new Refused("OVER 10 MB", `${name} is ${mb(file.size)}; the limit is 10 MB.`);
    return file;
  }
  let pic;
  try { pic = await decode(file); } catch {
    if (ACCEPTED.has(type) && file.size <= MAX) return file;
    const ext = type.split("/")[1].toUpperCase();
    throw new Refused(`CAN'T READ ${ext}`, `${name}: this browser cannot read ${ext} images.`);
  }
  const w = pic.width, h = pic.height;
  if (ACCEPTED.has(type) && file.size <= KEEP && Math.max(w, h) <= SIDE) { pic.close?.(); return file; }
  const s = Math.min(1, SIDE / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(w * s));
  canvas.height = Math.max(1, Math.round(h * s));
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(pic, 0, 0, canvas.width, canvas.height);
  pic.close?.();
  // WebP keeps transparency; JPEG has none, so it gets white behind the picture.
  const webp = await encode(canvas, "image/webp");
  ctx.globalCompositeOperation = "destination-over";
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const jpeg = await encode(canvas, "image/jpeg");
  let best = jpeg;
  if (webp?.type === "image/webp" && (!best || webp.size < best.size)) best = webp;
  if (!best) throw new Refused("CAN'T READ", `${name} could not be converted.`);
  if (ACCEPTED.has(type) && s === 1 && file.size <= best.size && file.size <= MAX) return file;
  if (best.size > MAX) throw new Refused("OVER 10 MB", `${name} is ${mb(best.size)} even shrunk; the limit is 10 MB.`);
  return new File([best], `${stemOf(name)}.${best.type === "image/webp" ? "webp" : "jpg"}`, { type: best.type });
}

// Pixel icons, drawn on a grid and scaled by whole pixels.
const icon = (w, h, paths) => `<svg viewBox="0 0 ${w} ${h}" aria-hidden="true" shape-rendering="crispEdges">${paths}</svg>`;
const PHOTO = icon(12, 12, `<path d="M0 1h12v1H0zM0 2h1v9H0zM11 2h1v9h-1zM0 10h12v1H0zM2 8l3-3 2 2 1-1 2 2v1H2zM8 3h2v2H8z"/>`);
const FILE = icon(12, 12, `<path d="M2 0h6v1H2zM8 1h1v1H8zM9 2h1v1H9zM10 3h1v9H10zM1 1h1v11H1zM2 11h8v1H2zM8 2h1v2h2v1H8zM3 5h5v1H3zM3 7h5v1H3zM3 9h4v1H3z"/>`);
const LINK = icon(12, 12, `<path d="M1 4h2v1H1zM0 5h1v3H0zM1 8h4v1H1zM5 5h1v3H5zM4 4h1v1H4zM6 3h4v1H6zM10 4h1v3h-1zM6 7h4v1H6zM6 4h1v3H6zM3 6h6v1H3z"/>`);
const SHELF = icon(12, 12, `<path d="M0 2h12v1H0zM0 6h12v1H0zM0 10h12v1H0zM1 0h1v12H1zM10 0h1v12h-1zM3 3h2v3H3zM6 3h3v3H6zM3 7h3v3H3z"/>`);
const PLUS = icon(12, 12, `<path d="M5 1h2v10H5zM1 5h10v2H1z"/>`);
const CROSS = icon(6, 6, `<path d="M0 0h2v1H0zM4 0h2v1H4zM1 1h4v1H1zM2 2h2v2H2zM1 4h4v1H1zM0 5h2v1H0zM4 5h2v1H4z"/>`);
const RETRY = icon(8, 8, `<path d="M2 0h3v1H2zM6 0h1v1H6zM1 1h1v1H1zM5 1h2v1H5zM0 2h1v1H0zM4 2h3v1H4zM0 3h1v2H0zM7 4h1v2H7zM0 5h1v1H0zM1 6h1v1H1zM6 6h1v1H6zM2 7h4v1H2z"/>`);

const host = (u) => { try { return new URL(u, location.href).host.replace(/^www\./, ""); } catch { return ""; } };
const kb = (n) => (n >= 1024 * 1024 ? mb(n) : `${Math.max(1, Math.round(n / 1024))} KB`);
// What a link is, the way the server's kindOf says it.
const linkKind = (u) => (/^https?:\/\/([^/]+\.)?claude\.ai\/.*artifacts?\//i.test(u) || /^https?:\/\/([^/]+\.)?claude\.site\//i.test(u) ? "claude-artifact" : /\.(png|jpe?g|gif|webp|svg|avif)(\?|#|$)/i.test(u) ? "image" : "link");
// A thumbnail for an image, and for a picture on a shelf of this HUD; a card for anything else.
const isPicture = (a) => (a.kind ?? "image") === "image" || (a.kind === "shelf" && a.sub === "image" && a.url?.startsWith("/"));

// A card in the tray: a file, a link, an item from a shelf. Done, it opens in a new tab.
function cardChip(a) {
  const busy = a.state === "up" || a.state === "prep";
  const sub = a.kind === "file" ? [busy ? "UPLOADING…" : a.state === "err" ? a.label : "FILE", a.size ? kb(a.size) : ""]
    : a.kind === "shelf" ? [`${a.room} shelf`] : [a.sub === "claude-artifact" ? "Claude artifact" : host(a.url) || "Link"];
  const name = esc(a.title || a.name);
  const inner = `<span class="cthumb">${busy ? `<i class="spin"></i>` : a.kind === "file" ? FILE : a.kind === "shelf" ? SHELF : LINK}</span><span class="ctx"><b>${name}</b><small>${esc(sub.filter(Boolean).join(" · "))}</small></span>`;
  const face = a.state === "err" && a.blob ? `<button type="button" class="ccard" data-chip-retry="${a.id}" aria-label="Retry ${name}">${inner}</button>`
    : a.state === "done" && a.url ? `<a class="ccard" href="${esc(a.url)}" target="_blank" rel="noopener">${inner}</a>` : `<span class="ccard">${inner}</span>`;
  return `<div class="chip acard ${a.state} k-${esc(a.sub || a.kind)}" data-chip="${a.id}" title="${esc(a.error || a.title || a.name)}">${face}<button type="button" class="cx" data-chip-rm="${a.id}" aria-label="Remove ${name}"><span>${CROSS}</span></button></div>`;
}

// The tray: a thumbnail for each image and a card for anything else, each with a round remove badge on its corner. Tap
// a thumbnail to see it larger; while it uploads it is dimmed under a spinner; when the upload failed it has a red ring
// and is tapped to retry. Under them, one line per attachment that did not make it says why.
export function chipsHTML(key) {
  const list = listOf(key);
  if (!list.length) return "";
  const chips = list.map((a) => {
    if (!isPicture(a)) return cardChip(a);
    const src = a.preview || a.url, name = esc(a.name);
    const pic = src ? `<img src="${esc(src)}" alt="">` : `<span class="noimg">${esc(a.state === "err" ? a.label : "IMG")}</span>`;
    const face = a.state === "err" && a.blob ? `<button type="button" class="cimg" data-chip-retry="${a.id}" aria-label="Retry ${name}">${pic}<span class="cover">${RETRY}<b>RETRY</b></span></button>`
      : a.state === "err" ? `<span class="cimg">${pic}</span>`
      : `<button type="button" class="cimg" data-chip-open="${a.id}" aria-label="${a.state === "done" ? "Open" : "Uploading"} ${name}" ${src ? "" : "disabled"}>${pic}${a.state === "done" ? "" : `<span class="cover"><i class="spin"></i></span>`}</button>`;
    return `<div class="chip ${a.state}" data-chip="${a.id}" title="${esc(a.error || a.name)}">${face}<button type="button" class="cx" data-chip-rm="${a.id}" aria-label="Remove ${name}"><span>${CROSS}</span></button></div>`;
  }).join("");
  const why = list.filter((a) => a.state === "err").map((a) => `<div class="why">${esc(a.error)}</div>`).join("");
  return `<div class="tray">${chips}</div>${why}`;
}
const chipsBox = (key) => `<div class="chips" data-chips="${esc(key)}">${chipsHTML(key)}</div>`;
// The + menu: upload a file, an image or screenshot, a link or artifact URL, an item from a room's shelf. The first two
// are labels around file inputs, so a tap opens the phone's own picker (files, photo library, camera) with no script.
// The menu is a popover, so no scrolling box clips it.
export const attachButton = (key) => `<span class="attach" data-attach-for="${esc(key)}"><button type="button" class="aplus" data-attach-open aria-haspopup="menu" aria-expanded="false" aria-label="Attach" title="Attach a file, an image, a link or a shelf item (⌘U)">${PLUS}</button>
  <div class="amenu glass" popover role="menu" aria-label="Attach">
    <label class="aitem" role="menuitem">${FILE}<span>Upload a file</span><kbd>⌘U</kbd><input type="file" multiple data-attach="${esc(key)}" aria-label="Upload a file"></label>
    <label class="aitem" role="menuitem">${PHOTO}<span>Image or screenshot</span><input type="file" accept="image/*" multiple data-attach="${esc(key)}" data-attach-image aria-label="Attach images"></label>
    <button type="button" class="aitem" role="menuitem" data-attach-link>${LINK}<span>Link or artifact URL</span></button>
    <div class="alink" hidden><input type="url" placeholder="https://…" aria-label="Link or artifact URL" data-link-url><button class="btn-s" type="button" data-link-add>ADD</button></div>
    <button type="button" class="aitem" role="menuitem" data-attach-shelf>${SHELF}<span>From a room's shelf</span></button>
    <div class="ashelf" hidden></div>
  </div></span>`;
// A send box: the tray (when anything is attached), the text field, then the + menu and the box's own button(s).
export const composer = (key, field, send) => `<div class="reply" data-composer="${esc(key)}">${chipsBox(key)}${field}<div class="acts">${attachButton(key)}${send}</div></div>`;

// The tray is built again on every change; it keeps its sideways scroll, or shows the end when something was added.
function changed(key, toEnd = false) {
  const box = document.querySelector(`[data-chips="${CSS.escape(String(key))}"]`);
  if (box) {
    const left = box.querySelector(".tray")?.scrollLeft ?? 0;
    setHTML(box, chipsHTML(key));
    const tray = box.querySelector(".tray");
    if (tray) tray.scrollLeft = toEnd ? tray.scrollWidth : left;
  }
  emit("attach", String(key));
}

// The server says why it refused a file (too big, a type it does not keep): that is final, not a retry.
async function upload(key, a) {
  a.state = "up";
  changed(key);
  try {
    const res = await fetch(`/api/uploads?name=${encodeURIComponent(a.blob.name || a.name)}`, { method: "POST", headers: { "content-type": typeOf(a.blob) || "application/octet-stream", "x-hud": "1" }, body: a.blob });
    const data = await res.json().catch(() => ({}));
    if (res.status === 413 || res.status === 415) Object.assign(a, { state: "err", label: res.status === 413 ? "TOO BIG" : "NOT KEPT", error: `${a.name}: ${data.error}.`, blob: null });
    else if (!res.ok) throw new Error(data.error || res.statusText);
    else Object.assign(a, { state: "done", url: data.url, href: data.href, size: data.size, blob: null, error: "" });
  } catch (err) {
    Object.assign(a, { state: "err", label: "FAILED", error: `${a.name} did not upload. Tap it to retry.` });
  }
  if (listOf(key).includes(a)) changed(key);
}

// Images are re-encoded first (prepare); any other file goes as it is, up to 25 MB.
export async function addFiles(files, key) {
  key = String(key);
  const items = [...files].map((file) => ({ file, a: { id: `i${++seq}`, kind: typeOf(file).startsWith("image/") ? "image" : "file", name: file.name || "file", state: "prep" } }));
  if (!items.length) return;
  attached.set(key, [...listOf(key), ...items.map((x) => x.a)]);
  changed(key, true);
  await Promise.all(items.map(async ({ file, a }) => {
    try {
      if (a.kind === "file") {
        if (file.size > MAX_FILE) throw new Refused("OVER 25 MB", `${a.name} is ${mb(file.size)}; the limit is 25 MB.`);
        a.blob = file;
        a.size = file.size;
      } else {
        a.blob = await prepare(file);
        a.preview = URL.createObjectURL(a.blob);
      }
    } catch (err) {
      Object.assign(a, { state: "err", label: err.label || "CAN'T READ", error: err.message });
      if (listOf(key).includes(a)) changed(key);
      return;
    }
    if (listOf(key).includes(a)) await upload(key, a);
  }));
}

// A link or an artifact URL: a card in the tray, sent as the link itself.
export function addLink(key, raw, title = "") {
  const url = String(raw ?? "").trim();
  if (!/^https?:\/\/\S+$/i.test(url)) { toast("A LINK STARTS WITH HTTP:// OR HTTPS://"); return false; }
  attached.set(String(key), [...listOf(key), { id: `i${++seq}`, kind: "link", sub: linkKind(url), name: url, title: title || url, url, href: url, state: "done" }]);
  changed(key, true);
  return true;
}
// An item from a room's shelf, as a card; a file on the shelf travels as its URL on this server.
export function addShelfItem(key, item, room) {
  const href = new URL(item.url, location.href).href;
  attached.set(String(key), [...listOf(key), { id: `i${++seq}`, kind: "shelf", sub: item.kind, name: item.title, title: item.title, room, url: item.url, href, state: "done" }]);
  changed(key, true);
}

export function removeImage(key, id) {
  const list = listOf(key), a = list.find((x) => x.id === id);
  if (!a) return;
  if (a.preview) URL.revokeObjectURL(a.preview);
  attached.set(String(key), list.filter((x) => x !== a));
  changed(key);
}
export function clearImages(key) {
  const list = listOf(key);
  attached.delete(String(key));
  if (!list.length) return;
  for (const a of list) if (a.preview) URL.revokeObjectURL(a.preview);
  changed(key);
}
export const imageKeys = () => [...attached.keys()].filter((k) => listOf(k).length);
export const hasImages = (key) => listOf(key).length > 0;
// Why the box cannot send yet, or "" when everything is uploaded.
export function notReady(key) {
  const list = listOf(key);
  const what = (a) => (a.kind === "file" ? "A FILE" : "AN IMAGE");
  const busy = list.find((a) => a.state === "prep" || a.state === "up"), bad = list.find((a) => a.state === "err");
  if (busy) return `${what(busy)} IS STILL UPLOADING.`;
  if (bad) return `${what(bad)} DID NOT UPLOAD. RETRY OR REMOVE IT.`;
  return "";
}
// The text a lane or HQ receives: what was typed, then one token per attachment, each a URL on this server (or the
// link itself): "[image: URL]" for an image, "[title](URL)" for anything else, a bare link as it is.
const plain = (s) => String(s).replace(/[[\]]/g, "");
const token = (a) => ((a.kind ?? "image") === "image" ? `[image: ${a.href}]` : a.kind === "link" && a.title === a.url ? a.url : `[${plain(a.title || a.name)}](${a.href})`);
export const withImages = (key, text) => [text, ...listOf(key).filter((a) => a.state === "done").map(token)].filter(Boolean).join(" ");

// Kept with the drafts across a reload: only what is done, as URLs. The bytes are on the HUD.
export const savedImages = () => imageKeys().map((k) => [k, listOf(k).filter((a) => a.state === "done").map(({ kind, sub, name, title, room, url, href, size }) => ({ kind, sub, name, title, room, url, href, size }))]).filter(([, l]) => l.length);
export function restoreImages(saved) {
  // A draft kept before attachments had kinds holds an image's path and URL: the URL stands in for the rest.
  for (const [k, list] of saved ?? []) attached.set(String(k), list.filter((a) => a.url).map((a) => ({ kind: "image", ...a, href: a.href || new URL(a.url, location.href).href, id: `i${++seq}`, state: "done" })));
}

// ---- the + menu ----

const menuOf = (el) => el.closest(".attach")?.querySelector(".amenu");
const keyOfMenu = (menu) => menu.closest(".attach").dataset.attachFor;
// Opens a box's menu above its + button (or below it when there is no room above).
export function openMenu(key) {
  const wrap = document.querySelector(`.attach[data-attach-for="${CSS.escape(String(key))}"]`);
  const menu = wrap?.querySelector(".amenu"), btn = wrap?.querySelector(".aplus");
  if (!menu || !btn?.offsetParent) return false;
  menu.querySelector(".alink").hidden = true;
  menu.querySelector(".ashelf").hidden = true;
  menu.showPopover();
  place(menu, btn);
  menu.querySelector(".aitem input")?.closest("label").focus?.();
  return true;
}
function place(menu, btn) {
  const b = btn.getBoundingClientRect(), m = menu.getBoundingClientRect();
  const top = b.top - m.height - 6 >= 8 ? b.top - m.height - 6 : Math.min(innerHeight - m.height - 8, b.bottom + 6);
  menu.style.left = `${Math.max(8, Math.min(innerWidth - m.width - 8, b.left))}px`;
  menu.style.top = `${Math.max(8, top)}px`;
}
document.addEventListener("toggle", (e) => {
  if (!e.target.matches?.(".amenu")) return;
  e.target.closest(".attach")?.querySelector(".aplus")?.setAttribute("aria-expanded", String(e.newState === "open"));
}, true);

// The shelves to pick from: the room the reader shows first, then every listed room with something on its shelf.
async function showShelves(menu) {
  const box = menu.querySelector(".ashelf");
  const rooms = (S?.rooms ?? []).filter((r) => !r.thread && !r.archivedAt && r.artifacts > 0);
  box.hidden = false;
  if (!rooms.length) { setHTML(box, `<div class="none">No room has anything on its shelf yet.</div>`); place(menu, menu.closest(".attach").querySelector(".aplus")); return; }
  setHTML(box, `<div class="k">ROOMS</div>${rooms.map((r) => `<button type="button" class="aroom" data-shelf-room="${esc(r.slug)}">${esc(r.title)}<small>${r.artifacts}</small></button>`).join("")}`);
  place(menu, menu.closest(".attach").querySelector(".aplus"));
}
async function showShelf(menu, slug) {
  const box = menu.querySelector(".ashelf");
  setHTML(box, `<div class="none">LOADING…</div>`);
  try {
    const r = await (await fetch(`/api/rooms/${encodeURIComponent(slug)}`)).json();
    box._items = r.artifactList ?? [];
    box._room = r.title;
    setHTML(box, `<button type="button" class="aback" data-shelf-back>‹ ${esc(r.title)}</button>${[...box._items].reverse().map((a) => `<button type="button" class="aitem" data-shelf-item="${a.id}">${a.kind === "file" ? FILE : a.kind === "image" ? PHOTO : LINK}<span>${esc(a.title)}</span><small>${esc(a.kind === "claude-artifact" ? "artifact" : a.kind)}</small></button>`).join("")}`);
  } catch { setHTML(box, `<div class="none">The shelf did not load.</div>`); }
  place(menu, menu.closest(".attach").querySelector(".aplus"));
}

document.addEventListener("click", (e) => {
  const t = e.target;
  const plus = t.closest?.("[data-attach-open]");
  if (plus) { const menu = menuOf(plus); if (menu.matches(":popover-open")) menu.hidePopover(); else openMenu(keyOfMenu(menu)); return; }
  const menu = t.closest?.(".amenu");
  if (!menu) return;
  const key = keyOfMenu(menu);
  if (t.closest("[data-attach-link]")) {
    const form = menu.querySelector(".alink");
    form.hidden = false;
    menu.querySelector(".ashelf").hidden = true;
    form.querySelector("input").focus();
    place(menu, menu.closest(".attach").querySelector(".aplus"));
  } else if (t.closest("[data-attach-shelf]")) showShelves(menu);
  else if (t.closest("[data-shelf-back]")) showShelves(menu);
  else if (t.closest("[data-shelf-room]")) showShelf(menu, t.closest("[data-shelf-room]").dataset.shelfRoom);
  else if (t.closest("[data-shelf-item]")) {
    const box = menu.querySelector(".ashelf"), item = box._items?.find((a) => String(a.id) === t.closest("[data-shelf-item]").dataset.shelfItem);
    if (item) { addShelfItem(key, item, box._room); menu.hidePopover(); }
  } else if (t.closest("[data-link-add]")) addTyped(menu);
});
// The link row is no form of its own: the menu can sit inside one (Tell HQ's), so Enter adds the link here.
function addTyped(menu) {
  const input = menu.querySelector("[data-link-url]");
  if (addLink(keyOfMenu(menu), input.value)) { input.value = ""; menu.hidePopover(); }
}
document.addEventListener("keydown", (e) => {
  if (e.key !== "Enter" || !e.target.matches?.("[data-link-url]")) return;
  e.preventDefault();
  e.stopPropagation();
  addTyped(e.target.closest(".amenu"));
}, true);

// The picker. The box may be built again while the phone's menu is open, so the input that opened it is listened
// to directly as well as through the document; the first to read the files empties the input.
function picked(input) {
  const files = [...(input.files ?? [])];
  input.value = "";
  input.closest(".amenu")?.hidePopover?.();
  if (files.length) addFiles(files, input.dataset.attach);
}
document.addEventListener("click", (e) => {
  const input = e.target.closest?.("input[data-attach]");
  if (input) input.onchange = () => picked(input);
}, true);
document.addEventListener("change", (e) => { if (e.target.matches?.("input[data-attach]")) picked(e.target); });
document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-chip-rm], [data-chip-retry], [data-chip-open]");
  if (!btn) return;
  const { chipRm, chipRetry, chipOpen } = btn.dataset, key = btn.closest("[data-chips]").dataset.chips;
  if (chipRm) { removeImage(key, chipRm); return; }
  const a = listOf(key).find((x) => x.id === (chipRetry || chipOpen));
  if (chipRetry && a?.blob) upload(key, a);
  if (chipOpen && a) openPreview(a.preview || a.url, a.name);
});

// The preview: the image as large as the screen allows, a close button, and a tap anywhere else closes it.
export function openPreview(src, name) {
  let d = $("imgPreview");
  if (!d) {
    d = document.createElement("dialog");
    d.id = "imgPreview";
    d.className = "preview";
    d.autofocus = true;
    d.innerHTML = `<figure><img alt=""><figcaption></figcaption></figure><button type="button" class="pclose" aria-label="Close preview"><span>${CROSS}</span></button>`;
    d.addEventListener("click", (e) => { if (e.target.tagName !== "IMG") d.close(); });
    document.body.append(d);
  }
  d.querySelector("img").src = src;
  d.querySelector("img").alt = name;
  d.querySelector("figcaption").textContent = name;
  d.showModal();
}

// The text field grows with what is typed, up to a few lines, then scrolls (CSS field-sizing; by script where the
// browser has none).
if (!CSS.supports("field-sizing", "content")) {
  const fit = (ta) => { ta.style.height = "auto"; ta.style.height = `${ta.scrollHeight}px`; };
  for (const type of ["input", "focusin"]) document.addEventListener(type, (e) => { if (e.target.matches?.(".reply textarea")) fit(e.target); });
}

// ---- drop and paste: to the item the keys target ----

// Where a drop or a paste goes when it is not on a box of its own: the item the keys act on (marked KEYS), as
// { key, title, el } (el: what lights up while a file is held over the page). Set by inbox/keys.js, which knows the
// stack and the reader; Tell HQ until then.
let targetOf = () => ({ key: "note", title: "Tell HQ", el: null });
export function setDropTarget(fn) { targetOf = fn; }

const files = (dt) => [...(dt?.files ?? [])];
const holdsFiles = (dt) => [...(dt?.types ?? [])].includes("Files");
const boxOf = (key) => document.querySelector(`[data-composer="${CSS.escape(String(key))}"]`);
// A drop on a box goes to that box; on a card in the stack, to that card's item; anywhere else, to the keys' target.
function dropTarget(el) {
  const box = el.closest?.("[data-composer]");
  if (box) return { key: box.dataset.composer, el: box };
  const card = el.closest?.("#hud .item[data-key]");
  if (card) {
    const k = card.dataset.key, [kind, ref] = [k.slice(0, k.indexOf(":")), k.slice(k.indexOf(":") + 1)];
    const key = kind === "ask" ? ref : kind === "update" ? `upd:${ref}` : `room:${ref}`;
    return { key, el: boxOf(key) ?? card, title: card.querySelector(".st")?.textContent };
  }
  const t = targetOf();
  return { ...t, el: boxOf(t.key) ?? t.el };
}
let hint = null;
function showHint(t) {
  if (!hint) { hint = document.createElement("div"); hint.className = "drophint glass"; document.body.append(hint); }
  setHTML(hint, `Drop to attach to: <b>${esc(t.title || "this box")}</b>`);
  hint.hidden = false;
}
const clearDropping = () => { document.querySelectorAll(".dropping").forEach((el) => el.classList.remove("dropping")); if (hint) hint.hidden = true; };
document.addEventListener("dragover", (e) => {
  if (!holdsFiles(e.dataTransfer)) return;
  e.preventDefault();
  const t = dropTarget(e.target);
  clearDropping();
  t.el?.classList.add("dropping");
  showHint(t);
});
document.addEventListener("dragleave", (e) => { if (!e.relatedTarget) clearDropping(); });
document.addEventListener("drop", (e) => {
  clearDropping();
  const list = files(e.dataTransfer);
  if (!list.length) return;
  e.preventDefault();
  const t = dropTarget(e.target);
  addFiles(list, t.key);
  if (!boxOf(t.key)?.offsetParent) toast(`ATTACHED TO: ${String(t.title || "").toUpperCase()}`);
});
// A paste with files: into the box with the cursor, else to the keys' target.
document.addEventListener("paste", (e) => {
  const list = files(e.clipboardData);
  if (!list.length) return;
  e.preventDefault();
  const box = document.activeElement?.closest?.("[data-composer]");
  const t = box ? { key: box.dataset.composer } : targetOf();
  addFiles(list, t.key);
  if (!boxOf(t.key)?.offsetParent) toast(`ATTACHED TO: ${String(t.title || "").toUpperCase()}`);
});
