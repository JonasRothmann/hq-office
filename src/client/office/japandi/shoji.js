// A three-panel folding shoji screen: paper in pale oak frames, a kumiko lattice of oak bars, on short feet. Its
// panels fold in a zigzag, so the middle one turns the other way.
import { defineObject } from "@hq/world/model";

const PANEL_W = 0.48, PANEL_H = 1.62, FOLD = 0.42;
const HINGE = 0.02;                              // a gap where two leaves meet: their stiles then never share a face
const FOOT = 0.05;                               // the feet lift the bottom rail off the floor
const RAIL = 0.03, STILE = 0.03, FRAME_D = 0.03; // frame bars: 3 cm square
const PAPER = 0.01, BAR = 0.01, BAR_D = 0.016;   // the paper; a kumiko bar 1 cm wide, 1.6 cm deep (0.3 cm proud each side)
const INNER_W = PANEL_W - 2 * STILE;             // the rails and the lattice span between the stiles
const INNER_H = PANEL_H - 2 * RAIL;

// Each panel's place: its near edge where the last one ended, turned by its fold angle (the same turn as rot [0, a, 0]).
function zigzag() {
  const panels = [];
  let px = 0, pz = 0;
  for (let i = 0; i < 3; i++) {
    const a = i % 2 ? -FOLD : FOLD;
    panels.push({ a, cx: px + Math.cos(a) * PANEL_W / 2, cz: pz - Math.sin(a) * PANEL_W / 2 });
    px += Math.cos(a) * (PANEL_W + HINGE);
    pz -= Math.sin(a) * (PANEL_W + HINGE);
  }
  // centre the whole zigzag on the footprint
  const mx = panels.reduce((s, p) => s + p.cx, 0) / panels.length;
  const mz = panels.reduce((s, p) => s + p.cz, 0) / panels.length;
  return panels.map((p) => ({ ...p, cx: p.cx - mx, cz: p.cz - mz }));
}

export default defineObject({
  id: "shoji",
  footprint: [2, 1],
  height: 1.7,
  tags: ["divider"],
  build(k) {
    for (const p of zigzag()) {
      const c = Math.cos(p.a), s = Math.sin(p.a);
      // a part in the panel's own frame: lx across the panel, ly its bottom, lz its depth
      const box = (part, [dx, dy, dz], lx, ly, lz, color) =>
        k.box(part, [dx, dy, dz], [p.cx + lx * c + lz * s, ly, p.cz - lx * s + lz * c], color, { rot: [0, p.a, 0] });
      const top = FOOT + PANEL_H;

      for (const sx of [-1, 1]) {
        box("foot", [0.05, FOOT, 0.05], sx * 0.18, 0, 0, "smoked");
        box("stile", [STILE, PANEL_H, FRAME_D], sx * (PANEL_W / 2 - STILE / 2), FOOT, 0, "oak-edge");
      }
      box("rail", [INNER_W, RAIL, FRAME_D], 0, FOOT, 0, "oak-edge");
      box("rail", [INNER_W, RAIL, FRAME_D], 0, top - RAIL, 0, "oak-edge");
      // the paper reaches into the frame's bars, its faces inside theirs; its middle third is the paper the bars sit on
      box("paper", [PANEL_W - STILE, PANEL_H - RAIL, PAPER], 0, FOOT + RAIL / 2, 0, "paper");

      // three rows of kumiko: the horizontal bars run the width (into the stiles); each vertical bar runs between them
      // and into the rails, so no bar's end face shares a plane with the paper's
      const paperB = FOOT + RAIL, paperT = top - RAIL;
      const rows = [1, 2, 3].map((j) => paperB + INNER_H * j / 4 - BAR / 2);
      for (const y of rows) box("kumiko", [2 * (PANEL_W / 2 - STILE / 2 - 0.005), BAR, BAR_D], 0, y, 0, "oak");
      const cuts = [paperB - 0.002, ...rows.flatMap((y) => [y, y + BAR]), paperT + 0.002];
      for (const lx of [-INNER_W / 3, INNER_W / 3]) {
        for (let i = 0; i < cuts.length; i += 2) box("kumiko", [BAR, cuts[i + 1] - cuts[i], BAR_D], lx, cuts[i], 0, "oak");
      }
    }
  },
});
