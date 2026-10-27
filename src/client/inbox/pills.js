// The pills docked bottom right: a room with new messages (and the room the reader shows), the work board, Tell HQ.
// Each opens its item in the reader; the one the reader shows is lit.
import { on } from "../core/bus.js";
import { $ } from "../core/dom.js";
import { S } from "../core/state.js";
import { esc, setHTML } from "../core/format.js";
import { current } from "../reader/shell.js";

const MAX = 3;
function render() {
  // A thread shows with its question or update, not as a pill.
  const rooms = (S?.rooms ?? []).filter((r) => !r.archivedAt && !r.thread);
  const open = current?.kind === "room" ? current.ref : null;
  const pills = rooms.filter((r) => r.unread || r.slug === open).slice(0, MAX);
  setHTML($("roomPills"), pills.map((r) => `<button class="pill glass room${r.unread ? " unread" : ""}${r.slug === open ? " on" : ""}" type="button" data-read="room:${esc(r.slug)}" title="${esc(r.title)}"><span class="rk">ROOM</span><span class="t">${esc(r.title)}</span>${r.unread ? `<span class="tag count">${r.unread}</span>` : ""}</button>`).join(""));
  $("pWork").classList.toggle("on", current?.kind === "work");
  $("pTell").classList.toggle("on", current?.kind === "tell");
  $("tellDock").classList.toggle("on", current?.kind === "tell");
}
on("state", (S, keys) => { if (!keys || keys.has("rooms")) render(); });
on("reader", render);
