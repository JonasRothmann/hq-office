// Nav: paths go through doors and never through walls, windows or blocking objects; every room of the tiny house is
// reachable from every other; a slot is held by one character at a time; a sit act walks, turns, sits down and loops.
import { describe, expect, test } from "bun:test";
import { buildLot, createNav, planAct, tileKey } from "@hq/world/model";
import tiny from "../examples/tiny-house.world.js";

const { lot } = buildLot(tiny);

describe("nav", () => {
  test("a path between the rooms crosses the wall at the door, and only there", () => {
    const nav = createNav(lot);
    const p = nav.path([9, 7], [[3, 7]])!;
    expect(p).not.toBeNull();
    const crossings = p.slice(1).map((t, i) => [p[i], t]).filter(([a, b]) => (a[0] < 7) !== (b[0] < 7));
    expect(crossings).toEqual([[[7, 5], [6, 5]]]);
  });

  test("no step crosses a wall without a door, or enters a blocked tile", () => {
    const nav = createNav(lot);
    expect(nav.canStep(7, 3, 6, 3)).toBe(false); // the inner wall
    expect(nav.canStep(4, 2, 4, 1)).toBe(false); // a window
    expect(nav.canStep(4, 8, 4, 9)).toBe(true);  // the front door
    expect(nav.canStep(4, 4, 4, 3)).toBe(false); // into the desk
    expect(nav.canStep(7, 6, 6, 5)).toBe(false); // diagonally through the door frame
  });

  test("every room is reachable from every other, and from outdoors", () => {
    const nav = createNav(lot);
    const free = (r: any) => r.tiles.find(([x, z]: number[]) => nav.walkable(x, z));
    const spaces = [...lot.rooms.map(free), [0, 0]];
    for (const a of spaces) for (const b of spaces) expect({ a, b, ok: !!nav.path(a, [b]) }).toEqual({ a, b, ok: true });
  });

  test("a slot is held by one character at a time", () => {
    const nav = createNav(lot);
    expect(nav.reserve("chair-1", "seat", "ada")).toBe(true);
    expect(nav.reserve("chair-1", "seat", "bo")).toBe(false);
    expect(planAct(lot, nav, { id: "bo", tile: [9, 7] }, { do: "sit", target: "chair-1" }).problem?.code).toBe("act.taken");
    nav.release("chair-1", "seat", "ada");
    expect(nav.reserve("chair-1", "seat", "bo")).toBe(true);
  });

  test("sitting on chair-1: walk to a free side tile, turn to face the desk, sit down, loop", () => {
    const nav = createNav(lot);
    const r = planAct(lot, nav, { id: "ada", tile: [9, 7] }, { do: "sit", target: "chair-1" });
    expect(r.steps!.map((s: any) => s.kind)).toEqual(["walk", "turn", "enter", "loop"]);
    const walk = r.steps![0] as any;
    expect(walk.points[0]).toEqual([9.5, 7.5]);
    expect(walk.points.at(-1)).toEqual([4.5, 4.5]); // the chair's side tile: its front is the desk
    expect(r.steps![1]).toEqual({ kind: "turn", facing: "n" });
    expect((r.steps![2] as any).clip).toBe("sit-down");
    expect(lot.blocked.has(tileKey(3, 3))).toBe(true);
  });
});
