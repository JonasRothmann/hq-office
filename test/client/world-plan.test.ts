// The 3D office's plan (src/client/world/plan.js): team rooms of up to four desks, one desk per lane, teams sharing a
// room and opening a second one past four, the four growth stages counted in rooms, rooms that never overlap, a door
// from every room to a corridor, the cutaway per rotation, and desks that keep their places.
import { describe, expect, test } from "bun:test";
import { plan, wallCuts, stageFor, DESKS, SEATS } from "../../src/client/world/plan.js";

// n lanes with no tree: every lane directly under HQ.
const loose = (n: number, prefix = "l") => [{ name: "hq" }, ...Array.from({ length: n }, (_, i) => ({ name: `${prefix}${i}`, parent: "hq" }))];
// teams of the given sizes: t0 leads t0-1, t0-2, ...; one of them (t0-2) a level further down the tree.
const teams = (...sizes: number[]) => [
  { name: "hq" },
  ...sizes.flatMap((size, t) => Array.from({ length: size }, (_, i) => ({ name: i ? `t${t}-${i}` : `t${t}`, parent: i === 0 ? "hq" : i === 2 ? `t${t}-1` : `t${t}` }))),
];
const roomOf = (p: any, lane: string) => p.desks.find((d: any) => d.lane === lane && !d.vacant)?.room;
const live = (p: any) => p.desks.filter((d: any) => !d.vacant).map((d: any) => d.lane);

describe("world plan", () => {
  for (const [n, stage, rooms] of [[1, "studio", 1], [4, "studio", 1], [5, "floor", 2], [9, "floor", 3], [16, "floor", 4], [18, "wings", 5], [33, "campus", 9]] as const) {
    test(`${n} lanes with no tree: ${rooms} rooms of four, the ${stage} stage, one desk each, nothing overlapping`, () => {
      const p = plan(loose(n));
      expect(p.stageName).toBe(stage);
      expect(p.teamRooms.length).toBe(rooms);
      expect(live(p).sort()).toEqual(Array.from({ length: n }, (_, i) => `l${i}`).sort());
      // filled in the order they appear: l0-l3 in the first room, l4 in the second
      expect(p.teamRooms[0].lanes).toEqual(["l0", "l1", "l2", "l3"].slice(0, n));
      for (const r of p.teamRooms) expect(r.seats.length).toBeLessThanOrEqual(SEATS);
      expect(p.hq).toBeTruthy();
      expect(!!p.rooms.find((r: any) => r.kind === "break")).toBe(rooms > 1);
      const seen = new Map<string, string>();
      for (const r of p.rooms) for (let x = r.x; x < r.x + r.w; x++) for (let z = r.z; z < r.z + r.d; z++) {
        const k = `${x},${z}`;
        expect({ tile: k, by: seen.get(k) ?? null, now: r.id }).toEqual({ tile: k, by: null, now: r.id });
        seen.set(k, r.id);
      }
    });

    test(`${n} lanes: every room has a door onto a corridor`, () => {
      const p = plan(loose(n));
      const byId = new Map(p.rooms.map((r: any) => [r.id, r]));
      for (const o of [...p.teamRooms, p.hq]) {
        const doors = p.walls.filter((w: any) => w.door && (w.a === o.id || w.b === o.id));
        expect(doors.length).toBeGreaterThan(0);
        for (const d of doors) expect((byId.get(d.a === o.id ? d.b : d.a) as any)?.kind).toBe("corridor");
      }
    });
  }

  test("stages follow the number of team rooms", () => {
    expect([0, 1, 2, 4, 5, 8, 9, 20].map(stageFor)).toEqual([1, 1, 2, 2, 3, 3, 4, 4]);
  });

  test("the four desks of a room stand inside it as two facing pairs", () => {
    expect(DESKS.length).toBe(SEATS);
    const p = plan(loose(4));
    const r = p.teamRooms[0];
    for (const d of DESKS) {
      expect(d.x).toBeGreaterThan(1);
      expect(d.x).toBeLessThan(r.w - 1);
      expect(d.z).toBeGreaterThan(1);
      expect(d.z).toBeLessThan(r.d - 1);
    }
    // the back pair faces the front pair across the island
    expect(DESKS.filter((d) => d.ry === 0).length).toBe(2);
    expect(DESKS.filter((d) => d.ry === Math.PI).length).toBe(2);
  });

  test("a team shares a room; a team of six opens a second room next to its first", () => {
    const p = plan(teams(6, 2, 3));
    const r = p.teamRooms;
    expect(r.map((x: any) => [x.team, x.lanes.length])).toEqual([["t0", 4], ["t0", 2], ["t1", 2], ["t2", 3]]);
    // the second room of t0 stands right beside its first
    const [a, b] = r;
    expect(Math.abs(a.x - b.x) + Math.abs(a.z - b.z)).toBe(7);
    // a lane two levels down sits with its team
    expect(r[0].lanes).toContain("t0-2");
    expect(roomOf(p, "t1-1")).toBe(roomOf(p, "t1"));
    expect(roomOf(p, "t2-2")).toBe(roomOf(p, "t2"));
    expect(roomOf(p, "t1")).not.toBe(roomOf(p, "t2"));
  });

  test("lanes on their own share rooms of four, apart from the teams", () => {
    const lanes = [...teams(3), { name: "solo-a", parent: "hq" }, { name: "solo-b", parent: null }, { name: "solo-c" }];
    const p = plan(lanes);
    expect(p.teamRooms.map((r: any) => [r.team, r.lanes])).toEqual([["t0", ["t0", "t0-1", "t0-2"]], [null, ["solo-a", "solo-b", "solo-c"]]]);
  });

  test("cutaway: each room's near walls drop, the back walls of the back row stand, and a turn moves the cut", () => {
    for (const n of [1, 4]) {
      const p = plan(loose(n));
      const at0 = wallCuts(p, 0), at2 = wallCuts(p, 2);
      for (const o of p.teamRooms) {
        const walls = p.walls.map((w: any, i: number) => ({ w, i })).filter(({ w }: any) => w.a === o.id || w.b === o.id);
        // the camera is to the south-east at rotation 0: the south (front) wall is cut, the north (back) wall stands
        const south = walls.filter(({ w }: any) => w.dir === "x" && w.z === o.z + o.d);
        const north = walls.filter(({ w }: any) => w.dir === "x" && w.z === o.z);
        expect(south.every(({ i }: any) => at0[i])).toBe(true);
        expect(north.every(({ i }: any) => !at0[i])).toBe(true);
        // seen from the north-west, the back wall is the near wall
        expect(north.every(({ i }: any) => at2[i])).toBe(true);
      }
    }
  });

  test("a full wall never stands right in front of a room", () => {
    for (const n of [1, 4, 9, 18, 33]) {
      const p = plan(loose(n));
      for (let rot = 0; rot < 4; rot++) {
        const cuts = wallCuts(p, rot);
        const sx = [1, 1, -1, -1][rot], sz = [1, -1, -1, 1][rot];
        p.walls.forEach((w: any, i: number) => {
          // the room on the side away from the camera
          const far = w.dir === "x" ? (sz > 0 ? w.a : w.b) : (sx > 0 ? w.a : w.b);
          if (far) expect({ n, rot, w, cut: cuts[i] }).toEqual({ n, rot, w, cut: true });
        });
      }
    }
  });

  test("desks are stable within a stage: a new lane takes a free desk, a removed one leaves its desk empty", () => {
    const where = (p: any) => Object.fromEntries(p.desks.filter((d: any) => !d.vacant).map((d: any) => [d.lane, `${d.room}:${d.seat}`]));
    const p1 = plan(loose(6));
    const p2 = plan([...loose(6), { name: "late", parent: "hq" }], p1);
    const w1 = where(p1), w2 = where(p2);
    for (const k of Object.keys(w1)) expect(w2[k]).toBe(w1[k]);
    expect(w2.late).toBe("room:1:2"); // the next free desk in the second room
    // l2 leaves: its desk empties, nobody moves
    const p3 = plan([...loose(6), { name: "late", parent: "hq" }].filter((l) => l.name !== "l2"), p2);
    expect(p3.desks.find((d: any) => d.lane === "l2")?.vacant).toBe(true);
    for (const k of Object.keys(w2)) if (k !== "l2") expect(where(p3)[k]).toBe(w2[k]);
    // a newcomer takes the empty desk; l2 coming back later finds another
    const p4 = plan([...loose(6).filter((l) => l.name !== "l2"), { name: "late", parent: "hq" }, { name: "next", parent: "hq" }], p3);
    expect(where(p4).next).toBe(w2.l2);
  });

  test("a lane that comes back takes its old desk again", () => {
    const p1 = plan(loose(6));
    const p2 = plan(loose(6).filter((l) => l.name !== "l1"), p1);
    const p3 = plan(loose(6), p2);
    expect(roomOf(p3, "l1")).toBe(roomOf(p1, "l1"));
    expect(p3.desks.find((d: any) => d.lane === "l1").seat).toBe(p1.desks.find((d: any) => d.lane === "l1").seat);
  });

  test("a new team member sits with its team, or opens its team a room next to it", () => {
    const p1 = plan(teams(4, 2));
    const p2 = plan([...teams(4, 2), { name: "t1-new", parent: "t1" }], p1);
    expect(roomOf(p2, "t1-new")).toBe(roomOf(p1, "t1"));
    // t0 is full: a fifth member opens a room, and nobody else moves
    const p3 = plan([...teams(4, 2), { name: "t1-new", parent: "t1" }, { name: "t0-new", parent: "t0" }], p2);
    expect(roomOf(p3, "t0-new")).not.toBe(roomOf(p3, "t0"));
    expect(p3.teamRooms.find((r: any) => r.id === roomOf(p3, "t0-new")).team).toBe("t0");
    for (const l of ["t0", "t0-1", "t1", "t1-1", "t1-new"]) expect(roomOf(p3, l)).toBe(roomOf(p2, l));
  });

  test("a stage change lays the plan out again from the live lanes only", () => {
    const p1 = plan(loose(4));
    expect(p1.stageName).toBe("studio");
    const p2 = plan(loose(5), p1);
    expect(p2.stageName).toBe("floor");
    const p3 = plan(loose(17), p2);
    const p4 = plan(loose(3), p3);
    expect(p4.stageName).toBe("studio");
    expect(p4.desks.every((d: any) => !d.vacant)).toBe(true);
  });

  test("past four rooms, rooms line up in wings off a central hall", () => {
    const p = plan(loose(18));
    expect(p.stageName).toBe("wings");
    const rows = new Set(p.teamRooms.map((r: any) => r.z));
    expect(rows.size).toBe(2); // four rooms in the first wing, one in the next
  });
});
