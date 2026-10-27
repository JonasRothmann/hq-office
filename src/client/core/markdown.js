// Markdown as safe HTML, for every body an agent writes (questions, updates, a room's brief and thread): everything
// is escaped first, then headings, lists (with [ ] and [x]), quotes, rules, tables, code fences (with COPY), inline
// code, bold, italic and links (http(s) or a path on this HUD). Nothing an agent writes can add a tag, an attribute or
// a script. A thread's messages use it as chat: each line break shows, a blank line starts a paragraph, and
// [image: PATH] (an attached image) and #1234 (a PR) show as links. doc() is the reader's: long sections fold.
import { esc } from "./format.js";
import { CONFIG } from "./state.js";

// A link's target: http(s), or a path on this HUD (never a protocol-relative //host).
const LINK = /\[([^\]\n]+)\]\(((?:https?:\/\/|\/(?!\/))[^\s)]*)\)/g;
function inline(raw, chat) {
  const codes = [];
  const keep = (html) => `\u0000${codes.push(html) - 1}\u0000`;
  let t = esc(raw).replace(/`([^`\n]+)`/g, (m, c) => keep(`<code>${c}</code>`));
  if (chat) {
    t = t.replace(/\[image: ([^\]\s]+)\]/g, (m, p) => { const f = p.split("/").pop(); return keep(`<a href="/uploads/${f}" target="_blank" rel="noopener"><img class="thumb" src="/uploads/${f}" alt=""></a>`); });
    if (CONFIG.githubRepo) t = t.replace(/(^|[\s(])#(\d{4,5})\b/g, (m, p, n) => `${p}${keep(`<a href="https://github.com/${esc(CONFIG.githubRepo)}/pull/${n}" target="_blank" rel="noopener">#${n}</a>`)}`);
  }
  t = t.replace(LINK, (m, label, url) => `<a href="${url}" target="_blank" rel="noopener">${label}</a>`);
  t = t.replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, (m, p, u) => `${p}<a href="${u}" target="_blank" rel="noopener">${u.length > 60 ? u.slice(0, 57) + "…" : u}</a>`);
  t = t.replace(/\*\*([^*\n]+)\*\*/g, "<b>$1</b>").replace(/__([^_\n]+)__/g, "<b>$1</b>");
  t = t.replace(/(^|[\s(>])\*([^*\s][^*\n]*?)\*(?=$|[\s).,;:!?<])/g, "$1<i>$2</i>").replace(/(^|[\s(>])_([^_\s][^_\n]*?)_(?=$|[\s).,;:!?<])/g, "$1<i>$2</i>");
  t = t.replace(/~~([^~\n]+)~~/g, "<s>$1</s>");
  return t.replace(/\u0000(\d+)\u0000/g, (m, i) => codes[i]);
}
const task = (t, chat) => {
  const m = t.match(/^\[([ xX])\]\s+(.*)$/);
  return m ? `<span class="tick${m[1] === " " ? "" : " on"}">${m[1] === " " ? "" : "✓"}</span>${inline(m[2], chat)}` : inline(t, chat);
};
const BULLET = /^\s*[-*+]\s+/, NUMBER = /^\s*\d+[.)]\s+/;
const cells = (l) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());

// The body as blocks: each one's HTML, what it is, and how many source lines it took.
// rich: image tokens and PR numbers become links (chat has them too; doc() has them without the line breaks).
function blocks(src, chat, rich = chat) {
  const lines = String(src ?? "").replace(/\r\n?/g, "\n").split("\n");
  const out = [];
  let para = [];
  let i = 0;
  const push = (kind, html, from, extra = {}) => out.push({ kind, html, lines: Math.max(1, i - from), ...extra });
  const flush = () => {
    if (!para.length) return;
    out.push({ kind: "p", html: `<p>${chat ? para.map((l) => inline(l, true)).join("<br>") : inline(para.join(" "), rich)}</p>`, lines: para.length });
    para = [];
  };
  while (i < lines.length) {
    const l = lines[i], from = i;
    let m;
    if (/^\s*```/.test(l)) {
      flush();
      const lang = l.replace(/^\s*```/, "").trim().split(/\s/)[0];
      const body = [];
      for (i++; i < lines.length && !/^\s*```/.test(lines[i]); i++) body.push(lines[i]);
      i++;
      push("code", `<div class="codebox"><button class="copy" type="button">COPY</button><pre>${esc(body.join("\n"))}</pre></div>`, from, { lang, rows: body.length });
    } else if ((m = l.match(/^(#{1,6})\s+(.*?)\s*#*\s*$/))) {
      flush();
      i++;
      const h = Math.min(m[1].length, 4) + 2;
      push("h", `<h${h}>${inline(m[2], rich)}</h${h}>`, from, { title: inline(m[2], rich) });
    } else if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(l)) {
      flush();
      i++;
      push("hr", "<hr>", from);
    } else if (BULLET.test(l) || NUMBER.test(l)) {
      flush();
      const kind = BULLET.test(l) ? BULLET : NUMBER, items = [];
      while (i < lines.length && kind.test(lines[i])) {
        items.push(lines[i++].replace(kind, ""));
        // a wrapped line of the same item, indented under it
        while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !BULLET.test(lines[i]) && !NUMBER.test(lines[i])) items[items.length - 1] += " " + lines[i++].trim();
      }
      const tag = kind === BULLET ? "ul" : "ol";
      push("list", `<${tag}>${items.map((t) => `<li>${task(t, rich)}</li>`).join("")}</${tag}>`, from);
    } else if (/^\s*>/.test(l)) {
      flush();
      const q = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) q.push(lines[i++].replace(/^\s*>\s?/, ""));
      push("quote", `<blockquote>${markdown(q.join("\n"), chat)}</blockquote>`, from);
    } else if (/^\s*\|.*\|\s*$/.test(l) && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1] ?? "")) {
      flush();
      const head = cells(l);
      const rows = [];
      for (i += 2; i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i]); i++) rows.push(cells(lines[i]));
      push("table", `<div class="mdtable"><table><thead><tr>${head.map((c) => `<th>${inline(c, rich)}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${inline(c, rich)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`, from, { rows: rows.length });
    } else if (!l.trim()) {
      flush();
      i++;
    } else {
      para.push(chat ? l.trimEnd() : l.trim());
      i++;
    }
  }
  flush();
  return out;
}

// chat: a message in a thread, where a line break is a line break.
export function markdown(src, chat = false) {
  return blocks(src, chat).map((b) => b.html).join("");
}

// A body in the reader: each heading starts a section that folds, closed when it runs past FOLD source lines; a code
// block or a table that long folds on its own. Everything else shows as it is.
export const FOLD = 12;
const count = (n, one, many) => `${n} ${n === 1 ? one : many}`;
function folded(b) {
  if (b.kind === "code" && b.rows > FOLD) return `<details class="fold"><summary>${esc(b.lang ? b.lang.toUpperCase() : "Code")}<span class="n">${count(b.rows, "line", "lines")}</span></summary>${b.html}</details>`;
  if (b.kind === "table" && b.rows > FOLD) return `<details class="fold"><summary>Table<span class="n">${count(b.rows, "row", "rows")}</span></summary>${b.html}</details>`;
  return b.html;
}
export function doc(src) {
  const out = [];
  let section = null;
  const close = () => {
    if (!section) return;
    const lines = section.body.reduce((n, b) => n + b.lines, 0);
    out.push(`<details class="fold sec"${lines <= FOLD ? " open" : ""}><summary>${section.title}<span class="n">${count(lines, "line", "lines")}</span></summary>${section.body.map(folded).join("")}</details>`);
    section = null;
  };
  for (const b of blocks(src, false, true)) {
    if (b.kind === "h") { close(); section = { title: b.title, body: [] }; } else if (section) section.body.push(b);
    else out.push(folded(b));
  }
  close();
  return out.join("");
}
