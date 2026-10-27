// A low-poly worker (1.35 m standing) with poses per status, a painted face, a blob shadow and the badge over the head.
// One skinned mesh per worker (a rigid skin: each part follows one bone), so a person is one draw call. Hair, clothes
// and face are picked from the lane's name: the same lane always looks the same.
import { THREE, Kit, roomMaterial } from "./kit.js";
import { hash, poseOf, markerOf, appearance } from "./look.js";
import { badge as badgeTexture, glow, bodySkin, SKIN } from "./textures.js";
import { SEAT_H } from "./furniture.js";

const HIP = 0.62, THIGH = 0.3, SHIN = 0.27, UPPER = 0.25, FORE = 0.22;
const SEATED_HIP = SEAT_H + 0.02;

// The bones, in skin order, with their parent and their rest offset from it.
const BONES = [
  ["hips", null, [0, HIP, 0]],
  ["legL", "hips", [0.075, -0.02, 0]], ["kneeL", "legL", [0, -THIGH, 0]],
  ["legR", "hips", [-0.075, -0.02, 0]], ["kneeR", "legR", [0, -THIGH, 0]],
  ["spine", "hips", [0, 0, 0]], ["head", "spine", [0, 0.42, 0]],
  ["armL", "spine", [0.19, 0.36, 0]], ["elbowL", "armL", [0, -UPPER, 0]],
  ["armR", "spine", [-0.19, 0.36, 0]], ["elbowR", "armR", [0, -UPPER, 0]],
  ["mug", "elbowR", [0, -FORE - 0.11, 0.04]],
];
const B = Object.fromEntries(BONES.map(([n], i) => [n, i]));
const REST = (() => {
  const at = {};
  for (const [n, parent, [x, y, z]] of BONES) { const p = parent ? at[parent] : [0, 0, 0]; at[n] = [p[0] + x, p[1] + y, p[2] + z]; }
  return at;
})();

const darker = (hex, f = -0.1) => `#${new THREE.Color(hex).offsetHSL(0, 0, f).getHexString()}`;

export { appearance };

// Build the body into a kit, part by part, each bound to its bone, in the rest pose (standing, arms down).
function buildBody(k, a) {
  const at = (bone, fn) => { const p = REST[bone]; k.at(p[0], p[1], p[2], 0, () => k.withBone(B[bone], fn)); };
  const { skin, hair, pants, shoes, topColor: top, inner } = a;
  const sole = shoes === "#f2f0ea" ? "#d9d6cf" : darker(shoes, -0.12);
  // hips and legs
  at("hips", () => { k.rbox(0.28, 0.15, 0.18, pants, 0, -0.08, 0, 0.03); if (a.top !== "tee" && a.top !== "stripes") k.box(0.285, 0.03, 0.185, darker(pants, -0.08), 0, -0.01, 0); });
  for (const s of ["L", "R"]) {
    at(`leg${s}`, () => k.rbox(0.125, THIGH + 0.02, 0.135, pants, 0, -THIGH, 0, 0.03));
    at(`knee${s}`, () => {
      k.rbox(0.105, SHIN, 0.115, pants, 0, -SHIN, 0, 0.025);
      k.rbox(0.11, 0.055, 0.2, shoes, 0, -SHIN - 0.045, 0.035, 0.02);
      k.box(0.112, 0.018, 0.205, sole, 0, -SHIN - 0.05, 0.035);
    });
  }
  // the torso and what it wears
  at("spine", () => {
    const tex = a.top === "stripes" ? { r: SKIN.stripes, face: "all" } : undefined;
    k.rbox(0.31, 0.4, 0.185, a.top === "stripes" ? "#ffffff" : top, 0, 0.0, 0, 0.05, { tex });
    k.rbox(0.2, 0.05, 0.15, a.top === "stripes" ? "#f2efe6" : top, 0, 0.385, 0, 0.02);
    k.cyl(0.045, 0.06, skin, 0, 0.4, 0, { seg: 6 });
    switch (a.top) {
      case "sweater":
        k.box(0.32, 0.045, 0.19, darker(top), 0, 0.0, 0);
        k.cyl(0.058, 0.025, darker(top), 0, 0.41, 0, { seg: 8 });
        break;
      case "shirt":
        k.box(0.016, 0.34, 0.01, darker(top, -0.06), 0, 0.03, 0.094);
        for (const s of [-1, 1]) k.box(0.07, 0.04, 0.02, darker(top, 0.04), s * 0.035, 0.39, 0.075, { rz: s * 0.5 });
        break;
      case "hoodie":
        k.rbox(0.24, 0.13, 0.08, darker(top, -0.05), 0, 0.3, -0.11, 0.03);
        k.box(0.2, 0.08, 0.02, darker(top, -0.05), 0, 0.06, 0.09);
        for (const s of [-1, 1]) k.box(0.01, 0.08, 0.01, "#f2efe6", s * 0.03, 0.29, 0.098);
        break;
      case "cardigan":
        k.box(0.09, 0.36, 0.01, inner, 0, 0.03, 0.094);
        for (let i = 0; i < 3; i++) k.box(0.012, 0.012, 0.008, darker(top, -0.15), 0.05, 0.1 + i * 0.09, 0.096);
        break;
      case "blazer":
        k.box(0.1, 0.3, 0.01, inner, 0, 0.1, 0.094);
        for (const s of [-1, 1]) k.box(0.04, 0.2, 0.012, darker(top, -0.06), s * 0.055, 0.18, 0.096, { rz: s * 0.25 });
        break;
      case "tee": case "stripes":
        break;
    }
    if (a.headphones) {
      k.add(new THREE.TorusGeometry(0.085, 0.014, 4, 12, Math.PI), "#26292e", 0, 0.39, 0.0, { rx: -Math.PI / 2 + 0.2 });
      for (const s of [-1, 1]) k.cyl(0.035, 0.03, "#26292e", s * 0.085, 0.36, 0.02, { seg: 8, rz: Math.PI / 2 });
    }
  });
  // arms: sleeves in the top's colour (short for a tee), hands in skin
  const sleeve = a.top === "stripes" ? "#ffffff" : top;
  const stex = a.top === "stripes" ? { r: SKIN.stripes, face: "all" } : undefined;
  for (const s of ["L", "R"]) {
    at(`arm${s}`, () => {
      if (a.top === "tee") { k.rbox(0.1, UPPER * 0.5, 0.105, top, 0, -UPPER * 0.5, 0, 0.025); k.rbox(0.085, UPPER * 0.55, 0.09, skin, 0, -UPPER, 0, 0.025); }
      else k.rbox(0.095, UPPER + 0.01, 0.105, sleeve, 0, -UPPER, 0, 0.025, { tex: stex });
    });
    at(`elbow${s}`, () => {
      if (a.top === "tee") k.rbox(0.08, FORE, 0.085, skin, 0, -FORE, 0, 0.02);
      else if (a.top === "shirt") { k.rbox(0.085, FORE * 0.45, 0.09, top, 0, -FORE * 0.45, 0, 0.02); k.rbox(0.075, FORE * 0.6, 0.08, skin, 0, -FORE, 0, 0.02); }
      else {
        k.rbox(0.085, FORE, 0.09, sleeve, 0, -FORE, 0, 0.02, { tex: stex });
        if (a.top === "sweater" || a.top === "hoodie") k.box(0.088, 0.03, 0.092, darker(top), 0, -FORE, 0);
      }
      k.rbox(0.075, 0.085, 0.08, skin, 0, -FORE - 0.075, 0, 0.025);
    });
  }
  // the head: a box with the painted face on its front, ears, and the hair
  at("head", () => {
    k.box(0.2, 0.23, 0.2, skin, 0, 0.04, 0);
    // the face: a thin plate on the front, painted (its colour is all in the texture)
    k.box(0.2, 0.23, 0.003, "#ffffff", 0, 0.04, 0.1, { tex: { r: SKIN.face, face: "+z" } });
    for (const s of [-1, 1]) k.rbox(0.03, 0.06, 0.045, skin, s * 0.105, 0.12, 0.0, 0.012);
    hairOf(k, a);
  });
  // a mug, shown only while the worker holds one (its bone is scaled to nothing otherwise)
  at("mug", () => {
    k.cyl(0.04, 0.09, "#f4f1ea", 0, -0.045, 0, { seg: 8, rx: 0 });
    k.box(0.02, 0.05, 0.02, "#f4f1ea", 0.045, -0.025, 0);
  });
}

function hairOf(k, a) {
  const c = a.hair, top = 0.27;
  const cap = (h = 0.075, w = 0.215) => k.rbox(w, h, w, c, 0, top - h + 0.035, -0.003, 0.035);
  const back = (y0 = 0.1, d = 0.05) => k.rbox(0.214, top + 0.02 - y0, d, c, 0, y0, -0.083, 0.02);
  const sides = (y0) => { for (const s of [-1, 1]) k.rbox(0.03, top - y0, 0.17, c, s * 0.1, y0, -0.015, 0.012); };
  if (a.beanie) {
    k.rbox(0.225, 0.1, 0.225, a.beanie, 0, top - 0.04, -0.003, 0.05);
    k.rbox(0.23, 0.045, 0.23, darker(a.beanie, -0.08), 0, top - 0.06, -0.003, 0.02);
    back(0.12);
    return;
  }
  switch (a.hairStyle) {
    case 0: cap(); back(0.12); sides(0.17); break;                                                     // crop
    case 1: cap(); k.rbox(0.23, 0.36, 0.06, c, 0, -0.06, -0.085, 0.025); for (const s of [-1, 1]) k.rbox(0.035, 0.26, 0.18, c, s * 0.105, 0.02, -0.01, 0.015); break; // long
    case 2: cap(); back(0.1); sides(0.15); k.sphere(0.07, c, 0, 0.33, -0.07, { detail: 1 }); break;   // bun
    case 3: cap(); back(0.04); for (const s of [-1, 1]) k.rbox(0.035, 0.2, 0.18, c, s * 0.105, 0.06, -0.01, 0.015); k.rbox(0.2, 0.06, 0.03, c, 0, 0.21, 0.095, 0.012); break; // bob, fringe
    case 4: k.rbox(0.27, 0.16, 0.26, c, 0, 0.17, -0.02, 0.07); for (let i = 0; i < 6; i++) { const t = i * 1.05; k.sphere(0.06, c, Math.cos(t) * 0.12, 0.25 + (i % 2) * 0.04, -0.03 + Math.sin(t) * 0.1, { detail: 0 }); } break; // curls
    case 5: cap(); back(0.1); sides(0.16); k.rbox(0.07, 0.24, 0.06, c, 0, 0.0, -0.13, 0.025, { rx: 0.25 }); break; // ponytail
    case 6: cap(0.045, 0.207); back(0.14, 0.025); break;                                               // buzz
    case 7: cap(); back(0.12); sides(0.18); k.rbox(0.16, 0.06, 0.1, c, 0.02, 0.27, 0.05, 0.025, { rz: -0.15 }); break; // quiff
    default: back(0.1, 0.03); sides(0.12); break;                                                       // bald on top
  }
}

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
    const a = appearance(name, L);
    this.look = a;
    const map = bodySkin({ skin: a.skin, hair: a.hair, brows: darker(a.hair, -0.05), beard: a.beard, glasses: a.glasses, freckles: a.freckles, lashes: a.lashes, stripe: a.stripe, bald: a.hairStyle === 8 && !a.beanie });
    const mat = roomMaterial({ map, room: light });
    this.mats = [mat];

    const root = new THREE.Group();
    root.name = `worker:${name}`;
    const kit = new Kit();
    buildBody(kit, a);
    const body = new THREE.SkinnedMesh(kit.geometry({ atlas: SKIN.size, white: SKIN.white, skin: true }), mat);
    body.name = `body:${name}`;
    body.castShadow = false;
    body.receiveShadow = false;
    body.frustumCulled = false;
    const bones = BONES.map(([n]) => { const b = new THREE.Bone(); b.name = n; b.rotation.order = "YXZ"; return b; });
    BONES.forEach(([, parent, [x, y, z]], i) => { bones[i].position.set(x, y, z); (parent ? bones[B[parent]] : body).add(bones[i]); });
    root.add(body);
    root.updateMatrixWorld(true);
    body.bind(new THREE.Skeleton(bones));
    this.body = body;
    const J = {};
    for (const n of JOINTS) J[n] = bones[B[n]];
    const hips = bones[B.hips];
    this.mug = bones[B.mug];
    this.mug.rotation.x = Math.PI / 2; // upright in a hand raised toward the mouth

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
    this.mug.scale.setScalar(this.pose === "mug" || this.pose === "sip" ? 1 : 0.001);
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
