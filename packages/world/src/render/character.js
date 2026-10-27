// A character's mesh: one group per rig joint, each with its box (plus hair, eyes and shoes), posed from clip data.
import * as THREE from "three";
import { RIG } from "../anim/clips.js";
import { Kit } from "../catalog/kit.js";
import { primsToGroup } from "./meshes.js";

const UP = new Set(["spine", "head"]);

export function buildCharacter(id, look, palette, materials) {
  const pal = { ...palette, ...look };
  const root = new THREE.Group();
  root.name = `character:${id}`;
  root.userData.entity = id;
  const joints = {};
  for (const j of RIG.joints) {
    const g = new THREE.Group();
    g.name = j.name;
    g.rotation.order = "YXZ";
    g.position.set(...j.at);
    (j.parent ? joints[j.parent] : root).add(g);
    joints[j.name] = g;
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
    const mesh = primsToGroup(k.prims, pal, materials, { name: j.name });
    mesh.traverse((o) => { if (o.isMesh) o.userData.entity = id; });
    g.add(mesh);
  }
  return {
    root,
    joints,
    setPose(pose) {
      for (const j of RIG.joints) {
        const r = pose[j.name] ?? [0, 0, 0];
        joints[j.name].rotation.set(r[0], r[1], r[2]);
      }
    },
    setHips(y) { joints.hips.position.y = y; },
    dispose() { root.traverse((o) => o.geometry?.dispose()); },
  };
}
