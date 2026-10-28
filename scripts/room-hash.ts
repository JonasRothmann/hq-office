// Browser tests' tools: find and start headless Chrome (with WebGL on SwiftShader when a test needs the 3D office),
// open a tab that collects console errors, start server.ts on a spare port with a throwaway data folder and a fake
// herdr, seed it with lanes and questions, and freeze the page's clock and frames (FREEZE).
//
// The name is from when it also hashed the pixel room's canvas; that room is gone, and so is the hashing.
import { mkdtempSync, rmSync, writeFileSync, chmodSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const DAY = Date.UTC(2026, 3, 20, 14, 0); // the seeded questions' age is measured from here

export function findChrome(): string | null {
  if (process.env.CHROME_BIN) return process.env.CHROME_BIN;
  const mac = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  if (existsSync(mac)) return mac;
  for (const p of ["/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"]) if (existsSync(p)) return p;
  return null;
}

// The page's clock, randomness and frames, frozen. #t=<epoch ms> turns it on; __hq.advance(n, ms) runs n frames, ms
// apart (100 by default).
export const FREEZE = `(() => {
  const m = location.hash.match(/t=(\\d+)/);
  if (!m) return;
  const EPOCH = Number(m[1]);
  let T = 900;
  const RealDate = Date;
  // The wall clock stands still; only the frames move (the office animates from the frame time it is given).
  const now = () => EPOCH;
  function FakeDate(...a) {
    if (!new.target) return new RealDate(now()).toString();
    return a.length ? new RealDate(...a) : new RealDate(now());
  }
  FakeDate.prototype = RealDate.prototype;
  FakeDate.now = now; FakeDate.UTC = RealDate.UTC; FakeDate.parse = RealDate.parse;
  window.Date = FakeDate;
  performance.now = () => T;
  let seed = 12345;
  Math.random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const queue = [];
  window.requestAnimationFrame = (cb) => { queue.push(cb); return queue.length; };
  window.cancelAnimationFrame = () => {};
  // A timer with a delay waits on the frozen clock and runs in advance(), when its time comes. A zero delay runs at
  // once, as in a browser.
  const realSetTimeout = window.setTimeout.bind(window), realClearTimeout = window.clearTimeout.bind(window);
  const timers = new Map();
  let timerId = 1e9;
  window.setTimeout = (fn, ms, ...a) => {
    if (!(ms > 0)) return realSetTimeout(fn, ms, ...a);
    timers.set(++timerId, { at: T + ms, fn: () => fn(...a) });
    return timerId;
  };
  window.clearTimeout = (id) => { timers.delete(id); realClearTimeout(id); };
  const runTimers = () => {
    for (;;) {
      let next = null;
      for (const [id, t] of timers) if (t.at <= T && (!next || t.at < next[1].at)) next = [id, t];
      if (!next) return;
      timers.delete(next[0]);
      next[1].fn();
    }
  };
  // No live stream: the page renders the state it loads, and nothing a write sends back can race a capture.
  // (It also keeps Chrome's six sockets per host free; lingering stream sockets stall a quick run of page loads.)
  // The real stream's first message is the whole state; this one sends that once and then stays quiet.
  window.EventSource = class {
    constructor() {
      setTimeout(async () => {
        const s = await (await window.fetch("/api/state")).json();
        this.onmessage?.({ data: JSON.stringify(s) });
      }, 0);
    }
    close() {}
  };
  // The server's clock, machine numbers and score are real; pin them.
  const realFetch = window.fetch.bind(window);
  window.fetch = async (url, init) => {
    const res = await realFetch(url, init);
    if (!String(url).includes("/api/state")) return res;
    const s = await res.json();
    s.now = now();
    s.machines = [{ machine: "local", sample: { at: now(), machine: "local", ok: 1, cores: 8, load1: 1.5, cpu_busy: 12, mem_used: 40 }, age: 0, ok: true }];
    s.score = { bank: 1000, lost: 0, bonus: 0, fast: 0, burnPerMin: s.open.length };
    s.sync = { at: 0, errors: [] };
    s.events = [];
    // timestamps the server took from its own clock
    s.updates?.forEach((u, i) => { u.at = EPOCH - (i + 1) * 60000; });
    s.notes?.forEach((n, i) => { n.at = EPOCH - (i + 1) * 90000; if (n.acked_at) n.acked_at = n.at; });
    s.answered?.forEach((a, i) => { a.answered_at = EPOCH - (i + 1) * 30000; if (a.acked_at) a.acked_at = a.answered_at; });
    s.lanes?.forEach((l) => { for (const k of ["herdr_since", "herdr_seen", "updated_at"]) if (l[k]) l[k] = EPOCH - 120000; });
    return new Response(JSON.stringify(s), { headers: { "content-type": "application/json" } });
  };
  window.__hq = {
    ready: () => !!document.getElementById("card")?.innerHTML && !!document.getElementById("feed")?.innerHTML,
    advance(n, ms = 100) { for (let i = 0; i < n; i++) { T += ms; runTimers(); for (const cb of queue.splice(0)) cb(T); } return T; },
  };
})();`;

export class Cdp {
  ws: WebSocket;
  id = 0;
  pending = new Map<number, (v: any) => void>();
  listeners: ((m: any) => void)[] = [];
  constructor(ws: WebSocket) {
    this.ws = ws;
    ws.onmessage = (e) => {
      const m = JSON.parse(String(e.data));
      if (m.id && this.pending.has(m.id)) { this.pending.get(m.id)!(m); this.pending.delete(m.id); }
      else for (const l of this.listeners) l(m);
    };
  }
  static async open(url: string) {
    const ws = new WebSocket(url);
    await new Promise((ok, no) => { ws.onopen = ok; ws.onerror = no; });
    return new Cdp(ws);
  }
  send(method: string, params: object = {}, sessionId?: string): Promise<any> {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params, sessionId }));
    return new Promise((ok, no) => this.pending.set(id, (m) => (m.error ? no(new Error(`${method}: ${m.error.message}`)) : ok(m.result))));
  }
}

// Headless Chrome. With webgl, WebGL runs on SwiftShader (no GPU needed, slow under load): only tests of the 3D office
// ask for it; without it the page has no WebGL and the office stays undrawn, which keeps the other tests cheap.
export async function startChrome(opts: { webgl?: boolean } = {}) {
  const bin = findChrome();
  if (!bin) throw new Error("no Chrome found; set CHROME_BIN");
  const profile = mkdtempSync(join(tmpdir(), "hq-office-chrome-"));
  const gl = opts.webgl ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] : ["--disable-gpu", "--disable-software-rasterizer"];
  const proc = Bun.spawn([bin, "--headless=new", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "--no-first-run", "--no-default-browser-check", "--mute-audio", "--hide-scrollbars", "--force-device-scale-factor=1", "--disable-background-timer-throttling", "--disable-renderer-backgrounding", ...gl, "about:blank"], { stdout: "ignore", stderr: "ignore" });
  let port = "";
  for (let i = 0; i < 300 && !port; i++) {
    try { port = readFileSync(join(profile, "DevToolsActivePort"), "utf8").split("\n")[0]; } catch {}
    if (!port) await Bun.sleep(100);
  }
  if (!port) throw new Error("Chrome did not start");
  const version = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
  const cdp = await Cdp.open(version.webSocketDebuggerUrl);
  // The profile is removed once Chrome has exited: removed while it still runs, Chrome writes parts of it back.
  return { cdp, close: async () => { cdp.ws.close(); proc.kill(); await proc.exited; rmSync(profile, { recursive: true, force: true }); } };
}

// A port nothing is listening on right now.
export function freePort() {
  const probe = Bun.serve({ port: 0, hostname: "127.0.0.1", fetch: () => new Response() });
  const port = probe.port;
  probe.stop(true);
  return port;
}

// server.ts on a port of its own. A port that was free when freePort probed it can be taken before the server binds
// it (by another test run on this machine); the server then exits, and a readiness check on that port would reach
// the other run's server. So the server's own word is the signal: it prints its address only once it listens, and a
// server that exits first is started again on another port.
export async function spawnServer(opts: { cwd: string; env: Record<string, string | undefined>; out?: (chunk: Uint8Array) => void }) {
  for (let attempt = 1; ; attempt++) {
    const port = freePort();
    const proc = Bun.spawn([process.execPath, "server.ts"], { cwd: opts.cwd, env: { ...opts.env, HUD_PORT: String(port) }, stdout: "pipe", stderr: "pipe" });
    let said = "";
    let listening!: (ok: boolean) => void;
    const up = new Promise<boolean>((ok) => (listening = ok));
    const pump = async (s: ReadableStream<Uint8Array>, watch: boolean) => {
      for await (const chunk of s) {
        opts.out?.(chunk);
        if (watch && !said.includes("HQ command centre on")) {
          said += new TextDecoder().decode(chunk);
          if (said.includes("HQ command centre on")) listening(true);
        }
      }
    };
    const drained = Promise.all([pump(proc.stdout, true), pump(proc.stderr, false)]).then(() => {});
    proc.exited.then(() => listening(false));
    const timer = setTimeout(() => listening(false), 15_000);
    const ok = await up;
    clearTimeout(timer);
    const stop = async () => { proc.kill(); await proc.exited; await drained; };
    if (ok) return { proc, port, base: `http://127.0.0.1:${port}`, stop };
    await stop();
    if (attempt === 5) throw new Error(`server.ts did not start (last port ${port}): ${said.trim() || "no output"}`);
  }
}

export async function startServer(dir: string, extraEnv: Record<string, string> = {}) {
  const data = mkdtempSync(join(tmpdir(), "hq-office-page-"));
  const herdr = join(data, "herdr");
  // A herdr that knows HQ and two agents: one working, one idle. Everything else it is asked succeeds quietly.
  writeFileSync(herdr, `#!/bin/sh\ncase "$*" in\n  *"agent list"*) echo '{"result":{"agents":[{"name":"hq","agent_status":"idle","pane_id":"p0","agent":"claude"},{"name":"golf","agent_status":"working","pane_id":"p1","agent":"claude"},{"name":"alpha","agent_status":"idle","pane_id":"p2","agent":"claude"}]}}' ;;\n  *) exit 0 ;;\nesac\n`);
  chmodSync(herdr, 0o755);
  const env = { ...process.env, HUD_HOST: "127.0.0.1", HUD_DATA_DIR: data, HERDR_BIN: herdr, HUD_OWNER: "Tester", HUD_MACHINES: "local", HUD_LOCAL_MACHINE: "local", HUD_HQ_AGENT: "hq", ...extraEnv };
  const server = await spawnServer({ cwd: dir, env });
  const { base } = server;
  const post = (path: string, body: object) => fetch(`${base}${path}`, { method: "POST", headers: { "content-type": "application/json", "x-hud": "1" }, body: JSON.stringify(body) }).then((r) => r.json());
  return { base, post, stop: async () => { await server.stop(); rmSync(data, { recursive: true, force: true }); } };
}

export async function seed(post: (p: string, b: object) => Promise<any>) {
  const lanes = [
    { name: "alpha", phase: "running", title: "Idle at HQ" },
    { name: "bravo", phase: "running", title: "Has a question" },
    { name: "charlie", phase: "waiting", title: "Waits on CI" },
    { name: "delta", phase: "parked", title: "Parked" },
    { name: "echo", phase: "done", title: "Done one" },
    { name: "foxtrot", phase: "done", title: "Done two" },
    { name: "golf", phase: "running", title: "At the desk" },
    { name: "hotel-with-a-long-name", phase: "done", title: "Done three" },
  ];
  for (const l of lanes) await post("/api/lanes", { ...l, machine: "local" });
  const ask = await post("/api/asks", { lane: "bravo", kind: "decision", title: "Ship the thing?", body: "Two ways to go.\n```\nbun test\n```", options: ["Yes", "No"], recommended: "Yes", created_at: DAY - 7 * 60_000 });
  await post("/api/asks", { lane: "charlie", kind: "action", title: "Approve the deploy", created_at: DAY - 40 * 60_000 });
  await post("/api/updates", { lane: "golf", title: "Halfway there", body: "The first part is merged." });
  await post("/api/notes", { text: "Keep going." });
  await post("/api/sync", {});
  return ask.id as number;
}

// A tab with focus emulated and console errors and warnings collected.
export async function newSession(cdp: Cdp, errors: string[]) {
  const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
  const s = (m: string, p: object = {}) => cdp.send(m, p, sessionId);
  cdp.listeners.push((m) => {
    if (m.sessionId !== sessionId) return;
    if (m.method === "Runtime.exceptionThrown") errors.push(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text);
    if (m.method === "Runtime.consoleAPICalled" && (m.params.type === "error" || m.params.type === "warning")) errors.push(m.params.args.map((a: any) => a.value ?? a.description).join(" "));
    if (m.method === "Log.entryAdded" && m.params.entry.level === "error" && !/fonts\.(googleapis|gstatic)|ERR_BLOCKED/.test(m.params.entry.text + (m.params.entry.url ?? ""))) errors.push(m.params.entry.text);
  });
  for (const d of ["Page", "Runtime", "Log", "Network", "Animation"]) await s(`${d}.enable`);
  await s("Emulation.setFocusEmulationEnabled", { enabled: true });
  const evaluate = async (expression: string) => {
    const r = await s("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
    return r.result.value;
  };
  return { s, evaluate };
}
