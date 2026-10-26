// The camera: orthographic, 30° down, 45° azimuth turned in 90° steps, three zoom steps, fit to bounds, eased.
import { THREE } from "./kit.js";

export const PITCH = Math.PI / 6; // 30°: a tile projects to an exact 2:1 diamond
export const ZOOMS = [22.6, 45.3, 90.5]; // px per metre: far, medium, near
const MIN_PPM = ZOOMS[0] * 0.55;
const EASE = 0.16; // per frame at 60 fps

export function azimuth(rot) {
  return Math.PI / 4 + rot * (Math.PI / 2);
}

export class View {
  constructor() {
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 600);
    this.rot = 0;            // target rotation step (any integer; 0..3 after mod)
    this.az = azimuth(0);    // current azimuth, eased toward the target
    this.ppm = ZOOMS[1];
    this.ppmTo = this.ppm;
    this.target = new THREE.Vector3();
    this.targetTo = new THREE.Vector3();
    this.size = { w: 1, h: 1 };
    this.insets = { left: 0, top: 0, right: 0, bottom: 0 };
    this.fitting = true;     // follow the plan's bounds until the owner pans or zooms
    this.bounds = null;
  }

  get rotation() { return ((this.rot % 4) + 4) % 4; }

  resize(w, h) { this.size = { w: Math.max(1, w), h: Math.max(1, h) }; if (this.fitting && this.bounds) this.fit(this.bounds, true); }
  setInsets(i) { this.insets = { ...this.insets, ...i }; if (this.fitting && this.bounds) this.fit(this.bounds, true); }

  rotate(dir) {
    this.rot += dir > 0 ? 1 : -1;
    if (this.fitting && this.bounds) this.fit(this.bounds);
  }

  // A zoom step 0 far, 1 medium, 2 near; keeps the point in the middle where it is.
  zoom(level) {
    this.fitting = false;
    this.ppmTo = ZOOMS[Math.max(0, Math.min(2, level))];
  }

  zoomBy(factor) {
    this.fitting = false;
    this.ppmTo = Math.max(MIN_PPM, Math.min(ZOOMS[2] * 1.25, this.ppmTo * factor));
  }

  // Look at a ground point (eased unless now).
  focus(x, z, now = false) {
    this.fitting = false;
    this.targetTo.set(x, 0, z);
    if (now) this.target.copy(this.targetTo);
  }

  // Pan by a drag of dx, dy CSS pixels.
  pan(dx, dy) {
    this.fitting = false;
    const right = new THREE.Vector3(Math.cos(this.az), 0, -Math.sin(this.az));
    const down = new THREE.Vector3(Math.sin(this.az), 0, Math.cos(this.az)).multiplyScalar(1 / Math.sin(PITCH));
    this.targetTo.addScaledVector(right, -dx / this.ppm).addScaledVector(down, -dy / this.ppm);
    this.target.copy(this.targetTo);
  }

  // Frame the box { minX, minZ, maxX, maxZ } (and its walls) in the free part of the window: the ppm that fits,
  // never nearer than the near step, never farther than a little past the far one.
  fit(b, now = false) {
    this.bounds = b;
    this.fitting = true;
    const az = azimuth(this.rot);
    const ca = Math.cos(az), sa = Math.sin(az);
    let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
    for (const [x, z] of [[b.minX, b.minZ], [b.maxX, b.minZ], [b.minX, b.maxZ], [b.maxX, b.maxZ]]) {
      for (const y of [0, 2.95]) {
        const u = x * ca - z * sa;                                        // screen right
        const v = y * Math.cos(PITCH) - (x * sa + z * ca) * Math.sin(PITCH); // screen up
        minU = Math.min(minU, u); maxU = Math.max(maxU, u); minV = Math.min(minV, v); maxV = Math.max(maxV, v);
      }
    }
    const { w, h } = this.size, i = this.insets;
    const freeW = Math.max(80, w - i.left - i.right - 48), freeH = Math.max(80, h - i.top - i.bottom - 48);
    const ppm = Math.max(MIN_PPM, Math.min(ZOOMS[2], freeW / (maxU - minU), freeH / (maxV - minV)));
    this.ppmTo = ppm;
    // the ground point that projects to the middle of the box
    const cu = (minU + maxU) / 2, cv = (minV + maxV) / 2;
    // u = x ca - z sa ; v_ground = -(x sa + z ca) sin(P)  -> solve for x, z at y = 0
    const g = -cv / Math.sin(PITCH);
    this.targetTo.set(cu * ca + g * sa, 0, -cu * sa + g * ca);
    if (now) { this.ppm = ppm; this.target.copy(this.targetTo); this.az = az; }
  }

  // Ease toward the targets; returns true while still moving.
  update(dt = 1 / 60) {
    const k = 1 - Math.pow(1 - EASE, dt * 60);
    const azTo = azimuth(this.rot);
    let moving = false;
    if (Math.abs(azTo - this.az) > 1e-4) { this.az += (azTo - this.az) * k; moving = true; } else this.az = azTo;
    if (Math.abs(this.ppmTo - this.ppm) > 1e-3) { this.ppm += (this.ppmTo - this.ppm) * k; moving = true; } else this.ppm = this.ppmTo;
    if (this.target.distanceToSquared(this.targetTo) > 1e-6) { this.target.lerp(this.targetTo, k); moving = true; } else this.target.copy(this.targetTo);
    this.apply();
    return moving;
  }

  apply() {
    const cam = this.camera, { w, h } = this.size, i = this.insets;
    const d = 120;
    cam.position.set(
      this.target.x + Math.sin(this.az) * Math.cos(PITCH) * d,
      this.target.y + Math.sin(PITCH) * d,
      this.target.z + Math.cos(this.az) * Math.cos(PITCH) * d,
    );
    cam.up.set(0, 1, 0);
    cam.lookAt(this.target);
    // the target sits in the middle of the free part of the window, not of the whole canvas
    const ox = (i.left - i.right) / 2, oy = (i.top - i.bottom) / 2;
    cam.left = (-w / 2 - ox) / this.ppm;
    cam.right = (w / 2 - ox) / this.ppm;
    cam.top = (h / 2 + oy) / this.ppm;
    cam.bottom = (-h / 2 + oy) / this.ppm;
    cam.near = 0.1; cam.far = d * 2 + 200;
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();
  }

  // The camera's horizontal direction (toward the camera), for facing workers at it.
  facing() {
    return Math.atan2(Math.sin(this.az), Math.cos(this.az));
  }
}
