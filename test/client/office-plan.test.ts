// The office as a world doc (src/client/office/plan.js): every doc for 1 to 24 lanes, in loose rooms or uneven teams,
// passes validateWorld (every room reachable, every act possible) and the coplanar lint in every view; each lane has a
// desk, a chair and a worker with stable ids; the act per status is a table; and as lanes come and go, the doc
// changes only where the layout did, so world.apply(next) rebuilds only that.
import { describe, expect, test } from "bun:test";
import { fromJSON, validateWorld, formatProblems, buildLot, diffWorld, cutaway, lotPrims, lintCoplanar, describePairs, WALL_MODES, CLIPS } from "@hq/world/model";
import japandi from "../../src/client/office/japandi/index.js";
import { officeDoc, deskId, chairId, workerId } from "../../src/client/office/plan.js";
import { STATUS_ACTS } from "../../src/client/office/acts.js";
import { FOOT } from "../../src/client/office/furnish.js";

const PACKS = [japandi];
const STATUSES = ["moving", "needs_you", "blocked", "hq_turn", "waiting", "stale", "done", "parked", "gone"];
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
function lint(doc: any) {
  const { lot, catalog } = buildLot(worldOf(doc));
  const out = new Set<string>();
  for (const mode of WALL_MODES) for (let rot = 0; rot < 4; rot++) {
    const cut = cutaway(lot, { mode, rot });
    for (const set of [cut, new Set([...cut, ...cutaway(lot, { mode, rot: rot + 1 })])]) for (const l of describePairs(lintCoplanar(lotPrims(lot, catalog, set)))) out.add(l);
  }
  return [...out];
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

  test("the two-tile footprints the generator assumes are the packs' own", () => {
    const { doc } = officeDoc(withHq(loose(12)));
    const catalog = new Map(PACKS.flatMap((p: any) => p.objects.map((o: any) => [o.id, o])));
    for (const type of new Set(doc.objects.map((o: any) => o.type))) expect({ type, foot: (FOOT as any)[type as string] ?? [1, 1] }).toEqual({ type, foot: (catalog.get(type) as any).footprint });
  });

  test("the act per status is a table: each row names a place and a clip the engine has", () => {
    expect(Object.keys(STATUS_ACTS).sort()).toEqual([...STATUSES].sort());
    for (const [status, row] of Object.entries(STATUS_ACTS)) {
      expect({ status, place: ["desk", "beside", "break"].includes(row.place) }).toEqual({ status, place: true });
      expect({ status, clip: !!(CLIPS as any)[row.clip] }).toEqual({ status, clip: true });
    }
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
