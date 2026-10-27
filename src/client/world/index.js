// The 3D office on the page: the world drawn on #world behind the panels, fitted to the area right of the question
// column and under the status pill, driven by the state (lanes, vitals, HQ), the theme and the owner's settings.
// A click on a worker or a desk selects its lane like a click on its name anywhere else (card/card.js select()).
import { mountWorld } from "./world.js";
import { on } from "../core/bus.js";
import { S } from "../core/state.js";
import { select, selected } from "../card/card.js";
import { effectiveTheme } from "../theme/index.js";
import { settings } from "../settings/prefs.js";

const canvas = document.getElementById("world");
const narrow = matchMedia("(max-width: 1150px)");

// WebGL, or nothing: without it (a locked-down or very old browser) the panels work as always over a plain backdrop.
function webgl() {
  try {
    const gl = document.createElement("canvas").getContext("webgl2");
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
    return !!gl;
  } catch { return false; }
}

let world = null;

// The free part of the canvas, in CSS pixels: right of the question column and below the status pill. On a narrow
// screen the canvas is a strip above the page and only its foot is covered (by the pill).
function insets() {
  if (narrow.matches) return { left: 0, top: 0, right: 0, bottom: 28 };
  const c = canvas.getBoundingClientRect();
  const desk = document.querySelector(".desk")?.getBoundingClientRect();
  const top = document.querySelector(".top")?.getBoundingClientRect();
  return { left: desk ? Math.max(0, desk.right - c.left) : 0, top: top ? Math.max(0, top.bottom - c.top) : 0, right: 0, bottom: 0 };
}

// HQ's desk in the suite: asleep while the server finds no HQ it can type into, else what its own lane says.
function hqOf(S) {
  const name = S.hq?.agent ?? "hq";
  const lane = S.lanes.find((l) => l.name === name);
  return { name, status: S.hq?.ok === false ? "stale" : lane?.status ?? "moving" };
}

function render(S) {
  if (!world || !S?.lanes) return;
  const hq = hqOf(S);
  world.setHq(hq.name, hq.status);
  world.setLanes(S.lanes, S.vitals ?? {});
}

function start() {
  const first = S;
  const hq = first ? hqOf(first) : { name: "hq" };
  world = mountWorld(canvas, { theme: effectiveTheme(), hq: hq.name, insets: insets() });
  world.setPerformance(settings.performance);
  world.setSelected(selected);
  world.setPaused(document.documentElement.classList.contains("roomopen")); // a room opened before this module ran
  const refit = () => world.setInsets(insets());
  const ro = new ResizeObserver(refit);
  for (const sel of [".desk", ".top"]) { const el = document.querySelector(sel); if (el) ro.observe(el); }
  addEventListener("resize", refit);
  narrow.addEventListener("change", refit);
  render(first);

  on("state", render);
  on("theme", (t) => world.setTheme(t));
  on("settings", (s) => world.setPerformance(s.performance));
  on("select", (lane) => world.setSelected(lane));
  on("stage", (what) => world.setPaused(what === "room"));
  on("world:select", (lane) => { if (S?.lanes.some((l) => l.name === lane)) select(lane, true); });

  // Q and E turn the office a quarter, 0 fits it again; never while typing.
  document.addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) return;
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable) return;
    if (document.documentElement.classList.contains("roomopen")) return;
    const k = e.key.toLowerCase();
    if (k === "q") world.rotate(-1);
    else if (k === "e") world.rotate(1);
    else if (k === "0") world.fit();
  });

  // The turn and fit buttons, at the foot of the office area.
  const ctl = document.createElement("div");
  ctl.className = "wctl glass";
  ctl.setAttribute("role", "toolbar");
  ctl.setAttribute("aria-label", "Office view");
  ctl.innerHTML = `<button class="btn" type="button" data-turn="-1" title="Turn left (Q)" aria-label="Turn left"><svg viewBox="0 0 14 14" aria-hidden="true"><path d="M3 6.5A4.5 4.5 0 1 1 4.6 10" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><path d="M1.5 3.8 3 6.7l2.9-1.4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button>`
    + `<button class="btn" type="button" data-turn="1" title="Turn right (E)" aria-label="Turn right"><svg viewBox="0 0 14 14" aria-hidden="true" style="transform:scaleX(-1)"><path d="M3 6.5A4.5 4.5 0 1 1 4.6 10" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><path d="M1.5 3.8 3 6.7l2.9-1.4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button>`
    + `<button class="btn" type="button" data-fit title="Fit the whole office (0)">FIT</button>`;
  ctl.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.turn) world.rotate(Number(b.dataset.turn));
    else world.fit();
  });
  document.body.append(ctl);

  // For tests and for looking: what the world shows, read-only.
  Object.defineProperty(window, "__world", {
    value: Object.freeze({
      get rooms() { return world.inspect().rooms; },
      get desks() { return world.inspect().desks; },
      get stage() { return world.inspect().stage; },
      get rotation() { return world.inspect().rotation; },
      inspect: () => world.inspect(),
      walls: (room) => world.roomWalls(room),
      worker: (lane) => world.workerOf(lane),
    }),
  });
}

if (canvas && webgl()) start();
else Object.defineProperty(window, "__world", { value: Object.freeze({ rooms: [], desks: [], stage: null, rotation: 0, unavailable: true }) });
