#!/usr/bin/env bun
// Screenshots of the floating HUD on the real page with the 3D office behind it, for a person to look at: a server on a
// spare port with a throwaway data dir and a fake herdr (some lanes working, some idle), seeded with questions (one
// blocking, with a long markdown body), updates and a room with a brief, links and a thread, in headless Chrome with
// WebGL on SwiftShader. Saves docs/screens/hud-*.jpg: at 1440x900 the reader open on the long question and on the room,
// light and dark, with 4 and 12 lanes; on a 390x844 phone (light, 12 lanes) the page as loaded and the long question
// in the full-screen reader. Prints each shot's page console errors.
//
//   bun scripts/hud-page-shots.ts [--only=SUBSTRING]
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { newSession, startChrome, startServer } from "./room-hash.ts";

const ROOT = resolve(import.meta.dir, "..");
const OUT = join(ROOT, "docs", "screens");
const NAMES = ["atlas", "birch", "cedar", "dune", "ember", "fjord", "grove", "harbor", "iris", "juniper", "kelp", "linden"];
// What each lane is doing: w = working in herdr, i = idle, plus the lane's phase.
const PLAN: [string, string][] = [["w", "running"], ["i", "running"], ["w", "running"], ["i", "waiting"], ["i", "done"], ["w", "running"], ["i", "parked"], ["w", "running"], ["i", "done"], ["i", "running"], ["w", "running"], ["i", "waiting"]];
const MODELS = ["claude-opus-5-5", "claude-sonnet-5", "claude-haiku-4-5"];
type View = "question" | "room" | "stack";
// [file name, lane counts it is taken with, theme, view, phone]
const SHOTS: [string, number[], string, View, boolean][] = [
  ["hud-light-{n}-question", [4, 12], "light", "question", false],
  ["hud-dark-{n}-question", [4, 12], "dark", "question", false],
  ["hud-light-{n}-room", [4, 12], "light", "room", false],
  ["hud-dark-{n}-room", [4, 12], "dark", "room", false],
  ["hud-phone-stack", [12], "light", "stack", true],
  ["hud-phone-reader", [12], "light", "question", true],
];

const LONG_BODY = `The billing export has to move to the new ledger before the quarter closes. Two ways are open, and the third is to wait; each one changes what finance sees on the first of the month, so the choice is yours.

## Context

| Option | Risk | Time |
| --- | --- | --- |
| Plan A: dual write | Low: both ledgers stay in step | 3 days |
| Plan B: backfill | Medium: a gap while the job runs | 5 days |
| Wait a week | Low, but the export slips | 7 days |

## Detail

- The old ledger stays the source of truth until the cut-over.
- Plan A writes every invoice to both ledgers from the first deploy.
- Plan A needs a feature flag per customer, so a bad row can be switched off alone.
- Plan A doubles the write load on the billing database for the length of the run.
- Plan B reads the old ledger in batches of 5,000 rows.
- Plan B pauses between batches when the primary is under load.
- Plan B leaves a window in which new invoices exist only in the old ledger.
- Waiting a week lets the schema review finish first.
- Waiting also lets the audit team sign off on the field mapping.
- Credit notes map to negative invoice lines in the new ledger.
- Tax rounding differs by one cent in 0.3 percent of rows.
- The reconciliation report is the same for every option.
- Rollback for Plan A is a flag flip; for Plan B it is a restore from the snapshot.
- Customers in three time zones see invoices at midnight local time.
- Support has been told to expect questions on the first of the month.
- The dry run on staging took 41 minutes for one month of data.
- Nothing here touches payment capture.

\`\`\`sql
SELECT customer_id, SUM(amount_cents)
FROM invoices
WHERE issued_at >= date_trunc('month', now())
GROUP BY customer_id;
\`\`\`

## Links

Design doc: https://example.com/design-doc and the working room, #room/billing`;

const MEDIUM_BODY = `Both reports can run at night, but they compete for the same read replica.

- The usage report takes about 20 minutes.
- The revenue report takes about 35 minutes.

Running them one after the other ends at 03:10; running them together ends at 02:50 and slows the replica.`;

const BRIEF = `# Billing export

The export moves invoices from the old ledger to the new one. This room holds the plan, the open questions and the links.

## Goal

Finance sees the same totals in both ledgers on the first of the month.

## Scope

- Invoices, credit notes and refunds.
- Not payment capture.
- Not the customer-facing PDF.

## Steps

- [x] Map the old fields to the new ones.
- [x] Dry run on staging.
- [ ] Choose dual write or backfill.
- [ ] Feature flag per customer.
- [ ] Reconciliation report.
- [ ] Cut-over.

## Notes

The reconciliation query:

\`\`\`sql
SELECT count(*) FROM invoices i
LEFT JOIN ledger_rows l ON l.invoice_id = i.id
WHERE l.id IS NULL;
\`\`\`

Ask in this room before changing the field mapping.`;

const SAY = [
  "Mapping is done for invoices; credit notes next.",
  "Staging dry run: 41 minutes for one month, no errors.",
  "Tax rounding differs by one cent in 0.3 percent of rows. Round half up in the new ledger?",
  "Yes, round half up. It matches the old report.",
  "Flag per customer is in. Off by default.",
  "Reconciliation report runs clean on the staging copy.",
  "Waiting on the owner's choice between dual write and backfill.",
  "I will start the cut-over rehearsal as soon as that is answered.",
];

async function shoot(n: number, only?: string) {
  const wanted = SHOTS.filter(([, counts]) => counts.includes(n))
    .map(([file, , theme, view, phone]) => ({ name: file.replace("{n}", String(n)), theme, view, phone }))
    .filter(({ name }) => !only || name.includes(only));
  if (!wanted.length) return;
  const names = NAMES.slice(0, n);
  const dir = mkdtempSync(join(tmpdir(), "hq-hud-shots-"));
  const herdr = join(dir, "herdr");
  const agents = [{ name: "hq", agent_status: "idle", pane_id: "p0", agent: "claude" }, ...names.map((name, i) => ({ name, agent_status: PLAN[i][0] === "w" ? "working" : "idle", pane_id: `p${i + 1}`, agent: "claude" }))];
  writeFileSync(herdr, `#!/bin/sh\ncase "$*" in\n  *"agent list"*) echo '${JSON.stringify({ result: { agents } })}' ;;\n  *) exit 0 ;;\nesac\n`);
  chmodSync(herdr, 0o755);
  const server = await startServer(ROOT, { HERDR_BIN: herdr });
  const chrome = await startChrome({ webgl: true });
  try {
    const { post } = server;
    for (const [i, name] of names.entries()) {
      // past eight lanes, a small tree: every fourth lane leads the three after it
      const parent = n > 8 && i % 4 ? names[i - (i % 4)] : undefined;
      await post("/api/lanes", { name, phase: PLAN[i][1], title: `Lane ${name}`, machine: "local", ...(parent ? { parent } : {}) });
      await post(`/api/lanes/${name}/vitals`, { model: MODELS[i % 3], effort: ["high", "medium", "xhigh"][i % 3], subagents: PLAN[i][0] === "w" ? [2, 3, 1, 4][i % 4] : 0, contextUsed: 60_000 + i * 37_000, contextMax: 1_000_000 });
    }
    await post("/api/asks", { lane: names[1], kind: "decision", title: "Ship the migration tonight?", options: ["Yes", "No"], recommended: "Yes" });
    await post("/api/asks", { lane: names[3], kind: "decision", title: "Rename the staging bucket?", options: ["Yes", "No"] });
    await post("/api/asks", { lane: names[0], kind: "decision", title: "Run the nightly reports together or in turn?", options: ["Together", "In turn"], body: MEDIUM_BODY });
    await post("/api/asks", { lane: names[2], kind: "decision", tier: "blocking", priority: "high", title: "Which plan for the billing migration?", options: ["Plan A: dual write", "Plan B: backfill", "Wait a week"], recommended: "Plan A: dual write", body: LONG_BODY });
    await post("/api/updates", { lane: names[1], title: "PR is up for the export", body: "Review when you can; the tests pass on staging." });
    await post("/api/updates", { lane: names[3], title: "Staging copy refreshed", body: "The copy is from this morning, 06:00." });
    await post("/api/rooms", { slug: "billing", title: "Billing export", owner: names[1], members: [names[2], names[3]] });
    await post("/api/rooms/billing/brief", { body: BRIEF });
    await post("/api/rooms/billing/artifacts", { title: "Billing design doc", url: "https://claude.ai/artifact/abc" });
    await post("/api/rooms/billing/artifacts", { title: "Ledger mapping sheet", url: "https://example.com/mapping" });
    for (const text of SAY) await post("/api/rooms/billing/say", { text });
    await post("/api/sync", {});

    for (const { name, theme, view, phone } of wanted) {
      const errors: string[] = [];
      const { s, evaluate } = await newSession(chrome.cdp, errors);
      const until = async (expr: string, ms = 600_000) => {
        for (const end = Date.now() + ms; Date.now() < end; await Bun.sleep(150)) if (await evaluate(expr).catch(() => false)) return;
        throw new Error(`timed out waiting for ${expr}; page errors: ${errors.join(" | ")}; now: ${await evaluate("JSON.stringify({ desks: window.__world?.desks, items: document.querySelectorAll('#hud .item').length, url: location.href })").catch((e) => e.message)}`);
      };
      if (phone) {
        await s("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
        await s("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
      } else {
        await s("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
        await s("Emulation.setTouchEmulationEnabled", { enabled: false });
      }
      await s("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: theme }] });
      await s("Page.navigate", { url: "about:blank" });
      await s("Page.navigate", { url: `${server.base}/${view === "room" ? "#room/billing" : ""}` });
      await until(`window.__world?.desks?.length === ${n} && document.querySelectorAll("#hud .item").length >= 4`);
      // the page's fonts (a font the canvas asked for and this machine lacks can keep the status at "loading")
      await until(`document.fonts.status === "loaded"`, 5000).catch(() => {});
      await until(`(() => { const o = __world.inspect().outside; return o && !o.fading; })()`);
      await until(`window.__world.inspect().frames > 8`);
      if (view === "question") {
        const where = JSON.parse(await evaluate(`(() => { const b = document.querySelector("#hud .ask.blocking"); if (!b) return "null"; b.scrollIntoView({ block: "center" }); const r = b.getBoundingClientRect(); return JSON.stringify({ x: r.x + Math.min(r.width / 2, 120), y: r.y + 14 }); })()`));
        if (!where) throw new Error(`no #hud .ask.blocking card; page errors: ${errors.join(" | ")}`);
        await Bun.sleep(300);
        if (phone) {
          await s("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: where.x, y: where.y }] });
          await s("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
        } else {
          await s("Input.dispatchMouseEvent", { type: "mouseMoved", x: where.x, y: where.y });
          await s("Input.dispatchMouseEvent", { type: "mousePressed", x: where.x, y: where.y, button: "left", clickCount: 1 });
          await s("Input.dispatchMouseEvent", { type: "mouseReleased", x: where.x, y: where.y, button: "left", clickCount: 1 });
        }
        await until(`!document.querySelector("#reader").hidden`, 10_000);
        // park the pointer away from any card so no hover state shows
        if (!phone) await s("Input.dispatchMouseEvent", { type: "mouseMoved", x: 1430, y: 890 });
      }
      if (view === "room") await until(`!document.querySelector("#reader").hidden`, 10_000);
      // the world settles
      await Bun.sleep(1500);
      const { data } = await s("Page.captureScreenshot", { format: "jpeg", quality: 82 });
      const file = join(OUT, `${name}.jpg`);
      writeFileSync(file, Buffer.from(data, "base64"));
      console.log(`${file.slice(ROOT.length + 1)}: ${errors.length ? `${errors.length} page errors:\n  ${errors.join("\n  ")}` : "no page errors"}`);
      // leave the page so its frame loop stops drawing while the next shot loads
      await s("Page.navigate", { url: "about:blank" });
    }
  } finally {
    await chrome.close();
    await server.stop();
    rmSync(dir, { recursive: true, force: true });
  }
}

if (import.meta.main) {
  mkdirSync(OUT, { recursive: true });
  const only = process.argv.find((a) => a.startsWith("--only="))?.slice(7);
  for (const n of [4, 12]) await shoot(n, only);
}
