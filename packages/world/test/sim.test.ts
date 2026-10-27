// The simulation, headless: a character walks from the lounge through the door and sits at the desk; the whole state
// is plain data that saves mid-walk and resumes to the same end; a new act replaces the old; queries read the world.
import { describe, expect, test } from "bun:test";
import { buildLot, createNav, createSim, createEcs } from "@hq/world/model";
import tiny from "../examples/tiny-house.world.js";

const STEP = 1 / 60;
const fresh = () => { const { lot } = buildLot(tiny); const nav = createNav(lot); return { lot, nav, sim: createSim(lot, nav) }; };
const run = (sim: any, s: number) => { for (let t = 0; t < s - 1e-9; t += STEP) sim.step(STEP); };
const round = (c: any) => ({ ...c, x: +c.x.toFixed(2), z: +c.z.toFixed(2), ry: +c.ry.toFixed(2), hips: +c.hips.toFixed(2) });

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

  test("the state is plain data: saved mid-walk and loaded into a new sim, it ends where the unbroken run ends", () => {
    const a = fresh(), b = fresh();
    a.sim.act("ada", { do: "sit", target: "chair-1" });
    run(a.sim, 2.5);
    const saved = JSON.parse(JSON.stringify(a.sim.ecs.toJSON()));
    expect(Object.keys(saved)).toEqual(["anim", "body", "character", "holding", "placed", "queue", "walk"]);
    b.sim.ecs.load(saved);
    run(a.sim, 6);
    run(b.sim, 6);
    expect(b.sim.ecs.toJSON()).toEqual(a.sim.ecs.toJSON());
  });

  test("a new act replaces the one in progress and releases its slot", () => {
    const { sim, nav } = fresh();
    sim.act("ada", { do: "sit", target: "chair-1" });
    run(sim, 1);
    expect(nav.holder("chair-1", "seat")).toBe("ada");
    sim.act("ada", { do: "sit", target: "chair-2" });
    expect(nav.holder("chair-1", "seat")).toBe(null);
    run(sim, 8);
    expect(sim.character("ada").step).toBe("loop");
    expect(sim.ecs.get("ada", "holding")).toEqual({ object: "chair-2", slot: "seat" });
  });

  test("acts that cannot be done reject with the fix", async () => {
    const { sim } = fresh();
    await expect(sim.act("bob", { do: "sit", target: "chair-1" })).rejects.toThrow(/no character 'bob'[\s\S]*use one of: ada/);
    await expect(sim.act("ada", { do: "sit", target: "chair-9" })).rejects.toThrow(/no object 'chair-9'/);
  });

  test("queries read the world: every placed chair is an entity and has a seat slot", () => {
    const { sim, lot } = fresh();
    const chairs = sim.ecs.query("placed").filter(([, p]: any) => p.type === "starter/chair").map(([id]: any) => id);
    expect(chairs).toEqual(["chair-1", "chair-2", "chair-3"]);
    for (const id of chairs) expect(Object.keys(lot.objects.find((o: any) => o.id === id).slots)).toEqual(["seat"]);
  });

  test("a step with no system names the fix; a system name is used once", () => {
    const { sim } = fresh();
    sim.ecs.add("ada", "queue", { steps: [{ kind: "dance" }] });
    expect(() => sim.step(STEP)).toThrow(/no system runs step 'dance'; register one with step: "dance"/);
    const ecs = createEcs();
    ecs.system({ name: "x", run() {} });
    expect(() => ecs.system({ name: "x", run() {} })).toThrow(/already registered/);
  });
});
