// Subagent balls: one small sphere per running subagent, hopping round its lane's desk, coloured by model family.
// They grow at far zooms (size.js) and are shaded in their own vertex colours, unlit, so they read the same by day and
// by night.
import { THREE } from "../world/api.js";
import { atLeast } from "./size.js";

// A subagent's colour by model family.
const MODEL = { opus: "#8e4ec6", sonnet: "#12a594", haiku: "#f5a524", other: "#8b8d98" };

// A subagent's family: the server's own word when it sent one, else read from the model id.
function modelFamily(model = "", family = null) {
  if (family && family in MODEL) return family;
  const m = String(model).toLowerCase();
  return m.includes("opus") ? "opus" : m.includes("sonnet") ? "sonnet" : m.includes("haiku") ? "haiku" : "other";
}

const MAX_PER_DESK = 8;
const R = 0.075;
const MIN_PX = 8; // a ball is never less than 8 CSS px across (4 px in radius)
const FADE_MS = 600;

// A faceted ball whose faces carry their own light (lighter on top, darker below and on the far side), multiplied
// by each instance's colour; the material is unlit.
function ballGeometry() {
  const geo = new THREE.IcosahedronGeometry(R, 1);
  const pos = geo.attributes.position, colors = new Float32Array(pos.count * 3);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), sun = new THREE.Vector3(0.35, 1, 0.45).normalize();
  for (let i = 0; i < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i); b.fromBufferAttribute(pos, i + 1); c.fromBufferAttribute(pos, i + 2);
    const n = b.sub(a).cross(c.sub(a)).normalize();
    const shade = 0.72 + 0.28 * Math.max(0, n.dot(sun));
    for (let k = 0; k < 3; k++) colors.set([shade, shade, shade], (i + k) * 3);
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return geo;
}

export class Balls {
  constructor(max = 256) {
    this.mesh = new THREE.InstancedMesh(ballGeometry(), new THREE.MeshBasicMaterial({ vertexColors: true }), max);
    this.mesh.count = 0;
    this.mesh.castShadow = false;
    this.mesh.frustumCulled = false;
    this.mesh.name = "balls";
    this.max = max;
    this.desks = new Map(); // lane -> { frame: Matrix4 (the desk), centre, reach, balls: [{ key, family, born, gone }] }
    this.m = new THREE.Matrix4();
    this.c = new THREE.Color();
    this.scale = 1;
  }

  // subagents: the lane's vitals' [{ id, model, family }] (or a count). frame: the desk group's world matrix;
  // centre: a local point; reach: how far they range across (metres), small enough to stay off the next desk.
  set(lane, subagents, frame, centre, now, reach = 0.75) {
    const list = Array.isArray(subagents) ? subagents : Array.from({ length: Math.max(0, subagents | 0) }, () => ({ model: "" }));
    const want = list.slice(0, MAX_PER_DESK).map((s, i) => {
      const family = modelFamily(s.model, s.family);
      return { key: s.id ?? `${family}:${i}`, family };
    });
    const d = this.desks.get(lane) ?? { balls: [] };
    d.frame = frame; d.centre = centre; d.reach = reach;
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

  // ppm: the camera's CSS px per metre, for the size at this zoom.
  update(now, ppm = 0) {
    const k = (this.scale = atLeast(R * 2, ppm, MIN_PX));
    let n = 0;
    const p = new THREE.Vector3();
    for (const [lane, d] of this.desks) {
      d.balls = d.balls.filter((b) => !b.gone || now - b.gone < FADE_MS);
      if (!d.balls.length) { this.desks.delete(lane); continue; }
      d.balls.forEach((b, i) => {
        if (n >= this.max) return;
        const t = now / 1000;
        // a slow walk round an ellipse in front of the desk, hopping as it goes; the floor of the hop is the ball's
        // radius at its size now, so a grown ball does not sink into the floor or the chair's seat
        const a = t * 0.55 + (i / Math.max(1, d.balls.length)) * Math.PI * 2 + b.seed;
        const hop = Math.abs(Math.sin(t * 4.2 + b.seed * 3));
        p.set(d.centre.x + Math.cos(a) * d.reach, R * k + hop * 0.26, d.centre.z + 0.2 + Math.sin(a) * d.reach * 0.45);
        p.applyMatrix4(d.frame);
        const grow = Math.min(1, (now - b.born) / 300);
        const fade = b.gone ? 1 - (now - b.gone) / FADE_MS : 1;
        const s = Math.max(0.001, grow * fade) * k * (1 + (1 - hop) * 0.12);
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
