// The garden round the building as scenery pieces, calm and Japandi: a gravel drip edge, birches and a few pines behind
// it and to its left (off the camera's side of the default view, so nothing tall hides a room), clipped shrubs and
// grasses along the front, a bed of raked gravel, a corner at the front left (a maple on moss, a stone lantern by a
// water basin, stepping stones on gravel), a paved path with bollards from the front door, a bike rack and a bench, a
// timber deck by the east wall. Everything stays within REACH of the building, where the land (scenery.js) starts.
// Positions are in the layout's frame with the ground at y = -0.12, as the generator's; the sink moves them.

export const REACH = 7;
const Y = -0.12;
const jitter = (i) => (((i * 7919) % 100) / 100 - 0.5);

// The middle of the front door (an outer door on the south side, toward the default view), or null.
export function frontDoor(layout) {
  const b = layout.bounds;
  const fronts = layout.walls.filter((w) => w.door && (!w.a || !w.b) && w.dir === "x" && w.z === b.maxZ);
  return fronts.length ? (Math.min(...fronts.map((w) => w.x)) + Math.max(...fronts.map((w) => w.x)) + 1) / 2 : null;
}

// s: the sink (scenery.js). entry: where the land's path starts (nature), for the stepping stones that join it, or null.
export function garden(s, layout, entry = null) {
  const b = layout.bounds, shadow = true;
  const put = (type, x, z, more = {}) => s.put(type, x, more.y ?? Y, z, { shadow, ...more });
  const gravel = (minX, minZ, maxX, maxZ, tint) => s.quad(minX, minZ, maxX, maxZ, Y + 0.006, tint);

  // the gravel drip edge round the building
  const g = 0.5;
  gravel(b.minX - g, b.minZ - g, b.maxX + g, b.minZ, "land/drip-gravel");
  gravel(b.minX - g, b.maxZ, b.maxX + g, b.maxZ + g, "land/drip-gravel");
  gravel(b.minX - g, b.minZ, b.minX, b.maxZ, "land/drip-gravel");
  gravel(b.maxX, b.minZ, b.maxX + g, b.maxZ, "land/drip-gravel");

  // birches behind and to the left, pines further back
  let i = 0;
  for (let x = b.minX - 2.5; x <= b.maxX + 1.5; x += 2.9, i++) put("tree-birch", x + jitter(i) * 1.2, b.minZ - 2.0 - Math.abs(jitter(i + 7)) * 2.2, { s: 0.95 + jitter(i + 3) * 0.3, ry: i });
  for (let x = b.minX + 1; x <= b.maxX + 3; x += 8.5, i++) put("pine", x + jitter(i) * 2, b.minZ - 5.0 + jitter(i + 1), { s: 1.0 + jitter(i + 2) * 0.3, ry: i });
  for (let z = b.minZ + 0.8; z <= b.maxZ - 1; z += 3.1, i++) put("tree-birch", b.minX - 2.2 - Math.abs(jitter(i)) * 1.5, z + jitter(i + 1), { s: 0.9 + jitter(i + 4) * 0.3, ry: i });
  for (let z = b.minZ + 2; z <= b.maxZ + 0.5; z += 8.5, i++) put("pine", b.minX - 5.0 + jitter(i), z, { s: 1 + jitter(i + 2) * 0.3, ry: i });
  put("tree-birch", b.maxX - 1.5, b.minZ - 3.4, { ry: 5 });

  const doorX = frontDoor(layout);

  // clipped shrubs and grasses along the front, spaced out, leaving the door clear
  let k = 0;
  for (let x = b.minX + 0.8; x < b.maxX - 0.3; x += 1.9, k++) {
    if (doorX !== null && Math.abs(x - doorX) < 1.6) continue;
    if (k % 3 === 1) put("grass-clump", x, b.maxZ + 0.95, { ry: k, shadow: false });
    else put("shrub-clipped", x, b.maxZ + 0.95, { s: (0.26 + (k % 2) * 0.06) / 0.3, ry: k });
  }

  // a bed of raked gravel in front
  const bedEnd = doorX !== null ? doorX - 3.6 : b.maxX - 1;
  if (bedEnd - b.minX > 3) {
    const x0 = b.minX + 1.2, z0 = b.maxZ + 1.5;
    put("gravel-bed", (x0 + bedEnd) / 2, z0 + 0.8, { params: { w: Math.round((bedEnd - x0) * 10) / 10, d: 1.6 }, shadow: false });
  }

  // the corner off the front left, on gravel: a maple on a moss mound, a stone lantern by a water basin, stepping stones
  const jx = b.minX - 2.2, jz = b.maxZ + 1.6;
  gravel(jx + 1.0 - 2.2, jz + 0.5 - 1.7, jx + 1.0 + 2.2, jz + 0.5 + 1.7, "land/garden-gravel");
  put("moss", jx, jz, { s: 1.25, shadow: false, y: Y + 0.006 });
  put("moss", jx + 1.3, jz + 0.9, { s: 0.6, shadow: false, y: Y + 0.006 });
  put("garden-maple", jx, jz, { s: 1.05 });
  put("stone-lantern", jx + 1.7, jz - 0.9, { s: 0.9 });
  put("light-pool", jx + 1.7, jz - 0.9, { s: [2.2, 1, 2.2], shadow: false, y: Y + 0.012 });
  put("basin", jx + 2.4, jz + 0.1);
  for (const [sx, sz] of [[0.6, 1.6], [1.4, 2.0], [2.3, 2.2], [3.2, 2.0]]) put("step-stone", jx + sx, jz + sz, { s: [0.73, 1, 0.73], ry: sx, shadow: false, y: Y + 0.006 });
  put("shrub-clipped", b.minX - 0.6, b.maxZ + 0.6);

  if (doorX !== null) {
    // the path: pavers from the door to the edge of the garden, bollards beside it
    for (let n = 0; n < Math.floor((REACH - 0.6) / 0.62); n++) {
      put("paver", doorX + (n % 2) * 0.06, b.maxZ + 0.6 + n * 0.62, { shadow: false, tint: n % 2 ? "#ffffff" : "#f4f2ee" });
    }
    for (const n of [1, 3, 5]) for (const sd of [-1, 1]) {
      put("garden-bollard", doorX + sd * 0.9, b.maxZ + 0.6 + n * 0.95);
      put("light-pool", doorX + sd * 0.9, b.maxZ + 0.6 + n * 0.95, { s: [1.6, 1, 1.6], shadow: false, y: Y + 0.05 });
    }
    // a bike rack (three steel hoops) with a bike in it, and a bench facing the lawn
    const rx = doorX + 2.2, rz = b.maxZ + 1.9;
    put("bike-rack", rx + 0.5, rz, { ry: Math.PI / 2 });
    put("bike", rx + 0.25, rz, { ry: Math.PI / 2, tint: "land/bike-2" });
    const bx = doorX - 2.6, bz = b.maxZ + 2.2;
    put("garden-bench", bx, bz);
    put("shrub-clipped", bx - 1.2, bz - 0.1, { s: 0.8 });
    // stepping stones from the end of the path to where the land's path starts
    if (entry) {
      const from = { x: doorX, z: b.maxZ + REACH - 0.3 }, len = Math.hypot(entry.x - from.x, entry.z - from.z);
      const n = Math.max(1, Math.round(len / 0.7)), nx = -(entry.z - from.z) / (len || 1), nz = (entry.x - from.x) / (len || 1);
      for (let j = 0; j <= n; j++) {
        const t = j / n, off = (j % 2 ? 0.12 : -0.12) * (j > 0 && j < n ? 1 : 0);
        put("step-stone", from.x + (entry.x - from.x) * t + nx * off, from.z + (entry.z - from.z) * t + nz * off, { ry: j, shadow: false, tint: j % 2 ? "#ffffff" : "#f0eee8" });
      }
    }
  }

  // a timber deck along the east wall with a planter
  const dx = b.maxX + 0.6, dz0 = b.minZ + 0.5, dz1 = Math.min(b.maxZ - 0.5, b.minZ + 4.2);
  if (dz1 - dz0 > 2) {
    put("deck", dx + 1.2, (dz0 + dz1) / 2, { params: { w: 2.4, d: Math.round((dz1 - dz0) * 10) / 10 } });
    put("garden-bench", dx + 1.4, dz0 + 1.5, { y: Y + 0.06, ry: -Math.PI / 2 });
    s.put("block", dx + 2.0, Y + 0.06, dz1 - 0.4, { s: [0.5, 0.36, 0.5], tint: "land/charcoal", shadow: true });
    put("shrub-clipped", dx + 2.0, dz1 - 0.4, { y: Y + 0.42 });
  }
}
