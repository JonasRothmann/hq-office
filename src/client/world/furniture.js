// The world's furnished rooms: a lane's office, the HQ suite and the break area, built by the Nordic studio's room
// builders (studio.js) and handed to world.js with the parts it drives at run time; and the courts between wings.
// Everything is in a room's own frame: back wall at z = 0, door side at z = d.
import { THREE } from "./kit.js";
import { DESK_H, SEAT_H } from "./props.js";
import { buildStudioOffice, buildStudioSuite, buildStudioBreak, SUITE } from "./studio.js";
import { screen as screenTexture } from "./textures.js";

export { DESK_H, SEAT_H };

// The parts of an office the world changes at run time, and the points people use.
//   desk      local centre of the desk           seat    where a seated worker's hips go, facing the desk (-z)
//   stand     where a waiting worker stands       hud     where the desk HUD hangs
export const OFFICE_SPOTS = {
  desk: new THREE.Vector3(2, 0, 0.5),
  seat: new THREE.Vector3(2, 0, 1.12),
  stand: new THREE.Vector3(3.35, 0, 1.25),
  hud: new THREE.Vector3(2, 3.2, 0.7),
  poster: new THREE.Vector3(3.5, 1.22, 0.08),
};

// HQ's desk in the suite faces the room, with its back to the windows (faceDesk 0: the worker looks toward +z).
export const SUITE_SPOTS = { ...SUITE.hq, hud: new THREE.Vector3(1.9, 3.0, 1.4) };

// A room's width along its back wall and its depth, in its own frame.
export function localSize(room) {
  return room.back === "w" || room.back === "e" ? { w: room.d, d: room.w } : { w: room.w, d: room.d };
}

// The status lamp on a lane's desk: a black arm, and a shade the world tints (red while the lane needs the owner).
function deskLamp(kit, L, x, z) {
  kit.cyl(0.06, 0.02, L.steel, x, DESK_H, z, { seg: 10 });
  kit.box(0.018, 0.3, 0.018, L.steel, x, DESK_H + 0.02, z, { rz: 0.25 });
  kit.box(0.018, 0.2, 0.018, L.steel, x - 0.07, DESK_H + 0.29, z, { rz: -1.0 });
}

function lampShadeMesh(x, z) {
  const geo = new THREE.CylinderGeometry(0.035, 0.08, 0.09, 10, 1, false);
  geo.rotateZ(-0.5);
  geo.translate(x + 0.11, DESK_H + 0.35, z);
  return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: "#fff2d8" }));
}

// One office. Returns its group (placed in the world) and the parts the world drives.
export function buildOffice(room, L, light) {
  const lx = 2.72, lz = 0.25;
  const o = buildStudioOffice(room, L, light, { extra: (kit) => deskLamp(kit, L, lx, lz) });
  const shade = lampShadeMesh(lx, lz);
  o.group.add(shade);
  return { group: o.group, stat: o.stat, screen: o.screens[0], shade, lantern: o.glow, pool: o.pools, decor: o.decor, wallPoster: null, leanPoster: null, seed: o.seed };
}

// The HQ suite: HQ's desk and the owner's, a reading corner, a round table, a whiteboard.
export function buildSuite(room, L, light) {
  const s = buildStudioSuite(room, L, light);
  s.screens[1].material.map = screenTexture("owner", "#8e9bb0");
  return { group: s.group, screen: s.screens[0], shade: null, lantern: s.glow, pool: s.pools, decor: s.decor, wallPoster: null, leanPoster: null };
}

// The break area: kitchen, long table, sofa corner; `spots` are where done workers stand with a mug.
export function buildBreak(room, L, light) {
  const b = buildStudioBreak(room, L, light);
  return { group: b.group, lantern: b.glow, pool: b.pools, decor: b.decor, wallPoster: null, leanPoster: null, spots: b.spots };
}

// A court: raked gravel with a maple, a few stones, stepping stones and a bench.
export function scatterCourt(kit, c, L, i) {
  const y = -0.12;
  const tx = c.x + c.w * (0.3 + ((i * 37) % 40) / 100), tz = c.z + c.d / 2;
  kit.cyl(0.09, 1.1, L.tree.trunk, tx, y, tz, { top: 0.06, seg: 6 });
  kit.box(0.05, 0.5, 0.05, L.tree.trunk, tx + 0.15, y + 0.9, tz, { rz: -0.7 });
  const blobs = [[0, 1.55, 0, 0.62], [0.45, 1.4, 0.2, 0.45], [-0.4, 1.45, -0.15, 0.48], [0.1, 1.95, -0.1, 0.42], [-0.2, 1.3, 0.35, 0.4]];
  blobs.forEach(([dx, dy, dz, r], k) => kit.sphere(r, k % 2 ? L.tree.leaf : L.tree.leaf2, tx + dx, y + dy, tz + dz, { sy: 0.75, ry: k }));
  for (let k = 0; k < 3; k++) kit.sphere(0.18 + k * 0.06, "#8f8a80", tx + 1.4 + k * 0.5, y + 0.02, tz + 0.6 - k * 0.4, { sy: 0.5, ry: k });
  for (let k = 0; k < 5; k++) kit.cyl(0.22, 0.03, "#b8b2a6", c.x + 1 + k * 0.9, y, c.z + c.d - 0.9 + Math.sin(k) * 0.2, { seg: 7 });
  // a bench
  kit.rbox(1.2, 0.06, 0.36, L.wood, tx + 3.2, y + 0.38, tz + 0.2, 0.015);
  for (const t of [-1, 1]) kit.box(0.06, 0.38, 0.3, L.steel, tx + 3.2 + t * 0.5, y, tz + 0.2);
}
