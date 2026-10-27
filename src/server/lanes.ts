// Lanes: their status as the page shows it, and HQ's writes to them.
import { STALE_MS } from "./config.ts";
import { db } from "./db.ts";
import type { Lane } from "./types.ts";
import { event } from "./events.ts";
import { notifyHq } from "./hq-link.ts";
import { oneLine } from "../agent-text.ts";
import { laneTree, levelName, levelNames, underHq } from "../lane-tree.ts";

// An agent at work: herdr says working, or an idle agent still has shells, a monitor or subagents running (bg).
export const laneWorking = (lane: Lane | null | undefined) => !!lane && (lane.herdr === "working" || !!lane.bg);

// An open ask waits on the owner, or on the lane's lead while the lead holds it (decision D20), but a lane can hold a
// parked question and work on at once: only a lane that is not working reads needs_you (or with_lead). The owner
// wins over a lead. The state's `asks` count still shows the question on a working lane.
// A lane blocked on a prompt in herdr (lane.prompt, set by the sync) is blocked before anything else: nothing moves
// until someone answers it in its pane.
export function laneStatus(lane: Lane, waits: { owner: Map<string, number>; lead?: Map<string, number> }, now: number): string {
  if (lane.prompt) return "blocked";
  if (waits.owner.get(lane.name) && !laneWorking(lane)) return "needs_you";
  if (waits.lead?.get(lane.name) && !laneWorking(lane)) return "with_lead";
  if (lane.phase === "done" || lane.phase === "parked") return lane.phase;
  if (lane.phase === "waiting") return "waiting";
  if (laneWorking(lane)) return "moving";
  if (lane.herdr === "gone") return "gone";
  if (lane.herdr_since && now - lane.herdr_since > STALE_MS) return "stale";
  return "hq_turn";
}


const LANE_FIELDS = ["title", "machine", "pane", "issue", "pr", "phase", "note"] as const;

// A new lane's name (review finding 12): it is typed into HQ and other lanes, shown on the page and matched against
// herdr's agent names, so it is a plain word: a letter or digit first (never a flag or a dotfile), then letters,
// digits, dot, underscore or hyphen, at most 64 in all. A lane registered before the check keeps its name.
const LANE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

export function upsertLane(body: any) {
  if (!body.name) throw new Error("name is required");
  const parent = body.parent === undefined ? undefined : underHq(body.parent) ? null : String(body.parent).trim();
  const known = db.query("SELECT parent FROM lanes WHERE name = ?").get(body.name) as { parent: string | null } | null;
  if (!known && !(typeof body.name === "string" && LANE_NAME.test(body.name)))
    throw new Error("a lane's name is letters, digits, dot, underscore or hyphen (a letter or digit first), at most 64, such as web-pm or api.auth_2");
  if (parent) checkParent(body.name, parent); // before any write: a refused parent changes nothing
  const now = Date.now();
  db.query("INSERT INTO lanes (name, updated_at) VALUES (?, ?) ON CONFLICT(name) DO NOTHING").run(body.name, now);
  for (const f of LANE_FIELDS) {
    if (body[f] !== undefined) db.query(`UPDATE lanes SET ${f} = ?, updated_at = ? WHERE name = ?`).run(body[f] === "" ? null : body[f], now, body.name);
  }
  if (parent !== undefined) {
    const before = known?.parent ?? null;
    if (before !== parent) {
      db.query("UPDATE lanes SET parent = ?, updated_at = ? WHERE name = ?").run(parent, now, body.name);
      // Who asked is not known: any local agent may call this, and a lane's parent is its lead (decision D20). So a
      // move of an existing lane is logged as the HUD saw it, and HQ hears of it, so a lane that made itself another's
      // lead does not go unseen (review finding 6).
      const [lane, to, from] = [body.name, parent ?? "HQ", before ?? "HQ"].map(oneLine);
      if (!known) event("hq", `reports to ${to}`, body.name);
      else {
        event("hud", `now reports to ${to} (was ${from})`, body.name);
        notifyHq(`HUD: lane ${lane} now reports to ${to} (was ${from})${parent ? `, so ${to} is its lead` : ""}. If you did not move it, check who did.`);
      }
    }
  }
  if (body.note || body.phase) event("hq", [body.phase && `phase ${body.phase}`, body.note].filter(Boolean).join(": "), body.name);
}

// A lane reports to a lane that exists, never to itself, and never to one of its own reports (a loop).
function checkParent(name: string, parent: string) {
  if (parent === name) throw new Error(`${name} cannot report to itself`);
  const parentOf = (n: string) => (db.query("SELECT parent FROM lanes WHERE name = ?").get(n) as { parent: string | null } | null);
  if (!parentOf(parent)) throw new Error(`no lane named ${parent}: register it first, or use --parent hq`);
  const chain = [parent];
  for (let p = parentOf(parent)?.parent; p; p = parentOf(p)?.parent ?? null) {
    chain.unshift(p);
    if (p === name) throw new Error(`refused: ${parent} already reports to ${name} (${chain.join(" > ")}), so ${name} reporting to ${parent} would make a loop`);
    if (chain.length > 1000) break;
  }
}

// Removing a lane moves its reports up to the lane it reported to (or HQ); nothing else changes.
export function removeLane(name: string) {
  db.transaction(() => {
    const gone = db.query("SELECT parent FROM lanes WHERE name = ?").get(name) as { parent: string | null } | null;
    const up = gone?.parent ?? null;
    const kids = (db.query("SELECT name FROM lanes WHERE parent = ?").all(name) as { name: string }[]).map((r) => r.name);
    db.query("UPDATE lanes SET parent = ? WHERE parent = ?").run(up, name);
    db.query("DELETE FROM lanes WHERE name = ?").run(name);
    for (const k of kids) event("hq", `reports to ${up ?? "HQ"} (${name} was removed)`, k);
  })();
}

// Each lane with its place in the tree: depth (HQ is 0), path (its ancestors from the top) and level name.
export function withTree<T extends Lane>(lanes: T[]) {
  const row = db.query("SELECT value FROM settings WHERE key = 'levels'").get() as { value: string } | null;
  const names = levelNames(row ? JSON.parse(row.value) : null);
  const tree = laneTree(lanes);
  return lanes.map((l) => {
    const t = tree.get(l.name)!;
    return { ...l, parent: t.path.at(-1) ?? null, depth: t.depth, path: t.path, level: levelName(t.depth, names) };
  });
}
