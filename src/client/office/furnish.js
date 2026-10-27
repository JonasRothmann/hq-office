// What stands in each room, in the room's own frame, and the turn from that frame to the lot's tiles. Pure data.
//
// A room's own frame has its back wall on the north (local z = 0) and local x along that wall. A room whose back is
// on another side is the same frame turned (see place). Every type is the Japandi pack's (japandi/).

// The four seats of a team room, in the layout's seat order: a desk (2×1, its front where the worker sits), its
// chair, and the tile at the island's outer end where the worker stands to wave. Two facing pairs either side of an
// aisle; the back pair fills first and faces the door and the camera.
export const SEATS_AT = [
  { desk: [1, 2], deskFacing: "n", chair: [2, 1], chairFacing: "s", beside: [0, 2] },
  { desk: [4, 2], deskFacing: "n", chair: [4, 1], chairFacing: "s", beside: [6, 2] },
  { desk: [1, 3], deskFacing: "s", chair: [2, 4], chairFacing: "n", beside: [0, 3] },
  { desk: [4, 3], deskFacing: "s", chair: [4, 4], chairFacing: "n", beside: [6, 3] },
];

// The rest of a team room, and its windows (tiles on the back wall, used where that wall is an outer one). The chairs
// close rows 1 and 4, so the back row and the east column are the only way from the west seats to the door at (5, 4):
// both stay clear past the corners. A linen rug under the island, a paper pendant over each facing pair; the plant in
// the west corner varies by room.
const CORNER = ["japandi/plant-fig", "japandi/plant-snake", "japandi/plant-monstera", "japandi/vase"];
export const TEAM_ROOM = {
  objects: (room) => [
    { id: "rug", type: "japandi/rug-linen", at: [1, 1], facing: "s" },
    { id: "pendant-w", type: "japandi/pendant-washi", at: [1, 2], facing: "s" },
    { id: "pendant-e", type: "japandi/pendant-washi", at: [4, 2], facing: "s" },
    { id: "plant", type: CORNER[hash(room.id) % CORNER.length], at: [0, 0], facing: "s" },
    { id: "lamp", type: "japandi/floor-lamp", at: [6, 0], facing: "s" },
  ],
  windows: [[1, 0], [2, 0], [4, 0], [5, 0]],
};

// The HQ suite (7×5, back north; its door is on the south or east side at the front corner, kept clear): HQ's desk
// facing the camera under a ceramic pendant, the bookshelf and the workbench on the back wall, a sofa on a boro rug.
export const SUITE_AT = {
  seat: { desk: [2, 2], deskFacing: "n", chair: [3, 1], chairFacing: "s", beside: [4, 2] },
  objects: [
    { id: "bookshelf", type: "japandi/bookshelf", at: [0, 0], facing: "s" },
    { id: "workbench", type: "japandi/workbench", at: [4, 0], facing: "s" },
    { id: "plant", type: "japandi/plant-fig", at: [6, 0], facing: "s" },
    { id: "pendant", type: "japandi/pendant-ceramic", at: [2, 2], facing: "s" },
    { id: "rug", type: "japandi/rug-boro", at: [0, 3], facing: "s" },
    { id: "sofa", type: "japandi/sofa", at: [0, 4], facing: "n" },
    { id: "lamp", type: "japandi/floor-lamp", at: [2, 4], facing: "s" },
    { id: "vase", type: "japandi/vase", at: [6, 1], facing: "s" },
  ],
};

// The break area (its own size w × d is 5 or 7 wide; the floor stage's is 12 deep, the hall coming in on its west
// side at z 5..7): the kitchenette, and a sofa and tea table under a ceramic pendant, on the back wall; the tatami
// lounge in the west corner beside a shoji screen; the tea corner where the room is wide; a lamp, a sideboard and a
// fig along the east wall, and a sofa and tea table on a boro rug at the front of the west side, where it is deep.
// The rest stays open for standing.
export const BREAK_AT = {
  objects: (w, d) => [
    { id: "kitchenette", type: "japandi/kitchenette", at: [0, 0], facing: "s" },
    { id: "sofa", type: "japandi/sofa", at: [2, 0], facing: "s" },
    { id: "tea-table", type: "japandi/tea-table", at: [2, 1], facing: "s" },
    { id: "pendant", type: "japandi/pendant-ceramic", at: [2, 1], facing: "s" },
    { id: "tatami", type: "japandi/tatami", at: [0, 3], facing: "s" },
    { id: "shoji", type: "japandi/shoji", at: [2, 4], facing: "s" },
    ...(w >= 7
      ? [{ id: "plant", type: "japandi/plant-monstera", at: [4, 0], facing: "s" }, { id: "tea-corner", type: "japandi/tea-corner", at: [5, 0], facing: "s" }]
      : [{ id: "plant", type: "japandi/plant-monstera", at: [w - 1, 0], facing: "s" }]),
    ...(d >= 9
      ? [
        { id: "lamp", type: "japandi/floor-lamp", at: [w - 1, 5], facing: "w" },
        { id: "sideboard", type: "japandi/sideboard", at: [w - 1, 6], facing: "w" },
        { id: "fig", type: "japandi/plant-fig", at: [w - 1, 8], facing: "w" },
        { id: "rug", type: "japandi/rug-boro", at: [0, 8], facing: "s" },
        { id: "front-table", type: "japandi/tea-table", at: [0, 8], facing: "n" },
        { id: "front-pendant", type: "japandi/pendant-ceramic", at: [0, 8], facing: "n" },
        { id: "front-sofa", type: "japandi/sofa", at: [0, 9], facing: "n" },
        { id: "front-lamp", type: "japandi/floor-lamp", at: [0, 10], facing: "s" },
      ]
      : []),
  ],
};

// Types that hang overhead or lie flat: they do not block, so a worker may stand under or on them.
export const OVER = new Set(["japandi/rug-linen", "japandi/rug-boro", "japandi/pendant-washi", "japandi/pendant-ceramic"]);

export function hash(s) {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.codePointAt(0), 16777619);
  return h >>> 0;
}

const TURNS = { n: 0, e: 1, s: 2, w: 3 };
const SIDES = ["n", "e", "s", "w"];
// Footprints of the types larger than a tile (every other is one tile); the office test checks them against the pack.
export const FOOT = {
  "japandi/desk": [2, 1], "japandi/sofa": [2, 1], "japandi/tea-table": [2, 1], "japandi/kitchenette": [2, 1],
  "japandi/bookshelf": [2, 1], "japandi/sideboard": [2, 1], "japandi/workbench": [2, 1], "japandi/tea-corner": [2, 1], "japandi/shoji": [2, 1],
  "japandi/pendant-ceramic": [2, 1], "japandi/pendant-washi": [2, 2], "japandi/tatami": [2, 2],
  "japandi/rug-boro": [3, 2], "japandi/rug-linen": [5, 4],
};

// The room's size in its own frame: a room whose back is east or west is turned a quarter.
export const frameSize = (room) => (room.back === "w" || room.back === "e" ? [room.d, room.w] : [room.w, room.d]);

// A rect of tiles in the room's frame ([x, z] and its size) to the lot: its north-west tile.
function rectAt(room, [lx, lz], [fw, fd], o) {
  const { x, z, w, d } = room;
  switch (room.back ?? "n") {
    case "s": return [x + w - lx - fw + o.x, z + d - lz - fd + o.z];
    case "w": return [x + lz + o.x, z + d - lx - fw + o.z];
    case "e": return [x + w - lz - fd + o.x, z + lx + o.z];
    default: return [x + lx + o.x, z + lz + o.z];
  }
}

// A side in the room's frame to the lot's.
export const sideOf = (room, side) => SIDES[(TURNS[side] + TURNS[room.back ?? "n"]) % 4];

// A tile in the room's frame to the lot.
export const tileAt = (room, at, o) => rectAt(room, at, [1, 1], o);

// An object in the room's frame ({ type, at, facing }) to the lot: its north-west tile and its facing.
export function place(room, obj, o) {
  const [fx, fz] = FOOT[obj.type] ?? [1, 1];
  const size = obj.facing === "e" || obj.facing === "w" ? [fz, fx] : [fx, fz];
  return { type: obj.type, at: rectAt(room, obj.at, size, o), facing: sideOf(room, obj.facing) };
}
