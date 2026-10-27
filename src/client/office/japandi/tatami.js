// A raised tatami lounge: a smoked dais with two mats, a low tray table with a cup, and two floor cushions.
import { defineObject } from "@hq/world/model";

const DAIS = 0.33;               // the plinth's height: under a cut wall's top, which it may stand against
const MAT = 0.02;                // a mat's thickness
const MW = 0.9, ML = 1.8;        // one mat: its width (x) and length (z)
const EDGE = 0.03;               // the cloth border along each mat's long side
const TOP = DAIS + MAT;          // the mats' top face
const TRAY = TOP + 0.2;          // the tray's underside
const TRAY_T = 0.025;            // the tray's thickness
const CUP = 0.05;                // the cup's height

// a mat is a core with a cloth strip along each long side; the three pieces tile the mat, none sits on another
function mat(k, cx, core) {
  k.box("mat", [MW - 2 * EDGE, MAT, ML], [cx, DAIS, 0], core, { omit: ["-y"] });
  k.box("mat-edge", [EDGE, MAT, ML], [cx - MW / 2 + EDGE / 2, DAIS, 0], "tatami-edge", { omit: ["-y"] });
  k.box("mat-edge", [EDGE, MAT, ML], [cx + MW / 2 - EDGE / 2, DAIS, 0], "tatami-edge", { omit: ["-y"] });
}

export default defineObject({
  id: "tatami",
  footprint: [2, 2],
  height: TRAY + TRAY_T + CUP,
  tags: ["seat", "lounge"],
  build(k) {
    k.box("dais", [1.84, DAIS, 1.84], [0, 0, 0], "smoked");
    mat(k, -(MW / 2 + 0.01), "tatami");
    mat(k, MW / 2 + 0.01, "tatami-dark");
    k.box("cushion", [0.42, 0.06, 0.42], [-0.5, TOP, 0.45], "indigo", { omit: ["-y"] });
    k.box("cushion", [0.42, 0.06, 0.42], [0.5, TOP, -0.45], "rust", { omit: ["-y"] });
    // the tray stands on four short legs whose tops reach into it
    k.box("tray", [0.42, TRAY_T, 0.3], [0, TRAY, 0], "smoked");
    for (const x of [-0.17, 0.17]) for (const z of [-0.1, 0.1]) k.box("leg", [0.03, TRAY + 0.01 - TOP, 0.03], [x, TOP, z], "smoked", { omit: ["-y"] });
    k.cyl("cup", 0.035, CUP, [0.1, TRAY + TRAY_T, 0.04], "ceramic", { top: 0.04, seg: 8 });
  },
});
