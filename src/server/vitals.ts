// Lane vitals for the desk HUD: model, effort, running subagents and context in use. Read from a Claude Code lane's
// own session transcript on this machine, or reported by the lane (POST /api/lanes/:name/vitals); a report wins until
// the transcript changes after it. Served as S.vitals[laneName]. Only the tail of a transcript is read, and only its
// model, effort and token counts are kept: no transcript text leaves this file.
import { closeSync, openSync, readdirSync, readFileSync, readSync, statSync, type Stats } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { LOCAL } from "./config.ts";
import { db } from "./db.ts";
import { localAgents } from "./herdr.ts";
import { bump } from "./push.ts";
import { addStatePart } from "./state.ts";

// Where Claude Code keeps its settings and transcripts. HUD_CLAUDE_DIR points tests at a fixture.
const CLAUDE = process.env.HUD_CLAUDE_DIR || process.env.CLAUDE_CONFIG_DIR || join(process.env.HOME || homedir(), ".claude");
const PROJECTS = join(CLAUDE, "projects");
const TAIL = 256 * 1024; // bytes read from the end of a transcript: the last assistant message is near the end
const SUBAGENT_TAIL = 64 * 1024;
// A subagent runs until its meta file says finished. One that never says so (its session was killed) counts as gone
// once its transcript has been quiet this long; long enough to cover a long tool call.
const QUIET_MS = 10 * 60_000;
const CHECK_MS = 10_000; // how often a change in a transcript is pushed to open pages

// Context window by model id, first match wins; anything else gets DEFAULT_MAX. The 5.x models run with a 1M window
// although their ids carry no "[1m]" (transcripts show contexts near 970k).
const CONTEXT_MAX: [RegExp, number][] = [
  [/\[1m\]$/i, 1_000_000],
  [/^claude-(opus|sonnet|haiku)-5/, 1_000_000],
];
const DEFAULT_MAX = 200_000;
const LARGEST_MAX = 1_000_000; // a context bigger than the table's window means the lane runs the large one

export type Family = "opus" | "sonnet" | "haiku" | "other";
export type Subagent = { id: string; model: string | null; family: Family; description: string | null };
export type Vitals = {
  model: string | null;
  family: Family;
  effort: string | null;
  contextUsed: number | null;
  contextMax: number | null;
  subagents: Subagent[];
  source: "transcript" | "report" | "mixed";
  at: number;
};
type Report = { lane: string; model: string | null; effort: string | null; subagents: number | null; context_used: number | null; context_max: number | null; reported_at: number };
type Reading = { model: string | null; effort: string | null; contextUsed: number | null; subagents: Subagent[]; at: number };
type Last = { model: string; effort: string | null; contextUsed: number | null };

export const familyOf = (model: string | null): Family => (model?.match(/opus|sonnet|haiku/i)?.[0].toLowerCase() as Family | undefined) ?? "other";

function contextMaxOf(model: string | null, used: number | null): number {
  const max = (model && CONTEXT_MAX.find(([id]) => id.test(model))?.[1]) || DEFAULT_MAX;
  return used !== null && used > max ? Math.max(LARGEST_MAX, used) : max;
}

const statOf = (path: string): Stats | null => {
  try {
    return statSync(path);
  } catch {
    return null;
  }
};

// The last `bytes` of a file, from the first whole line on.
function tail(path: string, size: number, bytes: number): string {
  const start = Math.max(0, size - bytes);
  const buf = Buffer.alloc(size - start);
  const fd = openSync(path, "r");
  try {
    readSync(fd, buf, 0, buf.length, start);
  } finally {
    closeSync(fd);
  }
  const text = buf.toString("utf8");
  return start > 0 ? text.slice(text.indexOf("\n") + 1) : text;
}

const tokens = (n: unknown) => (typeof n === "number" && Number.isFinite(n) ? n : 0);
// The model, effort and context in use of the last assistant message in a piece of transcript; nothing else of it.
function lastAssistant(text: string): Last | null {
  const lines = text.split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    if (!lines[i].includes('"assistant"')) continue;
    let line: any;
    try {
      line = JSON.parse(lines[i]);
    } catch {
      continue;
    }
    const message = line?.message;
    // "<synthetic>" marks a message Claude Code made itself (an API error), not the model's.
    if (line?.type !== "assistant" || typeof message?.model !== "string" || message.model.startsWith("<")) continue;
    const u = message.usage;
    return {
      model: message.model,
      effort: typeof line.effort === "string" ? line.effort : null,
      contextUsed: u && typeof u === "object" ? tokens(u.input_tokens) + tokens(u.cache_creation_input_tokens) + tokens(u.cache_read_input_tokens) : null,
    };
  }
  return null;
}

// A file is read again only when its mtime or size moved; read() gets what the last read found.
const memo = new Map<string, { stamp: string; value: unknown; gen: number }>();
let gen = 0;
function onChange<T>(path: string, st: Stats, read: (prev: T | undefined) => T): T {
  const stamp = `${st.mtimeMs}:${st.size}`;
  const hit = memo.get(path);
  const value = hit?.stamp === stamp ? (hit.value as T) : read(hit?.value as T | undefined);
  memo.set(path, { stamp, value, gen });
  return value;
}
function readJson(path: string): any {
  const st = statOf(path);
  if (!st) return null;
  return onChange(path, st, () => {
    try {
      return JSON.parse(readFileSync(path, "utf8"));
    } catch {
      return null;
    }
  });
}

// Claude Code names a project's folder after its directory, every character but a letter or digit made "-".
const folderOf = (cwd: string) => cwd.replace(/[^a-zA-Z0-9]/g, "-");
const SESSION = /^[\w-]{1,100}$/;
function transcriptOf(session: string, cwds: string[]): { path: string; dir: string; cwd: string; st: Stats } | null {
  if (!SESSION.test(session)) return null;
  for (const cwd of cwds) {
    const dir = join(PROJECTS, folderOf(cwd));
    const path = join(dir, `${session}.jsonl`);
    const st = statOf(path);
    if (st) return { path, dir, cwd, st };
  }
  return null;
}

function subagentsOf(folder: string, now: number): Subagent[] {
  let files: string[];
  try {
    files = readdirSync(folder);
  } catch {
    return [];
  }
  const out: Subagent[] = [];
  for (const file of files.sort()) {
    const id = file.match(/^agent-([\w-]+)\.jsonl$/)?.[1];
    if (!id) continue;
    const path = join(folder, file);
    const st = statOf(path);
    if (!st || now - st.mtimeMs > QUIET_MS) continue;
    const meta = readJson(join(folder, `agent-${id}.meta.json`));
    if (meta?.finished === true) continue;
    // The model it actually runs (its transcript says), else the one it was asked for ("inherit" says nothing).
    const ran = onChange<string | null>(path, st, (prev) => prev ?? lastAssistant(tail(path, st.size, SUBAGENT_TAIL))?.model ?? null);
    const model = ran ?? (typeof meta?.model === "string" && meta.model !== "inherit" ? meta.model : null);
    out.push({ id, model, family: familyOf(model), description: typeof meta?.description === "string" ? meta.description.slice(0, 80) : null });
  }
  return out;
}

function settingsEffort(cwd: string | null): string | null {
  const paths = [...(cwd ? [join(cwd, ".claude", "settings.local.json"), join(cwd, ".claude", "settings.json")] : []), join(CLAUDE, "settings.json")];
  for (const path of paths) {
    const effort = readJson(path)?.effortLevel;
    if (typeof effort === "string" && effort) return effort;
  }
  return null;
}

// What a lane's own transcript says, and the directory its agent runs in.
function readLane(name: string, now: number): { reading: Reading | null; cwd: string | null } {
  const agent = localAgents.get(name);
  if (!agent || agent.kind !== "claude" || !agent.session) return { reading: null, cwd: agent?.cwds[0] ?? null };
  const found = transcriptOf(agent.session, agent.cwds);
  if (!found) return { reading: null, cwd: agent.cwds[0] ?? null };
  const { path, dir, cwd, st } = found;
  // A tail with no assistant message in it (one huge tool result) keeps what the last read found.
  const last = onChange<Last | null>(path, st, (prev) => lastAssistant(tail(path, st.size, TAIL)) ?? prev ?? null);
  const subagents = subagentsOf(join(dir, agent.session, "subagents"), now);
  return { reading: { model: last?.model ?? null, effort: last?.effort ?? null, contextUsed: last?.contextUsed ?? null, subagents, at: Math.floor(st.mtimeMs) }, cwd };
}

const reported = (n: number): Subagent[] => Array.from({ length: n }, (_, i) => ({ id: `reported-${i + 1}`, model: null, family: "other", description: null }));

// The report wins while it is at least as new as the transcript; a field the winner lacks comes from the other.
function merge(t: Reading | null, r: Report | null, cwd: string | null): Vitals | null {
  if (!t && !r) return null;
  const reportWins = !!r && (!t || r.reported_at >= t.at);
  const from = { report: false, transcript: false };
  const pick = <T>(rv: T | null | undefined, tv: T | null | undefined): T | null => {
    if (reportWins && rv != null) return (from.report = true), rv;
    if (tv != null) return (from.transcript = true), tv;
    if (rv != null) return (from.report = true), rv;
    return null;
  };
  const model = pick(r?.model, t?.model);
  const contextUsed = pick(r?.context_used, t?.contextUsed);
  const subagents = pick(r?.subagents != null ? reported(r.subagents) : null, t?.subagents) ?? [];
  const contextMax = (reportWins && r?.context_max != null ? ((from.report = true), r.context_max) : null) ?? contextMaxOf(model, contextUsed);
  return {
    model,
    family: familyOf(model),
    effort: pick(r?.effort, t?.effort) ?? settingsEffort(cwd),
    contextUsed,
    contextMax,
    subagents,
    source: from.report && from.transcript ? "mixed" : from.report ? "report" : "transcript",
    at: Math.max(t?.at ?? 0, r?.reported_at ?? 0),
  };
}

function vitalsOf(lane: { name: string; machine: string | null }, report: Report | null, now: number): Vitals | null {
  const local = !lane.machine || lane.machine === LOCAL;
  const { reading, cwd } = local ? readLane(lane.name, now) : { reading: null, cwd: null };
  return merge(reading, report, cwd);
}

export function vitals(): Record<string, Vitals> {
  gen++;
  const now = Date.now();
  const reports = new Map((db.query("SELECT * FROM lane_vitals").all() as Report[]).map((r) => [r.lane, r]));
  const out: Record<string, Vitals> = {};
  for (const lane of db.query("SELECT name, machine FROM lanes ORDER BY name").all() as { name: string; machine: string | null }[]) {
    const v = vitalsOf(lane, reports.get(lane.name) ?? null, now);
    if (v) out[lane.name] = v;
  }
  for (const [path, entry] of memo) if (entry.gen !== gen) memo.delete(path);
  return out;
}

// A lane's report, checked here at the boundary and merged into its row: a field left out keeps what it said before.
const MODEL = /^[\w.:@/[\]-]{1,100}$/;
const EFFORT = /^[a-z]{1,20}$/;
function count(body: Record<string, unknown>, key: string, max: number): number | null {
  const v = body[key];
  if (v == null) return null;
  if (typeof v !== "number" || !Number.isInteger(v) || v < 0 || v > max) throw new Error(`${key} must be a whole number from 0 to ${max}`);
  return v;
}
export function reportVitals(lane: string, body: unknown): Vitals | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("vitals must be an object");
  const b = body as Record<string, unknown>;
  const row = db.query("SELECT name, machine FROM lanes WHERE name = ?").get(lane) as { name: string; machine: string | null } | null;
  if (!row) throw new Error(`no lane named ${lane}`);
  const model = b.model == null ? null : String(b.model).trim();
  if (model !== null && !MODEL.test(model)) throw new Error("model must be a model id such as claude-opus-5-5");
  const effort = b.effort == null ? null : String(b.effort).trim().toLowerCase();
  if (effort !== null && !EFFORT.test(effort)) throw new Error("effort must be one word, such as high");
  const subagents = count(b, "subagents", 1000);
  const used = count(b, "contextUsed", 100_000_000);
  const max = count(b, "contextMax", 100_000_000);
  if (used !== null && max !== null && used > max) throw new Error("contextUsed is more than contextMax");
  if ([model, effort, subagents, used, max].every((v) => v === null)) throw new Error("say at least one of model, effort, subagents, contextUsed, contextMax");
  db.query(
    `INSERT INTO lane_vitals (lane, model, effort, subagents, context_used, context_max, reported_at) VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(lane) DO UPDATE SET model = COALESCE(excluded.model, model), effort = COALESCE(excluded.effort, effort),
       subagents = COALESCE(excluded.subagents, subagents), context_used = COALESCE(excluded.context_used, context_used),
       context_max = COALESCE(excluded.context_max, context_max), reported_at = excluded.reported_at`,
  ).run(lane, model, effort, subagents, used, max, Date.now());
  return vitalsOf(row, db.query("SELECT * FROM lane_vitals WHERE lane = ?").get(lane) as Report, Date.now());
}

addStatePart("vitals", vitals);

// Transcripts change without a write to this server: look every CHECK_MS and push when what the page shows moved.
let shown = "";
setInterval(() => {
  const now = JSON.stringify(vitals());
  if (now !== shown) {
    if (shown) bump();
    shown = now;
  }
}, CHECK_MS).unref();
