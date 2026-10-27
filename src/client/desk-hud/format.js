// The desk HUD's words and numbers: a short model name, token counts ("412k", "1M"), the status word and its tone.

// "claude-opus-5-5" -> "opus 5.5", "claude-sonnet-4-5-20250929" -> "sonnet 4.5", "claude-3-5-haiku" -> "haiku 3.5",
// "haiku" -> "haiku". Another id is shown as it is, cut to fit; null is a dash, never a guess.
export function shortModel(model) {
  if (!model) return "—";
  const id = String(model).toLowerCase().replace(/^claude-/, "").replace(/\[1m\]$/, "").replace(/-\d{8}$/, "");
  const named = id.match(/^([a-z]+)-(\d+)(?:-(\d+))?$/);
  if (named) return `${named[1]} ${named[2]}${named[3] ? `.${named[3]}` : ""}`;
  const old = id.match(/^(\d+)(?:-(\d+))?-([a-z]+)$/);
  if (old) return `${old[3]} ${old[1]}${old[2] ? `.${old[2]}` : ""}`;
  return id.length > 18 ? `${id.slice(0, 17)}…` : id;
}

// 412000 -> "412k", 1000000 -> "1M", 1500000 -> "1.5M", 8400 -> "8.4k", 950 -> "950". null is a dash.
export function tokens(n) {
  if (n == null || !Number.isFinite(n)) return "—";
  const one = (v) => String(Math.round(v * 10) / 10);
  if (n >= 999_500) return `${one(n / 1e6)}M`;
  if (n >= 10_000) return `${Math.round(n / 1000)}k`;
  if (n >= 1000) return `${one(n / 1000)}k`;
  return String(Math.round(n));
}

// Status word and tone (a glass status colour) per lane status: the world's table in spec section 3.
const STATUS = {
  needs_you: ["needs you", "red"],
  with_lead: ["with lead", "amber"],
  blocked: ["blocked", "red"],
  hq_turn: ["on HQ", "amber"],
  waiting: ["waiting", "blue"],
  moving: ["working", "green"],
  done: ["done", "teal"],
  parked: ["parked", "grey"],
  gone: ["gone", "grey"],
  stale: ["stale", "grey"],
};
export const statusOf = (status) => STATUS[status] ?? [String(status ?? "—"), "grey"];
export const waitsOnOwner = (status) => status === "needs_you" || status === "blocked";

const FAMILIES = new Set(["opus", "sonnet", "haiku"]);
export const familyClass = (family) => (FAMILIES.has(family) ? family : "other");
