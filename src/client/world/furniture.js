// Furniture from primitives: a team room's desks (desk, chair, monitor, lamp) and its own things (lantern, shoji, rug,
// plants, shelves, poster), the HQ suite, the break area and the courts. Everything is in a room's own frame: back wall at z = 0, door side at z = d.
import { THREE, Kit, roomMaterial } from "./kit.js";
import { toWorld } from "./plan.js";
import { rug as rugTexture, poster as posterTexture, screen as screenTexture, glow } from "./textures.js";
import { hash, pick } from "./look.js";

export const DESK_H = 0.57;
export const SEAT_H = 0.35;

// The points of a desk in its own frame (the desk's centre on the floor at the origin, its worker on the +z side
// facing -z):   seat: a seated worker's hips   hud: the desk HUD's anchor. A waiting worker stands beside the desk on
// the island's outer side (deskStand).
export const DESK_SPOTS = {
  seat: new THREE.Vector3(0, 0, 0.62),
  hud: new THREE.Vector3(0, 2.45, 0.55),
};
export const deskStand = (out) => new THREE.Vector3(out * 1.0, 0, 0.42);
const DESK_W = 1.4, DESK_D = 0.72;

function frameOf(room) {
  const w = toWorld(room, 0, 0);
  const g = new THREE.Group();
  g.position.set(w.x, 0, w.z);
  g.rotation.y = w.ry;
  return g;
}

// A room's width along its back wall and its depth, in its own frame.
export function localSize(room) {
  return room.back === "w" || room.back === "e" ? { w: room.d, d: room.w } : { w: room.w, d: room.d };
}

// A thin oak top on black steel sled legs.
function desk(kit, L, x, z, w = 1.7, d = 0.72) {
  kit.rbox(w, 0.04, d, L.wood, x, DESK_H - 0.04, z, 0.012);
  for (const sx of [-1, 1]) {
    const lx = x + sx * (w / 2 - 0.1);
    for (const sz of [-1, 1]) kit.box(0.03, DESK_H - 0.04, 0.03, L.steel, lx, 0, z + sz * (d / 2 - 0.06));
    kit.box(0.03, 0.03, d - 0.1, L.steel, lx, DESK_H - 0.07, z);
    kit.box(0.03, 0.02, d - 0.1, L.steel, lx, 0, z);
  }
  kit.box(w - 0.2, 0.03, 0.03, L.steel, x, DESK_H - 0.07, z - d / 2 + 0.06);
}

// An oak shell on thin black legs.
function chair(kit, L, x, z, ry = 0) {
  kit.at(x, 0, z, ry, () => {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) kit.box(0.025, SEAT_H - 0.03, 0.025, L.steel, sx * 0.17, 0, sz * 0.16, { rz: sx * 0.06, rx: -sz * 0.06 });
    kit.rbox(0.42, 0.04, 0.4, L.wood, 0, SEAT_H - 0.04, 0, 0.015);
    kit.rbox(0.4, 0.06, 0.36, L.chair.seat, 0, SEAT_H, 0.01, 0.025);
    kit.rbox(0.42, 0.3, 0.035, L.wood, 0, SEAT_H + 0.12, 0.2, 0.012, { rx: -0.14 });
  });
}

function monitor(kit, L, x, z) {
  kit.box(0.2, 0.012, 0.14, L.steel, x, DESK_H, z);
  kit.box(0.035, 0.16, 0.03, L.steel, x, DESK_H, z - 0.02);
  kit.rbox(0.64, 0.4, 0.035, L.screenFrame, x, DESK_H + 0.12, z, 0.01);
  kit.box(0.42, 0.012, 0.14, "#e6e3dc", x, DESK_H, z + 0.3); // keyboard
  kit.box(0.06, 0.012, 0.09, "#e6e3dc", x + 0.32, DESK_H, z + 0.3); // mouse
}

function plant(kit, L, x, z, tall = true, salt = 0) {
  if (tall) {
    kit.cyl(0.16, 0.32, L.plant.pot, x, 0, z, { top: 0.19, seg: 10 });
    kit.cyl(0.015, 0.55, "#5a4630", x, 0.3, z);
    const leaves = 7;
    for (let i = 0; i < leaves; i++) {
      const a = i * 2.4 + salt, h = 0.55 + (i / leaves) * 0.55;
      kit.sphere(0.13 + (i % 3) * 0.02, i % 2 ? L.plant.leaf : L.plant.leaf2, x + Math.cos(a) * 0.14, h, z + Math.sin(a) * 0.14, { sy: 0.55, ry: a });
    }
    kit.sphere(0.15, L.plant.leaf2, x, 1.12, z, { sy: 0.7 });
  } else {
    kit.cyl(0.13, 0.16, L.plant.pot, x, 0, z, { top: 0.15, seg: 10 });
    for (let i = 0; i < 5; i++) {
      const a = i * 1.3 + salt;
      kit.sphere(0.1, i % 2 ? L.plant.leaf : L.plant.leaf2, x + Math.cos(a) * 0.07, 0.2 + (i % 2) * 0.05, z + Math.sin(a) * 0.07, { sy: 0.7 });
    }
  }
}

function shelf(kit, L, x, z, len = 1.3, ry = 0, books = true) {
  kit.at(x, 0, z, ry, () => {
    kit.rbox(len, 0.62, 0.38, L.shelf, 0, 0, 0, 0.015);
    kit.box(len - 0.06, 0.02, 0.34, L.woodEdge, 0, 0.3, 0.02);
    if (!books) return;
    let bx = -len / 2 + 0.08;
    let i = 0;
    while (bx < len / 2 - 0.12) {
      const bw = 0.04 + ((i * 7) % 4) * 0.012, bh = 0.18 + ((i * 5) % 3) * 0.03;
      kit.box(bw, bh, 0.22, L.books[i % L.books.length], bx + bw / 2, 0.32, 0.02);
      bx += bw + 0.008; i++;
      if (i === 9) bx += 0.22;
    }
    kit.box(0.3, 0.05, 0.22, L.books[1], len / 2 - 0.3, 0.62, 0);
    kit.cyl(0.05, 0.12, L.plant.pot, -len / 2 + 0.2, 0.62, 0);
    kit.sphere(0.07, L.plant.leaf, -len / 2 + 0.2, 0.78, 0, { sy: 0.8 });
  });
}

// A floor lantern: a paper box in a thin wooden frame.
function lantern(kit, L, x, z) {
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) kit.box(0.025, 0.95, 0.025, L.lantern.frame, x + sx * 0.13, 0, z + sz * 0.13);
  kit.box(0.28, 0.02, 0.28, L.lantern.frame, x, 0.93, z);
  kit.box(0.28, 0.02, 0.28, L.lantern.frame, x, 0.3, z);
}

// The paper that glows: separate so the world can light it at night.
function lanternGlowMesh(L, x, z) {
  const geo = new THREE.BoxGeometry(0.25, 0.6, 0.25);
  geo.translate(x, 0.32 + 0.3, z);
  return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: L.lantern.paper }));
}

function shoji(kit, L, x, z, ry) {
  // a three-leaf folding screen: wooden frames over paper, with a grid of thin bars
  kit.at(x, 0, z, ry, () => {
    [-0.36, 0, 0.36].forEach((px, i) => {
      kit.at(px, 0, 0, i === 1 ? 0 : (i === 0 ? 0.35 : -0.35), () => {
        kit.box(0.34, 1.2, 0.02, L.shoji.paper, 0, 0.06, 0);
        for (const sx of [-0.16, 0.16]) kit.box(0.025, 1.26, 0.035, L.shoji.frame, sx, 0, 0);
        for (const y of [0.06, 1.24]) kit.box(0.34, 0.025, 0.035, L.shoji.frame, 0, y, 0);
        for (const y of [0.36, 0.66, 0.96]) kit.box(0.32, 0.012, 0.03, L.shoji.frame, 0, y, 0);
        kit.box(0.012, 1.18, 0.03, L.shoji.frame, 0, 0.06, 0);
      });
    });
  });
}

function deskLamp(kit, L, x, z) {
  kit.cyl(0.07, 0.02, L.steel, x, DESK_H, z, { seg: 10 });
  kit.box(0.02, 0.32, 0.02, L.steel, x, DESK_H + 0.02, z, { rz: 0.25 });
  kit.box(0.02, 0.22, 0.02, L.steel, x - 0.08, DESK_H + 0.31, z, { rz: -1.0 });
}

function lampShadeMesh(x, z) {
  const geo = new THREE.CylinderGeometry(0.04, 0.09, 0.1, 10, 1, false);
  geo.rotateZ(-0.5);
  geo.translate(x + 0.12, DESK_H + 0.38, z);
  return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: "#fff2d8" }));
}

function posterMesh(seed, w = 0.6, h = 0.82) {
  const mat = new THREE.MeshLambertMaterial({ map: posterTexture(seed) });
  const g = new THREE.Group();
  const frame = new THREE.Mesh(new THREE.BoxGeometry(w + 0.05, h + 0.05, 0.025), new THREE.MeshLambertMaterial({ color: "#2b2b2e" }));
  frame.position.set(0, h / 2, 0.01);
  const print = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  print.position.set(0, h / 2, 0.025);
  g.add(frame, print);
  return g;
}

function rugMesh(L, w, d, room) {
  const geo = new THREE.PlaneGeometry(w, d);
  geo.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(geo, roomMaterial({ map: rugTexture(L.rug, w, d), room, vertexColors: false }));
  m.receiveShadow = true;
  return m;
}

function pool(L) {
  const geo = new THREE.PlaneGeometry(3.6, 3.0);
  geo.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: glow("rgba(255,214,150,0.55)"), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  m.position.y = 0.012;
  m.visible = L.night;
  m.renderOrder = 1;
  return m;
}

// One desk of a team room, in its own frame: desk, chair, monitor, lamp and a few things of its lane's own. out: the
// side of the island that faces the room's wall (+1 or -1 in the desk's x), where the lamp stands. Returns the group
// (the world places it) and the parts the world drives.
export function buildDesk(lane, out, L, light) {
  const group = new THREE.Group();
  group.name = `desk:${lane}`;
  const kit = new Kit();
  const seed = hash(lane);
  desk(kit, L, 0, 0, DESK_W, DESK_D);
  // a low oak screen along the shared edge, between the facing pair
  kit.box(DESK_W - 0.08, 0.2, 0.025, L.woodEdge, 0, DESK_H, -DESK_D / 2 + 0.015);
  monitor(kit, L, 0, -0.17);
  const lampX = out * 0.52;
  deskLamp(kit, L, lampX, -0.2);
  chair(kit, L, 0, 0.77, 0);
  const mug = pick(["#f4f1ea", "#c8553d", "#2f3a33", "#e2b867"], seed, 3);
  const extra = seed % 3;
  if (extra === 0) {
    kit.box(0.22, 0.03, 0.3, "#f4f1ea", -lampX * 0.95, DESK_H, 0.1, { ry: 0.2 }); // a notebook
  } else if (extra === 1) {
    // a laptop beside the screen, open toward the chair
    kit.box(0.3, 0.015, 0.2, "#b9bcc2", -lampX, DESK_H, 0.06);
    kit.box(0.3, 0.19, 0.012, "#b9bcc2", -lampX, DESK_H + 0.01, -0.04, { rx: -0.25 });
  } else {
    // headphones and a small plant
    kit.box(0.16, 0.05, 0.05, L.steel, -lampX * 0.9, DESK_H, 0.16, { ry: 0.3 });
    kit.cyl(0.05, 0.07, L.plant.pot, -lampX * 1.05, DESK_H, -0.2, { seg: 8 });
    kit.sphere(0.07, L.plant.leaf, -lampX * 1.05, DESK_H + 0.12, -0.2, { sy: 0.8 });
  }
  kit.cyl(0.04, 0.09, mug, lampX * 0.75, DESK_H, 0.18, { seg: 8 });
  group.add(kit.mesh(roomMaterial({ room: light })));

  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.58, 0.34), new THREE.MeshBasicMaterial({ map: screenTexture("off", null) }));
  screen.position.set(0, DESK_H + 0.12 + 0.2, -0.17 + 0.0185);
  group.add(screen);
  const shade = lampShadeMesh(lampX, -0.2);
  group.add(shade);
  const lightPool = pool(L);
  lightPool.scale.set(0.5, 1, 0.55);
  lightPool.position.set(0, 0.012, 0.35);
  group.add(lightPool);
  return { group, screen, shade, pool: lightPool, seed, stand: deskStand(out) };
}

// A team room's own things, once per room, in its frame (back wall at z = 0, door at the front right): a tatami rug
// under the desk island, a low shelf under the poster on the back wall, a shoji screen and a shelf on the west wall,
// plants in three corners, a paper lantern by the door. Its desks are built apart (buildDesk).
export function buildTeamRoom(room, L, light) {
  const group = frameOf(room);
  group.name = room.id;
  const kit = new Kit();
  const seed = hash(`${room.id}:${room.team ?? ""}`);
  const { w, d } = localSize(room);
  shelf(kit, L, w / 2, 0.24, 1.6, 0, true);
  plant(kit, L, w - 0.45, 0.45, true, seed % 7);
  plant(kit, L, 0.45, 0.45, true, (seed >> 3) % 7);
  shoji(kit, L, 0.3, 2.3, Math.PI / 2);
  shelf(kit, L, 0.25, 3.7, 1.2, Math.PI / 2, true);
  plant(kit, L, 0.45, d - 0.45, false, seed % 5);
  const lx = w - 0.45, lz = d - 0.5;
  lantern(kit, L, lx, lz);
  group.add(kit.mesh(roomMaterial({ room: light })));

  const rug = rugMesh(L, 3.9, 2.9, light);
  rug.position.set(w / 2, 0.006, 2.5);
  group.add(rug);
  const glowM = lanternGlowMesh(L, lx, lz);
  group.add(glowM);

  const wallPoster = posterMesh(room.index * 3 + 1, 0.7, 0.92);
  wallPoster.position.set(w / 2, 1.0, 0.08);
  group.add(wallPoster);
  // when the back wall is cut, a smaller print leans on the shelf instead
  const leanPoster = posterMesh(room.index * 3 + 1, 0.4, 0.54);
  leanPoster.position.set(w / 2 + 0.3, 0.62, 0.14);
  leanPoster.rotation.x = -0.2;
  leanPoster.visible = false;
  group.add(leanPoster);

  const lightPool = pool(L);
  lightPool.scale.set(0.6, 1, 0.6);
  lightPool.position.set(lx - 0.4, 0.012, lz - 0.4);
  group.add(lightPool);
  return { group, lantern: glowM, wallPoster, leanPoster, pool: lightPool };
}

// The HQ suite: HQ's desk, the owner's desk, a low table on the tatami, a board, plants.
export function buildSuite(room, L, light) {
  const group = frameOf(room);
  group.name = "hq";
  const kit = new Kit();
  desk(kit, L, 2, 0.5, 1.9, 0.78);
  monitor(kit, L, 2, 0.32);
  deskLamp(kit, L, 1.2, 0.3);
  chair(kit, L, 2, 1.27, 0);
  desk(kit, L, 5, 0.5, 1.7, 0.72);
  monitor(kit, L, 5, 0.32);
  chair(kit, L, 5, 1.32, 0.3);
  // a low table with floor cushions
  kit.rbox(1.2, 0.08, 0.7, L.wood, 3.5, 0.3, 3.2, 0.02);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) kit.box(0.06, 0.3, 0.06, L.woodEdge, 3.5 + sx * 0.5, 0, 3.2 + sz * 0.27);
  for (const [cx, cz] of [[2.6, 3.2], [4.4, 3.2], [3.5, 2.55]]) kit.rbox(0.45, 0.1, 0.45, L.accent, cx, 0.01, cz, 0.04);
  kit.cyl(0.07, 0.1, "#f4f1ea", 3.3, 0.38, 3.15, { seg: 8 });
  // a pinboard on the side wall
  kit.box(0.04, 0.9, 1.4, "#f4f1ea", 0.1, 1.0, 2.6);
  for (let i = 0; i < 6; i++) kit.box(0.02, 0.16, 0.2, ["#f2c14e", "#e4572e", "#2e86ab", "#8aa39b"][i % 4], 0.13, 1.15 + (i % 2) * 0.35, 2.1 + Math.floor(i / 2) * 0.42);
  plant(kit, L, 6.5, 0.5, true, 3);
  plant(kit, L, 0.45, 0.45, true, 1);
  plant(kit, L, 6.45, 4.4, false, 2);
  shoji(kit, L, 6.55, 2.6, -Math.PI / 2);
  lantern(kit, L, 0.5, 4.45);
  group.add(kit.mesh(roomMaterial({ room: light })));
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.58, 0.34), new THREE.MeshBasicMaterial({ map: screenTexture("off", null) }));
  screen.position.set(2, DESK_H + 0.32, 0.3385);
  group.add(screen);
  const owner = new THREE.Mesh(new THREE.PlaneGeometry(0.58, 0.34), new THREE.MeshBasicMaterial({ map: screenTexture("owner", "#8e9bb0") }));
  owner.position.set(5, DESK_H + 0.32, 0.3385);
  group.add(owner);
  const shade = lampShadeMesh(1.2, 0.3);
  group.add(shade);
  const glowM = lanternGlowMesh(L, 0.5, 4.45);
  group.add(glowM);
  const p1 = posterMesh("hq-north", 0.9, 0.62);
  p1.position.set(3.5, 1.35, 0.08);
  group.add(p1);
  const lightPool = pool(L);
  lightPool.scale.set(1.8, 1, 1.5);
  lightPool.position.set(3.5, 0.012, 2.2);
  group.add(lightPool);
  return { group, screen, shade, lantern: glowM, pool: lightPool, wallPoster: p1, leanPoster: null };
}

export const SUITE_SPOTS = {
  seat: new THREE.Vector3(2, 0, 1.12),
  stand: new THREE.Vector3(3.3, 0, 1.3),
  hud: new THREE.Vector3(2, 3.2, 0.7),
};

// The break area: a kitchen counter along the back wall, a sofa round a low table, plants, a lantern.
export function buildBreak(room, L, light) {
  const group = frameOf(room);
  group.name = "break";
  const { w, d } = localSize(room);
  const kit = new Kit();
  const cw = Math.min(3.2, w - 1.4);
  kit.rbox(cw, 0.66, 0.6, L.counter.body, 0.3 + cw / 2, 0, 0.38, 0.015);
  kit.box(cw + 0.04, 0.04, 0.64, L.counter.top, 0.3 + cw / 2, 0.66, 0.38);
  kit.box(0.4, 0.03, 0.3, "#9aa0a6", 0.9, 0.69, 0.36); // sink
  kit.box(0.03, 0.22, 0.03, "#9aa0a6", 0.9, 0.7, 0.18);
  kit.rbox(0.26, 0.36, 0.3, "#2b2b2e", 2.2, 0.7, 0.3, 0.02); // coffee machine
  kit.box(0.08, 0.1, 0.02, "#c8553d", 2.2, 0.9, 0.46);
  for (let i = 0; i < 3; i++) kit.cyl(0.04, 0.09, ["#f4f1ea", "#c8553d", "#e2b867"][i], 2.7 + i * 0.12, 0.7, 0.4, { seg: 8 });
  kit.rbox(0.7, 1.75, 0.66, "#e9e6e0", 0.3 + cw + 0.45, 0, 0.4, 0.03); // fridge
  kit.box(0.03, 0.5, 0.03, "#9aa0a6", 0.3 + cw + 0.2, 0.95, 0.75);
  // upper cabinets
  kit.rbox(cw, 0.5, 0.32, L.counter.body, 0.3 + cw / 2, 1.55, 0.18, 0.015);
  // the sofa faces the back wall across a low table
  const sx = w / 2, sz = Math.min(d - 1.0, 3.6);
  kit.rbox(2.0, 0.24, 0.8, L.sofa, sx, 0.08, sz, 0.05);
  kit.rbox(2.0, 0.5, 0.2, L.sofa, sx, 0.08, sz + 0.32, 0.05);
  for (const s of [-1, 1]) kit.rbox(0.2, 0.42, 0.8, L.sofa, sx + s * 0.95, 0.08, sz, 0.05);
  for (const s of [-1, 1]) kit.rbox(0.82, 0.12, 0.62, L.sofaCushion, sx + s * 0.42, 0.32, sz - 0.04, 0.05);
  for (const s of [-1, 1]) for (const t of [-1, 1]) kit.box(0.05, 0.08, 0.05, L.steel, sx + t * 0.9, 0, sz + s * 0.32);
  kit.rbox(1.0, 0.06, 0.55, L.wood, sx, 0.34, sz - 1.0, 0.02);
  for (const t of [-1, 1]) kit.box(0.04, 0.34, 0.5, L.steel, sx + t * 0.42, 0, sz - 1.0);
  kit.cyl(0.05, 0.1, "#f4f1ea", sx + 0.2, 0.4, sz - 1.0, { seg: 8 });
  plant(kit, L, w - 0.45, 0.45, true, 4);
  plant(kit, L, 0.45, d - 0.5, true, 6);
  if (d > 7) {
    // the long lounge of the floor stage: a high table with stools near the front
    kit.rbox(1.6, 0.05, 0.6, L.wood, sx, 0.9, d - 2.0, 0.02);
    for (const t of [-1, 1]) kit.box(0.05, 0.9, 0.05, L.steel, sx + t * 0.7, 0, d - 2.0);
    for (const t of [-0.5, 0, 0.5]) { kit.cyl(0.14, 0.04, L.accent, sx + t * 1.2, 0.62, d - 1.45, { seg: 10 }); kit.cyl(0.02, 0.62, L.steel, sx + t * 1.2, 0, d - 1.45); }
    plant(kit, L, w - 0.5, d - 0.5, false, 2);
  }
  lantern(kit, L, w - 0.45, sz + 0.3);
  group.add(kit.mesh(roomMaterial({ room: light })));
  const rug = rugMesh(L, 2.4, 1.8, light);
  rug.position.set(sx, 0.006, sz - 0.6);
  group.add(rug);
  const glowM = lanternGlowMesh(L, w - 0.45, sz + 0.3);
  group.add(glowM);
  const p = posterMesh("break-room", 0.7, 0.5);
  p.position.set(Math.min(w - 0.6, 0.3 + cw + 1.4), 1.3, 0.08);
  group.add(p);
  const lightPool = pool(L);
  lightPool.scale.set(1.3, 1, 1.4);
  lightPool.position.set(sx, 0.012, sz - 0.8);
  group.add(lightPool);
  // where done workers stand with a mug, in this room's frame: by the counter, by the sofa, at the high table
  const spots = [
    { x: 0.75, z: 1.35, ry: 0.5 }, { x: 1.55, z: 1.45, ry: -0.3 }, { x: 2.4, z: 1.35, ry: 0.2 }, { x: w - 0.9, z: 1.5, ry: -0.6 },
    { x: 0.7, z: sz - 0.9, ry: 1.2 }, { x: w - 0.7, z: sz - 1.1, ry: -1.2 },
    ...(d > 7 ? [{ x: sx - 0.85, z: d - 2.0, ry: Math.PI / 2 }, { x: sx + 0.85, z: d - 2.0, ry: -Math.PI / 2 }] : []),
  ];
  return { group, lantern: glowM, pool: lightPool, wallPoster: p, leanPoster: null, spots };
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

// The lot round the building: pines behind it and to its left, kept off the camera's side of the default view so
// nothing outdoors hides a room.
export function scatterLot(kit, b, L) {
  const y = -0.12;
  const tree = (x, z, s) => {
    kit.cyl(0.08 * s, 0.5 * s, L.tree.trunk, x, y, z, { seg: 6 });
    [[0.95, 0.9], [0.75, 1.45], [0.5, 1.95]].forEach(([r, h], i) => kit.cyl(r * s, 0.9 * s, i % 2 ? L.plant.leaf : L.plant.leaf2, x, y + (h - 0.55) * s, z, { top: 0.02, seg: 7 }));
  };
  const jitter = (i) => (((i * 7919) % 100) / 100 - 0.5);
  let i = 0;
  for (let x = b.minX - 2; x <= b.maxX + 2; x += 4.5, i++) tree(x + jitter(i) * 1.5, b.minZ - 3.2 + jitter(i + 3), 1 + jitter(i + 5) * 0.4);
  for (let z = b.minZ + 1.5; z <= b.maxZ + 1; z += 4.5, i++) tree(b.minX - 3.2 + jitter(i), z + jitter(i + 1) * 1.5, 1 + jitter(i + 2) * 0.4);
}
