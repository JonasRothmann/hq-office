// The ECS comparison (docs/engine/rfc.md 2.12), run headless: the chosen design (the sim, an ECS) and its rival (one
// state object and one step interpreter per character) do the same walk-and-sit and end in the same place.
import { describe, expect, test } from "bun:test";
import { buildLot, createNav, createSim } from "../../../packages/world/src/model/index.js";
import tiny from "../../../packages/world/examples/tiny-house.world.js";
import { createWalkers } from "./scene-graph/walker.js";

const STEP = 1 / 60;
const both = () => {
  const a = buildLot(tiny), b = buildLot(tiny);
  return { ecs: createSim(a.lot, createNav(a.lot)), sg: createWalkers(b.lot, createNav(b.lot)) };
};
const run = (d: any, s: number) => { for (let t = 0; t < s - 1e-9; t += STEP) d.step(STEP); };
const at = (c: any) => ({ x: +c.x.toFixed(2), z: +c.z.toFixed(2), hips: +c.hips.toFixed(2), clip: c.clip ?? c.anim.clip });

describe("ECS and scene-graph walkers agree", () => {
  test("walk to chair-1 and sit to type", () => {
    const { ecs, sg } = both();
    ecs.act("ada", { do: "sit", target: "chair-1", clip: "type" });
    sg.act("ada", { do: "sit", target: "chair-1", clip: "type" });
    run(ecs, 8);
    run(sg, 8);
    expect(at(ecs.character("ada"))).toEqual({ x: 3.5, z: 4.47, hips: 0.44, clip: "type" });
    expect(at(sg.get("ada"))).toEqual(at(ecs.character("ada")));
  });

  test("the visit: both pause beside chair-3 and end back at chair-1, typing", () => {
    const { ecs, sg } = both();
    const visit = { do: "visit", target: "chair-3", wait: 2, then: { do: "sit", target: "chair-1", clip: "type" } };
    ecs.act("ada", visit);
    sg.act("ada", visit);
    const paused = (c: any) => c.clip === "idle" && Math.abs(c.x - 8.5) < 1e-6 && Math.abs(c.z - 5.5) < 1e-6;
    let ecsPause = 0, sgPause = 0;
    for (let t = 0; t < 14; t += STEP) {
      ecs.step(STEP); sg.step(STEP);
      if (paused(ecs.character("ada"))) ecsPause += STEP;
      if (paused({ ...sg.get("ada"), clip: sg.get("ada").anim.clip })) sgPause += STEP;
    }
    expect(ecsPause).toBeGreaterThan(2);
    expect(sgPause).toBeGreaterThan(2);
    expect(at(ecs.character("ada"))).toEqual({ x: 3.5, z: 4.47, hips: 0.44, clip: "type" });
    expect(at(sg.get("ada"))).toEqual(at(ecs.character("ada")));
  });
});
