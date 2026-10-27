// The owner's inbox (S.inbox): one item per open question, update and room, in the HUD's order (blocking, open,
// updates, rooms); which ones need the owner; which questions are short enough for the stack; what a body holds; and
// links as cards built from what the server knows (a shelf's title, a room's name), never fetched. A server on a spare
// port with a throwaway data dir.
import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnServer } from "../../scripts/room-hash.ts";

const ROOT = join(import.meta.dir, "..", "..");
const DATA = mkdtempSync(join(tmpdir(), "hq-owner-inbox-test-"));
let server: Awaited<ReturnType<typeof spawnServer>>;

beforeAll(async () => {
  server = await spawnServer({
    cwd: ROOT,
    env: { ...process.env, HUD_HOST: "127.0.0.1", HUD_DATA_DIR: DATA, HERDR_BIN: join(DATA, "no-such-herdr"), HUD_MACHINES: "local", HUD_LOCAL_MACHINE: "local" },
  });
});

afterAll(async () => {
  await server?.stop();
  rmSync(DATA, { recursive: true, force: true });
});

const post = async (path: string, body: unknown) => (await fetch(`${server.base}${path}`, { method: "POST", headers: { "content-type": "application/json", "x-hud": "1" }, body: JSON.stringify(body) })).json();
const state = async () => (await fetch(`${server.base}/api/state`)).json();

const LONG = `I compared the two export paths on the staging copy.

## Options
- **Postgres COPY**: 38 s, needs a new role.
- **SQLite file**: 130 s, no new role.

| | COPY | SQLite |
|---|---|---|
| Time | 38 s | 130 s |

\`\`\`sql
COPY nightly TO STDOUT;
\`\`\`

The benchmark is at https://claude.ai/artifact/bench-1 and the room is [here](/#room/nightly).`;

test("one item per question, update and room, in the HUD's order, with the full records left where they were", async () => {
  await post("/api/lanes", { name: "cedar", machine: "local" });
  await post("/api/rooms", { slug: "nightly", title: "Nightly export", owner: "cedar" });
  await post("/api/rooms/nightly/artifacts", { title: "Export benchmark", url: "https://claude.ai/artifact/bench-1", as: "cedar" });
  await post("/api/rooms/nightly/say", { text: "Benchmark is on the shelf." });
  const short = await post("/api/asks", { lane: "birch", kind: "decision", title: "Ship the migration tonight?", options: ["Yes", "Wait"], recommended: "Yes" });
  const long = await post("/api/asks", { lane: "cedar", kind: "decision", tier: "blocking", priority: "high", title: "Which export path?", body: LONG, options: ["COPY", "SQLite"] });
  const secret = await post("/api/asks", { lane: "dune", kind: "action", title: "Paste the key", secrets: ["API_KEY"] });
  const done = await post("/api/asks", { lane: "elm", kind: "action", title: "Approve the deploy" });
  const upd = await post("/api/updates", { lane: "fjord", title: "Auth refactor halfway", body: "**2 tests flaky**. Plan: https://example.com/plan" });
  const s = await state();
  const keys = s.inbox.map((i: any) => i.key);
  expect(keys).toEqual([`ask:${long.id}`, `ask:${short.id}`, `ask:${secret.id}`, `ask:${done.id}`, `update:${upd.id}`, "room:nightly"]);
  expect(s.inbox.map((i: any) => i.group)).toEqual(["blocking", "open", "open", "open", "updates", "rooms"]);
  // The stack answers a pick or a button; a long body, secrets or a free answer go to the reader.
  expect(s.inbox.filter((i: any) => i.kind === "question").map((i: any) => [i.title, i.short])).toEqual([
    ["Which export path?", false], ["Ship the migration tonight?", true], ["Paste the key", false], ["Approve the deploy", true],
  ]);
  const q = s.inbox[0];
  expect(q).toMatchObject({ kind: "question", ref: long.id, lane: "cedar", needsYou: true, priority: 1, locked: true });
  expect(q.shape).toEqual({ lines: LONG.split("\n").length, tables: 1, code: 1 });
  expect(q.preview).toBe("I compared the two export paths on the staging copy. Options Postgres COPY: 38 s, needs a new role. SQLite file: 130 s, no new role. The…");
  // The artifact has its shelf's title and room; the room link names the room. Nothing was fetched.
  expect(q.links).toEqual([
    { url: "https://claude.ai/artifact/bench-1", kind: "claude-artifact", title: "Export benchmark", host: "claude.ai", shelf: { slug: "nightly", title: "Nightly export" }, by: "cedar", at: expect.any(Number) },
    { url: "#room/nightly", kind: "room", title: "Nightly export", host: "", shelf: null, by: null, at: null },
  ]);
  // The full records are where they were.
  expect(s.open.map((a: any) => a.id)).toEqual([long.id, short.id, secret.id, done.id]);
  const u = s.inbox.find((i: any) => i.kind === "update");
  expect(u).toMatchObject({ needsYou: true, unread: true, preview: "2 tests flaky. Plan: https://example.com/plan" });
  expect(u.links.map((l: any) => [l.kind, l.title])).toEqual([["link", "example.com/plan"]]);
  expect(s.inbox.find((i: any) => i.kind === "room")).toMatchObject({ lane: "cedar", needsYou: true, preview: "cedar: Benchmark is on the shelf." });
  // The same list without the page.
  expect((await (await fetch(`${server.base}/api/owner-inbox`)).json()).map((i: any) => i.key)).toEqual(keys);
});

test("reading an update and seeing a room take them out of Needs you; an answered question leaves", async () => {
  const s0 = await state();
  const u = s0.inbox.find((i: any) => i.kind === "update");
  await post(`/api/updates/${u.ref}/read`, {});
  await post("/api/rooms/nightly/seen", {});
  const first = s0.inbox[0];
  await post(`/api/asks/${first.ref}/answer`, { answer: "COPY" });
  const s = await state();
  expect(s.inbox.find((i: any) => i.key === u.key)).toMatchObject({ needsYou: false, unread: false });
  expect(s.inbox.find((i: any) => i.key === "room:nightly")).toMatchObject({ needsYou: false, unread: false });
  expect(s.inbox.some((i: any) => i.key === first.key)).toBe(false);
});

test("previews leave out code and markup; only this HUD's files and real addresses are cards", async () => {
  const a = await post("/api/updates", { title: "Code first", body: "```\nbun test\n```\nAfter the code." });
  const b = await post("/api/updates", { title: "Markup", body: "A [link](https://a.example/x) and `code` and [image: /tmp/x.png]" });
  const c = await post("/api/updates", { title: "Paths", body: "See /etc/passwd and https://example.com/a. Also http://127.0.0.1:9/#room/gone" });
  const empty = await post("/api/updates", { title: "No body" });
  const item = async (id: number) => (await state()).inbox.find((i: any) => i.key === `update:${id}`);
  expect((await item(a.id)).preview).toBe("After the code.");
  expect((await item(a.id)).shape).toEqual({ lines: 4, tables: 0, code: 1 });
  expect((await item(b.id)).preview).toBe("A link and code and [image]");
  expect((await item(empty.id))).toMatchObject({ preview: "", shape: { lines: 0, tables: 0, code: 0 }, links: [] });
  // A local path that is not a file of this HUD is not a card, a full stop is not part of a URL, an unknown room is a link.
  expect((await item(c.id)).links.map((l: any) => [l.url, l.kind])).toEqual([["https://example.com/a", "link"], ["http://127.0.0.1:9/#room/gone", "link"]]);
});
