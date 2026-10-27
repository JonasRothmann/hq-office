// The desk HUD (spec section 4, F6, F9): one glass chip per lane over its desk in the 3D office, placed every frame.
// A chip shows the lane's name, status, model and effort, running subagents and context in use; it never overlaps
// another chip or a panel (the question column above all), shrinks to one line at the far zoom or when the desks are
// crowded, lifts to full with the lane's title on hover or focus, and selects its lane on click (data-select, handled
// in core/clicks.js). Nothing shows until the world draws.
import { on } from "../core/bus.js";
import { S } from "../core/state.js";
import { esc } from "../core/format.js";
import { familyClass, shortModel, statusOf, tokens, waitsOnOwner } from "./format.js";
import { crowding, place } from "./layout.js";

const FAR_PPM = 30;             // px per metre under which the chips are compact (the camera's far step is 22.6)
const COS_PITCH = Math.cos(Math.PI / 6); // a metre straight up is this many metres on screen (the camera looks 30° down)
const LIFT = 4;                 // px between the desk's anchor and the chip's foot
const EDGE = 4;                 // px a chip keeps from the edge of the world's canvas
const MAX_DOTS = 8;             // the count is exact; the dots stop here (the world draws at most 8 balls)
const CROWDED = 40, ROOMY = 16; // px a full chip may be nudged before all go compact, and back under before they return
// The panels a chip must never touch: the question column, the status pill, the card, the feed, settings, a room.
const PANELS = ".desk, .top, .glass:not(.dh-chip), .roomview, #roomView, .hqdown";

const layer = document.createElement("div");
layer.id = "deskHud";
layer.className = "dh-layer";
layer.hidden = true;
layer.setAttribute("role", "group");
layer.setAttribute("aria-label", "Desks");
// Right after .wrap at z-index 0: over the world's canvas, under the panels (.wrap is z-index 1), so even a chip placed
// wrongly can never cover a question; and after the question column in tab order.
const wrap = document.querySelector(".wrap");
if (wrap) wrap.after(layer); else document.body.append(layer);

const chips = new Map(); // lane -> { el, sig, size: { full, compact } | null, at, shown, transform }
let ready = false, hot = null, crowded = false;
let world = null, up = null; // world/api.js once it loads, and a spare vector

function chipHTML(l, v) {
  const [word] = statusOf(l.status);
  const subs = v?.subagents ?? [];
  const used = v?.contextUsed ?? null, max = v?.contextMax ?? null;
  const pct = used != null && max ? Math.min(100, Math.round((used / max) * 100)) : 0;
  const bar = `<span class="dh-track"><span class="dh-fill" style="width:${pct}%"></span></span>`;
  const blk = l.blocking > 0 ? `<span class="dh-blk" title="${l.blocking} open blocking question${l.blocking === 1 ? "" : "s"}">${l.blocking}</span>` : "";
  const dots = subs.slice(0, MAX_DOTS).map((s) => `<span class="dh-sd ${familyClass(s.family)}"></span>`).join("");
  return `<span class="dh-r1"><span class="dh-dot"></span><span class="dh-name">${esc(l.name)}</span>${blk}<span class="dh-st">${esc(word)}</span><span class="dh-mini">${bar}</span></span>`
    + (l.title ? `<span class="dh-title">${esc(l.title)}</span>` : "")
    + `<span class="dh-r2"><span class="dh-model">${esc(shortModel(v?.model))} · ${esc(v?.effort || "—")}</span>`
    + `<span class="dh-subs${subs.length ? "" : " none"}">${dots}<span class="dh-cnt">${subs.length}</span></span>`
    + `<span class="dh-ctx">${bar}<span class="dh-n">${tokens(used)} / ${tokens(max)}</span></span></span>`;
}

function labelOf(l, v) {
  const n = v?.subagents?.length ?? 0;
  return [
    `${l.name}: ${statusOf(l.status)[0]}`,
    l.blocking > 0 && `${l.blocking} blocking question${l.blocking === 1 ? "" : "s"}`,
    `model ${shortModel(v?.model)}`,
    `effort ${v?.effort || "unknown"}`,
    `${n} subagent${n === 1 ? "" : "s"}`,
    `context ${tokens(v?.contextUsed ?? null)} of ${tokens(v?.contextMax ?? null)}`,
  ].filter(Boolean).join(", ");
}

function newChip(name) {
  const el = document.createElement("button");
  el.type = "button";
  el.className = "dh-chip glass";
  el.dataset.select = name;
  el.dataset.lane = name;
  el.hidden = true;
  const lift = () => { hot = name; };
  const drop = () => { if (hot === name) hot = null; };
  el.addEventListener("pointerenter", lift);
  el.addEventListener("pointerleave", drop);
  el.addEventListener("focus", lift);
  el.addEventListener("blur", drop);
  layer.append(el);
  return { el, sig: "", size: null, at: null, shown: false, transform: "" };
}

function render(state) {
  const lanes = state?.lanes ?? [];
  const vitals = state?.vitals ?? {};
  const names = new Set();
  for (const l of lanes) {
    names.add(l.name);
    const c = chips.get(l.name) ?? chips.set(l.name, newChip(l.name)).get(l.name);
    const v = vitals[l.name];
    const html = chipHTML(l, v);
    const [, tone] = statusOf(l.status);
    const pct = v?.contextUsed != null && v?.contextMax ? v.contextUsed / v.contextMax : 0;
    const sig = `${tone}|${waitsOnOwner(l.status)}|${html}`;
    if (sig === c.sig) continue;
    c.sig = sig;
    c.el.innerHTML = html;
    c.el.dataset.tone = tone;
    c.el.dataset.ctx = pct > 0.95 ? "full" : pct > 0.8 ? "high" : "";
    c.el.classList.toggle("wait", waitsOnOwner(l.status));
    c.el.setAttribute("aria-label", labelOf(l, v));
    c.size = null;
  }
  for (const [name, c] of chips) if (!names.has(name)) { c.el.remove(); chips.delete(name); if (hot === name) hot = null; }
}

// The sizes of every chip whose content changed (full, compact, and lifted with its title): only when something changed.
function measure() {
  const dirty = [...chips.values()].filter((c) => !c.size);
  if (!dirty.length) return;
  for (const c of dirty) { c.was = c.el.className; c.el.hidden = false; c.el.classList.remove("compact", "hot"); }
  for (const c of dirty) c.size = { full: { w: c.el.offsetWidth, h: c.el.offsetHeight } };
  for (const c of dirty) c.el.classList.add("compact");
  for (const c of dirty) c.size.compact = { w: c.el.offsetWidth, h: c.el.offsetHeight };
  for (const c of dirty) { c.el.classList.remove("compact"); c.el.classList.add("hot"); }
  for (const c of dirty) c.size.hot = { w: c.el.offsetWidth, h: c.el.offsetHeight };
  for (const c of dirty) { c.el.className = c.was; c.el.hidden = !c.shown; }
}

const rectOf = (r) => ({ x: r.left, y: r.top, w: r.width, h: r.height });
const contains = (b, x, y) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
function panels() {
  const out = [];
  for (const el of document.querySelectorAll(PANELS)) {
    if (layer.contains(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) out.push(rectOf(r));
  }
  return out;
}

function show(c, on) {
  if (c.shown === on) return;
  c.shown = on;
  c.el.hidden = !on;
}
function moveTo(c, x, y) {
  const t = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  if (t !== c.transform) { c.transform = t; c.el.style.transform = t; }
}

function frame() {
  // A frame means the world is mounted, even if it said world:ready before this module loaded.
  if (!ready) { ready = true; layer.hidden = false; layer.dataset.live = "1"; }
  if (!chips.size) return;
  measure();
  const canvas = document.getElementById("world");
  const cr = canvas ? canvas.getBoundingClientRect() : new DOMRect(0, 0, innerWidth, innerHeight);
  const left = Math.max(cr.left, 0) + EDGE, top = Math.max(cr.top, 0) + EDGE;
  const bounds = { x: left, y: top, w: Math.min(cr.right, innerWidth) - EDGE - left, h: Math.min(cr.bottom, innerHeight) - EDGE - top };
  const obstacles = panels();

  // Each desk's point on screen; one behind a panel or off the canvas has no chip.
  let ppm = null;
  const live = [];
  for (const [name, c] of chips) {
    c.at = null;
    const a = world.deskAnchor(name);
    const p = a && world.project(a);
    if (!p?.visible) continue;
    const x = cr.left + p.x, y = cr.top + p.y;
    if (bounds.w <= 0 || bounds.h <= 0 || !contains(bounds, x, y) || obstacles.some((o) => contains(o, x, y))) continue;
    c.at = { x, y };
    live.push([name, c]);
    if (ppm === null) ppm = Math.abs(p.y - world.project(up.copy(a).setY(a.y + 1)).y) / COS_PITCH;
  }
  // Who gets their spot first: the lifted chip, at its lifted size and growing from the foot it had before (so it stays
  // under the pointer, and the chips of the desks round it, close together in a team room, make way rather than hide
  // under it); then lanes waiting on the owner; then the desk nearest the camera (lowest on screen), so a chip that
  // must move goes up, away from the worker under it.
  live.sort(([an, a], [bn, b]) => Number(bn === hot) - Number(an === hot) || Number(b.el.classList.contains("wait")) - Number(a.el.classList.contains("wait")) || b.at.y - a.at.y);
  const layoutFor = (mode) => place(live.map(([name, c]) => {
    const s = name === hot ? c.size.hot : c.size[mode];
    const foot = (name === hot && c.foot) || { x: c.at.x, y: c.at.y - LIFT };
    return { key: name, x: foot.x - s.w / 2, y: foot.y - s.h, w: s.w, h: s.h };
  }), { obstacles, bounds });

  let mode = "compact", spots = null;
  if (ppm !== null && ppm >= FAR_PPM) {
    const full = layoutFor("full");
    const { moved, lost } = crowding(full);
    crowded = lost > 0 || moved > (crowded ? ROOMY : CROWDED);
    if (!crowded) { mode = "full"; spots = full; }
  }
  spots ??= layoutFor(mode);
  layer.dataset.mode = mode;

  let lifted = null;
  for (const [name, c] of chips) {
    const s = c.at && spots.get(name);
    const isHot = name === hot;
    // a lifted chip with no free spot in reach still shows, from its desk
    if (!s && !(isHot && c.at)) { show(c, false); continue; }
    show(c, true);
    c.el.classList.toggle("compact", mode === "compact" && !isHot);
    c.el.classList.toggle("hot", isHot);
    if (s) moveTo(c, s.x, s.y);
    else lifted = { c, foot: c.foot ?? { x: c.at.x, y: c.at.y - LIFT } };
    if (s && !isHot) c.foot = { x: s.x + c.size[mode].w / 2, y: s.y + c.size[mode].h };
  }
  // That chip grows from its foot, in front of the others, and still never over a panel.
  if (lifted) {
    const { c, foot } = lifted;
    const w = c.el.offsetWidth, h = c.el.offsetHeight;
    let x = foot.x - w / 2;
    const y = Math.min(Math.max(foot.y - h, bounds.y), bounds.y + bounds.h - h);
    for (const o of obstacles) {
      if (x < o.x + o.w && o.x < x + w && y < o.y + o.h && o.y < y + h) x = foot.x >= o.x + o.w / 2 ? o.x + o.w + EDGE : o.x - w - EDGE;
    }
    moveTo(c, Math.min(Math.max(x, bounds.x), bounds.x + bounds.w - w), y);
  }
}

// The world's api is loaded only once the world is ready (it is the module the world already loaded), so a page with
// the world off, or without WebGL, never fetches three.js and the chips simply never show.
let loading = false;
function worldReady() {
  ready = true; layer.hidden = false; layer.dataset.live = "1";
  for (const c of chips.values()) c.size = null;
  if (loading) return;
  loading = true;
  import("../world/api.js").then((api) => {
    world = api;
    up = new api.THREE.Vector3();
    api.onFrame(frame);
  }, () => {});
}
on("world:ready", worldReady);
on("state", render);
if (S) render(S);
if (window.__world && !window.__world.unavailable) worldReady(); // the world was ready before this module ran
document.fonts?.ready.then(() => { for (const c of chips.values()) c.size = null; });
