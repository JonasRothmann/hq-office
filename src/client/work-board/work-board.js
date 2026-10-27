// The work board in the reader: work in flight by state, opened from its pill, which counts stalled work in red.
import { on } from "../core/bus.js";
import { $ } from "../core/dom.js";
import { CONFIG, S } from "../core/state.js";
import { esc, setHTML } from "../core/format.js";
import { defineView } from "../reader/shell.js";

// Read-only. Every item's state comes from the server (GitHub, the lane, open asks); this only draws it.
// It is rebuilt when the state changes, never on a timer.
const WORK_STATE = { blocked: "BLOCKED ON A PROMPT", stalled: "STALLED", owner: "WAITING ON YOU", ci: "WAITING ON CI", moving: "MOVING", paused: "PAUSED", done: "DONE" };
const WORK_ORDER = ["blocked", "stalled", "owner", "ci", "moving", "paused", "done"];
// Minutes, not seconds: these are redrawn when the state changes (at least once a minute), not every second.
function workAge(ms) { const m = Math.floor(ms / 60000), h = Math.floor(m / 60); return m < 1 ? "NOW" : h < 1 ? `${m}M AGO` : h < 48 ? `${h}H ${m % 60}M AGO` : `${Math.floor(h / 24)}D AGO`; }
function workIssue(i) {
  return CONFIG.linearWorkspace
    ? `<a class="key" href="https://linear.app/${esc(CONFIG.linearWorkspace)}/issue/${esc(i.issue)}" target="_blank" rel="noopener">${esc(i.issue)}</a>`
    : `<b class="key">${esc(i.issue)}</b>`;
}
function workPr(p) {
  const repo = p.repo || CONFIG.githubRepo;
  const mark = p.error ? " ?" : p.state === "MERGED" ? " MERGED" : p.state === "CLOSED" ? " CLOSED" : p.draft ? " DRAFT" : p.ci === "running" ? " CI…" : p.ci === "failed" ? " CI ✗" : "";
  const cls = `tag pr${p.state === "MERGED" ? " merged" : p.draft ? " draft" : ""}`;
  const label = `#${esc(p.number)}${mark}`;
  const tip = p.error ? ` title="${esc(p.error)}"` : "";
  return repo ? `<a class="${cls}" href="https://github.com/${esc(repo)}/pull/${esc(p.number)}" target="_blank" rel="noopener"${tip}>${label}</a>` : `<span class="${cls}"${tip}>${label}</span>`;
}
function workRow(i) {
  const now = Date.now();
  const what = i.state === "paused" || i.state === "owner" || i.state === "blocked" ? i.why : i.last ? `last: ${i.last.what}` : "nothing has happened yet";
  const age = i.state === "paused" && i.pausedAt ? now - i.pausedAt : i.last ? now - i.last.at : now - i.createdAt;
  return `<article class="wi ${i.state}">
      <div class="meta"><span class="tag ws ${i.state}">${WORK_STATE[i.state]}</span>${workIssue(i)}${i.lane ? `<button class="tag lane" data-select="${esc(i.lane)}">${esc(i.lane)}</button>` : ""}${i.prs.map(workPr).join("")}<span class="age">${workAge(age)}</span></div>
      <div class="what">${esc(what)}</div>
    </article>`;
}

// The pill: how much is stalled (red) or in flight.
function renderPill() {
  const b = S?.board;
  if (!b) return;
  const stalled = b.items.filter((i) => i.state === "stalled" || i.state === "blocked").length, open = b.items.filter((i) => i.state !== "done").length;
  const t = $("workCount");
  t.hidden = !stalled && !open;
  t.className = `tag${stalled ? " count" : ""}`;
  t.textContent = stalled ? `${stalled} STALLED` : String(open);
  $("pWork").classList.toggle("alert", !!stalled);
}

export function renderWork() {
  if (!S?.board) return;
  const b = S.board;
  const open = b.items.filter((i) => i.state !== "done").length;
  setHTML($("workSum"), b.items.length ? `${open} OPEN · ${WORK_ORDER.filter((s) => b.counts[s]).map((s) => `${b.counts[s]} ${WORK_STATE[s]}`).join(" · ")}` : "");
  // With lanes in a tree, each state's work is grouped under the lane its lane reports to (oldest change first).
  const grouped = b.items.some((i) => i.manager);
  const underManagers = (its) => {
    if (!grouped) return its.map(workRow).join("");
    const by = new Map();
    for (const i of its) { const m = i.manager ?? "HQ"; if (!by.has(m)) by.set(m, []); by.get(m).push(i); }
    return [...by].map(([m, list]) => `<div class="under">UNDER ${m === "HQ" ? "HQ" : `<button class="tag lane" data-select="${esc(m)}">${esc(m)}</button>`}</div>${list.map(workRow).join("")}`).join("");
  };
  const groups = WORK_ORDER.map((s) => {
    const its = b.items.filter((i) => i.state === s);
    return its.length ? `<h4 class="${s}">${WORK_STATE[s]} (${its.length})</h4>${underManagers(its)}` : "";
  }).join("");
  setHTML($("work"), b.items.length ? groups : `<div class="empty">No tracked work. HQ adds it with hud track.</div>`);
}

defineView("work", { el: $("workView"), show: renderWork, render(keys) { if (!keys || keys.has("board")) renderWork(); } });
on("state", (S, keys) => { if (!keys || keys.has("board")) renderPill(); });
