// The Nordic studio's props, built from primitives into a Kit: desks and what is on them, chairs, shelves of books,
// lamps, plants, the kitchen, the sofa corner, boards and prints, a bike and a dog. Original shapes, named by what
// they are. Every prop is placed in a room's own frame (back wall at z = 0); `ry` turns it about its own centre.
// Lamps add their shades to `glow` (a kit drawn unlit, so it can shine at night) and their light to `lights`.
import { THREE } from "./kit.js";
import { ATLAS } from "./atlas.js";
import { pick } from "./look.js";

export const DESK_H = 0.57;
export const SEAT_H = 0.35;
export const COUNTER_H = 0.69;

const tex = (r, face = "+z") => ({ r, face });

// --- Desks ---------------------------------------------------------------------------------------------------------

// A desk: a birch top with a dark edge band on black sled legs, or on oak trestles. Its frame: the worker sits at +z.
export function desk(kit, L, x, z, ry = 0, { w = 1.3, d = 0.66, legs = "sled" } = {}) {
  const S = L.studio;
  kit.at(x, 0, z, ry, () => {
    kit.box(w, 0.03, d, S.ply, 0, DESK_H - 0.03, 0);
    kit.box(w + 0.004, 0.012, d + 0.004, S.plyEdge, 0, DESK_H - 0.03, 0);
    if (legs === "trestle") {
      for (const sx of [-1, 1]) {
        const lx = sx * (w / 2 - 0.12);
        kit.box(0.05, DESK_H - 0.06, 0.05, S.oak, lx, 0.0, -d / 2 + 0.12, { rx: 0.0 });
        kit.box(0.05, DESK_H - 0.06, 0.05, S.oak, lx, 0.0, d / 2 - 0.12);
        kit.box(0.05, 0.05, d - 0.1, S.oak, lx, DESK_H - 0.09, 0);
        kit.box(0.04, 0.04, d - 0.2, S.oak, lx, 0.12, 0);
      }
      kit.box(w - 0.3, 0.04, 0.04, S.oak, 0, 0.12, 0);
    } else {
      for (const sx of [-1, 1]) {
        const lx = sx * (w / 2 - 0.05);
        kit.box(0.03, DESK_H - 0.03, 0.03, S.black, lx, 0, -d / 2 + 0.05);
        kit.box(0.03, DESK_H - 0.03, 0.03, S.black, lx, 0, d / 2 - 0.05);
        kit.box(0.03, 0.025, d - 0.06, S.black, lx, 0, 0);
        kit.box(0.03, 0.03, d - 0.1, S.black, lx, DESK_H - 0.06, 0);
      }
    }
    // the cable tray under the back edge, with a coil of cable
    kit.box(w * 0.6, 0.06, 0.1, S.black, 0, DESK_H - 0.12, -d / 2 + 0.08);
    kit.box(0.015, 0.4, 0.015, "#3a3a3c", w * 0.22, 0.04, -d / 2 + 0.1, { rz: 0.15 });
  });
}

// What is on a desk, varied by seed: a screen on a riser or an arm, keyboard, mouse on a felt pad, a notebook, a mug,
// and some of: a laptop, a desk plant, headphones, a stack of books, a water bottle, a small lamp. Returns the screen's
// place (room frame) for the status screen mesh. The worker sits at +z of (x, z) turned by ry.
export function deskTop(kit, L, x, z, ry, seed, { w = 1.3, d = 0.66 } = {}) {
  seed >>>= 0;
  const S = L.studio;
  const T = DESK_H;
  let screen = null;
  kit.at(x, 0, z, ry, () => {
    const arm = seed % 3 === 0;
    const sx = (seed >> 3) % 2 ? -0.08 : 0.06;
    const sz = -d / 2 + 0.17;
    let sy = T + 0.11;
    if (arm) {
      // a monitor arm clamped to the back edge
      kit.box(0.05, 0.04, 0.06, S.black, sx, T, -d / 2 + 0.05);
      kit.cyl(0.014, 0.3, S.black, sx, T, -d / 2 + 0.05, { seg: 6 });
      kit.box(0.025, 0.025, 0.16, S.black, sx, T + 0.26, -d / 2 + 0.12);
      sy = T + 0.13;
    } else {
      // an oak riser
      kit.box(0.42, 0.07, 0.18, S.oak, sx, T, sz);
      kit.box(0.12, 0.012, 0.09, "#3a3a3c", sx, T + 0.07, sz);
      kit.box(0.035, 0.07, 0.025, "#3a3a3c", sx, T + 0.08, sz - 0.02);
      sy = T + 0.13;
    }
    kit.box(0.54, 0.32, 0.022, "#1f2023", sx, sy, sz);
    kit.box(0.54, 0.012, 0.022, "#3a3b3f", sx, sy, sz + 0.002);
    const p = kit.point(sx, sy + 0.16, sz + 0.0125);
    screen = { x: p.x, y: p.y, z: p.z, ry: kit.turn, w: 0.5, h: 0.28 };
    // keyboard, mouse on a felt pad
    kit.box(0.38, 0.016, 0.12, "#e9e6df", sx, T, 0.02);
    kit.box(0.36, 0.006, 0.1, "#cfcbc3", sx, T + 0.016, 0.02);
    kit.box(0.22, 0.004, 0.18, pick([S.felt, "#3a3a3c", S.oatmeal, "#6d7a8a"], seed, 2), sx + 0.33, T, 0.04);
    kit.rbox(0.05, 0.02, 0.08, "#f2f0ea", sx + 0.33, T + 0.004, 0.04, 0.01);
    // a notebook with a pen
    kit.box(0.17, 0.014, 0.22, pick(["#2f3e57", "#b5532e", "#3f5b45", "#26292e", "#d4a236"], seed, 4), -w / 2 + 0.22, T, 0.08, { ry: 0.25 });
    kit.box(0.16, 0.004, 0.21, "#f4f1ea", -w / 2 + 0.22, T + 0.014, 0.08, { ry: 0.25 });
    kit.box(0.008, 0.008, 0.13, "#26292e", -w / 2 + 0.3, T + 0.018, 0.06, { ry: -0.3 });
    // a mug
    const mx = w / 2 - 0.12, mc = pick(S.mugs, seed, 7);
    kit.cyl(0.035, 0.08, mc, mx, T, -0.04, { seg: 8 });
    kit.box(0.012, 0.04, 0.03, mc, mx + 0.04, T + 0.02, -0.04);
    kit.cyl(0.03, 0.004, "#5a3a24", mx, T + 0.075, -0.04, { seg: 8 });
    const extras = [(seed >> 5) % 4, (seed >> 9) % 3];
    if (extras[0] === 0) {
      // a laptop open beside the screen
      kit.box(0.3, 0.012, 0.21, "#b9bcc2", -w / 2 + 0.25, T, -0.15, { ry: 0.2 });
      kit.box(0.3, 0.2, 0.01, "#b9bcc2", -w / 2 + 0.25 - 0.02, T + 0.012, -0.25, { ry: 0.2, rx: -0.25 });
    } else if (extras[0] === 1) {
      // a desk plant
      kit.cyl(0.05, 0.08, pick(S.pots, seed, 3), -w / 2 + 0.15, T, -0.2, { top: 0.06, seg: 8 });
      for (let i = 0; i < 6; i++) { const a = i * 1.05; kit.sphere(0.045, S.leaf[i % 3], -w / 2 + 0.15 + Math.cos(a) * 0.04, T + 0.12 + (i % 2) * 0.03, -0.2 + Math.sin(a) * 0.04, { sy: 0.6 }); }
    } else if (extras[0] === 2) {
      // a stack of books
      ["#2f3e57", "#e9e2d2", "#b5532e"].forEach((c, i) => kit.box(0.2 - i * 0.02, 0.03, 0.15, c, -w / 2 + 0.18, T + i * 0.03, -0.18, { ry: i * 0.15 }));
    } else {
      // a water bottle and a small cactus
      kit.cyl(0.03, 0.18, "#7f9c8a", -w / 2 + 0.12, T, -0.2, { seg: 8 });
      kit.cyl(0.04, 0.05, S.pots[0], -w / 2 + 0.25, T, -0.22, { seg: 8 });
      kit.cyl(0.025, 0.08, "#5f8e4f", -w / 2 + 0.25, T + 0.05, -0.22, { seg: 6 });
    }
    if (extras[1] === 0) {
      // headphones lying on the desk
      kit.box(0.16, 0.03, 0.04, "#26292e", w / 2 - 0.2, T, 0.14, { ry: 0.4 });
      kit.cyl(0.04, 0.03, "#26292e", w / 2 - 0.27, T, 0.17, { seg: 8 });
      kit.cyl(0.04, 0.03, "#26292e", w / 2 - 0.13, T, 0.11, { seg: 8 });
    } else if (extras[1] === 1) {
      // a phone and sticky notes
      kit.box(0.06, 0.008, 0.12, "#26292e", w / 2 - 0.22, T, 0.16, { ry: -0.2 });
      kit.box(0.07, 0.01, 0.07, "#f2d46b", -0.32, T, -0.2);
    }
  });
  return screen;
}

// --- Chairs --------------------------------------------------------------------------------------------------------

// A task chair on five castors, in a woven fabric: it faces +z of its frame (turn it with ry).
export function taskChair(kit, L, x, z, ry, fabric) {
  const S = L.studio;
  kit.at(x, 0, z, ry, () => {
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      kit.box(0.025, 0.025, 0.22, S.black, Math.sin(a) * 0.1, 0.045, Math.cos(a) * 0.1, { ry: a });
      kit.cyl(0.022, 0.04, S.black, Math.sin(a) * 0.21, 0, Math.cos(a) * 0.21, { seg: 6 });
    }
    kit.cyl(0.022, SEAT_H - 0.1, S.chrome, 0, 0.06, 0, { seg: 6 });
    kit.rbox(0.4, 0.07, 0.38, fabric, 0, SEAT_H - 0.06, 0.01, 0.03);
    kit.box(0.04, 0.2, 0.03, S.black, 0, SEAT_H - 0.02, -0.19, { rx: 0.08 });
    kit.rbox(0.38, 0.32, 0.06, fabric, 0, SEAT_H + 0.14, -0.21, 0.03, { rx: 0.1 });
    for (const sx of [-1, 1]) {
      kit.box(0.025, 0.14, 0.025, S.black, sx * 0.2, SEAT_H, -0.02);
      kit.box(0.04, 0.02, 0.2, S.black, sx * 0.2, SEAT_H + 0.14, 0.01);
    }
  });
}

// A dining chair with a curved top rail that runs into the arms, a Y-shaped back splat and a woven cord seat.
export function forkChair(kit, L, x, z, ry, wood) {
  const S = L.studio;
  const c = wood ?? S.oak;
  kit.at(x, 0, z, ry, () => {
    for (const sx of [-1, 1]) {
      kit.box(0.03, SEAT_H, 0.03, c, sx * 0.17, 0, 0.15, { rx: 0.04 });
      kit.box(0.03, SEAT_H + 0.25, 0.03, c, sx * 0.17, 0, -0.15, { rx: -0.08 });
    }
    kit.box(0.36, 0.04, 0.34, c, 0, SEAT_H - 0.04, 0);
    kit.box(0.33, 0.025, 0.31, S.cord, 0, SEAT_H, 0);
    // the curved rail: five pieces round the back
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i / 4) * Math.PI;
      kit.box(0.12, 0.03, 0.03, c, Math.sin(a) * 0.19, SEAT_H + 0.27, -0.1 - Math.cos(a) * 0.08, { ry: a });
    }
    kit.box(0.025, 0.2, 0.02, c, -0.045, SEAT_H + 0.06, -0.17, { rz: 0.35 });
    kit.box(0.025, 0.2, 0.02, c, 0.045, SEAT_H + 0.06, -0.17, { rz: -0.35 });
    kit.box(0.03, 0.12, 0.02, c, 0, SEAT_H + 0.02, -0.17);
  });
}

// A moulded shell chair in a colour on four splayed oak dowel legs.
export function shellChair(kit, L, x, z, ry, color) {
  const S = L.studio;
  kit.at(x, 0, z, ry, () => {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) kit.cyl(0.015, SEAT_H, S.oak, sx * 0.14, 0, sz * 0.13, { seg: 5, rz: -sx * 0.12, rx: sz * 0.12 });
    kit.rbox(0.4, 0.05, 0.37, color, 0, SEAT_H - 0.03, 0.01, 0.022);
    kit.rbox(0.42, 0.28, 0.05, color, 0, SEAT_H, -0.18, 0.024, { rx: -0.16 });
    for (const sx of [-1, 1]) kit.rbox(0.05, 0.18, 0.28, color, sx * 0.2, SEAT_H, -0.05, 0.02, { rx: -0.05 });
  });
}

export function stool(kit, L, x, z, h = 0.5, color) {
  const S = L.studio;
  for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2; kit.cyl(0.016, h, S.oak, x + Math.sin(a) * 0.1, 0, z + Math.cos(a) * 0.1, { seg: 5, rz: Math.sin(a) * 0.12, rx: -Math.cos(a) * 0.12 }); }
  kit.cyl(0.16, 0.04, color ?? S.oak, x, h, z, { seg: 12 });
}

export function bench(kit, L, x, z, ry, len = 1.6) {
  const S = L.studio;
  kit.at(x, 0, z, ry, () => {
    kit.box(len, 0.04, 0.3, S.oak, 0, SEAT_H - 0.04, 0);
    for (const sx of [-1, 1]) { kit.box(0.04, SEAT_H - 0.04, 0.24, S.oak, sx * (len / 2 - 0.12), 0, 0); }
    kit.box(len - 0.24, 0.03, 0.04, S.oak, 0, 0.1, 0);
    kit.rbox(0.36, 0.05, 0.28, S.sage, -len / 4, SEAT_H, 0, 0.02);
  });
}

// --- Tables --------------------------------------------------------------------------------------------------------

// The long oak table of the kitchen, on two trestles.
export function longTable(kit, L, x, z, ry, len = 2.6, d = 0.8) {
  const S = L.studio;
  kit.at(x, 0, z, ry, () => {
    kit.box(len, 0.045, d, S.oak, 0, DESK_H - 0.045, 0);
    kit.box(len + 0.004, 0.01, d + 0.004, S.oakDark, 0, DESK_H - 0.045, 0);
    for (const sx of [-1, 1]) {
      const lx = sx * (len / 2 - 0.3);
      kit.box(0.06, DESK_H - 0.08, 0.06, S.oakDark, lx, 0.03, 0);
      kit.box(0.07, 0.04, d - 0.12, S.oakDark, lx, 0, 0);
      kit.box(0.06, 0.04, d - 0.16, S.oakDark, lx, DESK_H - 0.09, 0);
    }
    kit.box(len - 0.6, 0.04, 0.05, S.oakDark, 0, 0.18, 0);
  });
}

export function roundTable(kit, L, x, z, r = 0.45, color) {
  const S = L.studio;
  kit.cyl(r, 0.035, color ?? S.oak, x, DESK_H - 0.035, z, { seg: 16 });
  kit.cyl(0.04, DESK_H - 0.035, S.black, x, 0, z, { seg: 6 });
  kit.cyl(0.22, 0.03, S.black, x, 0, z, { seg: 10 });
}

export function lowTable(kit, L, x, z, w = 0.9, d = 0.5, color) {
  const S = L.studio;
  kit.rbox(w, 0.04, d, color ?? S.oak, x, 0.3, z, 0.02);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) kit.cyl(0.018, 0.3, S.oakDark, x + sx * (w / 2 - 0.07), 0, z + sz * (d / 2 - 0.07), { seg: 5 });
}

// --- Storage -------------------------------------------------------------------------------------------------------

// Open birch-plywood shelving full of books and things, back against the wall (its back at local z = 0, facing +z).
export function bookcase(kit, L, x, z, ry, { w = 1.6, h = 1.9, rows = 5, seed = 1, depth = 0.32 } = {}) {
  const S = L.studio;
  kit.at(x, 0, z, ry, () => {
    const t = 0.025, zc = depth / 2;
    kit.box(w, h, 0.015, S.plyEdge, 0, 0, 0.008);
    for (const sx of [-1, 1]) {
      kit.box(t, h, depth, S.ply, sx * (w / 2 - t / 2), 0, zc);
      kit.box(t + 0.002, h, 0.008, S.plyEdge, sx * (w / 2 - t / 2), 0, depth);
    }
    const bays = w > 1.2 ? 2 : 1;
    if (bays === 2) kit.box(t, h, depth - 0.02, S.ply, 0, 0, zc);
    const pitch = (h - 0.1) / rows;
    for (let i = 0; i <= rows; i++) {
      const y = 0.05 + i * pitch;
      kit.box(w - 0.01, t, depth, S.ply, 0, Math.min(y, h - t), zc);
      kit.box(w - 0.01, t, 0.006, S.plyEdge, 0, Math.min(y, h - t), depth);
    }
    const bayW = (w - t * (bays + 1)) / bays;
    let k = seed;
    for (let i = 0; i < rows; i++) {
      const y = 0.05 + i * pitch + t;
      for (let b = 0; b < bays; b++) {
        const bx0 = -w / 2 + t + b * (bayW + t);
        k = (k * 1103515245 + 12345) >>> 0;
        const kind = (k >>> 8) % 6;
        const bh = Math.min(pitch - t - 0.03, 0.27);
        if (kind <= 2) {
          // a full row of books
          const r = ATLAS.books[(k >>> 4) % 3];
          const fw = bayW * (0.7 + ((k >>> 12) % 3) * 0.1);
          kit.box(fw, bh, depth - 0.07, "#ffffff", bx0 + fw / 2 + 0.01, y, zc + 0.02, { tex: tex(r) });
          object(kit, L, bx0 + fw + (bayW - fw) / 2 + 0.01, y, zc + 0.03, k);
        } else if (kind === 3) {
          // half books, half a vase or a plant
          const r = ATLAS.books[(k >>> 6) % 3];
          kit.box(bayW * 0.5, bh, depth - 0.07, "#ffffff", bx0 + bayW * 0.25 + 0.01, y, zc + 0.02, { tex: tex([r[0] + 40, r[1], r[2] / 2, r[3]]) });
          object(kit, L, bx0 + bayW * 0.72, y, zc + 0.03, k >>> 3);
        } else if (kind === 4) {
          // magazine boxes
          ["#e9e2d2", "#2f3e57", "#e9e2d2"].forEach((c, j) => kit.box(0.09, bh * 0.85, depth - 0.08, c, bx0 + 0.08 + j * 0.1, y, zc + 0.02));
          object(kit, L, bx0 + bayW * 0.7, y, zc + 0.03, k >>> 2);
        } else {
          // a lying stack and a ceramic
          ["#b5532e", "#e9e2d2", "#3f5b45", "#26292e"].forEach((c, j) => kit.box(0.24 - j * 0.015, 0.032, 0.19, c, bx0 + 0.16, y + j * 0.032, zc + 0.03, { ry: (j % 2) * 0.08 }));
          object(kit, L, bx0 + bayW * 0.68, y, zc + 0.03, k >>> 5);
        }
      }
    }
  });
}

// A small thing for a shelf: a vase, a bowl, a little plant, a box, a framed photo.
function object(kit, L, x, y, z, k) {
  const S = L.studio;
  switch (k % 5) {
    case 0: kit.cyl(0.035, 0.15, pick(["#efebe4", "#47474a", "#c06b45"], k, 2), x, y, z, { top: 0.025, seg: 8 }); break;
    case 1: kit.cyl(0.06, 0.05, pick(S.pots, k, 1), x, y, z, { top: 0.075, seg: 10 }); break;
    case 2:
      kit.cyl(0.045, 0.07, pick(S.pots, k, 4), x, y, z, { seg: 8 });
      for (let i = 0; i < 5; i++) { const a = i * 1.3; kit.sphere(0.04, S.leaf[i % 3], x + Math.cos(a) * 0.035, y + 0.1 + (i % 2) * 0.025, z + Math.sin(a) * 0.035, { sy: 0.6 }); }
      break;
    case 3: kit.box(0.14, 0.09, 0.12, pick(["#d9c9a0", "#9fae8f", "#26292e"], k, 3), x, y, z); break;
    default:
      kit.box(0.13, 0.17, 0.015, S.black, x, y, z - 0.04, { rx: -0.15 });
      kit.box(0.1, 0.13, 0.004, pick(["#d9a99a", "#9fae8f", "#5b7fa6"], k, 2), x, y + 0.02, z - 0.03, { rx: -0.15 });
  }
}

// A low credenza of birch with sliding doors in a colour, on short black legs; things on top.
export function credenza(kit, L, x, z, ry, w = 1.6, doors) {
  const S = L.studio;
  kit.at(x, 0, z, ry, () => {
    const d = 0.36, h = 0.42;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) kit.box(0.025, 0.1, 0.025, S.black, sx * (w / 2 - 0.06), 0, d / 2 + sz * (d / 2 - 0.06));
    kit.box(w, h - 0.1, d, S.ply, 0, 0.1, d / 2);
    kit.box(w + 0.004, 0.012, d + 0.004, S.plyEdge, 0, h - 0.012, d / 2);
    const n = Math.max(2, Math.round(w / 0.55));
    for (let i = 0; i < n; i++) {
      const dw = (w - 0.06) / n;
      kit.box(dw - 0.01, h - 0.16, 0.012, i % 2 ? doors ?? S.sage : S.ply, -w / 2 + 0.03 + dw * (i + 0.5), 0.13, d + 0.002);
      kit.box(0.012, 0.06, 0.006, S.black, -w / 2 + 0.03 + dw * (i + 0.5) + dw * 0.35 * (i % 2 ? -1 : 1), 0.25, d + 0.01);
    }
  });
}

// --- Lamps ---------------------------------------------------------------------------------------------------------

// A pendant over a table: a black cord from the ceiling line, a shade. kinds: "bell" (oak), "globe" (paper),
// "lantern" (a tall paper lantern on a fine frame), "cone" (black metal). Returns the light's point.
export function pendant(kit, glow, L, x, z, { y = 1.75, kind = "bell", top = 2.95, color } = {}) {
  const S = L.studio;
  kit.cyl(0.05, 0.02, S.black, x, top - 0.02, z, { seg: 8 });
  kit.cyl(0.004, top - y - 0.02, S.black, x, y + 0.1, z, { seg: 3 });
  if (kind === "dome") {
    // an enamel dome in a colour, white inside
    const g = new THREE.SphereGeometry(0.22, 14, 5, 0, Math.PI * 2, 0, Math.PI / 2);
    kit.add(g, color ?? S.forest, x, y, z);
    kit.cyl(0.035, 0.08, color ?? S.forest, x, y + 0.2, z, { seg: 8 });
    glow.cyl(0.2, 0.01, S.paper, x, y + 0.004, z, { seg: 14 });
    glow.sphere(0.06, S.paper, x, y + 0.03, z, { detail: 1 });
  } else if (kind === "bell") {
    kit.cyl(0.19, 0.18, S.oak, x, y, z, { top: 0.06, seg: 12, open: true });
    kit.cyl(0.06, 0.03, S.oakDark, x, y + 0.17, z, { seg: 8 });
    glow.cyl(0.17, 0.01, S.paper, x, y + 0.005, z, { seg: 12 });
  } else if (kind === "cone") {
    kit.cyl(0.16, 0.16, S.black, x, y, z, { top: 0.03, seg: 12, open: true });
    glow.cyl(0.14, 0.01, S.paper, x, y + 0.005, z, { seg: 12 });
  } else if (kind === "lantern") {
    glow.cyl(0.17, 0.42, S.paper, x, y - 0.1, z, { seg: 10 });
    for (let k = 0; k < 5; k++) glow.cyl(0.175, 0.006, "#e3dcca", x, y - 0.1 + 0.05 + k * 0.08, z, { seg: 10 });
  } else {
    glow.sphere(0.2, S.paper, x, y + 0.08, z, { detail: 1 });
  }
  return { x, y: y - 0.05, z };
}

// A floor lamp: a tripod with a linen drum shade, or a paper lantern on a frame (andon). Returns the light's point.
export function floorLamp(kit, glow, L, x, z, kind = "tripod") {
  const S = L.studio;
  if (kind === "andon") {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) kit.box(0.02, 0.85, 0.02, S.walnut, x + sx * 0.12, 0, z + sz * 0.12);
    kit.box(0.27, 0.02, 0.27, S.walnut, x, 0.84, z);
    kit.box(0.27, 0.02, 0.27, S.walnut, x, 0.22, z);
    glow.box(0.22, 0.6, 0.22, S.paper, x, 0.24, z);
    return { x, y: 0.6, z };
  }
  for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2 + 0.4; kit.box(0.02, 1.18, 0.02, S.oak, x + Math.sin(a) * 0.14, 0, z + Math.cos(a) * 0.14, { rx: -Math.cos(a) * 0.12, rz: Math.sin(a) * 0.12 }); }
  kit.cyl(0.006, 0.2, S.black, x, 1.12, z, { seg: 3 });
  glow.cyl(0.17, 0.22, "#efe7d6", x, 1.16, z, { top: 0.15, seg: 12 });
  return { x, y: 1.2, z };
}

// --- Plants --------------------------------------------------------------------------------------------------------

function pot(kit, L, x, z, r, h, color) {
  kit.cyl(r, h, color, x, 0, z, { top: r * 1.12, seg: 10 });
  kit.cyl(r * 1.02, 0.015, "#4a3a2a", x, h - 0.02, z, { seg: 10 });
}

// A fiddle-leaf fig: a bare trunk with big broad leaves up its top half.
export function figTree(kit, L, x, z, seed = 0, h = 1.7) {
  const S = L.studio;
  pot(kit, L, x, z, 0.17, 0.34, pick(S.pots, seed, 1));
  kit.cyl(0.02, h - 0.3, "#6b5236", x, 0.3, z, { seg: 5, top: 0.014 });
  const n = 16;
  for (let i = 0; i < n; i++) {
    const a = i * 2.39 + seed, t = i / n, y = 0.75 + t * (h - 0.75), r = 0.08 + (1 - Math.abs(t - 0.55)) * 0.12;
    kit.rbox(0.15, 0.022, 0.24, S.leaf[(i + seed) % 4], x + Math.cos(a) * r, y, z + Math.sin(a) * r, 0.01, { ry: -a + Math.PI / 2, rx: -0.5 + (i % 3) * 0.25 });
  }
}

// A monstera: big split leaves on long stems, fanning out low and wide.
export function monstera(kit, L, x, z, seed = 0, s = 1) {
  const S = L.studio;
  pot(kit, L, x, z, 0.16 * s, 0.26 * s, pick(S.pots, seed, 2));
  for (let i = 0; i < 9; i++) {
    const a = i * 2.2 + seed, lean = 0.5 + (i % 3) * 0.25, reach = (0.2 + (i % 3) * 0.1) * s, y = (0.45 + (i % 4) * 0.13) * s;
    kit.box(0.012, y - 0.2 * s, 0.012, "#4f6b3a", x + Math.cos(a) * reach * 0.4, 0.22 * s, z + Math.sin(a) * reach * 0.4, { rz: Math.cos(a) * 0.4, rx: -Math.sin(a) * 0.4 });
    const lx = x + Math.cos(a) * reach, lz = z + Math.sin(a) * reach;
    kit.sphere(0.16 * s, S.leaf[i % 4], lx, y, lz, { sy: 0.18, ry: a });
    kit.sphere(0.1 * s, S.leaf[(i + 1) % 4], lx + Math.cos(a) * 0.09 * s, y - 0.03, lz + Math.sin(a) * 0.09 * s, { sy: 0.2, ry: a + 0.6 });
  }
}

// A snake plant: stiff upright blades.
export function snakePlant(kit, L, x, z, seed = 0) {
  const S = L.studio;
  pot(kit, L, x, z, 0.11, 0.22, pick(S.pots, seed, 3));
  for (let i = 0; i < 9; i++) {
    const a = i * 2.4 + seed, r = 0.03 + (i % 3) * 0.025, h = 0.35 + ((i * 7) % 5) * 0.06;
    kit.box(0.05, h, 0.012, i % 2 ? "#3f6b3c" : "#56794a", x + Math.cos(a) * r, 0.2, z + Math.sin(a) * r, { ry: a, rz: Math.cos(a) * 0.12, rx: Math.sin(a) * 0.12 });
  }
}

// A trailing pothos on a high shelf or a cabinet: a pot and vines of small leaves hanging over the edge (+z side).
export function pothos(kit, L, x, y, z, seed = 0, len = 0.7) {
  const S = L.studio;
  kit.cyl(0.07, 0.1, pick(S.pots, seed, 5), x, y, z, { top: 0.08, seg: 8 });
  for (let i = 0; i < 6; i++) { const a = i * 1.1; kit.sphere(0.05, S.leaf[(i + 2) % 5], x + Math.cos(a) * 0.06, y + 0.12, z + Math.sin(a) * 0.06, { sy: 0.5 }); }
  for (let v = 0; v < 3; v++) {
    const vx = x - 0.07 + v * 0.07, vl = len * (0.6 + ((v + seed) % 3) * 0.2);
    for (let k = 0; k < 8; k++) {
      const t = k / 7;
      kit.sphere(0.035, S.leaf[(k + v) % 5], vx + Math.sin(k * 1.7 + v) * 0.03, y + 0.06 - t * vl, z + 0.1 + Math.cos(k * 1.3) * 0.02, { sy: 0.45, ry: k });
    }
  }
}

// An olive tree in a big pot: a thin crooked trunk, airy grey-green clouds.
export function oliveTree(kit, L, x, z, seed = 0) {
  const S = L.studio;
  pot(kit, L, x, z, 0.19, 0.36, pick(S.pots, seed, 4));
  kit.cyl(0.025, 0.7, "#6b5a46", x, 0.33, z, { seg: 5, rz: 0.12 });
  kit.cyl(0.018, 0.5, "#6b5a46", x + 0.08, 0.9, z, { seg: 5, rz: -0.3 });
  for (let i = 0; i < 12; i++) {
    const a = i * 2.1 + seed;
    kit.sphere(0.1 + (i % 3) * 0.03, i % 2 ? S.olive : "#7a8b66", x + Math.cos(a) * 0.22 + 0.04, 1.05 + (i % 4) * 0.12, z + Math.sin(a) * 0.2, { sy: 0.7, ry: a });
  }
}

// A small plant for a counter, a sill or a desk.
export function smallPlant(kit, L, x, y, z, seed = 0) {
  const S = L.studio;
  kit.cyl(0.055, 0.09, pick(S.pots, seed, 6), x, y, z, { top: 0.065, seg: 8 });
  for (let i = 0; i < 6; i++) { const a = i * 1.05 + seed; kit.sphere(0.05, S.leaf[(i + seed) % 5], x + Math.cos(a) * 0.045, y + 0.13 + (i % 2) * 0.03, z + Math.sin(a) * 0.045, { sy: 0.6, ry: a }); }
}

// --- Walls: boards, prints, panels ---------------------------------------------------------------------------------

// A framed print on a wall (its face toward +z). r: an atlas region; frame: a colour.
export function print(kit, L, x, y, z, ry, r, w, h, frame) {
  const S = L.studio;
  kit.at(x, 0, z, ry, () => {
    kit.box(w + 0.05, h + 0.05, 0.025, frame ?? S.black, 0, y - 0.025, 0.012);
    kit.box(w + 0.01, h + 0.01, 0.006, "#f6f3ec", 0, y - 0.005, 0.026);
    kit.box(w - 0.06, h - 0.06, 0.004, "#ffffff", 0, y + 0.03, 0.03, { tex: tex(r) });
  });
}

export function pinboard(kit, L, x, y, z, ry, w = 0.9, h = 0.56) {
  const S = L.studio;
  kit.at(x, 0, z, ry, () => {
    kit.box(w + 0.03, h + 0.03, 0.02, S.oak, 0, y - 0.015, 0.01);
    kit.box(w, h, 0.006, "#ffffff", 0, y, 0.022, { tex: tex(ATLAS.pinboard) });
  });
}

export function planner(kit, L, x, y, z, ry, w = 0.9, h = 0.56) {
  kit.at(x, 0, z, ry, () => kit.box(w, h, 0.012, "#ffffff", 0, y, 0.006, { tex: tex(ATLAS.planner) }));
}

// A round wall clock: an oak rim, a white face with hour marks and hands.
export function clock(kit, L, x, y, z, ry) {
  const S = L.studio;
  kit.at(x, 0, z, ry, () => {
    kit.cyl(0.17, 0.03, S.oak, 0, y, 0, { seg: 16, rx: Math.PI / 2 });
    kit.cyl(0.15, 0.035, "#f6f3ec", 0, y, 0.005, { seg: 16, rx: Math.PI / 2 });
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; kit.box(0.012, i % 3 ? 0.02 : 0.035, 0.005, "#26292e", Math.sin(a) * 0.12, y + Math.cos(a) * 0.12 - 0.01, 0.042, { rz: -a }); }
    kit.box(0.012, 0.09, 0.005, "#26292e", 0, y, 0.045, { rz: -2.1 });
    kit.box(0.008, 0.12, 0.005, "#26292e", 0, y, 0.047, { rz: 0.6 });
    kit.cyl(0.012, 0.01, S.rust, 0, y, 0.048, { seg: 8, rx: Math.PI / 2 });
  });
}

// A whiteboard on a stand with castors, scribbled on both faces.
export function whiteboardStand(kit, L, x, z, ry) {
  const S = L.studio;
  kit.at(x, 0, z, ry, () => {
    for (const sx of [-1, 1]) {
      kit.box(0.03, 1.55, 0.03, S.chrome, sx * 0.52, 0.06, 0);
      kit.box(0.04, 0.03, 0.4, S.chrome, sx * 0.52, 0.04, 0);
      for (const sz of [-1, 1]) kit.cyl(0.025, 0.04, S.black, sx * 0.52, 0, sz * 0.18, { seg: 6 });
    }
    kit.box(1.0, 0.68, 0.025, "#ffffff", 0, 0.82, 0, { tex: { r: ATLAS.whiteboard, face: "+z" } });
    kit.box(1.0, 0.68, 0.005, "#f7f7f4", 0, 0.82, -0.015);
    kit.box(1.03, 0.025, 0.035, S.chrome, 0, 1.5, 0);
    kit.box(1.03, 0.025, 0.06, S.chrome, 0, 0.8, 0.015);
    kit.box(0.1, 0.015, 0.015, "#2f5aa8", 0.25, 0.825, 0.03);
    kit.box(0.1, 0.015, 0.015, "#c8443a", 0.38, 0.825, 0.03);
  });
}

// Vertical oak slats on a wall, from x0 to x1 (along the wall), floor to height h; the wall face at z = 0.
export function slats(kit, L, x0, x1, h = 2.3, ry = 0, x = 0, z = 0) {
  const S = L.studio;
  kit.at(x, 0, z, ry, () => {
    kit.box(x1 - x0, h, 0.012, S.walnut, (x0 + x1) / 2, 0, 0.006);
    for (let sx = x0 + 0.03; sx < x1 - 0.02; sx += 0.065) kit.box(0.04, h, 0.035, S.oak, sx + 0.02, 0, 0.03);
  });
}

// A panel radiator under a window, its face toward +z.
export function radiator(kit, L, x, z, w = 1.1) {
  kit.box(w, 0.36, 0.06, "#f4f3ef", x, 0.12, z + 0.06, { tex: tex(ATLAS.radiator) });
  for (const sx of [-1, 1]) kit.box(0.02, 0.12, 0.02, "#d8d6cf", x + sx * (w / 2 - 0.1), 0, z + 0.06);
}

// --- Kitchen -------------------------------------------------------------------------------------------------------

// A run of base cabinets along a wall (back at z = 0) from x0 to x1: sand-grey fronts, a pale stone top, tiles up to
// the sill, and a sink at sinkX. Things on the counter are separate (coffee machine, kettle, bowl...).
export function kitchenRun(kit, L, x0, x1, { sinkX = null, tiles = 0.95 } = {}) {
  const S = L.studio;
  const w = x1 - x0, cx = (x0 + x1) / 2, d = 0.52;
  kit.box(w, 0.08, d - 0.06, "#3a3a3c", cx, 0, d / 2 - 0.03);
  kit.box(w, COUNTER_H - 0.11, d, S.sand, cx, 0.08, d / 2);
  const n = Math.max(1, Math.round(w / 0.5));
  for (let i = 0; i < n; i++) {
    const dw = w / n, fx = x0 + dw * (i + 0.5);
    kit.box(dw - 0.012, COUNTER_H - 0.13, 0.015, "#d6ccbc", fx, 0.09, d + 0.004);
    kit.box(0.14, 0.012, 0.014, S.oakDark, fx, COUNTER_H - 0.1, d + 0.014);
  }
  kit.box(w + 0.02, 0.035, d + 0.03, "#efece6", cx, COUNTER_H - 0.035, d / 2 + 0.01);
  kit.box(w, tiles - COUNTER_H, 0.01, "#ffffff", cx, COUNTER_H, 0.005, { tex: tex([ATLAS.tiles[0], ATLAS.tiles[1], Math.min(64, Math.round(w * 18)), 32]) });
  if (sinkX !== null) {
    kit.box(0.42, 0.006, 0.32, "#b9bcc2", sinkX, COUNTER_H, 0.27);
    kit.box(0.38, 0.004, 0.28, "#8f9399", sinkX, COUNTER_H + 0.004, 0.27);
    kit.cyl(0.014, 0.2, S.chrome, sinkX, COUNTER_H, 0.08, { seg: 6 });
    kit.box(0.02, 0.02, 0.14, S.chrome, sinkX, COUNTER_H + 0.18, 0.14);
  }
}

// A tall fridge in the cabinets' sand grey, with an oak handle.
export function fridge(kit, L, x, z, w = 0.66) {
  const S = L.studio;
  kit.box(w, 1.62, 0.6, S.sand, x, 0, z + 0.3);
  kit.box(w - 0.02, 1.0, 0.015, "#d6ccbc", x, 0.04, z + 0.605);
  kit.box(w - 0.02, 0.56, 0.015, "#d6ccbc", x, 1.05, z + 0.605);
  kit.box(0.025, 0.4, 0.02, S.oakDark, x - w / 2 + 0.06, 0.55, z + 0.62);
  kit.box(0.025, 0.25, 0.02, S.oakDark, x - w / 2 + 0.06, 1.12, z + 0.62);
  // a few things on top
  kit.box(0.2, 0.12, 0.16, "#9fae8f", x - 0.1, 1.62, z + 0.3);
  kit.cyl(0.05, 0.14, "#efebe4", x + 0.15, 1.62, z + 0.3, { seg: 8 });
}

// An espresso machine with a grinder beside it, two cups on top.
export function coffeeMachine(kit, L, x, z) {
  const S = L.studio;
  const y = COUNTER_H;
  kit.rbox(0.34, 0.3, 0.3, S.chrome, x, y, z, 0.02);
  kit.box(0.3, 0.06, 0.28, "#2a2a2c", x, y + 0.24, z + 0.01);
  kit.box(0.22, 0.012, 0.12, "#2a2a2c", x, y + 0.02, z + 0.17);
  kit.box(0.04, 0.05, 0.05, "#2a2a2c", x - 0.06, y + 0.13, z + 0.17);
  kit.box(0.02, 0.06, 0.02, "#2a2a2c", x - 0.06, y + 0.1, z + 0.23, { rx: 0.4 });
  kit.box(0.03, 0.07, 0.03, S.chrome, x + 0.11, y + 0.14, z + 0.16);
  kit.cyl(0.025, 0.04, "#f4f1ea", x - 0.06, y + 0.035, z + 0.17, { seg: 8 });
  kit.cyl(0.026, 0.035, "#f4f1ea", x - 0.06, y + 0.3, z - 0.03, { seg: 8 });
  kit.cyl(0.026, 0.035, "#2f3e57", x + 0.05, y + 0.3, z - 0.03, { seg: 8 });
  // the grinder
  kit.box(0.12, 0.2, 0.16, "#2a2a2c", x + 0.27, y, z);
  kit.cyl(0.05, 0.12, "#7a5a3a", x + 0.27, y + 0.2, z - 0.02, { top: 0.065, seg: 8 });
}

export function kettle(kit, L, x, z) {
  kit.cyl(0.08, 0.02, "#2a2a2c", x, COUNTER_H, z, { seg: 10 });
  kit.cyl(0.07, 0.17, "#efece6", x, COUNTER_H + 0.02, z, { top: 0.05, seg: 10 });
  kit.box(0.025, 0.12, 0.05, "#2a2a2c", x + 0.075, COUNTER_H + 0.05, z);
}

export function fruitBowl(kit, L, x, z) {
  kit.cyl(0.13, 0.05, "#efebe4", x, COUNTER_H, z, { top: 0.15, seg: 12 });
  [["#e9a23b", 0.05, 0.02], ["#c8443a", -0.05, 0.03], ["#e9a23b", 0, -0.05], ["#9cbf4a", -0.03, -0.01], ["#e8d24a", 0.06, -0.04]].forEach(([c, dx, dz]) => kit.sphere(0.04, c, x + dx, COUNTER_H + 0.07, z + dz, { detail: 1 }));
}

// Open oak shelves on a wall (its face at z = 0) with mugs, jars and a plant.
export function openShelves(kit, L, x, w, ys, seed = 0) {
  const S = L.studio;
  ys.forEach((y, i) => {
    kit.box(w, 0.03, 0.2, S.oak, x, y, 0.1);
    for (let k = 0; k < Math.floor(w / 0.11); k++) {
      const px = x - w / 2 + 0.07 + k * 0.11, kind = (k + i + seed) % 4;
      if (kind === 3 && i === ys.length - 1) { smallPlant(kit, L, px, y + 0.03, 0.1, k); continue; }
      if (kind < 2) kit.cyl(0.035, 0.08, S.mugs[(k + i) % S.mugs.length], px, y + 0.03, 0.1, { seg: 8 });
      else kit.cyl(0.04, 0.14, "#e8e2d4", px, y + 0.03, 0.1, { seg: 8 });
    }
  });
}

// --- Soft corner ---------------------------------------------------------------------------------------------------

// A low wool sofa facing +z, with cushions and a knitted throw.
export function sofa(kit, L, x, z, ry, { w = 2.0, color, cushions } = {}) {
  const S = L.studio;
  const c = color ?? S.oatmeal;
  kit.at(x, 0, z, ry, () => {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) kit.cyl(0.02, 0.08, S.oakDark, sx * (w / 2 - 0.08), 0, sz * 0.3, { seg: 5 });
    kit.rbox(w, 0.16, 0.78, c, 0, 0.08, 0, 0.04);
    kit.rbox(w - 0.3, 0.12, 0.6, c, 0, 0.24, 0.07, 0.05);
    kit.rbox(w, 0.42, 0.18, c, 0, 0.08, -0.3, 0.06);
    for (const sx of [-1, 1]) kit.rbox(0.16, 0.34, 0.78, c, sx * (w / 2 - 0.08), 0.08, 0, 0.05);
    const cs = cushions ?? [S.rust, S.sage, S.mustard];
    cs.forEach((cc, i) => kit.rbox(0.32, 0.3, 0.1, cc, -w / 2 + 0.36 + i * ((w - 0.72) / Math.max(1, cs.length - 1)), 0.3, -0.17, 0.05, { rx: -0.25, ry: (i - 1) * 0.12 }));
    kit.rbox(0.5, 0.05, 0.62, "#ffffff", w / 2 - 0.42, 0.36, 0.08, 0.02, { tex: { r: ATLAS.knit, face: "all" } });
  });
}

// A lounge chair in a colour with a wooden frame, facing +z.
export function loungeChair(kit, L, x, z, ry, color) {
  const S = L.studio;
  kit.at(x, 0, z, ry, () => {
    for (const sx of [-1, 1]) { kit.box(0.04, 0.04, 0.72, S.oak, sx * 0.34, 0.16, 0); kit.box(0.04, 0.2, 0.04, S.oak, sx * 0.34, 0, 0.3); kit.box(0.04, 0.2, 0.04, S.oak, sx * 0.34, 0, -0.3); kit.box(0.04, 0.42, 0.04, S.oak, sx * 0.34, 0.18, 0.28); }
    kit.rbox(0.64, 0.12, 0.62, color, 0, 0.2, 0.02, 0.04);
    kit.rbox(0.64, 0.46, 0.14, color, 0, 0.26, -0.27, 0.05, { rx: -0.25 });
  });
}

// --- Things that make it lived in ----------------------------------------------------------------------------------

// A city bike leaning on a wall: two wheels, a frame in a colour, a saddle, bars and a basket. Facing along +x.
export function bike(kit, L, x, z, ry, color) {
  const S = L.studio;
  kit.at(x, 0, z, ry, () => {
    const R = 0.27;
    for (const wx of [-0.42, 0.42]) {
      kit.add(new THREE.TorusGeometry(R, 0.025, 4, 16), "#26292e", wx, R + 0.01, 0, { rx: 0.08 });
      kit.add(new THREE.TorusGeometry(R - 0.03, 0.008, 3, 14), S.chrome, wx, R + 0.01, 0, { rx: 0.08 });
      kit.cyl(0.03, 0.04, S.chrome, wx, R - 0.01, 0, { seg: 6, rx: Math.PI / 2 });
    }
    const tube = (x0, y0, x1, y1, t = 0.025) => {
      const len = Math.hypot(x1 - x0, y1 - y0);
      kit.box(len, t, t, color, (x0 + x1) / 2, (y0 + y1) / 2 - t / 2, 0, { rz: Math.atan2(y1 - y0, x1 - x0) });
    };
    tube(-0.42, R + 0.01, -0.05, R + 0.02);       // chain stay
    tube(-0.05, R + 0.02, -0.15, 0.68);           // seat tube
    tube(-0.42, R + 0.01, -0.15, 0.66);           // seat stay
    tube(-0.05, R + 0.02, 0.32, 0.62);            // down tube
    tube(-0.12, 0.56, 0.32, 0.58);                // top tube (step-through low)
    tube(0.42, R + 0.01, 0.32, 0.74);             // fork
    kit.box(0.2, 0.03, 0.08, "#4a3524", -0.17, 0.7, 0);
    kit.box(0.025, 0.025, 0.46, "#26292e", 0.31, 0.76, 0);
    kit.box(0.2, 0.14, 0.24, "#a8865a", 0.5, 0.62, 0); // a wicker basket
    kit.cyl(0.07, 0.008, "#9aa0a6", -0.05, R - 0.02, 0, { seg: 8, rx: Math.PI / 2 });
  });
}

// A round dog bed with a dog asleep in it, curled up.
export function dogBed(kit, L, x, z, ry, coat = "#c98b4f") {
  const S = L.studio;
  kit.at(x, 0, z, ry, () => {
    kit.cyl(0.42, 0.06, S.wool, 0, 0, 0, { seg: 14 });
    kit.add(new THREE.TorusGeometry(0.36, 0.08, 5, 16), "#9a9389", 0, 0.1, 0, { rx: Math.PI / 2 });
    kit.cyl(0.32, 0.05, S.oatmeal, 0, 0.05, 0, { seg: 14 });
    // the dog: a curled body, a head resting on its paws, ears, a tail round its nose
    kit.sphere(0.2, coat, -0.02, 0.17, 0.02, { sy: 0.55, detail: 1 });
    kit.sphere(0.16, coat, 0.12, 0.16, -0.06, { sy: 0.6, detail: 1 });
    kit.sphere(0.11, "#efe2cc", 0.06, 0.13, 0.14, { sy: 0.5, detail: 1 });
    kit.rbox(0.13, 0.11, 0.14, coat, 0.16, 0.12, 0.17, 0.04, { ry: 0.5 });
    kit.rbox(0.07, 0.05, 0.07, "#efe2cc", 0.2, 0.12, 0.25, 0.02, { ry: 0.5 });
    kit.box(0.02, 0.02, 0.02, "#26292e", 0.23, 0.15, 0.28);
    for (const s of [-1, 1]) kit.box(0.045, 0.06, 0.02, "#9a6236", 0.16 + s * 0.04, 0.22, 0.13 + s * 0.03, { ry: 0.5, rz: s * 0.3 });
    kit.rbox(0.22, 0.05, 0.06, "#efe2cc", -0.08, 0.14, 0.2, 0.02, { ry: -0.3 });
    kit.box(0.14, 0.03, 0.05, "#2b2b2e", -0.25, 0.06, 0.25, { ry: 0.6 }); // a chew toy
  });
}

// A rug on the floor: an atlas region stretched to w × d.
export function rug(kit, L, region, x, z, w, d, ry = 0) {
  kit.at(x, 0, z, ry, () => kit.plane(w, d, "#ffffff", 0, 0.004, 0, { tex: { r: region, face: "+y" } }));
}

// A light pool: a soft disc of light on the floor at night (into a pools kit, drawn additive).
export function pool(pools, x, z, r = 1.3, y = 0.012) {
  pools.plane(r * 2, r * 2, "#ffffff", x, y, z);
}
