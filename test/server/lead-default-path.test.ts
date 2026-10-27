// With go to the lead off (no askRoute, no --to), the server behaves as before: the same script, run on this tree on its own
// spare port and throwaway data dir with a stub herdr, must give the recorded output in fixtures/default-path.json. It checks
// what is stored, what HQ is told, what is typed into whom, and what the page's state says.
import { Database } from "bun:sqlite";
import { expect, test } from "bun:test";
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnServer } from "../../scripts/room-hash.ts";

const ROOT = join(import.meta.dir, "..", "..");

async function run() {
  const data = mkdtempSync(join(tmpdir(), "lead-default-path-"));
  const herdr = join(data, "herdr");
  const log = join(data, "prompts.log");
  writeFileSync(herdr, `#!/bin/sh\ncase "$1 $2" in\n  "agent list") cat "${data}/agents.json" ;;\n  "agent prompt") printf '%s\\n%s\\n<<END>>\\n' "$3" "$4" >> "${log}" ;;\nesac\nexit 0\n`);
  chmodSync(herdr, 0o755);
  const agents = (list: Record<string, string>) =>
    writeFileSync(join(data, "agents.json"), JSON.stringify({ result: { agents: Object.entries(list).map(([name, agent_status], i) => ({ name, agent_status, pane_id: `p${i + 1}`, agent: "claude" })) } }));
  agents({ hq: "idle", lead: "idle", kid: "idle" });
  const env = { ...process.env, HUD_HOST: "127.0.0.1", HUD_DATA_DIR: data, HERDR_BIN: herdr, HUD_MACHINES: "local", HUD_LOCAL_MACHINE: "local", HUD_HQ_AGENT: "hq", HUD_HQ_HINT: "0", HUD_GH_BIN: "false" };
  const server = await spawnServer({ cwd: ROOT, env });
  const send = (path: string, body: unknown) => fetch(`${server.base}${path}`, { method: "POST", headers: { "content-type": "application/json", "x-hud": "1" }, body: JSON.stringify(body) });
  const out: any = { replies: [] };
  const step = async (path: string, body: unknown) => {
    const r = await send(path, body);
    const j = await r.json();
    out.replies.push([path, r.status, j.id !== undefined ? { id: j.id } : j]);
  };
  try {
    await step("/api/lanes", { name: "lead", machine: "local" });
    await step("/api/lanes", { name: "kid", machine: "local", parent: "lead" });
    await step("/api/sync", {});
    await step("/api/asks", { lane: "kid", title: "A plain one", body: "b", options: ["x", "y"], recommended: "x" });
    await step("/api/asks", { lane: "kid", title: "B blocking", tier: "blocking", priority: "high" });
    await step("/api/asks", { title: "C no lane" });
    await step("/api/ledger/asks", { lane: "kid", title: "D with items", items: ["one", "two"] });
    await step("/api/asks", { lane: "kid", title: "E secret", secrets: ["API_KEY"] });
    const s1 = await (await fetch(`${server.base}/api/state`)).json();
    out.statusBefore = s1.lanes.map((l: any) => [l.name, l.status, l.asks, l.blocking]);
    out.openOrder = s1.open.map((a: any) => a.title);
    out.inboxBefore = (s1.inbox ?? []).filter((i: any) => i.kind === "question").map((i: any) => [i.key, i.group, i.needsYou]);
    await step("/api/asks/1/answer", { answer: "x" });
    await step("/api/asks/2/answer", {});
    await step("/api/asks/2/answer", { answer: "again" });
    await step("/api/asks/99/answer", { answer: "none" });
    await step("/api/asks/3/withdraw", {});
    await step("/api/sync", {});
    await Bun.sleep(1500);
    await step("/api/sync", {});
    await Bun.sleep(1500);
    const s2 = await (await fetch(`${server.base}/api/state`)).json();
    out.statusAfter = s2.lanes.map((l: any) => [l.name, l.status, l.asks, l.blocking]);
    out.answered = s2.answered.map((a: any) => [a.id, a.title, a.status, a.answer]);
  } finally {
    await server.stop();
  }
  // Volatile values (times, delivery counters) are left out here; ask ids are sequential, so they stay.
  const db = new Database(join(data, "hud.db"), { readonly: true });
  out.asks = db.query("SELECT id, lane, kind, title, body, options, recommended, status, answer, tier, priority, tier_locked, secrets, acked_at IS NOT NULL AS acked FROM asks ORDER BY id").all();
  out.events = (db.query("SELECT * FROM events ORDER BY id").all() as any[]).map((e) => [e.who, e.text, e.lane]);
  out.outbox = (db.query("SELECT * FROM hq_outbox ORDER BY id").all() as any[]).map((r) => { const { id, at, created_at, sent_at, tries, last_try, ...rest } = r; return rest; });
  db.close();
  out.prompts = existsSync(log) ? readFileSync(log, "utf8").split("\n<<END>>\n").filter(Boolean) : [];
  rmSync(data, { recursive: true, force: true });
  return out;
}

test("default path: with go to the lead off, the server stores, tells HQ and types exactly as before", async () => {
  const expected = JSON.parse(readFileSync(join(import.meta.dir, "fixtures", "default-path.json"), "utf8"));
  const got = await run();
  expect(Object.keys(got).sort()).toEqual(Object.keys(expected).sort());
  for (const k of Object.keys(expected)) expect([k, got[k]]).toEqual([k, expected[k]]);
}, 120_000);
