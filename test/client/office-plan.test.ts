// The office as a world doc (src/client/office/plan.js): every doc for 1 to 24 lanes, in loose rooms or uneven teams,
// passes validateWorld (every room reachable, every act possible) and the coplanar lint in every view; each lane has a
// desk, a chair and a worker with stable ids; the act per status is a table; and as lanes come and go, the doc
// changes only where the layout did, so world.apply(next) rebuilds only that. Under it, the layout itself
// (src/client/office/layout.js): team rooms of up to four desks, teams sharing a room and opening a second one past
// four, the four growth stages counted in rooms, rooms that never overlap, a door from every room to a corridor, and
// desks that keep their places.
import { describe, expect, test } from "bun:test";
import { fromJSON, validateWorld, formatProblems, buildLot, diffWorld, cutaway, lotPrims, lintCoplanar, lintViews, describePairs, defineObject, WALL_MODES, WALL_T, FLOOR_Y, CLIPS } from "@hq/world/model";
import japandi from "../../src/client/office/japandi/index.js";
import { officeDoc, deskId, chairId, workerId } from "../../src/client/office/plan.js";
import { STATUS_ACTS, actFor, rowOf } from "../../src/client/office/acts.js";
import { FOOT } from "../../src/client/office/furnish.js";
import { plan, stageFor, SEATS } from "../../src/client/office/layout.js";

const PACKS = [japandi];
const STATUSES = ["moving", "needs_you", "blocked", "with_lead", "hq_turn", "waiting", "stale", "done", "parked", "gone"];
type Lane = { name: string; parent?: string | null; status?: string };
// A lane's status, fixed by its name, so a lane keeps its status while others come and go.
const statusOf = (name: string) => STATUSES[[...name].reduce((s, c) => s + c.charCodeAt(0), 0) % STATUSES.length];
const lane = (name: string, parent: string | null = "hq"): Lane => ({ name, parent, status: statusOf(name) });
const loose = (n: number, prefix = "l") => Array.from({ length: n }, (_, i) => lane(`${prefix}${i}`));
// a team: its lead under HQ, the rest under the lead, one of them a level further down
const team = (t: string, size: number) => Array.from({ length: size }, (_, i) => lane(i ? `${t}-${i}` : t, i === 0 ? "hq" : i === 2 ? `${t}-1` : t));
const withHq = (lanes: Lane[]) => [{ name: "hq", status: "moving" }, ...lanes];

const worldOf = (doc: any) => fromJSON(doc, PACKS);
const errors = (doc: any) => formatProblems(validateWorld(worldOf(doc)).filter((p: any) => p.severity === "error"));
// The coplanar lint as check.ts runs it: every wall mode and rotation, and every quarter turn between them.
const views = (lot: any) => WALL_MODES.flatMap((mode: string) => [0, 1, 2, 3].flatMap((rot) => {
  const cut = cutaway(lot, { mode, rot });
  return [cut, new Set([...cut, ...cutaway(lot, { mode, rot: rot + 1 })])];
}));
function lint(doc: any) {
  const { lot, catalog } = buildLot(worldOf(doc));
  return [...new Set(lintViews(lot, catalog, views(lot)).flatMap(describePairs))];
}
const tilesOf = (doc: any) => {
  const { lot } = buildLot(worldOf(doc));
  return new Map(lot.objects.flatMap((o: any) => o.tiles.map((t: number[]) => [t.join(","), o.id])));
};
const live = (r: any) => r.layout.desks.filter((d: any) => !d.vacant).map((d: any) => d.lane);

const SIZES: [string, Lane[]][] = [
  ["1 lane", loose(1)],
  ["4 lanes, one team", team("a", 4)],
  ["5 lanes, a team and one on its own", [...team("a", 4), lane("solo")]],
  ["12 lanes, uneven teams and lanes on their own", [...team("a", 6), ...team("b", 3), ...loose(3, "s")]],
  ["24 lanes, uneven teams", [...team("a", 9), lane("b"), ...team("c", 5), ...team("d", 3), ...team("e", 6)]],
  ["24 lanes with no tree", loose(24)],
];

describe("office doc", () => {
  for (const [label, lanes] of SIZES) {
    test(`${label}: valid, no z-fighting, a desk, a chair and a worker per lane, spawned on free tiles`, () => {
      const { doc, layout } = officeDoc(withHq(lanes));
      expect(errors(doc)).toBe("");
      expect(lint(doc)).toEqual([]);
      const ids = new Set(doc.objects.map((o: any) => o.id));
      for (const l of lanes) {
        expect(ids.has(deskId(l.name)) && ids.has(chairId(l.name))).toBe(true);
        expect(doc.characters.filter((c: any) => c.id === workerId(l.name)).length).toBe(1);
      }
      expect(doc.characters.length).toBe(lanes.length + 1); // and HQ
      const used = tilesOf(doc);
      for (const c of doc.characters) expect({ c: c.id, under: used.get(c.at.join(",")) ?? null }).toEqual({ c: c.id, under: null });
      expect(doc.acts.map((a: any) => a.who).sort()).toEqual(doc.characters.map((c: any) => c.id).sort());
      expect(layout.desks.length).toBe(lanes.length);
    }, 120_000);
  }

  test("lintViews finds what linting each view on its own finds, on a 24-lane office with planted clashes", () => {
    const { lot, catalog } = buildLot(worldOf(officeDoc(withHq(SIZES[4][1])).doc));
    // every seventh object again, 3 cm east: it clashes with itself in every view
    const copies = lot.objects.filter((_: any, i: number) => i % 7 === 0).map((o: any) => ({ ...o, id: `copy:${o.id}`, pos: [o.pos[0] + 0.03, o.pos[1], o.pos[2]] }));
    // a plaque as deep as a plain wall, up where only a full wall reaches: it clashes only in views that keep that wall up
    const cutaways = views(lot).slice(8, 16);
    const [edge] = [...lot.walls.keys()].filter((k: string) => k.startsWith("h:") && !lot.walls.get(k).opening && cutaways.some((c: Set<string>) => c.has(k)) && cutaways.some((c: Set<string>) => !c.has(k)));
    const [x, z] = edge.slice(2).split(",").map(Number);
    const plaque = defineObject({ id: "plaque", blocks: false, build: (k: any) => k.box("plaque", [0.4, 0.3, WALL_T], [0, 1.6, 0], "#ffffff") });
    lot.objects.push(...copies, { id: "plaque", def: plaque, q: 0, pos: [x + 0.5, FLOOR_Y, z] });
    const cuts = views(lot);
    const each = cuts.map((c: Set<string>) => lintCoplanar(lotPrims(lot, catalog, c)));
    expect(lintViews(lot, catalog, cuts)).toEqual(each);
    const plaqueIn = each.map((pairs: any[]) => pairs.some((p) => p.b.owner === "plaque" || p.a.owner === "plaque"));
    expect(plaqueIn).toContain(true);
    expect(plaqueIn).toContain(false);
    expect(Math.min(...each.map((pairs: any[]) => pairs.length))).toBeGreaterThan(copies.length);
  }, 120_000);

  test("the two-tile footprints the generator assumes are the packs' own", () => {
    const { doc } = officeDoc(withHq(loose(12)));
    const catalog = new Map(PACKS.flatMap((p: any) => p.objects.map((o: any) => [o.id, o])));
    for (const type of new Set(doc.objects.map((o: any) => o.type))) expect({ type, foot: (FOOT as any)[type as string] ?? [1, 1] }).toEqual({ type, foot: (catalog.get(type) as any).footprint });
  });

  test("the act per status is a table: each row names a place and a clip the engine has", () => {
    expect(Object.keys(STATUS_ACTS).sort()).toEqual([...STATUSES, "visit-lead"].sort());
    for (const [status, row] of Object.entries(STATUS_ACTS)) {
      expect({ status, place: ["desk", "beside", "break", "lead"].includes(row.place) }).toEqual({ status, place: true });
      expect({ status, clip: !!(CLIPS as any)[row.clip] }).toEqual({ status, clip: true });
    }
    // a question with its lead sits at its desk; the walk to the lead is a row that stays off until a setting turns it on
    expect(STATUS_ACTS["visit-lead"].off).toBe(true);
    expect(rowOf("visit-lead")).toBe(STATUS_ACTS.parked);
    const at = { chair: "c", beside: [1, 2], spot: [3, 4], lead: [5, 6] };
    expect(actFor("w", "with_lead", at)).toMatchObject({ do: "sit", target: "c" });
    expect(actFor("w", "with_lead", at, { visitLead: true })).toMatchObject({ do: "walk", to: [5, 6] });
    // working types at the desk, waiting leans back there, a question stands up beside it, done goes for a drink
    const lanes = ["moving", "waiting", "needs_you", "done", "parked", "mystery"].map((s) => ({ name: `x-${s}`, parent: "hq", status: s }));
    const { doc } = officeDoc(withHq(lanes));
    const act = (s: string) => doc.acts.find((a: any) => a.who === workerId(`x-${s}`));
    const roomAt = buildLot(worldOf(doc)).lot.roomAt;
    expect(act("moving")).toEqual({ who: workerId("x-moving"), do: "sit", target: chairId("x-moving"), clip: "type" });
    expect(act("waiting")).toMatchObject({ do: "sit", target: chairId("x-waiting"), clip: "lean-back" });
    expect(act("needs_you")).toMatchObject({ do: "walk", clip: "wave", to: doc.characters.find((c: any) => c.id === workerId("x-needs_you")).at });
    expect(act("done")).toMatchObject({ do: "walk", clip: "drink" });
    expect(roomAt.get(act("done").to.join(","))).toBe("break");
    expect(act("mystery")).toMatchObject({ do: "walk", clip: "idle" }); // an unknown status counts as parked
    expect(act("mystery").to).not.toEqual(act("done").to);
  });

  test("a status change is one new act and nothing else", () => {
    const lanes = withHq([...team("a", 3), lane("solo")].map((l) => ({ ...l, status: "moving" })));
    const a = officeDoc(lanes);
    const b = officeDoc(lanes.map((l) => (l.name === "a-1" ? { ...l, status: "done" } : l)), a);
    const d = diffWorld(a.doc, b.doc);
    expect([d.lot, d.objects, d.characters]).toEqual([false, { added: [], removed: [], changed: [] }, { added: [], removed: [], changed: [] }]);
    expect(d.acts).toEqual([b.doc.acts.find((x: any) => x.who === workerId("a-1"))]);
    expect(d.acts[0]).toMatchObject({ do: "walk", clip: "drink" });
    const c = officeDoc(lanes, b);
    expect(diffWorld(b.doc, c.doc).acts).toEqual([{ who: workerId("a-1"), do: "sit", target: chairId("a-1"), clip: "type" }]);
    expect(diffWorld(c.doc, officeDoc(lanes, c).doc).same).toBe(true); // the same lanes twice: nothing to apply
  });
});

// Where the layout puts each thing, so a test can say which objects the doc may change: a desk or chair by its lane's
// seat (room, place and seat), anything else by its room's place. Places count from the layout's north-west corner,
// which is the lot's origin.
function owners(r: any, hq = "hq") {
  const { minX, minZ } = r.layout.bounds;
  const room = new Map(r.layout.rooms.map((x: any) => [x.id, `${x.x - minX},${x.z - minZ},${x.w},${x.d},${x.back}`]));
  const seat = new Map(r.layout.desks.map((d: any) => [d.lane, `${d.room}@${room.get(d.room)}:${d.seat}`]));
  seat.set(hq, `hq@${room.get("hq")}`);
  return new Map(r.doc.objects.map((o: any) => {
    const [kind, ...rest] = o.id.split(":");
    const owner = rest.join(":");
    if (kind === "hall-light") return [o.id, o.at.join(",")]; // a hall's light keeps its tile as the hall grows
    return [o.id, kind === "desk" || kind === "chair" ? seat.get(owner) : room.get(owner)];
  }));
}

// Lanes that come and go: the office grows from one lane to 24 in uneven teams, loses some, takes newcomers and
// returning lanes, and shrinks again.
const STEPS: [string, Lane[]][] = [
  ["1 lane", [lane("a")]],
  ["a team of 4", team("a", 4)],
  ["one on its own joins: a second room, a new stage", [...team("a", 4), lane("s0")]],
  ["a second team and more on their own: 12", [...team("a", 6), ...team("b", 3), ...loose(3, "s")]],
  ["two leave: their desks stay, empty", [...team("a", 6), ...team("b", 3), ...loose(3, "s")].filter((l) => l.name !== "a-2" && l.name !== "s1")],
  ["a newcomer takes an empty desk, one comes back to its own", [...team("a", 6), ...team("b", 3), lane("s0"), lane("s2"), lane("c0")]],
  ["a new team member: a free desk in its team's room", [...team("a", 6), ...team("b", 4), lane("s0"), lane("s2"), lane("c0")]],
  ["24 in uneven teams: wings", [...team("a", 9), lane("b"), ...team("c", 5), ...team("d", 3), ...team("e", 6)]],
  ["four leave, three join", [...team("a", 9).filter((l) => !["a-4", "a-7"].includes(l.name)), ...team("c", 5).filter((l) => l.name !== "c-3"), ...team("d", 4), ...team("e", 6), lane("f0"), lane("f1")]],
  ["back down to 12: a smaller stage", [...team("a", 6), ...team("b", 3), ...loose(3, "s")]],
  ["back down to 1", [lane("a")]],
];

describe("office doc as lanes come and go", () => {
  test("each doc is valid with no z-fighting, and its diff from the last touches only what the layout moved", () => {
    let prev: any = null;
    const sizes: string[] = [];
    for (const [label, lanes] of STEPS) {
      const next = officeDoc(withHq(lanes), prev);
      expect({ label, errors: errors(next.doc) }).toEqual({ label, errors: "" });
      expect({ label, lint: lint(next.doc) }).toEqual({ label, lint: [] });
      if (prev) {
        const d = diffWorld(prev.doc, next.doc);
        const before = new Set(live(prev)), after = new Set(live(next));
        // workers: exactly the lanes that joined and left; a worker never changes
        expect({ label, added: d.characters.added.sort(), removed: d.characters.removed.sort(), changed: d.characters.changed }).toEqual({
          label, added: [...after].filter((l) => !before.has(l)).map(workerId).sort(), removed: [...before].filter((l) => !after.has(l)).map(workerId).sort(), changed: [],
        });
        // objects: exactly those whose seat or room the layout moved, added or dropped
        const a = owners(prev), b = owners(next);
        const moved = [...new Set([...a.keys(), ...b.keys()])].filter((id) => a.get(id) !== b.get(id)).sort();
        expect({ label, touched: [...d.objects.added, ...d.objects.removed, ...d.objects.changed].sort() }).toEqual({ label, touched: moved });
        // the architecture: only when a room moved, opened or closed
        const rooms = (r: any) => JSON.stringify(r.layout.rooms.map((x: any) => [x.id, x.x, x.z, x.w, x.d, x.back]));
        expect({ label, lot: d.lot }).toEqual({ label, lot: rooms(prev) !== rooms(next) });
        // new acts: a joining worker's, one whose seat moved, or one on its way to the break area
        const seatMoved = (l: string) => a.get(deskId(l)) !== b.get(deskId(l));
        for (const act of d.acts) {
          const l = act.who.slice("lane:".length);
          expect({ label, act, why: !before.has(l) || seatMoved(l) || act.do === "walk" }).toEqual({ label, act, why: true });
        }
        // a new worker spawns on a tile no object covers
        const used = tilesOf(next.doc);
        for (const id of d.characters.added) {
          const at = next.doc.characters.find((c: any) => c.id === id).at.join(",");
          expect({ label, id, under: used.get(at) ?? null }).toEqual({ label, id, under: null });
        }
        sizes.push(`${label}: lot ${d.lot ? "changed" : "same"}, objects +${d.objects.added.length} -${d.objects.removed.length} ~${d.objects.changed.length}, workers +${d.characters.added.length} -${d.characters.removed.length}, acts ${d.acts.length}`);
      }
      prev = next;
    }
    if (process.env.OFFICE_DIFFS) console.log(sizes.join("\n"));
  }, 120_000);
});

describe("layout", () => {
  // n lanes with no tree: every lane directly under HQ.
  const bare = (n: number, prefix = "l") => [{ name: "hq" }, ...Array.from({ length: n }, (_, i) => ({ name: `${prefix}${i}`, parent: "hq" }))];
  // teams of the given sizes: t0 leads t0-1, t0-2, ...; one of them (t0-2) a level further down the tree.
  const teams = (...sizes: number[]) => [
    { name: "hq" },
    ...sizes.flatMap((size, t) => Array.from({ length: size }, (_, i) => ({ name: i ? `t${t}-${i}` : `t${t}`, parent: i === 0 ? "hq" : i === 2 ? `t${t}-1` : `t${t}` }))),
  ];
  const roomOf = (p: any, lane: string) => p.desks.find((d: any) => d.lane === lane && !d.vacant)?.room;
  const seated = (p: any) => p.desks.filter((d: any) => !d.vacant).map((d: any) => d.lane);

  for (const [n, stage, rooms] of [[1, "studio", 1], [4, "studio", 1], [5, "floor", 2], [9, "floor", 3], [16, "floor", 4], [18, "wings", 5], [33, "campus", 9]] as const) {
    test(`${n} lanes with no tree: ${rooms} rooms of four, the ${stage} stage, one desk each, nothing overlapping`, () => {
      const p = plan(bare(n));
      expect(p.stageName).toBe(stage);
      expect(p.teamRooms.length).toBe(rooms);
      expect(seated(p).sort()).toEqual(Array.from({ length: n }, (_, i) => `l${i}`).sort());
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
      const p = plan(bare(n));
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

  test("desks are stable within a stage: a new lane takes a free desk, a removed one leaves its desk empty", () => {
    const where = (p: any) => Object.fromEntries(p.desks.filter((d: any) => !d.vacant).map((d: any) => [d.lane, `${d.room}:${d.seat}`]));
    const p1 = plan(bare(6));
    const p2 = plan([...bare(6), { name: "late", parent: "hq" }], p1);
    const w1 = where(p1), w2 = where(p2);
    for (const k of Object.keys(w1)) expect(w2[k]).toBe(w1[k]);
    expect(w2.late).toBe("room:1:2"); // the next free desk in the second room
    // l2 leaves: its desk empties, nobody moves
    const p3 = plan([...bare(6), { name: "late", parent: "hq" }].filter((l) => l.name !== "l2"), p2);
    expect(p3.desks.find((d: any) => d.lane === "l2")?.vacant).toBe(true);
    for (const k of Object.keys(w2)) if (k !== "l2") expect(where(p3)[k]).toBe(w2[k]);
    // a newcomer takes the empty desk; l2 coming back later finds another
    const p4 = plan([...bare(6).filter((l) => l.name !== "l2"), { name: "late", parent: "hq" }, { name: "next", parent: "hq" }], p3);
    expect(where(p4).next).toBe(w2.l2);
  });

  test("a lane that comes back takes its old desk again", () => {
    const p1 = plan(bare(6));
    const p2 = plan(bare(6).filter((l) => l.name !== "l1"), p1);
    const p3 = plan(bare(6), p2);
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
    const p1 = plan(bare(4));
    expect(p1.stageName).toBe("studio");
    const p2 = plan(bare(5), p1);
    expect(p2.stageName).toBe("floor");
    const p3 = plan(bare(17), p2);
    const p4 = plan(bare(3), p3);
    expect(p4.stageName).toBe("studio");
    expect(p4.desks.every((d: any) => !d.vacant)).toBe(true);
  });

  test("past four rooms, rooms line up in wings off a central hall", () => {
    const p = plan(bare(18));
    expect(p.stageName).toBe("wings");
    const rows = new Set(p.teamRooms.map((r: any) => r.z));
    expect(rows.size).toBe(2); // four rooms in the first wing, one in the next
  });
});
