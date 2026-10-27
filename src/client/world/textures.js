// Canvas textures drawn in code (never larger than 256 px): floors, ground, wallpaper, rugs, posters, screens, badges, faces.
import { THREE } from "./kit.js";
import { hash } from "./look.js";

const cache = new Map();

function canvas(w, h, draw) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  draw(c.getContext("2d"), w, h);
  return c;
}

function texture(c, { metres = 1, repeat = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(1 / metres, 1 / metres);
  }
  return t;
}

// A small seeded random, so every load draws the same grain.
function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}

function speckle(g, w, h, colors, n, size, r) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = colors[Math.floor(r() * colors.length)];
    const s = size * (0.5 + r());
    g.fillRect(r() * w, r() * h, s, s);
  }
}

function shade(hex, f) {
  const c = new THREE.Color(hex);
  c.offsetHSL(0, 0, f);
  return `#${c.getHexString()}`;
}

// A floor or ground surface. spec: { base, alt, line, kind }.
export function surface(spec) {
  const id = `surface:${JSON.stringify(spec)}`;
  if (cache.has(id)) return cache.get(id);
  const r = rng(hash(id));
  let metres = 2;
  const c = canvas(256, 256, (g, w, h) => {
    g.fillStyle = spec.base;
    g.fillRect(0, 0, w, h);
    switch (spec.kind) {
      case "planks": {
        const pw = 23; // about 18 cm boards
        for (let x = 0; x < w; x += pw) {
          let y = -Math.floor(r() * 120);
          while (y < h) {
            const len = 90 + Math.floor(r() * 110);
            g.fillStyle = r() < 0.5 ? spec.base : spec.alt;
            g.globalAlpha = 0.55 + r() * 0.45;
            g.fillRect(x, y, pw, len);
            g.globalAlpha = 1;
            g.fillStyle = spec.line;
            g.globalAlpha = 0.5;
            g.fillRect(x, y, pw, 1);
            g.globalAlpha = 0.08;
            for (let k = 0; k < 4; k++) g.fillRect(x + 2 + r() * (pw - 4), y + 4, 1, len - 8);
            g.globalAlpha = 1;
            y += len;
          }
          g.fillStyle = spec.line;
          g.globalAlpha = 0.55;
          g.fillRect(x, 0, 1, h);
          g.globalAlpha = 1;
        }
        break;
      }
      case "tatami": {
        // mats of 1 × 2 m with cloth borders along the long sides
        g.globalAlpha = 0.5;
        for (let y = 0; y < h; y += 3) { g.fillStyle = y % 6 ? spec.alt : spec.base; g.fillRect(0, y, w, 2); }
        g.globalAlpha = 1;
        g.fillStyle = spec.line;
        for (const x of [0, 126, 128, 254]) g.fillRect(x, 0, 2, h);
        g.fillStyle = shade(spec.base, -0.08);
        g.fillRect(0, 0, w, 1); g.fillRect(0, 128, w, 1);
        break;
      }
      case "cement": {
        // one-metre stone tiles, every other one a shade darker, with dark joints: a corridor reads at the far zoom
        g.fillStyle = spec.alt;
        g.fillRect(128, 0, 128, 128); g.fillRect(0, 128, 128, 128);
        g.globalAlpha = 0.25; speckle(g, w, h, [spec.alt, spec.line, "#fff"], 2600, 3, r); g.globalAlpha = 1;
        g.fillStyle = spec.line; g.globalAlpha = 0.85;
        g.fillRect(0, 0, w, 3); g.fillRect(0, 127, w, 3); g.fillRect(0, 0, 3, h); g.fillRect(127, 0, 3, h);
        g.globalAlpha = 1;
        break;
      }
      case "terrazzo": {
        // a pale stone terrazzo: small chips in the same family, a few warmer ones
        g.globalAlpha = 0.7; speckle(g, w, h, [spec.alt, spec.line, "#d9c8ae", "#c9c2b4"], 900, 2.2, r);
        g.globalAlpha = 0.55; speckle(g, w, h, ["#c98a6a", "#9fae8f", "#b9a58a"], 110, 2.4, r); g.globalAlpha = 1;
        break;
      }
      case "grass": {
        metres = 4;
        g.globalAlpha = 0.5; speckle(g, w, h, [spec.alt, shade(spec.base, 0.05), shade(spec.base, -0.06)], 6000, 2, r); g.globalAlpha = 1;
        break;
      }
      case "gravel": case "raked": {
        g.globalAlpha = 0.6; speckle(g, w, h, [spec.alt, shade(spec.base, 0.06), shade(spec.base, -0.1)], 6000, 2, r); g.globalAlpha = 1;
        if (spec.kind === "raked") {
          g.strokeStyle = shade(spec.base, -0.09); g.lineWidth = 2; g.globalAlpha = 0.6;
          for (let y = 8; y < h; y += 16) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
          g.globalAlpha = 1;
        }
        break;
      }
    }
  });
  const t = texture(c, { metres });
  cache.set(id, t);
  return t;
}

// Wallpaper, one metre square: a faint plaster.
export function wallpaper(spec) {
  const id = `wall:${JSON.stringify(spec)}`;
  if (cache.has(id)) return cache.get(id);
  const r = rng(hash(id));
  const c = canvas(128, 128, (g, w, h) => {
    g.fillStyle = spec.face; g.fillRect(0, 0, w, h);
    g.globalAlpha = 0.18; speckle(g, w, h, [spec.alt, "#fff"], 900, 2, r); g.globalAlpha = 1;
  });
  const t = texture(c, { metres: 1 });
  cache.set(id, t);
  return t;
}

// A tatami-style rug, drawn to its own size (not repeated), with cloth borders along its long sides.
export function rug(spec, wm, dm) {
  const id = `rug:${JSON.stringify(spec)}:${wm}x${dm}`;
  if (cache.has(id)) return cache.get(id);
  const W = 256, H = Math.round((256 * dm) / wm);
  const c = canvas(W, H, (g, w, h) => {
    g.fillStyle = spec.base; g.fillRect(0, 0, w, h);
    g.globalAlpha = 0.45;
    for (let y = 0; y < h; y += 3) { g.fillStyle = y % 6 ? spec.alt : spec.base; g.fillRect(0, y, w, 2); }
    g.globalAlpha = 1;
    g.fillStyle = spec.line;
    g.fillRect(0, 0, 10, h); g.fillRect(w - 10, 0, 10, h);
    g.fillStyle = "#e8e2c8"; g.globalAlpha = 0.5;
    for (let y = 6; y < h; y += 14) { g.fillRect(3, y, 4, 4); g.fillRect(w - 7, y, 4, 4); }
    g.globalAlpha = 1;
  });
  const t = texture(c, { repeat: false });
  cache.set(id, t);
  return t;
}

// Original posters, one per lane, chosen by the lane's name. Drawn 128 × 176 (a 0.6 × 0.82 m print).
const POSTERS = [
  (g, w, h, p) => { // a sun over layered hills
    g.fillStyle = p[3]; g.fillRect(0, 0, w, h);
    g.fillStyle = p[0]; g.beginPath(); g.arc(w * 0.62, h * 0.36, 28, 0, 7); g.fill();
    [[p[1], 0.62], [p[2], 0.74], [p[4], 0.86]].forEach(([c, y], i) => {
      g.fillStyle = c; g.beginPath(); g.moveTo(0, h);
      for (let x = 0; x <= w; x += 8) g.lineTo(x, h * y - Math.sin(x / (18 + i * 6) + i) * 10 - (i === 0 ? 14 : 0));
      g.lineTo(w, h); g.fill();
    });
  },
  (g, w, h, p) => { // a Swiss grid of bars with a word
    g.fillStyle = "#f4f1ea"; g.fillRect(0, 0, w, h);
    [p[0], p[1], p[2], p[1], p[0]].forEach((c, i) => { g.fillStyle = c; g.fillRect(12, 16 + i * 18, 30 + ((i * 37) % 70), 12); });
    g.fillStyle = "#1d1d22"; g.font = "bold 30px sans-serif"; g.fillText("SHIP", 12, h - 22);
    g.font = "9px sans-serif"; g.fillText("small, often, today", 13, h - 9);
  },
  (g, w, h, p) => { // offset rings
    g.fillStyle = p[4]; g.fillRect(0, 0, w, h);
    for (let i = 5; i > 0; i--) { g.fillStyle = p[i % 4]; g.beginPath(); g.arc(w * 0.42, h * 0.45, i * 11, 0, 7); g.fill(); }
    g.fillStyle = "#f4f1ea"; g.font = "bold 11px sans-serif"; g.fillText("ORBIT  06", 12, h - 12);
  },
  (g, w, h, p) => { // stacked waves
    g.fillStyle = "#efe9dc"; g.fillRect(0, 0, w, h);
    g.lineWidth = 5;
    for (let row = 0; row < 9; row++) {
      g.strokeStyle = row % 3 === 0 ? p[1] : row % 3 === 1 ? p[2] : p[0];
      g.beginPath();
      for (let x = 0; x <= w; x += 4) g.lineTo(x, 22 + row * 16 + Math.sin(x / 11 + row) * 5);
      g.stroke();
    }
  },
  (g, w, h, p) => { // a big word
    g.fillStyle = p[0]; g.fillRect(0, 0, w, h);
    g.fillStyle = "#f4f1ea"; g.font = "bold 40px sans-serif";
    g.save(); g.translate(26, h - 12); g.rotate(-Math.PI / 2); g.fillText("FOCUS", 0, 0); g.restore();
    g.fillStyle = p[2]; g.beginPath(); g.arc(w * 0.72, h * 0.22, 16, 0, 7); g.fill();
  },
  (g, w, h, p) => { // a leaf
    g.fillStyle = "#f4f1ea"; g.fillRect(0, 0, w, h);
    g.fillStyle = "#4e7a4a";
    g.beginPath(); g.ellipse(w / 2, h * 0.45, 34, 58, 0.35, 0, 7); g.fill();
    g.strokeStyle = "#f4f1ea"; g.lineWidth = 2;
    g.beginPath(); g.moveTo(w * 0.36, h * 0.82); g.lineTo(w * 0.62, h * 0.12); g.stroke();
    for (let i = 1; i < 6; i++) { g.beginPath(); g.moveTo(w * 0.36 + i * 4.5, h * 0.82 - i * 22); g.lineTo(w * 0.36 + i * 4.5 - 22, h * 0.82 - i * 22 - 10); g.stroke(); }
    g.fillStyle = "#1d1d22"; g.font = "10px sans-serif"; g.fillText("grow slowly", 12, h - 10);
  },
  (g, w, h, p) => { // quarter circles on a grid
    g.fillStyle = "#1f2430"; g.fillRect(0, 0, w, h);
    for (let x = 0; x < 3; x++) for (let y = 0; y < 4; y++) {
      g.fillStyle = p[(x + y * 2) % 4];
      g.beginPath(); const cx = 14 + x * 36 + ((x + y) % 2) * 34, cy = 14 + y * 38 + (y % 2) * 34;
      g.moveTo(cx, cy); g.arc(cx, cy, 34, ((x + y) % 4) * Math.PI / 2, ((x + y) % 4 + 1) * Math.PI / 2); g.fill();
    }
  },
  (g, w, h, p) => { // diagonal bands and a dot
    g.fillStyle = p[2]; g.fillRect(0, 0, w, h);
    g.save(); g.translate(w / 2, h / 2); g.rotate(-0.6);
    [p[0], p[1], p[3]].forEach((c, i) => { g.fillStyle = c; g.fillRect(-120, -40 + i * 26, 240, 14); });
    g.restore();
    g.fillStyle = "#1d1d22"; g.beginPath(); g.arc(w * 0.72, h * 0.78, 10, 0, 7); g.fill();
  },
];
const POSTER_PALETTES = [
  ["#e4572e", "#2e86ab", "#f2c14e", "#f4f1ea", "#1f2430"],
  ["#c8553d", "#4f7f8a", "#e2b867", "#efe9dc", "#2f3a33"],
  ["#d1495b", "#00798c", "#edae49", "#f4f1ea", "#30638e"],
];

// n: a number (an office's slot, so neighbours differ) or a string (hashed).
export function poster(n) {
  const h = typeof n === "number" ? n : hash(n);
  const id = `poster:${h % (POSTERS.length * POSTER_PALETTES.length)}`;
  if (cache.has(id)) return cache.get(id);
  const c = canvas(128, 176, (g, w, hh) => POSTERS[h % POSTERS.length](g, w, hh, POSTER_PALETTES[Math.floor(h / POSTERS.length) % POSTER_PALETTES.length]));
  const t = texture(c, { repeat: false });
  cache.set(id, t);
  return t;
}

// A monitor's screen for a status: code lines in the status hue, or off.
export function screen(status, statusColor) {
  const id = `screen:${status}:${statusColor}`;
  if (cache.has(id)) return cache.get(id);
  const r = rng(hash(id));
  const off = !statusColor;
  const c = canvas(128, 80, (g, w, h) => {
    g.fillStyle = off ? "#1a1c20" : "#14171d"; g.fillRect(0, 0, w, h);
    if (off) { g.fillStyle = "#2a2d33"; g.fillRect(0, 0, w, 3); return; }
    g.fillStyle = statusColor; g.globalAlpha = 0.9; g.fillRect(0, 0, w, 8); g.globalAlpha = 1;
    for (let y = 14; y < h - 4; y += 7) {
      let x = 6 + Math.floor(r() * 3) * 8;
      while (x < w - 10 && r() > 0.12) {
        const len = 6 + Math.floor(r() * 22);
        g.fillStyle = r() < 0.55 ? statusColor : "#c9cdd6";
        g.globalAlpha = 0.55 + r() * 0.4;
        g.fillRect(x, y, Math.min(len, w - 6 - x), 3);
        x += len + 4;
      }
      g.globalAlpha = 1;
    }
  });
  const t = texture(c, { repeat: false });
  cache.set(id, t);
  return t;
}

// The marker over a head: a round badge with a glyph and a short tail.
export function badge(colorHex, glyph) {
  const id = `badge:${colorHex}:${glyph}`;
  if (cache.has(id)) return cache.get(id);
  const c = canvas(128, 160, (g, w) => {
    const cx = w / 2, cy = 62, R = 50;
    g.fillStyle = "rgba(0,0,0,0.22)"; g.beginPath(); g.arc(cx + 2, cy + 4, R, 0, 7); g.fill();
    g.fillStyle = colorHex;
    g.beginPath(); g.arc(cx, cy, R, 0, 7); g.fill();
    g.beginPath(); g.moveTo(cx - 14, cy + R - 8); g.lineTo(cx, cy + R + 26); g.lineTo(cx + 14, cy + R - 8); g.fill();
    g.strokeStyle = "rgba(255,255,255,0.9)"; g.lineWidth = 6; g.beginPath(); g.arc(cx, cy, R - 3, 0, 7); g.stroke();
    g.fillStyle = "#fff"; g.strokeStyle = "#fff";
    if (glyph === "!") { g.font = "bold 72px sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("!", cx, cy + 4); }
    else if (glyph === "hq") { g.font = "bold 40px sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("HQ", cx, cy + 2); }
    else if (glyph === "clock") {
      g.lineWidth = 7; g.beginPath(); g.arc(cx, cy, 26, 0, 7); g.stroke();
      g.lineCap = "round"; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx, cy - 16); g.moveTo(cx, cy); g.lineTo(cx + 12, cy + 6); g.stroke();
    }
  });
  const t = texture(c, { repeat: false });
  cache.set(id, t);
  return t;
}

// A soft round gradient: a warm light pool on the floor at night, or the blob shadow under a worker.
export function glow(inner, outer = "rgba(0,0,0,0)") {
  const id = `glow:${inner}:${outer}`;
  if (cache.has(id)) return cache.get(id);
  const c = canvas(128, 128, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    gr.addColorStop(0, inner); gr.addColorStop(1, outer);
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
  const t = texture(c, { repeat: false });
  cache.set(id, t);
  return t;
}

// A face, painted the way the reference keeps detail in the texture: skin, eyes, brows, a mouth.
export function face(skin, hair, mood = "calm") {
  const id = `face:${skin}:${hair}:${mood}`;
  if (cache.has(id)) return cache.get(id);
  const c = canvas(64, 64, (g, w) => {
    g.fillStyle = skin; g.fillRect(0, 0, 64, 64);
    g.fillStyle = hair; g.fillRect(0, 0, 64, 10);
    g.fillRect(14, 22, 12, 3); g.fillRect(38, 22, 12, 3);
    g.fillStyle = "#fff"; g.fillRect(16, 28, 9, 7); g.fillRect(39, 28, 9, 7);
    g.fillStyle = "#2a1d15";
    if (mood === "sleep") { g.fillRect(15, 32, 11, 2); g.fillRect(38, 32, 11, 2); }
    else { g.fillRect(19, 29, 5, 6); g.fillRect(42, 29, 5, 6); }
    g.fillStyle = shade(skin, -0.12); g.fillRect(30, 36, 4, 7);
    g.fillStyle = "#8a3b32";
    if (mood === "open") { g.fillRect(26, 47, 12, 6); } else { g.fillRect(25, 49, 14, 3); }
    g.fillStyle = "#e88a7a"; g.globalAlpha = 0.35; g.fillRect(10, 40, 9, 5); g.fillRect(45, 40, 9, 5); g.globalAlpha = 1;
    void w;
  });
  const t = texture(c, { repeat: false });
  t.magFilter = THREE.LinearFilter;
  cache.set(id, t);
  return t;
}

// A worker's skin, 64 px square, the way the reference keeps a person's detail in the texture: the face (32 × 36 at
// the top left, for the head's front), a breton stripe (32 × 32 at the top right, for a striped top) and a white
// texel at (62, 62) that every plain part samples. a: { skin, hair, brows, beard, glasses, freckles, lashes, stripe,
// bald }.
export const SKIN = { size: 64, white: [62, 62], face: [0, 0, 32, 36], stripes: [32, 0, 32, 32] };
export function bodySkin(a) {
  const id = `skin:${JSON.stringify(a)}`;
  if (cache.has(id)) return cache.get(id);
  const c = canvas(64, 64, (g) => {
    g.fillStyle = "#ffffff"; g.fillRect(0, 0, 64, 64);
    // face
    g.fillStyle = a.skin; g.fillRect(0, 0, 32, 36);
    if (!a.bald) { g.fillStyle = a.hair; g.fillRect(0, 0, 32, 4); g.fillRect(0, 4, 3, 6); g.fillRect(29, 4, 3, 6); }
    g.fillStyle = shade(a.skin, -0.05); g.fillRect(0, 30, 32, 6); // under the jaw
    g.fillStyle = a.brows; g.fillRect(6, 11, 7, 2); g.fillRect(19, 11, 7, 2);
    g.fillStyle = "#fbf8f2"; g.fillRect(7, 14, 5, 4); g.fillRect(20, 14, 5, 4);
    g.fillStyle = "#2a1d15"; g.fillRect(8, 14, 3, 4); g.fillRect(21, 14, 3, 4);
    g.fillStyle = "#ffffff"; g.fillRect(9, 14, 1, 1); g.fillRect(22, 14, 1, 1);
    if (a.lashes) { g.fillStyle = "#2a1d15"; g.fillRect(6, 13, 7, 1); g.fillRect(19, 13, 7, 1); }
    g.fillStyle = shade(a.skin, -0.09); g.fillRect(15, 17, 2, 5); g.fillRect(13, 22, 6, 1);
    g.fillStyle = "#e88a7a"; g.globalAlpha = 0.28; g.fillRect(4, 20, 6, 4); g.fillRect(22, 20, 6, 4); g.globalAlpha = 1;
    if (a.freckles) { g.fillStyle = shade(a.skin, -0.16); for (const [fx, fy] of [[6, 20], [8, 21], [5, 22], [23, 20], [25, 21], [26, 19]]) g.fillRect(fx, fy, 1, 1); }
    if (a.beard) {
      g.fillStyle = a.hair; g.globalAlpha = 0.92;
      g.fillRect(2, 21, 4, 9); g.fillRect(26, 21, 4, 9); g.fillRect(4, 26, 24, 10); g.fillRect(10, 24, 12, 2);
      g.globalAlpha = 1;
      g.fillStyle = a.skin; g.fillRect(12, 27, 8, 2);
    }
    g.fillStyle = "#9a4a40"; g.fillRect(12, 27, 8, 1);
    g.fillStyle = shade(a.skin, -0.04); g.fillRect(13, 28, 6, 1);
    if (a.glasses) {
      g.strokeStyle = a.glasses; g.lineWidth = 1;
      g.strokeRect(5.5, 12.5, 8, 7); g.strokeRect(18.5, 12.5, 8, 7);
      g.fillStyle = a.glasses; g.fillRect(13, 15, 6, 1); g.fillRect(0, 15, 6, 1); g.fillRect(26, 15, 6, 1);
    }
    // stripes
    g.fillStyle = "#f2efe6"; g.fillRect(32, 0, 32, 32);
    g.fillStyle = a.stripe ?? "#2f3e57";
    for (let y = 1; y < 32; y += 5) g.fillRect(32, y, 32, 2);
  });
  const t = texture(c, { repeat: false });
  t.generateMipmaps = false;
  t.minFilter = THREE.LinearFilter;
  cache.set(id, t);
  return t;
}

// Window glass by day, two metres square: pale sky toward the top, soft diagonal streaks of reflection.
export function glass() {
  const id = "glass";
  if (cache.has(id)) return cache.get(id);
  const c = canvas(64, 64, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, "#bcd5e2"); gr.addColorStop(0.55, "#d6e6ec"); gr.addColorStop(1, "#e6efee");
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = "rgba(255,255,255,0.4)";
    g.beginPath(); g.moveTo(4, h); g.lineTo(16, h); g.lineTo(44, 0); g.lineTo(32, 0); g.fill();
    g.fillStyle = "rgba(255,255,255,0.25)";
    g.beginPath(); g.moveTo(22, h); g.lineTo(26, h); g.lineTo(54, 0); g.lineTo(50, 0); g.fill();
  });
  const t = texture(c, { metres: 2 });
  cache.set(id, t);
  return t;
}

// The outside face of an outer wall, one metre square: vertical oak boards.
export function cladding(spec) {
  const id = `cladding:${JSON.stringify(spec)}`;
  if (cache.has(id)) return cache.get(id);
  const r = rng(hash(id));
  const c = canvas(128, 128, (g, w, h) => {
    g.fillStyle = spec.line; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 16) {
      g.fillStyle = r() < 0.5 ? spec.base : spec.alt;
      g.fillRect(x + 1, 0, 14, h);
      g.globalAlpha = 0.12; g.fillStyle = spec.line;
      for (let k = 0; k < 3; k++) g.fillRect(x + 3 + r() * 10, 0, 1, h);
      g.globalAlpha = 1;
    }
  });
  const t = texture(c, { metres: 1 });
  cache.set(id, t);
  return t;
}
