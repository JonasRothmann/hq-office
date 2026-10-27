// Subagent balls: one small sphere per running subagent, hopping round its lane's desk, coloured by model family.
import { THREE } from "./kit.js";
import { MODEL, modelFamily } from "./look.js";

const MAX_PER_DESK = 8;
const R = 0.075;
const FADE_MS = 600;

export class Balls {
  constructor(max = 256) {
    const geo = new THREE.IcosahedronGeometry(R, 1);
    this.mesh = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ flatShading: true }), max);
    this.mesh.count = 0;
    this.mesh.castShadow = false;
    this.mesh.frustumCulled = false;
    this.mesh.name = "balls";
    this.max = max;
    this.desks = new Map(); // lane -> { frame: Matrix4 (office), centre, balls: [{ key, family, born, gone }] }
    this.m = new THREE.Matrix4();
    this.c = new THREE.Color();
  }

  // subagents: [{ id?, model }] or a count. frame: the office group's world matrix; centre: a local point.
  set(lane, subagents, frame, centre, now) {
    const list = Array.isArray(subagents) ? subagents : Array.from({ length: Math.max(0, subagents | 0) }, () => ({ model: "" }));
    const want = list.slice(0, MAX_PER_DESK).map((s, i) => ({ key: s.id ?? `${modelFamily(s.model)}:${i}`, family: modelFamily(s.model) }));
    const d = this.desks.get(lane) ?? { balls: [] };
    d.frame = frame; d.centre = centre;
    const keys = new Set(want.map((w) => w.key));
    for (const b of d.balls) if (!keys.has(b.key) && !b.gone) b.gone = now;
    const have = new Set(d.balls.filter((b) => !b.gone).map((b) => b.key));
    for (const w of want) if (!have.has(w.key)) d.balls.push({ ...w, born: now, gone: 0, seed: Math.random() * 10 });
    this.desks.set(lane, d);
  }

  drop(lane, now) {
    const d = this.desks.get(lane);
    if (d) for (const b of d.balls) if (!b.gone) b.gone = now;
  }

  clear() { this.desks.clear(); this.mesh.count = 0; }

  update(now) {
    let n = 0;
    const p = new THREE.Vector3();
    for (const [lane, d] of this.desks) {
      d.balls = d.balls.filter((b) => !b.gone || now - b.gone < FADE_MS);
      if (!d.balls.length) { this.desks.delete(lane); continue; }
      d.balls.forEach((b, i) => {
        if (n >= this.max) return;
        const t = now / 1000;
        // a slow walk round an ellipse in front of the desk, hopping as it goes
        const a = t * 0.55 + (i / Math.max(1, d.balls.length)) * Math.PI * 2 + b.seed;
        const hop = Math.abs(Math.sin(t * 4.2 + b.seed * 3));
        p.set(d.centre.x + Math.cos(a) * 1.25, R + hop * 0.26, d.centre.z + 0.35 + Math.sin(a) * 0.55);
        p.applyMatrix4(d.frame);
        const grow = Math.min(1, (now - b.born) / 300);
        const fade = b.gone ? 1 - (now - b.gone) / FADE_MS : 1;
        const s = Math.max(0.001, grow * fade) * (1 + (1 - hop) * 0.12);
        this.m.compose(p, new THREE.Quaternion(), new THREE.Vector3(s * (1 + (1 - hop) * 0.15), s * (1 - (1 - hop) * 0.18), s * (1 + (1 - hop) * 0.15)));
        this.mesh.setMatrixAt(n, this.m);
        this.mesh.setColorAt(n, this.c.set(MODEL[b.family]));
        n++;
      });
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  dispose() { this.mesh.geometry.dispose(); this.mesh.material.dispose(); }
}
