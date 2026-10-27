// The lot: a world doc checked against its catalog and worked out (tiles, wall edges with their openings, rooms,
// placed objects with their tiles and slots in world space). analyse() returns the lot and every problem; buildLot
// throws when there is an error; validateWorld returns the problems. Pure.
import { tileKey, sideEdge, parseEdge, edgeTiles, edgeBetween, pathEdges, QUARTER, SIDES, turn, turnSide, FLOOR_Y } from "./grid.js";
import { detectRooms } from "./rooms.js";
import { problem, WorldError, errorsOf } from "./problems.js";
import { createCatalog, suggest } from "../catalog/define.js";
import { createNav } from "../nav/nav.js";
import { planAct } from "../nav/act.js";

const isInt = (n) => Number.isInteger(n);
const tileText = ([x, z]) => `(${x},${z})`;

/**
 * @typedef {object} Placed
 * @property {string} id
 * @property {string} type
 * @property {object} def
 * @property {"n"|"e"|"s"|"w"} facing
 * @property {number} q                 quarter turns
 * @property {[number, number][]} tiles
 * @property {[number, number, number]} pos   the footprint's centre, on the floor
 * @property {Record<string, { at: [number, number], y: number, facing: string, stand: [number, number][], clip: string }>} slots
 */

/**
 * @typedef {object} Lot
 * @property {number} w
 * @property {number} d
 * @property {Map<string, string>} floor        tile → floor finish id
 * @property {Map<string, { key: string, axis: string, x: number, z: number, finish: string, outside: string, opening?: { type: string, def: object } }>} walls
 * @property {import("./rooms.js").Room[]} rooms
 * @property {Map<string, string>} roomAt       tile → room id or "outside"
 * @property {Placed[]} objects
 * @property {Set<string>} blocked
 * @property {{ id: string, tile: [number, number], facing: string, look: object }[]} characters
 */

/** @returns {{ lot: Lot|null, problems: import("./problems.js").Problem[], catalog: object }} */
export function analyse(world) {
  const { doc } = world;
  const catalog = createCatalog(world.packs ?? []);
  const P = [...catalog.problems];
  if (doc.format !== 1) P.push(problem("world.format", "format", `format ${doc.format} is not one this engine reads`, "set format: 1"));
  const missing = (doc.packs ?? []).filter((id) => !(world.packs ?? []).some((p) => p.id === id));
  for (const id of missing) P.push(problem("world.pack", "packs", `pack '${id}' is named but not given`, `import the pack and pass it in defineWorld({ packs: [...] })`));
  const { w, d } = doc.lot ?? {};
  if (!isInt(w) || !isInt(d) || w < 2 || d < 2 || w > 128 || d > 128) {
    P.push(problem("lot.size", "lot", `lot ${JSON.stringify(doc.lot)} is not 2..128 whole tiles each way`, "set lot: { w: 16, d: 12 }"));
    return { lot: null, problems: P, catalog };
  }
  const inLot = (x, z) => x >= 0 && z >= 0 && x < w && z < d;

  // floors
  const floor = new Map();
  doc.floors.forEach((f, i) => {
    const [x, z, fw, fd] = f.rect ?? [];
    if (![x, z, fw, fd].every(isInt) || fw < 1 || fd < 1 || x < 0 || z < 0 || x + fw > w || z + fd > d) {
      P.push(problem("floor.rect", `floors[${i}].rect`, `rect ${JSON.stringify(f.rect)} is not whole tiles inside the ${w}×${d} lot`, `rect is [x, z, w, d] with x + w <= ${w} and z + d <= ${d}`));
      return;
    }
    const def = catalog.get(f.finish);
    if (!def || def.kind !== "floor") P.push(problem("floor.finish", `floors[${i}].finish`, `'${f.finish}' is not a floor finish`, suggest(catalog, String(f.finish), "floor")));
    for (let tx = x; tx < x + fw; tx++) for (let tz = z; tz < z + fd; tz++) floor.set(tileKey(tx, tz), f.finish);
  });

  // walls
  const firstWall = catalog.list({ kind: "wall" })[0]?.id;
  const walls = new Map();
  doc.walls.forEach((wall, i) => {
    const path = wall.path;
    const bad = !Array.isArray(path) || path.length < 2 || path.some((p) => !Array.isArray(p) || !isInt(p[0]) || !isInt(p[1]) || p[0] < 0 || p[1] < 0 || p[0] > w || p[1] > d);
    if (bad) { P.push(problem("wall.path", `walls[${i}].path`, `path ${JSON.stringify(path)} is not grid points inside the lot (0..${w}, 0..${d})`, "a path is [[x, z], [x, z], ...] of whole numbers along grid lines")); return; }
    for (let k = 1; k < path.length; k++) {
      const [ax, az] = path[k - 1], [bx, bz] = path[k];
      if ((ax !== bx && az !== bz) || (ax === bx && az === bz)) P.push(problem("wall.leg", `walls[${i}].path[${k}]`, `the leg (${ax},${az}) → (${bx},${bz}) is ${ax === bx && az === bz ? "empty" : "diagonal"}`, `walls run along x or along z: go via (${bx},${az})`));
    }
    for (const f of [wall.finish, wall.outside]) if (f && catalog.get(f)?.kind !== "wall") P.push(problem("wall.finish", `walls[${i}]`, `'${f}' is not a wall finish`, suggest(catalog, String(f), "wall")));
    const finish = wall.finish ?? firstWall, outside = wall.outside ?? finish;
    for (const e of pathEdges(path)) { const { axis, x, z } = parseEdge(e); walls.set(e, { key: e, axis, x, z, finish, outside }); }
  });
  if (walls.size && !firstWall) P.push(problem("wall.finish", "walls", "the world has walls but no pack defines a wall finish", "add a pack with a kind: \"wall\" finish (the starter pack has starter/plaster)"));

  // openings
  doc.openings.forEach((o, i) => {
    const at = `openings[${i}]`;
    const def = catalog.get(o.type);
    if (!def || def.kind !== "opening") { P.push(problem("opening.type", `${at}.type`, `'${o.type}' is not an opening`, suggest(catalog, String(o.type), "opening"))); return; }
    const [x, z] = o.at ?? [];
    const e = isInt(x) && isInt(z) ? sideEdge(x, z, o.side) : null;
    if (!e) { P.push(problem("opening.at", at, `at ${JSON.stringify(o.at)} side ${JSON.stringify(o.side)} does not name a tile edge`, "at: [x, z] is a tile and side is n, e, s or w")); return; }
    const wall = walls.get(e);
    if (!wall) {
      const near = [...walls.keys()].map((k) => [k, edgeDistance(k, e)]).sort((a, b) => a[1] - b[1]).slice(0, 3).map(([k]) => edgeName(k));
      P.push(problem("opening.nowall", at, `${o.type} at tile ${tileText([x, z])} side ${o.side}: there is no wall on that edge`, near.length ? `put it on a wall edge, such as ${near.join(", ")}` : "add a wall first"));
      return;
    }
    if (wall.opening) { P.push(problem("opening.twice", at, `the edge at tile ${tileText([x, z])} side ${o.side} already has ${wall.opening.type}`, "one opening per wall edge; move this one along the wall")); return; }
    wall.opening = { type: o.type, def, index: i };
  });

  // rooms
  const { rooms, at: roomAt } = detectRooms(doc, new Set(walls.keys()));
  const labelIds = new Set();
  (doc.rooms ?? []).forEach((r, i) => {
    const id = roomAt.get(tileKey(r.at?.[0], r.at?.[1]));
    if (labelIds.has(r.id)) P.push(problem("room.id", `rooms[${i}]`, `room id '${r.id}' is used twice`, "give each room label its own id"));
    labelIds.add(r.id);
    if (id === undefined) P.push(problem("room.at", `rooms[${i}]`, `tile ${JSON.stringify(r.at)} is outside the lot`, "label a tile inside the room"));
    else if (id === "outside") P.push(problem("room.open", `rooms[${i}]`, `tile ${tileText(r.at)} for room '${r.id}' is outdoors: the walls round it do not close`, "close the walls round it (a door or window still closes a wall; a missing wall edge does not)"));
    else if (id !== r.id) P.push(problem("room.twice", `rooms[${i}]`, `tile ${tileText(r.at)} is in room '${id}', which another label already names`, "label each room once"));
  });

  // objects
  const occupied = new Map(), blocked = new Set(), objects = [], ids = new Set();
  doc.objects.forEach((o, i) => {
    const at = `objects[${i}]`;
    const def = catalog.get(o.type);
    if (!def) { P.push(problem("object.type", `${at}.type`, `unknown type '${o.type}'`, suggest(catalog, String(o.type), "object"))); return; }
    if (def.kind !== "object") { P.push(problem("object.kind", `${at}.type`, `'${o.type}' is a ${def.kind}, not an object`, def.kind === "opening" ? "put doors and windows in openings: [{ type, at, side }]" : "put finishes in floors or walls")); return; }
    if (ids.has(o.id)) P.push(problem("object.id", `${at}.id`, `id '${o.id}' is used twice`, "give each object its own id"));
    ids.add(o.id);
    const q = QUARTER[o.facing];
    if (q === undefined) { P.push(problem("object.facing", `${at}.facing`, `facing '${o.facing}' is not n, e, s or w`, "facing is where the object's front points; a chair's front is where the knees point")); return; }
    const [fx, fz] = def.footprint;
    const W = q % 2 ? fz : fx, D = q % 2 ? fx : fz;
    const [x, z] = o.at ?? [];
    if (!isInt(x) || !isInt(z) || x < 0 || z < 0 || x + W > w || z + D > d) { P.push(problem("object.at", `${at}.at`, `${o.type} at ${JSON.stringify(o.at)} facing ${o.facing} covers ${W}×${D} tiles, which leaves the ${w}×${d} lot`, `at is the north-west tile; keep x <= ${w - W} and z <= ${d - D}`)); return; }
    const tiles = [];
    for (let tx = x; tx < x + W; tx++) for (let tz = z; tz < z + D; tz++) tiles.push([tx, tz]);
    for (const [ax, az] of tiles) for (const [bx, bz] of [[ax + 1, az], [ax, az + 1]]) {
      if (bx < x + W && bz < z + D && walls.has(edgeBetween(ax, az, bx, bz))) P.push(problem("object.wall", at, `${o.type} at ${tileText(o.at)} straddles the wall between ${tileText([ax, az])} and ${tileText([bx, bz])}`, "move it so its whole footprint is on one side of the wall"));
    }
    if (def.blocks) {
      for (const t of tiles) {
        const k = tileKey(...t);
        if (occupied.has(k)) {
          const free = freeNear(t, occupied, inLot, walls).map(tileText).join(", ");
          P.push(problem("object.overlap", at, `${o.type} '${o.id}' covers tile ${tileText(t)}, already used by '${occupied.get(k)}'`, free ? `move it to a free tile such as ${free}` : "move it to a free tile"));
        } else occupied.set(k, o.id);
      }
      for (const t of tiles) blocked.add(tileKey(...t));
    }
    const y = tiles.some(([tx, tz]) => floor.has(tileKey(tx, tz))) ? FLOOR_Y : 0;
    const pos = [x + W / 2, y, z + D / 2];
    const slots = {};
    for (const [name, s] of Object.entries(def.slots)) {
      const [lx, lz] = turn(s.at, q);
      const sx = pos[0] + lx, sz = pos[2] + lz;
      const st = [Math.floor(sx), Math.floor(sz)];
      slots[name] = { at: [sx, sz], y: y + (s.y ?? 0), facing: turnSide(s.facing, q), clip: s.clip, stand: s.stand.map((off) => { const [dx, dz] = turn(off, q); return [st[0] + Math.round(dx), st[1] + Math.round(dz)]; }) };
    }
    const anchors = {};
    for (const [name, [ax, ay, az]] of Object.entries(def.anchors)) { const [lx, lz] = turn([ax, az], q); anchors[name] = [pos[0] + lx, y + ay, pos[2] + lz]; }
    objects.push({ id: o.id, type: o.type, def, facing: o.facing, q, tiles, pos, slots, anchors });
  });

  // characters
  const characters = [];
  const cids = new Set();
  doc.characters.forEach((c, i) => {
    const at = `characters[${i}]`;
    if (!c.id || cids.has(c.id)) P.push(problem("character.id", `${at}.id`, c.id ? `id '${c.id}' is used twice` : "a character needs an id", "give each character its own id"));
    cids.add(c.id);
    const [x, z] = c.at ?? [];
    if (!isInt(x) || !isInt(z) || !inLot(x, z)) { P.push(problem("character.at", `${at}.at`, `at ${JSON.stringify(c.at)} is not a tile in the lot`, `use [x, z] with 0 <= x < ${w} and 0 <= z < ${d}`)); return; }
    if (blocked.has(tileKey(x, z))) P.push(problem("character.blocked", `${at}.at`, `${c.id} starts on tile ${tileText([x, z])}, inside '${occupied.get(tileKey(x, z))}'`, `start on a free tile such as ${freeNear([x, z], occupied, inLot, walls).map(tileText).join(", ")}`));
    if (!SIDES.includes(c.facing)) P.push(problem("character.facing", `${at}.facing`, `facing '${c.facing}' is not n, e, s or w`, "use n, e, s or w"));
    characters.push({ id: c.id, tile: [x, z], facing: c.facing, look: c.look ?? {} });
  });

  const lot = { w, d, floor, walls, rooms, roomAt, objects, blocked, characters };
  if (errorsOf(P).length) return { lot, problems: P, catalog };

  // reachability: every room from outdoors (or from the first room, on a lot that is all indoors), every act's path
  const nav = createNav(lot);
  const reach = reachable(lot, nav);
  for (const r of rooms) {
    if (r.tiles.some(([x, z]) => reach.has(tileKey(x, z)))) continue;
    if (r.tiles.every(([x, z]) => blocked.has(tileKey(x, z)))) continue;
    const door = doorFor(r, lot);
    P.push(problem("room.unreachable", `rooms (${r.id})`, `room '${r.id}' at ${tileText(r.tiles[0])} cannot be reached`, door ? `add an opening on one of its walls, for example { type: "<door>", at: [${door.at}], side: "${door.side}" }, or clear what blocks its door` : "give it a door"));
  }
  doc.acts.forEach((a, i) => {
    const who = characters.find((c) => c.id === a.who);
    if (!who) { P.push(problem("act.who", `acts[${i}].who`, `no character '${a.who}'`, `use one of: ${characters.map((c) => c.id).join(", ") || "(no characters)"}`)); return; }
    if (!["sit", "use", "walk"].includes(a.do)) { P.push(problem("act.do", `acts[${i}].do`, `'${a.do}' is not an act`, "use sit, use or walk")); return; }
    const r = planAct(lot, nav, who, a, `acts[${i}]`);
    if (r.problem) P.push(r.problem);
  });
  return { lot, problems: P, catalog };
}

/** @stability stable */
export function validateWorld(world) {
  return analyse(world).problems;
}

/** @stability stable  @returns {{ lot: Lot, catalog: object, problems: object[] }} */
export function buildLot(world) {
  const r = analyse(world);
  if (errorsOf(r.problems).length) throw new WorldError(r.problems, `world '${world.doc.id}'`);
  return r;
}

function reachable(lot, nav) {
  const start = [];
  for (let x = 0; x < lot.w; x++) for (let z = 0; z < lot.d; z++) if (lot.roomAt.get(tileKey(x, z)) === "outside" && nav.walkable(x, z)) start.push([x, z]);
  if (!start.length && lot.rooms[0]) start.push(...lot.rooms[0].tiles.filter(([x, z]) => nav.walkable(x, z)).slice(0, 1));
  const seen = new Set(start.map((t) => tileKey(...t)));
  const queue = [...start];
  for (let i = 0; i < queue.length; i++) {
    const [x, z] = queue[i];
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, nz = z + dz, k = tileKey(nx, nz);
      if (seen.has(k) || !nav.canStep(x, z, nx, nz)) continue;
      seen.add(k);
      queue.push([nx, nz]);
    }
  }
  return seen;
}

// A wall edge of room r that would make a good door: one with no opening, whose other side is another space.
function doorFor(r, lot) {
  for (const [x, z] of r.tiles) for (const side of SIDES) {
    const e = sideEdge(x, z, side);
    const wall = lot.walls.get(e);
    if (wall && !wall.opening) {
      const other = edgeTiles(e).find(([tx, tz]) => !(tx === x && tz === z));
      if (other[0] >= 0 && other[1] >= 0 && other[0] < lot.w && other[1] < lot.d && !lot.blocked.has(tileKey(...other))) return { at: [x, z], side };
    }
  }
  return null;
}

function freeNear([x, z], occupied, inLot, walls) {
  const out = [];
  for (let r = 1; r <= 3 && out.length < 2; r++) for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
    if (Math.max(Math.abs(dx), Math.abs(dz)) !== r || out.length >= 2) continue;
    const t = [x + dx, z + dz];
    if (inLot(...t) && !occupied.has(tileKey(...t))) out.push(t);
  }
  return out;
}

const edgeName = (k) => { const { axis, x, z } = parseEdge(k); return axis === "h" ? `tile (${x},${z}) side n` : `tile (${x},${z}) side w`; };
function edgeDistance(a, b) {
  const A = parseEdge(a), B = parseEdge(b);
  return Math.abs(A.x - B.x) + Math.abs(A.z - B.z) + (A.axis === B.axis ? 0 : 0.5);
}
