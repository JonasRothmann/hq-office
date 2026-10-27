// Headless Chrome over the DevTools protocol, with WebGL on SwiftShader (no GPU needed). The same approach as the
// host app's browser-test tools, kept here because the package imports nothing from outside itself.
import { mkdtempSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export function findChrome(): string | null {
  if (process.env.CHROME_BIN) return process.env.CHROME_BIN;
  for (const p of ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"]) if (existsSync(p)) return p;
  return null;
}

class Cdp {
  id = 0;
  pending = new Map<number, (m: any) => void>();
  listeners: ((m: any) => void)[] = [];
  constructor(public ws: WebSocket) {
    ws.onmessage = (e) => {
      const m = JSON.parse(String(e.data));
      if (m.id && this.pending.has(m.id)) { this.pending.get(m.id)!(m); this.pending.delete(m.id); } else for (const l of this.listeners) l(m);
    };
  }
  send(method: string, params: object = {}, sessionId?: string): Promise<any> {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params, sessionId }));
    return new Promise((ok, no) => this.pending.set(id, (m) => (m.error ? no(new Error(`${method}: ${m.error.message}`)) : ok(m.result))));
  }
}

export async function startChrome() {
  const bin = findChrome();
  if (!bin) throw new Error("no Chrome found; set CHROME_BIN");
  const profile = mkdtempSync(join(tmpdir(), "hq-world-chrome-"));
  const proc = Bun.spawn([bin, "--headless=new", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "--no-first-run", "--no-default-browser-check", "--mute-audio", "--hide-scrollbars",
    "--force-device-scale-factor=1", "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "about:blank"], { stdout: "ignore", stderr: "ignore" });
  let port = "";
  for (let i = 0; i < 300 && !port; i++) { try { port = readFileSync(join(profile, "DevToolsActivePort"), "utf8").split("\n")[0]; } catch {} if (!port) await Bun.sleep(100); }
  if (!port) throw new Error("Chrome did not start");
  const version = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
  const ws = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((ok, no) => { ws.onopen = ok; ws.onerror = no; });
  const cdp = new Cdp(ws);
  return { cdp, close: async () => { ws.close(); proc.kill(); await proc.exited; rmSync(profile, { recursive: true, force: true }); } };
}

// A tab of the given CSS size (device scale 1 unless dpr is given) that collects page errors.
export async function openTab(cdp: Cdp, { w, h, dpr = 1 }: { w: number; h: number; dpr?: number }) {
  const errors: string[] = [];
  const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
  const s = (m: string, p: object = {}) => cdp.send(m, p, sessionId);
  cdp.listeners.push((m) => {
    if (m.sessionId !== sessionId) return;
    if (m.method === "Runtime.exceptionThrown") errors.push(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text);
    if (m.method === "Runtime.consoleAPICalled" && (m.params.type === "error" || m.params.type === "warning")) errors.push(m.params.args.map((a: any) => a.value ?? a.description).join(" "));
  });
  for (const d of ["Page", "Runtime"]) await s(`${d}.enable`);
  await s("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: dpr, mobile: false });
  const evaluate = async (expression: string) => {
    const r = await s("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
    return r.result.value;
  };
  // navigate and wait for window.__lab.ready (or an error)
  const load = async (url: string, timeoutMs = 120_000) => {
    errors.length = 0;
    await s("Page.navigate", { url });
    const t0 = Date.now();
    for (;;) {
      const st = await evaluate("window.__lab ? (window.__lab.error || (window.__lab.ready ? 'ready' : '')) : ''").catch(() => "");
      if (st === "ready") return;
      if (st) throw new Error(`lab: ${st}`);
      if (errors.some((e) => /Error/.test(e))) throw new Error(`page error: ${errors.join(" | ")}`);
      if (Date.now() - t0 > timeoutMs) throw new Error("lab not ready in time");
      await Bun.sleep(100);
    }
  };
  const screenshot = async (format: "png" | "jpeg" = "png") => Buffer.from((await s("Page.captureScreenshot", { format, ...(format === "jpeg" ? { quality: 88 } : {}) })).data, "base64");
  return { s, evaluate, load, screenshot, errors, targetId };
}
