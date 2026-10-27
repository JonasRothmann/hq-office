// Go to the lead, through the hud CLI: an ask routed to the asking lane's lead, the lead's held list, and answering or
// escalating what it holds. hud.ts and the server run end to end on a spare port with a throwaway data dir and a stub
// herdr that reads its agent list from a file.
import { afterAll, beforeAll, expect, test } from "bun:test";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnServer } from "../../scripts/room-hash.ts";

const ROOT = join(import.meta.dir, "..", "..");
const data = mkdtempSync(join(tmpdir(), "hq-go-to-lead-test-"));
const herdr = join(data, "herdr");
const log = join(data, "prompts.log");
writeFileSync(
  herdr,
  `#!/bin/sh
case "$1 $2" in
  "agent list") cat "${data}/agents.json" ;;
  "agent prompt") printf '%s\\n<<END>>\\n' "$4" >> "${log}" ;;
esac
exit 0
`,
);
chmodSync(herdr, 0o755);
const agents = (list: Record<string, string>) =>
  writeFileSync(join(data, "agents.json"), JSON.stringify({ result: { agents: Object.entries(list).map(([name, agent_status], i) => ({ name, agent_status, pane_id: `p${i + 1}`, agent: "claude" })) } }));

let server: Awaited<ReturnType<typeof spawnServer>>;
const env = (dir: string) => ({ ...process.env, HUD_HOST: "127.0.0.1", HUD_DATA_DIR: dir, HERDR_BIN: herdr, HUD_MACHINES: "local", HUD_LOCAL_MACHINE: "local", HUD_HQ_AGENT: "hq", HUD_HQ_HINT: "0", HUD_GH_BIN: "false" });
beforeAll(async () => {
  agents({ hq: "idle", lead1: "idle", kid: "working" });
  server = await spawnServer({ cwd: ROOT, env: env(data) });
  await post("/api/lanes", { name: "lead1", machine: "local" });
  await post("/api/lanes", { name: "kid", machine: "local", parent: "lead1" });
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
const ask = async (id: number) => (await state()).open.find((a: any) => a.id === id);
const askId = (out: string) => Number(out.match(/ask #(\d+)/)![1]);
// hud as a subprocess: hud throws on a non-zero exit, hudRun hands back what it printed and how it ended.
const hudRun = async (...args: string[]) => {
  const p = Bun.spawn([process.execPath, join(ROOT, "hud.ts"), ...args], { env: { ...process.env, HUD_URL: server.base }, stdout: "pipe", stderr: "pipe" });
  const [out, err, code] = await Promise.all([new Response(p.stdout).text(), new Response(p.stderr).text(), p.exited]);
  return { out, err, code };
};
const hud = async (...args: string[]) => {
  const r = await hudRun(...args);
  if (r.code !== 0) throw new Error(`hud ${args.join(" ")}: ${r.err.trim()}`);
  return r.out;
};

test("hud ask --to lead routes the question to the asking lane's lead; hud held lists it with its footer and JSON", async () => {
  const out = await hud("ask", "--lane", "kid", "--title", "Which font?", "--to", "lead");
  const id = askId(out);
  expect(out).toContain(`ask #${id} with lead1 (its lead) until`);
  const held = await hud("held", "--as", "lead1");
  expect(held).toContain(`#${id} from kid · nonblocking, normal · to the owner at `);
  expect(held).toContain(": Which font?");
  expect(held).toContain(`answer: hud answer ID "<answer>" --as lead1 · not yours to decide: hud escalate ID --as lead1 --reason "<why>"`);
  const json = JSON.parse(await hud("held", "--as", "lead1", "--json"));
  expect(json.asks[0].id).toBe(id);
});

test("hud answer by the holding lead answers the question, recorded as the lead's", async () => {
  const id = askId(await hud("ask", "--lane", "kid", "--title", "Ship it?", "--to", "lead"));
  expect(await hud("answer", String(id), "yes", "please", "--as", "lead1")).toContain(`ask #${id} answered as lead1`);
  expect((await state()).answered.find((a: any) => a.id === id)).toMatchObject({ answer: "yes please", answered_by: "lead1" });
});

test("hud answer by a lane that does not hold the question is refused with the server's message; it stays with the lead", async () => {
  const id = askId(await hud("ask", "--lane", "kid", "--title", "Who answers?", "--to", "lead"));
  const r = await hudRun("answer", String(id), "me", "--as", "kid");
  expect(r.code).not.toBe(0);
  expect(r.err.trim()).not.toBe("");
  expect(await ask(id)).toMatchObject({ holder: "lead1" });
});

test("hud escalate passes the question to the owner once; a second escalate says it is already there", async () => {
  const id = askId(await hud("ask", "--lane", "kid", "--title", "Not mine", "--to", "lead"));
  expect(await hud("escalate", String(id), "--as", "lead1", "--reason", "not mine")).toContain(`ask #${id} escalated to the owner`);
  expect(await hud("escalate", String(id), "--as", "lead1", "--reason", "not mine")).toContain(`ask #${id} is already with the owner`);
  expect((await ask(id)).holder).toBeNull();
});

test("usage errors exit 2: answering with no --as, and answering as the owner", async () => {
  expect((await hudRun("answer", "5", "hi")).code).toBe(2);
  const owner = await hudRun("answer", "5", "hi", "--as", "owner");
  expect(owner.code).toBe(2);
  expect(owner.err).toContain("the owner answers on the page; hud answer is for a lead");
});
