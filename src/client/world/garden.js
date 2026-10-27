// The garden round the building, calm and Japandi: a gravel drip edge, birches and a few pines behind it and to its
// left (kept off the camera's side of the default view, so nothing tall hides a room), clipped shrubs and grasses
// along the front, a bed of raked gravel with stones and moss islands, a corner at the front left (a maple, a stone
// lantern by a water basin, moss and stepping stones on gravel), a paved path with bollards from the front door to the
// edge of the lot, a bike rack and a bench, a timber deck by the east wall. Everything stays within REACH of the
// building, so the land round it (outside/) starts where the garden ends.
import { THREE } from "./kit.js";
import { bike } from "./props.js";

export const REACH = 7;
const jitter = (i) => (((i * 7919) % 100) / 100 - 0.5);
const rand = (seed) => { let s = seed >>> 0 || 1; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); };

// A Japanese maple: a leaning trunk, three limbs, a wide crown of small pads in tiers (so it reads as a maple and not
// a ball) in reds and oranges, fallen leaves under it. y: the ground.
export function maple(kit, x, z, s = 1, seed = 1, y = -0.12) {
  const r = rand(seed), trunk = "#4a3a2e";
  kit.cyl(0.1 * s, 1.0 * s, trunk, x, y, z, { top: 0.07 * s, seg: 7, rz: 0.12 });
  kit.box(0.07 * s, 0.7 * s, 0.07 * s, trunk, x + 0.12 * s, y + 0.85 * s, z, { rz: -0.8 });
  kit.box(0.06 * s, 0.6 * s, 0.06 * s, trunk, x + 0.05 * s, y + 0.9 * s, z, { rz: 0.7, rx: 0.3 });
  kit.box(0.05 * s, 0.6 * s, 0.05 * s, trunk, x - 0.1 * s, y + 1.0 * s, z + 0.1 * s, { rz: 0.9, rx: -0.4 });
  const reds = ["#9e4a32", "#b4593a", "#88402c", "#c06a44"];
  for (let i = 0; i < 13; i++) {
    const a = i * 2.39 + r() * 0.5, tier = i % 3, d = (0.35 + tier * 0.33 + r() * 0.15) * s;
    kit.sphere((0.42 - tier * 0.06 + r() * 0.08) * s, reds[i % 4], x + Math.cos(a) * d + 0.1 * s, y + (2.05 - tier * 0.28 + r() * 0.2) * s, z + Math.sin(a) * d, { sy: 0.5, detail: 1, ry: r() * 3 });
  }
  for (let i = 0; i < 14; i++) { const a = r() * 6.28, d = r() * 1.4 * s; kit.box(0.06, 0.006, 0.05, reds[i % 2], x + Math.cos(a) * d, y + 0.005, z + Math.sin(a) * d, { ry: a }); }
}

// A stone lantern of our own: a square plinth, a round post, a lit box with paper windows (into `glow`), a wide flat
// cap and a knob. Returns its light's point.
export function stoneLantern(kit, glow, x, z, s = 1, y = -0.12) {
  const stone = "#a29d92", stone2 = "#8f8a80";
  kit.box(0.6 * s, 0.14 * s, 0.6 * s, stone, x, y, z);
  kit.cyl(0.11 * s, 0.55 * s, stone2, x, y + 0.14 * s, z, { seg: 8 });
  kit.box(0.46 * s, 0.08 * s, 0.46 * s, stone, x, y + 0.69 * s, z);
  const by = y + 0.77 * s;
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) kit.box(0.08 * s, 0.34 * s, 0.08 * s, stone2, x + sx * 0.15 * s, by, z + sz * 0.15 * s);
  glow.box(0.24 * s, 0.26 * s, 0.24 * s, "#fff1d6", x, by + 0.04 * s, z);
  kit.box(0.78 * s, 0.07 * s, 0.78 * s, stone, x, by + 0.34 * s, z);
  kit.cyl(0.5 * s, 0.12 * s, stone2, x, by + 0.41 * s, z, { top: 0.12 * s, seg: 4, ry: Math.PI / 4 });
  kit.sphere(0.07 * s, stone, x, by + 0.58 * s, z, { detail: 1 });
  return { x, y: by + 0.15 * s, z };
}

// A stone water basin with a bamboo spout, and a ladle across it.
export function basin(kit, x, z, y = -0.12, night = false) {
  kit.cyl(0.32, 0.3, "#8f8a80", x, y, z, { top: 0.28, seg: 9 });
  kit.cyl(0.24, 0.02, night ? "#2c3d52" : "#5f7f8e", x, y + 0.29, z, { seg: 9 });
  kit.box(0.04, 0.04, 0.6, "#8a8a5a", x, y + 0.36, z - 0.22, { rx: 0.2 });
  kit.box(0.02, 0.02, 0.36, "#b8925a", x + 0.05, y + 0.31, z, { ry: 0.6 });
  for (let k = 0; k < 4; k++) kit.sphere(0.12 + (k % 2) * 0.05, "#a29d92", x + Math.cos(k * 1.7) * 0.42, y, z + Math.sin(k * 1.7) * 0.42, { sy: 0.5, detail: 0, ry: k });
}

// A low moss mound.
function moss(kit, x, z, r, y, hex = "#6b8a4e") { kit.sphere(r, hex, x, y - r * 0.12, z, { sy: 0.32, detail: 1 }); }

function birch(kit, x, y, z, s, i) {
  const bark = "#ece8df";
  kit.cyl(0.06 * s, 2.7 * s, bark, x, y, z, { top: 0.035 * s, seg: 6, rz: jitter(i) * 0.1 });
  kit.cyl(0.04 * s, 1.9 * s, bark, x + 0.25 * s, y, z + 0.1, { top: 0.025 * s, seg: 6, rz: -0.18 });
  for (let k = 0; k < 6; k++) kit.box(0.09 * s, 0.025, 0.09 * s, "#2b2b2e", x + jitter(i + k) * 0.02, y + 0.35 + k * 0.38 * s, z, { ry: k });
  const greens = ["#8aa66e", "#789a62", "#95b07a", "#6d8f5a"];
  for (let k = 0; k < 7; k++) {
    const a = k * 2.3 + i;
    kit.sphere((0.5 + (k % 3) * 0.12) * s, greens[(k + i) % 4], x + Math.cos(a) * 0.45 * s, y + (2.0 + (k % 4) * 0.35) * s, z + Math.sin(a) * 0.4 * s, { sy: 0.85, detail: 1 });
  }
}

function pine(kit, x, y, z, s) {
  kit.cyl(0.08 * s, 0.5 * s, "#5a4632", x, y, z, { seg: 6 });
  [[0.95, 0.9], [0.75, 1.45], [0.5, 1.95]].forEach(([r, h], k) => kit.cyl(r * s, 0.9 * s, k % 2 ? "#3f6b3c" : "#365d34", x, y + (h - 0.55) * s, z, { top: 0.02, seg: 7 }));
}

// A clipped shrub: a dark green cushion, pruned round.
function shrub(kit, x, y, z, r, k) {
  kit.sphere(r, ["#55704a", "#4a6542", "#5f7a50"][k % 3], x, y + r * 0.5, z, { sy: 0.68, detail: 1 });
}

// A clump of soft grass, arching out from its middle.
function grass(kit, x, y, z, k) {
  for (let i = 0; i < 9; i++) {
    const a = i * 0.7 + k, lean = 0.5 + (i % 3) * 0.15;
    kit.box(0.04, 0.32 - (i % 3) * 0.05, 0.008, i % 2 ? "#a3a160" : "#8f9a58", x, y, z, { ry: a, rz: lean });
  }
}

// A bed of raked gravel (x0..x1, z0..z1): pale gravel, lines raked along x, a few stones with rings raked round
// them, and islands of moss.
function gravelBed(kit, x0, z0, x1, z1, y, seed, night) {
  const r = rand(seed), gy = y + 0.008, line = "#c6bfaf";
  kit.plane(x1 - x0, z1 - z0, "#dcd6c9", (x0 + x1) / 2, gy, (z0 + z1) / 2);
  const stones = [];
  for (let n = 0; n < Math.max(1, Math.floor((x1 - x0) / 3.5)); n++) {
    stones.push({ x: x0 + (n + 0.5 + (r() - 0.5) * 0.4) * ((x1 - x0) / Math.max(1, Math.floor((x1 - x0) / 3.5))), z: (z0 + z1) / 2 + (r() - 0.5) * 0.3, s: 0.28 + r() * 0.12 });
  }
  // raked lines, broken where they meet a stone's rings
  for (let z = z0 + 0.12; z < z1 - 0.06; z += 0.16) {
    let from = x0 + 0.05;
    for (const st of stones) {
      const dz = Math.abs(z - st.z), R = st.s + 0.5;
      if (dz >= R) continue;
      const half = Math.sqrt(R * R - dz * dz);
      if (st.x - half > from) kit.box(st.x - half - from, 0.004, 0.022, line, (from + st.x - half) / 2, gy, z);
      from = st.x + half;
    }
    if (x1 - 0.05 > from) kit.box(x1 - 0.05 - from, 0.004, 0.022, line, (from + x1 - 0.05) / 2, gy, z);
  }
  for (const st of stones) {
    kit.sphere(st.s, "#8f8a80", st.x, gy, st.z, { sy: 0.55, detail: 1, ry: r() * 3 });
    kit.sphere(st.s * 0.55, "#a29d92", st.x + st.s * 0.9, gy, st.z + 0.12, { sy: 0.5, detail: 0, ry: r() * 3 });
    for (const k of [0, 1]) kit.add(new THREE.TorusGeometry(st.s + 0.22 + k * 0.17, 0.012, 3, 24), line, st.x + 0.08, gy + 0.004, st.z, { rx: Math.PI / 2 });
  }
  // moss islands at the bed's ends
  moss(kit, x0 + 0.5, z0 + (z1 - z0) * 0.6, 0.45, gy, night ? "#3f5a48" : "#6b7f4e");
  moss(kit, x1 - 0.6, z0 + (z1 - z0) * 0.4, 0.38, gy, night ? "#46604c" : "#5f7546");
}

// Stepping stones from the end of the garden's path (`from`) to where the land's path starts (`to`): the walk that
// joins the garden to the land round it. Flat granite slabs, about 0.7 m apart, a little off the line by turns.
export function steppingStones(kit, from, to, y = -0.12) {
  const len = Math.hypot(to.x - from.x, to.z - from.z);
  const n = Math.max(1, Math.round(len / 0.7));
  const nx = -(to.z - from.z) / (len || 1), nz = (to.x - from.x) / (len || 1);
  for (let k = 0; k <= n; k++) {
    const t = k / n, off = (k % 2 ? 0.12 : -0.12) * (k > 0 && k < n ? 1 : 0);
    kit.cyl(0.3 + 0.04 * ((k * 5) % 3), 0.03, k % 2 ? "#c9c3b7" : "#bdb6a8", from.x + (to.x - from.x) * t + nx * off, y, from.z + (to.z - from.z) * t + nz * off, { seg: 7 });
  }
}

// The middle of the front door (an outer door on the south side, toward the default view), or null.
export function frontDoor(p) {
  const b = p.bounds;
  const fronts = p.walls.filter((w) => w.door && (!w.a || !w.b) && w.dir === "x" && w.z === b.maxZ);
  return fronts.length ? (Math.min(...fronts.map((w) => w.x)) + Math.max(...fronts.map((w) => w.x)) + 1) / 2 : null;
}

// `trees` ({ n, w }: Kits) takes the tree rows behind the back and the left walls, so the room can hide a row that
// comes round in front of the building when the view turns.
export function garden(kit, lamps, p, L, slab, pools = null, trees = null) {
  const north = trees?.n ?? kit, west = trees?.w ?? kit;
  const y = -slab;
  const b = p.bounds;
  const S = L.studio;
  // the gravel drip edge round the building
  const g = 0.5, gc = "#cdc6b8", gy = y + 0.006;
  kit.plane(b.maxX - b.minX + 2 * g, g, gc, (b.minX + b.maxX) / 2, gy, b.minZ - g / 2);
  kit.plane(b.maxX - b.minX + 2 * g, g, gc, (b.minX + b.maxX) / 2, gy, b.maxZ + g / 2);
  kit.plane(g, b.maxZ - b.minZ, gc, b.minX - g / 2, gy, (b.minZ + b.maxZ) / 2);
  kit.plane(g, b.maxZ - b.minZ, gc, b.maxX + g / 2, gy, (b.minZ + b.maxZ) / 2);

  // birches behind and to the left, pines further back
  let i = 0;
  for (let x = b.minX - 2.5; x <= b.maxX + 1.5; x += 2.9, i++) birch(north, x + jitter(i) * 1.2, y, b.minZ - 2.0 - Math.abs(jitter(i + 7)) * 2.2, 0.95 + jitter(i + 3) * 0.3, i);
  for (let x = b.minX + 1; x <= b.maxX + 3; x += 8.5, i++) pine(north, x + jitter(i) * 2, y, b.minZ - 5.0 + jitter(i + 1), 1.0 + jitter(i + 2) * 0.3);
  for (let z = b.minZ + 0.8; z <= b.maxZ - 1; z += 3.1, i++) birch(west, b.minX - 2.2 - Math.abs(jitter(i)) * 1.5, y, z + jitter(i + 1), 0.9 + jitter(i + 4) * 0.3, i);
  for (let z = b.minZ + 2; z <= b.maxZ + 0.5; z += 8.5, i++) pine(west, b.minX - 5.0 + jitter(i), y, z, 1 + jitter(i + 2) * 0.3);

  const doorX = frontDoor(p);

  // clipped shrubs and grasses along the front, spaced out, leaving the door clear
  let k = 0;
  for (let x = b.minX + 0.8; x < b.maxX - 0.3; x += 1.9, k++) {
    if (doorX !== null && Math.abs(x - doorX) < 1.6) continue;
    if (k % 3 === 1) grass(kit, x, y, b.maxZ + 0.95, k);
    else shrub(kit, x, y, b.maxZ + 0.95, 0.26 + (k % 2) * 0.06, k);
  }

  // a bed of raked gravel in front, and a birch off the back-right corner
  const bedEnd = doorX !== null ? doorX - 3.6 : b.maxX - 1;
  if (bedEnd - b.minX > 3) gravelBed(kit, b.minX + 1.2, b.maxZ + 1.5, bedEnd, b.maxZ + 3.1, y, 17, L.night);
  birch(north, b.maxX - 1.5, y, b.minZ - 3.4, 1.0, 5);

  // the corner off the front left, on gravel: a maple on a moss mound, a stone lantern by a water basin, stepping stones
  const jx = b.minX - 2.2, jz = b.maxZ + 1.6;
  kit.plane(4.4, 3.4, "#dcd6c9", jx + 1.0, y + 0.006, jz + 0.5);
  moss(kit, jx, jz, 1.25, y, L.night ? "#3f5a48" : "#6b7f4e");
  moss(kit, jx + 1.3, jz + 0.9, 0.6, y, L.night ? "#46604c" : "#5f7546");
  maple(kit, jx, jz, 1.05, 3, y);
  const lantern = stoneLantern(kit, lamps, jx + 1.7, jz - 0.9, 0.9, y);
  pools?.plane(2.2, 2.2, "#ffffff", lantern.x, y + 0.012, lantern.z);
  basin(kit, jx + 2.4, jz + 0.1, y, L.night);
  for (const [sx, sz] of [[0.6, 1.6], [1.4, 2.0], [2.3, 2.2], [3.2, 2.0]]) kit.cyl(0.22, 0.03, "#b8b2a6", jx + sx, y, jz + sz, { seg: 7 });
  shrub(kit, b.minX - 0.6, y, b.maxZ + 0.6, 0.3, 2);

  if (doorX !== null) {
    // the path: pavers from the door to the edge of the lawn, bollards beside it
    for (let n = 0; n < Math.floor((REACH - 0.6) / 0.62); n++) {
      const pz = b.maxZ + 0.35 + n * 0.62;
      kit.box(1.1, 0.03, 0.5, n % 2 ? "#d3ccbf" : "#cbc4b6", doorX + (n % 2) * 0.06, y, pz + 0.25);
    }
    kit.box(0.9, 0.012, 0.5, "#4a4640", doorX, 0.0, b.maxZ + 0.32); // a doormat on the step
    kit.box(1.3, slab, 0.5, "#cfc8ba", doorX, y, b.maxZ + 0.3);
    for (const n of [1, 3, 5]) for (const s of [-1, 1]) {
      const bx = doorX + s * 0.9, bz = b.maxZ + 0.6 + n * 0.95;
      kit.cyl(0.055, 0.5, "#2a2a2c", bx, y, bz, { seg: 8 });
      lamps.cyl(0.05, 0.08, "#f7f1e2", bx, y + 0.42, bz, { seg: 8 });
    }
    for (const n of [1, 3, 5]) for (const s of [-1, 1]) pools?.plane(1.6, 1.6, "#ffffff", doorX + s * 0.9, y + 0.01, b.maxZ + 0.6 + n * 0.95);
    // a bike rack (three steel hoops) with a bike in it, and a bench facing the lawn
    const rx = doorX + 2.2, rz = b.maxZ + 1.9;
    for (let n = 0; n < 3; n++) {
      const hx = rx + n * 0.5;
      for (const s of [-1, 1]) kit.box(0.04, 0.62, 0.04, "#4a4a4e", hx, y, rz + s * 0.3);
      kit.box(0.04, 0.04, 0.64, "#4a4a4e", hx, y + 0.6, rz);
    }
    bike(kit, L, rx + 0.25, rz, Math.PI / 2, S.rust);
    const bx = doorX - 2.6, bz = b.maxZ + 2.2;
    kit.box(1.4, 0.04, 0.4, S.oak, bx, y + 0.38, bz);
    kit.box(1.4, 0.3, 0.04, S.oak, bx, y + 0.42, bz - 0.2, { rx: -0.1 });
    for (const s of [-1, 1]) kit.box(0.05, 0.4, 0.36, "#2a2a2c", bx + s * 0.6, y, bz);
    kit.cyl(0.25, 0.4, S.stone, bx - 1.2, y, bz - 0.1, { top: 0.28, seg: 10 });
    shrub(kit, bx - 1.2, y + 0.36, bz - 0.1, 0.24, 1);
  }

  // a timber deck along the east wall with two chairs and a planter
  const dx = b.maxX + 0.6, dz0 = b.minZ + 0.5, dz1 = Math.min(b.maxZ - 0.5, b.minZ + 4.2);
  if (dz1 - dz0 > 2) {
    for (let x = dx; x < dx + 2.4; x += 0.16) kit.box(0.14, 0.06, dz1 - dz0, x % 0.32 < 0.16 ? "#b39c7c" : "#a8916f", x + 0.07, y, (dz0 + dz1) / 2);
    for (const [cz, ry] of [[dz0 + 0.9, -Math.PI / 2 + 0.3], [dz0 + 2.0, -Math.PI / 2 - 0.2]]) {
      kit.at(dx + 1.4, y + 0.06, cz, ry, () => {
        kit.box(0.5, 0.05, 0.5, "#e2d7c3", 0, 0.28, 0);
        kit.box(0.5, 0.4, 0.06, "#e2d7c3", 0, 0.3, -0.24, { rx: -0.3 });
        for (const s of [-1, 1]) kit.box(0.04, 0.3, 0.5, S.oakDark, s * 0.26, 0, 0);
      });
    }
    kit.cyl(0.22, 0.38, S.oak, dx + 0.9, y + 0.06, dz0 + 1.45, { seg: 10 });
    kit.box(0.5, 0.36, 0.5, S.charcoal, dx + 2.0, y + 0.06, dz1 - 0.4);
    shrub(kit, dx + 2.0, y + 0.42, dz1 - 0.4, 0.3, 2);
  }
}
