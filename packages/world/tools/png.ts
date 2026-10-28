// A small PNG decoder for the proof's screenshots (8-bit RGB or RGBA, not interlaced: what Chrome writes), so pixels
// on screen can be compared without a dependency.
import { inflateSync } from "node:zlib";

export type Image = { w: number; h: number; px: Uint8Array }; // RGBA, rows top-down

export function decodePng(buf: Uint8Array): Image {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let at = 8, w = 0, h = 0, channels = 0;
  const idat: Uint8Array[] = [];
  while (at < buf.length) {
    const len = dv.getUint32(at), type = String.fromCharCode(...buf.subarray(at + 4, at + 8));
    const data = buf.subarray(at + 8, at + 8 + len);
    if (type === "IHDR") {
      w = dv.getUint32(at + 8); h = dv.getUint32(at + 12);
      const depth = data[8], colour = data[9], interlace = data[12];
      if (depth !== 8 || (colour !== 2 && colour !== 6) || interlace) throw new Error(`png: depth ${depth}, colour type ${colour}, interlace ${interlace} not handled`);
      channels = colour === 6 ? 4 : 3;
    } else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    at += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = w * channels, px = new Uint8Array(w * h * 4), prev = new Uint8Array(stride), row = new Uint8Array(stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let i = 0; i < stride; i++) {
      const a = i >= channels ? row[i - channels] : 0, b = prev[i], c = i >= channels ? prev[i - channels] : 0;
      let v = src[i];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      row[i] = v & 255;
    }
    for (let x = 0; x < w; x++) for (let k = 0; k < 4; k++) px[(y * w + x) * 4 + k] = k < channels ? row[x * channels + k] : 255;
    prev.set(row);
  }
  return { w, h, px };
}
