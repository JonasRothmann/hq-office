// The land around the office (src/client/world/outside/gen.js): the same seed gives the same land, nothing reaches
// into the office's lot, the river winds round it, cars stay on the roads and people on the pavements and zebras,
// counts stay within their caps, nothing near the lot stands tall enough to hide the building, and the lot used for
// generating only changes when the office's lot has outgrown it.
import { describe, expect, test } from "bun:test";
import { generate, growLot, distToRect, rectGap, inside, overlaps, sight, lineLength, CAPS, GROUND, ROAD, WATER, LOT_STEP } from "../../src/client/world/outside/gen.js";

type Pt = { x: number; z: number };
type Rect = { minX: number; minZ: number; maxX: number; maxZ: number };
const LOTS: Record<string, Rect> = {
  small: { minX: -8, minZ: -5, maxX: 8, maxZ: 5 },
  office: { minX: -18, minZ: -13, maxX: 18, maxZ: 13 },
  campus: { minX: -36, minZ: -26, maxX: 36, maxZ: 26 }, // a 60 × 40 m building with a 6 m garden
  offset: { minX: 4, minZ: -40, maxX: 50, maxZ: -12 },
};
const SEEDS = [1, 2, 7, 42, 1234];
const MODES = ["nature", "city"] as const;
const each = (fn: (mode: (typeof MODES)[number], seed: number, name: string, lot: Rect) => void) => {
  for (const mode of MODES) for (const [name, lot] of Object.entries(LOTS)) for (const seed of SEEDS) fn(mode, seed, name, lot);
};

// Points every `step` metres along a closed loop, each with its heading.
function walkLoop(path: Pt[], step = 0.25) {
  const out: { x: number; z: number; hx: number; hz: number }[] = [];
  for (let i = 0; i < path.length; i++) {
    const a = path[i], b = path[(i + 1) % path.length];
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    if (len < 1e-9) continue;
    for (let t = 0; t < len; t += step) out.push({ x: a.x + ((b.x - a.x) * t) / len, z: a.z + ((b.z - a.z) * t) / len, hx: (b.x - a.x) / len, hz: (b.z - a.z) / len });
  }
  return out;
}
const inAny = (x: number, z: number, rects: Rect[], e = 1e-6) => rects.some((r) => x >= r.minX - e && x <= r.maxX + e && z >= r.minZ - e && z <= r.maxZ + e);

describe("outside: the same seed, the same land", () => {
  for (const mode of MODES) {
    test(`${mode}: same seed and lot give the same layout`, () => {
      expect(generate({ mode, seed: 7, lot: LOTS.office })).toEqual(generate({ mode, seed: 7, lot: LOTS.office }));
      expect(generate({ mode, seed: "the owner's office", lot: LOTS.small })).toEqual(generate({ mode, seed: "the owner's office", lot: LOTS.small }));
    });
    test(`${mode}: another seed gives another layout`, () => {
      const a = JSON.stringify(generate({ mode, seed: 7, lot: LOTS.office }));
      for (const s of [8, 9, 1000]) expect(JSON.stringify(generate({ mode, seed: s, lot: LOTS.office }))).not.toBe(a);
    });
  }
});

describe("outside: nothing reaches into the lot", () => {
  each((mode, seed, name, lot) => {
    test(`${mode} ${name} seed ${seed}`, () => {
      const L: any = generate({ mode, seed, lot });
      const bad: string[] = [];
      const circle = (what: string, x: number, z: number, r: number) => { if (distToRect(x, z, lot) < r) bad.push(`${what} at ${x},${z}`); };
      const box = (what: string, r: Rect) => { if (overlaps(r, lot)) bad.push(`${what} ${JSON.stringify(r)}`); };
      for (const t of L.trees) circle(`tree ${t.kind}`, t.x, t.z, 1.3 * t.s);
      if (mode === "nature") {
        for (const r of L.rocks) circle("rock", r.x, r.z, 0.8 * r.s);
        for (const f of L.flowers) circle("flower", f.x, f.z, 0.1);
        for (const r of L.reeds) circle("reed", r.x, r.z, 0.3);
        for (const p of L.water.river) circle("river", p.x, p.z, p.w + WATER.bank);
        const pond = L.water.pond;
        if (pond) circle("pond", pond.x, pond.z, Math.max(pond.rx, pond.rz) + WATER.bank);
        for (const p of L.path.all) if (inside(p.x, p.z, lot)) bad.push(`path at ${p.x},${p.z}`);
        if (L.bridge) circle("bridge", L.bridge.x, L.bridge.z, L.bridge.length / 2 + 0.5);
        // the terrain's grid has lines on the lot's edges, so the build leaves a clean hole
        expect(L.terrain.xs).toContain(lot.minX); expect(L.terrain.xs).toContain(lot.maxX);
        expect(L.terrain.zs).toContain(lot.minZ); expect(L.terrain.zs).toContain(lot.maxZ);
        expect(Math.min(...L.terrain.h)).toBeGreaterThanOrEqual(GROUND);
      } else {
        for (const k of ["roads", "junctions", "crossings", "walks", "buildings", "lamps"]) {
          for (const r of L[k]) box(k, "w" in r && "d" in r ? { minX: r.x - r.w / 2, minZ: r.z - r.d / 2, maxX: r.x + r.w / 2, maxZ: r.z + r.d / 2 } : "minX" in r ? r : { minX: r.x - 0.2, minZ: r.z - 0.2, maxX: r.x + 0.2, maxZ: r.z + 0.2 });
        }
        for (const b of L.blocks) if (b.kind !== "lot") box("block", b.inner);
        expect(L.blocks.filter((b: any) => b.kind === "lot").map((b: any) => b.inner)).toEqual([{ minX: lot.minX, minZ: lot.minZ, maxX: lot.maxX, maxZ: lot.maxZ }]);
        for (const c of L.cars) for (const p of walkLoop(c.path, 0.5)) if (distToRect(p.x, p.z, lot) < 0.8) bad.push(`car at ${p.x},${p.z}`);
        for (const w of L.people) for (const p of walkLoop(w.path, 0.5)) if (distToRect(p.x, p.z, lot) < 0.3) bad.push(`walker at ${p.x},${p.z}`);
      }
      expect(bad.slice(0, 5)).toEqual([]);
    });
  });
});

describe("outside: nature", () => {
  for (const [name, lot] of Object.entries(LOTS)) for (const seed of SEEDS) {
    test(`${name} seed ${seed}: the river winds round the lot and the path leads to its door`, () => {
      const L: any = generate({ mode: "nature", seed, lot: { ...lot, door: "s" } });
      const river = L.water.river as (Pt & { w: number })[];
      // never closer than its banks plus a few metres of meadow, and it passes along two sides of the lot
      for (const p of river) expect(distToRect(p.x, p.z, lot)).toBeGreaterThanOrEqual(p.w + WATER.bank + 6.9);
      const cx = (lot.minX + lot.maxX) / 2, cz = (lot.minZ + lot.maxZ) / 2;
      const near = river.filter((p) => distToRect(p.x, p.z, lot) < 30);
      const sides = new Set(near.map((p) => (p.x > lot.maxX ? "e" : p.x < lot.minX ? "w" : p.z > lot.maxZ ? "s" : p.z < lot.minZ ? "n" : "?")));
      expect(sides.size).toBeGreaterThanOrEqual(2);
      expect(Math.hypot(river[0].x - cx, river[0].z - cz)).toBeGreaterThan(50);
      expect(Math.hypot(river.at(-1)!.x - cx, river.at(-1)!.z - cz)).toBeGreaterThan(50);
      // the path starts on the middle of the door side and heads away from the lot
      expect(L.path.entry).toEqual({ x: cx, z: lot.maxZ });
      expect(L.path.all[5].z).toBeGreaterThan(lot.maxZ + 4);
      // where the path meets the river, a bridge spans the water
      const wet = L.path.all.some((p: Pt) => river.some((r) => Math.hypot(r.x - p.x, r.z - p.z) < r.w));
      if (wet) {
        expect(L.bridge).not.toBeNull();
        const nearest = Math.min(...river.map((r) => Math.hypot(r.x - L.bridge.x, r.z - L.bridge.z) - r.w));
        expect(nearest).toBeLessThan(0);
        expect(L.bridge.length).toBeGreaterThan(2 * 2.3);
      }
    });
  }

  test("trees thicken away from the clearing, with several kinds", () => {
    const L: any = generate({ mode: "nature", seed: 7, lot: LOTS.office });
    const near = L.trees.filter((t: any) => distToRect(t.x, t.z, LOTS.office) < 12).length;
    const ring = L.trees.filter((t: any) => { const d = distToRect(t.x, t.z, LOTS.office); return d >= 20 && d < 32; }).length;
    expect(ring).toBeGreaterThan(near);
    expect(new Set(L.trees.map((t: any) => t.kind)).size).toBeGreaterThanOrEqual(4);
  });
});

describe("outside: city", () => {
  each((mode, seed, name, lot) => {
    if (mode !== "city") return;
    test(`${name} seed ${seed}: cars keep to the roads, people to the pavements and zebras`, () => {
      const L: any = generate({ mode, seed, lot });
      const road = [...L.roads, ...L.junctions] as Rect[];
      const foot = [...L.walks, ...L.crossings] as Rect[];
      const off: string[] = [];
      for (const c of L.cars) for (const p of walkLoop(c.path)) {
        // both sides of the car (1.5 m wide)
        for (const s of [-0.75, 0.75]) { const x = p.x + p.hz * s, z = p.z - p.hx * s; if (!inAny(x, z, road)) off.push(`car at ${x.toFixed(2)},${z.toFixed(2)}`); }
      }
      for (const w of L.people) for (const p of walkLoop(w.path)) {
        for (const s of [-0.2, 0.2]) { const x = p.x + p.hz * s, z = p.z - p.hx * s; if (!inAny(x, z, foot)) off.push(`walker at ${x.toFixed(2)},${z.toFixed(2)}`); }
      }
      expect(off.slice(0, 5)).toEqual([]);
    });
  });

  test("cars keep to the right: a car's lane is right of its road's middle", () => {
    const L: any = generate({ mode: "city", seed: 7, lot: LOTS.office });
    const { xs, zs } = L.grid;
    for (const c of L.cars) for (const p of walkLoop(c.path, 1)) {
      // on a straight stretch along a road line, the line is on the car's left
      const onX = zs.find((z: number) => Math.abs(p.z - z) < ROAD.w / 2 && Math.abs(p.hx) > 0.99);
      const onZ = xs.find((x: number) => Math.abs(p.x - x) < ROAD.w / 2 && Math.abs(p.hz) > 0.99);
      if (onX !== undefined) expect(Math.sign(p.z - onX)).toBe(Math.sign(p.hx));
      if (onZ !== undefined) expect(Math.sign(p.x - onZ)).toBe(-Math.sign(p.hz));
    }
  });
});

describe("outside: caps and the view over the lot", () => {
  each((mode, seed, name, lot) => {
    test(`${mode} ${name} seed ${seed}: counts within caps, nothing tall near the lot`, () => {
      const L: any = generate({ mode, seed, lot });
      expect(L.trees.length).toBeLessThanOrEqual(CAPS.trees);
      if (mode === "city") {
        expect(L.cars.length).toBeLessThanOrEqual(CAPS.cars);
        expect(L.people.length).toBeLessThanOrEqual(CAPS.people);
        expect(L.cars.length).toBeGreaterThan(5);
        expect(L.people.length).toBeGreaterThan(10);
        expect(L.buildings.length).toBeGreaterThan(10);
        for (const b of L.buildings) {
          const gap = rectGap({ minX: b.x - b.w / 2, minZ: b.z - b.d / 2, maxX: b.x + b.w / 2, maxZ: b.z + b.d / 2 }, lot);
          expect(b.h + b.roofH).toBeLessThanOrEqual(Math.max(sight(gap), 3.2 + b.roofH) + 1e-6);
        }
      } else {
        expect(L.rocks.length).toBeLessThanOrEqual(CAPS.rocks);
        expect(L.flowers.length).toBeLessThanOrEqual(CAPS.flowers);
        expect(L.reeds.length).toBeLessThanOrEqual(CAPS.reeds);
        expect(L.trees.length).toBeGreaterThan(100);
      }
      const TALL: Record<string, number> = { conifer: 5.2, birch: 4.6, maple: 4.2, "maple-red": 4.2, shrub: 1.3, round: 4.2, street: 4.2 };
      for (const t of L.trees) expect(TALL[t.kind] * t.s).toBeLessThanOrEqual(Math.max(sight(distToRect(t.x, t.z, lot) - 1.3), 0.6 * TALL[t.kind]) + 1e-6);
    });
  });
});

describe("outside: the lot it generates for", () => {
  const office = { minX: -18, minZ: -13, maxX: 18, maxZ: 13, door: "s" };
  test("a lot rounds out to the step, with room to spare", () => {
    const g = growLot(office);
    for (const k of ["minX", "minZ", "maxX", "maxZ"] as const) expect(Math.abs(g[k] % LOT_STEP)).toBe(0);
    expect(g.minX).toBeLessThan(office.minX); expect(g.maxX).toBeGreaterThan(office.maxX);
    expect(g.minZ).toBeLessThan(office.minZ); expect(g.maxZ).toBeGreaterThan(office.maxZ);
  });
  test("growing a little keeps it; outgrowing it or shrinking a lot makes a new one", () => {
    const g = growLot(office);
    expect(growLot({ ...office, maxX: office.maxX + 0.4 }, g)).toBe(g);
    expect(growLot({ ...office, minX: office.minX + 5 }, g)).toBe(g);
    expect(growLot({ ...office, maxX: office.maxX + 5 }, g)).not.toBe(g);
    expect(growLot({ ...office, maxX: office.maxX - 25 }, g)).not.toBe(g);
    expect(growLot({ ...office, door: "e" }, g)).not.toBe(g);
  });
  test("an office that grows a room at a time regenerates seldom", () => {
    let g = growLot(office), changes = 0;
    for (let k = 1; k <= 12; k++) { const n = growLot({ ...office, maxX: office.maxX + 5 * k }, g); if (n !== g) changes++; g = n; }
    expect(changes).toBeLessThanOrEqual(5);
    expect(changes).toBeGreaterThan(0);
  });
  test("every loop is closed and long enough to drive or walk", () => {
    const L: any = generate({ mode: "city", seed: 7, lot: LOTS.office });
    for (const m of [...L.cars, ...L.people]) expect(lineLength(m.path, true)).toBeGreaterThan(20);
  });
});
