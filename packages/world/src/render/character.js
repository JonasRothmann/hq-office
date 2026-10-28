// A character's mesh: a bone per rig joint and one skinned mesh per material, each joint's boxes (plus hair, eyes and
// shoes) built in the joint's own frame and bound to it alone, so a character is one draw call however many joints it
// has. Posed from clip data by turning the bones.
import * as THREE from "three";
import { RIG } from "../anim/clips.js";
import { Kit } from "../catalog/kit.js";
import { primsToGeometries } from "./meshes.js";

const UP = new Set(["spine", "head"]);
const IDENTITY = new THREE.Matrix4();

export function buildCharacter(id, look, palette, materials) {
  const pal = { ...palette, ...look };
  const root = new THREE.Group();
  root.name = `character:${id}`;
  root.userData.entity = id;
  const joints = {}, bones = [];
  const parts = new Map(); // "finish|pattern" → [[geometry, bone index], ...]
  for (const j of RIG.joints) {
    const b = new THREE.Bone();
    b.name = j.name;
    b.rotation.order = "YXZ";
    b.position.set(...j.at);
    (j.parent ? joints[j.parent] : root).add(b);
    joints[j.name] = b;
    const k = new Kit();
    const [w, len, d] = j.size;
    if (j.name === "hips") k.box("hips", [w, len, d], [0, -len / 2, 0], j.color);
    else if (UP.has(j.name)) k.box(j.name, [w, len, d], [0, 0, 0], j.color);
    else k.box(j.name, [w, len, d], [0, -len, 0], j.color);
    if (j.name === "head") {
      k.box("hair", [w + 0.02, 0.07, d + 0.02], [0, len - 0.04, -0.005], "hair");
      k.box("hair-back", [w + 0.02, 0.12, 0.05], [0, len - 0.15, -d / 2 - 0.014], "hair");
      for (const s of [-1, 1]) k.box("eye", [0.03, 0.035, 0.01], [s * 0.045, 0.1, d / 2 + 0.005], "#22201e");
    }
    if (j.name === "kneeL" || j.name === "kneeR") k.box("shoe", [w, 0.05, 0.16], [0, -len - 0.05, 0.025], "shoe");
    for (const [key, geo] of primsToGeometries(k.prims, pal)) {
      if (!parts.has(key)) parts.set(key, []);
      parts.get(key).push([geo, bones.length]);
    }
    bones.push(b);
  }
  // positions stay in their joint's frame: with identity bone inverses and bind matrix a vertex lands at
  // bone.matrixWorld × position, where the joint's own mesh used to put it
  const skeleton = new THREE.Skeleton(bones, bones.map(() => new THREE.Matrix4()));
  const meshes = [];
  for (const [key, list] of parts) {
    const [finish, pattern] = key.split("|");
    const mesh = new THREE.SkinnedMesh(skinned(list), materials.get(finish, pattern || null));
    mesh.bind(skeleton, IDENTITY);
    mesh.castShadow = finish !== "glass";
    mesh.receiveShadow = finish !== "glow";
    mesh.frustumCulled = false; // its bounds move with the pose
    mesh.userData.finish = finish;
    mesh.userData.entity = id;
    root.add(mesh);
    meshes.push(mesh);
  }
  return {
    root,
    joints,
    meshes,
    setPose(pose) {
      for (const j of RIG.joints) {
        const r = pose[j.name] ?? [0, 0, 0];
        joints[j.name].rotation.set(r[0], r[1], r[2]);
      }
    },
    setHips(y) { joints.hips.position.y = y; },
    /** Bounds for picking: a skinned mesh keeps the ones of the pose it first had. */
    refreshBounds() { for (const m of meshes) { m.boundingSphere = null; m.boundingBox = null; } },
    dispose() { for (const m of meshes) m.geometry.dispose(); skeleton.dispose(); },
  };
}

// One geometry from each joint's: the attributes end to end, and every vertex bound to its joint with weight 1.
function skinned(list) {
  const names = ["position", "normal", "color", "uv"];
  const out = new THREE.BufferGeometry();
  const count = list.reduce((s, [g]) => s + g.getAttribute("position").count, 0);
  for (const name of names) {
    const size = list[0][0].getAttribute(name).itemSize;
    const arr = new Float32Array(count * size);
    let at = 0;
    for (const [g] of list) { arr.set(g.getAttribute(name).array, at); at += g.getAttribute(name).array.length; }
    out.setAttribute(name, new THREE.BufferAttribute(arr, size));
  }
  const index = new Uint16Array(count * 4), weight = new Float32Array(count * 4);
  let v = 0;
  for (const [g, bone] of list) for (let i = 0; i < g.getAttribute("position").count; i++, v++) { index[v * 4] = bone; weight[v * 4] = 1; }
  out.setAttribute("skinIndex", new THREE.BufferAttribute(index, 4));
  out.setAttribute("skinWeight", new THREE.BufferAttribute(weight, 4));
  for (const [g] of list) g.dispose();
  return out;
}
