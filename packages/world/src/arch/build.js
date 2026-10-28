// Architecture as primitives: the ground, floor slabs, walls (full or kerb per the cutaway), posts and openings, plus
// every placed object's parts in world space. No two same-facing faces overlap in a plane, by construction:
//   - walls stop at posts (a T × T box at every wall vertex) and never overlap each other;
//   - a wall's top face is its cap (a face colour), not a box lying on it;
//   - floors are slabs whose top is FLOOR_Y above the ground; nothing else has a face at FLOOR_Y facing up;
//   - opening frames are deeper than the wall, so their faces are never in the wall's planes.
// Pure: render turns the list into meshes, the lint and the tests read the same list.
import { WALL_H, KERB_H, WALL_T, FLOOR_Y, tileKey, parseEdge, edgeTiles } from "../model/grid.js";
import { buildPrims } from "../catalog/define.js";
import { place, rotY, IDENTITY } from "../catalog/kit.js";

const T = WALL_T, HALF = WALL_T / 2;
const PAD = 8;          // the land drawn round the lot, metres
const LAND_DROP = 0.03; // the land round the lot sits this much lower: the lot's edge is a small kerb, never a shared plane

// Bottoms are never seen (they stand on the ground or a slab), so they are not emitted: no hidden coplanar faces.
const box = (part, size, at, color, extra = {}) => ({ shape: "box", part, size, at, m: IDENTITY, color, finish: "matte", omit: ["-y"], ...extra });

// faces: per-face colour and pattern by the box's local face ("+x", "-x", "+y", "-y", "+z", "-z"). A wall finish's
// bands cut its walls and posts into stretches, one box each (see banded).
/** @stability stable */
export function buildArchitecture(lot, catalog, cut = new Set()) {
  const prims = [];
  const indoor = (x, z) => { const r = lot.roomAt.get(tileKey(x, z)); return r !== undefined && r !== "outside"; };
  const finish = (id) => catalog.get(id) ?? { color: "#ff00ff", pattern: "plain" };

  // ground: the lot, and lower land round it
  // (outdoor: the lamps indoors never light them through the walls)
  prims.push(box("lot", [lot.w, 0.04, lot.d], [lot.w / 2, -0.04, lot.d / 2], "ground", { owner: "ground", outdoor: true }));
  prims.push(box("land", [lot.w + PAD * 2, 0.04, lot.d + PAD * 2], [lot.w / 2, -0.04 - LAND_DROP, lot.d / 2], "ground-dark", { owner: "ground", outdoor: true }));
  // the land's top face is 3 cm under the lot's, so the lot's sides show as a small kerb round it.

  // floor slabs, one box per run of same-finish tiles along x
  for (let z = 0; z < lot.d; z++) {
    let x = 0;
    while (x < lot.w) {
      const f = lot.floor.get(tileKey(x, z));
      if (!f) { x++; continue; }
      let end = x + 1;
      while (end < lot.w && lot.floor.get(tileKey(end, z)) === f) end++;
      const fin = finish(f);
      prims.push(box("slab", [end - x, FLOOR_Y, 1], [(x + end) / 2, 0, z + 0.5], "foundation", { owner: `floor:${f}`, faces: { "+y": { color: fin.color, pattern: fin.pattern } } }));
      x = end;
    }
  }

  // walls
  const heightOf = (k) => (cut.has(k) ? FLOOR_Y + KERB_H : FLOOR_Y + WALL_H);
  const posts = new Map(); // vertex → { h, faces }
  const side = (x, z, wall) => finish(indoor(x, z) ? wall.finish : wall.outside);
  for (const [k, wall] of lot.walls) {
    const { axis, x, z } = parseEdge(k);
    const [[ax, az], [bx, bz]] = edgeTiles(k);
    const top = heightOf(k);
    const sa = side(ax, az, wall), sb = side(bx, bz, wall);
    // the finishes toward tile a (north or west) and toward tile b (south or east)
    const fins = axis === "h" ? { "-z": sa, "+z": sb } : { "-x": sa, "+x": sb };
    const owner = `wall:${k}`;
    // along: position along the edge from its start; span [a0, a1] along, [y0, y1] up
    const piece = (part, a0, a1, y0, y1) => {
      if (a1 - a0 < 1e-6 || y1 - y0 < 1e-6) return;
      const mid = (a0 + a1) / 2;
      banded(fins, y0, y1, (b0, b1, extra) => {
        if (axis === "h") prims.push(box(part, [a1 - a0, b1 - b0, T], [x + mid, b0, z], "plaster", { owner, ...extra }));
        else prims.push(box(part, [T, b1 - b0, a1 - a0], [x, b0, z + mid], "plaster", { owner, ...extra }));
      });
    };
    const o = wall.opening;
    if (!o) piece("wall", HALF, 1 - HALF, 0, top);
    else {
      const h0 = 0.5 - o.def.width / 2, h1 = 0.5 + o.def.width / 2;
      const sill = FLOOR_Y + o.def.sill, head = FLOOR_Y + o.def.head;
      piece("wall", HALF, h0, 0, top);
      piece("wall", h1, 1 - HALF, 0, top);
      if (o.def.sill > 0) piece("wall-under", h0, h1, 0, Math.min(sill, top));
      if (top > head) piece("wall-over", h0, h1, head, top);
      if (!cut.has(k)) {
        const m = axis === "h" ? IDENTITY : rotY(-Math.PI / 2);
        const centre = axis === "h" ? [x + 0.5, FLOOR_Y, z] : [x, FLOOR_Y, z + 0.5];
        for (const p of buildPrims(o.def)) prims.push(place(p, m, centre, `opening:${k}`));
      }
    }
    const ends = axis === "h" ? [[x, z], [x + 1, z]] : [[x, z], [x, z + 1]];
    for (const [vx, vz] of ends) {
      const v = posts.get(tileKey(vx, vz)) ?? { h: 0, wall };
      v.h = Math.max(v.h, top);
      posts.set(tileKey(vx, vz), v);
    }
  }
  for (const [key, v] of posts) {
    const [vx, vz] = key.split(",").map(Number);
    // each face of a post looks at two tiles; it takes the interior finish if either is indoors
    const look = (tiles) => side(...(tiles.find(([x, z]) => indoor(x, z)) ?? tiles[0]), v.wall);
    const fins = {
      "-x": look([[vx - 1, vz - 1], [vx - 1, vz]]), "+x": look([[vx, vz - 1], [vx, vz]]),
      "-z": look([[vx - 1, vz - 1], [vx, vz - 1]]), "+z": look([[vx - 1, vz], [vx, vz]]),
    };
    banded(fins, 0, v.h, (b0, b1, extra) => prims.push(box("post", [T, b1 - b0, T], [vx, b0, vz], "plaster", { owner: `post:${key}`, ...extra })));
  }
  return prims;
}

// The style a finish shows at height y: the band covering it (bands count up from the floor top), else its own.
const styleAt = (f, y) => {
  const b = f.bands?.find((b) => y < FLOOR_Y + b.to);
  return b ? { color: b.color, pattern: b.pattern ?? "plain" } : { color: f.color, pattern: f.pattern };
};

// A wall piece or post from y0 to y1, cut at every band height of its side finishes (fins: face → finish) inside
// that span. make(b0, b1, extra) emits one box per stretch, whose faces show the band covering it. Only the top
// stretch has a top (the cap); the faces between stretches are left out, and the foot darkening counts from y0.
function banded(fins, y0, y1, make) {
  const cuts = new Set(Object.values(fins).flatMap((f) => (f.bands ?? []).map((b) => FLOOR_Y + b.to)));
  const ys = [y0, ...[...cuts].filter((y) => y > y0 + 1e-6 && y < y1 - 1e-6).sort((a, b) => a - b), y1];
  for (let i = 0; i + 1 < ys.length; i++) {
    const mid = (ys[i] + ys[i + 1]) / 2, top = i + 2 === ys.length;
    const faces = Object.fromEntries(Object.entries(fins).map(([face, f]) => [face, styleAt(f, mid)]));
    if (top) faces["+y"] = { color: "cap" };
    make(ys[i], ys[i + 1], { faces, ...(ys.length > 2 ? { base: y0 } : {}), ...(top ? {} : { omit: ["-y", "+y"] }) });
  }
}

// A placed object's parts in world space.
/** @stability stable */
export function objectPrims(placed) {
  return buildPrims(placed.def).map((p) => place(p, rotY(placed.q * Math.PI / 2), placed.pos, placed.id));
}

// Everything static on the lot: architecture and objects.
/** @stability stable */
export function lotPrims(lot, catalog, cut) {
  return [...buildArchitecture(lot, catalog, cut), ...lot.objects.flatMap(objectPrims)];
}
