// Edits at run time against the sim's live state: a floor edit moves the objects that stand on it, a failed replan
// never leaves a character inside an object, a seat freed by a removal is free at once, held seats survive a save,
// and a save loaded into a lot that lost the held object lets go of it.
import { expect, test } from "bun:test";
import { fromJSON, createSim, createNav, buildLot } from "@hq/world/model";
import { createDriver } from "../src/view/driver.js";
import house from "./fixtures/house.world.js";

const STEP = 1000 / 60;
const edit = (world: any, fn: (d: any) => void) => { const d = structuredClone(world.doc); fn(d); return fromJSON(d, world.packs); };
const quiet = edit(house, (d) => { d.acts = []; });
const two = edit(quiet, (d) => { d.characters.push({ id: "bo", at: [10, 7], facing: "w" }); });
let clock = 0;
const run = (d: any, ms: number) => { for (let t = 0; t < ms; t += STEP) d.tick((clock += STEP), STEP); };
const mk = (w: any = two) => { const d = createDriver(w, { size: { w: 1280, h: 800, dpr: 1 } }); run(d, 20); return d; };

test("a floor change under an unchanged object changes its height, and the diff names it so it is rebuilt", () => {
  const d = mk();
  const before = d.lot.objects.find((o: any) => o.id === "plant-1").pos[1];
  const diff = d.apply(edit(two, (doc) => { doc.floors = [{ rect: [3, 2, 9, 7], finish: "starter/oak" }]; }));
  const after = d.lot.objects.find((o: any) => o.id === "plant-1").pos[1];
  expect(after).not.toBe(before);
  expect([...diff.objects.added, ...diff.objects.changed]).toContain("plant-1");
  expect(diff.objects.changed).not.toContain("desk-1"); // still on the floor: nothing to rebuild
});

test("an edit that moves an object onto another names the one it moved, though it is listed first", () => {
  const d = mk();
  expect(() => d.apply(edit(two, (doc) => { doc.objects.find((o: any) => o.id === "desk-1").at = [9, 4]; }))).toThrow(/starter\/desk 'desk-1', which this edit moved or added, covers tile \(10,4\), already used by starter\/chair 'chair-2'/);
});

test("seated, her chair becomes a plant (same id): the replan fails and she steps off the plant", () => {
  const d = mk();
  d.sim.act("ada", { do: "sit", target: "chair-1" }).catch(() => {});
  run(d, 9000);
  expect(d.sim.character("ada").clip).toBe("sit");
  const events: any[] = []; d.sim.on((n: string, x: any) => events.push([n, x?.who, x?.problem?.code]));
  d.apply(edit(two, (doc) => { doc.objects.find((o: any) => o.id === "chair-1").type = "starter/plant"; }));
  run(d, 5000);
  const c = d.sim.character("ada");
  expect(events).toContainEqual(["cancel", "ada", "act.slot"]);
  expect(d.nav.walkable(Math.floor(c.x), Math.floor(c.z))).toBe(true);
});

test("two characters: a visit holds its then-seat from the start; Bo is refused; saved mid-wait and loaded, the hold and the then-step survive", async () => {
  const lot = buildLot(two).lot, nav = createNav(lot);
  const a = createSim(lot, nav);
  a.act("ada", { do: "visit", target: "chair-3", wait: 2, then: { do: "sit", target: "chair-1", clip: "type" } }).catch(() => {});
  for (let i = 0; i < 60; i++) a.step(1 / 60);
  expect(a.holder("chair-1", "seat")).toBe("ada");
  await expect(a.act("bo", { do: "sit", target: "chair-1" })).rejects.toThrow(/held by ada/);
  for (let i = 0; i < 60 * 4; i++) a.step(1 / 60);
  const saved = JSON.parse(JSON.stringify(a.ecs.toJSON()));
  const b = createSim(lot, nav);
  b.ecs.load(saved);
  expect(b.holder("chair-1", "seat")).toBe("ada");
  await expect(b.act("bo", { do: "sit", target: "chair-1" })).rejects.toThrow(/held by ada/);
  b.act("bo", { do: "sit", target: "chair-2" }).catch(() => {});
  a.act("bo", { do: "sit", target: "chair-2" }).catch(() => {});
  for (let i = 0; i < 60 * 15; i++) { a.step(1 / 60); b.step(1 / 60); }
  expect(b.character("ada")).toEqual(a.character("ada"));
  expect(b.character("ada")).toMatchObject({ clip: "type" });
  expect(b.character("bo")).toEqual(a.character("bo"));
  expect(b.holder("chair-2", "seat")).toBe("bo");
});

test("a character removed while holding a seat: the seat is free for the other at once", async () => {
  const d = mk();
  d.sim.act("ada", { do: "sit", target: "chair-1" }).catch(() => {});
  run(d, 1000);
  d.apply(edit(two, (doc) => { doc.characters = doc.characters.filter((c: any) => c.id !== "ada"); }));
  expect(d.sim.holder("chair-1", "seat")).toBeNull();
  const p = d.sim.act("bo", { do: "sit", target: "chair-1" });
  run(d, 15000);
  await p;
  expect(d.sim.character("bo").clip).toBe("sit");
});

test("ecs.load into a sim whose lot lost the object the save holds: the hold is released and she stands up on a free tile", () => {
  const lot = buildLot(two).lot, nav = createNav(lot);
  const a = createSim(lot, nav);
  a.act("ada", { do: "sit", target: "chair-1" }).catch(() => {});
  for (let i = 0; i < 60 * 9; i++) a.step(1 / 60);
  expect(a.character("ada")).toMatchObject({ clip: "sit", step: "loop" });
  const saved = a.ecs.toJSON();
  const lot2 = buildLot(edit(two, (doc) => { doc.objects = doc.objects.filter((o: any) => o.id !== "chair-1"); })).lot;
  const nav2 = createNav(lot2);
  const b = createSim(lot2, nav2);
  const events: any[] = []; b.on((n: string, x: any) => events.push([n, x?.who, x?.problem?.code]));
  b.ecs.load(saved);
  expect(b.ecs.get("ada", "holding")).toBeUndefined();
  expect(events).toContainEqual(["cancel", "ada", "act.target"]);
  for (let i = 0; i < 60 * 10; i++) b.step(1 / 60);
  expect(b.ecs.disabled()).toEqual([]);
  const c = b.character("ada");
  expect(c.hips).toBeGreaterThan(0.6); // standing
  expect(nav2.walkable(Math.floor(c.x), Math.floor(c.z))).toBe(true);
});
