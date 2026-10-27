// The props atlas: one 256 px canvas, drawn in code, with the painted parts of the studio's furniture (book spines,
// wool rugs, prints, the whiteboard, the pinboard, kitchen tiles), so a whole room is one mesh and one draw call.
// A part shows a region with Kit's `tex: { r: REGION, face }` and a mesh built with `atlas: ATLAS.size`.
import { THREE } from "./kit.js";

export const ATLAS = {
  size: 256,
  white: [1, 1],
  books: [[0, 8, 128, 40], [0, 48, 128, 40], [0, 88, 128, 40]],
  rugs: { oat: [128, 0, 64, 64], grey: [192, 0, 64, 64], rust: [128, 64, 64, 64], tatami: [192, 64, 64, 64] },
  prints: [[0, 128, 48, 64], [48, 128, 48, 64], [96, 128, 48, 64], [144, 128, 48, 64]],
  wide: [192, 128, 64, 48],
  whiteboard: [0, 192, 64, 40],
  pinboard: [64, 192, 64, 40],
  tiles: [128, 192, 64, 32],
  planner: [192, 176, 64, 40],
  glass: [128, 224, 32, 32],
  knit: [160, 224, 32, 32],
  radiator: [192, 216, 32, 40],
  spines: [0, 232, 128, 24],
};

function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}

// A row of books standing on a shelf: spines of mixed width, height and colour, a few lying flat, the shelf's back
// in shadow above the shorter ones.
function books(g, [x0, y0, w, h], seed, colors) {
  const r = rng(seed);
  g.fillStyle = "#8a7254"; g.fillRect(x0, y0, w, h);
  g.fillStyle = "#6f5a42"; g.fillRect(x0, y0, w, 3);
  let x = x0;
  while (x < x0 + w) {
    if (r() < 0.07) { // a stack lying flat
      const sw = 16 + Math.floor(r() * 8);
      let y = y0 + h;
      for (let k = 0; k < 3 + Math.floor(r() * 3); k++) {
        const th = 3 + Math.floor(r() * 2);
        g.fillStyle = colors[Math.floor(r() * colors.length)];
        g.fillRect(x + Math.floor(r() * 3), y - th, sw - 3, th);
        y -= th;
      }
      x += sw + 1;
      continue;
    }
    if (r() < 0.06) { x += 6 + Math.floor(r() * 8); continue; } // a gap
    const bw = 3 + Math.floor(r() * 5), bh = Math.floor(h * (0.58 + r() * 0.38));
    const c = colors[Math.floor(r() * colors.length)];
    g.fillStyle = c; g.fillRect(x, y0 + h - bh, bw, bh);
    g.fillStyle = "rgba(0,0,0,0.18)"; g.fillRect(x + bw - 1, y0 + h - bh, 1, bh);
    if (r() < 0.6) { g.fillStyle = r() < 0.5 ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.3)"; g.fillRect(x, y0 + h - bh + 3 + Math.floor(r() * 4), bw, 2); }
    if (r() < 0.3) { g.fillStyle = "rgba(255,255,255,0.4)"; g.fillRect(x, y0 + h - 5, bw, 1); }
    x += bw;
  }
}

function speck(g, [x0, y0, w, h], colors, n, r) {
  for (let i = 0; i < n; i++) { g.fillStyle = colors[Math.floor(r() * colors.length)]; g.fillRect(x0 + Math.floor(r() * w), y0 + Math.floor(r() * h), 1, 1); }
}

function rugs(g, R) {
  const r = rng(7);
  // oatmeal wool with a charcoal line border
  {
    const [x, y, w, h] = R.oat;
    g.fillStyle = "#e4d9c4"; g.fillRect(x, y, w, h);
    speck(g, R.oat, ["#d6c9b1", "#efe6d4", "#cbbda4"], 900, r);
    g.strokeStyle = "#4a4640"; g.lineWidth = 2; g.strokeRect(x + 5, y + 5, w - 10, h - 10);
    g.lineWidth = 1; g.strokeRect(x + 9, y + 9, w - 18, h - 18);
  }
  // grey wool with a cream lattice of diamonds
  {
    const [x, y, w, h] = R.grey;
    g.fillStyle = "#b7b2a9"; g.fillRect(x, y, w, h);
    speck(g, R.grey, ["#aaa59c", "#c3beb5"], 900, r);
    g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
    g.strokeStyle = "#ece6d8"; g.lineWidth = 1.5;
    for (let k = -64; k <= 64; k += 16) {
      g.beginPath(); g.moveTo(x + k, y); g.lineTo(x + k + 64, y + 64); g.stroke();
      g.beginPath(); g.moveTo(x + k + 64, y); g.lineTo(x + k, y + 64); g.stroke();
    }
    g.restore();
    g.fillStyle = "#ece6d8"; g.fillRect(x, y, w, 3); g.fillRect(x, y + h - 3, w, 3);
  }
  // a flat-woven runner: bands of rust, cream, ochre and charcoal
  {
    const [x, y, w, h] = R.rust;
    const bands = ["#b5532e", "#efe6d4", "#d4a236", "#efe6d4", "#3a3836", "#efe6d4", "#b5532e", "#c98a7a", "#b5532e", "#efe6d4", "#3a3836", "#efe6d4", "#d4a236", "#efe6d4", "#b5532e"];
    const bh = h / bands.length;
    bands.forEach((c, i) => { g.fillStyle = c; g.fillRect(x, y + i * bh, w, Math.ceil(bh)); });
    g.fillStyle = "#3a3836";
    for (let k = 0; k < 6; k++) { const cy = y + 12 + k * 8; g.beginPath(); g.moveTo(x + 32, cy - 3); g.lineTo(x + 36, cy); g.lineTo(x + 32, cy + 3); g.lineTo(x + 28, cy); g.fill(); }
    speck(g, R.rust, ["rgba(0,0,0,0.15)", "rgba(255,255,255,0.2)"], 500, r);
  }
  // a tatami-like woven mat with dark cloth borders along its long sides
  {
    const [x, y, w, h] = R.tatami;
    g.fillStyle = "#d3cc96"; g.fillRect(x, y, w, h);
    for (let k = 0; k < h; k += 2) { g.fillStyle = k % 4 ? "#c8c18a" : "#d9d29d"; g.fillRect(x, y + k, w, 1); }
    g.fillStyle = "#3d3b30"; g.fillRect(x, y, 5, h); g.fillRect(x + w - 5, y, 5, h);
    g.fillStyle = "#cfc8a8"; for (let k = 3; k < h; k += 6) { g.fillRect(x + 1, y + k, 2, 2); g.fillRect(x + w - 3, y + k, 2, 2); }
  }
}

// Original prints, made of shapes: a sun over hills, cut-paper shapes, a word, a leaf; a wide one of a fjord.
function prints(g, P, W) {
  const [a, b, c, d] = P;
  { const [x, y, w, h] = a; g.fillStyle = "#efe6d4"; g.fillRect(x, y, w, h);
    g.fillStyle = "#d4a236"; g.beginPath(); g.arc(x + 30, y + 22, 9, 0, 7); g.fill();
    [["#b5532e", 0.62], ["#9fae8f", 0.72], ["#3f5b45", 0.84]].forEach(([col, k], i) => {
      g.fillStyle = col; g.beginPath(); g.moveTo(x, y + h);
      for (let px = 0; px <= w; px += 4) g.lineTo(x + px, y + h * k - Math.sin(px / (7 + i * 3) + i) * 4);
      g.lineTo(x + w, y + h); g.fill();
    }); }
  { const [x, y, w, h] = b; g.fillStyle = "#e9e2d2"; g.fillRect(x, y, w, h);
    g.fillStyle = "#2f3e57"; g.beginPath(); g.arc(x + 18, y + 24, 13, Math.PI, 0); g.fill();
    g.fillStyle = "#c98a7a"; g.fillRect(x + 22, y + 30, 18, 22);
    g.fillStyle = "#d4a236"; g.beginPath(); g.arc(x + 34, y + 18, 6, 0, 7); g.fill();
    g.fillStyle = "#3f5b45"; g.beginPath(); g.ellipse(x + 13, y + 46, 6, 10, 0.5, 0, 7); g.fill(); }
  { const [x, y, w, h] = c; g.fillStyle = "#b5532e"; g.fillRect(x, y, w, h);
    g.fillStyle = "#f4ede0"; g.font = "bold 19px sans-serif"; g.textBaseline = "alphabetic"; g.fillText("HEJ", x + 5, y + h - 10);
    g.fillRect(x + 6, y + 8, 36, 2); g.font = "6px sans-serif"; g.fillText("studio  no. 7", x + 6, y + 18); }
  { const [x, y, w, h] = d; g.fillStyle = "#f2ede2"; g.fillRect(x, y, w, h);
    g.strokeStyle = "#3f5b45"; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(x + 24, y + h - 6); g.quadraticCurveTo(x + 22, y + 30, x + 26, y + 8); g.stroke();
    for (let k = 0; k < 6; k++) {
      const py = y + 14 + k * 7, s = k % 2 ? 1 : -1;
      g.fillStyle = k % 3 ? "#5f8e4f" : "#3f6b3c";
      g.beginPath(); g.ellipse(x + 24 + s * 8, py, 8, 3.5, s * 0.5, 0, 7); g.fill();
    } }
  { const [x, y, w, h] = W; g.fillStyle = "#dfe6e6"; g.fillRect(x, y, w, h);
    g.fillStyle = "#f2ede2"; g.fillRect(x, y, w, 14);
    g.fillStyle = "#8a9aa6"; g.beginPath(); g.moveTo(x, y + 30); g.lineTo(x + 14, y + 14); g.lineTo(x + 24, y + 24); g.lineTo(x + 38, y + 10); g.lineTo(x + 52, y + 26); g.lineTo(x + 64, y + 18); g.lineTo(x + 64, y + 34); g.lineTo(x, y + 34); g.fill();
    g.fillStyle = "#4f6a74"; g.fillRect(x, y + 34, w, h - 34);
    g.fillStyle = "#e9e2d2"; for (let k = 0; k < 4; k++) g.fillRect(x + 6 + k * 15, y + 38 + (k % 2) * 3, 8, 1);
    g.fillStyle = "#b5532e"; g.fillRect(x + 44, y + 36, 6, 3); }
}

function boards(g) {
  const r = rng(11);
  { const [x, y, w, h] = ATLAS.whiteboard; // marker scribbles: boxes and arrows, a little chart, a list
    g.fillStyle = "#f7f7f4"; g.fillRect(x, y, w, h);
    g.strokeStyle = "#2f5aa8"; g.lineWidth = 1;
    g.strokeRect(x + 4.5, y + 5.5, 14, 8); g.strokeRect(x + 26.5, y + 5.5, 14, 8); g.strokeRect(x + 15.5, y + 20.5, 14, 8);
    g.beginPath(); g.moveTo(x + 19, y + 10); g.lineTo(x + 26, y + 10); g.moveTo(x + 12, y + 14); g.lineTo(x + 20, y + 20); g.moveTo(x + 33, y + 14); g.lineTo(x + 26, y + 20); g.stroke();
    g.strokeStyle = "#c8443a"; g.beginPath(); g.moveTo(x + 46, y + 32); g.lineTo(x + 50, y + 26); g.lineTo(x + 54, y + 28); g.lineTo(x + 59, y + 18); g.stroke();
    g.strokeStyle = "#26292e"; g.beginPath(); g.moveTo(x + 45, y + 34); g.lineTo(x + 60, y + 34); g.moveTo(x + 45, y + 34); g.lineTo(x + 45, y + 16); g.stroke();
    g.fillStyle = "#26292e"; for (let k = 0; k < 3; k++) { g.fillRect(x + 46, y + 5 + k * 4, 2, 2); g.fillRect(x + 50, y + 5 + k * 4, 6 + Math.floor(r() * 6), 1); }
    g.fillStyle = "#c8443a"; g.fillRect(x + 4, y + 33, 30, 1);
    g.fillStyle = "#2f8a5a"; g.beginPath(); g.arc(x + 9, y + 26, 2.5, 0, 7); g.fill(); }
  { const [x, y, w, h] = ATLAS.pinboard; // cork with pinned sketches, notes and a photo
    g.fillStyle = "#b98a5a"; g.fillRect(x, y, w, h);
    speck(g, ATLAS.pinboard, ["#a87a4c", "#c99b6a", "#9a6c40"], 700, r);
    const sheet = (sx, sy, sw, sh, c, ink) => {
      g.fillStyle = "rgba(0,0,0,0.2)"; g.fillRect(x + sx + 1, y + sy + 1, sw, sh);
      g.fillStyle = c; g.fillRect(x + sx, y + sy, sw, sh);
      g.fillStyle = ink; for (let k = 3; k < sh - 2; k += 3) g.fillRect(x + sx + 2, y + sy + k, Math.floor((sw - 4) * (0.4 + r() * 0.6)), 1);
      g.fillStyle = "#c8443a"; g.fillRect(x + sx + sw / 2 - 1, y + sy, 2, 2);
    };
    sheet(3, 3, 16, 20, "#f4f1ea", "#8a8f99");
    sheet(22, 5, 12, 12, "#f2d46b", "#7a6a2a");
    sheet(37, 2, 14, 18, "#f4f1ea", "#2f5aa8");
    sheet(53, 6, 9, 9, "#9fd3c7", "#2f5a5a");
    sheet(6, 25, 12, 12, "#f2a07b", "#7a3a2a");
    sheet(22, 21, 18, 15, "#f4f1ea", "#26292e");
    g.fillStyle = "#4f6a74"; g.fillRect(x + 25, y + 24, 12, 7); g.fillStyle = "#d4a236"; g.fillRect(x + 31, y + 25, 3, 3);
    sheet(44, 23, 15, 14, "#f2d46b", "#7a6a2a"); }
  { const [x, y, w, h] = ATLAS.tiles; // white glazed tiles with warm grey joints
    g.fillStyle = "#bdb6aa"; g.fillRect(x, y, w, h);
    g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
    for (let ty = 0; ty < h; ty += 8) for (let tx = -((ty / 8) % 2) * 8; tx < w; tx += 16) {
      g.fillStyle = r() < 0.5 ? "#f4f2ec" : "#ece9e2"; g.fillRect(x + tx + 1, y + ty + 1, 14, 7);
    }
    g.restore(); }
  { const [x, y, w, h] = ATLAS.planner; // a wall planner: a grid of weeks with coloured blocks
    g.fillStyle = "#f6f3ec"; g.fillRect(x, y, w, h);
    g.fillStyle = "#26292e"; g.fillRect(x + 3, y + 3, 24, 3);
    g.fillStyle = "#d8d2c6"; for (let k = 0; k <= 6; k++) g.fillRect(x + 3 + k * 9.5, y + 9, 1, h - 12); for (let k = 0; k <= 5; k++) g.fillRect(x + 3, y + 9 + k * 5.6, w - 6, 1);
    const cols = ["#b5532e", "#d4a236", "#5b7fa6", "#9fae8f", "#c98a7a"];
    for (let k = 0; k < 9; k++) { g.fillStyle = cols[k % cols.length]; g.fillRect(x + 4 + Math.floor(r() * 5) * 9.5, y + 10 + (k % 5) * 5.6, 9 + Math.floor(r() * 3) * 9.5, 4); } }
  { const [x, y, w, h] = ATLAS.glass; // a window pane: sky toward the top, two soft streaks of reflection
    const gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, "#c4dbe6"); gr.addColorStop(1, "#e3eef0");
    g.fillStyle = gr; g.fillRect(x, y, w, h);
    g.fillStyle = "rgba(255,255,255,0.45)";
    g.beginPath(); g.moveTo(x + 6, y + h); g.lineTo(x + 16, y + h); g.lineTo(x + 30, y); g.lineTo(x + 20, y); g.fill();
    g.fillStyle = "rgba(255,255,255,0.3)"; g.beginPath(); g.moveTo(x + 18, y + h); g.lineTo(x + 21, y + h); g.lineTo(x + 32, y + 4); g.lineTo(x + 32, y + 9); g.fill(); }
  { const [x, y, w, h] = ATLAS.knit; // a chunky knit for throws and cushions
    g.fillStyle = "#ffffff"; g.fillRect(x, y, w, h);
    for (let ky = 0; ky < h; ky += 4) for (let kx = 0; kx < w; kx += 4) { g.fillStyle = (kx + ky) % 8 ? "rgba(0,0,0,0.10)" : "rgba(0,0,0,0.02)"; g.fillRect(x + kx, y + ky, 3, 3); } }
  { const [x, y, w, h] = ATLAS.radiator; // a white panel radiator's fins
    g.fillStyle = "#f4f3ef"; g.fillRect(x, y, w, h);
    for (let k = 1; k < w; k += 3) { g.fillStyle = "#d8d6cf"; g.fillRect(x + k, y + 2, 1, h - 4); } }
}

let tex = null;

// The atlas texture (made once, shared by every room).
export function atlasTexture(L) {
  if (tex) return tex;
  const c = document.createElement("canvas");
  c.width = c.height = ATLAS.size;
  const g = c.getContext("2d");
  g.fillStyle = "#ffffff"; g.fillRect(0, 0, ATLAS.size, ATLAS.size);
  const colors = L.studio.spines;
  ATLAS.books.forEach((r, i) => books(g, r, 101 + i * 37, colors));
  books(g, ATLAS.spines, 977, colors);
  rugs(g, ATLAS.rugs);
  prints(g, ATLAS.prints, ATLAS.wide);
  boards(g);
  tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = false;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  return tex;
}
