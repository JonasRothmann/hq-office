// Uploads and threads, against a server on a spare port with a throwaway data dir and a stub herdr that lists the
// agents in agents.json and records every prompt. Uploads: any kept type up to 25 MB, refused by size and by type
// (the bytes must match it), served back on a URL of this server, and no path on this machine's disk in the reply.
// Threads: a reply on a question or an update goes the rooms' way (sent, away, retried), a lane answers with hud room
// say, and an answered question reopens. No real lane is ever prompted.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { chmodSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnServer } from "../../scripts/room-hash.ts";

const ROOT = join(import.meta.dir, "..", "..");
const DATA = mkdtempSync(join(tmpdir(), "hq-threads-test-"));
const LOG = join(DATA, "prompts.log");
const AGENTS = join(DATA, "agents.json");
let server: Awaited<ReturnType<typeof spawnServer>>;
let BASE = "";

const agents = (names: string[]) => writeFileSync(AGENTS, JSON.stringify({ result: { agents: names.map((name, i) => ({ name, agent_status: "idle", pane_id: `p${i}`, agent: "claude" })) } }));

beforeAll(async () => {
  const herdr = join(DATA, "herdr");
  writeFileSync(herdr, `#!/bin/sh\ncase "$*" in\n  *"agent list"*) cat "${AGENTS}" ;;\n  *"agent prompt"*) { for a in "$@"; do printf '%s\\n<<ARG>>\\n' "$a"; done; printf '<<END>>\\n'; } >> "${LOG}" ;;\nesac\nexit 0\n`);
  chmodSync(herdr, 0o755);
  agents(["hq", "eng"]);
  const env: Record<string, string | undefined> = { ...process.env, HUD_HOST: "127.0.0.1", HUD_DATA_DIR: DATA, HERDR_BIN: herdr, HUD_MACHINES: "local", HUD_LOCAL_MACHINE: "local", HUD_HQ_AGENT: "hq", HUD_OWNER: "Sam" };
  server = await spawnServer({ cwd: ROOT, env });
  BASE = server.base;
  for (const name of ["eng", "gone"]) await post("/api/lanes", { name, parent: "hq", machine: "local" });
  await post("/api/sync", {});
}, 30_000);

afterAll(async () => {
  await server?.stop();
  rmSync(DATA, { recursive: true, force: true });
});

async function send(path: string, body: unknown) {
  const res = await fetch(`${BASE}${path}`, { method: "POST", headers: { "content-type": "application/json", "x-hud": "1" }, body: JSON.stringify(body) });
  return { status: res.status, data: await res.json() };
}
async function post(path: string, body: unknown) {
  const { status, data } = await send(path, body);
  if (status !== 200) throw new Error(data.error);
  return data;
}
const get = async (path: string) => (await fetch(`${BASE}${path}`)).json();
const upload = (name: string, bytes: Uint8Array | string, type = "") =>
  fetch(`${BASE}/api/uploads?name=${encodeURIComponent(name)}`, { method: "POST", headers: { "x-hud": "1", ...(type ? { "content-type": type } : {}) }, body: bytes });

// The real CLI, as an agent runs it.
async function hud(args: string[]) {
  const proc = Bun.spawn([process.execPath, join(ROOT, "hud.ts"), ...args], { env: { ...process.env, HUD_URL: BASE }, stdout: "pipe", stderr: "pipe" });
  const [out, err, code] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited]);
  return { out: out.trim(), err: err.trim(), code };
}
const prompts = (): string[][] => (existsSync(LOG) ? readFileSync(LOG, "utf8").split("<<END>>\n").filter(Boolean).map((p) => p.split("\n<<ARG>>\n").filter((a, i, all) => i < all.length - 1 || a)) : []);
async function promptsTo(name: string, part: string, ms = 3000) {
  for (const end = Date.now() + ms; Date.now() < end; await Bun.sleep(40)) if (prompts().some((p) => p.includes(name) && p.at(-1)!.includes(part))) break;
  await Bun.sleep(300);
  return prompts().filter((p) => p.includes(name) && p.at(-1)!.includes(part));
}
async function until<T>(read: () => Promise<T>, ok: (v: T) => boolean, ms = 3000) {
  let v = await read();
  for (const end = Date.now() + ms; !ok(v) && Date.now() < end; await Bun.sleep(40)) v = await read();
  return v;
}

const PNG = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="), (c) => c.charCodeAt(0));

describe("uploads", () => {
  test("any kept type: an image and a text file, served back on this server's URL", async () => {
    const img = await (await upload("shot.png", PNG, "image/png")).json();
    expect(img).toMatchObject({ kind: "image", type: "image/png", name: "shot.png", size: PNG.byteLength });
    expect(img.url).toMatch(/^\/uploads\/[\w-]+-shot\.png$/);
    expect(img.href).toBe(`${BASE}${img.url}`);
    const served = await fetch(img.href);
    expect(served.headers.get("content-type")).toBe("image/png");
    expect(new Uint8Array(await served.arrayBuffer())).toEqual(PNG);

    const notes = await (await upload("trace notes.md", "# Trace\nline two\n", "text/markdown")).json();
    expect(notes).toMatchObject({ kind: "file", type: "text/markdown" });
    const back = await fetch(notes.href);
    expect(await back.text()).toBe("# Trace\nline two\n");
    // A file shows but never runs.
    expect(back.headers.get("content-security-policy")).toContain("sandbox");
    expect(back.headers.get("x-content-type-options")).toBe("nosniff");
  });

  test("the reply names no path on this machine's disk, and the stored name cannot be guessed", async () => {
    const res = await upload("a.txt", "hello", "text/plain");
    const text = await res.text();
    expect(text).not.toContain(DATA);
    expect(text).not.toContain("/uploads/a.txt");
    expect(JSON.parse(text).path).toBeUndefined();
    const b = await (await upload("a.txt", "hello", "text/plain")).json();
    expect(b.url).not.toBe(JSON.parse(text).url);
  });

  test("the cap: a file over 25 MB is refused with 413 and not kept", async () => {
    const before = readdirSync(join(DATA, "uploads")).length;
    const res = await upload("big.txt", new Uint8Array(25 * 1024 * 1024 + 1).fill(97), "text/plain");
    expect(res.status).toBe(413);
    expect((await res.json()).error).toContain("over 25 MB");
    expect(readdirSync(join(DATA, "uploads")).length).toBe(before);
  });

  test("the type: an unknown type, bytes that do not match their type, and binary text are refused with 415", async () => {
    const exe = await upload("tool.exe", new Uint8Array([0x4d, 0x5a, 0, 0]), "application/octet-stream");
    expect(exe.status).toBe(415);
    expect((await exe.json()).error).toContain(".exe is not kept here");
    const fake = await upload("photo.png", "not a png at all", "image/png");
    expect(fake.status).toBe(415);
    expect((await fake.json()).error).toContain("not a PNG file");
    const bin = await upload("notes.txt", new Uint8Array([0x68, 0x00, 0x69]), "text/plain");
    expect(bin.status).toBe(415);
    expect((await upload("x.png", new Uint8Array(0), "image/png")).status).toBe(400);
  });

  test("a name without an extension takes its type from the content type; a stray name is not served", async () => {
    const r = await (await upload("shot", PNG, "image/png")).json();
    expect(r.url).toMatch(/-shot\.png$/);
    expect((await fetch(`${BASE}/uploads/..%2Fhud.db`)).status).toBe(404);
    expect((await fetch(`${BASE}/uploads/nothing-here.png`)).status).toBe(404);
  });
});

describe("threads", () => {
  let ask = 0;
  test("a reply on a question goes to its lane through the rooms' delivery, and the lane answers in the thread", async () => {
    ask = (await post("/api/asks", { lane: "eng", title: "Which export path?", options: ["COPY", "SQLite"] })).id;
    const { slug, id } = await post(`/api/threads/question/${ask}`, { text: "What does COPY need?" });
    expect(slug).toBe(`thread-q${ask}`);
    const got = await promptsTo("eng", "What does COPY need?");
    expect(got.length).toBe(1);
    expect(got[0].at(-1)).toStartWith(`HUD question #${ask} ("Which export path?"): Sam replied (message #${id}):\nWhat does COPY need?\n`);
    expect(got[0].at(-1)).toContain(`hud room say ${slug} "<your reply>"`);
    const room = await until(() => get(`/api/rooms/${slug}`), (r: any) => r.messages[0]?.delivery === "sent");
    expect(room.messages[0]).toMatchObject({ id, who: "owner", to: "eng", delivery: "sent" });
    // The question stays open: a reply is not an answer.
    expect((await get("/api/state")).open.some((a: any) => a.id === ask)).toBe(true);

    expect((await hud(["room", "say", slug, "A role, pg_read_server_files."])).code).toBe(0);
    const s = await get("/api/state");
    const item = s.inbox.find((i: any) => i.key === `ask:${ask}`);
    expect(item.thread).toMatchObject({ slug, unread: 1 });
    // While the question is listed its thread is not a room of its own in the stack.
    expect(s.inbox.some((i: any) => i.key === `room:${slug}`)).toBe(false);
    expect(s.rooms.find((r: any) => r.slug === slug).thread).toEqual({ kind: "question", ref: ask });
  });

  test("To HQ goes to HQ; another lane is refused", async () => {
    await post(`/api/threads/question/${ask}`, { text: "HQ, is the role fine?", to: "hq" });
    expect((await promptsTo("hq", "HQ, is the role fine?")).length).toBe(1);
    const r = await send(`/api/threads/question/${ask}`, { text: "x", to: "gone" });
    expect(r.status).toBe(400);
    expect(r.data.error).toContain("goes to eng or HQ");
  });

  test("a lane that is away keeps the reply; RETRY after a failure; an update's thread works the same", async () => {
    const u = (await post("/api/updates", { lane: "gone", title: "Nightly export moved" })).id;
    const { slug, id } = await post(`/api/threads/update/${u}`, { text: "Since when?" });
    expect(slug).toBe(`thread-u${u}`);
    const room = await get(`/api/rooms/${slug}`);
    expect(room.messages.find((m: any) => m.id === id).delivery).toBe("away");
    // The lane is back: the kept reply goes once.
    agents(["hq", "eng", "gone"]);
    await post("/api/sync", {});
    expect((await promptsTo("gone", "Since when?")).length).toBe(1);
    const sent = await until(() => get(`/api/rooms/${slug}`), (r: any) => r.messages[0].delivery === "sent");
    expect(sent.messages[0].delivery).toBe("sent");
    await post(`/api/rooms/${slug}/messages/${id}/retry`, {}); // a sent message is not sent again
    expect((await promptsTo("gone", "Since when?", 500)).length).toBe(1);
  });

  test("HQ cannot open a room with a thread's slug, and a thread needs a real item", async () => {
    expect((await hud(["room", "create", "thread-q999", "--title", "X", "--owner", "eng"])).err).toContain("cannot start with thread-");
    expect((await send("/api/threads/question/999999", { text: "x" })).data.error).toContain("no question #999999");
  });
});

describe("reopen", () => {
  test("an answered question opens again: the answer is cleared, the lane and HQ are told, the thread keeps it", async () => {
    const id = (await post("/api/asks", { lane: "eng", title: "Ship tonight?", options: ["Yes", "Wait"] })).id;
    expect((await send(`/api/asks/${id}/reopen`, {})).data.error).toContain("only an answered question can be reopened");
    await post(`/api/asks/${id}/answer`, { answer: "Yes" });
    expect((await get("/api/state")).answered.some((a: any) => a.id === id)).toBe(true);

    const r = await post(`/api/asks/${id}/reopen`, {});
    expect(r).toEqual({ id, slug: `thread-q${id}` });
    const s = await get("/api/state");
    const open = s.open.find((a: any) => a.id === id);
    expect(open).toMatchObject({ status: "open", answer: null, answered_at: null });
    expect(s.answered.some((a: any) => a.id === id)).toBe(false);
    expect(s.inbox.some((i: any) => i.key === `ask:${id}`)).toBe(true);
    const told = await promptsTo("eng", `reopened question #${id}`);
    expect(told.length).toBe(1);
    expect(told[0].at(-1)).toContain('The answer "Yes" no longer stands');
    expect((await get(`/api/rooms/thread-q${id}`)).messages[0].text).toContain('The answer "Yes" no longer stands');
    // Answered again, it is answered with the new answer.
    await post(`/api/asks/${id}/answer`, { answer: "Wait" });
    expect((await get("/api/state")).answered.find((a: any) => a.id === id).answer).toBe("Wait");
  });

  test("a question its lead answered (D20) goes back to the owner when reopened: open, no holder, no answered-by", async () => {
    await post("/api/lanes", { name: "sub", parent: "eng", machine: "local" });
    agents(["hq", "eng", "sub"]);
    await post("/api/sync", {});
    await post("/api/settings", { settings: { askRoute: "lead" } });
    try {
      const id = (await post("/api/asks", { lane: "sub", title: "Which branch?" })).id;
      expect((await get("/api/state")).open.find((a: any) => a.id === id).holder).toBe("eng");
      let token = "";
      for (const end = Date.now() + 5000; !token && Date.now() < end; await Bun.sleep(40))
        token = prompts().find((p) => p.includes("eng") && p.at(-1)!.includes(`question #${id} for you`))?.at(-1)!.match(/--token ([0-9a-f]{32})/)?.[1] ?? "";
      expect(token).toMatch(/^[0-9a-f]{32}$/);
      await post(`/api/asks/${id}/answer`, { answer: "main", token });
      expect((await get("/api/state")).answered.find((a: any) => a.id === id)).toMatchObject({ answered_by: "eng", holder: "eng" });

      await post(`/api/asks/${id}/reopen`, {});
      const reopened = (await get("/api/state")).open.find((a: any) => a.id === id);
      expect(reopened).toMatchObject({ status: "open", answered_by: null, holder: null });
    } finally {
      await post("/api/settings", { settings: { askRoute: null } });
    }
  });

  test("a withdrawn question cannot be reopened", async () => {
    const id = (await post("/api/asks", { lane: "eng", title: "Old one" })).id;
    await post(`/api/asks/${id}/withdraw`, { reason: "moot" });
    const r = await send(`/api/asks/${id}/reopen`, {});
    expect(r.status).toBe(400);
    expect(r.data.error).toContain("is withdrawn");
  });
});
