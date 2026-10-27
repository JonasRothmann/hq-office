// The furnished rooms, in one Japandi look (warm neutrals, pale oak and smoked oak, paper light, few things with room
// between them): a team room's desks (each built on its own, so a lane owns its desk) and the room round them, the HQ
// suite and the break area, and the courts between wings. Everything is in a room's own frame: back wall at z = 0, door side at z = d.
//
// A room is a handful of meshes: one for everything that stands on the floor (vertex colours and the props atlas), one
// per wall for what hangs on it (hidden while that wall is cut), one for what glows (shades, paper, the sign), one for
// the light pools at night, and one per screen. Team rooms vary by their place in the order: rug, feature wall, prints,
// plants, pendants and one signature thing, so a floor of rooms never looks cloned.
import { THREE, Kit, roomMaterial } from "./kit.js";
import { toWorld } from "./plan.js";
import { ATLAS, atlasTexture } from "./atlas.js";
import { screen as screenTexture, glow as glowTexture } from "./textures.js";
import { hash, draw } from "./look.js";
import { maple, stoneLantern } from "./garden.js";
import * as P from "./props.js";

export const DESK_H = P.DESK_H;
export const SEAT_H = P.SEAT_H;
const WARM = "#ffd9a0";

// The points of a desk in its own frame (the desk's centre on the floor at the origin, its worker on the +z side
// facing -z):   seat: a seated worker's hips   hud: the desk HUD's anchor. A waiting worker stands beside the desk on
// the island's outer side (deskStand).
export const DESK_SPOTS = {
  seat: new THREE.Vector3(0, 0, 0.66),
  hud: new THREE.Vector3(0, 2.45, 0.55),
};
export const deskStand = (out) => new THREE.Vector3(out * 1.0, 0, 0.42);
const DESK_W = 1.38, DESK_D = 0.7;

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

// A wall's face stands half its thickness into the room: things on or against a wall start there.
const WALL = 0.075;
const shifted = (x, z, ry = 0) => { const k = new Kit(); k.frame.makeTranslation(x, 0, z).multiply(new THREE.Matrix4().makeRotationY(ry)); return k; };

// The kits a room is built into. Each wall's kit is turned to face into the room from that wall's face, so a prop
// drawn against a wall (its back at z = 0, x along the wall) works on any of them: n runs along x, w and e along z.
// `lit` is the same per wall for what glows on it (the sign).
function kits(w) {
  const walls = () => ({ n: shifted(0, WALL), w: shifted(WALL, 0, Math.PI / 2), e: shifted(w - WALL, 0, -Math.PI / 2) });
  return { kit: new Kit(), decor: walls(), lit: walls(), glow: new Kit(), pools: new Kit(), screens: [], lights: [] };
}
// Run fn with the kit's frame at the back wall's face, or turned to face out of the west or the east wall: in that
// frame x runs along the wall (west: x = -z of the room; east: x = z) and z out into the room.
const atBack = (kit, fn) => kit.at(0, 0, WALL, 0, fn);
const atWest = (kit, fn) => kit.at(WALL, 0, 0, Math.PI / 2, fn);
const atEast = (kit, w, fn) => kit.at(w - WALL, 0, 0, -Math.PI / 2, fn);

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
  for (const [side, k] of Object.entries(K.lit)) {
    if (k.empty) continue;
    const m = k.mesh(new THREE.MeshBasicMaterial({ vertexColors: true, map: atlas }), { ...geo, cast: false, receive: false });
    m.name = `sign:${side}`;
    group.add(m);
    decor.push({ side, mesh: m });
  }
  let glow = null;
  if (!K.glow.empty) {
    glow = K.glow.mesh(new THREE.MeshBasicMaterial({ vertexColors: true, map: atlas, color: L.night ? "#ffe0a8" : L.lantern.paper }), { ...geo, cast: false, receive: false });
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
  // real lamps only where a page asks for them (the lab's showroom): a whole campus of them would cost too much
  const lights = [];
  if (opts.lamps && L.night) {
    for (const l of K.lights) {
      const pl = new THREE.PointLight(WARM, (l.i ?? 2.2) * 1.5, (l.r ?? 4.2) * 1.1, 1.5);
      pl.position.set(l.x, l.y, l.z);
      group.add(pl);
      lights.push(pl);
    }
  }
  return { stat, decor, glow, pools, screens, lights };
}

// ---------------------------------------------------------------------------------------------------------------------
// A desk of a team room, in its own frame: a birch top on black sled legs, a felt screen on the shared edge, the
// lane's things on it (deskTop, varied by the lane's name), a task chair, and the status lamp the world tints. out:
// the side of the island that faces the room's wall (+1 or -1 in the desk's x), where the lamp stands.
export function buildDesk(lane, out, L, light) {
  const group = new THREE.Group();
  group.name = `desk:${lane}`;
  const S = L.studio;
  const kit = new Kit();
  const seed = hash(lane);
  P.desk(kit, L, 0, 0, 0, { w: DESK_W, d: DESK_D, legs: "sled" });
  // half of the felt screen between a facing pair: each desk brings the half on its own side of the shared edge
  kit.box(DESK_W - 0.06, 0.3, 0.014, S.felt, 0, DESK_H, -DESK_D / 2 + 0.007);
  const sc = P.deskTop(kit, L, 0, 0, 0, seed, { w: DESK_W, d: DESK_D, clear: out });
  const lampX = out * 0.56, lampZ = -0.24;
  kit.cyl(0.06, 0.02, S.black, lampX, DESK_H, lampZ, { seg: 10 });
  kit.box(0.018, 0.3, 0.018, S.black, lampX, DESK_H + 0.02, lampZ, { rz: 0.25 * out });
  kit.box(0.018, 0.2, 0.018, S.black, lampX - 0.07 * out, DESK_H + 0.29, lampZ, { rz: -1.0 * out });
  P.taskChair(kit, L, 0, DESK_SPOTS.seat.z - 0.08, Math.PI, [S.oatmeal, S.charcoal, S.sage, S.wool, S.navy][draw(seed, 3) % 5]);
  const mat = roomMaterial({ map: atlasTexture(L), room: light });
  const m = kit.mesh(mat, { atlas: ATLAS.size, white: ATLAS.white });
  m.name = "desk";
  group.add(m);

  const screen = new THREE.Mesh(new THREE.PlaneGeometry(sc.w, sc.h), new THREE.MeshBasicMaterial({ map: screenTexture("off", null) }));
  screen.position.set(sc.x, sc.y, sc.z);
  screen.rotation.y = sc.ry;
  group.add(screen);
  const shadeGeo = new THREE.CylinderGeometry(0.035, 0.08, 0.09, 10, 1, false);
  shadeGeo.rotateZ(-0.5 * out);
  shadeGeo.translate(lampX - 0.11 * out, DESK_H + 0.35, lampZ);
  const shade = new THREE.Mesh(shadeGeo, new THREE.MeshBasicMaterial({ color: "#fff2d8" }));
  group.add(shade);
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.3).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: glowTexture("rgba(255,214,150,0.55)"), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  pool.position.set(0, 0.014, 0.2);
  pool.visible = L.night;
  pool.renderOrder = 1;
  group.add(pool);
  return { group, screen, shade, pool, seed, stand: deskStand(out) };
}

// ---------------------------------------------------------------------------------------------------------------------
// A team room's own things, round its island of desks (built apart, buildDesk). Its back wall has two windows (local
// x 1..3 and 4..6) with a pier between them, its door is at the front right (x 5..6): a rug under the island, two
// pendants over it, a low sideboard under the right window, a slatted oak feature (on the pier, or at the
// wall's right end with a pinboard and a print on the pier), a corner tree, a bookcase and a clock on the west wall, a
// floor lamp, a snake plant and a monstera on the east side, a print on the east wall, and one signature thing at the
// front left. What varies, by the room's place in the order (its index): the rug, the feature wall, the prints, the
// tree, the pendants, the sideboard's door and the signature thing.
const RUGS = ["linen", "stripe", "grey", "indigo", "check", "sand", "tatami", "rust", "oat"];
const SIGNATURES = ["bike", "records", "dog", "guitar", "reading"];
// paper or ceramic over the island: [kind, colour key in the studio's tokens]
const PENDANTS = [["washi"], ["ceramic", "charcoal"], ["lantern"], ["ceramic", "linen"], ["washi"], ["ceramic", "clay"]];
export function buildTeamRoom(room, L, light, opts = {}) {
  const group = frameOf(room);
  group.name = room.id;
  const { w, d } = localSize(room);
  const S = L.studio;
  const K = kits(w);
  const { kit, decor, glow, pools } = K;
  const i = room.index ?? 0;
  const seed = hash(room.id);
  const v = (salt, n) => draw(seed, salt) % n;
  const cx = 3.5, cz = 2.5;
  const signature = SIGNATURES[i % SIGNATURES.length];

  P.rug(kit, L, ATLAS.rugs[RUGS[i % RUGS.length]], cx, cz, 4.1, 3.1);
  const [lamp, tone] = PENDANTS[i % PENDANTS.length];
  [2.8, 4.2].forEach((x) => K.lights.push(P.pendant(kit, glow, L, x, cz, { y: 1.86, kind: lamp, color: tone && S[tone] })));
  for (const x of [2.8, 4.2]) P.pool(pools, x, cz, 1.5);

  // the back wall: nothing under the left window, a low sideboard under the right one with a vase of branches; the
  // slatted oak on the pier (a pinboard at the wall's right end), or the pinboard and a print on the pier and the slats
  // at the right end
  atBack(kit, () => {
    P.credenza(kit, L, 5.0, 0, 0, 1.7, [S.sage, S.rust, S.navy, S.mustard, S.forest][(i + 2) % 5]);
    P.vaseBranch(kit, L, 4.5, 0.46, 0.18, seed);
    if (signature === "records") P.smallPlant(kit, L, 5.6, 0.46, 0.18, 3 + i);
    else [S.charcoal, S.linen].forEach((c, k) => kit.box(0.26 - k * 0.03, 0.035, 0.2, c, 5.55, 0.46 + k * 0.035, 0.18, { ry: k * 0.12 }));
  });
  if (i % 2 === 0) {
    P.slats(decor.n, L, 3.0, 4.0, 2.4);
    P.pinboard(decor.n, L, 6.5, 1.6, 0, 0, 0.62, 0.48);
  } else {
    P.pinboard(decor.n, L, 3.5, 1.0, 0, 0, 0.8, 0.6);
    P.print(decor.n, L, 3.5, 1.78, 0, 0, ATLAS.prints[(i * 3 + 2) % 8], 0.36, 0.46, [S.black, S.oak, S.walnut][i % 3]);
    P.slats(decor.n, L, 6.05, 6.95, 2.4);
  }

  // the west wall: a tree in the back corner, a full bookcase, a clock
  const tree = ["fig", "olive", "fig", "monstera", "olive"][i % 5];
  if (tree === "fig") P.figTree(kit, L, 0.45, 0.5, seed, 1.75);
  else if (tree === "olive") P.oliveTree(kit, L, 0.5, 0.5, seed);
  else P.monstera(kit, L, 0.5, 0.55, seed, 1.25);
  atWest(kit, () => {
    P.bookcase(kit, L, -1.85, 0, 0, { w: 1.7, h: 1.95, rows: 5, seed, smoked: i % 3 === 1 });
    kit.at(-1.4, 1.95, 0.16, 0, () => P.pothos(kit, L, 0, 0, 0, seed + 1, 0.9));
  });
  P.clock(decor.w, L, -1.85, 2.35, 0, 0);

  // the signature thing at the front left
  if (signature === "bike") {
    atWest(kit, () => P.bike(kit, L, -3.75, 0.2, 0, ["#8f9a88", S.rust, S.charcoal][v(1, 3)]));
    P.planner(decor.w, L, -3.75, 1.45, 0, 0, 0.9, 0.56);
    P.dogBed(kit, L, 1.35, 4.25, 0.4, ["#c98b4f", "#3a3530", "#e9e2d2"][v(2, 3)]);
  } else if (signature === "records") {
    atWest(kit, () => P.recordCabinet(kit, L, -3.8, 0, 0, seed));
    P.print(decor.w, L, -3.8, 1.55, 0, 0, ATLAS.prints[(i * 3 + 5) % 8], 0.5, 0.36, S.black);
  } else if (signature === "dog") {
    P.dogBed(kit, L, 0.75, 4.15, 0.6, ["#c98b4f", "#3a3530", "#e9e2d2"][v(2, 3)]);
    kit.cyl(0.07, 0.04, S.stone, 1.35, 0, 4.5, { seg: 10 });
    kit.sphere(0.05, S.rust, 1.6, 0.05, 4.1, { detail: 1 });
    P.print(decor.w, L, -3.6, 1.45, 0, 0, ATLAS.prints[(i * 3 + 5) % 8], 0.42, 0.56, S.oak);
  } else if (signature === "guitar") {
    P.guitar(kit, L, 0.45, 4.3, Math.PI / 2 - 0.3);
    kit.rbox(0.42, 0.36, 0.26, "#26292e", 0.4, 0, 3.6, 0.02, { ry: 0.2 });
    kit.box(0.34, 0.24, 0.01, "#4a4a50", 0.4, 0.05, 3.74, { ry: 0.2 });
    P.scroll(decor.w, L, -3.75, 2.3);
  } else {
    K.lights.push({ ...P.readingCorner(kit, glow, L, 0.95, 4.05, Math.PI / 2 + 0.5, [S.mustard, S.rust, S.sage][v(3, 3)]), i: 1.2, r: 2.6 });
    P.print(decor.w, L, -3.9, 1.5, 0, 0, ATLAS.prints[(i * 3 + 5) % 8], 0.42, 0.56, S.walnut);
  }

  // the east side: a floor lamp in the back corner, a snake plant, a print on the wall, a monstera by the door
  K.lights.push({ ...P.floorLamp(kit, glow, L, 6.5, 0.5, "tripod"), i: 1.4, r: 3 });
  P.pool(pools, 6.3, 0.9, 1.1);
  P.snakePlant(kit, L, 6.6, 2.4, seed);
  P.print(decor.e, L, 2.5, 1.4, 0, 0, ATLAS.prints[(i * 3 + 1) % 8], 0.36, 0.48, S.oak);
  P.monstera(kit, L, 6.5, 4.45, seed + 1, 0.8);

  const out = finish(group, K, L, light, opts);
  return { group, ...out, lantern: out.glow, pool: out.pools, wallPoster: null, leanPoster: null, signature };
}

// ---------------------------------------------------------------------------------------------------------------------
// The HQ suite: HQ's desk and the owner's under the windows, facing the room, under dark steel pendants; the studio's
// lit sign over slatted oak on the pier; a workbench with a pegboard and a 3D printer on the west wall; a reading corner
// on linen; a round table under a paper lantern with a whiteboard beside it; an olive tree.
export const SUITE_SPOTS = {
  seat: new THREE.Vector3(1.9, 0, 0.82), faceDesk: 0, stand: new THREE.Vector3(3.0, 0, 1.2), hud: new THREE.Vector3(1.9, 3.0, 1.4),
};

export function buildSuite(room, L, light, opts = {}) {
  const group = frameOf(room);
  group.name = "hq";
  const { w } = localSize(room);
  const S = L.studio;
  const K = kits(w);
  const { kit, decor, lit, glow, pools } = K;

  // two desks under the windows, facing the room
  P.desk(kit, L, 1.9, 1.5, Math.PI, { w: 1.5, d: 0.7, legs: "trestle", smoked: true });
  K.screens.push(P.deskTop(kit, L, 1.9, 1.5, Math.PI, 11, { w: 1.5, d: 0.7 }));
  P.taskChair(kit, L, 1.9, 0.92, 0, S.charcoal);
  P.desk(kit, L, 4.6, 1.5, Math.PI, { w: 1.5, d: 0.7, legs: "trestle", smoked: true });
  K.screens.push(P.deskTop(kit, L, 4.6, 1.5, Math.PI, 6, { w: 1.5, d: 0.7 }));
  P.taskChair(kit, L, 4.6, 0.92, 0.25, S.rust);
  atBack(kit, () => { P.radiator(kit, L, 1.9, 0, 1.3); P.radiator(kit, L, 4.9, 0, 1.3); });
  K.lights.push(P.pendant(kit, glow, L, 1.9, 1.45, { y: 1.75, kind: "cone" }));
  K.lights.push(P.pendant(kit, glow, L, 4.6, 1.45, { y: 1.75, kind: "cone" }));
  P.pool(pools, 1.9, 1.4, 1.3); P.pool(pools, 4.6, 1.4, 1.3);

  // the pier: slatted oak and the lit sign; a hanging scroll in the left corner, a print in the right
  P.slats(decor.n, L, 3.0, 4.0, 2.4);
  P.sign(decor.n, lit.n, L, 3.5, 1.3, 0.86, 0.05);
  P.scroll(decor.n, L, 0.55, 2.35);
  P.print(decor.n, L, 6.5, 1.3, 0, 0, ATLAS.prints[5], 0.36, 0.48, S.walnut);

  // the west wall: the workbench with its pegboard and the 3D printer
  atWest(kit, () => atWest(glow, () => P.workbench(kit, decor.w, glow, L, -1.95, 1.8)));

  // a reading corner on a linen rug
  P.rug(kit, L, ATLAS.rugs.linen, 1.6, 3.7, 2.4, 1.6);
  P.loungeChair(kit, L, 1.25, 3.6, 0.6, S.rust);
  P.lowTable(kit, L, 2.2, 3.85, 0.55, 0.55, S.walnut);
  kit.cyl(0.05, 0.12, S.pots[1], 2.1, 0.34, 3.8, { seg: 8 });
  [S.navy, S.oatmeal].forEach((c, k) => kit.box(0.2, 0.03, 0.15, c, 2.3, 0.34 + k * 0.03, 3.9, { ry: k * 0.3 }));
  K.lights.push({ ...P.floorLamp(kit, glow, L, 0.5, 4.45, "andon"), i: 1.2, r: 2.6 });
  P.pool(pools, 0.7, 4.25, 1.0);

  // a round table under a paper lantern, on a woven mat; a whiteboard on a stand beside it
  P.rug(kit, L, ATLAS.rugs.tatami, 5.4, 3.5, 2.2, 1.8);
  P.roundTable(kit, L, 5.4, 3.5, 0.48);
  P.forkChair(kit, L, 4.75, 3.45, Math.PI / 2 - 0.1);
  P.forkChair(kit, L, 6.05, 3.5, -Math.PI / 2 + 0.1);
  P.forkChair(kit, L, 5.4, 2.85, 0.05, S.walnut);
  kit.box(0.3, 0.01, 0.22, "#f4f1ea", 5.3, DESK_H, 3.5, { ry: 0.3 });
  kit.cyl(0.035, 0.08, S.clay, 5.6, DESK_H, 3.35, { seg: 8 });
  K.lights.push(P.pendant(kit, glow, L, 5.4, 3.5, { y: 1.62, kind: "lantern" }));
  P.pool(pools, 5.4, 3.5, 1.4);
  P.whiteboardStand(kit, L, 6.45, 1.9, -Math.PI / 2 + 0.35);
  P.oliveTree(kit, L, 6.5, 0.48, 2);

  const out = finish(group, K, L, light, opts);
  out.screens[1].material.map = screenTexture("owner", "#8e9bb0");
  return { group, ...out, screen: out.screens[0], shade: null, lantern: out.glow, pool: out.pools, wallPoster: null, leanPoster: null };
}

// ---------------------------------------------------------------------------------------------------------------------
// The break area: the kitchen along the back wall, a long oak table with ash chairs and a bench under paper pendants,
// a raised tatami lounge with tea behind a shoji screen, a tea corner with a scroll, plants and coats. Two shapes: the floor stage's long room (5 m along
// its back wall, 12 m deep, the hall coming in on its west side at z 5..7) and the wings' room (7 × 5, open to the
// hall along its front). `spots` are where done workers stand with a mug, in this room's frame.
export function buildBreak(room, L, light, opts = {}) {
  const group = frameOf(room);
  group.name = "break";
  const { w, d } = localSize(room);
  const S = L.studio;
  const K = kits(w);
  const { kit, decor, glow, pools } = K;
  const spots = [];

  const kitchen = (k0, k1) => {
    atBack(kit, () => {
      P.kitchenRun(kit, L, k0, k1, { sinkX: k1 - 0.75 });
      P.fridge(kit, L, k1 + 0.36, 0, 0.66);
      P.coffeeMachine(kit, L, k0 + 0.35, 0.22);
      P.fruitBowl(kit, L, k1 - 0.3, 0.3);
      for (let k = 0; k < 3; k++) kit.cyl(0.035, 0.08, S.mugs[k + 2], k0 + 0.85 + k * 0.09, P.COUNTER_H, 0.36, { seg: 8 });
    });
    P.openShelves(decor.n, L, (k0 + k1) / 2, Math.min(1.6, k1 - k0 - 0.2), [1.35]);
    for (let x = k0 + 0.6; x < k1 - 0.1 && spots.length < 3; x += 0.85) spots.push({ x, z: 1.15, ry: ((spots.length % 3) - 1) * 0.4 });
  };
  const table = (tx, tz, len) => {
    P.longTable(kit, L, tx, tz, 0, len, 0.82);
    [[S.linen, -0.85], [null, 0], [S.rust, 0.85]].forEach(([pad, dx]) => P.ashChair(kit, L, tx + dx, tz - 0.62, 0, S.oakLight, pad));
    P.bench(kit, L, tx, tz + 0.62, 0, len - 0.4);
    P.vaseBranch(kit, L, tx - 0.25, DESK_H, tz, 4);
    kit.cyl(0.035, 0.08, S.mugs[0], tx + 0.5, DESK_H, tz - 0.15, { seg: 8 });
    kit.box(0.24, 0.012, 0.32, "#f4f1ea", tx + 0.9, DESK_H, tz + 0.05, { ry: -0.2 });
    for (const dx of [-0.6, 0.6]) K.lights.push(P.pendant(kit, glow, L, tx + dx, tz, { y: 2.2, kind: "washi" }));
    for (const dx of [-0.6, 0.6]) P.pool(pools, tx + dx, tz, 1.4);
    spots.push({ x: tx - len / 2 - 0.45, z: tz - 0.2, ry: Math.PI / 2 }, { x: tx + len / 2 + 0.45, z: tz + 0.1, ry: -Math.PI / 2 });
  };
  const coats = (x, z) => {
    kit.cyl(0.02, 1.45, S.oak, x, 0, z, { seg: 6 });
    kit.cyl(0.16, 0.03, S.oak, x, 0, z, { seg: 8 });
    [[S.navy, 0], [S.oatmeal, 2.1], [S.rust, 4.2]].forEach(([c, a]) => kit.rbox(0.22, 0.5, 0.1, c, x + Math.sin(a) * 0.1, 0.85, z + Math.cos(a) * 0.1, 0.04, { ry: a }));
  };

  if (w >= 6.5) {
    // the wings' break room, 7 × 5: the tatami lounge in the back left corner under a window, the tea corner on the
    // pier, the kitchen under the right window, the long table across the front half
    const lantern = P.tatamiLounge(kit, glow, L, 1.4, 1.2, 2.5, 2.2, 1);
    K.lights.push({ ...lantern, i: 1.2, r: 2.6 });
    P.pool(pools, lantern.x, lantern.z, 1.2, P.DAIS_H + 0.01);
    // a shoji screen between the lounge and the tea corner
    P.shojiScreen(kit, L, 2.84, 0.12, -Math.PI / 2, { panels: 3, w: 0.44, fold: 0.3 });
    atBack(kit, () => P.teaCorner(kit, decor.n, L, 3.5, 0.95));
    kitchen(4.2, 6.0);
    table(4.3, 3.65, 2.4);
    spots.push({ x: 2.95, z: 2.2, ry: 0.6 });
    P.monstera(kit, L, 0.55, 4.4, 7, 1.1);
    P.snakePlant(kit, L, 6.65, 1.7, 3);
    coats(6.6, 4.55);
  } else {
    // the floor stage's long break room: the kitchen along the back wall, the long table, then (past the hall's
    // opening on the west) the tatami lounge, the tea corner on the east wall and a sofa corner at the front
    kitchen(0.35, Math.min(w - 0.85, 3.95));
    table(w / 2, 3.1, 2.6);
    P.figTree(kit, L, 0.45, 4.45, 5, 1.8);
    // a shoji screen by the hall's opening, a monstera past it
    P.shojiScreen(kit, L, 0.3, 7.3, -Math.PI / 2, { panels: 3, w: 0.44, fold: 0.3 });
    P.monstera(kit, L, 0.55, 9.6, 7, 1.0);
    P.snakePlant(kit, L, w - 0.4, 5.2, 3);
    spots.push({ x: 1.6, z: 6.0, ry: 0.4 }, { x: 3.2, z: 5.6, ry: -0.5 });
    const lantern = P.tatamiLounge(kit, glow, L, w - 1.4, 8.3, 2.5, 2.2, 1);
    K.lights.push({ ...lantern, i: 1.2, r: 2.6 });
    P.pool(pools, lantern.x, lantern.z, 1.2, P.DAIS_H + 0.01);
    spots.push({ x: 1.2, z: 8.6, ry: Math.PI / 2 });
    if (d >= 11) {
      atEast(kit, w, () => P.teaCorner(kit, decor.e, L, 10.3, 1.1));
      kit.at(1.7, 0, d - 0.65, Math.PI, () => {
        P.rug(kit, L, ATLAS.rugs.rust, 0, 0.7, 2.5, 1.6);
        P.sofa(kit, L, 0, 0, 0, { w: 2.0 });
        P.lowTable(kit, L, 0, 1.0, 0.9, 0.48);
        kit.cyl(0.04, 0.08, S.mugs[1], -0.2, 0.34, 0.95, { seg: 8 });
        P.smallPlant(kit, L, 0.25, 0.34, 1.03, 2);
      });
      K.lights.push({ ...P.floorLamp(kit, glow, L, 0.45, d - 0.45, "tripod"), i: 1.4, r: 3 });
      P.pool(pools, 0.7, d - 0.7, 1.2);
      coats(w - 0.35, d - 0.4);
      spots.push({ x: 3.4, z: d - 1.6, ry: -0.8 });
    }
  }

  const out = finish(group, K, L, light, opts);
  return { group, ...out, lantern: out.glow, pool: out.pools, wallPoster: null, leanPoster: null, spots };
}

// A court between wings: raked gravel round a maple and a stone lantern, a few stones, stepping stones and a bench.
// glow takes the lantern's paper.
export function scatterCourt(kit, c, L, i, glow = null) {
  const y = -0.12;
  const tx = c.x + c.w * (0.3 + ((i * 37) % 40) / 100), tz = c.z + c.d / 2;
  maple(kit, tx, tz, 0.9, i + 1, y);
  stoneLantern(kit, glow ?? kit, tx - 1.3, tz - 0.6, 0.7, y);
  for (let k = 0; k < 3; k++) kit.sphere(0.18 + k * 0.06, "#8f8a80", tx + 1.4 + k * 0.5, y + 0.02, tz + 0.6 - k * 0.4, { sy: 0.5, ry: k });
  for (let k = 0; k < 5; k++) kit.cyl(0.22, 0.03, "#b8b2a6", c.x + 1 + k * 0.9, y, c.z + c.d - 0.9 + Math.sin(k) * 0.2, { seg: 7 });
  kit.box(1.2, 0.05, 0.36, L.studio.oak, tx + 3.2, y + 0.38, tz + 0.2);
  for (const t of [-1, 1]) kit.box(0.06, 0.38, 0.3, L.steel, tx + 3.2 + t * 0.5, y, tz + 0.2);
}
