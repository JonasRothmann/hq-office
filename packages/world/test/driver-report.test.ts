// The driver reports a doc act it could not run, except when its character was removed: that act is over, and a
// removal is the intended outcome of an edit, not a problem to log.
import { expect, test } from "bun:test";
import { fromJSON } from "@hq/world/model";
import { createDriver } from "../src/view/driver.js";
import house from "./fixtures/house.world.js";

const STEP = 1000 / 60;
const edit = (world: any, fn: (d: any) => void) => { const d = structuredClone(world.doc); fn(d); return fromJSON(d, world.packs); };
const quiet = edit(house, (d) => { d.acts = []; });
const withBo = (fn?: (doc: any) => void) => edit(quiet, (doc) => {
  doc.characters.push({ id: "bo", at: [10, 7], facing: "w" });
  doc.acts.push({ who: "bo", do: "sit", target: "chair-2" });
  fn?.(doc);
});
let clock = 0;
const run = (d: any, ms: number) => { for (let t = 0; t < ms; t += STEP) d.tick((clock += STEP), STEP); };

// Run fn with console.error captured, through the microtasks a rejected act settles in; returns what was logged.
async function logged(fn: () => void): Promise<unknown[][]> {
  const out: unknown[][] = [];
  const orig = console.error;
  console.error = (...a: unknown[]) => { out.push(a); };
  try {
    fn();
    for (let i = 0; i < 5; i++) await Promise.resolve();
  } finally { console.error = orig; }
  return out;
}

test("a character removed while her doc act is pending: the act is over and nothing is logged", async () => {
  const d = createDriver(quiet, { size: { w: 1280, h: 800, dpr: 1 } });
  run(d, 20);
  expect(await logged(() => d.apply(withBo()))).toEqual([]);
  run(d, 500); // bo is on her way to chair-2
  expect(d.sim.characters()).toContain("bo");
  expect(d.sim.character("bo").step).toBe("walk");
  const errors = await logged(() => { d.apply(quiet); run(d, 500); });
  expect(d.sim.characters()).not.toContain("bo");
  expect(errors).toEqual([]);
});

test("an act started at load, its character removed while it works: nothing is logged", async () => {
  const d = createDriver(withBo(), { size: { w: 1280, h: 800, dpr: 1 } });
  d.startActs();
  run(d, 500);
  expect(d.sim.characters()).toContain("bo");
  const errors = await logged(() => { d.apply(quiet); run(d, 500); });
  expect(d.sim.characters()).not.toContain("bo");
  expect(errors).toEqual([]);
});

test("a doc act refused for another reason is still logged", async () => {
  const d = createDriver(quiet, { size: { w: 1280, h: 800, dpr: 1 } });
  d.sim.act("ada", { do: "sit", target: "chair-2" });
  run(d, 500);
  const errors = await logged(() => { d.apply(withBo()); run(d, 100); });
  expect(errors.length).toBe(1);
  expect(String(errors[0][0])).toContain("@hq/world");
});
