// The architecture: ground, courts, floors, walls with the Sims cutaway (recomputed per rotation), door gaps, windows, caps.
import { THREE, Kit, roomMaterial } from "./kit.js";
import { WALL_H, KERB_H, wallCuts, toWorld } from "./plan.js";
import { surface, wallpaper, cladding } from "./textures.js";
import { scatterCourt, scatterLot } from "./furniture.js";

const T = 0.15;          // wall thickness
const HALF = T / 2;
const DOOR_TOP = 2.1;
const SILL = 0.95, HEAD = 2.25;
const SLAB = 0.12;       // the floor slab stands this far above the ground

// The base of a wall is darker (a baked contact shadow). The two wall directions already differ in tone because the
// key light comes from the front left: faces toward +z catch it, faces toward +x do not.
const wallShade = (n, v) => (v.y < 0.05 ? 0.8 : 1);

// One wall tile from y0 to y1. An outer wall is two halves: the room's side (into `kit`) and the cladding outside
// (into `out`), so the cut walls along the front show the building's outside, as in the reference.
function segBox(kit, w, y0, y1, hex, out = null, extend = HALF) {
  const len = 1 + extend * 2;
  const outside = out && (!w.a || !w.b) ? (!w.a ? -1 : 1) : 0;
  if (!outside) {
    if (w.dir === "x") kit.box(len, y1 - y0, T, hex, w.x + 0.5, y0, w.z);
    else kit.box(T, y1 - y0, len, hex, w.x, y0, w.z + 0.5);
    return;
  }
  const q = T / 4;
  if (w.dir === "x") {
    kit.box(len, y1 - y0, T / 2, hex, w.x + 0.5, y0, w.z - outside * q);
    out.box(len, y1 - y0, T / 2, "#ffffff", w.x + 0.5, y0, w.z + outside * q);
  } else {
    kit.box(T / 2, y1 - y0, len, hex, w.x - outside * q, y0, w.z + 0.5);
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
    const spots = r.kind === "office" ? [4.5] : r.kind === "hq" ? [1.5, 5.5] : [1.5, 3.5];
    for (const lx of spots) {
      const p0 = toWorld(r, lx, 0);
      const back = r.back ?? "n";
      if (back === "n" || back === "s") keys.add(`x:${Math.floor(p0.x)}:${Math.round(p0.z)}`);
      else keys.add(`z:${Math.round(p0.x)}:${Math.floor(p0.z)}`);
    }
  }
  return keys;
}

export function buildRooms(p, L, lightOf) {
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
    const m = keep(roomMaterial({ map: surface(L.ground) }));
    const mesh = kit.mesh(m, { uv: true, cast: false });
    group.add(mesh);
  }
  {
    const lot = new Kit();
    scatterLot(lot, p.bounds, L);
    group.add(lot.mesh(keep(roomMaterial())));
  }
  const courts = p.rooms.filter((r) => r.kind === "court");
  if (courts.length) {
    const kit = new Kit();
    for (const c of courts) kit.plane(c.w - 0.6, c.d - 0.6, "#ffffff", c.x + c.w / 2, -SLAB + 0.01, c.z + c.d / 2);
    const mesh = kit.mesh(keep(roomMaterial({ map: surface(L.court) })), { uv: true, cast: false });
    group.add(mesh);
    const deco = new Kit();
    courts.forEach((c, i) => scatterCourt(deco, c, L, i));
    if (!deco.empty) group.add(deco.mesh(keep(roomMaterial())));
  }

  // Floor slabs and floors, one per room, each lit by its room
  const slab = new Kit();
  for (const r of p.rooms) {
    if (r.kind === "court") continue;
    slab.box(r.w + T, SLAB, r.d + T, L.plinth, r.x + r.w / 2, -SLAB, r.z + r.d / 2);
  }
  group.add(slab.mesh(keep(roomMaterial()), { cast: false }));
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
  const wallMat = keep(roomMaterial({ map: wallpaper(L.wall) }));
  const capMat = keep(roomMaterial());
  const cladMat = keep(roomMaterial({ map: cladding(L.cladding) }));
  const glassMat = keep(new THREE.MeshBasicMaterial({ color: L.night ? "#1d2a44" : "#cfe3ee" }));
  const frameHex = L.id === "b" ? L.steel : L.woodEdge;
  const windows = windowKeys(p);
  {
    const kit = new Kit(), out = new Kit();
    for (const w of p.walls) if (!w.door) segBox(kit, w, 0, KERB_H, "#ffffff", out);
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
      } else if (outside && windows.has(`${w.dir}:${w.x}:${w.z}`)) {
        segBox(up, w, KERB_H, SILL, "#ffffff", out);
        segBox(up, w, HEAD, WALL_H, "#ffffff", out);
        // the pane, set back into the wall, with a frame
        const gw = 0.78, gh = HEAD - SILL;
        if (w.dir === "x") {
          glass.box(gw, gh, 0.02, "#ffffff", w.x + 0.5, SILL, w.z);
          for (const dx of [-0.5 + 0.06, 0.5 - 0.06]) up.box(0.12, gh, T, frameHex, w.x + 0.5 + dx, SILL, w.z, { shade: () => 1 });
          up.box(gw, 0.04, T + 0.04, frameHex, w.x + 0.5, SILL, w.z, { shade: () => 1 });
          up.box(0.03, gh, T * 0.6, frameHex, w.x + 0.5, SILL, w.z, { shade: () => 1 });
        } else {
          glass.box(0.02, gh, gw, "#ffffff", w.x, SILL, w.z + 0.5);
          for (const dz of [-0.5 + 0.06, 0.5 - 0.06]) up.box(T, gh, 0.12, frameHex, w.x, SILL, w.z + 0.5 + dz, { shade: () => 1 });
          up.box(T + 0.04, 0.04, gw, frameHex, w.x, SILL, w.z + 0.5, { shade: () => 1 });
          up.box(T * 0.6, gh, 0.03, frameHex, w.x, SILL, w.z + 0.5, { shade: () => 1 });
        }
      } else {
        segBox(up, w, KERB_H, WALL_H, "#ffffff", out);
      }
      capBox(caps, w, WALL_H, L.cap);
    });
    if (!up.empty) g.add(up.mesh(wallMat, { uv: true, shade: wallShade }));
    if (!out.empty) g.add(out.mesh(cladMat, { uv: true, shade: wallShade }));
    if (!caps.empty) g.add(caps.mesh(capMat, { cast: false }));
    if (!glass.empty) g.add(glass.mesh(glassMat, { cast: false }));
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
    return current.userData.cuts;
  };

  const dispose = () => {
    group.traverse((o) => o.geometry?.dispose());
    for (const g of perRot.values()) g.traverse((o) => o.geometry?.dispose());
    for (const m of disposables) m.dispose?.();
  };

  return { group, setRotation, dispose };
}
