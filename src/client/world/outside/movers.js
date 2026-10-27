// The town's cars and people. Each follows its closed loop by distance: cars keep their distance, slow for corners,
// give way at junctions (the lower number goes first when two wait on each other) and stop for people on a zebra;
// people step down onto the zebras and swing their legs as they walk.
import { THREE, instanced, at } from "./parts.js";
import { car, carLights, kei, personBody, personHead, personLeg } from "./models.js";
import { LEVEL } from "./gen.js";

const STUCK = 5;  // seconds stopped before a car stops waiting (so nothing can lock up for good)

// A closed polyline walked by distance.
function loop(pts) {
  const n = pts.length, cum = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) { const a = pts[i], b = pts[(i + 1) % n]; cum[i + 1] = cum[i] + Math.hypot(b.x - a.x, b.z - a.z); }
  const len = cum[n];
  let hint = 0;
  return {
    len,
    at(d, out) {
      d = ((d % len) + len) % len;
      let i = hint;
      if (cum[i] > d || cum[i + 1] < d) { let lo = 0, hi = n; while (lo < hi) { const m = (lo + hi) >> 1; if (cum[m + 1] < d) lo = m + 1; else hi = m; } i = lo; }
      hint = i;
      const a = pts[i], b = pts[(i + 1) % n], seg = cum[i + 1] - cum[i] || 1, t = (d - cum[i]) / seg;
      out.x = a.x + (b.x - a.x) * t; out.z = a.z + (b.z - a.z) * t;
      out.hx = (b.x - a.x) / seg; out.hz = (b.z - a.z) / seg;
      return out;
    },
  };
}

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(0, 0, 0, "YXZ"), _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1);
function put(mesh, i, x, y, z, ry, rx = 0, sz = 1) {
  _e.set(rx, ry, 0, "YXZ");
  mesh.setMatrixAt(i, _m.compose(_p.set(x, y, z), _q.setFromEuler(_e), _s.set(1, 1, sz)));
}

export class Movers {
  constructor(layout, P, { mat, add }) {
    const C = P.city, G = P.glow;
    const rects = [...layout.roads, ...layout.junctions];
    this.cars = layout.cars.map((c, i) => ({ i, loop: loop(c.path), d: c.offset, top: c.speed, v: c.speed, kei: c.kind === "kei", paint: c.paint, still: 0, ghost: 0, x: 0, z: 0, hx: 0, hz: 1 }));
    this.people = layout.people.map((p) => {
      const L = loop(p.path);
      // the stretches of the loop that cross a road, so the walker steps down to it there
      const road = [], q = { x: 0, z: 0 };
      const near = rects.filter((r) => p.path.some((pt) => pt.x > r.minX - 40 && pt.x < r.maxX + 40 && pt.z > r.minZ - 40 && pt.z < r.maxZ + 40));
      let on = false, from = 0;
      for (let d = 0; d <= L.len; d += 0.5) {
        L.at(d, q);
        const now = near.some((r) => q.x > r.minX && q.x < r.maxX && q.z > r.minZ && q.z < r.maxZ);
        if (now && !on) from = d;
        if (!now && on) road.push([from - 0.3, d]);
        on = now;
      }
      if (on) road.push([from, L.len]);
      return { loop: L, d: p.offset, v: p.speed, road, phase: p.offset * 3.1, x: 0, z: 0, hx: 0, hz: 1, crossing: false, p };
    });
    const live = (m) => { if (m) { m.frustumCulled = false; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); add(m); } return m; };
    const paint = (c) => new THREE.Color(C.cars[c.paint % C.cars.length]);
    const sedans = this.cars.filter((c) => !c.kei), keis = this.cars.filter((c) => c.kei);
    sedans.forEach((c, k) => { c.mesh = "sedan"; c.k = k; });
    keis.forEach((c, k) => { c.mesh = "kei"; c.k = k; });
    const glass = P.night ? "#3a4252" : "#5d6872";
    this.sedan = live(instanced("cars", car(glass, "#2a2a2c"), mat("lit"), sedans, () => _m.identity(), paint));
    this.kei = live(instanced("cars:kei", kei(glass, "#2a2a2c"), mat("lit"), keis, () => _m.identity(), paint));
    this.lights = P.night ? live(instanced("cars:lights", carLights(G.head, G.tail), mat("glow"), this.cars, () => _m.identity())) : null;
    const W = this.people;
    this.body = live(instanced("people", personBody(), mat("lit"), W, () => _m.identity(), (w) => new THREE.Color(C.shirts[w.p.shirt % C.shirts.length])));
    this.legs = live(instanced("people:legs", personLeg(), mat("lit"), [...W, ...W], () => _m.identity(), (w) => new THREE.Color(C.pants[w.p.pants % C.pants.length])));
    this.heads = live(instanced("people:heads", personHead(C.hairs[0]), mat("lit"), W, () => _m.identity(), (w) => new THREE.Color(C.skins[w.p.skin % C.skins.length])));
    this.update(0);
  }

  update(dt) {
    dt = Math.min(0.1, Math.max(0, dt));
    const W = this.people, Cs = this.cars, look = { x: 0, z: 0, hx: 0, hz: 0 };
    for (const w of W) {
      w.d += w.v * dt;
      w.loop.at(w.d, w);
      const dd = ((w.d % w.loop.len) + w.loop.len) % w.loop.len;
      w.crossing = w.road.some(([a, b]) => dd >= a && dd <= b);
    }
    for (const c of Cs) c.loop.at(c.d, c);
    // who each car waits for: a car close ahead in its lane or crossing in front of it, or someone on the zebra
    for (const a of Cs) {
      let blocked = false;
      if (a.ghost > 0) a.ghost -= dt;
      else {
        for (const b of Cs) {
          if (b === a) continue;
          const rx = b.x - a.x, rz = b.z - a.z, ahead = rx * a.hx + rz * a.hz, lat = Math.abs(rx * a.hz - rz * a.hx);
          if (ahead < 0.3 || ahead > 4.8 || lat > 1.35) continue;
          // b waits on a too: the lower number goes
          const bx = a.x - b.x, bz = a.z - b.z, back = bx * b.hx + bz * b.hz, blat = Math.abs(bx * b.hz - bz * b.hx);
          if (back > 0.3 && back < 4.8 && blat < 1.35 && a.i < b.i) continue;
          blocked = true; break;
        }
        if (!blocked) for (const w of W) {
          if (!w.crossing) continue;
          const rx = w.x - a.x, rz = w.z - a.z, ahead = rx * a.hx + rz * a.hz;
          if (ahead > 0.3 && ahead < 4.2 && Math.abs(rx * a.hz - rz * a.hx) < 1.8) { blocked = true; break; }
        }
      }
      a.loop.at(a.d + 3.5, look);
      const turning = look.hx * a.hx + look.hz * a.hz < 0.92;
      const target = blocked ? 0 : turning ? a.top * 0.55 : a.top;
      a.v += (target - a.v) * Math.min(1, dt * (blocked ? 7 : 1.4));
      a.still = a.v < 0.05 ? a.still + dt : 0;
      if (a.still > STUCK) { a.ghost = 2.5; a.still = 0; }
    }
    for (const c of Cs) {
      c.d += c.v * dt;
      c.loop.at(c.d, c);
      const ry = Math.atan2(c.hx, c.hz);
      put(c.kei ? this.kei : this.sedan, c.k, c.x, LEVEL.road, c.z, ry);
      if (this.lights) put(this.lights, c.i, c.x, LEVEL.road, c.z, ry, 0, c.kei ? 3.1 / 3.3 : 1);
    }
    W.forEach((w, i) => {
      w.phase += w.v * dt * 5.4;
      const ry = Math.atan2(w.hx, w.hz), y = (w.crossing ? LEVEL.road : LEVEL.walk) + Math.abs(Math.sin(w.phase)) * 0.035;
      const swing = Math.sin(w.phase) * 0.5;
      put(this.body, i, w.x, y, w.z, ry);
      put(this.heads, i, w.x, y, w.z, ry);
      const sx = w.hz * 0.09, sz = -w.hx * 0.09;
      put(this.legs, i, w.x + sx, y + 0.64, w.z + sz, ry, swing);
      put(this.legs, i + W.length, w.x - sx, y + 0.64, w.z - sz, ry, -swing);
    });
    for (const m of [this.sedan, this.kei, this.lights, this.body, this.legs, this.heads]) if (m) m.instanceMatrix.needsUpdate = true;
  }
}
