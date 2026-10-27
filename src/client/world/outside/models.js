// The outside's models, built from primitives in code (original, low-poly, Sims scale: a person is 1.35 m): trees,
// rocks, reeds, flowers, roofs, windows, awnings, street lamps, cars and people. Each is one geometry with vertex
// colours, drawn many times by an InstancedMesh; an instance's colour multiplies it (white parts take it fully).
import { THREE, Parts, at } from "./parts.js";

const W = "#ffffff";

export function tree(kind, T) {
  const c = T[kind === "street" ? "round" : kind] ?? T.maple;
  const p = new Parts();
  switch (kind) {
    case "conifer":
      p.cyl(0.14, 0.9, c.trunk, 0, 0, 0, 5);
      p.cone(1.3, 2.4, c.leaf2, 0, 0.6, 0, 7);
      p.cone(1.0, 2.0, c.leaf, 0, 1.9, 0, 7, { ry: 0.4 });
      p.cone(0.65, 1.6, c.leaf2, 0, 3.2, 0, 6, { ry: 0.9 });
      break;
    case "birch":
      p.cyl(0.08, 3.3, c.trunk, 0, 0, 0, 5, 0.06);
      for (const [y, r] of [[0.7, 0.2], [1.5, 1.4], [2.2, 3.0]]) p.box(0.18, 0.06, 0.18, c.mark, 0, y, 0, r);
      p.ico(0.85, c.leaf, 0, 3.15, 0, 1.3);
      p.ico(0.7, c.leaf2, 0.4, 2.55, 0.2, 1.2);
      p.ico(0.62, c.leaf, -0.32, 2.7, -0.28, 1.2);
      break;
    case "shrub":
      p.ico(0.72, c.leaf, 0, 0.42, 0, 0.72);
      p.ico(0.55, c.leaf2, 0.48, 0.32, 0.22, 0.75);
      p.ico(0.45, c.leaf2, -0.38, 0.3, -0.2, 0.8);
      break;
    case "round": case "street":
      p.cyl(0.11, 1.9, c.trunk, 0, 0, 0, 5, 0.08);
      p.ico(1.25, c.leaf, 0, 2.95, 0, 0.9);
      p.ico(0.85, c.leaf2, 0.55, 2.5, 0.35, 0.85);
      break;
    default: // maple and the red one
      p.cyl(0.13, 1.7, c.trunk, 0, 0, 0, 5, 0.09);
      p.ico(1.3, c.leaf, 0, 2.85, 0, 0.85);
      p.ico(1.0, c.leaf2, 0.75, 2.45, 0.3, 0.85);
      p.ico(0.95, c.leaf2, -0.65, 2.55, -0.35, 0.85);
  }
  return p.geometry();
}

export function rock(hex) {
  return new Parts().ico(0.55, hex, 0, 0.18, 0, 0.62, 1, 0.8).ico(0.32, hex, 0.42, 0.1, 0.18, 0.6).geometry();
}

export function flower() {
  return new Parts().add(new THREE.OctahedronGeometry(0.09, 0), W, at(0, 0.14, 0)).geometry();
}

export function reed(hex, tip) {
  const p = new Parts();
  for (const [x, z, h, lean] of [[0, 0, 1.1, 0.08], [0.12, 0.06, 0.85, -0.12], [-0.1, 0.08, 0.95, 0.15], [0.04, -0.1, 0.75, -0.06]]) p.cone(0.035, h, hex, x, 0, z, 4, { rx: lean, rz: lean * 0.6 });
  p.box(0.07, 0.22, 0.07, tip, 0, 0.95, 0.07);
  return p.geometry();
}

// A unit box standing on y = 0, for walls, plinths, flat roofs and small roof things.
export function unitBox() {
  return new Parts().box(1, 1, 1, W, 0, 0, 0).geometry();
}

// A gable roof one unit wide (x) and deep (z), one tall, the ridge along x: the two slopes, and the two gable ends
// (drawn apart, in the wall's colour).
export function gableSlopes() {
  const p = new Parts();
  const tri = (a, b, c) => p.pos.push(...a, ...b, ...c);
  const o = 0.5;
  tri([-o, 0, -o], [o, 1, 0], [o, 0, -o]); tri([-o, 0, -o], [-o, 1, 0], [o, 1, 0]);
  tri([-o, 0, o], [o, 0, o], [o, 1, 0]); tri([-o, 0, o], [o, 1, 0], [-o, 1, 0]);
  for (let k = 0; k < 12; k++) p.col.push(1, 1, 1);
  return p.geometry();
}
export function gableEnds() {
  const p = new Parts();
  const o = 0.5;
  p.pos.push(o, 0, -o, o, 1, 0, o, 0, o, -o, 0, -o, -o, 0, o, -o, 1, 0);
  for (let k = 0; k < 6; k++) p.col.push(1, 1, 1);
  return p.geometry();
}
// A hipped roof (the ridge along x, a quarter in from each end): every side slopes.
export function hipRoof() {
  const p = new Parts();
  const tri = (a, b, c) => p.pos.push(...a, ...b, ...c);
  const o = 0.5, r = 0.22;
  const A = [-o, 0, -o], B = [o, 0, -o], C = [o, 0, o], D = [-o, 0, o], E = [-r, 1, 0], F = [r, 1, 0];
  tri(A, E, B); tri(E, F, B);   // north
  tri(D, C, F); tri(D, F, E);   // south
  tri(B, F, C);                 // east
  tri(A, D, E);                 // west
  for (let k = 0; k < 18; k++) p.col.push(1, 1, 1);
  return p.geometry();
}

// A window facing +z, 1 × 1, centred: a frame and its pane. frame and pane are the colours before the instance's.
export function windowPane(frame, pane) {
  const p = new Parts();
  const q = (w, h, z, hex) => { const g = new THREE.PlaneGeometry(w, h); return p.add(g, hex, at(0, 0, z)); };
  q(1, 1, 0, frame);
  q(0.8, 0.82, 0.012, pane);
  q(0.05, 0.82, 0.02, frame);
  return p.geometry();
}

// A shop awning, one unit wide, sloping out from the wall (+z) and down, in stripes.
export function awning() {
  const p = new Parts();
  const n = 6;
  for (let k = 0; k < n; k++) {
    const x = -0.5 + (k + 0.5) / n;
    p.box(1 / n, 0.04, 1.1, k % 2 ? W : "#d6d3cc", x, 0, 0.5, 0, { rx: 0.36 });
    p.box(1 / n, 0.22, 0.03, k % 2 ? W : "#d6d3cc", x, -0.6, 1.01);
  }
  return p.geometry();
}

// A street lamp: a pole and an arm out over the road (+z); the head is its own mesh so it can glow.
export function lampPole(hex) {
  return new Parts().cyl(0.09, 0.25, hex, 0, 0, 0, 6).cyl(0.05, 3.4, hex, 0, 0, 0, 5).box(0.06, 0.06, 1.05, hex, 0, 3.3, 0.5).geometry();
}
export function lampHead(hex) {
  return new Parts().box(0.24, 0.1, 0.42, hex, 0, 3.2, 1.0).geometry();
}

// Cars point along +z. White takes the paint; the glass and tyres stay dark under it.
export function car(glass, tyre) {
  const p = new Parts();
  p.box(1.5, 0.5, 3.3, W, 0, 0.2, 0);
  p.box(1.32, 0.42, 1.75, glass, 0, 0.7, -0.15);
  p.box(1.3, 0.07, 1.55, W, 0, 1.1, -0.18);
  p.box(1.52, 0.12, 3.34, "#9a9da2", 0, 0.16, 0);
  for (const [x, z] of [[0.66, 1.05], [-0.66, 1.05], [0.66, -1.05], [-0.66, -1.05]]) p.add(new THREE.CylinderGeometry(0.22, 0.22, 0.2, 8), tyre, at(x, 0.22, z, 0, 0, Math.PI / 2));
  return p.geometry();
}
export function kei(glass, tyre) {
  const p = new Parts();
  p.box(1.4, 1.15, 3.1, W, 0, 0.2, 0);
  p.box(1.42, 0.42, 1.9, glass, 0, 0.82, -0.25);
  p.box(1.3, 0.42, 0.05, glass, 0, 0.82, 1.56);
  p.box(1.42, 0.12, 3.14, "#9a9da2", 0, 0.16, 0);
  for (const [x, z] of [[0.62, 1.0], [-0.62, 1.0], [0.62, -1.0], [-0.62, -1.0]]) p.add(new THREE.CylinderGeometry(0.21, 0.21, 0.2, 8), tyre, at(x, 0.21, z, 0, 0, Math.PI / 2));
  return p.geometry();
}
// Head and tail lights for a 3.3 m car (scaled down for a shorter one), drawn unlit at night.
export function carLights(head, tail) {
  const p = new Parts();
  for (const x of [-0.5, 0.5]) { p.box(0.3, 0.12, 0.05, head, x, 0.5, 1.66); p.box(0.28, 0.1, 0.05, tail, x, 0.52, -1.66); }
  return p.geometry();
}

// A person, 1.35 m: the body (white takes the shirt; the hips stay darker), two legs (one geometry each, swung at
// the hip, hanging down from y = 0) and a head (white takes the skin; the hair stays dark).
export function personBody() {
  const p = new Parts();
  p.box(0.36, 0.14, 0.2, "#6a6a6a", 0, 0.6, 0);
  p.box(0.38, 0.5, 0.22, W, 0, 0.7, 0);
  p.box(0.09, 0.46, 0.12, W, 0.235, 0.7, 0);
  p.box(0.09, 0.46, 0.12, W, -0.235, 0.7, 0);
  p.box(0.1, 0.1, 0.1, "#e0c0a0", 0, 1.18, 0);
  return p.geometry();
}
export function personLeg() {
  return new Parts().box(0.14, 0.62, 0.16, W, 0, -0.62, 0).geometry();
}
export function personHead(hair) {
  const p = new Parts();
  p.ico(0.15, W, 0, 1.36, 0, 1.1);
  p.ico(0.158, hair, 0, 1.41, -0.025, 0.8);
  return p.geometry();
}
