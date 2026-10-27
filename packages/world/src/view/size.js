// The canvas's backing store in device pixels, and the CSS size the camera draws for, so that one backing-store pixel
// is one device pixel. Only then does the camera's whole-pixel snap hold on screen and not just in the buffer: a
// buffer even one pixel off its box is stretched by the browser, and every pan is resampled. Pure.

export const MAX_DPR = 2;

/**
 * @param {{ css: { w: number, h: number }, dpr: number, device?: { w: number, h: number } | null }} m
 *   css: the canvas's CSS content box (it may be fractional); device: its device-pixel content box, when the browser
 *   reports one (ResizeObserver's devicePixelContentBoxSize)
 * @returns {{ w: number, h: number, dpr: number, bw: number, bh: number, style: { w: number, h: number } | null }}
 *   w, h: the CSS px the camera draws (bw / dpr, so fractional when the box is); bw, bh: the backing store; style: the
 *   CSS size to give the canvas when the browser cannot report device pixels (null when it can, or above MAX_DPR,
 *   where the buffer is scaled up and no snap can hold)
 */
export function canvasSize({ css, dpr, device = null }) {
  const real = dpr > 0 ? dpr : 1;
  const scale = Math.min(real, MAX_DPR);
  if (device && device.w > 0 && device.h > 0 && scale === real) return { w: device.w / real, h: device.h / real, dpr: real, bw: device.w, bh: device.h, style: null };
  const bw = Math.max(1, Math.round(css.w * scale)), bh = Math.max(1, Math.round(css.h * scale));
  return { w: bw / scale, h: bh / scale, dpr: scale, bw, bh, style: scale === real ? { w: bw / scale, h: bh / scale } : null };
}
