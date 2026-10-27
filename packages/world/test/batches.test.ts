// Batches, headless: the objects of one type with two or more copies draw as one batch, in lot order; a type with
// one copy, or one that says instance: false, draws object by object; an edit redraws only the types it touched,
// before and after (an object that moves to another type, a type that drops to one copy or grows to two).
import { describe, expect, test } from "bun:test";
import { fromJSON, buildLot } from "@hq/world/model";
import { planBatches, staleTypes, typesOf, MIN_COPIES } from "../src/view/batches.js";
import house from "./fixtures/house.world.js";

const obj = (id: string, type: string, def: any = {}) => ({ id, type, def });

describe("batches", () => {
  test("a type with two or more copies is one batch in lot order; the rest draw on their own", () => {
    expect(MIN_COPIES).toBe(2);
    const plan = planBatches([obj("d1", "desk"), obj("c1", "chair"), obj("d2", "desk"), obj("lamp", "lamp"), obj("d3", "desk"), obj("c2", "chair")]);
    expect([...plan.batches]).toEqual([["desk", ["d1", "d2", "d3"]], ["chair", ["c1", "c2"]]]);
    expect([...plan.single]).toEqual([["lamp", ["lamp"]]]);
    expect(typesOf(plan).sort()).toEqual(["chair", "desk", "lamp"]);
  });

  test("instance: false draws every copy on its own", () => {
    const plan = planBatches([obj("s1", "screen", { instance: false }), obj("s2", "screen", { instance: false })]);
    expect(plan.batches.size).toBe(0);
    expect(plan.single.get("screen")).toEqual(["s1", "s2"]);
  });

  test("an edit redraws the types it touched, before and after, and nothing else", () => {
    const before = planBatches([obj("d1", "desk"), obj("d2", "desk"), obj("c1", "chair"), obj("c2", "chair"), obj("p1", "plant")]);
    // d2 leaves, c2 becomes a plant: desk drops to one copy, plant grows to two; nothing touched the chair c1
    const after = planBatches([obj("d1", "desk"), obj("c1", "chair"), obj("c2", "plant"), obj("p1", "plant")]);
    expect([...staleTypes(before, after, ["d2", "c2"])].sort()).toEqual(["chair", "desk", "plant"]);
    expect(after.single.get("desk")).toEqual(["d1"]);
    expect(after.batches.get("plant")).toEqual(["c2", "p1"]);
    expect([...staleTypes(before, before, [])]).toEqual([]);
    expect([...staleTypes(before, after, ["nobody"])]).toEqual([]);
  });

  test("the test house: its chairs are one batch, and moving one redraws only the chairs", () => {
    const { lot } = buildLot(house);
    const plan = planBatches(lot.objects);
    expect(plan.batches.get("starter/chair")).toEqual(lot.objects.filter((o: any) => o.type === "starter/chair").map((o: any) => o.id));
    const doc = structuredClone(house.doc);
    const moved = doc.objects.find((o: any) => o.type === "starter/chair");
    moved.facing = moved.facing === "n" ? "s" : "n";
    const next = planBatches(buildLot(fromJSON(doc, house.packs)).lot.objects);
    expect([...staleTypes(plan, next, [moved.id])]).toEqual(["starter/chair"]);
  });
});
