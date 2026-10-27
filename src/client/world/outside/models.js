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

// A few blooms on short stems; white takes the flower's colour.
export function flower(stem) {
  const p = new Parts();
  for (const [x, z, h] of [[0, 0, 0.2], [0.2, 0.1, 0.15], [-0.12, 0.18, 0.17]]) {
    p.cone(0.018, h, stem, x, 0, z, 3);
    p.add(new THREE.OctahedronGeometry(0.085, 0), W, at(x, h + 0.02, z));
  }
  return p.geometry();
}

// A tuft of long grass: a few blades leaning out.
export function tuft(a, b) {
  const p = new Parts();
  for (const [x, z, h, rx, rz, c] of [[0, 0, 0.5, 0.1, 0.15, a], [0.09, 0.05, 0.4, -0.3, 0.35, b], [-0.08, 0.06, 0.44, 0.35, -0.3, a], [0.03, -0.09, 0.36, -0.4, -0.1, b], [-0.05, -0.05, 0.3, 0.2, 0.4, b]]) p.cone(0.06, h, c, x, 0, z, 3, { rx, rz });
  return p.geometry();
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

// ---- the town (Copenhagen-ish): bikes, the bus, boats, stepped gables, spires, hanging lamps, street things ----------

// A bicycle pointing along +z, 1.3 m (Sims scale): white takes the frame's paint; tyres, saddle and bars stay dark.
export function bike(tyre = "#2a2a2c") {
  const p = new Parts();
  for (const z of [-0.5, 0.5]) p.add(new THREE.CylinderGeometry(0.28, 0.28, 0.05, 8, 1, true), tyre, at(0, 0.28, z, 0, 0, Math.PI / 2));
  p.rod(0, 0.74, -0.16, 0, 0.76, 0.4, 0.05, W);   // top tube
  p.rod(0, 0.74, 0.4, 0, 0.3, -0.04, 0.05, W);    // down tube
  p.rod(0, 0.3, -0.04, 0, 0.8, -0.2, 0.05, W);    // seat tube
  p.rod(0, 0.3, -0.04, 0, 0.28, -0.5, 0.04, W);   // chain stay
  p.rod(0, 0.74, -0.16, 0, 0.28, -0.5, 0.035, W); // seat stay
  p.rod(0, 0.92, 0.42, 0, 0.28, 0.5, 0.04, W);    // fork
  p.box(0.5, 0.04, 0.05, tyre, 0, 0.9, 0.4);
  p.box(0.12, 0.05, 0.22, tyre, 0, 0.8, -0.22);
  return p.geometry();
}
// A box-front cargo bike, 2 m: a wooden box between the rider and a small front wheel.
export function cargoBike(box = "#a8875f", tyre = "#2a2a2c") {
  const p = new Parts();
  p.add(new THREE.CylinderGeometry(0.28, 0.28, 0.05, 8, 1, true), tyre, at(0, 0.28, -0.55, 0, 0, Math.PI / 2));
  p.add(new THREE.CylinderGeometry(0.2, 0.2, 0.05, 8, 1, true), tyre, at(0, 0.2, 1.38, 0, 0, Math.PI / 2));
  p.rod(0, 0.3, -0.06, 0, 0.26, 1.38, 0.06, W);   // the long low frame
  p.rod(0, 0.3, -0.06, 0, 0.8, -0.24, 0.05, W);
  p.rod(0, 0.3, -0.06, 0, 0.28, -0.55, 0.04, W);
  p.rod(0, 0.3, 0.2, 0, 0.92, 0.26, 0.05, W);     // the steerer up to the bars
  p.box(0.5, 0.04, 0.05, tyre, 0, 0.9, 0.24);
  p.box(0.12, 0.05, 0.22, tyre, 0, 0.8, -0.26);
  p.box(0.66, 0.42, 0.8, box, 0, 0.3, 0.86);
  p.box(0.58, 0.04, 0.72, "#6b4f3a", 0, 0.68, 0.86);
  return p.geometry();
}

// The city bus, 7.6 m along +z: white takes the yellow; a dark band of windows, a lighter roof.
export function bus(glass, tyre) {
  const p = new Parts();
  p.box(1.75, 1.1, 7.6, W, 0, 0.22, 0);
  p.box(1.77, 0.78, 6.9, glass, 0, 1.25, -0.25);
  p.box(1.6, 0.75, 0.05, glass, 0, 1.2, 3.79);
  p.box(1.75, 0.3, 7.6, W, 0, 2.03, 0);
  p.box(1.5, 0.08, 6.8, "#d8d6d0", 0, 2.33, 0);
  p.box(1.77, 0.14, 7.62, "#3a3a3c", 0, 0.2, 0);
  for (const [x, z] of [[0.75, 2.6], [-0.75, 2.6], [0.75, -2.4], [-0.75, -2.4]]) p.add(new THREE.CylinderGeometry(0.3, 0.3, 0.22, 8), tyre, at(x, 0.3, z, 0, 0, Math.PI / 2));
  return p.geometry();
}

// A hull along +z, len × beam, depth tall: a pointed bow, a full stern; white takes the paint, the deck is timber.
function hull(p, len, beam, depth, deck) {
  const n = 10, rings = [];
  for (let k = 0; k <= n; k++) {
    const s = k / n - 0.5;
    const hb = beam / 2 * (s > 0.15 ? Math.max(0.03, 1 - Math.pow((s - 0.15) / 0.35, 1.7)) : s < -0.42 ? 0.86 : 1);
    rings.push({ z: s * len, hb, rise: s > 0.3 ? (s - 0.3) * 0.9 : 0 });
  }
  const tri = (a, b, c, hex) => { p.pos.push(...a, ...b, ...c); const col = new THREE.Color(hex); for (let i = 0; i < 3; i++) p.col.push(col.r, col.g, col.b); };
  for (let k = 0; k < n; k++) {
    const A = rings[k], B = rings[k + 1];
    for (const sd of [-1, 1]) {
      const a0 = [sd * A.hb * 0.55, 0, A.z], a1 = [sd * A.hb, depth + A.rise, A.z], b0 = [sd * B.hb * 0.55, 0, B.z], b1 = [sd * B.hb, depth + B.rise, B.z];
      if (sd > 0) { tri(a0, b0, b1, W); tri(a0, b1, a1, W); } else { tri(a0, b1, b0, W); tri(a0, a1, b1, W); }
    }
    const y = depth - 0.1;
    tri([-A.hb * 0.92, y, A.z], [B.hb * 0.92, y, B.z], [A.hb * 0.92, y, A.z], deck);
    tri([-A.hb * 0.92, y, A.z], [-B.hb * 0.92, y, B.z], [B.hb * 0.92, y, B.z], deck);
  }
  // the transom
  const S = rings[0];
  tri([-S.hb, depth, S.z], [S.hb * 0.55, 0, S.z], [-S.hb * 0.55, 0, S.z], W);
  tri([-S.hb, depth, S.z], [S.hb, depth, S.z], [S.hb * 0.55, 0, S.z], W);
}
// kind: "ship" (two masts, sails furled, a deckhouse), "sail" (one mast), "motor" (open, benches). Origin at the
// waterline; the hull sits a little below it.
export function boat(kind, B) {
  const p = new Parts();
  const wood = "#a8875f", sail = "#efe8d6", spar = "#6b4f3a";
  if (kind === "ship") {
    hull(p, B.len, B.beam, 1.05, wood);
    p.box(B.beam + 0.02, 0.16, B.len * 0.86, "#c9a24a", 0, 0.62, -0.25); // a painted band along the side
    p.box(1.1, 0.55, 1.6, "#8a6a4a", 0, 0.95, -1.9);
    for (const [z, h] of [[1.2, B.mast], [-1.0, B.mast * 0.82]]) {
      p.cyl(0.07, h, spar, 0, 0.95, z, 5, 0.05);
      p.box(0.18, 0.18, 2.6, sail, 0, 0.95 + h * 0.3, z - 1.3);
      p.box(0.05, 0.05, 2.7, spar, 0, 0.95 + h * 0.28, z - 1.3);
    }
    p.rod(0, 1.25, B.len / 2 - 0.3, 0, 1.6, B.len / 2 + 1.6, 0.06, spar);
  } else if (kind === "sail") {
    hull(p, B.len, B.beam, 0.62, wood);
    p.box(0.9, 0.38, 1.3, "#e8e4da", 0, 0.5, 0.2);
    p.cyl(0.05, B.mast, "#d6d3cc", 0, 0.5, 0.75, 5, 0.04);
    p.box(0.16, 0.16, 1.9, "#3f5170", 0, 1.35, -0.2);
  } else {
    hull(p, B.len, B.beam, 0.55, "#8a7a62");
    for (const z of [-1.0, 0.0, 0.9]) p.box(B.beam * 0.78, 0.12, 0.32, wood, 0, 0.42, z);
    p.box(0.5, 0.35, 0.4, "#e8e4da", 0, 0.45, -1.45);
  }
  const g = p.geometry();
  g.translate(0, -0.32, 0);
  return g;
}

// A stepped gable, one unit wide (x) and one tall, standing proud of the roof behind it: five steps.
export function stepGable() {
  const p = new Parts();
  const n = 5;
  for (let k = 0; k < n; k++) {
    const hw = 0.5 * (1 - k / n) + 0.03, y0 = k / n, y1 = (k + 1) / n + 0.07;
    p.box(hw * 2, y1 - y0, 0.3, W, 0, y0, 0);
  }
  return p.geometry();
}

// A copper spire on a lantern, one unit wide and one tall.
export function spire() {
  const p = new Parts();
  p.cyl(0.46, 0.2, W, 0, 0, 0, 8);
  p.cone(0.44, 0.06, W, 0, 0.2, 0, 8);
  p.cyl(0.26, 0.14, W, 0, 0.2, 0, 8);
  p.cone(0.3, 0.68, W, 0, 0.32, 0, 8);
  p.box(0.03, 0.08, 0.03, "#c9a24a", 0, 0.98, 0);
  return p.geometry();
}

// A dome lamp hung from its wire: the stem, the dome (the head glows at night).
export function hangingLamp(hex) {
  const p = new Parts();
  p.add(new THREE.SphereGeometry(0.34, 8, 3, 0, Math.PI * 2, 0, Math.PI / 2), hex, at(0, -0.62, 0, 0, 0, 0, 1, 0.55, 1));
  p.box(0.12, 0.08, 0.12, hex, 0, -0.68, 0);
  return p.geometry();
}
