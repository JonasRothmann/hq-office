// A city bike parked side-on against the back wall: a sage frame on two thin-spoked wheels, a charcoal saddle, a steel
// bar with smoked grips, a bamboo basket on the front and a brushed chain ring. Its middle plane is at z = -0.25, and
// every part stays at z >= -0.42, clear of the wall's face at -0.425.
import { defineObject } from "@hq/world/model";

const MID = -0.25;                                       // the middle plane: frame and wheels
const WR = 0.33;                                         // the wheel's outer radius; its hub stands this high
const RIM = 0.3;                                         // the tread blocks' centre-line radius, so their corners reach WR
const TREAD = 16, TREAD_T = 0.046, TREAD_D = 0.03, TREAD_L = 0.12;  // a block: radial thickness, width, length
const TUBE = 0.025;                                      // a frame tube is 2.5 cm square
const REAR = [-0.55, 0.33], FRONT = [0.55, 0.33];        // the axles
const BB = [-0.05, 0.36], SEAT = [-0.3, 0.85];           // the bottom bracket and the seat cluster
const HEAD_TOP = [0.33, 0.9], HEAD_BOT = [0.36, 0.78];   // the ends of the head tube

// A flat bar of length len, thickness th and depth dz, its centre line through (x, y), turned by ang about z and
// centred at depth z. A box stands on its bottom edge, so the anchor sits half a thickness below the centre line.
function bar(k, part, [x, y], ang, len, th, dz, z, color) {
  const at = [x + (th / 2) * Math.sin(ang), y - (th / 2) * Math.cos(ang), z];
  k.box(part, [len, th, dz], at, color, { rot: [0, 0, ang] });
}

// A frame tube from joint a to joint b, both (x, y), its middle at depth z.
function tube(k, part, a, b, z, color = "bike", th = TUBE) {
  const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
  bar(k, part, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], ang, Math.hypot(b[0] - a[0], b[1] - a[1]), th, th, z, color);
}

// A wheel with its hub at x = cx: tread blocks round the rim, a brushed hub along z, and four spokes through it.
function wheel(k, cx) {
  for (let i = 0; i < TREAD; i++) {
    const a = (i / TREAD) * Math.PI * 2;
    // neighbours sit 2 mm apart in depth, so the blocks that overlap at their ends never share a face plane
    bar(k, "tyre", [cx + RIM * Math.cos(a), WR + RIM * Math.sin(a)], a + Math.PI / 2, TREAD_L, TREAD_T, TREAD_D,
      MID + (i % 2 ? 0.001 : -0.001), "tyre");
  }
  k.cyl("hub", 0.022, 0.16, [cx, WR, MID - 0.08], "brushed", { seg: 12, rot: [Math.PI / 2, 0, 0] });
  // each spoke stands 1.2 mm further forward (+z) than the last: check.ts counts faces under 1 mm apart as one plane
  for (let s = 0; s < 4; s++) bar(k, "spoke", [cx, WR], (s * Math.PI) / 4, 0.56, 0.005, 0.004, MID + 0.0012 * s, "brushed");
}

export default defineObject({
  id: "bike",
  footprint: [2, 1],
  height: 1.05,
  blocks: true,
  tags: ["decor", "signature"],
  build(k) {
    wheel(k, REAR[0]);
    wheel(k, FRONT[0]);

    // the frame: a top, down, seat and head tube, staggered 2 mm in depth so none share a plane where they meet
    tube(k, "top tube", SEAT, HEAD_TOP, MID);
    tube(k, "down tube", BB, HEAD_BOT, MID - 0.002);
    tube(k, "seat tube", BB, SEAT, MID + 0.002);
    tube(k, "head tube", HEAD_BOT, HEAD_TOP, MID - 0.004);
    // a pair of chain stays and fork blades straddle the wheels; a pair of seat stays joins the seat cluster
    for (const d of [-0.06, 0.06]) {
      tube(k, "chain stay", BB, REAR, MID + d);
      tube(k, "fork", HEAD_BOT, FRONT, MID + d);
    }
    for (const d of [-0.045, 0.045]) tube(k, "seat stay", SEAT, REAR, MID + d);

    // joints the tubes do not reach across: the bottom bracket, the seat cluster and the fork crown
    k.cyl("bottom bracket", 0.02, 0.16, [BB[0], BB[1], MID - 0.08], "steel", { seg: 12, rot: [Math.PI / 2, 0, 0] });
    k.cyl("seat cluster", 0.014, 0.1, [SEAT[0], SEAT[1], MID - 0.05], "steel", { seg: 10, rot: [Math.PI / 2, 0, 0] });
    k.box("crown", [0.06, 0.03, 0.14], [HEAD_BOT[0], HEAD_BOT[1] - 0.015, MID], "bike");

    // the chain ring on the drive side, just clear of the frame
    k.cyl("chain ring", 0.075, 0.004, [BB[0], BB[1], -0.2725], "brushed", { seg: 24, rot: [Math.PI / 2, 0, 0] });

    // the saddle on a post; the post's top is 5 mm inside the saddle
    k.cyl("post", 0.013, 0.085, [SEAT[0], SEAT[1], MID], "steel", { seg: 10 });
    k.box("saddle", [0.24, 0.05, 0.12], [SEAT[0] - 0.02, 0.93, MID], "charcoal");

    // the steel bar on a stem over the head tube, with a smoked grip at each end
    k.cyl("stem", 0.014, 0.1, [HEAD_TOP[0], HEAD_TOP[1], MID], "steel", { seg: 10 });
    k.cyl("bar", 0.011, 0.3, [HEAD_TOP[0], 1.0, -0.4], "steel", { seg: 10, rot: [Math.PI / 2, 0, 0] });
    for (const z of [-0.39, -0.19]) k.cyl("grip", 0.02, 0.08, [HEAD_TOP[0], 1.0, z], "smoked", { seg: 10, rot: [Math.PI / 2, 0, 0] });

    // the bamboo basket in front of the bar: a floor, a wall on each side and at each end, and a stay to the bar
    k.box("basket", [0.3, 0.02, 0.24], [0.73, 0.72, MID], "bamboo");
    for (const dz of [-0.11, 0.11]) k.box("slat", [0.3, 0.2, 0.02], [0.73, 0.74, MID + dz], "bamboo");
    k.box("slat", [0.02, 0.2, 0.2], [0.86, 0.74, MID], "bamboo");
    k.box("slat", [0.02, 0.2, 0.2], [0.6, 0.74, MID], "bamboo");
    tube(k, "basket stay", [HEAD_TOP[0], 0.97], [0.6, 0.8], MID, "steel", 0.012);
  },
});
