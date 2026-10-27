// /api/state: everything the page draws, in one object. A feature adds its part with addStatePart.
import { CONFIG, whoOf } from "./config.ts";
import { db } from "./db.ts";
import type { Ask, Lane } from "./types.ts";
import { secrets, version } from "./push.ts";
import { lastSync, untracked } from "./herdr.ts";
import { laneStatus, withTree } from "./lanes.ts";
import { score } from "./score.ts";
import { pageStamp } from "./page.ts";
import { machineHealth } from "./machines.ts";
import { board } from "./work-board.ts";
import { HOP_COLUMNS, HOP_JOIN } from "./lead-router.ts";

export function state() {
  const now = Date.now();
  const lanes = db.query("SELECT * FROM lanes ORDER BY name").all() as Lane[];
  // The owner's own first (an ask a lead holds waits on the lead; decision D20), then blocking, then by priority
  // (0 urgent .. 3 low), then the due time, then the oldest. Each ask carries its hop to a lead, if it had one.
  const open = db
    .query(`SELECT a.*, ${HOP_COLUMNS} FROM asks a ${HOP_JOIN} WHERE a.status = 'open' ORDER BY a.holder IS NULL DESC, a.tier = 'blocking' DESC, a.priority, COALESCE(a.due, 9e15), a.created_at`)
    .all() as Ask[];
  const answered = db
    .query(`SELECT a.*, ${HOP_COLUMNS} FROM asks a ${HOP_JOIN} WHERE a.status != 'open' AND COALESCE(a.answered_at, a.created_at) >= ? ORDER BY a.answered_at DESC LIMIT 40`)
    .all(now - 24 * 3600_000) as Ask[];
  const count = (pick: (a: Ask) => string | null | false) => {
    const m = new Map<string, number>();
    for (const a of open) {
      const k = pick(a);
      if (k) m.set(k, (m.get(k) ?? 0) + 1);
    }
    return m;
  };
  const openByLane = count((a) => a.lane);
  const blockingByLane = count((a) => a.tier === "blocking" && a.lane);
  // Waits on: the owner (needs_you) or its lead (with_lead). Holding: the asks a lane holds as a lead.
  const waits = { owner: count((a) => !a.holder && a.lane), lead: count((a) => !!a.holder && a.lane) };
  const holding = count((a) => a.holder);
  const parse = (a: Ask) => ({ ...a, options: a.options ? JSON.parse(a.options) : [], secrets: a.secrets ? JSON.parse(a.secrets) : [] });
  const base = {
    now,
    version,
    lanes: withTree(lanes).map((l) => ({ ...l, status: laneStatus(l, waits, now), asks: openByLane.get(l.name) ?? 0, blocking: blockingByLane.get(l.name) ?? 0, holding: holding.get(l.name) ?? 0 })),
    open: open.map(parse),
    answered: answered.map(parse),
    notes: db.query("SELECT * FROM notes ORDER BY at DESC LIMIT 20").all(),
    updates: db.query("SELECT * FROM updates ORDER BY at DESC, id DESC LIMIT 40").all(),
    updatesUnread: (db.query("SELECT COUNT(*) AS n FROM updates WHERE read_at IS NULL").get() as { n: number }).n,
    events: (db.query("SELECT * FROM events ORDER BY at DESC LIMIT 60").all() as { who: string }[]).map((e) => ({ ...e, who: whoOf(e.who) })),
    score: score(now),
    untracked,
    sync: lastSync,
    page: pageStamp(),
    config: CONFIG,
    machines: machineHealth(),
  };
  return {
    ...base,
    ...stateParts(base),
    secrets: secrets.list(),
    board: board.view(),
  };
}

// A feature adds its own part of the state here instead of editing state(): addStatePart("board", () => board.view()).
// A part gets the state built so far (the core above and the parts added before it), so it can build on what is
// already loaded instead of querying it again.
const parts = new Map<string, (sofar: Record<string, any>) => unknown>();
export function addStatePart(key: string, value: (sofar: Record<string, any>) => unknown) {
  parts.set(key, value);
}
function stateParts(base: Record<string, any>) {
  const sofar: Record<string, any> = { ...base };
  for (const [k, value] of parts) sofar[k] = value(sofar);
  return Object.fromEntries([...parts.keys()].map((k) => [k, sofar[k]]));
}
