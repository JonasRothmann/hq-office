// The architecture: ground, courts, floors, walls with the Sims cutaway (recomputed per rotation), door gaps, windows, caps.
import { THREE, Kit, roomMaterial, roomsMaterial } from "./kit.js";
import { WALL_H, KERB_H, wallCuts, toWorld } from "./plan.js";
import { surface, wallpaper, cladding, glass as glassTexture, glow as glowTexture } from "./textures.js";
import { scatterCourt } from "./furniture.js";
import { garden } from "./garden.js";

const T = 0.15;          // wall thickness
const HALF = T / 2;
const DOOR_TOP = 2.1;
const SILL = 0.8, HEAD = 2.45;
const SLAB = 0.12;       // the floor slab stands this far above the ground
const OAK = "#cfae80", FRAME = "#2a2a2c";

// The base of a wall is darker (a baked contact shadow). The two wall directions already differ in tone because the
// key light comes from the front left: faces toward +z catch it, faces toward +x do not.
const wallShade = (n, v) => (v.y < 0.05 ? 0.8 : 1);

// One wall tile from y0 to y1. An outer wall is two halves: the room's side (into `kit`) and the cladding outside
// (into `out`), so the cut walls along the front show the building's outside, as in the reference.
function segBox(kit, w, y0, y1, hex, out = null, extend = HALF) {
  const len = 1 + extend * 2;
  const room = w.light;
  const outside = out && (!w.a || !w.b) ? (!w.a ? -1 : 1) : 0;
  if (!outside) {
    if (w.dir === "x") kit.box(len, y1 - y0, T, hex, w.x + 0.5, y0, w.z, { room });
    else kit.box(T, y1 - y0, len, hex, w.x, y0, w.z + 0.5, { room });
    return;
  }
  const q = T / 4;
  if (w.dir === "x") {
    kit.box(len, y1 - y0, T / 2, hex, w.x + 0.5, y0, w.z - outside * q, { room });
    out.box(len, y1 - y0, T / 2, "#ffffff", w.x + 0.5, y0, w.z + outside * q);
  } else {
    kit.box(T / 2, y1 - y0, len, hex, w.x - outside * q, y0, w.z + 0.5, { room });
    out.box(T / 2, y1 - y0, len, "#ffffff", w.x + outside * q, y0, w.z + 0.5);
  }
}

function capBox(kit, w, y, hex) {
  const len = 1 + T + 0.02;
  if (w.dir === "x") kit.box(len, 0.035, T + 0.03, hex, w.x + 0.5, y, w.z);
  else kit.box(T + 0.03, 0.035, len, hex, w.x, y, w.z + 0.5);
}

// The office back-wall tile that gets a window (local x 3..4), when that wall faces outdoors.
function windowKeys(p) {
  const keys = new Set();
  for (const r of p.rooms) {
    if (r.kind !== "office" && r.kind !== "hq" && r.kind !== "break") continue;
    // a room may say which back-wall tiles are windows (r.windows); adjacent ones join into one wide window
    const spots = r.windows ? r.windows.map((i) => i + 0.5) : r.kind === "office" ? [4.5] : r.kind === "hq" ? [1.5, 5.5] : [1.5, 3.5];
    for (const lx of spots) {
      const p0 = toWorld(r, lx, 0);
      const back = r.back ?? "n";
      if (back === "n" || back === "s") keys.add(`x:${Math.floor(p0.x)}:${Math.round(p0.z)}`);
      else keys.add(`z:${Math.round(p0.x)}:${Math.floor(p0.z)}`);
    }
  }
  return keys;
}

// lightOf(id): a room's light uniform; rooms: { value: Color[] } with indexOf(id) giving each room's slot in it;
// outdoor: the light uniform of everything outside (the moon at night).
export function buildRooms(p, L, lightOf, rooms, indexOf, outdoor) {
  const group = new THREE.Group();
  group.name = "rooms";
  const disposables = [];
  const keep = (o) => { disposables.push(o); return o; };

  // Ground and courts
  const { minX, minZ, maxX, maxZ } = p.bounds;
  const pad = 60;
  {
    const kit = new Kit();
    kit.plane(maxX - minX + pad * 2, maxZ - minZ + pad * 2, "#ffffff", (minX + maxX) / 2, -SLAB, (minZ + maxZ) / 2);
    const m = keep(roomMaterial({ map: surface(L.ground), room: outdoor }));
    const mesh = kit.mesh(m, { uv: true, cast: false });
    group.add(mesh);
  }
  let gardenGlow = null;
  // the garden's tree rows, each with the outer walls it stands behind: a row whose walls are cut is on the camera's
  // side of the building and would hide the rooms, so it is left out of that view
  const treeRows = [];
  const outerWalls = (side) => p.walls.flatMap((w, i) => ((!w.a || !w.b) && (side === "n" ? w.dir === "x" && w.z === p.bounds.minZ : w.dir === "z" && w.x === p.bounds.minX) ? [i] : []));
  {
    const lot = new Kit(), lamps = new Kit(), pools = new Kit(), trees = { n: new Kit(), w: new Kit() };
    garden(lot, lamps, p, L, SLAB, pools, trees);
    const lotMat = keep(roomMaterial({ room: outdoor }));
    group.add(lot.mesh(lotMat));
    for (const side of ["n", "w"]) {
      if (trees[side].empty) continue;
      const mesh = trees[side].mesh(lotMat);
      group.add(mesh);
      treeRows.push({ mesh, walls: outerWalls(side) });
    }
    if (L.night && !pools.empty) {
      const m = new THREE.Mesh(pools.geometry({ ownUv: true }), keep(new THREE.MeshBasicMaterial({ map: glowTexture("rgba(255,205,140,0.45)"), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })));
      m.renderOrder = 1;
      group.add(m);
    }
    if (!lamps.empty) {
      gardenGlow = lamps.mesh(keep(new THREE.MeshBasicMaterial({ vertexColors: true, color: L.night ? "#ffe0a8" : "#ffffff" })), { cast: false, receive: false });
      gardenGlow.name = "garden-lamps";
      group.add(gardenGlow);
    }
  }
  const courts = p.rooms.filter((r) => r.kind === "court");
  if (courts.length) {
    const kit = new Kit();
    for (const c of courts) kit.plane(c.w - 0.6, c.d - 0.6, "#ffffff", c.x + c.w / 2, -SLAB + 0.01, c.z + c.d / 2);
    const mesh = kit.mesh(keep(roomMaterial({ map: surface(L.court), room: outdoor })), { uv: true, cast: false });
    group.add(mesh);
    const deco = new Kit();
    courts.forEach((c, i) => scatterCourt(deco, c, L, i));
    if (!deco.empty) group.add(deco.mesh(keep(roomMaterial({ room: outdoor }))));
  }

  // Floor slabs and floors, one per room, each lit by its room
  const slab = new Kit();
  for (const r of p.rooms) {
    if (r.kind === "court") continue;
    slab.box(r.w + T, SLAB, r.d + T, L.plinth, r.x + r.w / 2, -SLAB, r.z + r.d / 2);
  }
  group.add(slab.mesh(keep(roomMaterial({ room: outdoor })), { cast: false }));
  for (const r of p.rooms) {
    if (r.kind === "court") continue;
    const spec = L.floor[r.kind] ?? L.floor.corridor;
    const kit = new Kit();
    kit.plane(r.w, r.d, "#ffffff", r.x + r.w / 2, 0.001, r.z + r.d / 2);
    const mesh = kit.mesh(keep(roomMaterial({ map: surface(spec), room: lightOf(r.id) })), { uv: true, cast: false });
    mesh.name = `floor:${r.id}`;
    group.add(mesh);
  }

  // Walls: kerbs always; per rotation, the full walls (uppers, windows, lintels) and the caps
  const wallMat = keep(roomsMaterial({ map: wallpaper(L.wall), rooms }));
  // which room's light each face of a wall gets: the room on the side its normal points to
  for (const w of p.walls) {
    const ia = w.a ? indexOf(w.a) : 0, ib = w.b ? indexOf(w.b) : 0;
    w.light = (n) => {
      const s = w.dir === "x" ? n.z : n.x;
      if (s < -0.5) return ia;
      if (s > 0.5) return ib;
      return Math.max(ia, ib);
    };
  }
  const capMat = keep(roomMaterial());
  const cladMat = keep(roomMaterial({ map: cladding(L.cladding), room: outdoor }));
  const glassMat = keep(new THREE.MeshBasicMaterial({ map: L.night ? null : glassTexture(), color: L.night ? "#22304c" : "#ffffff" }));
  const windows = windowKeys(p);
  const doors = new Set(p.walls.filter((w) => w.door).map((w) => `${w.dir}:${w.x}:${w.z}`));
  const keyOf = (w, k = 0) => (w.dir === "x" ? `x:${w.x + k}:${w.z}` : `z:${w.x}:${w.z + k}`);
  // a strip on the room side(s) of a wall tile: skirting, a window board. y0 its bottom, h tall, `out` deep.
  const trim = (kit, w, y0, h, out, hex) => {
    for (const s of [-1, 1]) {
      if (!(s < 0 ? w.a : w.b)) continue;
      const off = s * (HALF + out / 2);
      if (w.dir === "x") kit.box(1 + T, h, out, hex, w.x + 0.5, y0, w.z + off, { room: w.light });
      else kit.box(out, h, 1 + T, hex, w.x + off, y0, w.z + 0.5, { room: w.light });
    }
  };
  // a box across the wall's thickness at `at` (0..1 along the tile): a jamb, a frame post, a mullion
  const across = (kit, w, at, y0, h, width, depth, hex) => {
    if (w.dir === "x") kit.box(width, h, depth, hex, w.x + at, y0, w.z, { room: w.light });
    else kit.box(depth, h, width, hex, w.x, y0, w.z + at, { room: w.light });
  };
  {
    const kit = new Kit(), out = new Kit();
    for (const w of p.walls) if (!w.door) { segBox(kit, w, 0, KERB_H, "#ffffff", out); trim(kit, w, 0, 0.075, 0.018, OAK); }
    group.add(kit.mesh(wallMat, { uv: true, shade: wallShade }));
    if (!out.empty) group.add(out.mesh(cladMat, { uv: true, shade: wallShade }));
  }
  const perRot = new Map();
  const build = (rot) => {
    const cuts = wallCuts(p, rot);
    const g = new THREE.Group();
    const up = new Kit(), caps = new Kit(), glass = new Kit(), out = new Kit();
    p.walls.forEach((w, i) => {
      const cut = cuts[i];
      if (cut) { if (!w.door) capBox(caps, w, KERB_H, L.cap); return; }
      const outside = !w.a || !w.b;
      if (w.door) {
        segBox(up, w, DOOR_TOP, WALL_H, "#ffffff", out);
        // an oak frame round the opening: jambs where the opening ends, a head across
        if (!doors.has(keyOf(w, -1))) across(up, w, 0.03, 0, DOOR_TOP, 0.06, T + 0.05, OAK);
        if (!doors.has(keyOf(w, 1))) across(up, w, 0.97, 0, DOOR_TOP, 0.06, T + 0.05, OAK);
        across(up, w, 0.5, DOOR_TOP - 0.06, 0.07, 1.0, T + 0.05, OAK);
      } else if (outside && windows.has(`${w.dir}:${w.x}:${w.z}`)) {
        segBox(up, w, KERB_H, SILL, "#ffffff", out);
        segBox(up, w, HEAD, WALL_H, "#ffffff", out);
        // a tall pane in a thin black frame; next to another window tile, the two join into one with a mullion
        const gh = HEAD - SILL;
        const prev = windows.has(keyOf(w, -1)), next = windows.has(keyOf(w, 1));
        if (w.dir === "x") glass.box(1, gh, 0.02, "#ffffff", w.x + 0.5, SILL, w.z);
        else glass.box(0.02, gh, 1, "#ffffff", w.x, SILL, w.z + 0.5);
        across(up, w, 0.035, SILL, gh, prev ? 0.035 : 0.07, prev ? T * 0.5 : T, FRAME);
        across(up, w, 0.965, SILL, gh, next ? 0.035 : 0.07, next ? T * 0.5 : T, FRAME);
        across(up, w, 0.5, SILL, gh, 0.02, T * 0.4, FRAME);
        across(up, w, 0.5, SILL + gh * 0.72, 0.025, 1.0, T * 0.4, FRAME);
        across(up, w, 0.5, HEAD - 0.04, 0.04, 1.0, T * 0.7, FRAME);
        across(up, w, 0.5, SILL, 0.04, 1.0, T * 0.7, FRAME);
        // a deep oak board inside, under the pane
        trim(up, w, SILL - 0.035, 0.035, 0.11, OAK);
      } else {
        segBox(up, w, KERB_H, WALL_H, "#ffffff", out);
      }
      capBox(caps, w, WALL_H, L.cap);
    });
    if (!up.empty) g.add(up.mesh(wallMat, { uv: true, shade: wallShade }));
    if (!out.empty) g.add(out.mesh(cladMat, { uv: true, shade: wallShade }));
    if (!caps.empty) g.add(caps.mesh(capMat, { cast: false }));
    if (!glass.empty) g.add(glass.mesh(glassMat, { cast: false, uv: true }));
    g.userData.cuts = cuts;
    return g;
  };

  let current = null;
  const setRotation = (rot) => {
    const r = ((rot % 4) + 4) % 4;
    if (!perRot.has(r)) perRot.set(r, build(r));
    if (current) group.remove(current);
    current = perRot.get(r);
    group.add(current);
    const cuts = current.userData.cuts;
    for (const row of treeRows) row.mesh.visible = !(row.walls.length && row.walls.filter((i) => cuts[i]).length * 2 > row.walls.length);
    return cuts;
  };

  // The walls above the kerbs, squashed toward the floor (1 = full height): the world lowers them during a turn.
  const setWallScale = (s) => { if (current) current.scale.y = s; };

  const dispose = () => {
    group.traverse((o) => o.geometry?.dispose());
    for (const g of perRot.values()) g.traverse((o) => o.geometry?.dispose());
    for (const m of disposables) m.dispose?.();
  };

  return { group, setRotation, setWallScale, dispose };
}
