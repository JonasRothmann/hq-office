// What stands in each room, in the room's own frame, and the turn from that frame to the lot's tiles. Pure data.
//
// A room's own frame has its back wall on the north (local z = 0) and local x along that wall. A room whose back is
// on another side is the same frame turned (see place). Types are the starter pack's or a placeholder for a Japandi
// piece (placeholder/<piece>, replaced by japandi/<piece> in step 3).

// The four seats of a team room, in the layout's seat order: a desk (2×1, its front where the worker sits), its
// chair, and the tile at the island's outer end where the worker stands to wave. Two facing pairs either side of an
// aisle; the back pair fills first and faces the door and the camera.
export const SEATS_AT = [
  { desk: [1, 2], deskFacing: "n", chair: [2, 1], chairFacing: "s", beside: [0, 2] },
  { desk: [4, 2], deskFacing: "n", chair: [4, 1], chairFacing: "s", beside: [6, 2] },
  { desk: [1, 3], deskFacing: "s", chair: [2, 4], chairFacing: "n", beside: [0, 3] },
  { desk: [4, 3], deskFacing: "s", chair: [4, 4], chairFacing: "n", beside: [6, 3] },
];

// The rest of a team room, and its windows (tiles on the back wall, used where that wall is an outer one).
export const TEAM_ROOM = {
  objects: [
    { id: "plant", type: "starter/plant", at: [0, 0], facing: "s" },
    { id: "lamp", type: "starter/lamp", at: [6, 0], facing: "s" },
  ],
  windows: [[1, 0], [5, 0]],
};

// The HQ suite (7×5, back north; its door is on the south or east side at the front corner, kept clear): HQ's desk
// facing the camera, a bookshelf on the back wall, a sofa by the front wall.
export const SUITE_AT = {
  seat: { desk: [2, 2], deskFacing: "n", chair: [3, 1], chairFacing: "s", beside: [4, 2] },
  objects: [
    { id: "bookshelf", type: "placeholder/bookshelf", at: [0, 0], facing: "s" },
    { id: "sofa", type: "placeholder/sofa", at: [0, 4], facing: "n" },
    { id: "plant", type: "starter/plant", at: [6, 0], facing: "s" },
  ],
};

// The break area, along its back wall (its own width is 5 or 7 tiles; the rest stays open for standing).
export const BREAK_AT = {
  objects: (w) => [
    { id: "kitchenette", type: "placeholder/kitchenette", at: [0, 0], facing: "s" },
    { id: "sofa", type: "placeholder/sofa", at: [2, 0], facing: "s" },
    { id: "tea-table", type: "placeholder/tea-table", at: [2, 1], facing: "s" },
    { id: "plant", type: "starter/plant", at: [w - 1, 0], facing: "s" },
  ],
};

const TURNS = { n: 0, e: 1, s: 2, w: 3 };
const SIDES = ["n", "e", "s", "w"];
// Footprints of the two-tile types used here (every other is one tile); the office test checks them against the packs.
export const FOOT = { "starter/desk": [2, 1], "placeholder/sofa": [2, 1], "placeholder/tea-table": [2, 1], "placeholder/kitchenette": [2, 1], "placeholder/bookshelf": [2, 1] };

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
