// A doc's character `at` is the spawn tile only: once the character exists, an edit is not checked against it. A doc
// act refused at run time tells the host why, with a `cancel` event.
import { expect, test } from "bun:test";
import { fromJSON } from "@hq/world/model";
import { createDriver } from "../src/view/driver.js";
import house from "./fixtures/house.world.js";

const STEP = 1000 / 60;
const edit = (world: any, fn: (d: any) => void) => { const d = structuredClone(world.doc); fn(d); return fromJSON(d, world.packs); };
const two = edit(house, (d) => { d.acts = []; d.characters.push({ id: "bo", at: [10, 7], facing: "w" }); });
let clock = 0;
const run = (d: any, ms: number) => { for (let t = 0; t < ms; t += STEP) d.tick((clock += STEP), STEP); };

test("an object on Ada's doc `at` tile after she left it: the edit is accepted", () => {
  const d = createDriver(two, { size: { w: 1280, h: 800, dpr: 1 } });
  d.sim.act("ada", { do: "sit", target: "chair-1" }); run(d, 9000);
  let err: any = null;
  try { d.apply(edit(two, (doc) => { doc.objects.push({ id: "plant-9", type: "starter/plant", at: [9, 7], facing: "s" }); })); } catch (e: any) { err = e; }
  expect(err).toBeNull();
});

test("a doc act that is refused at run time (seat held by a host act): the host gets a cancel event with the reason", async () => {
  const events: any[] = [];
  const d = createDriver(two, { size: { w: 1280, h: 800, dpr: 1 }, emit: (n: string, x: any) => events.push([n, x?.who, x?.problem?.code]) });
  d.sim.act("ada", { do: "sit", target: "chair-2" }); run(d, 500);
  const orig = console.error; console.error = () => {};
  try {
    d.apply(edit(two, (doc) => { doc.acts.push({ who: "bo", do: "sit", target: "chair-2" }); }));
    await Promise.resolve(); await Promise.resolve();
  } finally { console.error = orig; }
  expect(events).toContainEqual(["cancel", "bo", "act.taken"]);
});
