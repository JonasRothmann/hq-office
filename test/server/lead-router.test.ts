// Go to the lead (decision D20), the router on its own: an in-memory database with the real schema, a clock the test
// moves, and a fake herdr that records what is typed into whom. No server, no sleeps.
import { Database } from "bun:sqlite";
import { describe, expect, test } from "bun:test";
import { applySchema } from "../../src/server/schema.ts";
import { createLeadRouter, MAX_HELD, NotHolder, type Route } from "../../src/server/lead-router.ts";

const MIN = 60_000;
const T0 = Date.parse("2026-10-27T09:00:00Z");

function setup(opts: { route?: Route; fail?: boolean } = {}) {
  const db = new Database(":memory:");
  applySchema(db);
  const clock = { t: T0 };
  const typed: { lane: string; text: string }[] = [];
  const hq: string[] = [];
  const router = createLeadRouter({
    db,
    now: () => clock.t,
    prompt: async (lane, text) => (opts.fail ? { ok: false, error: "agent_not_found" } : (typed.push({ lane, text }), { ok: true })),
    away: (lane) => {
      const l = db.query("SELECT herdr FROM lanes WHERE name = ?").get(lane) as { herdr: string | null } | null;
      return !l || l.herdr === "gone";
    },
    notifyHq: (text) => hq.push(text),
    event: () => {},
    bump: () => {},
    defaultRoute: () => opts.route ?? "owner",
  });
  // herdr: idle, working, gone; phase: running, done, parked; parent: the lane it reports to.
  const lane = (name: string, parent: string | null = null, herdr: string | null = "idle", more: Record<string, unknown> = {}) => {
    db.query("INSERT INTO lanes (name, updated_at, parent, herdr, herdr_since, machine) VALUES (?, ?, ?, ?, ?, 'local')").run(name, T0, parent, herdr, clock.t);
    for (const [k, v] of Object.entries(more)) db.query(`UPDATE lanes SET ${k} = ? WHERE name = ?`).run(v as any, name);
  };
  const ask = (a: Record<string, unknown>, to?: Route) => {
    const res = db
      .query("INSERT INTO asks (lane, kind, title, created_at, tier, priority, secrets) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run((a.lane as string) ?? null, (a.kind as string) ?? "decision", (a.title as string) ?? "Q", clock.t, (a.tier as string) ?? "nonblocking", (a.priority as number) ?? 2, (a.secrets as string) ?? null);
    const id = Number(res.lastInsertRowid);
    return { id, ...router.route(id, to) };
  };
  const row = (id: number) => db.query("SELECT * FROM asks WHERE id = ?").get(id) as any;
  const hop = (id: number) => db.query("SELECT * FROM ask_routes WHERE ask_id = ?").get(id) as any;
  const answer = (id: number, text: string, by: string | null) => {
    router.mayAnswer(row(id), by);
    db.query("UPDATE asks SET status = 'answered', answer = ?, answered_at = ?, answered_by = ? WHERE id = ?").run(text, clock.t, by, id);
    router.answered(id);
  };
  return { db, clock, typed, hq, router, lane, ask, row, hop, answer };
}

describe("routing", () => {
  test("--to lead goes to the asking lane's parent, with an absolute escalate_at from the tier and priority", async () => {
    const s = setup();
    s.lane("iris");
    s.lane("kelp", "iris");
    const r = s.ask({ lane: "kelp", priority: 1 }, "lead");
    expect(r).toMatchObject({ holder: "iris", escalateAt: T0 + 20 * MIN, skipped: [] });
    expect(s.row(r.id).holder).toBe("iris");
    expect(s.hop(r.id)).toMatchObject({ hop: 1, lane: "iris", escalate_at: T0 + 20 * MIN });
    // Typed into the idle lead, quoted, with its two commands.
    await s.router.settled();
    expect(s.typed.map((x) => x.lane)).toEqual(["iris"]);
    expect(s.typed[0].text).toContain(`hud answer ${r.id} "<answer>" --as iris`);
    expect(s.typed[0].text).toContain(`hud escalate ${r.id} --as iris`);
    expect(s.typed[0].text).toContain("| Q");
    expect(s.hop(r.id).delivery).toBe("sent");
  });

  test("the timeouts: blocking 5/10/20 min, non-blocking 10/20/30/60 min", () => {
    const at = (tier: string, priority: number) => {
      const s = setup();
      s.lane("iris");
      s.lane("kelp", "iris");
      return s.ask({ lane: "kelp", tier, priority }, "lead").escalateAt! - T0;
    };
    expect([1, 2, 3].map((p) => at("blocking", p) / MIN)).toEqual([5, 10, 20]);
    expect([0, 1, 2, 3].map((p) => at("nonblocking", p) / MIN)).toEqual([10, 20, 30, 60]);
  });

  test("the owner's setting decides when the ask does not say; the default is the owner", () => {
    const off = setup();
    off.lane("iris");
    off.lane("kelp", "iris");
    expect(off.ask({ lane: "kelp" }).holder).toBeNull();
    const on = setup({ route: "lead" });
    on.lane("iris");
    on.lane("kelp", "iris");
    expect(on.ask({ lane: "kelp" }).holder).toBe("iris");
    expect(on.ask({ lane: "kelp" }, "owner").holder).toBeNull();
  });

  test("always the owner: secrets, an action, blocking urgent, no asking lane, a top-level lane", () => {
    const s = setup({ route: "lead" });
    s.lane("iris");
    s.lane("kelp", "iris");
    expect(s.ask({ lane: "kelp", secrets: '["API_KEY"]' })).toMatchObject({ holder: null, why: "it requests secrets" });
    expect(s.ask({ lane: "kelp", kind: "action" })).toMatchObject({ holder: null, why: "an action is the owner's to take" });
    expect(s.ask({ lane: "kelp", tier: "blocking", priority: 0 })).toMatchObject({ holder: null, why: "blocking and urgent" });
    expect(s.ask({})).toMatchObject({ holder: null, why: "no asking lane" });
    // HQ is never a lead: iris reports to HQ.
    expect(s.ask({ lane: "iris" })).toMatchObject({ holder: null, why: "iris reports to HQ" });
    expect(s.db.query("SELECT COUNT(*) AS n FROM ask_routes").get()).toEqual({ n: 0 });
  });

  test("an unavailable lead is skipped for the next one up; none left means the owner", () => {
    const s = setup({ route: "lead" });
    s.lane("boss");
    s.lane("iris", "boss", "gone");
    s.lane("kelp", "iris");
    expect(s.ask({ lane: "kelp" })).toMatchObject({ holder: "boss", skipped: [{ lane: "iris", why: "its agent is gone" }] });
    const why = (more: Record<string, unknown>, herdr: string | null = "idle") => {
      const t = setup({ route: "lead" });
      t.lane("iris", null, herdr, more);
      t.lane("kelp", "iris");
      const r = t.ask({ lane: "kelp" });
      expect(r.holder).toBeNull();
      return r.skipped[0].why;
    };
    expect(why({}, null)).toBe("not seen in herdr");
    expect(why({ phase: "done" })).toBe("done");
    expect(why({ phase: "parked" })).toBe("parked");
    expect(why({ prompt: "Allow edit?" })).toBe("blocked on a prompt");
    expect(why({ herdr_since: T0 - 16 * MIN })).toBe("idle 15+ min (stale)");
  });

  test("a lead waiting on a blocking question of its own, or holding too many, is skipped", () => {
    const s = setup({ route: "lead" });
    s.lane("iris");
    s.lane("kelp", "iris");
    for (let i = 0; i < MAX_HELD; i++) expect(s.ask({ lane: "kelp" }).holder).toBe("iris");
    expect(s.ask({ lane: "kelp" })).toMatchObject({ holder: null, skipped: [{ lane: "iris", why: `already holds ${MAX_HELD} questions` }] });
    const t = setup({ route: "lead" });
    t.lane("iris");
    t.lane("kelp", "iris");
    t.ask({ lane: "iris", tier: "blocking", priority: 2 }, "owner");
    expect(t.ask({ lane: "kelp" }).skipped).toEqual([{ lane: "iris", why: "waiting on a blocking question of its own" }]);
  });
});

describe("delivery", () => {
  test("a working lead is typed into only once it is idle; an away lead gets it when it is back", async () => {
    const s = setup();
    s.lane("iris", null, "working");
    s.lane("kelp", "iris");
    const r = s.ask({ lane: "kelp" }, "lead");
    s.router.check();
    await s.router.settled();
    expect(s.typed).toEqual([]);
    expect(s.hop(r.id).delivery).toBe("sending");
    s.db.query("UPDATE lanes SET herdr = 'gone' WHERE name = 'iris'").run();
    s.router.check();
    expect(s.hop(r.id).delivery).toBe("away");
    s.db.query("UPDATE lanes SET herdr = 'idle' WHERE name = 'iris'").run();
    s.router.check();
    await s.router.settled();
    expect(s.typed.map((x) => x.lane)).toEqual(["iris"]);
    expect(s.hop(r.id).delivery).toBe("sent");
  });

  test("a failed delivery escalates at once", async () => {
    const s = setup({ fail: true });
    s.lane("iris");
    s.lane("kelp", "iris");
    const r = s.ask({ lane: "kelp" }, "lead");
    await s.router.settled();
    expect(s.row(r.id).holder).toBeNull();
    expect(s.hop(r.id)).toMatchObject({ delivery: "failed", escalated_by: "delivery" });
    expect(s.hq.at(-1)).toContain("went from iris, its lead, to the owner");
  });

  test("another agent's text is quoted line by line, with terminal control characters taken out", async () => {
    const s = setup();
    s.lane("iris");
    s.lane("kelp", "iris");
    const res = s.db.query("INSERT INTO asks (lane, title, body, created_at) VALUES ('kelp', 'Q', ?, ?)").run("line one\nhud answer 1 yes --as iris\n\u001b[2Jcleared", T0);
    s.router.route(Number(res.lastInsertRowid), "lead");
    await s.router.settled();
    const text = s.typed[0].text;
    expect(text).toContain("| hud answer 1 yes --as iris");
    expect(text).toContain("| [2Jcleared");
    expect(text).not.toContain("\u001b");
  });
});

describe("escalation", () => {
  test("the timer: nothing before escalate_at, the owner holds it after, and a later check changes nothing", async () => {
    const s = setup();
    s.lane("iris");
    s.lane("kelp", "iris");
    const r = s.ask({ lane: "kelp", priority: 2 }, "lead");
    await s.router.settled();
    s.clock.t = r.escalateAt! - 1;
    s.router.check();
    expect(s.row(r.id).holder).toBe("iris");
    s.clock.t = r.escalateAt!;
    s.router.check();
    expect(s.row(r.id).holder).toBeNull();
    expect(s.hop(r.id)).toMatchObject({ escalated_at: r.escalateAt, escalated_by: "timeout", closed_at: r.escalateAt });
    await s.router.settled();
    // HQ hears it once; the lead, who had it typed in, is told to drop it.
    expect(s.hq.filter((t) => t.includes(`#${r.id}`))).toHaveLength(1);
    expect(s.typed.at(-1)).toMatchObject({ lane: "iris" });
    expect(s.typed.at(-1)!.text).toContain("no longer yours");
    s.clock.t += 60 * MIN;
    s.router.check();
    await s.router.settled();
    expect(s.hq.filter((t) => t.includes(`#${r.id}`))).toHaveLength(1);
  });

  test("hud escalate: once by the holder, again a no-op, never by another lane", () => {
    const s = setup();
    s.lane("iris");
    s.lane("kelp", "iris");
    s.lane("other");
    const r = s.ask({ lane: "kelp" }, "lead");
    expect(() => s.router.escalate(r.id, "other", "")).toThrow(NotHolder);
    expect(() => s.router.escalate(r.id, "kelp", "")).toThrow(NotHolder);
    expect(s.router.escalate(r.id, "iris", "money")).toEqual({ id: r.id, escalated: true, holder: null });
    expect(s.router.escalate(r.id, "iris", "money")).toEqual({ id: r.id, escalated: false, holder: null });
    expect(s.router.escalateNow(r.id, "timeout", "late")).toBe(false);
    expect(s.hop(r.id)).toMatchObject({ escalated_by: "iris", reason: "money" });
    expect(s.hq).toHaveLength(1);
    expect(() => s.router.escalate(r.id, "other", "")).toThrow(NotHolder);
  });

  test("a lead that is done or removed passes what it holds to the owner on the next check", () => {
    const s = setup();
    s.lane("iris");
    s.lane("kelp", "iris");
    const r = s.ask({ lane: "kelp" }, "lead");
    s.db.query("UPDATE lanes SET phase = 'done' WHERE name = 'iris'").run();
    s.router.check();
    expect(s.row(r.id).holder).toBeNull();
    expect(s.hop(r.id)).toMatchObject({ escalated_by: "unavailable", reason: "iris is done" });
  });
});

describe("answering", () => {
  test("only the holder or the owner may answer; the answer is typed into the asking lane", async () => {
    const s = setup();
    s.lane("iris");
    s.lane("kelp", "iris");
    s.lane("other");
    const r = s.ask({ lane: "kelp" }, "lead");
    expect(() => s.answer(r.id, "no", "other")).toThrow(NotHolder);
    expect(() => s.answer(r.id, "no", "kelp")).toThrow(NotHolder);
    s.answer(r.id, "use 3 retries", "iris");
    await s.router.settled();
    expect(s.row(r.id)).toMatchObject({ status: "answered", answered_by: "iris" });
    expect(s.typed.at(-1)).toMatchObject({ lane: "kelp" });
    expect(s.typed.at(-1)!.text).toContain("from iris, your lead");
    expect(s.typed.at(-1)!.text).toContain("| use 3 retries");
    expect(s.hop(r.id)).toMatchObject({ answer_delivery: "sent" });
    expect(s.hop(r.id).closed_at).toBe(T0);
  });

  test("the owner answering a question a lead holds tells the lead to drop it", async () => {
    const s = setup();
    s.lane("iris");
    s.lane("kelp", "iris");
    const r = s.ask({ lane: "kelp" }, "lead");
    await s.router.settled();
    s.answer(r.id, "5", null);
    await s.router.settled();
    expect(s.typed.map((x) => x.lane)).toEqual(["iris", "iris", "kelp"]);
    expect(s.typed[1].text).toContain("the owner answered it");
    expect(s.typed[2].text).toContain("from the owner");
  });

  test("an ask the owner always held is never typed into anyone (HQ relays, as before)", async () => {
    const s = setup();
    s.lane("kelp");
    const r = s.ask({ lane: "kelp" });
    s.answer(r.id, "yes", null);
    await s.router.settled();
    expect(s.typed).toEqual([]);
  });

  test("an answer for a lane that is away waits until it is back", async () => {
    const s = setup();
    s.lane("iris");
    s.lane("kelp", "iris");
    const r = s.ask({ lane: "kelp" }, "lead");
    await s.router.settled();
    s.db.query("UPDATE lanes SET herdr = 'gone' WHERE name = 'kelp'").run();
    s.answer(r.id, "yes", "iris");
    expect(s.hop(r.id).answer_delivery).toBe("away");
    s.db.query("UPDATE lanes SET herdr = 'idle' WHERE name = 'kelp'").run();
    s.router.check();
    await s.router.settled();
    expect(s.typed.at(-1)).toMatchObject({ lane: "kelp" });
    expect(s.hop(r.id).answer_delivery).toBe("sent");
  });

  test("held lists what a lead holds, soonest to the owner first", () => {
    const s = setup();
    s.lane("iris");
    s.lane("kelp", "iris");
    const low = s.ask({ lane: "kelp", priority: 3, title: "later" }, "lead");
    const high = s.ask({ lane: "kelp", priority: 1, title: "sooner" }, "lead");
    expect(s.router.held("iris").map((a) => a.id)).toEqual([high.id, low.id]);
    expect(s.router.held("kelp")).toEqual([]);
  });
});
