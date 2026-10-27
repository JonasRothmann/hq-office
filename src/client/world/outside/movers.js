// The town's movers: cars, vans and the bus, cyclists, walkers, and the boats bobbing at the quays. Each mover follows
// its closed loop by distance. Vehicles keep their distance, slow for corners, give way at junctions (the lower number
// goes first when two wait on each other) and stop for anyone on a zebra or a blue bike crossing in front of them;
// walkers and riders step up and down with the ground (road, bike track, pavement, quay, the arch of a footbridge).
import { THREE, instanced } from "./parts.js";
import { bike, boat, bus, car, carLights, cargoBike, kei, personBody, personHead, personLeg } from "./models.js";
import { LEVEL } from "../../office/outside/gen.js";
import { BOATS } from "../../office/outside/city.js";

const STUCK = 5;   // seconds stopped before a vehicle stops waiting (so nothing can lock up for good)
const STEP = 0.5;  // metres between samples of the ground along a loop

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

// Rects bucketed by 8 m cells, for "which of these is (x, z) in".
function rectIndex(rects) {
  const cell = 8, grid = new Map(), key = (i, j) => i * 100003 + j;
  rects.forEach((r) => {
    for (let i = Math.floor(r.minX / cell); i <= Math.floor(r.maxX / cell); i++) for (let j = Math.floor(r.minZ / cell); j <= Math.floor(r.maxZ / cell); j++) {
      const k = key(i, j);
      if (!grid.has(k)) grid.set(k, []);
      grid.get(k).push(r);
    }
  });
  return (x, z) => (grid.get(key(Math.floor(x / cell), Math.floor(z / cell))) ?? []).find((r) => x > r.minX && x < r.maxX && z > r.minZ && z < r.maxZ);
}

// The ground under a loop, sampled every STEP metres: its height, and whether it is on the carriageway.
function ground(layout) {
  const cn = layout.canal;
  const bridge = rectIndex(cn.bridges), raised = rectIndex([...cn.quays, cn.row, cn.back]);
  const carriage = rectIndex([...layout.roads, ...layout.junctions, ...layout.crossings, ...layout.bikeCrossings]), track = rectIndex(layout.bikes);
  return (L) => {
    const n = Math.ceil(L.len / STEP), y = new Float32Array(n), road = new Uint8Array(n), q = { x: 0, z: 0 };
    for (let k = 0; k < n; k++) {
      L.at(k * STEP, q);
      const br = bridge(q.x, q.z);
      if (br) { const t = br.along === "z" ? (q.z - br.minZ) / (br.maxZ - br.minZ) : (q.x - br.minX) / (br.maxX - br.minX); y[k] = LEVEL.quay + 0.02 + 0.55 * Math.sin(Math.PI * t); continue; }
      if (raised(q.x, q.z)) { y[k] = LEVEL.quay; continue; }
      if (carriage(q.x, q.z)) { y[k] = LEVEL.road; road[k] = 1; continue; }
      y[k] = track(q.x, q.z) ? LEVEL.bike : LEVEL.walk;
    }
    return { y, road, at: (d) => Math.floor((((d % L.len) + L.len) % L.len) / STEP) % n };
  };
}

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(0, 0, 0, "YXZ"), _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1);
function put(mesh, i, x, y, z, ry, rx = 0, sz = 1, rz = 0) {
  _e.set(rx, ry, rz, "YXZ");
  mesh.setMatrixAt(i, _m.compose(_p.set(x, y, z), _q.setFromEuler(_e), _s.set(1, 1, sz)));
}

export class Movers {
  constructor(layout, P, { mat, add }) {
    const C = P.city, G = P.glow;
    const sample = ground(layout);
    this.t = 0;
    this.cars = layout.cars.map((c, i) => ({ i, loop: loop(c.path), d: c.offset, top: c.speed, v: c.speed, kind: c.kind, len: c.len, paint: c.paint, still: 0, ghost: 0, x: 0, z: 0, hx: 0, hz: 1 }));
    this.people = layout.people.map((p) => { const L = loop(p.path); return { loop: L, g: sample(L), d: p.offset, v: p.speed, phase: p.offset * 3.1, x: 0, z: 0, hx: 0, hz: 1, crossing: false, p }; });
    this.riders = layout.cyclists.map((c) => { const L = loop(c.path); return { loop: L, g: sample(L), d: c.offset, v: c.speed, phase: c.offset * 2.3, x: 0, z: 0, hx: 0, hz: 1, crossing: false, y: 0, p: c }; });
    const live = (m) => { if (m) { m.frustumCulled = false; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); add(m); } return m; };
    const glass = P.night ? "#3a4252" : "#5d6872";
    const byKind = { car: [], van: [], bus: [] };
    for (const c of this.cars) { c.k = byKind[c.kind].length; byKind[c.kind].push(c); }
    const paint = (c) => new THREE.Color(c.kind === "bus" ? C.bus : C.cars[c.paint % C.cars.length]);
    this.meshes = {
      car: live(instanced("cars", car(glass, "#2a2a2c"), mat("lit"), byKind.car, () => _m.identity(), paint)),
      van: live(instanced("cars:van", kei(glass, "#2a2a2c"), mat("lit"), byKind.van, () => _m.identity(), paint)),
      bus: live(instanced("cars:bus", bus(glass, "#2a2a2c"), mat("lit"), byKind.bus, () => _m.identity(), paint)),
    };
    this.lights = P.night ? live(instanced("cars:lights", carLights(G.head, G.tail), mat("glow"), this.cars, () => _m.identity())) : null;

    // bikes: the ridden ones first in each mesh, then the parked ones (placed once)
    const ridden = { bike: this.riders.filter((r) => !r.p.cargo), cargo: this.riders.filter((r) => r.p.cargo) };
    const parked = { bike: layout.racks.filter((r) => !r.cargo), cargo: layout.racks.filter((r) => r.cargo) };
    for (const kind of ["bike", "cargo"]) ridden[kind].forEach((r, k) => { r.mesh = kind; r.k = k; });
    const bikePaint = (b) => new THREE.Color(C.bikes[(b.paint ?? b.p.paint) % C.bikes.length]);
    const lean = (r) => { _e.set(0, r.ry, 0.16, "YXZ"); return _m.clone().compose(_p.set(r.x, LEVEL.walk, r.z), _q.setFromEuler(_e), _s.set(1, 1, 1)); };
    this.bikes = {};
    for (const kind of ["bike", "cargo"]) {
      const items = [...ridden[kind], ...parked[kind]];
      const m = instanced(kind === "bike" ? "bikes" : "bikes:cargo", kind === "bike" ? bike() : cargoBike(), mat("lit"), items, (it, i) => (i < ridden[kind].length ? _m.identity() : lean(it)), bikePaint);
      this.bikes[kind] = live(m);
    }

    // walkers and riders share the people meshes: walkers first, then riders
    const all = [...this.people, ...this.riders], nW = this.people.length;
    this.riders.forEach((r, k) => { r.slot = nW + k; });
    this.body = live(instanced("people", personBody(), mat("lit"), all, () => _m.identity(), (w) => new THREE.Color(C.shirts[w.p.shirt % C.shirts.length])));
    this.legs = live(instanced("people:legs", personLeg(), mat("lit"), [...all, ...all], () => _m.identity(), (w) => new THREE.Color(C.pants[w.p.pants % C.pants.length])));
    this.heads = live(instanced("people:heads", personHead(C.hairs[0]), mat("lit"), all, () => _m.identity(), (w) => new THREE.Color(C.skins[w.p.skin % C.skins.length])));
    this.nPeople = all.length;

    // boats, by kind
    this.boats = layout.boats.map((b) => ({ ...b }));
    this.boatMeshes = {};
    for (const kind of Object.keys(BOATS)) {
      const items = this.boats.filter((b) => b.kind === kind);
      items.forEach((b, k) => { b.k = k; });
      this.boatMeshes[kind] = live(instanced(`boats:${kind}`, boat(kind, BOATS[kind]), mat("lit"), items, () => _m.identity(), (b) => new THREE.Color(C.boats[b.paint % C.boats.length])));
    }
    this.update(0);
  }

  update(dt) {
    dt = Math.min(0.1, Math.max(0, dt));
    this.t += dt;
    const W = this.people, Rd = this.riders, Cs = this.cars, look = { x: 0, z: 0, hx: 0, hz: 0 };
    for (const w of [...W, ...Rd]) {
      w.d += w.v * dt;
      w.loop.at(w.d, w);
      const k = w.g.at(w.d);
      w.crossing = w.g.road[k] === 1;
      w.y = w.g.y[k];
    }
    for (const c of Cs) c.loop.at(c.d, c);
    // who each vehicle waits for: one close ahead in its lane or crossing in front of it, or anyone on a crossing
    for (const a of Cs) {
      let blocked = false;
      if (a.ghost > 0) a.ghost -= dt;
      else {
        for (const b of Cs) {
          if (b === a) continue;
          const gap = (a.len + b.len) / 2 + 1.5;
          const rx = b.x - a.x, rz = b.z - a.z, ahead = rx * a.hx + rz * a.hz, lat = Math.abs(rx * a.hz - rz * a.hx);
          if (ahead < 0.3 || ahead > gap || lat > 1.35) continue;
          // b waits on a too: the lower number goes
          const bx = a.x - b.x, bz = a.z - b.z, back = bx * b.hx + bz * b.hz, blat = Math.abs(bx * b.hz - bz * b.hx);
          if (back > 0.3 && back < gap && blat < 1.35 && a.i < b.i) continue;
          blocked = true; break;
        }
        if (!blocked) for (const w of [...W, ...Rd]) {
          if (!w.crossing) continue;
          const rx = w.x - a.x, rz = w.z - a.z, ahead = rx * a.hx + rz * a.hz;
          if (ahead > 0.3 && ahead < a.len / 2 + 2.6 && Math.abs(rx * a.hz - rz * a.hx) < 1.8) { blocked = true; break; }
        }
      }
      a.loop.at(a.d + 3.5, look);
      const turning = look.hx * a.hx + look.hz * a.hz < 0.92;
      const target = blocked ? 0 : turning ? a.top * (a.kind === "bus" ? 0.45 : 0.55) : a.top;
      a.v += (target - a.v) * Math.min(1, dt * (blocked ? 7 : 1.4));
      a.still = a.v < 0.05 ? a.still + dt : 0;
      if (a.still > STUCK) { a.ghost = 2.5; a.still = 0; }
    }
    for (const c of Cs) {
      c.d += c.v * dt;
      c.loop.at(c.d, c);
      const ry = Math.atan2(c.hx, c.hz);
      put(this.meshes[c.kind], c.k, c.x, LEVEL.road, c.z, ry);
      if (this.lights) put(this.lights, c.i, c.x, LEVEL.road, c.z, ry, 0, c.len / 3.3);
    }
    W.forEach((w, i) => {
      w.phase += w.v * dt * 5.4;
      const ry = Math.atan2(w.hx, w.hz), y = w.y + Math.abs(Math.sin(w.phase)) * 0.035;
      const swing = Math.sin(w.phase) * 0.5;
      put(this.body, i, w.x, y, w.z, ry);
      put(this.heads, i, w.x, y, w.z, ry);
      const sx = w.hz * 0.09, sz = -w.hx * 0.09;
      put(this.legs, i, w.x + sx, y + 0.64, w.z + sz, ry, swing);
      put(this.legs, i + this.nPeople, w.x - sx, y + 0.64, w.z - sz, ry, -swing);
    });
    // riders: the bike on the ground, the rider on the saddle leaning to the bars, legs turning the pedals
    for (const r of Rd) {
      r.phase += r.v * dt * 2.6;
      const ry = Math.atan2(r.hx, r.hz);
      put(this.bikes[r.mesh], r.k, r.x, r.y, r.z, ry);
      const bx = r.x - r.hx * 0.24, bz = r.z - r.hz * 0.24, y = r.y + 0.2;
      put(this.body, r.slot, bx, y, bz, ry, 0.22);
      put(this.heads, r.slot, bx, y, bz, ry, 0.22);
      const sx = r.hz * 0.09, sz = -r.hx * 0.09, hx = bx + r.hx * 0.12, hz = bz + r.hz * 0.12, pedal = Math.sin(r.phase) * 0.42;
      put(this.legs, r.slot, hx + sx, y + 0.66, hz + sz, ry, -1.0 + pedal);
      put(this.legs, r.slot + this.nPeople, hx - sx, y + 0.66, hz - sz, ry, -1.0 - pedal);
    }
    // boats bob and roll a little at their moorings
    for (const b of this.boats) {
      const t = this.t + b.phase;
      put(this.boatMeshes[b.kind], b.k, b.x, LEVEL.canal + Math.sin(t * 1.1) * 0.035, b.z, b.ry, Math.sin(t * 0.6 + 1.3) * 0.012, 1, Math.sin(t * 0.8) * 0.03);
    }
    for (const m of [...Object.values(this.meshes), this.lights, this.body, this.legs, this.heads, ...Object.values(this.bikes), ...Object.values(this.boatMeshes)]) if (m) m.instanceMatrix.needsUpdate = true;
  }
}
