// The ask ledger in the reader: the EDITED tag, the checklist (read-only ticks, PRs linked) and HQ's comments, the
// latest five with MORE for the older ones.
import { CONFIG, S } from "../core/state.js";
import { esc } from "../core/format.js";
import { linkify } from "../core/text.js";

const SHOWN = 5;
const opened = new Set(); // ask ids whose older comments are open
const hhmm = (t) => new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
export const toggleOlder = (id) => { if (opened.has(id)) opened.delete(id); else opened.add(id); };

function itemHtml(i) {
  const text = linkify(i.text);
  const repo = i.pr?.repo || CONFIG.githubRepo;
  // linkify already links a #1234 in the default repo; any other PR gets its own link.
  const pr = i.pr && repo && !text.includes("<a ") ? ` <a class="lpr" href="https://github.com/${esc(repo)}/pull/${esc(i.pr.number)}" target="_blank" rel="noopener">#${esc(i.pr.number)}</a>` : "";
  const why = i.done ? (i.by === "github" ? "merged" : "done") : "open";
  return `<li class="${i.done ? "done" : ""}"><span class="ltick" role="img" aria-label="${why}">${i.done ? "✓" : ""}</span><span class="lt">${text}${pr}</span></li>`;
}

function commentsHtml(id, list) {
  const older = list.length - SHOWN;
  const all = opened.has(id);
  const shown = all || older <= 0 ? list : list.slice(-SHOWN);
  const more = older > 0 ? `<button class="lmore" type="button" data-ledger-more="${esc(id)}">${all ? "LESS" : `MORE (${older})`}</button>` : "";
  return `<div class="lcom">${more}${shown.map((c) => `<div class="lc"><span class="lat">${hhmm(c.at)}</span>${linkify(c.text)}</div>`).join("")}</div>`;
}

export const editedTag = (id) => { const at = S?.ledger?.[id]?.editedAt; return at ? `<span class="tag edited">EDITED ${hhmm(at)}</span>` : ""; };
export function ledgerHtml(id) {
  const l = S?.ledger?.[id];
  if (!l) return "";
  return (l.items.length ? `<ul class="lchk">${l.items.map(itemHtml).join("")}</ul>` : "") + (l.comments.length ? commentsHtml(id, l.comments) : "");
}
