// The owner's inbox, S.inbox: one item per open question, HQ update and room, in the order the HUD lists them
// (blocking, open, updates, rooms). Not HQ's inbox (inbox.ts). The full records stay in S.open, S.updates and
// S.rooms; an item holds what the stack shows and the links the reader shows as preview cards, built only from what
// this server knows (a room's shelf, the rooms themselves), never by fetching a page.
import { db } from "./db.ts";
import { version } from "./push.ts";
import { addStatePart } from "./state.ts";
import { kindOf, roomsView } from "./rooms.ts";
import type { Ask } from "./types.ts";

export type InboxLink = {
  url: string;
  kind: string; // claude-artifact, link, image, file, or room (a link to #room/SLUG on this HUD)
  title: string;
  host: string;
  shelf: { slug: string; title: string } | null; // the room whose shelf has the same URL
  by: string | null;
  at: number | null;
};
export type InboxItem = {
  key: string; // "ask:12", "update:5", "room:ope-7"
  kind: "question" | "update" | "room";
  ref: number | string; // the ask's id, the update's id or the room's slug
  group: "blocking" | "open" | "updates" | "rooms";
  lane: string | null;
  title: string;
  preview: string; // the body's first words, as plain text
  at: number; // asked, posted, or the room's last activity
  needsYou: boolean; // an open question, an unread update, a room with lane messages the owner has not seen
  unread: boolean;
  priority: number | null;
  locked: boolean;
  short: boolean; // a question the owner can answer from the stack, without reading more
  shape: { lines: number; tables: number; code: number };
  links: InboxLink[];
  // The owner's thread with the lane on this question or update (a room the HUD keeps, see threads.ts), once there is one.
  thread: { slug: string; unread: number; undelivered: number; at: number | null } | null;
};

const FENCE = /^\s*```/;
const TABLE_RULE = /^\s*\|?\s*:?-{2,}/;
const URLS = /\[([^\]\n]+)\]\(((?:https?:\/\/|\/(?!\/))[^\s)]*)\)|https?:\/\/[^\s<)\]]+/g;

// What a body holds: its lines, its tables and its code blocks.
export function shapeOf(body: string | null) {
  const lines = String(body ?? "").replace(/\r\n?/g, "\n").split("\n");
  const fences = lines.filter((l) => FENCE.test(l)).length;
  return { lines: body ? lines.length : 0, tables: lines.filter((l, i) => i > 0 && TABLE_RULE.test(l) && /\|/.test(lines[i - 1])).length, code: Math.floor(fences / 2) };
}

// The body's first words as plain text: code, tables and markup left out.
export function previewOf(body: string | null, n = 140) {
  const out: string[] = [];
  let code = false;
  for (const line of String(body ?? "").split(/\r?\n/)) {
    if (FENCE.test(line)) { code = !code; continue; }
    if (code || /^\s*\|/.test(line) || /^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) continue;
    const t = line.replace(/^\s*(#{1,6}|>|[-*+]|\d+[.)])\s+/, "").replace(/\[([^\]\n]+)\]\([^)\s]*\)/g, "$1").replace(/\*\*|__|`|~~/g, "").replace(/\[image: [^\]]+\]/g, "[image]").trim();
    if (t) out.push(t);
    if (out.join(" ").length > n) break;
  }
  const t = out.join(" ");
  return t.length > n ? t.slice(0, n - 1).replace(/\s+\S*$/, "") + "…" : t;
}

// A question the stack can answer: no secrets to paste, an answer that is a pick or a button, and a body short
// enough to read on the card.
function isShort(a: Ask & { options: string[]; secrets: string[] }) {
  const shape = shapeOf(a.body);
  const plain = !shape.tables && !shape.code && !/^\s*#{1,6}\s/m.test(a.body ?? "");
  return !a.secrets.length && a.options.length <= 4 && (a.options.length > 0 || a.kind !== "decision") && (a.body ?? "").length <= 200 && plain;
}

type Shelf = { url: string; title: string; by: string; at: number; slug: string; room: string };
const host = (u: string) => { try { return new URL(u).host.replace(/^www\./, ""); } catch { return ""; } };

// Every URL in a question or update (its link column first), as a card: the title from a shelf that has the same URL,
// else the link's own words, else its address.
export function linksOf(texts: (string | null)[], shelves: Map<string, Shelf>, rooms: Map<string, string>): InboxLink[] {
  const seen = new Set<string>();
  const out: InboxLink[] = [];
  for (const text of texts) {
    for (const m of String(text ?? "").matchAll(URLS)) {
      const url = (m[2] ?? m[0]).replace(/[.,;:!?]+$/, "");
      if (seen.has(url)) continue;
      seen.add(url);
      const room = url.match(/#room\/([a-z0-9][a-z0-9-]{0,47})$/)?.[1];
      if (room && rooms.has(room)) {
        out.push({ url: `#room/${room}`, kind: "room", title: rooms.get(room)!, host: "", shelf: null, by: null, at: null });
        continue;
      }
      if (url.startsWith("/") && !url.startsWith("/room-files/") && !url.startsWith("/uploads/")) continue;
      const s = shelves.get(url) ?? null;
      let kind = "link";
      try { kind = kindOf(url); } catch {}
      out.push({ url, kind, title: s?.title ?? m[1] ?? (host(url) + (url.replace(/^https?:\/\/[^/]+/, "").replace(/\/$/, "") || "")), host: host(url), shelf: s ? { slug: s.slug, title: s.room } : null, by: s?.by ?? null, at: s?.at ?? null });
    }
  }
  return out;
}

type OpenAsk = Ask & { options: string[]; secrets: string[] };
type Update = { id: number; at: number; lane: string | null; title: string; body: string | null; read_at: number | null };
type RoomRow = ReturnType<typeof roomsView>[number];

// The shelves of the listed rooms (never an archived room that is no longer listed), by URL; the newest link to a URL
// wins. Kept until the next write: every write bumps the version.
let shelfCache: { key: string; shelves: Map<string, Shelf> } | null = null;
function shelvesOf(slugs: string[]) {
  const key = `${version}:${slugs.join("\n")}`;
  if (shelfCache?.key === key) return shelfCache.shelves;
  const shelves = new Map<string, Shelf>();
  if (slugs.length) {
    const rows = db.query(`SELECT a.url, a.title, a.by, a.at, a.slug, r.title AS room FROM room_artifacts a JOIN rooms r ON r.slug = a.slug WHERE a.slug IN (${slugs.map(() => "?").join(",")}) ORDER BY a.id`).all(...slugs) as Shelf[];
    for (const s of rows) shelves.set(s.url, s);
  }
  shelfCache = { key, shelves };
  return shelves;
}

// The inbox from the open asks, the updates and the rooms, as state() loads them.
export function inboxOf(asks: OpenAsk[], updates: Update[], rooms: RoomRow[]): InboxItem[] {
  const shelves = shelvesOf(rooms.map((r) => r.slug));
  const roomTitles = new Map(rooms.map((r) => [r.slug, r.title]));
  // A thread shows with its question or update while that is listed; after, as a room, so a lane's reply still lands.
  const threads = new Map(rooms.filter((r) => r.thread).map((r) => [`${r.thread!.kind}:${r.thread!.ref}`, r]));
  const listed = new Set([...asks.map((a) => `question:${a.id}`), ...updates.map((u) => `update:${u.id}`)]);
  const threadOf = (key: string) => { const r = threads.get(key); return r ? { slug: r.slug, unread: r.unread, undelivered: r.undelivered, at: r.threadAt } : null; };
  return [
    ...asks.map((a): InboxItem => ({
      key: `ask:${a.id}`,
      kind: "question",
      ref: a.id,
      group: a.tier === "blocking" ? "blocking" : "open",
      lane: a.lane,
      title: a.title,
      preview: previewOf(a.body),
      at: a.created_at,
      needsYou: true,
      unread: true,
      priority: a.priority ?? 2,
      locked: !!a.tier_locked,
      short: isShort(a),
      shape: shapeOf(a.body),
      links: linksOf([a.link, a.body], shelves, roomTitles),
      thread: threadOf(`question:${a.id}`),
    })),
    ...updates.map((u): InboxItem => ({
      key: `update:${u.id}`,
      kind: "update",
      ref: u.id,
      group: "updates",
      lane: u.lane,
      title: u.title,
      preview: previewOf(u.body),
      at: u.at,
      needsYou: !u.read_at || !!threads.get(`update:${u.id}`)?.unread,
      unread: !u.read_at,
      priority: null,
      locked: false,
      short: false,
      shape: shapeOf(u.body),
      links: linksOf([u.title, u.body], shelves, roomTitles),
      thread: threadOf(`update:${u.id}`),
    })),
    ...rooms.filter((r) => !r.thread || !listed.has(`${r.thread.kind}:${r.thread.ref}`)).map((r): InboxItem => ({
      key: `room:${r.slug}`,
      kind: "room",
      ref: r.slug,
      group: "rooms",
      lane: r.owner,
      title: r.title,
      preview: r.last ? `${r.last.who === "owner" ? `You → ${r.last.to}` : r.last.who}: ${r.last.text}` : "",
      at: r.lastAt,
      needsYou: !r.archivedAt && r.unread > 0,
      unread: r.unread > 0,
      priority: null,
      locked: false,
      short: false,
      shape: { lines: 0, tables: 0, code: 0 },
      links: [],
      thread: null,
    })),
  ];
}

// GET /api/owner-inbox: the same, loaded on its own.
export function ownerInbox(): InboxItem[] {
  const asks = (db.query("SELECT * FROM asks WHERE status = 'open' ORDER BY tier = 'blocking' DESC, priority, COALESCE(due, 9e15), created_at").all() as Ask[])
    .map((a) => ({ ...a, options: a.options ? JSON.parse(a.options) : [], secrets: a.secrets ? JSON.parse(a.secrets) : [] }));
  return inboxOf(asks, db.query("SELECT * FROM updates ORDER BY at DESC, id DESC LIMIT 40").all() as Update[], roomsView());
}

// In /api/state it is built from the parts state() has already loaded (rooms.ts adds S.rooms before this part), so a
// state build runs no query of its own here, but the shelves after a write.
addStatePart("inbox", (s) => inboxOf(s.open, s.updates, s.rooms ?? roomsView()));
