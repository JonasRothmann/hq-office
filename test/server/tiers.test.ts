// Question tiers (docs/spec-3d-office.md, B1 to B6 and B8): every ask is blocking or non-blocking with a priority; a
// lane's --blocking locks it there; the owner or HQ move unlocked ones; the owner's moves are told to HQ through the
// outbox. server.ts and hud.ts run end to end on a spare port with a throwaway data dir and a stub herdr that reads its
// agent list from a file and logs what is typed into HQ. A last server opens a database made by v0.10.1's schema.
import { Database } from "bun:sqlite";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnServer } from "../../scripts/room-hash.ts";

const ROOT = join(import.meta.dir, "..", "..");
const data = mkdtempSync(join(tmpdir(), "hq-tiers-test-"));
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
const prompts = () => (existsSync(log) ? readFileSync(log, "utf8").split("\n<<END>>\n").filter(Boolean) : []);

let server: Awaited<ReturnType<typeof spawnServer>>;
const env = (dir: string) => ({ ...process.env, HUD_HOST: "127.0.0.1", HUD_DATA_DIR: dir, HERDR_BIN: herdr, HUD_MACHINES: "local", HUD_LOCAL_MACHINE: "local", HUD_HQ_AGENT: "hq", HUD_HQ_HINT: "0", HUD_GH_BIN: "false" });
beforeAll(async () => {
  agents({ hq: "idle", busy: "working", resting: "idle" });
  server = await spawnServer({ cwd: ROOT, env: env(data) });
  for (const name of ["busy", "resting", "order"]) await post("/api/lanes", { name, machine: "local" });
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
const hud = async (...args: string[]) => {
  const p = Bun.spawn([process.execPath, join(ROOT, "hud.ts"), ...args], { env: { ...process.env, HUD_URL: server.base }, stdout: "pipe", stderr: "pipe" });
  const [out, err, code] = await Promise.all([new Response(p.stdout).text(), new Response(p.stderr).text(), p.exited]);
  if (code !== 0) throw new Error(`hud ${args.join(" ")}: ${err.trim()}`);
  return out;
};
const askId = (out: string) => Number(out.match(/ask #(\d+)/)![1]);
// What the server queued for HQ (the outbox), whether or not it was typed in yet.
const outbox = () => {
  const db = new Database(join(data, "hud.db"));
  try {
    return (db.query("SELECT text FROM hq_outbox ORDER BY id").all() as { text: string }[]).map((r) => r.text);
  } finally {
    db.close();
  }
};

test("an ask made without a tier is non-blocking, normal and unlocked, moved by nobody (B1)", async () => {
  const { id } = await post("/api/asks", { lane: "resting", title: "Plain question" });
  expect(await ask(id)).toMatchObject({ tier: "nonblocking", priority: 2, tier_locked: 0, tier_by: null, tier_at: null });
});

test("hud ask --blocking makes a locked blocking ask, and --priority sets its priority (B1, B2)", async () => {
  const id = askId(await hud("ask", "--blocking", "--lane", "busy", "--title", "Which schema?", "--priority", "high"));
  const a = await ask(id);
  expect(a).toMatchObject({ title: "Which schema?", lane: "busy", tier: "blocking", priority: 1, tier_locked: 1, tier_by: "lane" });
  expect(a.tier_at).toBeGreaterThan(0);
  // --nonblocking is the default spelled out; both at once is refused.
  expect((await ask(askId(await hud("ask", "--nonblocking", "--title", "Spelled out", "--priority", "low"))))).toMatchObject({ tier: "nonblocking", priority: 3, tier_locked: 0 });
  await expect(hud("ask", "--blocking", "--nonblocking", "--title", "Both")).rejects.toThrow(/not both/);
  await expect(hud("ask", "--title", "Odd", "--priority", "soon")).rejects.toThrow(/priority must be urgent, high, normal or low/);
});

test("the ledger's create route (hud ask --item) takes the same tier and priority", async () => {
  const id = askId(await hud("ask", "--lane", "busy", "--title", "Ship steps", "--item", "Tag it", "--blocking", "--priority", "urgent"));
  expect(await ask(id)).toMatchObject({ tier: "blocking", priority: 0, tier_locked: 1, tier_by: "lane" });
  expect((await state()).ledger[id].items.map((i: any) => i.text)).toEqual(["Tag it"]);
});

test("a locked ask cannot leave blocking: 409 with the reason, from the route and from hud tier; its priority still changes (B2)", async () => {
  const id = askId(await hud("ask", "--lane", "busy", "--title", "Locked one", "--blocking"));
  const before = outbox().length;
  for (const by of ["owner", "hq"]) {
    const res = await send(`/api/asks/${id}/tier`, { tier: "nonblocking", by });
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/locked as blocking.*cannot go on without the answer/);
  }
  await expect(hud("tier", String(id), "nonblocking")).rejects.toThrow(/locked as blocking/);
  expect(await ask(id)).toMatchObject({ tier: "blocking", tier_locked: 1, tier_by: "lane" });
  // Naming the tier it already has is not a change, and a priority on its own always goes through.
  expect((await hud("tier", String(id), "blocking", "--priority", "urgent")).trim()).toBe(`ask #${id}: blocking (locked), priority urgent`);
  expect(await ask(id)).toMatchObject({ tier: "blocking", priority: 0, tier_locked: 1, tier_by: "hq" });
  expect(outbox().length).toBe(before);
});

test("the owner moves an unlocked ask: recorded, logged, and told to HQ in one line (B3, B4)", async () => {
  const { id } = await post("/api/asks", { lane: "resting", title: "Pick a name" });
  const out = await post(`/api/asks/${id}/tier`, { tier: "blocking", priority: "high", by: "owner" });
  expect(out).toEqual({ id, tier: "blocking", priority: "high", locked: false });
  const a = await ask(id);
  expect(a).toMatchObject({ tier: "blocking", priority: 1, tier_locked: 0, tier_by: "owner" });
  expect(a.tier_at).toBeGreaterThan(0);
  const told = outbox().filter((t) => t.includes(`ask #${id}`));
  expect(told).toEqual([`HUD ask #${id} (resting): the owner set "Pick a name" to blocking, priority high (was nonblocking, normal)`]);
  for (let i = 0; i < 80 && !prompts().some((p) => p.includes(`ask #${id}`)); i++) await Bun.sleep(25);
  expect(prompts().some((p) => p.includes(`the owner set "Pick a name"`))).toBe(true);
  expect((await state()).events.some((e: any) => e.text === `moved ask #${id} to blocking, priority high: Pick a name`)).toBe(true);
  // A person put it there, so it stays movable: the owner can take it back.
  await post(`/api/asks/${id}/tier`, { tier: "nonblocking", by: "owner" });
  expect(await ask(id)).toMatchObject({ tier: "nonblocking", tier_locked: 0, tier_by: "owner" });
  expect(outbox().filter((t) => t.includes(`ask #${id}`)).length).toBe(2);
});

test("a move by HQ is recorded but not echoed back to HQ (B3, B4)", async () => {
  const { id } = await post("/api/asks", { lane: "resting", title: "HQ moves this" });
  const before = outbox().length;
  expect((await hud("tier", String(id), "blocking")).trim()).toBe(`ask #${id}: blocking, priority normal`);
  expect(await ask(id)).toMatchObject({ tier: "blocking", tier_locked: 0, tier_by: "hq" });
  expect((await hud("tier", String(id), "--priority", "low")).trim()).toBe(`ask #${id}: blocking, priority low`);
  await Bun.sleep(150);
  expect(outbox().length).toBe(before);
  expect(prompts().some((p) => p.includes(`ask #${id}`))).toBe(false);
  expect((await state()).events.some((e: any) => e.who === "hq" && e.text === `moved ask #${id} to blocking: HQ moves this`)).toBe(true);
});

test("the tier route checks what it is given", async () => {
  const { id } = await post("/api/asks", { lane: "resting", title: "Checked" });
  const err = async (body: unknown, path = `/api/asks/${id}/tier`) => {
    const res = await send(path, body);
    return [res.status, (await res.json()).error];
  };
  expect(await err({ tier: "later", by: "owner" })).toEqual([400, "tier must be blocking or nonblocking"]);
  expect(await err({ priority: "soon", by: "owner" })).toEqual([400, "priority must be urgent, high, normal or low"]);
  expect(await err({ tier: "blocking" })).toEqual([400, "by must be owner or hq"]);
  expect(await err({ tier: "blocking", by: "lane" })).toEqual([400, "by must be owner or hq"]);
  expect((await err({ by: "owner" }))[0]).toBe(400);
  expect(await err({ tier: "blocking", by: "owner" }, "/api/asks/999999/tier")).toEqual([400, "no ask 999999"]);
  await post(`/api/asks/${id}/answer`, { answer: "fine" });
  expect(await err({ tier: "blocking", by: "owner" })).toEqual([400, `ask ${id} is already answered`]);
  await expect(hud("tier", String(id))).rejects.toThrow(/usage: hud tier/);
  // Without the x-hud header a page on another origin cannot move anything.
  const res = await fetch(`${server.base}/api/asks/${id}/tier`, { method: "POST", body: "{}" });
  expect(res.status).toBe(403);
});

test("open asks are ordered blocking first, then priority, then due time, then oldest (B5)", async () => {
  // created_at is the server's clock (no caller sets it), so "old" is made first and "new" last, a moment apart.
  const make = async (title: string, over: Record<string, unknown>) => {
    await Bun.sleep(5);
    return (await post("/api/asks", { lane: "order", title, ...over })).id;
  };
  await make("nb normal old", {});
  await make("nb urgent", { priority: "urgent" });
  await make("b low old", { tier: "blocking", priority: "low" });
  await make("b normal late", { tier: "blocking" });
  await make("b normal due", { tier: "blocking", due: Date.now() + 7200_000 });
  await make("b high", { tier: "blocking", priority: 1 });
  await make("nb normal new", {});
  const order = (await state()).open.filter((a: any) => a.lane === "order").map((a: any) => a.title);
  expect(order).toEqual(["b high", "b normal due", "b normal late", "b low old", "nb urgent", "nb normal old", "nb normal new"]);
});

test("each lane counts its open blocking asks; a working lane stays moving, an idle one with an ask needs you (B6)", async () => {
  await post("/api/sync");
  const s = await state();
  const lane = (name: string) => s.lanes.find((l: any) => l.name === name);
  const blockingOf = (name: string) => s.open.filter((a: any) => a.lane === name && a.tier === "blocking").length;
  expect(lane("busy").blocking).toBeGreaterThan(0);
  expect(lane("busy").blocking).toBe(blockingOf("busy"));
  expect(lane("busy").status).toBe("moving");
  expect(lane("resting").blocking).toBe(blockingOf("resting"));
  expect(lane("resting").status).toBe("needs_you");
  expect(lane("order").blocking).toBe(4);
  expect(lane("order").asks).toBe(7);
});

// The page puts due and created_at in HTML attributes, so an agent's string there was an injection (review finding 1).
test("an ask's due is a time in ms or refused with 400; its created_at is always the server's clock", async () => {
  const evil = `1" autofocus tabindex="0" onfocus="document.title='pwned'" x="`;
  const refused = await send("/api/asks", { title: "evil due", due: evil });
  expect(refused.status).toBe(400);
  expect((await refused.json()).error).toMatch(/^due must be/);
  expect((await state()).open.some((a: any) => a.title === "evil due")).toBe(false);

  const before = Date.now();
  const a = await ask((await post("/api/asks", { title: "evil created_at", created_at: evil })).id);
  expect(typeof a.created_at).toBe("number");
  expect(a.created_at).toBeGreaterThanOrEqual(before);
  expect(a.created_at).toBeLessThanOrEqual(Date.now());
  // A number is ignored too: the age the page shows is the server's.
  expect((await ask((await post("/api/asks", { title: "backdated", created_at: 1000 })).id)).created_at).toBeGreaterThanOrEqual(before);

  // What hud sends (ms), and what a person might write: digits, HH:MM today in local time, a date or a date-time.
  const due = async (v: unknown) => (await ask((await post("/api/asks", { title: `due ${String(v)}`, due: v })).id)).due;
  expect(await due(1_800_000_000_000)).toBe(1_800_000_000_000);
  expect(await due("1800000000000")).toBe(1_800_000_000_000);
  // HH:MM is today in the server's local time; bun test runs this file in UTC, so only the shape is checked here.
  const [late, early] = [await due("17:30"), await due("9:05")];
  expect(late - early).toBe((8 * 60 + 25) * 60_000);
  expect(Math.abs(late - new Date().setUTCHours(17, 30, 0, 0))).toBeLessThanOrEqual(14 * 3600_000);
  expect(await due("2026-11-02")).toBe(Date.parse("2026-11-02"));
  expect(await due("2026-11-02T17:00Z")).toBe(Date.parse("2026-11-02T17:00Z"));
  expect(await due("2026-11-02T17:00:00+01:00")).toBe(Date.parse("2026-11-02T17:00:00+01:00"));
  expect(await due(undefined)).toBeNull();
  expect(await due("")).toBeNull();
  for (const bad of ["25:00", "12:60", "soon", "NaN", "Infinity", "-5", "x 1", "2026-13-45", -5, 0, { at: 1 }, [1], true]) {
    const r = await send("/api/asks", { title: "bad due", due: bad });
    expect([JSON.stringify(bad), r.status]).toEqual([JSON.stringify(bad), 400]);
  }
  expect((await state()).open.some((a: any) => a.title === "bad due")).toBe(false);
});

describe("a database made by v0.10.1", () => {
  const old = mkdtempSync(join(tmpdir(), "hq-tiers-old-"));
  let oldServer: Awaited<ReturnType<typeof spawnServer>>;
  beforeAll(async () => {
    // The asks table exactly as v0.10.1 left it: its asks.sql plus the secrets column db.ts added then.
    const db = new Database(join(old, "hud.db"), { create: true });
    db.exec(`CREATE TABLE asks (
      id INTEGER PRIMARY KEY AUTOINCREMENT, lane TEXT, kind TEXT NOT NULL DEFAULT 'decision', title TEXT NOT NULL, body TEXT,
      options TEXT, recommended TEXT, link TEXT, due INTEGER, created_at INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'open',
      answer TEXT, answered_at INTEGER, acked_at INTEGER, secrets TEXT)`);
    const now = Date.now();
    db.query("INSERT INTO asks (lane, title, created_at) VALUES (?, ?, ?)").run("old-lane", "Still open", now - 60_000);
    db.query("INSERT INTO asks (lane, title, created_at, status, answer, answered_at) VALUES (?, ?, ?, 'answered', ?, ?)").run("old-lane", "Settled", now - 120_000, "Go left", now - 30_000);
    db.close();
    oldServer = await spawnServer({ cwd: ROOT, env: env(old) });
  }, 30_000);
  afterAll(async () => {
    await oldServer?.stop();
    rmSync(old, { recursive: true, force: true });
  });

  test("opens, keeps every row and answer, and reads its asks as non-blocking, normal, unlocked (B8)", async () => {
    const s = await (await fetch(`${oldServer.base}/api/state`)).json();
    expect(s.open.map((a: any) => a.title)).toEqual(["Still open"]);
    expect(s.open[0]).toMatchObject({ tier: "nonblocking", priority: 2, tier_locked: 0, tier_by: null, tier_at: null });
    expect(s.answered.map((a: any) => [a.title, a.answer])).toEqual([["Settled", "Go left"]]);
    // And the moved-in columns work: the old ask can be moved like any other.
    const res = await fetch(`${oldServer.base}/api/asks/${s.open[0].id}/tier`, { method: "POST", headers: { "content-type": "application/json", "x-hud": "1" }, body: JSON.stringify({ tier: "blocking", by: "hq" }) });
    expect(res.status).toBe(200);
  });
});
