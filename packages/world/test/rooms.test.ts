// Room detection: enclosed areas are rooms (doors and windows still enclose), a gap in a wall joins a room to the
// outdoors, labels name rooms, and the tiny house has exactly its two rooms.
import { describe, expect, test } from "bun:test";
import { detectRooms, rect, buildLot } from "@hq/world/model";
import tiny from "./fixtures/house.world.js";

const doc = (walls: any[], rooms: any[] = []) => ({ lot: { w: 10, d: 8 }, walls, rooms });

describe("rooms", () => {
  test("a closed rectangle is one room; everything else is outdoors", () => {
    const { rooms, at } = detectRooms(doc([{ path: rect(2, 2, 4, 3) }]));
    expect(rooms.map((r) => [r.id, r.tiles.length])).toEqual([["room:2,2", 12]]);
    expect(at.get("0,0")).toBe("outside");
    expect(at.get("3,3")).toBe("room:2,2");
  });

  test("an inner wall splits it in two", () => {
    const { rooms } = detectRooms(doc([{ path: rect(2, 2, 4, 3) }, { path: [[4, 2], [4, 5]] }]));
    expect(rooms.map((r) => [r.id, r.tiles.length, r.bounds])).toEqual([
      ["room:2,2", 6, { x: 2, z: 2, w: 2, d: 3 }],
      ["room:4,2", 6, { x: 4, z: 2, w: 2, d: 3 }],
    ]);
  });

  test("a missing wall edge joins the room to the outdoors", () => {
    const path = rect(2, 2, 4, 3);
    // leave out the edge from (6,3) to (6,4): walk the rect as two paths round the gap
    const { rooms } = detectRooms(doc([{ path: [[6, 3], [6, 2], [2, 2], [2, 5], [6, 5], [6, 4]] }]));
    expect(path.length).toBe(5);
    expect(rooms).toEqual([]);
  });

  test("a room walled along the lot's border is still a room", () => {
    const { rooms } = detectRooms(doc([{ path: rect(0, 0, 3, 3) }]));
    expect(rooms.map((r) => r.id)).toEqual(["room:0,0"]);
  });

  test("labels rename rooms", () => {
    const { rooms, at } = detectRooms(doc([{ path: rect(2, 2, 4, 3) }, { path: [[4, 2], [4, 5]] }], [{ at: [5, 4], id: "east", name: "East" }]));
    expect(rooms.map((r) => r.id)).toEqual(["room:2,2", "east"]);
    expect(at.get("4,2")).toBe("east");
  });

  test("the tiny house has a study and a lounge of 35 tiles each", () => {
    const { lot } = buildLot(tiny);
    expect(lot.rooms.map((r) => [r.id, r.tiles.length])).toEqual([["study", 35], ["lounge", 35]]);
  });
});
