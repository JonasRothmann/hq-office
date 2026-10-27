// The Nordic studio's rooms, furnished: a team room of four desks, the HQ suite and the break area (kitchen, long
// table, sofa corner). Each room is a handful of meshes: one for everything that stands on the floor (vertex colours
// and the props atlas), one per wall for what hangs on it (hidden when that wall is cut), one for lamp shades (unlit,
// so they glow at night), one for the light pools, one per screen, and real lamps at night when asked (opts.lamps).
import { THREE, Kit, roomMaterial } from "./kit.js";
import { toWorld } from "./plan.js";
import { ATLAS, atlasTexture } from "./atlas.js";
import { screen as screenTexture, glow as glowTexture } from "./textures.js";
import { hash } from "./look.js";
import * as P from "./props.js";

const WARM = "#ffd9a0";

function frameOf(room) {
  const w = toWorld(room, 0, 0);
  const g = new THREE.Group();
  g.position.set(w.x, 0, w.z);
  g.rotation.y = w.ry;
  return g;
}

function localSize(room) {
  return room.back === "w" || room.back === "e" ? { w: room.d, d: room.w } : { w: room.w, d: room.d };
}

// A wall's face stands half its thickness into the room: things on or against a wall start there.
const WALL = 0.075;
const shifted = (x, z) => { const k = new Kit(); k.frame.makeTranslation(x, 0, z); return k; };

// The kits a room is built into. Each wall's kit already starts at that wall's face.
function kits() {
  return { kit: new Kit(), decor: { n: shifted(0, WALL), w: shifted(WALL, 0), e: shifted(-WALL, 0) }, glow: new Kit(), pools: new Kit(), screens: [], lights: [] };
}
// Run fn with the kit's frame at the back wall's face.
const atBack = (kit, fn) => kit.at(0, 0, WALL, 0, fn);
const atWest = (kit, fn) => kit.at(WALL, 0, 0, 0, fn);

// Kits to meshes, in the room's group.
function finish(group, K, L, light, opts = {}) {
  const atlas = atlasTexture(L);
  const mat = roomMaterial({ map: atlas, room: light });
  const geo = { atlas: ATLAS.size, white: ATLAS.white };
  const stat = K.kit.mesh(mat, geo);
  stat.name = "furniture";
  group.add(stat);
  const decor = [];
  for (const [side, k] of Object.entries(K.decor)) {
    if (k.empty) continue;
    const m = k.mesh(mat, { ...geo, cast: false });
    m.name = `decor:${side}`;
    group.add(m);
    decor.push({ side, mesh: m });
  }
  let glow = null;
  if (!K.glow.empty) {
    glow = K.glow.mesh(new THREE.MeshBasicMaterial({ vertexColors: true }), { cast: false, receive: false });
    glow.name = "lamps";
    group.add(glow);
  }
  let pools = null;
  if (!K.pools.empty) {
    pools = new THREE.Mesh(K.pools.geometry({ ownUv: true }), new THREE.MeshBasicMaterial({ map: glowTexture("rgba(255,208,140,0.5)"), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true }));
    pools.renderOrder = 1;
    pools.name = "pools";
    pools.visible = L.night;
    group.add(pools);
  }
  const screens = K.screens.map((s) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(s.w, s.h), new THREE.MeshBasicMaterial({ map: screenTexture("off", null) }));
    m.position.set(s.x, s.y, s.z);
    m.rotation.y = s.ry;
    group.add(m);
    return m;
  });
  const lights = [];
  if (opts.lamps && L.night) {
    for (const l of K.lights) {
      const pl = new THREE.PointLight(WARM, (l.i ?? 2.2) * 1.5, (l.r ?? 4.2) * 1.1, 1.5);
      pl.position.set(l.x, l.y, l.z);
      pl.userData.on = pl.intensity;
      group.add(pl);
      lights.push(pl);
    }
  }
  return { stat, decor, glow, pools, screens, lights, mats: [mat] };
}

// The glow of a room's shades for the time of day and whether the room is lit.
export function lampColor(L, lit) {
  return L.night ? (lit ? "#ffe0a8" : "#5c5446") : "#ffffff";
}

// ---------------------------------------------------------------------------------------------------------------------
// The team room: four desks as two facing pairs under two pendants, a bookcase, a pinboard, a bike, a dog asleep.
// room: a 7 × 5 room (back wall n); opts.desks: up to four lane names, in seat order. Returns the desks' spots.
export function buildTeamRoom(room, L, light, opts = {}) {
  const group = frameOf(room);
  group.name = `team:${room.id}`;
  const { w, d } = localSize(room);
  const S = L.studio;
  const K = kits();
  const { kit, decor, glow, pools } = K;
  const seed = hash(room.id);
  const cx = w / 2, cz = 2.45;

  P.rug(kit, L, ATLAS.rugs.oat, cx, cz, 3.9, 2.9);
  // the bench: two facing pairs with a felt screen between them
  const desks = [];
  const pairs = [[-0.65, 0], [0.65, 0]];
  for (const [i, [dx]] of pairs.entries()) {
    for (const north of [true, false]) {
      const x = cx + dx, z = north ? cz - 0.33 : cz + 0.33, ry = north ? Math.PI : 0;
      P.desk(kit, L, x, z, ry, { w: 1.3, d: 0.66, legs: "sled" });
      const k = desks.length;
      const lane = opts.desks?.[k];
      const sc = P.deskTop(kit, L, x, z, ry, hash(lane ?? `${room.id}:${k}`) ^ seed);
      K.screens.push(sc);
      const seatZ = north ? z - 0.68 : z + 0.68;
      P.taskChair(kit, L, x, north ? seatZ + 0.1 : seatZ - 0.1, north ? 0 : Math.PI, [S.wool, "#4a4a50", S.sage, S.oatmeal][(k + seed) % 4]);
      desks.push({
        lane, screen: K.screens.length - 1,
        seat: new THREE.Vector3(x, 0, seatZ), faceDesk: north ? 0 : Math.PI,
        stand: new THREE.Vector3(x + (i === 0 ? -0.95 : 0.95), 0, north ? z - 0.45 : z + 0.5),
        hud: new THREE.Vector3(x, 2.3, z),
      });
    }
  }
  kit.box(2.6, 0.3, 0.03, S.felt, cx, P.DESK_H, cz);
  [S.forest, S.mustard].forEach((c, i) => K.lights.push(P.pendant(kit, glow, L, cx + (i ? 0.65 : -0.65), cz, { y: 1.86, kind: "dome", color: c })));
  for (const dx of [-0.65, 0.65]) P.pool(pools, cx + dx, cz, 1.5);

  // the back wall: a radiator and a credenza under the windows, a pinboard and prints on the piers
  atBack(kit, () => {
    P.radiator(kit, L, 2.0, 0, 1.3);
    P.credenza(kit, L, 5.0, 0, 0, 1.7, S.sage);
    P.pothos(kit, L, 4.45, 0.42, 0.12, seed, 0.3);
    P.smallPlant(kit, L, 5.6, 0.42, 0.16, 3);
    ["#2f3e57", "#e9e2d2", "#b5532e"].forEach((c, i) => kit.box(0.26 - i * 0.02, 0.035, 0.2, c, 5.15, 0.42 + i * 0.035, 0.16, { ry: i * 0.1 }));
  });
  P.pinboard(decor.n, L, 3.5, 1.0, 0, 0, 0.8, 0.6);
  P.print(decor.n, L, 3.5, 1.78, 0, 0, ATLAS.prints[2], 0.36, 0.46, S.black);
  P.print(decor.n, L, 6.5, 1.2, 0, 0, ATLAS.prints[0], 0.42, 0.56, S.oak);
  P.clock(decor.w, L, 0, 2.3, 1.85, Math.PI / 2);

  // the west wall: a fig in the corner, open shelving, a planner over the bike
  P.figTree(kit, L, 0.45, 0.5, seed, 1.75);
  atWest(kit, () => {
    P.bookcase(kit, L, 0, 1.85, Math.PI / 2, { w: 1.7, h: 1.95, rows: 5, seed });
    kit.at(0.16, 1.95, 1.4, Math.PI / 2, () => P.pothos(kit, L, 0, 0, 0, seed + 1, 0.9));
    P.bike(kit, L, 0.2, 3.75, -Math.PI / 2, "#7f9c8a");
  });
  P.planner(decor.w, L, 0, 1.45, 3.75, Math.PI / 2, 0.9, 0.56);
  P.dogBed(kit, L, 1.35, 4.25, 0.4);

  // the east side and the front: plants, a floor lamp
  P.monstera(kit, L, 6.35, 4.3, seed, 1.0);
  P.snakePlant(kit, L, 6.55, 2.45, seed);
  K.lights.push({ ...P.floorLamp(kit, glow, L, 6.5, 0.5, "tripod"), i: 1.4, r: 3 });
  P.pool(pools, 6.3, 0.9, 1.1);

  const out = finish(group, K, L, light, opts);
  return { group, ...out, desks, room, lantern: out.glow, seed };
}

// ---------------------------------------------------------------------------------------------------------------------
// The HQ suite: HQ's desk and the owner's, facing the room from under the windows; a reading corner; a round table
// under a paper lantern with a whiteboard beside it; an olive tree; slatted oak on the pier.
export const SUITE = {
  hq: { seat: new THREE.Vector3(1.9, 0, 0.82), faceDesk: 0, stand: new THREE.Vector3(3.0, 0, 1.2), hud: new THREE.Vector3(1.9, 2.4, 1.5) },
  owner: { seat: new THREE.Vector3(4.6, 0, 0.82), faceDesk: 0 },
};

export function buildStudioSuite(room, L, light, opts = {}) {
  const group = frameOf(room);
  group.name = "hq";
  const S = L.studio;
  const K = kits();
  const { kit, decor, glow, pools } = K;

  // two desks under the windows, facing the room
  P.desk(kit, L, 1.9, 1.5, Math.PI, { w: 1.5, d: 0.7, legs: "trestle" });
  K.screens.push(P.deskTop(kit, L, 1.9, 1.5, Math.PI, 11, { w: 1.5, d: 0.7 }));
  P.taskChair(kit, L, 1.9, 0.92, 0, S.navy);
  P.desk(kit, L, 4.6, 1.5, Math.PI, { w: 1.5, d: 0.7, legs: "trestle" });
  K.screens.push(P.deskTop(kit, L, 4.6, 1.5, Math.PI, 6, { w: 1.5, d: 0.7 }));
  P.taskChair(kit, L, 4.6, 0.92, 0.25, S.rust);
  atBack(kit, () => { P.radiator(kit, L, 1.9, 0, 1.3); P.radiator(kit, L, 4.9, 0, 1.3); });
  K.lights.push(P.pendant(kit, glow, L, 1.9, 1.45, { y: 1.75, kind: "cone" }));
  K.lights.push(P.pendant(kit, glow, L, 4.6, 1.45, { y: 1.75, kind: "cone" }));
  P.pool(pools, 1.9, 1.4, 1.3); P.pool(pools, 4.6, 1.4, 1.3);

  // the pier: slatted oak and a print
  P.slats(decor.n, L, 3.0, 4.0, 2.4);
  P.print(decor.n, L, 3.5, 1.25, 0.05, 0, ATLAS.wide, 0.62, 0.46, S.black);
  P.print(decor.n, L, 0.5, 1.15, 0, 0, ATLAS.prints[3], 0.42, 0.56, S.oak);
  P.print(decor.n, L, 6.5, 1.3, 0, 0, ATLAS.prints[1], 0.36, 0.48, S.walnut);

  // a reading corner on a grey wool rug
  P.rug(kit, L, ATLAS.rugs.grey, 1.6, 3.55, 2.4, 1.8);
  P.loungeChair(kit, L, 1.25, 3.4, 0.6, S.rust);
  P.lowTable(kit, L, 2.2, 3.7, 0.55, 0.55, S.walnut);
  kit.cyl(0.05, 0.12, "#efebe4", 2.1, 0.34, 3.65, { seg: 8 });
  ["#2f3e57", "#d4a236"].forEach((c, i) => kit.box(0.2, 0.03, 0.15, c, 2.3, 0.34 + i * 0.03, 3.75, { ry: i * 0.3 }));
  K.lights.push({ ...P.floorLamp(kit, glow, L, 0.5, 4.4, "andon"), i: 1.2, r: 2.6 });
  P.pool(pools, 0.7, 4.2, 1.0);
  atWest(kit, () => {
    P.credenza(kit, L, 0, 2.45, Math.PI / 2, 1.3, S.rust);
    P.smallPlant(kit, L, 0.18, 0.42, 2.05, 5);
    kit.cyl(0.04, 0.22, "#47474a", 0.18, 0.42, 2.8, { top: 0.025, seg: 8 });
    kit.box(0.01, 0.3, 0.01, "#6b5236", 0.18, 0.62, 2.8, { rz: 0.2 });
    kit.sphere(0.04, "#c8443a", 0.21, 0.92, 2.8, { detail: 1 });
  });

  // a round table under a paper lantern, on a woven mat; a whiteboard on a stand beside it
  P.rug(kit, L, ATLAS.rugs.tatami, 5.4, 3.5, 2.2, 1.8);
  P.roundTable(kit, L, 5.4, 3.5, 0.48);
  P.forkChair(kit, L, 4.75, 3.45, Math.PI / 2 - 0.1);
  P.forkChair(kit, L, 6.05, 3.5, -Math.PI / 2 + 0.1);
  P.forkChair(kit, L, 5.4, 2.85, 0.05, S.walnut);
  kit.box(0.3, 0.01, 0.22, "#f4f1ea", 5.3, P.DESK_H, 3.5, { ry: 0.3 });
  kit.cyl(0.035, 0.08, "#b5532e", 5.6, P.DESK_H, 3.35, { seg: 8 });
  K.lights.push(P.pendant(kit, glow, L, 5.4, 3.5, { y: 1.62, kind: "lantern" }));
  P.pool(pools, 5.4, 3.5, 1.4);
  P.whiteboardStand(kit, L, 6.45, 1.9, -Math.PI / 2 + 0.35);
  P.oliveTree(kit, L, 6.5, 0.48, 2);

  const out = finish(group, K, L, light, opts);
  return { group, ...out, spots: SUITE, room, lantern: out.glow };
}

// ---------------------------------------------------------------------------------------------------------------------
// The break area: a sofa corner under one window, the kitchen under the other, a long oak table in the middle with
// mixed chairs and a bench, coats by the door.
export function buildStudioBreak(room, L, light, opts = {}) {
  const group = frameOf(room);
  group.name = "break";
  const { w, d } = localSize(room);
  const S = L.studio;
  const K = kits();
  const { kit, decor, glow, pools } = K;

  // A wide room (7 m) has the sofa under the first window and the kitchen beside it; a narrower one has the kitchen
  // along the whole back wall and the sofa at the front, facing it.
  const wide = w >= 6.5;
  const sofaAt = wide ? { x: 2.0, z: 0.55, ry: 0 } : { x: w / 2, z: d - 0.7, ry: Math.PI };
  P.figTree(kit, L, 0.45, wide ? 0.48 : d - 0.5, 5, 1.8);
  kit.at(sofaAt.x, 0, sofaAt.z, sofaAt.ry, () => {
    P.rug(kit, L, ATLAS.rugs.rust, 0, 0.7, 2.5, 1.6);
    P.sofa(kit, L, 0, 0, 0, { w: 2.0 });
    P.lowTable(kit, L, 0, 1.0, 0.9, 0.48);
    kit.cyl(0.04, 0.08, S.mugs[1], -0.2, 0.34, 0.95, { seg: 8 });
    P.smallPlant(kit, L, 0.25, 0.34, 1.03, 2);
    kit.cyl(0.22, 0.24, S.mustard, 0.95, 0, 1.3, { seg: 12 });
  });
  const lamp = wide ? { x: 0.55, z: 1.45 } : { x: Math.max(0.5, w / 2 - 1.45), z: d - 0.45 };
  K.lights.push({ ...P.floorLamp(kit, glow, L, lamp.x, lamp.z, "tripod"), i: 1.4, r: 3 });
  P.pool(pools, lamp.x + 0.3, lamp.z - 0.15, 1.2);
  if (wide) P.print(decor.n, L, 3.5, 1.95, 0, 0, ATLAS.prints[1], 0.36, 0.48, S.oak);

  // the kitchen
  const k0 = wide ? 3.25 : 0.35, k1 = Math.min(w - 0.85, k0 + 3.6);
  atBack(kit, () => {
    P.kitchenRun(kit, L, k0, k1, { sinkX: k1 - 1.0 });
    P.fridge(kit, L, k1 + 0.36, 0, 0.66);
    P.coffeeMachine(kit, L, k0 + 0.35, 0.22);
    P.kettle(kit, L, k0 + 1.0, 0.22);
    P.fruitBowl(kit, L, k1 - 0.4, 0.26);
    P.smallPlant(kit, L, k0 + 1.35, P.COUNTER_H, 0.12, 4);
    for (let i = 0; i < 3; i++) kit.cyl(0.035, 0.08, S.mugs[i + 2], k0 + 0.65 + i * 0.09, P.COUNTER_H, 0.36, { seg: 8 });
  });
  P.openShelves(decor.n, L, k0 + 0.25, 0.9, [1.25, 1.55]);

  // the long table: shell chairs on one side, a bench on the other, globes over it
  const tx = wide ? 3.9 : w / 2, tz = wide ? 3.05 : Math.min(2.6, d / 2 - 0.2);
  P.longTable(kit, L, tx, tz, 0, 2.6, 0.82);
  [[S.rust, -0.85], [S.sage, 0], [S.oatmeal, 0.85]].forEach(([c, dx]) => P.shellChair(kit, L, tx + dx, tz - 0.62, 0, c));
  P.bench(kit, L, tx, tz + 0.62, 0, 2.2);
  P.forkChair(kit, L, tx + 1.62, tz, -Math.PI / 2, S.oak);
  kit.cyl(0.12, 0.03, "#efebe4", tx - 0.2, P.DESK_H, tz, { top: 0.14, seg: 12 });
  [["#e9a23b", 0.03], ["#c8443a", -0.04]].forEach(([c, dx]) => kit.sphere(0.04, c, tx - 0.2 + dx, P.DESK_H + 0.05, tz, { detail: 1 }));
  kit.cyl(0.035, 0.08, S.mugs[0], tx + 0.5, P.DESK_H, tz - 0.15, { seg: 8 });
  kit.box(0.24, 0.012, 0.32, "#f4f1ea", tx + 0.9, P.DESK_H, tz + 0.05, { ry: -0.2 });
  for (const dx of [-0.6, 0.6]) K.lights.push(P.pendant(kit, glow, L, tx + dx, tz, { y: 1.92, kind: "globe" }));
  for (const dx of [-0.6, 0.6]) P.pool(pools, tx + dx, tz, 1.4);

  // by the front door: coats on a stand, a mat, a snake plant, the dog's bowls
  const cx = w - 0.4, cz = d - 0.55;
  kit.cyl(0.02, 1.45, S.oak, cx, 0, cz, { seg: 6 });
  kit.cyl(0.16, 0.03, S.oak, cx, 0, cz, { seg: 8 });
  [["#2f3e57", 0], ["#d4a236", 2.1], ["#b5532e", 4.2]].forEach(([c, a]) => kit.rbox(0.22, 0.5, 0.1, c, cx + Math.sin(a) * 0.1, 0.85, cz + Math.cos(a) * 0.1, 0.04, { ry: a }));
  kit.box(0.3, 0.32, 0.08, S.cord, cx - 0.1, 0.7, cz + 0.12, { ry: 0.4 });
  P.snakePlant(kit, L, w - 0.4, 2.0, 3);
  // the west side: a big monstera and a basket of magazines
  P.monstera(kit, L, 0.55, wide ? 2.4 : 1.6, 7, 1.15);
  kit.cyl(0.13, 0.22, S.cord, 0.85, 0, wide ? 2.95 : 2.3, { top: 0.15, seg: 10 });
  ["#e9e2d2", "#2f3e57", "#b5532e"].forEach((c, i) => kit.box(0.02, 0.22, 0.16, c, 0.8 + i * 0.04, 0.12, wide ? 2.95 : 2.3, { rz: (i - 1) * 0.15 }));
  kit.cyl(0.07, 0.04, "#b9bcc2", w - 1.0, 0, 1.05, { seg: 10 });
  kit.cyl(0.07, 0.04, "#b9bcc2", w - 0.8, 0, 1.05, { seg: 10 });

  const out = finish(group, K, L, light, opts);
  // where done workers stand with a mug, in this room's frame: along the counter, then round the table's far end
  const spots = [];
  for (let x = k0 + 0.6; x < k1 - 0.2 && spots.length < 4; x += 0.85) spots.push({ x, z: 1.1, ry: ((spots.length % 3) - 1) * 0.4 });
  spots.push({ x: tx - 1.75, z: tz - 0.3, ry: 0.9 }, { x: tx + 1.0, z: tz - 1.1, ry: -0.5 });
  const seats = [{ seat: new THREE.Vector3(tx - 0.85, 0, tz - 0.66), faceDesk: 0 }, { seat: new THREE.Vector3(tx, 0, tz - 0.66), faceDesk: 0 }, { seat: new THREE.Vector3(tx + 0.85, 0, tz - 0.66), faceDesk: 0 }];
  return { group, ...out, spots, seats, room, lantern: out.glow };
}

// ---------------------------------------------------------------------------------------------------------------------
// One lane's own 5 × 4 office: a desk facing the back wall, a bookcase on the side wall, a fig, a rug, a floor lamp,
// a pinboard and a print. The desk stands where OFFICE (in furniture.js) says: centre (2, 0.5), seat (2, 1.12).
// extra(kit, glow) adds what the caller keeps separate (the status lamp).
export function buildStudioOffice(room, L, light, opts = {}) {
  const group = frameOf(room);
  group.name = `office:${room.lane}`;
  const S = L.studio;
  const K = kits();
  const { kit, decor, glow, pools } = K;
  const seed = hash(room.lane ?? room.id);

  P.rug(kit, L, seed % 2 ? ATLAS.rugs.grey : ATLAS.rugs.oat, 2.0, 1.5, 2.4, 1.7);
  P.desk(kit, L, 2.0, 0.5, 0, { w: 1.5, d: 0.66, legs: seed % 3 ? "sled" : "trestle" });
  K.screens.push(P.deskTop(kit, L, 2.0, 0.5, 0, seed, { w: 1.5, d: 0.66 }));
  P.taskChair(kit, L, 2.0, 1.02, Math.PI, [S.wool, "#4a4a50", S.sage, S.oatmeal, S.rust][seed % 5]);
  P.figTree(kit, L, 0.45, 0.48, seed, 1.7);
  atWest(kit, () => P.bookcase(kit, L, 0, 2.15, Math.PI / 2, { w: 1.3, h: 1.6, rows: 4, seed }));
  P.monstera(kit, L, 4.5, 3.4, seed, 0.9);
  K.lights.push({ ...P.floorLamp(kit, glow, L, 0.5, 3.45, "tripod"), i: 1.4, r: 3 });
  P.pool(pools, 1.6, 1.4, 1.6);
  P.pool(pools, 0.7, 3.2, 1.0);
  P.pinboard(decor.n, L, 3.5, 1.05, 0, 0, 0.7, 0.5);
  P.print(decor.n, L, 3.5, 1.75, 0, 0, ATLAS.prints[seed % 4], 0.32, 0.42, seed % 2 ? S.oak : S.black);
  opts.extra?.(kit, glow);

  const out = finish(group, K, L, light, opts);
  return { group, ...out, room, seed };
}
