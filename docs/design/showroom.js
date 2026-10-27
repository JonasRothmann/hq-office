// The showroom: one team room (four desks), the HQ suite and the break area side by side in the garden, with people in
// every pose, for judging the office's look in the world lab (docs/design/world-lab.html?scene=showroom). It builds
// its own small plan and uses the same rooms, furniture, people and lights as the world, plus real lamps at night.
import { THREE, roomLight, MAX_ROOMS } from "/src/client/world/kit.js";
import { tileMap, deskPlace } from "/src/client/world/plan.js";
import { lookFor, STATUS } from "/src/client/world/look.js";
import { View } from "/src/client/world/camera.js";
import { createScene } from "/src/client/world/scene.js";
import { buildRooms } from "/src/client/world/rooms.js";
import { buildDesk, buildTeamRoom, buildSuite, buildBreak, DESK_SPOTS, SUITE_SPOTS } from "/src/client/world/furniture.js";
import { Worker } from "/src/client/world/people.js";
import { screen as screenTexture } from "/src/client/world/textures.js";
import { runFrame } from "/src/client/world/api.js";

const INDOOR = new Set(["team", "hq", "corridor", "break"]);
const WARM = new THREE.Color(1.0, 0.8, 0.55);

// Three 7 × 5 m rooms in a row (?room=N picks the team room's place in the order, so its variations show), doors
// between them and a front door from the break area.
export function showroomPlan(index = 0) {
  const rooms = [
    { id: `room:${index}`, kind: "team", index, x: 0, z: 0, w: 7, d: 5, back: "n", doors: [{ side: "e", at: 3, width: 1 }] },
    { id: "hq", kind: "hq", x: 7, z: 0, w: 7, d: 5, back: "n", doors: [{ side: "e", at: 3, width: 1 }] },
    { id: "break", kind: "break", x: 14, z: 0, w: 7, d: 5, back: "n", doors: [{ side: "s", at: 5, width: 1 }] },
  ];
  const tiles = tileMap(rooms);
  const key = (x, z) => `${x},${z}`;
  const onDoor = (r, dir, x, z) => (r?.doors ?? []).some((d) => {
    if (dir === "x" && (d.side === "n" || d.side === "s")) return z === (d.side === "n" ? r.z : r.z + r.d) && x >= r.x + d.at && x < r.x + d.at + d.width;
    if (dir === "z" && (d.side === "w" || d.side === "e")) return x === (d.side === "w" ? r.x : r.x + r.w) && z >= r.z + d.at && z < r.z + d.at + d.width;
    return false;
  });
  const walls = [];
  const bounds = { minX: 0, minZ: 0, maxX: 21, maxZ: 5 };
  const consider = (dir, x, z, a, b) => {
    const ia = a && INDOOR.has(a.kind), ib = b && INDOOR.has(b.kind);
    if ((!ia && !ib) || a === b) return;
    walls.push({ dir, x, z, a: ia ? a.id : null, b: ib ? b.id : null, door: onDoor(a, dir, x, z) || onDoor(b, dir, x, z) });
  };
  for (let x = bounds.minX; x <= bounds.maxX; x++) for (let z = bounds.minZ; z < bounds.maxZ; z++) consider("z", x, z, tiles.get(key(x - 1, z)), tiles.get(key(x, z)));
  for (let z = bounds.minZ; z <= bounds.maxZ; z++) for (let x = bounds.minX; x < bounds.maxX; x++) consider("x", x, z, tiles.get(key(x, z - 1)), tiles.get(key(x, z)));
  return { rooms, walls, bounds, tiles, teamRooms: [rooms[0]], hq: rooms[1], stageName: "showroom" };
}

// Who is in the showroom and what they are doing.
const CAST = {
  team: [["kite", "moving"], ["linden", "needs_you"], ["pine", "waiting"], ["harbor", "moving"]],
  hq: ["hq", "moving"],
  breakStand: [["juniper", "done", 0], ["delta", "done", 3]],
};

export function mountShowroom(canvas, opts = {}) {
  const sc = createScene(canvas, { fps: 30 });
  const view = new View();
  if (opts.insets) view.setInsets(opts.insets);
  const L = lookFor(opts.theme === "dark" ? "dark" : "light");
  const p = showroomPlan(opts.room ?? 0);

  const roomArray = { value: Array.from({ length: MAX_ROOMS }, () => new THREE.Color(0, 0, 0)) };
  const slots = new Map(), lights = new Map();
  const indexOf = (id) => { if (!slots.has(id)) slots.set(id, Math.min(MAX_ROOMS - 1, slots.size + 1)); return slots.get(id); };
  const lightOf = (id) => {
    if (!lights.has(id)) { const u = roomLight(); u.value = roomArray.value[indexOf(id)]; lights.set(id, u); }
    return lights.get(id);
  };
  const outdoor = roomLight();
  outdoor.value.set(L.moon ?? "#000000");
  for (const r of p.rooms) lightOf(r.id);

  const root = new THREE.Group();
  const rooms = buildRooms(p, L, lightOf, roomArray, indexOf, outdoor);
  root.add(rooms.group);
  const [teamRoom, hqRoom, breakRoom] = p.rooms;
  const team = buildTeamRoom(teamRoom, L, lightOf(teamRoom.id), { lamps: true });
  const suite = buildSuite(hqRoom, L, lightOf(hqRoom.id), { lamps: true });
  const lounge = buildBreak(breakRoom, L, lightOf(breakRoom.id), { lamps: true });
  team.room = teamRoom; suite.room = hqRoom; lounge.room = breakRoom;
  const built = [team, suite, lounge];
  for (const b of built) root.add(b.group);
  sc.scene.add(root);
  sc.setLights(L, p.bounds);

  // light: each room's lamps by night, the screens by status
  for (const b of built) {
    if (b.glow) b.glow.material.color.set(L.night ? "#ffe0a8" : "#ffffff");
    lightOf(b.room.id).value.copy(WARM).multiplyScalar(L.night ? 0.4 : 0);
  }
  const workers = [];
  const screenFor = (mesh, status) => {
    const c = status === "stale" || status === "parked" ? null : STATUS[status];
    mesh.material.map = screenTexture(c ? status : "off", c);
    mesh.material.needsUpdate = true;
  };
  CAST.team.forEach(([name, status], seat) => {
    const at = deskPlace(teamRoom, seat);
    const d = buildDesk(name, at.out, L, lightOf(teamRoom.id));
    d.group.position.set(at.x, 0, at.z);
    d.group.rotation.y = at.ry;
    root.add(d.group);
    screenFor(d.screen, status);
    if (L.night) d.pool.visible = true;
    const w = new Worker(name, L, lightOf(teamRoom.id));
    d.group.add(w.root);
    w.place({ seat: DESK_SPOTS.seat, stand: d.stand, faceDesk: Math.PI });
    w.setStatus(status, status === "needs_you" ? 1 : 0);
    workers.push({ w, group: d.group });
  });
  {
    const [name, status] = CAST.hq;
    const w = new Worker(name, L, lightOf(hqRoom.id));
    suite.group.add(w.root);
    w.place({ seat: SUITE_SPOTS.seat, stand: SUITE_SPOTS.stand, faceDesk: SUITE_SPOTS.faceDesk });
    w.setStatus(status);
    screenFor(suite.screens[0], status);
    workers.push({ w, group: suite.group });
  }
  for (const [name, status, spot] of CAST.breakStand) {
    const w = new Worker(name, L, lightOf(breakRoom.id));
    lounge.group.add(w.root);
    w.setStatus(status);
    const s = lounge.spots[spot];
    w.standAt(s.x, s.z, s.ry);
    workers.push({ w, group: lounge.group });
  }

  // the cutaway, and what hangs on a wall that is now cut
  function applyCuts() {
    const cuts = rooms.setRotation(view.rotation);
    const idx = new Map(p.walls.map((w, i) => [`${w.dir}:${w.x}:${w.z}`, i]));
    for (const b of built) {
      const r = b.room;
      const side = { n: [`x`, (x) => `x:${x}:${r.z}`, r.x, r.w], w: [`z`, (z) => `z:${r.x}:${z}`, r.z, r.d], e: [`z`, (z) => `z:${r.x + r.w}:${z}`, r.z, r.d] };
      for (const dec of b.decor) {
        const [, k, a0, n] = side[dec.side];
        let up = 0, all = 0;
        for (let t = a0; t < a0 + n; t++) { const i = idx.get(k(t)); if (i === undefined) continue; all++; if (!cuts[i]) up++; }
        dec.mesh.visible = all > 0 && up > all / 2;
      }
    }
  }

  function resize() {
    const w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight;
    sc.resize(w, h);
    view.resize(w, h);
  }
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();
  view.fit({ minX: p.bounds.minX - 1, minZ: p.bounds.minZ - 2, maxX: p.bounds.maxX + 1, maxZ: p.bounds.maxZ + 3 }, true);
  applyCuts();

  sc.start((now, dt) => {
    view.update(dt);
    const t = now / 1000;
    for (const { w, group } of workers) w.update(t, dt, view.az - group.rotation.y);
    runFrame(now, dt);
    sc.renderer.render(sc.scene, view.camera);
  });

  return {
    get view() { return view; },
    get renderer() { return sc.renderer; },
    get plan() { return p; },
    rotate(dir) { view.rotate(dir); applyCuts(); },
    zoom(level) { view.zoom(level); },
    focus(x, z) { view.focus(x, z, true); },
    fit() { view.fit(p.bounds); },
    inspect() { const r = sc.renderer.info.render; return { calls: r.calls, triangles: r.triangles, signature: team.signature, workers: workers.map(({ w }) => ({ name: w.name, pose: w.pose, look: w.look })) }; },
    dispose() { sc.stop(); ro.disconnect(); sc.renderer.dispose(); },
  };
}
