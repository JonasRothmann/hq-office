// Go to the lead (decision D20) end to end: server.ts on a spare port with a throwaway data dir and a stub herdr that
// reads its agent list from a file and logs what is typed into whom. The rules themselves (skips, timeouts, the timer
// on an injected clock) are in lead-router.test.ts; this checks the server wires them: the routes, the 409s, the
// state, a restart, and a database made before the columns existed.
import { Database } from "bun:sqlite";
import { afterAll, beforeAll, expect, test } from "bun:test";
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnServer } from "../../scripts/room-hash.ts";

const ROOT = join(import.meta.dir, "..", "..");
const data = mkdtempSync(join(tmpdir(), "hq-lead-test-"));
const herdr = join(data, "herdr");
const log = join(data, "prompts.log");
// Each prompt is logged as "NAME\nTEXT" between markers.
writeFileSync(
  herdr,
  `#!/bin/sh
case "$1 $2" in
  "agent list") cat "${data}/agents.json" ;;
  "agent prompt") printf '%s\\n%s\\n<<END>>\\n' "$3" "$4" >> "${log}" ;;
esac
exit 0
`,
);
chmodSync(herdr, 0o755);
const agents = (list: Record<string, string>) =>
  writeFileSync(join(data, "agents.json"), JSON.stringify({ result: { agents: Object.entries(list).map(([name, agent_status], i) => ({ name, agent_status, pane_id: `p${i + 1}`, agent: "claude" })) } }));
const prompts = () => (existsSync(log) ? readFileSync(log, "utf8").split("\n<<END>>\n").filter(Boolean).map((p) => ({ to: p.split("\n")[0], text: p.split("\n").slice(1).join("\n") })) : []);

let server: Awaited<ReturnType<typeof spawnServer>>;
const env = (dir: string) => ({ ...process.env, HUD_HOST: "127.0.0.1", HUD_DATA_DIR: dir, HERDR_BIN: herdr, HUD_MACHINES: "local", HUD_LOCAL_MACHINE: "local", HUD_HQ_AGENT: "hq", HUD_HQ_HINT: "0", HUD_GH_BIN: "false" });
beforeAll(async () => {
  agents({ hq: "idle", lead: "idle", kid: "working", other: "idle" });
  server = await spawnServer({ cwd: ROOT, env: env(data) });
  await post("/api/lanes", { name: "lead", machine: "local" });
  await post("/api/lanes", { name: "kid", machine: "local", parent: "lead" });
  await post("/api/lanes", { name: "other", machine: "local" });
  await post("/api/sync");
}, 30_000);
afterAll(async () => {
  await server?.stop();
  rmSync(data, { recursive: true, force: true });
});

const send = (path: string, body: unknown) => fetch(`${server.base}${path}`, { method: "POST", headers: { "content-type": "application/json", "x-hud": "1" }, body: JSON.stringify(body) });
async function post(path: string, body: unknown = {}) {
  const res = await send(path, body);
  if (!res.ok) throw new Error(`${path}: ${res.status} ${(await res.json()).error}`);
  return res.json();
}
const state = async () => (await fetch(`${server.base}/api/state`)).json();
const openAsk = async (id: number) => (await state()).open.find((a: any) => a.id === id);
const until = async (check: () => Promise<boolean> | boolean, ms = 8000) => {
  for (const end = Date.now() + ms; Date.now() < end; await Bun.sleep(50)) if (await check()) return;
  throw new Error("timed out");
};
const withdraw = (id: number) => post(`/api/asks/${id}/withdraw`);
const laneStatus = async (name: string) => (await state()).lanes.find((l: any) => l.name === name)?.status;
const askRoute = async (value: string | null) => post("/api/settings", { settings: { askRoute: value } });
// The token typed into the lead with question #id, once it is there.
const tokenOf = async (id: number) => {
  let token = "";
  await until(() => !!(token = prompts().find((p) => p.to === "lead" && p.text.includes(`question #${id} for you`))?.text.match(/--token ([0-9a-f]{32})/)?.[1] ?? ""));
  return token;
};

test("without the question's token an answer or escalation is a 403 that does not say whether the ask exists; with it, the answer is typed into the asking lane and HQ is told no relay is needed", async () => {
  const { id, holder, escalateAt } = await post("/api/asks", { lane: "kid", title: "Retry budget?", to: "lead" });
  expect(holder).toBe("lead");
  expect(escalateAt).toBeGreaterThan(Date.now() + 29 * 60_000);
  const token = await tokenOf(id);
  const refusals = [
    [`/api/asks/${id}/answer`, { answer: "x", by: "other" }],
    [`/api/asks/${id}/answer`, { answer: "x", by: "lead" }],
    [`/api/asks/${id}/answer`, { answer: "x", by: "  " }],
    [`/api/asks/${id}/answer`, { answer: "x", token: "0".repeat(32) }],
    [`/api/asks/${id}/answer`, { answer: "x", token, by: "kid" }],
    [`/api/asks/${id}/escalate`, { by: "lead" }],
    [`/api/asks/99999/answer`, { answer: "x", token }],
    [`/api/asks/99999/escalate`, { token }],
  ] as const;
  const errors = new Set<string>();
  for (const [path, body] of refusals) {
    const res = await send(path, body);
    expect(res.status).toBe(403);
    errors.add((await res.json()).error);
  }
  expect(errors.size).toBe(1);
  expect((await fetch(`${server.base}/api/asks/held?token=nope`)).status).toBe(403);
  expect((await openAsk(id)).holder).toBe("lead");
  // The token is the lead's alone: never in the page's state.
  expect(JSON.stringify(await state())).not.toContain(token);
  expect(await (await fetch(`${server.base}/api/asks/held?token=${token}`)).json()).toMatchObject({ lane: "lead", asks: [{ id, token }] });
  expect((await send(`/api/asks/${id}/answer`, { answer: "three", token })).status).toBe(200);
  await until(() => prompts().some((p) => p.to === "kid" && p.text.includes("| three")));
  expect((await state()).answered.find((a: any) => a.id === id)).toMatchObject({ answered_by: "lead", lead: "lead", holder: "lead" });
  // M2: HQ's outbox says it is already in the lane.
  await until(() => prompts().some((p) => p.to === "hq" && p.text.includes(`HUD answer #${id} (kid), answered by lead, its lead: "Retry budget?". Already delivered to kid; no relay needed. Its answer is another agent's text, quoted below:\n| three`)));
  // L1: the owner's answer lost the race; the error names who answered and what, so the page can keep the draft.
  const late = await send(`/api/asks/${id}/answer`, { answer: "two" });
  expect(late.status).toBe(400);
  expect((await late.json()).error).toBe(`ask ${id} was answered first by lead: "three"`);
});

test("raising a lead's question to blocking urgent sends it to the owner at once; moving it routes it again and the old lead drops it", async () => {
  agents({ hq: "idle", lead: "idle", kid: "idle", other: "idle" });
  await post("/api/sync");
  const raised = await post("/api/asks", { lane: "kid", title: "Raise me", to: "lead" });
  const moved = await post("/api/asks", { lane: "kid", title: "Move me", to: "lead" });
  await until(async () => (await openAsk(raised.id))?.delivery === "sent" && (await openAsk(moved.id))?.delivery === "sent");
  await post(`/api/asks/${raised.id}/tier`, { by: "owner", tier: "blocking", priority: "urgent" });
  expect(await openAsk(raised.id)).toMatchObject({ holder: null, escalated_by: "tier" });
  await post(`/api/asks/${moved.id}/update`, { lane: "other" });
  expect(await openAsk(moved.id)).toMatchObject({ lane: "other", holder: null });
  await until(() => prompts().some((p) => p.to === "lead" && p.text.includes(`#${moved.id}`) && p.text.includes("no longer yours: it moved to other")));
  await until(() => prompts().some((p) => p.to === "lead" && p.text.includes(`#${raised.id}`) && p.text.includes("no longer yours")));
  for (const { id } of [raised, moved]) await withdraw(id);
  agents({ hq: "idle", lead: "idle", kid: "working", other: "idle" });
  await post("/api/sync");
});

test("without to and with no setting, a lane's question goes to the owner; askRoute lead sends the next one to the lead, and to owner still goes to the owner", async () => {
  const plain = await post("/api/asks", { lane: "kid", title: "Plain route" });
  expect(plain.holder).toBe(null);
  expect(await openAsk(plain.id)).toMatchObject({ holder: null, lead: null });
  await askRoute("lead");
  const led = await post("/api/asks", { lane: "kid", title: "Led route" });
  expect(led.holder).toBe("lead");
  const owned = await post("/api/asks", { lane: "kid", title: "Owner route", to: "owner" });
  expect(owned.holder).toBe(null);
  await askRoute(null);
  expect((await (await fetch(`${server.base}/api/settings`)).json()).settings.askRoute).toBeUndefined();
  for (const { id } of [plain, led, owned]) await withdraw(id);
});

test("secrets, actions, blocking urgent asks and a top-level lane always go to the owner, even when asked for the lead", async () => {
  const secret = await post("/api/asks", { lane: "kid", title: "Needs a key", to: "lead", secrets: ["API_KEY"] });
  const action = await post("/api/asks", { lane: "kid", title: "Deploy it", to: "lead", kind: "action" });
  const urgent = await post("/api/asks", { lane: "kid", title: "Right now", to: "lead", tier: "blocking", priority: "urgent" });
  const top = await post("/api/asks", { lane: "other", title: "From the top", to: "lead" });
  for (const { id, holder } of [secret, action, urgent, top]) {
    expect(holder).toBe(null);
    expect(await openAsk(id)).toMatchObject({ holder: null, lead: null });
    await withdraw(id);
  }
  const refused = async (body: Record<string, unknown>) => {
    const res = await send("/api/asks", { title: "Refused", ...body });
    return res.status;
  };
  expect(await refused({ to: "lead" })).toBe(400);
  expect(await refused({ lane: "kid", to: "boss" })).toBe(400);
});

test("a lane whose question a lead holds shows as with_lead, and its inbox item sits with the lead; the owner's own question makes it needs_you", async () => {
  agents({ hq: "idle", lead: "idle", kid: "idle", other: "idle" });
  await post("/api/sync");
  const { id, holder, escalateAt } = await post("/api/asks", { lane: "kid", title: "Held by the lead", to: "lead" });
  expect(holder).toBe("lead");
  expect(typeof escalateAt).toBe("number");
  await until(async () => (await openAsk(id))?.delivery === "sent");
  expect(await laneStatus("kid")).toBe("with_lead");
  expect((await state()).lanes.find((l: any) => l.name === "lead").holding).toBeGreaterThanOrEqual(1);
  expect(await openAsk(id)).toMatchObject({ holder: "lead", lead: "lead", delivery: "sent" });
  expect(typeof (await openAsk(id)).escalate_at).toBe("number");
  expect((await state()).inbox.find((i: any) => i.key === `ask:${id}`)).toMatchObject({ group: "leads", needsYou: false, holder: "lead", escalateAt: expect.any(Number) });
  const owned = await post("/api/asks", { lane: "kid", title: "The owner's", to: "owner" });
  expect(await laneStatus("kid")).toBe("needs_you");
  await withdraw(owned.id);
  await withdraw(id);
  agents({ hq: "idle", lead: "idle", kid: "working", other: "idle" });
  await post("/api/sync");
});

test("the lead escalates its question once: the owner holds it, its token is then old, and HQ's escalation changes nothing", async () => {
  const { id } = await post("/api/asks", { lane: "kid", title: "Money?", to: "lead" });
  await until(async () => (await openAsk(id))?.delivery === "sent");
  const token = await tokenOf(id);
  expect(await post(`/api/asks/${id}/escalate`, { token, reason: "money" })).toEqual({ id, escalated: true, holder: null });
  expect((await send(`/api/asks/${id}/escalate`, { token, reason: "money" })).status).toBe(403);
  expect(await post(`/api/asks/${id}/escalate`, { hq: true })).toEqual({ id, escalated: false, holder: null });
  expect(await openAsk(id)).toMatchObject({ holder: null, lead: "lead", escalated_by: "lead", escalate_reason: "money" });
  expect((await state()).inbox.find((i: any) => i.key === `ask:${id}`)).toMatchObject({ group: "open", needsYou: true, holder: null });
  await withdraw(id);
});

test("a lead's question keeps its holder and its time over a restart; one past its time goes to the owner when the server starts", async () => {
  const first = await post("/api/asks", { lane: "kid", title: "Survives a restart", to: "lead" });
  const second = await post("/api/asks", { lane: "kid", title: "Past its time at restart", to: "lead" });
  await until(async () => (await openAsk(first.id))?.delivery === "sent" && (await openAsk(second.id))?.delivery === "sent");
  const { escalate_at: escalateAt } = await openAsk(first.id);
  await server.stop();
  const db = new Database(join(data, "hud.db"));
  db.query("UPDATE ask_routes SET escalate_at = ? WHERE ask_id = ?").run(Date.now() - 1000, second.id);
  db.close();
  server = await spawnServer({ cwd: ROOT, env: env(data) });
  expect(await openAsk(first.id)).toMatchObject({ holder: "lead", escalate_at: escalateAt });
  await until(async () => (await openAsk(second.id))?.holder === null);
  expect(await openAsk(second.id)).toMatchObject({ holder: null, escalated_by: "timeout" });
  expect(await openAsk(first.id)).toMatchObject({ holder: "lead", escalate_at: escalateAt });
  await withdraw(first.id);
  await withdraw(second.id);
});

test("a database made before the lead columns opens: its asks read as the owner's, and the route table is added", async () => {
  const old = mkdtempSync(join(tmpdir(), "hq-lead-old-"));
  let oldServer: Awaited<ReturnType<typeof spawnServer>> | undefined;
  try {
    // The asks table as it was before holder, answered_by and the ask_routes table existed.
    const db = new Database(join(old, "hud.db"), { create: true });
    db.exec(`CREATE TABLE asks (
      id INTEGER PRIMARY KEY AUTOINCREMENT, lane TEXT, kind TEXT NOT NULL DEFAULT 'decision', title TEXT NOT NULL, body TEXT,
      options TEXT, recommended TEXT, link TEXT, due INTEGER, created_at INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'open',
      answer TEXT, answered_at INTEGER, acked_at INTEGER, secrets TEXT, tier TEXT NOT NULL DEFAULT 'nonblocking',
      priority INTEGER NOT NULL DEFAULT 2, tier_locked INTEGER NOT NULL DEFAULT 0, tier_by TEXT, tier_at INTEGER)`);
    const now = Date.now();
    db.query("INSERT INTO asks (lane, title, created_at) VALUES (?, ?, ?)").run("kid", "Open before", now - 60_000);
    db.query("INSERT INTO asks (lane, title, created_at, status, answer, answered_at) VALUES (?, ?, ?, 'answered', ?, ?)").run("kid", "Answered before", now - 120_000, "Yes", now - 30_000);
    db.close();
    oldServer = await spawnServer({ cwd: ROOT, env: env(old) });
    const s = await (await fetch(`${oldServer.base}/api/state`)).json();
    expect(s.open).toHaveLength(1);
    expect(s.open[0]).toMatchObject({ title: "Open before", holder: null, answered_by: null, lead: null });
    expect(s.answered.find((a: any) => a.title === "Answered before")).toMatchObject({ answer: "Yes", answered_by: null });
    await oldServer.stop();
    oldServer = undefined;
    const after = new Database(join(old, "hud.db"));
    try {
      const cols = (after.query("PRAGMA table_info(asks)").all() as { name: string }[]).map((c) => c.name);
      expect(cols).toEqual(expect.arrayContaining(["holder", "answered_by"]));
      expect(after.query("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'ask_routes'").get()).not.toBeNull();
    } finally {
      after.close();
    }
  } finally {
    await oldServer?.stop();
    rmSync(old, { recursive: true, force: true });
  }
});
