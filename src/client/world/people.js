// A low-poly worker (1.35 m standing) with poses per status, a painted face, a blob shadow and the badge over the head.
import { THREE, Kit, roomMaterial } from "./kit.js";
import { hash, pick, poseOf, markerOf } from "./look.js";
import { face as faceTexture, badge as badgeTexture, glow } from "./textures.js";
import { SEAT_H } from "./furniture.js";

const HIP = 0.62, THIGH = 0.3, SHIN = 0.27, UPPER = 0.25, FORE = 0.22;
const SEATED_HIP = SEAT_H + 0.02;

function part(build, mat) {
  const kit = new Kit();
  build(kit);
  const m = new THREE.Mesh(kit.geometry(), mat);
  m.castShadow = false;
  m.receiveShadow = false;
  return m;
}

const joint = (x, y, z) => {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.order = "YXZ";
  return g;
};

// Joint angles per pose: [rx, ry, rz] per joint; s is +1 for the joint on the +x side. t is seconds.
const POSES = {
  stand: () => ({ spine: [0, 0, 0], head: [0, 0, 0], legL: [0, 0, 0.03], legR: [0, 0, -0.03], kneeL: [0, 0, 0], kneeR: [0, 0, 0], armL: [0, 0, 0.08], armR: [0, 0, -0.08], elbowL: [-0.15, 0, 0], elbowR: [-0.15, 0, 0] }),
  seated: () => ({ legL: [-Math.PI / 2, 0, 0.05], legR: [-Math.PI / 2, 0, -0.05], kneeL: [Math.PI / 2 - 0.05, 0, 0], kneeR: [Math.PI / 2 - 0.05, 0, 0] }),
  work: (t) => {
    const a = Math.sin(t * 14), b = Math.sin(t * 14 + 2.1);
    return { spine: [0.14, 0, 0], head: [0.12 + Math.sin(t * 0.7) * 0.03, Math.sin(t * 0.4) * 0.12, 0],
      armL: [-0.85, 0, 0.12], armR: [-0.85, 0, -0.12], elbowL: [-0.7 + a * 0.08, 0.35, 0], elbowR: [-0.7 + b * 0.08, -0.35, 0] };
  },
  raise: (t) => {
    const wave = Math.sin(t * 5.5) * 0.28;
    return { spine: [-0.04, 0, 0.03], head: [-0.08, 0, 0.06 + Math.sin(t * 1.3) * 0.03],
      armR: [-Math.PI + 0.05, 0, -0.3 + wave], elbowR: [-0.35, 0, 0], armL: [0.02, 0, 0.1], elbowL: [-0.2, 0, 0] };
  },
  fold: (t) => ({ spine: [-0.32, 0, 0], head: [0.1, Math.sin(t * 0.5) * 0.25, 0],
    armL: [-0.55, 0, 0.18], armR: [-0.55, 0, -0.18], elbowL: [-1.45, -1.15, 0], elbowR: [-1.4, 1.15, 0] }),
  lean: (t) => ({ spine: [-0.38, 0, 0], head: [-0.22, Math.sin(t * 0.35) * 0.18, 0],
    armL: [-0.45, 0, 2.35], armR: [-0.45, 0, -2.35], elbowL: [0, 0, 2.05], elbowR: [0, 0, -2.05] }),
  mug: (t) => {
    const sip = Math.max(0, Math.sin(t * 0.9)) ** 6;
    return { spine: [-0.28, 0, 0], head: [-0.05 - sip * 0.25, 0, 0],
      armR: [-0.35 - sip * 0.55, 0, -0.12], elbowR: [-2.0 + sip * 0.1, 0.25, 0], armL: [-0.75, 0, 0.1], elbowL: [-0.55, 0, 0] };
  },
  sleep: (t) => ({ spine: [0.95 + Math.sin(t * 1.2) * 0.02, 0, 0], head: [0.25, 0.4, 0],
    armL: [-1.55, 0, 0.35], armR: [-1.55, 0, -0.35], elbowL: [-0.4, 1.0, 0], elbowR: [-0.4, -1.0, 0] }),
  // on the way to the break area and back: legs and arms swing in turn
  walk: (t) => {
    const s = Math.sin(t * 7.5);
    return { spine: [0.05, 0, 0], legL: [s * 0.45, 0, 0.03], legR: [-s * 0.45, 0, -0.03], kneeL: [Math.max(0, -s) * 0.6, 0, 0], kneeR: [Math.max(0, s) * 0.6, 0, 0],
      armL: [-s * 0.4, 0, 0.08], armR: [s * 0.4, 0, -0.08], elbowL: [-0.3, 0, 0], elbowR: [-0.3, 0, 0] };
  },
  // standing in the break area with a mug
  sip: (t) => {
    const sip = Math.max(0, Math.sin(t * 0.8)) ** 6;
    return { head: [-0.03 - sip * 0.25, Math.sin(t * 0.3) * 0.2, 0], armR: [-0.35 - sip * 0.55, 0, -0.12], elbowR: [-2.0 + sip * 0.1, 0.25, 0], armL: [0.05, 0, 0.1], elbowL: [-0.25, 0, 0] };
  },
};
const WALK_SPEED = 1.3; // metres a second
const SEATED = new Set(["work", "fold", "lean", "mug", "sleep"]);
// How far a seated pose turns from the desk toward the camera (0 faces the desk, 1 faces the camera).
const SWIVEL = { fold: 0.55, lean: 0.5, mug: 0.7 };
const JOINTS = ["spine", "head", "legL", "legR", "kneeL", "kneeR", "armL", "armR", "elbowL", "elbowR"];

export class Worker {
  constructor(name, L, light) {
    const h = hash(name);
    this.name = name;
    this.seed = h;
    this.pose = "away";
    this.status = null;
    const skin = pick(L.people.skin, h, 1), hair = pick(L.people.hair, h, 5), shirt = pick(L.shirts, h, 9), pants = pick(L.people.pants, h, 13);
    const style = h % 4;
    const mat = roomMaterial({ room: light });
    const faceMat = roomMaterial({ map: faceTexture(skin, hair), room: light, vertexColors: false });
    this.mats = [mat, faceMat];

    const root = new THREE.Group();
    root.name = `worker:${name}`;
    const hips = joint(0, HIP, 0);
    root.add(hips);
    hips.add(part((k) => k.rbox(0.28, 0.14, 0.17, pants, 0, -0.07, 0, 0.03), mat));
    const J = {};
    for (const [side, s] of [["L", 1], ["R", -1]]) {
      const leg = joint(s * 0.075, -0.02, 0);
      leg.add(part((k) => k.rbox(0.12, THIGH, 0.13, pants, 0, -THIGH, 0, 0.03), mat));
      const knee = joint(0, -THIGH, 0);
      knee.add(part((k) => { k.rbox(0.1, SHIN, 0.11, pants, 0, -SHIN, 0, 0.025); k.rbox(0.1, 0.06, 0.19, "#2b2b2e", 0, -SHIN - 0.05, 0.035, 0.02); }, mat));
      leg.add(knee);
      hips.add(leg);
      J[`leg${side}`] = leg; J[`knee${side}`] = knee;
    }
    const spine = joint(0, 0.0, 0);
    hips.add(spine);
    spine.add(part((k) => { k.rbox(0.31, 0.4, 0.18, shirt, 0, 0, 0, 0.05); k.rbox(0.2, 0.05, 0.15, shirt, 0, 0.39, 0, 0.02); }, mat));
    const head = joint(0, 0.42, 0);
    spine.add(head);
    head.add(part((k) => k.cyl(0.045, 0.06, skin, 0, 0, 0, { seg: 6 }), mat));
    const headGeo = new THREE.BoxGeometry(0.19, 0.22, 0.2);
    headGeo.translate(0, 0.16, 0);
    const col = new Float32Array(headGeo.attributes.position.count * 3);
    const sc = new THREE.Color(skin);
    for (let i = 0; i < col.length; i += 3) col.set([sc.r, sc.g, sc.b], i);
    headGeo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    head.add(new THREE.Mesh(headGeo, [mat, mat, mat, mat, faceMat, mat]));
    head.add(part((k) => {
      k.rbox(0.21, 0.07, 0.22, hair, 0, 0.25, -0.005, 0.03);
      if (style === 0) k.rbox(0.21, 0.16, 0.06, hair, 0, 0.12, -0.085, 0.02);           // short
      if (style === 1) { k.rbox(0.21, 0.26, 0.07, hair, 0, 0.0, -0.085, 0.02); k.rbox(0.03, 0.18, 0.18, hair, 0.095, 0.1, -0.01, 0.01); k.rbox(0.03, 0.18, 0.18, hair, -0.095, 0.1, -0.01, 0.01); } // long
      if (style === 2) { k.rbox(0.21, 0.12, 0.06, hair, 0, 0.16, -0.085, 0.02); k.sphere(0.065, hair, 0, 0.33, -0.06, { detail: 1 }); } // bun
      if (style === 3) { k.rbox(0.22, 0.05, 0.08, hair, 0, 0.27, 0.07, 0.02); k.rbox(0.21, 0.15, 0.06, hair, 0, 0.13, -0.085, 0.02); } // fringe
    }, mat));
    for (const [side, s] of [["L", 1], ["R", -1]]) {
      const arm = joint(s * 0.19, 0.36, 0);
      arm.add(part((k) => k.rbox(0.09, UPPER, 0.1, shirt, 0, -UPPER, 0, 0.025), mat));
      const elbow = joint(0, -UPPER, 0);
      elbow.add(part((k) => { k.rbox(0.08, FORE, 0.085, shirt, 0, -FORE, 0, 0.02); k.rbox(0.075, 0.08, 0.08, skin, 0, -FORE - 0.07, 0, 0.02); }, mat));
      arm.add(elbow);
      spine.add(arm);
      J[`arm${side}`] = arm; J[`elbow${side}`] = elbow;
    }
    J.spine = spine; J.head = head;
    // a mug for the done pose, in the right hand
    this.mug = part((k) => { k.cyl(0.04, 0.09, "#f4f1ea", 0, 0, 0, { seg: 8 }); k.box(0.02, 0.05, 0.02, "#f4f1ea", 0.045, 0.02, 0); }, mat);
    this.mug.position.set(0, -FORE - 0.12, 0.03);
    this.mug.rotation.x = Math.PI / 2;
    J.elbowR.add(this.mug);

    // the blob shadow, the ring that marks the selected worker, and the badge
    const blob = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 0.75), new THREE.MeshBasicMaterial({ map: glow("rgba(0,0,0,0.42)"), transparent: true, depthWrite: false }));
    blob.rotation.x = -Math.PI / 2;
    blob.position.y = 0.014;
    blob.renderOrder = 2;
    root.add(blob);
    this.blob = blob;
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.36, 0.44, 32), new THREE.MeshBasicMaterial({ color: "#3e63dd", transparent: true, opacity: 0.85, depthWrite: false }));
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.02;
    this.ring.renderOrder = 3;
    this.ring.visible = false;
    root.add(this.ring);
    this.badge = new THREE.Sprite(new THREE.SpriteMaterial({ depthTest: false, transparent: true }));
    this.badge.scale.set(0.34, 0.425, 1);
    this.badge.renderOrder = 10;
    this.badge.visible = false;
    root.add(this.badge);

    this.root = root; this.hips = hips; this.J = J;
    this.current = Object.fromEntries(JOINTS.map((j) => [j, [0, 0, 0]]));
    this.spots = null;
    this.phase = (h % 1000) / 160;
    this.blocking = 0;
    this.marker = null;
    // Out of the office: null at the desk, "walking" on a path, "break" standing in the break area.
    this.out = null;
    this.path = null;
  }

  // Where this worker sits and stands, in its office's frame: seat and stand points, and the angle that faces the desk.
  place(spots) { this.spots = spots; this.apply(true); }

  // The lane's status and its open blocking questions. At the desk the status picks the pose; out of the office the
  // worker keeps walking or sipping until the world brings it back.
  setStatus(status, blocking = 0) {
    if (status === this.status && blocking === this.blocking) return;
    const moved = status !== this.status;
    this.status = status;
    this.blocking = blocking;
    const m = markerOf(status, blocking);
    this.marker = m;
    this.badge.visible = !!m;
    if (m) { this.badge.material.map = badgeTexture(m.color, m.glyph); this.badge.material.needsUpdate = true; }
    if (moved && !this.out) { this.pose = poseOf(status); this.apply(true); }
  }

  setSelected(on) { this.ring.visible = on; }

  apply(snap = false) {
    if (!this.spots || this.out) return;
    const away = this.pose === "away";
    this.root.visible = !away;
    if (away) return;
    const seated = SEATED.has(this.pose);
    const p = seated ? this.spots.seat : this.spots.stand;
    this.root.position.set(p.x, 0, p.z);
    this.hips.position.y = seated ? SEATED_HIP : HIP;
    if (seated) this.root.rotation.y = this.spots.faceDesk;
    this.badge.position.set(0, seated ? 1.62 : 1.86, 0);
    this.snap = snap;
  }

  // Walk along points ({ x, z } in the frame of whatever holds the worker now), then call arrive().
  walk(points, arrive) {
    this.out = "walking";
    this.path = points.map((p) => ({ x: p.x, z: p.z }));
    this.arrive = arrive;
    this.pose = "walk";
    this.root.visible = true;
    this.hips.position.y = HIP;
    this.badge.position.set(0, 1.86, 0);
  }

  // Stand at a point (in the frame of whatever holds the worker now), facing ry, with a mug.
  standAt(x, z, ry) {
    this.out = "break";
    this.path = null;
    this.pose = "sip";
    this.root.visible = true;
    this.root.position.set(x, 0, z);
    this.root.rotation.y = ry;
    this.hips.position.y = HIP;
    this.badge.position.set(0, 1.86, 0);
  }

  // Back at the desk (the world has put the worker back into its office): the status picks the pose again.
  home() {
    this.out = null;
    this.path = null;
    this.pose = poseOf(this.status);
    this.apply(true);
  }

  get walking() { return this.out === "walking"; }

  // facingCamera: the local angle that faces the camera (for the standing, hand-raised pose).
  update(t, dt, facingCamera) {
    if (this.pose === "away") return;
    if (this.path) this.step(dt);
    const tt = t + this.phase;
    const seated = SEATED.has(this.pose);
    const target = { ...POSES.stand(tt), ...(seated ? POSES.seated(tt) : {}), ...POSES[this.pose](tt) };
    const k = this.snap ? 1 : 1 - Math.pow(0.0015, dt);
    this.snap = false;
    for (const j of JOINTS) {
      const cur = this.current[j], to = target[j] ?? [0, 0, 0];
      for (let i = 0; i < 3; i++) cur[i] += (to[i] - cur[i]) * k;
      this.J[j].rotation.set(cur[0], cur[1], cur[2]);
    }
    if (this.out) { /* facing set by the path or the spot */ }
    else if (this.pose === "raise") this.root.rotation.y = facingCamera;
    else if (SWIVEL[this.pose] !== undefined) {
      // a worker who is not working swivels the chair away from the screen, part way toward the room (the camera):
      // waiting reads from the silhouette, not only from the colour of the badge
      const d = Math.atan2(Math.sin(facingCamera - this.spots.faceDesk), Math.cos(facingCamera - this.spots.faceDesk));
      const to = this.spots.faceDesk + d * SWIVEL[this.pose];
      const cur = this.root.rotation.y;
      this.root.rotation.y = cur + Math.atan2(Math.sin(to - cur), Math.cos(to - cur)) * Math.min(1, k * 0.6);
    } else if (seated) this.root.rotation.y = this.spots.faceDesk;
    this.mug.visible = this.pose === "mug" || this.pose === "sip";
    if (this.badge.visible) this.badge.position.y = (seated ? 1.62 : 1.86) + Math.sin(tt * 2.4) * 0.035;
  }

  // One step along the path, turning toward where it goes.
  step(dt) {
    let left = WALK_SPEED * dt;
    const pos = this.root.position;
    while (left > 0 && this.path.length) {
      const p = this.path[0], dx = p.x - pos.x, dz = p.z - pos.z, d = Math.hypot(dx, dz);
      if (d > 1e-4) {
        const to = Math.atan2(dx, dz), cur = this.root.rotation.y;
        this.root.rotation.y = cur + Math.atan2(Math.sin(to - cur), Math.cos(to - cur)) * Math.min(1, dt * 10);
      }
      if (d <= left) { pos.x = p.x; pos.z = p.z; left -= d; this.path.shift(); }
      else { pos.x += (dx / d) * left; pos.z += (dz / d) * left; left = 0; }
    }
    if (!this.path.length) { this.path = null; const done = this.arrive; this.arrive = null; done?.(); }
  }

  dispose() {
    this.root.traverse((o) => o.geometry?.dispose());
    this.mats.forEach((m) => m.dispose());
    this.badge.material.dispose();
    this.ring.material.dispose();
  }
}
