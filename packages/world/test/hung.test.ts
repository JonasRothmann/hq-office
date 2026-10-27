// A piece tagged "wall" hangs on the wall behind it: hangsOnCut says when that wall is cut, so the view hides it
// instead of leaving it floating over a kerb. Untagged pieces and pieces on walls that stay up are never hidden.
import { describe, expect, test } from "bun:test";
import { buildLot, cutaway, hangsOnCut, definePack, defineObject, defineWorld, rect } from "@hq/world/model";
import starter from "@hq/world/packs/starter";
import { planBatches, hungOn, shows } from "../src/view/batches.js";

const pack = definePack({ id: "hang", objects: [
  defineObject({ id: "print", footprint: [1, 1], height: 2, blocks: false, tags: ["decor", "wall"], build(k: any) { k.box("p", [0.4, 0.5, 0.02], [0, 1.3, -0.41], "paper"); } }),
  defineObject({ id: "stool", footprint: [1, 1], height: 0.5, tags: ["seat"], build(k: any) { k.box("s", [0.3, 0.45, 0.3], [0, 0, 0], "wood"); } }),
] });
// one room, 1..6 × 1..5: a print on the north wall (it faces s), one on the south wall (it faces n), a stool by the south wall
const world = defineWorld({
  format: 1, id: "hung", packs: [starter, pack], lot: { w: 8, d: 7 },
  floors: [{ rect: [1, 1, 6, 5], finish: "starter/oak" }],
  walls: [{ path: rect(1, 1, 6, 5), finish: "starter/plaster", outside: "starter/siding" }],
  openings: [{ type: "starter/door", at: [5, 5], side: "s" }],
  objects: [
    { id: "north", type: "hang/print", at: [3, 1], facing: "s" },
    { id: "south", type: "hang/print", at: [3, 5], facing: "n" },
    { id: "stool", type: "hang/stool", at: [2, 5], facing: "n" },
  ],
});

describe("pieces on cut walls", () => {
  const { lot } = buildLot(world);
  const obj = (id: string) => lot.objects.find((o: any) => o.id === id);

  test("from the default view the south wall is cut and the north one stays: only the south print hides", () => {
    const cut = cutaway(lot, { mode: "cutaway", rot: 0 });
    expect([hangsOnCut(obj("north"), cut), hangsOnCut(obj("south"), cut), hangsOnCut(obj("stool"), cut)]).toEqual([false, true, false]);
  });

  test("turned half way round, the other print hides; walls up hide nothing, walls down hide both", () => {
    const back = cutaway(lot, { mode: "cutaway", rot: 2 });
    expect([hangsOnCut(obj("north"), back), hangsOnCut(obj("south"), back)]).toEqual([true, false]);
    const up = cutaway(lot, { mode: "up" }), down = cutaway(lot, { mode: "down" });
    expect([hangsOnCut(obj("north"), up), hangsOnCut(obj("south"), up)]).toEqual([false, false]);
    expect([hangsOnCut(obj("north"), down), hangsOnCut(obj("south"), down), hangsOnCut(obj("stool"), down)]).toEqual([true, true, false]);
  });

  test("batched prints: a cut hides the instance, and hover never shows a print hidden by a cut", () => {
    const plan = planBatches(lot.objects);
    expect(plan.batches.get("hang/print")).toEqual(["north", "south"]); // two copies: one batch
    const hung = hungOn(lot.objects, cutaway(lot, { mode: "cutaway", rot: 0 }));
    expect([...hung]).toEqual(["south"]);
    const all = (hovered: string | null) => ["north", "south", "stool"].map((id) => shows(id, { hung, hovered }));
    expect(all(null)).toEqual(["instance", "none", "instance"]);
    expect(all("north")).toEqual(["body", "none", "instance"]); // hover lifts the north print out of its batch
    expect(all("south")).toEqual(["instance", "none", "instance"]); // the cut wins: nothing to lift
    // turned round, the cut moves to the north wall: the hovered south print comes back as its own body
    const back = hungOn(lot.objects, cutaway(lot, { mode: "cutaway", rot: 2 }));
    expect(["north", "south"].map((id) => shows(id, { hung: back, hovered: "south" }))).toEqual(["none", "body"]);
  });
});
