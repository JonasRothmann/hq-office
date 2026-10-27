// The garden round the building: a gravel drip edge, birches and a few pines behind it and to its left (kept off the
// camera's side of the default view, so nothing tall hides a room), low shrubs and lavender along the front, a paved
// path with bollards from each front door, a bike rack and a bench, a deck by the east wall.
import { bike } from "./props.js";

const jitter = (i) => (((i * 7919) % 100) / 100 - 0.5);

function birch(kit, x, y, z, s, i) {
  const bark = "#ece8df";
  kit.cyl(0.06 * s, 2.7 * s, bark, x, y, z, { top: 0.035 * s, seg: 6, rz: jitter(i) * 0.1 });
  kit.cyl(0.04 * s, 1.9 * s, bark, x + 0.25 * s, y, z + 0.1, { top: 0.025 * s, seg: 6, rz: -0.18 });
  for (let k = 0; k < 6; k++) kit.box(0.09 * s, 0.025, 0.09 * s, "#2b2b2e", x + jitter(i + k) * 0.02, y + 0.35 + k * 0.38 * s, z, { ry: k });
  const greens = ["#8fb06e", "#7aa05f", "#9dbb78", "#6f9a58"];
  for (let k = 0; k < 7; k++) {
    const a = k * 2.3 + i;
    kit.sphere((0.5 + (k % 3) * 0.12) * s, greens[(k + i) % 4], x + Math.cos(a) * 0.45 * s, y + (2.0 + (k % 4) * 0.35) * s, z + Math.sin(a) * 0.4 * s, { sy: 0.85, detail: 1 });
  }
}

function pine(kit, x, y, z, s) {
  kit.cyl(0.08 * s, 0.5 * s, "#5a4632", x, y, z, { seg: 6 });
  [[0.95, 0.9], [0.75, 1.45], [0.5, 1.95]].forEach(([r, h], k) => kit.cyl(r * s, 0.9 * s, k % 2 ? "#3f6b3c" : "#365d34", x, y + (h - 0.55) * s, z, { top: 0.02, seg: 7 }));
}

function shrub(kit, x, y, z, r, k) {
  kit.sphere(r, ["#5f8a4f", "#4f7d47", "#6b9658"][k % 3], x, y + r * 0.6, z, { sy: 0.75, detail: 1 });
}

function lavender(kit, x, y, z, k) {
  for (let i = 0; i < 7; i++) { const a = i * 0.9 + k; kit.sphere(0.07, i % 2 ? "#9a8fc0" : "#8a9a7a", x + Math.cos(a) * 0.12, y + 0.12 + (i % 3) * 0.04, z + Math.sin(a) * 0.12, { sy: 1.4 }); }
}

// A meadow strip: grass tufts and wildflowers scattered over a rect.
function meadow(kit, x0, z0, x1, z1, y, seed) {
  let s = seed >>> 0 || 1;
  const r = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  const flowers = ["#f4f1ea", "#f2d46b", "#b9a3d6", "#e8a0a8", "#f4f1ea", "#e9a23b"];
  const n = Math.round((x1 - x0) * (z1 - z0) * 7);
  for (let i = 0; i < n; i++) {
    const x = x0 + r() * (x1 - x0), z = z0 + r() * (z1 - z0);
    const h = 0.14 + r() * 0.14, g = r() < 0.5 ? "#7f9a5f" : "#8fa86c", a = r() * 3;
    for (let k = 0; k < 3; k++) kit.box(0.025, h * (0.8 + k * 0.15), 0.008, g, x + Math.cos(a + k * 2.1) * 0.03, y, z + Math.sin(a + k * 2.1) * 0.03, { ry: a + k * 2.1, rz: (k - 1) * 0.35 });
    if (r() < 0.6) kit.sphere(0.028, flowers[Math.floor(r() * flowers.length)], x + 0.03, y + h + 0.02, z, { detail: 0 });
  }
}

// A rowan: a small multi-stem tree with a light crown and red berries.
function rowan(kit, x, y, z) {
  for (const [dx, dz, rz] of [[0, 0, 0.1], [0.12, 0.05, -0.2], [-0.08, 0.1, 0.25]]) kit.cyl(0.04, 1.5, "#6b5a46", x + dx, y, z + dz, { top: 0.025, seg: 5, rz });
  const greens = ["#7aa05f", "#6f9a58", "#8fb06e"];
  for (let k = 0; k < 6; k++) { const a = k * 2.2; kit.sphere(0.42 + (k % 2) * 0.1, greens[k % 3], x + Math.cos(a) * 0.35, y + 1.6 + (k % 3) * 0.25, z + Math.sin(a) * 0.3, { sy: 0.8, detail: 1 }); }
  for (let k = 0; k < 7; k++) { const a = k * 1.7; kit.sphere(0.06, "#c8443a", x + Math.cos(a) * 0.55, y + 1.45 + (k % 3) * 0.3, z + Math.sin(a) * 0.45, { detail: 0 }); }
}

export function garden(kit, lamps, p, L, slab, pools = null) {
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
  for (let x = b.minX - 2.5; x <= b.maxX + 1.5; x += 2.9, i++) birch(kit, x + jitter(i) * 1.2, y, b.minZ - 2.0 - Math.abs(jitter(i + 7)) * 2.2, 0.95 + jitter(i + 3) * 0.3, i);
  for (let x = b.minX - 1; x <= b.maxX + 3; x += 4.7, i++) pine(kit, x + jitter(i) * 2, y, b.minZ - 6.2 + jitter(i + 1) * 1.5, 1.1 + jitter(i + 2) * 0.4);
  for (let z = b.minZ + 0.8; z <= b.maxZ + 1; z += 3.1, i++) birch(kit, b.minX - 2.2 - Math.abs(jitter(i)) * 1.5, y, z + jitter(i + 1), 0.9 + jitter(i + 4) * 0.3, i);
  for (let z = b.minZ + 2; z <= b.maxZ + 3; z += 4.4, i++) pine(kit, b.minX - 5.8 + jitter(i) * 1.2, y, z, 1 + jitter(i + 2) * 0.3);

  // front doors: outer walls with a door on the camera's side of the default view
  const fronts = p.walls.filter((w) => w.door && (!w.a || !w.b) && w.dir === "x" && w.z === b.maxZ);
  const doorX = fronts.length ? (Math.min(...fronts.map((w) => w.x)) + Math.max(...fronts.map((w) => w.x)) + 1) / 2 : null;

  // low shrubs and lavender along the front, leaving the door clear
  let k = 0;
  for (let x = b.minX + 0.6; x < b.maxX - 0.3; x += 1.25, k++) {
    if (doorX !== null && Math.abs(x - doorX) < 1.4) continue;
    if (k % 3 === 2) lavender(kit, x, y, b.maxZ + 1.0, k);
    else shrub(kit, x, y, b.maxZ + 0.95, 0.24 + (k % 2) * 0.06, k);
  }

  // a meadow strip in front, and a rowan off the front-left corner
  const meadowEnd = doorX !== null ? doorX - 3.6 : b.maxX - 1;
  if (meadowEnd - b.minX > 2) meadow(kit, b.minX + 0.3, b.maxZ + 1.5, meadowEnd, b.maxZ + 2.8, y, 17);
  rowan(kit, b.minX - 2.6, y, b.maxZ + 2.4);
  lavender(kit, b.minX - 1.5, y, b.maxZ + 1.4, 3);
  shrub(kit, b.minX - 0.9, y, b.maxZ + 0.6, 0.32, 2);

  if (doorX !== null) {
    // the path: pavers from the door to the edge of the lawn, bollards beside it
    for (let n = 0; n < 9; n++) {
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
    bike(kit, L, rx + 0.25, rz, Math.PI / 2, "#b5532e");
    const bx = doorX - 2.6, bz = b.maxZ + 2.2;
    kit.box(1.4, 0.04, 0.4, S.oak, bx, y + 0.38, bz);
    kit.box(1.4, 0.3, 0.04, S.oak, bx, y + 0.42, bz - 0.2, { rx: -0.1 });
    for (const s of [-1, 1]) kit.box(0.05, 0.4, 0.36, "#2a2a2c", bx + s * 0.6, y, bz);
    kit.cyl(0.25, 0.4, "#9a6a4a", bx - 1.2, y, bz - 0.1, { top: 0.28, seg: 10 });
    shrub(kit, bx - 1.2, y + 0.36, bz - 0.1, 0.24, 1);
  }

  // a deck along the east wall with two chairs and a planter
  const dx = b.maxX + 0.6, dz0 = b.minZ + 0.5, dz1 = Math.min(b.maxZ - 0.5, b.minZ + 4.2);
  if (dz1 - dz0 > 2) {
    for (let x = dx; x < dx + 2.4; x += 0.16) kit.box(0.14, 0.06, dz1 - dz0, x % 0.32 < 0.16 ? "#b48f5e" : "#a8845a", x + 0.07, y, (dz0 + dz1) / 2);
    for (const [cz, ry] of [[dz0 + 0.9, -Math.PI / 2 + 0.3], [dz0 + 2.0, -Math.PI / 2 - 0.2]]) {
      kit.at(dx + 1.4, y + 0.06, cz, ry, () => {
        kit.box(0.5, 0.05, 0.5, "#e2d7c3", 0, 0.28, 0);
        kit.box(0.5, 0.4, 0.06, "#e2d7c3", 0, 0.3, -0.24, { rx: -0.3 });
        for (const s of [-1, 1]) kit.box(0.04, 0.3, 0.5, S.oakDark, s * 0.26, 0, 0);
      });
    }
    kit.cyl(0.22, 0.38, S.oak, dx + 0.9, y + 0.06, dz0 + 1.45, { seg: 10 });
    kit.box(0.5, 0.36, 0.5, "#47474a", dx + 2.0, y + 0.06, dz1 - 0.4);
    shrub(kit, dx + 2.0, y + 0.42, dz1 - 0.4, 0.3, 2);
  }
}
