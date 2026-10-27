// `hud lane NAME --model --effort --subagents --context USED[/MAX]` reports a lane's vitals, and S.vitals shows them.
// server.ts and hud.ts run end to end on a spare port with a throwaway data dir, an empty Claude directory (so no real
// transcript is read) and a stub herdr that knows no agents.
import { afterAll, beforeAll, expect, test } from "bun:test";
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnServer } from "../../scripts/room-hash.ts";

const ROOT = join(import.meta.dir, "..", "..");
const data = mkdtempSync(join(tmpdir(), "hq-hud-vitals-test-"));
const herdr = join(data, "herdr");
writeFileSync(herdr, `#!/bin/sh\ncase "$*" in\n  *"agent list"*) echo '{"result":{"agents":[]}}' ;;\nesac\nexit 0\n`);
chmodSync(herdr, 0o755);
mkdirSync(join(data, "claude"));

let server: Awaited<ReturnType<typeof spawnServer>>;
beforeAll(async () => {
  server = await spawnServer({
    cwd: ROOT,
    env: { ...process.env, HUD_HOST: "127.0.0.1", HUD_DATA_DIR: data, HERDR_BIN: herdr, HUD_CLAUDE_DIR: join(data, "claude"), HUD_MACHINES: "local", HUD_LOCAL_MACHINE: "local", HUD_HQ_AGENT: "hq", HUD_HQ_HINT: "0", HUD_GH_BIN: "false" },
  });
}, 30_000);
afterAll(async () => {
  await server?.stop();
  rmSync(data, { recursive: true, force: true });
});

const state = async () => (await fetch(`${server.base}/api/state`)).json();
const hud = async (...args: string[]) => {
  const p = Bun.spawn([process.execPath, join(ROOT, "hud.ts"), ...args], { env: { ...process.env, HUD_URL: server.base }, stdout: "pipe", stderr: "pipe" });
  const [out, err, code] = await Promise.all([new Response(p.stdout).text(), new Response(p.stderr).text(), p.exited]);
  return { out, err, code };
};

test("every vitals flag reaches S.vitals, with 412k and 1M read as numbers", async () => {
  const r = await hud("lane", "oak", "--title", "Ship the export", "--model", "claude-opus-5-5", "--effort", "high", "--subagents", "3", "--context", "412k/1M");
  expect(r.code).toBe(0);
  expect(r.out).toContain("lane oak");
  const S = await state();
  expect(S.vitals.oak).toMatchObject({ model: "claude-opus-5-5", family: "opus", effort: "high", contextUsed: 412_000, contextMax: 1_000_000, source: "report" });
  expect(S.vitals.oak.subagents).toHaveLength(3);
  // the lane's own flags still apply alongside
  expect(S.lanes.find((l: any) => l.name === "oak").title).toBe("Ship the export");
});

test("a later report changes only the flags it gives; USED alone keeps the max", async () => {
  expect((await hud("lane", "oak", "--context", "1.5k", "--subagents", "0")).code).toBe(0);
  expect((await state()).vitals.oak).toMatchObject({ model: "claude-opus-5-5", effort: "high", contextUsed: 1500, contextMax: 1_000_000, subagents: [] });
  expect((await hud("lane", "oak", "--context", "84000/200K")).code).toBe(0);
  expect((await state()).vitals.oak).toMatchObject({ contextUsed: 84_000, contextMax: 200_000 });
});

test("hud lane without a vitals flag sends no vitals", async () => {
  expect((await hud("lane", "pine", "--title", "No vitals here")).code).toBe(0);
  const S = await state();
  expect(S.lanes.some((l: any) => l.name === "pine")).toBe(true);
  expect(S.vitals.pine).toBeUndefined();
});

test("a bad value is refused before anything is sent", async () => {
  for (const args of [["--context", "lots"], ["--context", "1k/2k/3k"], ["--subagents", "two"], ["--subagents", "-1"], ["--model"]]) {
    const r = await hud("lane", "elm", ...args);
    expect({ args, code: r.code }).toEqual({ args, code: 2 });
    expect(r.err.length).toBeGreaterThan(0);
  }
  // nothing reached the server: not even the lane
  expect((await state()).lanes.some((l: any) => l.name === "elm")).toBe(false);
});

test("the server's own checks still answer through hud: more context in use than the window", async () => {
  const r = await hud("lane", "oak", "--context", "2M/1M");
  expect(r.code).toBe(1);
  expect(r.err).toContain("contextUsed is more than contextMax");
});
