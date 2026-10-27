// The rig and its clips as data: joints with parents and rest offsets, keyframes of joint angles, sampling and
// blending. Pure. render builds a jointed mesh from RIG and applies poses from samplePose / blendPose.
//
// A person is 1.35 m standing (0.45 of a wall), the proportion that makes a Sims-like room read.

/** @typedef {{ name: string, parent: string|null, at: [number, number, number], size: [number, number, number], color: string }} Joint */
/** @typedef {Record<string, [number, number, number]>} Pose  joint → [rx, ry, rz] */
/** @typedef {{ name: string, loop: boolean, dur: number, seated?: boolean, keys: Record<string, [number, number, number, number][]> }} Clip */

export const HIP_H = 0.62;

// Each joint's box hangs from the joint (size: w, length, d; y down from the joint unless noted).
/** @type {{ joints: Joint[], hip: number }} */
export const RIG = {
  hip: HIP_H,
  joints: [
    { name: "hips", parent: null, at: [0, HIP_H, 0], size: [0.3, 0.12, 0.17], color: "pants" },
    { name: "spine", parent: "hips", at: [0, 0.06, 0], size: [0.32, 0.4, 0.18], color: "shirt" },
    { name: "head", parent: "spine", at: [0, 0.43, 0], size: [0.2, 0.22, 0.2], color: "skin" },
    { name: "armL", parent: "spine", at: [0.2, 0.37, 0], size: [0.08, 0.25, 0.08], color: "shirt" },
    { name: "elbowL", parent: "armL", at: [0, -0.25, 0], size: [0.07, 0.22, 0.07], color: "skin" },
    { name: "armR", parent: "spine", at: [-0.2, 0.37, 0], size: [0.08, 0.25, 0.08], color: "shirt" },
    { name: "elbowR", parent: "armR", at: [0, -0.25, 0], size: [0.07, 0.22, 0.07], color: "skin" },
    { name: "legL", parent: "hips", at: [0.08, 0, 0], size: [0.11, 0.3, 0.12], color: "pants" },
    { name: "kneeL", parent: "legL", at: [0, -0.3, 0], size: [0.1, 0.27, 0.11], color: "pants" },
    { name: "legR", parent: "hips", at: [-0.08, 0, 0], size: [0.11, 0.3, 0.12], color: "pants" },
    { name: "kneeR", parent: "legR", at: [0, -0.3, 0], size: [0.1, 0.27, 0.11], color: "pants" },
  ],
};

const SEATED = { legL: [[0, -1.5, 0, 0.05]], legR: [[0, -1.5, 0, -0.05]], kneeL: [[0, 1.45, 0, 0]], kneeR: [[0, 1.45, 0, 0]] };

/** @type {Record<string, Clip>} */
export const CLIPS = {
  idle: { name: "idle", loop: true, dur: 3.2, keys: {
    spine: [[0, 0, 0, 0], [1.6, 0.025, 0, 0], [3.2, 0, 0, 0]],
    head: [[0, 0, 0, 0], [1.2, 0, 0.12, 0], [2.4, 0, -0.08, 0], [3.2, 0, 0, 0]],
    armL: [[0, 0, 0, 0.08]], armR: [[0, 0, 0, -0.08]], elbowL: [[0, -0.15, 0, 0]], elbowR: [[0, -0.15, 0, 0]],
  } },
  walk: { name: "walk", loop: true, dur: 0.84, keys: {
    legL: [[0, 0.45, 0, 0.03], [0.42, -0.45, 0, 0.03], [0.84, 0.45, 0, 0.03]],
    legR: [[0, -0.45, 0, -0.03], [0.42, 0.45, 0, -0.03], [0.84, -0.45, 0, -0.03]],
    kneeL: [[0, 0, 0, 0], [0.21, 0, 0, 0], [0.42, 0.6, 0, 0], [0.63, 0.1, 0, 0], [0.84, 0, 0, 0]],
    kneeR: [[0, 0.6, 0, 0], [0.21, 0.1, 0, 0], [0.42, 0, 0, 0], [0.63, 0, 0, 0], [0.84, 0.6, 0, 0]],
    armL: [[0, -0.4, 0, 0.08], [0.42, 0.4, 0, 0.08], [0.84, -0.4, 0, 0.08]],
    armR: [[0, 0.4, 0, -0.08], [0.42, -0.4, 0, -0.08], [0.84, 0.4, 0, -0.08]],
    elbowL: [[0, -0.3, 0, 0]], elbowR: [[0, -0.3, 0, 0]], spine: [[0, 0.05, 0, 0]],
  } },
  "sit-down": { name: "sit-down", loop: false, dur: 0.6, seated: true, keys: {
    legL: [[0, 0, 0, 0.03], [0.6, -1.5, 0, 0.05]], legR: [[0, 0, 0, -0.03], [0.6, -1.5, 0, -0.05]],
    kneeL: [[0, 0, 0, 0], [0.6, 1.45, 0, 0]], kneeR: [[0, 0, 0, 0], [0.6, 1.45, 0, 0]],
    spine: [[0, 0, 0, 0], [0.3, 0.2, 0, 0], [0.6, 0, 0, 0]],
  } },
  sit: { name: "sit", loop: true, dur: 4, seated: true, keys: {
    ...SEATED, spine: [[0, 0, 0, 0], [2, 0.03, 0, 0], [4, 0, 0, 0]], head: [[0, 0, 0, 0], [2, 0, 0.15, 0], [4, 0, 0, 0]],
    armL: [[0, -0.3, 0, 0.1]], armR: [[0, -0.3, 0, -0.1]], elbowL: [[0, -0.6, 0, 0]], elbowR: [[0, -0.6, 0, 0]],
  } },
  type: { name: "type", loop: true, dur: 0.5, seated: true, keys: {
    ...SEATED, spine: [[0, 0.14, 0, 0]], head: [[0, 0.12, 0, 0]],
    armL: [[0, -0.85, 0, 0.12]], armR: [[0, -0.85, 0, -0.12]],
    elbowL: [[0, -0.7, 0.35, 0], [0.25, -0.62, 0.35, 0], [0.5, -0.7, 0.35, 0]],
    elbowR: [[0, -0.62, -0.35, 0], [0.25, -0.7, -0.35, 0], [0.5, -0.62, -0.35, 0]],
  } },
  "lean-back": { name: "lean-back", loop: true, dur: 6, seated: true, keys: {
    ...SEATED, spine: [[0, -0.32, 0, 0]], head: [[0, -0.2, 0, 0], [3, -0.2, 0.2, 0], [6, -0.2, 0, 0]],
    armL: [[0, -0.45, 0, 2.35]], armR: [[0, -0.45, 0, -2.35]], elbowL: [[0, 0, 0, 2.05]], elbowR: [[0, 0, 0, -2.05]],
  } },
  wave: { name: "wave", loop: true, dur: 1.1, keys: {
    armR: [[0, -3.0, 0, -0.35], [0.55, -3.0, 0, 0.05], [1.1, -3.0, 0, -0.35]], elbowR: [[0, -0.35, 0, 0]],
    armL: [[0, 0.02, 0, 0.1]], spine: [[0, -0.04, 0, 0.03]],
  } },
  drink: { name: "drink", loop: true, dur: 3.5, keys: {
    armR: [[0, -0.35, 0, -0.12], [1.5, -0.35, 0, -0.12], [2, -0.9, 0, -0.12], [2.6, -0.9, 0, -0.12], [3.5, -0.35, 0, -0.12]],
    elbowR: [[0, -2.0, 0.25, 0]], head: [[0, 0, 0, 0], [2, -0.25, 0, 0], [2.6, -0.25, 0, 0], [3.5, 0, 0, 0]],
  } },
};

/** @stability experimental  @returns {Pose} */
export function samplePose(clip, t) {
  const time = clip.loop ? ((t % clip.dur) + clip.dur) % clip.dur : Math.min(Math.max(t, 0), clip.dur);
  const pose = {};
  for (const [joint, keys] of Object.entries(clip.keys)) {
    if (keys.length === 1 || time <= keys[0][0]) { pose[joint] = keys[0].slice(1); continue; }
    let i = 1;
    while (i < keys.length - 1 && keys[i][0] < time) i++;
    const a = keys[i - 1], b = keys[i];
    const k = b[0] > a[0] ? Math.min(1, Math.max(0, (time - a[0]) / (b[0] - a[0]))) : 1;
    const s = k * k * (3 - 2 * k); // smoothstep between keys
    pose[joint] = [a[1] + (b[1] - a[1]) * s, a[2] + (b[2] - a[2]) * s, a[3] + (b[3] - a[3]) * s];
  }
  return pose;
}

// a × (1 − w) + b × w, joint by joint; a joint missing from one pose counts as its rest (0, 0, 0).
/** @stability experimental  @returns {Pose} */
export function blendPose(a, b, w) {
  const out = {};
  for (const j of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const p = a[j] ?? [0, 0, 0], q = b[j] ?? [0, 0, 0];
    out[j] = [p[0] + (q[0] - p[0]) * w, p[1] + (q[1] - p[1]) * w, p[2] + (q[2] - p[2]) * w];
  }
  return out;
}
