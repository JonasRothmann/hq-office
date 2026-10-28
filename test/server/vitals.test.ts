// Lane vitals: model, effort, context and running subagents read from a Claude Code lane's transcript (located from
// herdr's agent_session and working directory), or reported by the lane, in /api/state as S.vitals. A stub herdr lists
// the agents; a throwaway Claude directory (HUD_CLAUDE_DIR) holds the transcripts and settings.
import { afterAll, beforeAll, expect, test } from "bun:test";
import { appendFileSync, chmodSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnServer } from "../../scripts/room-hash.ts";

const ROOT = join(import.meta.dir, "..", "..");
const data = mkdtempSync(join(tmpdir(), "hq-vitals-test-"));
const claude = join(data, "claude");
const SECRET = "TRANSCRIPT-WORDS-THAT-MUST-NOT-LEAK";

// A lane's working directory (with a dot, as worktrees under .claude have) and its Claude Code project folder.
const cwdOf = (lane: string) => join(data, "work", `${lane}.repo`);
const folderOf = (cwd: string) => join(claude, "projects", cwd.replace(/[^a-zA-Z0-9]/g, "-"));
const SESSIONS: Record<string, string> = { alpha: "11111111-aaaa-4bbb-8ccc-000000000001", bravo: "11111111-aaaa-4bbb-8ccc-000000000002", huge: "11111111-aaaa-4bbb-8ccc-000000000003" };
const transcriptOf = (lane: string) => join(folderOf(cwdOf(lane)), `${SESSIONS[lane]}.jsonl`);
const subagentsOf = (lane: string) => join(folderOf(cwdOf(lane)), SESSIONS[lane], "subagents");

const user = (text: string) => JSON.stringify({ type: "user", message: { role: "user", content: text } });
const assistant = (model: string, usage: { input: number; creation: number; read: number }, effort?: string) =>
  JSON.stringify({
    type: "assistant",
    ...(effort ? { effort } : {}),
    message: { model, role: "assistant", content: [{ type: "text", text: SECRET }], usage: { input_tokens: usage.input, cache_creation_input_tokens: usage.creation, cache_read_input_tokens: usage.read, output_tokens: 99 } },
  });
const lines = (...l: string[]) => l.join("\n") + "\n";
const ago = (path: string, ms: number) => utimesSync(path, (Date.now() - ms) / 1000, (Date.now() - ms) / 1000);

function subagent(lane: string, id: string, meta: object, transcript: string, quietMs = 0) {
  const dir = subagentsOf(lane);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `agent-${id}.meta.json`), JSON.stringify(meta));
  writeFileSync(join(dir, `agent-${id}.jsonl`), transcript);
  if (quietMs) ago(join(dir, `agent-${id}.jsonl`), quietMs);
}

const herdr = join(data, "herdr");
writeFileSync(herdr, `#!/bin/sh
case "$*" in
  *"agent list"*) cat "${data}/agents.json" ;;
esac
exit 0
`);
chmodSync(herdr, 0o755);
const claudeAgent = (name: string, pane: string) => ({
  name,
  agent: "claude",
  agent_status: "working",
  pane_id: pane,
  agent_session: { agent: "claude", kind: "id", source: "herdr:claude", value: SESSIONS[name] },
  cwd: cwdOf(name),
  foreground_cwd: cwdOf(name),
});
writeFileSync(
  join(data, "agents.json"),
  JSON.stringify({ result: { agents: [claudeAgent("alpha", "p1"), claudeAgent("bravo", "p2"), claudeAgent("huge", "p3"), { name: "charlie", agent: "codex", agent_status: "working", pane_id: "p4", cwd: cwdOf("charlie"), foreground_cwd: cwdOf("charlie") }] } }),
);

let server: Awaited<ReturnType<typeof spawnServer>>;
let said = "";
const post = (path: string, body: unknown) =>
  fetch(`${server.base}${path}`, { method: "POST", headers: { "content-type": "application/json", "x-hud": "1" }, body: JSON.stringify(body) }).then(async (r) => ({ status: r.status, ...(await r.json()) }));
const stateText = async () => (await fetch(`${server.base}/api/state`)).text();
const vitals = async () => JSON.parse(await stateText()).vitals;

beforeAll(async () => {
  for (const lane of ["alpha", "bravo", "huge"]) mkdirSync(folderOf(cwdOf(lane)), { recursive: true });
  mkdirSync(join(cwdOf("bravo"), ".claude"), { recursive: true });
  writeFileSync(
    transcriptOf("alpha"),
    lines(user(SECRET), assistant("claude-sonnet-5-5", { input: 1, creation: 1, read: 1 }, "medium"), user(SECRET), assistant("claude-opus-5-5", { input: 3, creation: 1000, read: 120_000 }, "high"), user(`tool result ${SECRET}`)),
  );
  subagent("alpha", "r1", { agentType: "general-purpose", description: "Running on sonnet", model: "sonnet" }, lines(user(SECRET), assistant("claude-sonnet-5-5", { input: 1, creation: 1, read: 1 })));
  subagent("alpha", "h1", { agentType: "Explore", description: "Just started", model: "haiku" }, lines(user(SECRET)));
  subagent("alpha", "f1", { agentType: "Explore", description: "Finished", model: "haiku", finished: true }, lines(user(SECRET), assistant("claude-haiku-5-5", { input: 1, creation: 1, read: 1 })));
  subagent("alpha", "q1", { agentType: "Explore", description: "Killed long ago", model: "opus" }, lines(user(SECRET)), 20 * 60_000);
  writeFileSync(transcriptOf("bravo"), lines(user(SECRET), assistant("claude-test-1", { input: 10, creation: 20, read: 30 })));
  writeFileSync(join(cwdOf("bravo"), ".claude", "settings.local.json"), JSON.stringify({ effortLevel: "low" }));
  writeFileSync(join(cwdOf("bravo"), ".claude", "settings.json"), JSON.stringify({ effortLevel: "medium" }));
  writeFileSync(join(claude, "settings.json"), JSON.stringify({ effortLevel: "xhigh" }));
  // An assistant message at the head, then 2 MB without one: a whole-file read would find it, a tail read does not.
  writeFileSync(transcriptOf("huge"), lines(assistant("claude-opus-5-5", { input: 1, creation: 1, read: 999 }, "max")) + lines(...Array.from({ length: 2000 }, () => user("x".repeat(1000)))));

  server = await spawnServer({
    cwd: ROOT,
    env: { ...process.env, HUD_HOST: "127.0.0.1", HUD_DATA_DIR: data, HERDR_BIN: herdr, HUD_CLAUDE_DIR: claude, HUD_MACHINES: "local", HUD_LOCAL_MACHINE: "local", HUD_HQ_AGENT: "hq", HUD_GH_BIN: "false" },
    out: (chunk) => (said += new TextDecoder().decode(chunk)),
  });
  for (const name of ["alpha", "bravo", "huge", "charlie"]) await post("/api/lanes", { name, machine: "local" });
  await post("/api/sync", {});
}, 30_000);
afterAll(async () => {
  await server?.stop();
  rmSync(data, { recursive: true, force: true });
});

test("model, effort and context come from the transcript's last assistant message", async () => {
  const { alpha, bravo } = await vitals();
  expect(alpha).toMatchObject({ model: "claude-opus-5-5", family: "opus", effort: "high", contextUsed: 121_003, contextMax: 1_000_000, source: "transcript" });
  expect(alpha.at).toBeGreaterThan(0);
  // A model the window table does not know gets the default window.
  expect(bravo).toMatchObject({ model: "claude-test-1", family: "other", contextUsed: 60, contextMax: 200_000 });
});

test("subagents: running ones count, finished and long-quiet ones do not; the model is the one each runs", async () => {
  const { alpha } = await vitals();
  expect(alpha.subagents).toEqual([
    { id: "h1", model: "haiku", family: "haiku", description: "Just started" },
    { id: "r1", model: "claude-sonnet-5-5", family: "sonnet", description: "Running on sonnet" },
  ]);
  writeFileSync(join(subagentsOf("alpha"), "agent-r1.meta.json"), JSON.stringify({ agentType: "general-purpose", description: "Running on sonnet", model: "sonnet", finished: true }));
  expect((await vitals()).alpha.subagents.map((s: { id: string }) => s.id)).toEqual(["h1"]);
});

test("effort without one in the transcript: settings.local.json, then settings.json, then the user's settings, else null", async () => {
  expect((await vitals()).bravo.effort).toBe("low");
  rmSync(join(cwdOf("bravo"), ".claude", "settings.local.json"));
  expect((await vitals()).bravo.effort).toBe("medium");
  rmSync(join(cwdOf("bravo"), ".claude", "settings.json"));
  expect((await vitals()).bravo.effort).toBe("xhigh");
  rmSync(join(claude, "settings.json"));
  expect((await vitals()).bravo.effort).toBeNull();
});

test("a huge transcript is read at its tail only", async () => {
  const { huge } = await vitals();
  expect(huge).toMatchObject({ model: null, contextUsed: null, source: "transcript" });
  expect(huge.effort).not.toBe("max");
});

test("a report wins until the transcript changes after it", async () => {
  const r = await post("/api/lanes/alpha/vitals", { model: "claude-haiku-5-5", effort: "low", subagents: 3, contextUsed: 5000, contextMax: 200_000 });
  expect(r.status).toBe(200);
  let { alpha } = await vitals();
  expect(alpha).toMatchObject({ model: "claude-haiku-5-5", family: "haiku", effort: "low", contextUsed: 5000, contextMax: 200_000, source: "report" });
  expect(alpha.subagents).toHaveLength(3);

  appendFileSync(transcriptOf("alpha"), lines(assistant("claude-opus-5-5", { input: 5, creation: 5, read: 150_000 }, "xhigh")));
  utimesSync(transcriptOf("alpha"), (Date.now() + 5000) / 1000, (Date.now() + 5000) / 1000);
  ({ alpha } = await vitals());
  expect(alpha).toMatchObject({ model: "claude-opus-5-5", family: "opus", effort: "xhigh", contextUsed: 150_010, contextMax: 1_000_000, source: "transcript" });
  expect(alpha.subagents.map((s: { id: string }) => s.id)).toEqual(["h1"]);
});

test("a report that says only some fields mixes with the transcript; a lane without a transcript is all report", async () => {
  await post("/api/lanes/bravo/vitals", { effort: "high" });
  expect((await vitals()).bravo).toMatchObject({ model: "claude-test-1", effort: "high", contextUsed: 60, source: "mixed" });
  await post("/api/lanes/charlie/vitals", { model: "gpt-5-codex", contextUsed: 1000 });
  await post("/api/lanes/charlie/vitals", { subagents: 2 });
  const { charlie } = await vitals();
  expect(charlie).toMatchObject({ model: "gpt-5-codex", family: "other", effort: null, contextUsed: 1000, contextMax: 200_000, source: "report" });
  expect(charlie.subagents).toHaveLength(2);
});

test("a report is checked at the boundary", async () => {
  for (const [path, body] of [
    ["/api/lanes/nobody/vitals", { model: "claude-opus-5-5" }],
    ["/api/lanes/alpha/vitals", {}],
    ["/api/lanes/alpha/vitals", { model: "two words" }],
    ["/api/lanes/alpha/vitals", { effort: "very high" }],
    ["/api/lanes/alpha/vitals", { subagents: -1 }],
    ["/api/lanes/alpha/vitals", { subagents: 1.5 }],
    ["/api/lanes/alpha/vitals", { contextUsed: "5000" }],
    ["/api/lanes/alpha/vitals", { contextUsed: 300, contextMax: 200 }],
  ] as const) {
    const r = await post(path, body);
    expect(r.status).toBe(400);
    expect(typeof r.error).toBe("string");
  }
});

test("no transcript text reaches the state, the database or the log", async () => {
  expect(await stateText()).not.toContain(SECRET);
  for (const f of readdirSync(data).filter((f) => f.startsWith("hud.db"))) expect(readFileSync(join(data, f), "latin1")).not.toContain(SECRET);
  expect(said).not.toContain(SECRET);
});
