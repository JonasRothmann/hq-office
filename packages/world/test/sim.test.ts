// The simulation, headless: a character walks from the lounge through the door and sits at the desk; the whole state
// (reservations included) is plain data that saves mid-walk and resumes to the same end; two characters contend for
// one seat; a new act replaces the old; a step or system that fails stops only itself.
import { describe, expect, test } from "bun:test";
import { buildLot, createNav, createSim, createEcs, fromJSON } from "@hq/world/model";
import tiny from "./fixtures/house.world.js";

const STEP = 1 / 60;
const sim0 = (world: any = tiny) => { const { lot } = buildLot(world); const nav = createNav(lot); return { lot, nav, sim: createSim(lot, nav) }; };
const fresh = () => sim0();
const run = (sim: any, s: number) => { for (let t = 0; t < s - 1e-9; t += STEP) sim.step(STEP); };
const round = (c: any) => ({ ...c, x: +c.x.toFixed(2), z: +c.z.toFixed(2), ry: +c.ry.toFixed(2), hips: +c.hips.toFixed(2) });
// The test house with Bob in the lounge too, and no starting acts.
const withBob = fromJSON({ ...structuredClone(tiny.doc), characters: [...tiny.doc.characters, { id: "bob", at: [10, 7], facing: "n" }], acts: [] }, tiny.packs);

describe("sim", () => {
  test("ada walks through the door to the chair, sits and types; the act resolves once", async () => {
    const { sim } = fresh();
    const events: any[] = [];
    sim.on((name: string, data: any) => events.push([name, data]));
    let resolved = false;
    sim.act("ada", { do: "sit", target: "chair-1", clip: "type" }).then(() => { resolved = true; });
    const track: number[][] = [];
    for (let t = 0; t < 8; t += STEP) { sim.step(STEP); const c = sim.character("ada"); track.push([c.x, c.z]); }
    await Promise.resolve();
    expect(resolved).toBe(true);
    expect(events).toEqual([["act", { who: "ada", clip: "type" }]]);
    expect(round(sim.character("ada"))).toEqual({ id: "ada", x: 3.5, z: 4.47, ry: 3.14, hips: 0.44, clip: "type", step: "loop" });
    const crossings = track.slice(1).filter((p, i) => (track[i][0] >= 7) !== (p[0] >= 7));
    expect(crossings.length).toBe(1);
    expect(crossings[0][1]).toBeCloseTo(5.5, 1); // through the door at z 5..6
  });

  test("a reservation is a component: the only record of who holds a slot", () => {
    const { sim } = fresh();
    sim.act("ada", { do: "sit", target: "chair-1" });
    expect(sim.ecs.get("ada", "holding")).toEqual({ object: "chair-1", slot: "seat" });
    expect(sim.holder("chair-1", "seat")).toBe("ada");
    expect(sim.ecs.query("placed")).toEqual([]); // placed objects are lot data, not entities
  });

  test("two characters contend for one seat: the second is told it is taken, and gets another", async () => {
    const { sim } = sim0(withBob);
    const first = sim.act("ada", { do: "sit", target: "chair-1" });
    await expect(sim.act("bob", { do: "sit", target: "chair-1" })).rejects.toThrow(/chair-1's seat is held by ada[\s\S]*pick another object/);
    expect(sim.ecs.get("bob", "holding")).toBeUndefined();
    sim.act("bob", { do: "sit", target: "chair-2" });
    run(sim, 9);
    await first;
    expect(sim.character("ada")).toMatchObject({ step: "loop", clip: "sit" });
    expect(sim.character("bob")).toMatchObject({ step: "loop", clip: "sit" });
    expect([sim.holder("chair-1", "seat"), sim.holder("chair-2", "seat")]).toEqual(["ada", "bob"]);
  });

  test("saved mid-walk with two characters and loaded into a new sim: reservations hold and both end the same", async () => {
    const a = sim0(withBob), b = sim0(withBob);
    a.sim.act("ada", { do: "sit", target: "chair-1" });
    a.sim.act("bob", { do: "visit", target: "chair-3", wait: 1, then: { do: "sit", target: "chair-2" } });
    run(a.sim, 2.5);
    const saved = JSON.parse(JSON.stringify(a.sim.ecs.toJSON()));
    expect(Object.keys(saved)).toEqual(["anim", "body", "character", "doing", "holding", "queue", "wait", "walk"]); // ada walks, bob waits
    expect(saved.holding).toEqual({ ada: { object: "chair-1", slot: "seat" }, bob: { object: "chair-2", slot: "seat" } });
    b.sim.ecs.load(saved);
    // the loaded sim knows both seats are taken, though it never ran an act itself
    expect(b.sim.holder("chair-1", "seat")).toBe("ada");
    await expect(b.sim.act("bob", { do: "sit", target: "chair-1" })).rejects.toThrow(/held by ada/);
    run(a.sim, 9);
    run(b.sim, 9);
    expect(b.sim.ecs.toJSON()).toEqual(a.sim.ecs.toJSON());
    expect([b.sim.character("ada").step, b.sim.character("bob").step]).toEqual(["loop", "loop"]);
  });

  test("a new act replaces the one in progress and lets go of its slot", () => {
    const { sim } = fresh();
    sim.act("ada", { do: "sit", target: "chair-1" });
    run(sim, 1);
    expect(sim.holder("chair-1", "seat")).toBe("ada");
    sim.act("ada", { do: "sit", target: "chair-2" });
    expect(sim.holder("chair-1", "seat")).toBe(null);
    run(sim, 8);
    expect(sim.character("ada").step).toBe("loop");
    expect(sim.ecs.get("ada", "holding")).toEqual({ object: "chair-2", slot: "seat" });
  });

  test("an act that cannot be done changes nothing: the old act goes on and keeps its slot", async () => {
    const { sim } = fresh();
    sim.act("ada", { do: "sit", target: "chair-1" });
    run(sim, 1);
    await expect(sim.act("ada", { do: "sit", target: "chair-9" })).rejects.toThrow(/no object 'chair-9'/);
    expect(sim.holder("chair-1", "seat")).toBe("ada");
    run(sim, 8);
    expect(round(sim.character("ada"))).toMatchObject({ x: 3.5, z: 4.47, step: "loop" });
  });

  test("a visit: get up, walk to beside another room's chair, face it, wait, walk back and sit again", async () => {
    const { sim } = fresh();
    sim.act("ada", { do: "sit", target: "chair-1", clip: "type" });
    run(sim, 8);
    let back = false;
    sim.act("ada", { do: "visit", target: "chair-3", wait: 2, then: { do: "sit", target: "chair-1", clip: "type" } }).then(() => { back = true; });
    expect(sim.holder("chair-1", "seat")).toBe("ada"); // her chair stays hers while she is away
    const seen: string[] = [];
    let waitedAt: any = null;
    for (let t = 0; t < 16; t += STEP) {
      sim.step(STEP);
      const c = sim.character("ada");
      if (c.step && seen.at(-1) !== c.step) seen.push(c.step);
      if (c.step === "wait") waitedAt ??= round(c);
    }
    await Promise.resolve();
    expect(seen).toEqual(["stand", "walk", "turn", "wait", "walk", "turn", "enter", "loop"]);
    expect(waitedAt).toMatchObject({ x: 8.5, z: 5.5, ry: 3.14, clip: "idle" }); // south of chair-3 at (8, 4), facing north to it
    expect(back).toBe(true);
    expect(sim.ecs.get("ada", "doing")).toEqual({ act: { do: "sit", target: "chair-1", clip: "type" } });
    expect(round(sim.character("ada"))).toMatchObject({ x: 3.5, z: 4.47, hips: 0.44, clip: "type", step: "loop" });
  });

  test("acts that cannot be done reject with the fix", async () => {
    const { sim } = fresh();
    await expect(sim.act("bob", { do: "sit", target: "chair-1" })).rejects.toThrow(/no character 'bob'[\s\S]*use one of: ada/);
    await expect(sim.act("ada", { do: "sit", target: "chair-9" })).rejects.toThrow(/no object 'chair-9'/);
    await expect(sim.act("ada", { do: "sitt", target: "chair-1" })).rejects.toThrow(/'sitt' is not an act[\s\S]*use sit/);
    await expect(sim.act("ada", { do: "sit", target: "chair-1", clip: "tpye" })).rejects.toThrow(/'tpye' is not a clip[\s\S]*did you mean type/);
  });

  test("a step no system runs cancels that act with the fix; the others go on", async () => {
    const { sim } = sim0(withBob);
    const events: any[] = [];
    sim.on((n: string, d: any) => events.push([n, d.who, d.problem?.message]));
    const bob = sim.act("bob", { do: "sit", target: "chair-2" });
    sim.ecs.add("ada", "queue", { steps: [{ kind: "dance" }] });
    expect(() => sim.step(STEP)).not.toThrow();
    expect(events).toContainEqual(["cancel", "ada", "no system runs step 'dance'"]);
    run(sim, 8);
    await bob;
    expect(sim.character("bob").step).toBe("loop");
    expect(sim.ecs.disabled()).toEqual([]);
  });

  test("a system that throws is logged once with its name and switched off; the frame goes on", () => {
    const errors: string[] = [];
    const log = console.error;
    console.error = (...a: any[]) => { errors.push(a.join(" ")); };
    try {
      const { lot } = buildLot(tiny);
      const nav = createNav(lot);
      const events: any[] = [];
      const sim = createSim(lot, nav, { systems: [{ name: "broken", run() { throw new Error("boom"); } }], emit: (n: string, d: any) => events.push([n, d]) });
      sim.act("ada", { do: "sit", target: "chair-1" });
      run(sim, 8);
      expect(errors).toEqual(["@hq/world: system 'broken' threw and is switched off: boom"]);
      expect(events.filter(([n]) => n === "error")).toEqual([["error", { system: "broken", message: "boom" }]]);
      expect(sim.ecs.disabled()).toEqual(["broken"]);
      expect(sim.character("ada")).toMatchObject({ step: "loop", clip: "sit" }); // anim and the step systems kept running
    } finally { console.error = log; }
    const ecs = createEcs();
    ecs.system({ name: "x", run() {} });
    expect(() => ecs.system({ name: "x", run() {} })).toThrow(/already registered/);
  });
});
