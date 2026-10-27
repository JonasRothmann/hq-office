// The 3D office's plan (src/client/world/plan.js): one office per lane, the four growth stages, rooms that never
// overlap, a door from every office to a corridor, the cutaway per rotation, and offices that keep their places.
import { describe, expect, test } from "bun:test";
import { plan, wallCuts, stageFor } from "../../src/client/world/plan.js";

const lanesOf = (n: number, extra: Record<string, unknown> = {}) => [
  { name: "hq" },
  ...Array.from({ length: n }, (_, i) => ({ name: `l${i}`, parent: n > 8 && i % 5 ? `l${i - (i % 5)}` : null, ...extra })),
];

describe("world plan", () => {
  for (const [n, stage] of [[1, "studio"], [4, "floor"], [9, "wings"], [18, "campus"]] as const) {
    test(`${n} lanes: the ${stage} stage, one office each, nothing overlapping`, () => {
      const p = plan(lanesOf(n));
      expect(p.stageName).toBe(stage);
      expect(p.offices.map((o: any) => o.lane).sort()).toEqual(Array.from({ length: n }, (_, i) => `l${i}`).sort());
      expect(p.hq).toBeTruthy();
      const seen = new Map<string, string>();
      for (const r of p.rooms) for (let x = r.x; x < r.x + r.w; x++) for (let z = r.z; z < r.z + r.d; z++) {
        const k = `${x},${z}`;
        expect({ tile: k, by: seen.get(k) ?? null, now: r.id }).toEqual({ tile: k, by: null, now: r.id });
        seen.set(k, r.id);
      }
    });

    test(`${n} lanes: every office has a door onto a corridor`, () => {
      const p = plan(lanesOf(n));
      const byId = new Map(p.rooms.map((r: any) => [r.id, r]));
      for (const o of p.offices) {
        const doors = p.walls.filter((w: any) => w.door && (w.a === o.id || w.b === o.id));
        expect(doors.length).toBeGreaterThan(0);
        for (const d of doors) expect((byId.get(d.a === o.id ? d.b : d.a) as any)?.kind).toBe("corridor");
      }
    });
  }

  test("stages follow the lane count", () => {
    expect([0, 1, 3, 4, 8, 9, 16, 17, 30].map(stageFor)).toEqual([1, 1, 1, 2, 2, 3, 3, 4, 4]);
  });

  test("cutaway: each office's near walls drop, the back walls of the back row stand, and a turn moves the cut", () => {
    const p = plan(lanesOf(3));
    const at0 = wallCuts(p, 0), at2 = wallCuts(p, 2);
    for (const o of p.offices) {
      const walls = p.walls.map((w: any, i: number) => ({ w, i })).filter(({ w }: any) => w.a === o.id || w.b === o.id);
      // the camera is to the south-east at rotation 0: the south (front) wall is cut, the north (back) wall stands
      const south = walls.filter(({ w }: any) => w.dir === "x" && w.z === o.z + o.d);
      const north = walls.filter(({ w }: any) => w.dir === "x" && w.z === o.z);
      expect(south.every(({ i }: any) => at0[i])).toBe(true);
      expect(north.every(({ i }: any) => !at0[i])).toBe(true);
      // seen from the north-west, the back wall is the near wall
      expect(north.every(({ i }: any) => at2[i])).toBe(true);
    }
  });

  test("a full wall never stands right in front of a room", () => {
    for (const n of [1, 4, 9, 18]) {
      const p = plan(lanesOf(n));
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

  test("places are stable within a stage: a new lane is added, a removed one leaves its office empty", () => {
    const p1 = plan(lanesOf(5));
    const p2 = plan([...lanesOf(5), { name: "late" }], p1);
    const where = (p: any) => Object.fromEntries(p.offices.map((o: any) => [o.lane, `${o.x},${o.z}`]));
    const w1 = where(p1), w2 = where(p2);
    for (const k of Object.keys(w1)) expect(w2[k]).toBe(w1[k]);
    expect(w2.late).toBeTruthy();
    const p3 = plan(lanesOf(5).filter((l) => l.name !== "l2"), p2);
    expect(p3.offices.find((o: any) => o.lane === "l2")?.vacant).toBe(true);
    expect(where(p3).l3).toBe(w1.l3);
  });

  test("a stage change lays the plan out again from the live lanes only", () => {
    const p1 = plan(lanesOf(8));
    const p2 = plan(lanesOf(9), p1);
    expect(p2.stageName).toBe("wings");
    expect(p2.offices.every((o: any) => !o.vacant)).toBe(true);
  });

  test("past eight lanes, a team gets its own wing", () => {
    const p = plan(lanesOf(10));
    const wingOf = new Map<string, number>();
    for (const o of p.offices) wingOf.set(o.lane, o.z);
    expect(wingOf.get("l1")).toBe(wingOf.get("l0"));
    expect(wingOf.get("l6")).toBe(wingOf.get("l5"));
    expect(wingOf.get("l5")).not.toBe(wingOf.get("l0"));
  });
});
