// The town round the office, Copenhagen-ish, pure (no three.js; gen.js calls city()): a grid of perimeter blocks
// with continuous painted street fronts round tree-filled courtyards, a bike track on each side of every street, a
// straight canal one street from the lot with boats and a row of narrow gabled houses across it, a square, a copper
// spire, lamps hung on wires across the streets, and the loops that cars, the bus, cyclists and walkers follow.
// docs/design/outside/copenhagen.md says which cue each part comes from. Original shapes only.
import { ROAD, LEVEL, CAPS, STOREY, FADE, rect, rectGap, distToRect, sight, lineLength } from "./gen.js";

// Across the canal block, from the lot's side out: a narrow quay, the water, a wide quay with café tables, the row of
// canal houses, and a strip of yard behind them.
export const CANAL = { near: 2.2, water: 11, far: 4.4, row: 8.6, back: 3 };
// Moored boats (Sims scale): length, beam and mast height.
export const BOATS = { ship: { len: 8.6, beam: 2.1, mast: 7.4 }, sail: { len: 4.6, beam: 1.6, mast: 4.8 }, motor: { len: 3.9, beam: 1.5, mast: 0 } };
// Vehicle lengths: a car, a small van, the city bus.
export const VEHICLES = { car: 3.3, van: 3.1, bus: 7.6 };
export const SHIRTS = 10, PANTS = 6, SKINS = 6, HAIRS = 7, CAR_PAINTS = 9, BIKE_PAINTS = 7, BOAT_PAINTS = 6, WALLS = 12;
export const BIKE_LEN = 1.3, CARGO_LEN = 2.0;

const SIDES = ["n", "e", "s", "w"];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const r2 = (v) => Math.round(v * 100) / 100;
const r3 = (v) => Math.round(v * 1000) / 1000;
const down2 = (v) => Math.floor(v * 100) / 100;
const shrink = (r, k) => rect(r.minX + k, r.minZ + k, r.maxX - k, r.maxZ - k);

export function city(R, s, lot, ext) {
  const RW = ROAD.w, BK = ROAD.bike, SW = ROAD.walk, half = RW / 2, H = half + BK + SW;
  const canalSide = SIDES[Math.floor(R() * 4)], rowCanal = canalSide === "n" || canalSide === "s";
  const canalSpan = 2 * H + CANAL.near + CANAL.water + CANAL.far + CANAL.row + CANAL.back;
  const step = () => 2 * H + 18 + R() * 12;

  // Street centre lines: the ring round the lot's block, then blocks outward past the extent. The first step out on
  // the canal's side is the canal block.
  const lines = (lo, hi, eLo, eHi, sLo, sHi) => {
    const a = [r2(lo - H), r2(hi + H)];
    for (let first = true; a[0] > eLo - 6; first = false) a.unshift(r2(a[0] - (first && canalSide === sLo ? canalSpan : step())));
    for (let first = true; a.at(-1) < eHi + 6; first = false) a.push(r2(a.at(-1) + (first && canalSide === sHi ? canalSpan : step())));
    return a;
  };
  const xs = lines(lot.minX, lot.maxX, ext.minX, ext.maxX, "w", "e");
  const zs = lines(lot.minZ, lot.maxZ, ext.minZ, ext.maxZ, "n", "s");
  const nx = xs.length, nz = zs.length;
  const iL = xs.indexOf(r2(lot.minX - H)), jL = zs.indexOf(r2(lot.minZ - H));
  const ic = rowCanal ? -1 : canalSide === "w" ? iL - 1 : iL + 1;
  const jc = rowCanal ? (canalSide === "n" ? jL - 1 : jL + 1) : -1;
  // a z-road runs along line i from zs[j] to zs[j + 1]; an x-road along line j from xs[i] to xs[i + 1]
  const hasZ = (i, j) => i >= 0 && i < nx && j >= 0 && j < nz - 1 && j !== jc;
  const hasX = (i, j) => j >= 0 && j < nz && i >= 0 && i < nx - 1 && i !== ic;
  const crossesCanal = (i0, j0, i1, j1) => (rowCanal ? j0 <= jc && j1 >= jc + 1 : i0 <= ic && i1 >= ic + 1);

  const roads = [], junctions = [], crossings = [], bikeCrossings = [], walks = [], bikes = [], blocks = [];
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz - 1; j++) if (hasZ(i, j)) roads.push({ ...rect(xs[i] - half, zs[j] + half, xs[i] + half, zs[j + 1] - half), dir: "z", line: i, i, j });
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx - 1; i++) if (hasX(i, j)) roads.push({ ...rect(xs[i] + half, zs[j] - half, xs[i + 1] - half, zs[j] + half), dir: "x", line: j, i, j });
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
    const x = xs[i], z = zs[j];
    junctions.push({ ...rect(x - half, z - half, x + half, z + half), x, z });
    // on every arm: the bike track carries on across it in blue, then the zebra in line with the pavement
    if (hasZ(i, j - 1)) { bikeCrossings.push({ ...rect(x - half, z - half - BK, x + half, z - half), dir: "x" }); crossings.push({ ...rect(x - half, z - half - BK - SW, x + half, z - half - BK), dir: "x" }); }
    if (hasZ(i, j)) { bikeCrossings.push({ ...rect(x - half, z + half, x + half, z + half + BK), dir: "x" }); crossings.push({ ...rect(x - half, z + half + BK, x + half, z + half + BK + SW), dir: "x" }); }
    if (hasX(i - 1, j)) { bikeCrossings.push({ ...rect(x - half - BK, z - half, x - half, z + half), dir: "z" }); crossings.push({ ...rect(x - half - BK - SW, z - half, x - half - BK, z + half), dir: "z" }); }
    if (hasX(i, j)) { bikeCrossings.push({ ...rect(x + half, z - half, x + half + BK, z + half), dir: "z" }); crossings.push({ ...rect(x + half + BK, z - half, x + half + BK + SW, z + half), dir: "z" }); }
  }

  // A block's rings: the bike track round its edge, then the pavement (each pavement strip runs on over the corner of
  // the track, where walkers cross it to the zebra), then the block's own ground.
  const ringOf = (outer, exact = null) => {
    const b = shrink(outer, BK), inner = exact ?? shrink(outer, BK + SW);
    bikes.push(rect(outer.minX, outer.minZ, outer.maxX, b.minZ), rect(outer.minX, b.maxZ, outer.maxX, outer.maxZ), rect(outer.minX, b.minZ, b.minX, b.maxZ), rect(b.maxX, b.minZ, outer.maxX, b.maxZ));
    walks.push(rect(outer.minX, b.minZ, outer.maxX, inner.minZ), rect(outer.minX, inner.maxZ, outer.maxX, b.maxZ), rect(b.minX, outer.minZ, inner.minX, outer.maxZ), rect(inner.maxX, outer.minZ, b.maxX, outer.maxZ));
    return inner;
  };

  const dLotRect = (r) => rectGap(r, lot);
  const buildings = [], trees = [], racks = [], props = [], spires = [];
  const near = [];
  for (let i = 0; i < nx - 1; i++) for (let j = 0; j < nz - 1; j++) {
    if (i === ic || j === jc) continue;
    const outer = rect(xs[i] + half, zs[j] + half, xs[i + 1] - half, zs[j + 1] - half);
    const isLot = i === iL && j === jL;
    const inner = ringOf(outer, isLot ? rect(lot.minX, lot.minZ, lot.maxX, lot.maxZ) : null);
    const visible = dLotRect(inner) < FADE.to + 4;
    const block = { i, j, outer, inner, kind: isLot ? "lot" : visible ? "built" : "far", ground: R() < 0.5 ? "yard" : "grass" };
    blocks.push(block);
    if (!isLot && visible && Math.abs(i - iL) <= 1 && Math.abs(j - jL) <= 1) near.push(block);
  }
  // one of the blocks round the lot is often a square; a few further out are parks
  if (near.length && R() < 0.8) near[Math.floor(R() * near.length)].kind = "square";
  for (const b of blocks) if (b.kind === "built" && !near.includes(b) && R() < 0.1) b.kind = "park";

  // The canal block: one long block on the canal's side, its streets on both long edges.
  let canal = null;
  {
    const outer = rowCanal ? rect(xs[0] + half, zs[jc] + half, xs[nx - 1] - half, zs[jc + 1] - half) : rect(xs[ic] + half, zs[0] + half, xs[ic + 1] - half, zs[nz - 1] - half);
    const inner = ringOf(outer);
    // a band [a0, a1] metres out from the inner edge that faces the lot, as a rect
    const band = (a0, a1) => canalSide === "n" ? rect(inner.minX, inner.maxZ - a1, inner.maxX, inner.maxZ - a0)
      : canalSide === "s" ? rect(inner.minX, inner.minZ + a0, inner.maxX, inner.minZ + a1)
      : canalSide === "w" ? rect(inner.maxX - a1, inner.minZ, inner.maxX - a0, inner.maxZ)
      : rect(inner.minX + a0, inner.minZ, inner.minX + a1, inner.maxZ);
    const C = CANAL, w0 = C.near, w1 = C.near + C.water, f1 = w1 + C.far, h1 = f1 + C.row;
    // where along the canal a point is (x for a canal running along x), and the point at (along, out)
    const alongOf = (x, z) => (rowCanal ? x : z);
    const at = (u, a) => { const r = band(a, a); return rowCanal ? { x: u, z: r.minZ } : { x: r.minX, z: u }; };
    const mid = rowCanal ? (lot.minX + lot.maxX) / 2 : (lot.minZ + lot.maxZ) / 2;
    // footbridges carry the two streets either side of the lot over the water
    const bridgeLines = rowCanal ? [xs[iL], xs[iL + 1]] : [zs[jL], zs[jL + 1]];
    const bridges = bridgeLines.map((u) => {
      const a = at(u, 0), b = at(u, w1 + 0.6);
      const r = rowCanal ? rect(u - 1.7, Math.min(a.z, b.z), u + 1.7, Math.max(a.z, b.z)) : rect(Math.min(a.x, b.x), u - 1.7, Math.max(a.x, b.x), u + 1.7);
      return { ...r, u, along: rowCanal ? "z" : "x", from: canalSide };
    });
    canal = {
      side: canalSide, outer, inner,
      water: band(w0, w1), quays: [band(0, w0), band(w1, f1)], row: band(f1, h1), back: band(h1, C.near + C.water + C.far + C.row + C.back),
      bridges, mid,
    };
    blocks.push({ i: ic, j: jc, outer, inner, kind: "canal", ground: "yard" });
    canalRow(R, canal, band, at, f1, h1, alongOf, buildings, trees, props, lot);
    canal.boats = moor(R, canal, at, w0, w1);
  }

  for (const block of blocks) {
    if (block.kind === "built") perimeter(R, block, buildings, trees, spires, lot);
    if (block.kind === "park") park(R, block, trees, props);
    if (block.kind === "square") square(R, block, trees, props, racks, lot);
    if (block.kind !== "far") streetside(R, block, trees, racks, props, lot, block.kind === "canal" ? canalSide : null);
  }
  civic(R, buildings, spires, lot);
  const spans = hangLamps(R, roads, buildings, lot);

  // Cars and the bus: loops round rectangles of blocks on the right-hand lane, turning at the junctions; never over
  // the canal. Fewer cars than bikes.
  const vis = (r) => dLotRect(r) < 42;
  const cars = [];
  const roadLen = roads.filter(vis).reduce((a, r) => a + Math.max(r.maxX - r.minX, r.maxZ - r.minZ), 0);
  const nBus = roadLen > 300 ? 2 : 1;
  const nCars = Math.min(CAPS.cars - nBus, Math.max(6, Math.round(roadLen / 70)));
  const loopBox = (span) => {
    const i0 = Math.floor(R() * (nx - 1)), j0 = Math.floor(R() * (nz - 1));
    const i1 = Math.min(nx - 1, i0 + 1 + Math.floor(R() * span)), j1 = Math.min(nz - 1, j0 + 1 + Math.floor(R() * Math.max(1, span - 1)));
    return { i0, j0, i1, j1, box: rect(xs[i0], zs[j0], xs[i1], zs[j1]) };
  };
  for (let tries = 0; cars.length < nBus && tries < 300; tries++) {
    const { i0, j0, i1, j1, box } = loopBox(3);
    if (i1 - i0 < 2 || !vis(box) || crossesCanal(i0, j0, i1, j1)) continue;
    const path = roundedLoop(box, ROAD.lane, 2.8, false);
    cars.push({ path, speed: 3.0, offset: r2(R() * lineLength(path, true)), paint: 0, kind: "bus", len: VEHICLES.bus });
  }
  for (let tries = 0; cars.length < nBus + nCars && tries < 400; tries++) {
    const { i0, j0, i1, j1, box } = loopBox(3);
    if (!vis(box) || crossesCanal(i0, j0, i1, j1)) continue;
    const cw = R() < 0.5;
    const path = roundedLoop(box, cw ? -ROAD.lane : ROAD.lane, cw ? 1.6 : 2.8, cw);
    const van = R() < 0.3;
    cars.push({ path, speed: r2(3.2 + R() * 1.4), offset: r2(R() * lineLength(path, true)), paint: Math.floor(R() * CAR_PAINTS), kind: van ? "van" : "car", len: van ? VEHICLES.van : VEHICLES.car });
  }

  // Cyclists: on the bike tracks round rectangles of blocks, one way with the traffic. Clockwise is a right-hand loop
  // on the inside; anticlockwise rides the outside and turns left in two steps across the blue crossings, as cyclists
  // do there. Both need blocks either side, so the loop stays off the grid's edge.
  const cyclists = [];
  const bikeOff = half + BK / 2;
  const nCyc = Math.min(CAPS.cyclists, 46 + Math.floor(R() * 14));
  for (let tries = 0; cyclists.length < nCyc && tries < 1200; tries++) {
    const i0 = 1 + Math.floor(R() * Math.max(1, nx - 3)), j0 = 1 + Math.floor(R() * Math.max(1, nz - 3));
    const i1 = Math.min(nx - 2, i0 + 1 + Math.floor(R() * 2)), j1 = Math.min(nz - 2, j0 + 1 + Math.floor(R() * 2));
    if (i1 <= i0 || j1 <= j0) continue;
    const box = rect(xs[i0], zs[j0], xs[i1], zs[j1]);
    if (dLotRect(box) > 30 || crossesCanal(i0, j0, i1, j1)) continue;
    const cw = R() < 0.55;
    const path = roundedLoop(box, cw ? -bikeOff : bikeOff, cw ? 0.8 : 0.3, cw);
    cyclists.push({ path, speed: r2(2.3 + R() * 1.3), offset: r2(R() * lineLength(path, true)), cargo: R() < 0.16, paint: Math.floor(R() * BIKE_PAINTS), shirt: Math.floor(R() * SHIRTS), pants: Math.floor(R() * PANTS), skin: Math.floor(R() * SKINS), hair: Math.floor(R() * HAIRS) });
  }

  // People: loops on the pavements round one or two blocks (the lot's too) over the zebras, along the far quay, and
  // over the two footbridges.
  const people = [];
  const person = (path, speed) => ({ path, speed: r2(speed), offset: r2(R() * lineLength(path, true)), shirt: Math.floor(R() * SHIRTS), pants: Math.floor(R() * PANTS), skin: Math.floor(R() * SKINS), hair: Math.floor(R() * HAIRS) });
  const nPeople = Math.min(CAPS.people, 40 + Math.floor(R() * 18));
  const walkOff = BK + SW / 2;
  const quayWalk = canal.quays[1], qa = rowCanal ? "x" : "z";
  // the far quay: a thin loop along it, near the water
  for (let k = 0; k < 6; k++) {
    const u0 = canal.mid + (R() - 0.5) * 50, len = 10 + R() * 22;
    const lo = Math.max(u0 - len / 2, (rowCanal ? xs[1] : zs[1])), hi = Math.min(u0 + len / 2, rowCanal ? xs[nx - 2] : zs[nz - 2]);
    if (hi - lo < 8) continue;
    const q = quayWalk, across = rowCanal ? [q.minZ, q.maxZ] : [q.minX, q.maxX];
    const wet = canalSide === "n" || canalSide === "w" ? across[1] - 0.7 : across[0] + 0.7; // by the water's edge
    const dry = canalSide === "n" || canalSide === "w" ? wet - 1.6 : wet + 1.6;
    const box = rowCanal ? rect(lo, Math.min(wet, dry), hi, Math.max(wet, dry)) : rect(Math.min(wet, dry), lo, Math.max(wet, dry), hi);
    if (dLotRect(box) > 40) continue;
    people.push(person(roundedLoop(box, 0, 0.5, R() < 0.5), 0.75 + R() * 0.4));
  }
  // over the bridges: along the lot-side pavement, over one bridge, along the far quay, back over the other
  {
    const [A, B] = canal.bridges.map((b) => b.u).sort((a, b) => a - b);
    const pave = canalSide === "n" || canalSide === "w" ? -1 : 1; // from the canal block's lot-side edge into the block
    const edge = canalSide === "n" ? canal.outer.maxZ : canalSide === "s" ? canal.outer.minZ : canalSide === "w" ? canal.outer.maxX : canal.outer.minX;
    const walkLine = edge + pave * walkOff;
    const qLine = rowCanal ? (canalSide === "n" ? quayWalk.maxZ - 1.2 : quayWalk.minZ + 1.2) : (canalSide === "w" ? quayWalk.maxX - 1.2 : quayWalk.minX + 1.2);
    for (let k = 0; k < 3; k++) {
      const o = (k - 1) * 0.5;
      const box = rowCanal ? rect(A + 0.6 + o, Math.min(walkLine, qLine), B - 0.6 - o, Math.max(walkLine, qLine)) : rect(Math.min(walkLine, qLine), A + 0.6 + o, Math.max(walkLine, qLine), B - 0.6 - o);
      people.push(person(roundedLoop(box, 0, 0.5, R() < 0.5), 0.8 + R() * 0.4));
    }
  }
  for (let tries = 0; people.length < nPeople && tries < 800; tries++) {
    const bi0 = Math.floor(R() * (nx - 1)), bj0 = Math.floor(R() * (nz - 1));
    const wide = R() < 0.35, tall = !wide && R() < 0.3;
    const bi1 = Math.min(nx - 2, bi0 + (wide ? 1 : 0)), bj1 = Math.min(nz - 2, bj0 + (tall ? 1 : 0));
    if ((ic >= bi0 && ic <= bi1) || (jc >= bj0 && jc <= bj1)) continue;
    const outer = rect(xs[bi0] + half, zs[bj0] + half, xs[bi1 + 1] - half, zs[bj1 + 1] - half);
    if (dLotRect(outer) > 34) continue;
    const off = walkOff + (R() - 0.5) * 0.8;
    people.push(person(roundedLoop(shrink(outer, off), 0, 0.5, R() < 0.5), 0.85 + R() * 0.5));
  }

  const quays = canal.quays.map((q) => ({ ...q }));
  return {
    grid: { xs, zs, road: RW, walk: SW, bike: BK },
    roads, junctions, crossings, bikeCrossings, walks, bikes, blocks, buildings, trees, racks, props, spires, spans,
    canal: { side: canal.side, water: canal.water, quays, row: canal.row, back: canal.back, bridges: canal.bridges, outer: canal.outer, inner: canal.inner },
    boats: canal.boats, cars, cyclists, people,
  };
}

// A closed loop round a rect grown by `grow` metres (negative shrinks it), corners rounded with radius r, as points.
// cw: clockwise seen from above with north up (east along the north side first). Traffic keeps right, so a clockwise
// mover is on the inside of its loop and an anticlockwise one on the outside.
export function roundedLoop(b, grow, r, cw) {
  const minX = b.minX - grow, minZ = b.minZ - grow, maxX = b.maxX + grow, maxZ = b.maxZ + grow;
  const C = [
    { x: maxX - r, z: minZ + r, a0: -Math.PI / 2, a1: 0 },
    { x: maxX - r, z: maxZ - r, a0: 0, a1: Math.PI / 2 },
    { x: minX + r, z: maxZ - r, a0: Math.PI / 2, a1: Math.PI },
    { x: minX + r, z: minZ + r, a0: Math.PI, a1: Math.PI * 1.5 },
  ];
  const pts = [];
  for (const c of C) for (let k = 0; k <= 5; k++) {
    const a = c.a0 + ((c.a1 - c.a0) * k) / 5;
    pts.push({ x: r2(c.x + Math.cos(a) * r), z: r2(c.z + Math.sin(a) * r) });
  }
  return cw ? pts : pts.reverse();
}

// ---- houses --------------------------------------------------------------------------------------------------------

// One house: the footprint f, which side faces the street, how tall the street wants it, and the sight rule's cap. The
// roof is a slate or tile gable along the street, a mansard (hip), or now and then flat; a low roof is chosen when
// it buys the house its third storey near the office.
function house(R, f, front, want, lot, o = {}) {
  const w = f.maxX - f.minX, d = f.maxZ - f.minZ;
  if (w < 3.2 || d < 3.2) return null;
  const gap = rectGap(f, lot), maxH = Math.max(3.2, sight(gap)) - Math.max(0, o.y ?? 0);
  const along = front === "n" || front === "s" ? "x" : "z";
  const deep = along === "x" ? d : w, wide = along === "x" ? w : d;
  let roof = o.roof ?? (R() < 0.62 ? "gable" : R() < 0.8 ? "hip" : "flat");
  let roofH = roof === "flat" ? 0.35 : roof === "hip" ? Math.min(2.4, deep * 0.24) : o.roofH ?? Math.min(4.2, deep * 0.38);
  let floors = Math.floor((maxH - roofH) / STOREY);
  if (floors < Math.min(want, 3) && roof !== "flat") {
    // a lower roof for one more storey
    const low = maxH - Math.min(want, 3) * STOREY;
    if (low >= 0.9) { roof = "hip"; roofH = Math.min(roofH, low - 0.01); floors = Math.min(want, 3); }
  }
  floors = clamp(Math.min(want, floors), 1, 6);
  const ridge = o.ridge ?? (roof === "gable" ? along : w >= d ? "x" : "z");
  return {
    x: r2((f.minX + f.maxX) / 2), z: r2((f.minZ + f.maxZ) / 2), w: r2(w), d: r2(d), y: o.y ?? LEVEL.walk,
    floors, h: r2(floors * STOREY), roof, roofH: down2(roofH), ridge, front, wide: r2(wide),
    style: o.style ?? "row", wall: o.wall ?? Math.floor(R() * WALLS), roofTint: o.roofTint ?? Math.floor(R() * 4),
    shop: !!o.shop, awning: o.shop && R() < 0.6 ? Math.floor(R() * 5) : null, seed: Math.floor(R() * 1e9),
    steps: !!o.steps, ends: o.ends ?? [], dormers: roof === "gable" && roofH > 1.8 && R() < 0.55,
  };
}

// A perimeter block: a continuous row of houses along each street, 3 to 6 storeys where the sight rule lets them
// rise, a courtyard of trees in the middle. Neighbours never share a colour.
function perimeter(R, block, buildings, trees, spires, lot) {
  const I = block.inner, W = I.maxX - I.minX, D = I.maxZ - I.minZ;
  const rowD = clamp(Math.min(W, D) * 0.34, 7.5, 11);
  const sides = D >= 2 * rowD + 3 && W >= 2 * rowD + 3;
  const rows = [
    { r: rect(I.minX, I.minZ, I.maxX, I.minZ + rowD), front: "n", along: "x" },
    { r: rect(I.minX, I.maxZ - rowD, I.maxX, I.maxZ), front: "s", along: "x" },
  ];
  if (sides) {
    rows.push({ r: rect(I.minX, I.minZ + rowD, I.minX + rowD, I.maxZ - rowD), front: "w", along: "z" });
    rows.push({ r: rect(I.maxX - rowD, I.minZ + rowD, I.maxX, I.maxZ - rowD), front: "e", along: "z" });
  }
  const base = 4 + Math.floor(R() * 2.5), brick = R() < 0.3;
  let lastWall = -1;
  for (const row of rows) {
    const len = row.along === "x" ? row.r.maxX - row.r.minX : row.r.maxZ - row.r.minZ;
    const cuts = [0];
    while (len - cuts.at(-1) > 13) cuts.push(cuts.at(-1) + 6.2 + R() * 5);
    cuts.push(len);
    if (cuts.length > 2 && cuts.at(-1) - cuts.at(-2) < 5) cuts.splice(cuts.length - 2, 1);
    for (let k = 0; k < cuts.length - 1; k++) {
      const a = cuts[k], b = cuts[k + 1];
      const p = row.along === "x" ? rect(row.r.minX + a, row.r.minZ, row.r.minX + b, row.r.maxZ) : rect(row.r.minX, row.r.minZ + a, row.r.maxX, row.r.minZ + b);
      // the ends of the long rows turn the corner: their sides face the cross streets
      const first = k === 0, last = k === cuts.length - 2;
      const ends = row.along === "x" ? [...(first ? ["w"] : []), ...(last ? ["e"] : [])] : [];
      let wall = Math.floor(R() * WALLS);
      if (brick && R() < 0.6) wall = 9 + Math.floor(R() * 3);
      if (wall === lastWall) wall = (wall + 1 + Math.floor(R() * (WALLS - 1))) % WALLS;
      lastWall = wall;
      const want = clamp(base + (R() < 0.3 ? (R() < 0.5 ? -1 : 1) : 0), 3, 6);
      const corner = ends.length > 0;
      const b0 = house(R, p, row.front, want, lot, { wall, shop: R() < (corner ? 0.6 : 0.3), ends, steps: corner && R() < 0.3 });
      if (!b0) continue;
      buildings.push(b0);
      // now and then a wall dormer: a narrow bay of the front carried up past the eaves with its own gable
      if (b0.roof !== "flat" && b0.wide >= 7 && R() < 0.35) gablet(R, b0, buildings, lot);
      else if (corner && R() < 0.2) turret(R, b0, ends[0], buildings, spires, lot);
    }
  }
  // the courtyard: trees, as many as fit
  const yard = rect(I.minX + (sides ? rowD : 0), I.minZ + rowD, I.maxX - (sides ? rowD : 0), I.maxZ - rowD);
  if (yard.maxX - yard.minX > 3 && yard.maxZ - yard.minZ > 3) {
    const n = 2 + Math.floor(R() * 3);
    for (let k = 0; k < n; k++) {
      const x = yard.minX + 1.5 + R() * Math.max(0.1, yard.maxX - yard.minX - 3), z = yard.minZ + 1.5 + R() * Math.max(0.1, yard.maxZ - yard.minZ - 3);
      const tall = sight(rectGap(rect(x - 1.3, z - 1.3, x + 1.3, z + 1.3), lot)) / 4.2;
      trees.push({ kind: R() < 0.15 ? "maple-red" : "round", x: r2(x), z: r2(z), y: LEVEL.walk, s: down2(Math.min(tall, 0.8 + R() * 0.45)), ry: r2(R() * 6.28), tone: r2(0.9 + R() * 0.15) });
    }
  }
}

// A corner turret on b: a square bay on the street corner (`end` is the cross street's side), a storey above the eaves
// under a pointed copper cap.
function turret(R, b, end, buildings, spires, lot) {
  const t = 2.6, sx = end === "e" ? 1 : -1, sz = b.front === "s" ? 1 : -1;
  const x = b.x + sx * (b.w / 2 - t / 2 + 0.2), z = b.z + sz * (b.d / 2 - t / 2 + 0.2);
  const f = rect(x - t / 2, z - t / 2, x + t / 2, z + t / 2);
  const h = down2(b.h + b.roofH * 0.6 + 0.6), cap = 2.8;
  if (h + cap > sight(rectGap(f, lot))) return;
  buildings.push({ x: r2(x), z: r2(z), w: t, d: t, y: b.y, floors: Math.floor(h / STOREY), h, roof: "spire", roofH: cap, ridge: "x", front: b.front, wide: t, style: "tower", wall: b.wall, roofTint: 4, shop: false, awning: null, seed: Math.floor(R() * 1e9), steps: false, ends: [], dormers: false });
  spires.push({ x: r2(x), z: r2(z), y: r2(b.y + h), h: cap, w: t });
}

// A wall dormer on the street front of b: a bay a third as wide, one storey above the eaves, its gable to the street.
function gablet(R, b, buildings, lot) {
  const along = b.front === "n" || b.front === "s" ? "x" : "z";
  const cw = Math.min(3.6, b.wide * 0.36), depth = (along === "x" ? b.d : b.w) / 2;
  const sign = b.front === "n" || b.front === "w" ? -1 : 1;
  const cx = along === "x" ? b.x : b.x + sign * (b.w / 2 - depth / 2);
  const cz = along === "x" ? b.z + sign * (b.d / 2 - depth / 2) : b.z;
  const f = along === "x" ? rect(cx - cw / 2, cz - depth / 2, cx + cw / 2, cz + depth / 2) : rect(cx - depth / 2, cz - cw / 2, cx + depth / 2, cz + cw / 2);
  const h = down2(b.h + STOREY * 0.8), roofH = down2(cw * 0.55);
  if (h + roofH > sight(rectGap(f, lot))) return;
  buildings.push({
    x: r2(cx), z: r2(cz), w: r2(f.maxX - f.minX), d: r2(f.maxZ - f.minZ), y: b.y, floors: b.floors, h, roof: "gable", roofH,
    ridge: along === "x" ? "z" : "x", front: b.front, wide: r2(cw), style: "gablet", wall: b.wall, roofTint: b.roofTint, shop: false, awning: null,
    seed: Math.floor(R() * 1e9), steps: R() < 0.4, ends: [], dormers: false,
  });
}

// The canal houses: narrow, tall, their gables (often stepped) to the water, a café under an awning in many, café
// tables on the quay. A lane through the row where each bridge lands.
function canalRow(R, canal, band, at, f1, h1, alongOf, buildings, trees, props, lot) {
  const row = canal.row, side = canal.side, rowX = side === "n" || side === "s";
  const front = { n: "s", s: "n", w: "e", e: "w" }[side];
  const lo = rowX ? row.minX : row.minZ, hi = rowX ? row.maxX : row.maxZ;
  const gaps = canal.bridges.map((b) => [b.u - 1.9, b.u + 1.9]);
  let u = Math.max(lo, canal.mid - 70), lastWall = -1;
  while (u < Math.min(hi, canal.mid + 70)) {
    const w = 4.2 + R() * 2.4;
    let a = u, b = u + w;
    const g = gaps.find(([g0, g1]) => b > g0 && a < g1);
    if (g) { u = g[1]; continue; }
    u = b;
    const f = rowX ? rect(a, row.minZ, b, row.maxZ) : rect(row.minX, a, row.maxX, b);
    if (rectGap(f, lot) > FADE.to + 2) continue;
    let wall = Math.floor(R() * 9);
    if (wall === lastWall) wall = (wall + 1 + Math.floor(R() * 8)) % 9;
    lastWall = wall;
    const cafe = R() < 0.55;
    const ridge = rowX ? "z" : "x";
    const hs = house(R, f, front, 3 + Math.floor(R() * 3), lot, { wall, roof: "gable", roofH: w * 0.85, ridge, shop: cafe, steps: R() < 0.45, style: "canal", roofTint: Math.floor(R() * 4), y: LEVEL.quay });
    if (!hs) continue;
    buildings.push(hs);
    // café tables on the quay in front
    if (cafe) for (let k = 0; k < 2; k++) {
      const p = at(a + w * (0.28 + k * 0.44), f1 - 1.0);
      props.push({ kind: "table", x: r2(p.x), z: r2(p.z), y: LEVEL.quay, ry: 0, c: hs.awning ?? 0 });
    }
  }
  // bollards along both quay edges with a harbour lamp on a post every third, and trees in the yard behind the row
  for (let v = canal.mid - 60, n = 0; v < canal.mid + 60; v += 4.5, n++) {
    if (gaps.some(([g0, g1]) => v > g0 - 0.6 && v < g1 + 0.6)) continue;
    for (const a of [CANAL.near - 0.35, CANAL.near + CANAL.water + 0.35]) {
      const p = at(v, a);
      if (distToRect(p.x, p.z, lot) < FADE.to) props.push({ kind: n % 3 === 1 ? "post" : "bollard", x: r2(p.x), z: r2(p.z), y: LEVEL.quay, ry: 0, c: 0 });
    }
  }
  for (let v = canal.mid - 50; v < canal.mid + 50; v += 5 + R() * 4) {
    const p = at(v, h1 + CANAL.back / 2);
    const tall = (sight(Math.max(0, distToRect(p.x, p.z, lot) - 1.3)) - LEVEL.quay) / 4.2;
    trees.push({ kind: "round", x: r2(p.x), z: r2(p.z), y: LEVEL.quay, s: down2(Math.min(tall, 0.7 + R() * 0.3)), ry: r2(R() * 6.28), tone: r2(0.9 + R() * 0.15) });
  }
}

// Boats moored along the quays, bows along the canal: one old two-masted ship, small sailboats and open motor boats.
function moor(R, canal, at, w0, w1) {
  const boats = [];
  const gaps = canal.bridges.map((b) => [b.u - 3.4, b.u + 3.4]);
  const sideways = canal.side === "n" || canal.side === "s" ? Math.PI / 2 : 0;
  for (const quay of [1, 0]) {
    let u = canal.mid - 30 + R() * 6;
    while (u < canal.mid + 32 && boats.length < CAPS.boats) {
      const kind = quay === 1 && !boats.some((b) => b.kind === "ship") && R() < 0.5 ? "ship" : R() < 0.55 ? "sail" : "motor";
      const B = BOATS[kind];
      const a = u, b = u + B.len;
      if (gaps.some(([g0, g1]) => b > g0 && a < g1)) { u += 2; continue; }
      if (R() < 0.3) { u += 3 + R() * 4; continue; }
      const across = quay === 1 ? w1 - 0.3 - B.beam / 2 : w0 + 0.3 + B.beam / 2;
      const p = at((a + b) / 2, across);
      boats.push({ kind, x: r2(p.x), z: r2(p.z), ry: r3(sideways + (R() < 0.5 ? 0 : Math.PI)), len: B.len, beam: B.beam, mast: B.mast, paint: Math.floor(R() * BOAT_PAINTS), phase: r2(R() * 6.28) });
      u = b + 1 + R() * 3;
    }
  }
  return boats;
}

// ---- squares, parks, the street ------------------------------------------------------------------------------------

// A square of setts: a fountain or a statue on a plinth in the middle, trees in rows round it, benches facing in,
// café tables and parked bikes.
function square(R, block, trees, props, racks, lot) {
  const I = block.inner, cx = (I.minX + I.maxX) / 2, cz = (I.minZ + I.maxZ) / 2;
  props.push({ kind: R() < 0.6 ? "fountain" : "statue", x: r2(cx), z: r2(cz), y: LEVEL.walk, ry: 0, c: 0 });
  const rowOf = (a, b, n, face) => {
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n, x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t;
      const tall = sight(Math.max(0, distToRect(x, z, lot) - 1.3)) / 4.2;
      trees.push({ kind: "street", x: r2(x), z: r2(z), y: LEVEL.walk, s: down2(Math.min(tall, 0.72 + R() * 0.12)), ry: r2(R() * 6.28), tone: r2(0.92 + R() * 0.1) });
      if (k < n - 1) {
        const t2 = (k + 1) / n;
        props.push({ kind: "bench", x: r2(a.x + (b.x - a.x) * t2 + Math.sin(face) * 0.6), z: r2(a.z + (b.z - a.z) * t2 + Math.cos(face) * 0.6), y: LEVEL.walk, ry: r3(face), c: 0 });
      }
    }
  };
  const m = 1.8, nX = Math.max(2, Math.round((I.maxX - I.minX - 2 * m) / 6)), nZ = Math.max(2, Math.round((I.maxZ - I.minZ - 2 * m) / 6));
  rowOf({ x: I.minX + m, z: I.minZ + m }, { x: I.maxX - m, z: I.minZ + m }, nX, 0);
  rowOf({ x: I.minX + m, z: I.maxZ - m }, { x: I.maxX - m, z: I.maxZ - m }, nX, Math.PI);
  rowOf({ x: I.minX + m, z: I.minZ + m + 6 }, { x: I.minX + m, z: I.maxZ - m - 6 }, Math.max(1, nZ - 2), Math.PI / 2);
  rowOf({ x: I.maxX - m, z: I.minZ + m + 6 }, { x: I.maxX - m, z: I.maxZ - m - 6 }, Math.max(1, nZ - 2), -Math.PI / 2);
  for (let k = 0; k < 4; k++) {
    const a = R() * Math.PI * 2, r = 4.2 + R() * 1.6;
    props.push({ kind: "table", x: r2(cx + Math.cos(a) * r), z: r2(cz + Math.sin(a) * r), y: LEVEL.walk, ry: r2(R() * 3), c: Math.floor(R() * 5) });
  }
  const n = 4 + Math.floor(R() * 5);
  for (let k = 0; k < n; k++) racks.push({ x: r2(I.minX + m + 3 + k * 0.6), z: r2(I.maxZ - m - 1.4), ry: r3(Math.PI / 2 + (R() - 0.5) * 0.3), paint: Math.floor(R() * BIKE_PAINTS), cargo: R() < 0.12 });
}

function park(R, block, trees, props) {
  const I = block.inner;
  for (let k = 0; k < 40; k++) {
    const x = I.minX + 1.5 + R() * (I.maxX - I.minX - 3), z = I.minZ + 1.5 + R() * (I.maxZ - I.minZ - 3), c = R();
    if (Math.abs(x - (I.minX + I.maxX) / 2) < 1.6 || Math.abs(z - (I.minZ + I.maxZ) / 2) < 1.6) continue;
    if (R() < 0.55) trees.push({ kind: c < 0.15 ? "maple-red" : "round", x: r2(x), z: r2(z), y: LEVEL.walk, s: r2(0.7 + R() * 0.45), ry: r2(R() * 6.28), tone: r2(0.9 + R() * 0.15) });
  }
  props.push({ kind: "bench", x: r2((I.minX + I.maxX) / 2 + 2.4), z: r2((I.minZ + I.maxZ) / 2 - 1.6), y: LEVEL.walk, ry: 0, c: 0 });
}

// Along a block's pavements: trees in rows at the kerb on some streets, benches, and bikes parked against the houses.
// canalSide: the canal block's side; its street on the lot's side gets the same, its far street nothing.
function streetside(R, block, trees, racks, props, lot, canalSide) {
  const SW = ROAD.walk, BK = ROAD.bike, o = block.outer;
  const edges = [
    { n: "n", a: { x: o.minX, z: o.minZ }, b: { x: o.maxX, z: o.minZ }, ix: 0, iz: 1 },
    { n: "s", a: { x: o.minX, z: o.maxZ }, b: { x: o.maxX, z: o.maxZ }, ix: 0, iz: -1 },
    { n: "w", a: { x: o.minX, z: o.minZ }, b: { x: o.minX, z: o.maxZ }, ix: 1, iz: 0 },
    { n: "e", a: { x: o.maxX, z: o.minZ }, b: { x: o.maxX, z: o.maxZ }, ix: -1, iz: 0 },
  ];
  for (const e of edges) {
    if (canalSide && e.n !== { n: "s", s: "n", w: "e", e: "w" }[canalSide]) continue;
    if (canalSide) {
      // the canal block's long street: only the stretch near the lot
      const mid = e.ix === 0 ? (lot.minX + lot.maxX) / 2 : (lot.minZ + lot.maxZ) / 2;
      e.a = e.ix === 0 ? { x: mid - 55, z: e.a.z } : { x: e.a.x, z: mid - 55 };
      e.b = e.ix === 0 ? { x: mid + 55, z: e.b.z } : { x: e.b.x, z: mid + 55 };
    }
    const L = Math.hypot(e.b.x - e.a.x, e.b.z - e.a.z), ux = (e.b.x - e.a.x) / L, uz = (e.b.z - e.a.z) / L;
    const pt = (t, inward) => ({ x: e.a.x + ux * t + e.ix * inward, z: e.a.z + uz * t + e.iz * inward });
    const clear = (t) => t > BK + SW + 1.2 && t < L - BK - SW - 1.2;
    const leafy = R() < 0.5;
    if (leafy) {
      const gap = 7 + R() * 2;
      for (let t = BK + SW + 2.5; t < L - BK - SW - 2; t += gap) {
        const p = pt(t, BK + 0.5);
        if (distToRect(p.x, p.z, lot) < 1.4) continue;
        const tall = sight(Math.max(0, distToRect(p.x, p.z, lot) - 1.3)) / 4.2;
        trees.push({ kind: "street", x: r2(p.x), z: r2(p.z), y: LEVEL.walk, s: down2(Math.min(tall, 0.62 + R() * 0.2)), ry: r2(R() * 6.28), tone: r2(0.9 + R() * 0.15) });
        if (R() < 0.18) { const q = pt(t + 1.6, BK + 0.5); props.push({ kind: "bench", x: r2(q.x), z: r2(q.z), y: LEVEL.walk, ry: r3(Math.atan2(-e.ix, -e.iz)), c: 0 }); }
      }
    }
    // bikes against the houses (not along the lot or the canal, where there are none)
    if (block.kind === "lot" || canalSide) continue;
    for (let k = 0; k < 2; k++) {
      if (R() < 0.3 || rectGap(block.inner, lot) > 34) continue;
      const t0 = BK + SW + 2 + R() * Math.max(0, L - 2 * (BK + SW) - 8), n = 3 + Math.floor(R() * 6);
      for (let m = 0; m < n; m++) {
        const t = t0 + m * 0.58;
        if (!clear(t)) continue;
        const p = pt(t, BK + SW - 0.32);
        racks.push({ x: r2(p.x), z: r2(p.z), ry: r3(Math.atan2(ux, uz) + (R() - 0.5) * 0.35), paint: Math.floor(R() * BIKE_PAINTS), cargo: R() < 0.08 });
      }
    }
  }
}

// One civic building out where the sight rule lets it rise: a copper-green mansard and, in front, a slim tower with a
// copper spire.
function civic(R, buildings, spires, lot) {
  const pool = buildings.filter((b) => b.style === "row" && b.w >= 8 && b.d >= 7.5 && rectGap(rect(b.x - b.w / 2, b.z - b.d / 2, b.x + b.w / 2, b.z + b.d / 2), lot) > 24 && rectGap(rect(b.x - b.w / 2, b.z - b.d / 2, b.x + b.w / 2, b.z + b.d / 2), lot) < 40);
  if (!pool.length) return;
  const b = pool[Math.floor(R() * pool.length)];
  b.style = "civic"; b.roof = "hip"; b.roofH = r2(Math.min(2.6, Math.min(b.w, b.d) * 0.3)); b.roofTint = 4; b.wall = 7; b.shop = false; b.awning = null; b.dormers = false;
  b.floors = Math.min(b.floors, 3); b.h = r2(b.floors * STOREY);
  // the tower stands on the front, in the middle
  const t = 3.0, sign = b.front === "n" || b.front === "w" ? -1 : 1;
  const tx = b.front === "e" || b.front === "w" ? b.x + sign * (b.w / 2 - t / 2 + 0.4) : b.x, tz = b.front === "n" || b.front === "s" ? b.z + sign * (b.d / 2 - t / 2 + 0.4) : b.z;
  const gap = rectGap(rect(tx - t / 2, tz - t / 2, tx + t / 2, tz + t / 2), lot), cap = sight(gap);
  const towerH = down2(b.h + STOREY * 1.3), spireH = down2(Math.min(9, cap - towerH));
  if (spireH < 3) return;
  buildings.push({ x: r2(tx), z: r2(tz), w: t, d: t, y: b.y, floors: b.floors + 1, h: towerH, roof: "spire", roofH: spireH, ridge: "x", front: b.front, wide: t, style: "tower", wall: 7, roofTint: 4, shop: false, awning: null, seed: Math.floor(R() * 1e9), steps: false, ends: [], dormers: false });
  spires.push({ x: r2(tx), z: r2(tz), y: r2(b.y + towerH), h: spireH, w: t });
}

// Lamps hung on wires across the streets, every 13 to 16 m: house to house where there are houses, a slim mast at
// the kerb where one side has none. A street with no houses either side (the canal's) is lit from posts on the quay.
function hangLamps(R, roads, buildings, lot) {
  const BK = ROAD.bike, SW = ROAD.walk, half = ROAD.w / 2, Y = 5.7;
  const spans = [];
  const faceAt = (x, z) => buildings.find((b) => b.style !== "gablet" && b.h >= Y + 0.4 && Math.abs(x - b.x) <= b.w / 2 && Math.abs(z - b.z) <= b.d / 2);
  for (const r of roads) {
    if (rectGap(r, lot) > FADE.to - 4) continue;
    const alongX = r.dir === "x", L = alongX ? r.maxX - r.minX : r.maxZ - r.minZ;
    const n = Math.max(1, Math.round(L / 14.5));
    const c = alongX ? (r.minZ + r.maxZ) / 2 : (r.minX + r.maxX) / 2;
    for (let k = 0; k < n; k++) {
      const u = (alongX ? r.minX : r.minZ) + (L * (k + 0.5)) / n;
      const end = (sgn) => {
        // just inside the house line on this side; a house there takes the wire, or a mast at the kerb
        const o = half + BK + SW + 0.3;
        const px = alongX ? u : c + sgn * o, pz = alongX ? c + sgn * o : u;
        const b = faceAt(px, pz);
        return { t: r2(sgn * (b ? half + BK + SW : half + BK + 0.35)), mast: !b };
      };
      const a = end(-1), b = end(1);
      const p0 = alongX ? { x: u, z: c + a.t } : { x: c + a.t, z: u }, p1 = alongX ? { x: u, z: c + b.t } : { x: c + b.t, z: u };
      if (distToRect(p0.x, p0.z, lot) < 0.2 || distToRect(p1.x, p1.z, lot) < 0.2 || (a.mast && b.mast)) continue;
      spans.push({ x0: r2(p0.x), z0: r2(p0.z), x1: r2(p1.x), z1: r2(p1.z), y: Y, mast0: a.mast, mast1: b.mast });
    }
  }
  return spans;
}
