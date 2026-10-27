// HQ's workbench against the back wall: an oak top on steel legs, a pegboard of tools above, a 3D printer at work and a cutting mat.
import { defineObject } from "@hq/world/model";

const TOP = 0.69;            // the bench top's surface
const PX = 0.4, PZ = -0.1;   // the printer's centre on the bench

export default defineObject({
  id: "workbench",
  footprint: [2, 1],
  height: 1.75,
  tags: ["work", "surface"],
  build(k) {
    // the bench: an oak top (its back at z = -0.4, clear of the wall) on four steel legs
    k.box("top", [1.8, 0.04, 0.6], [0, 0.65, -0.1], "oak");
    for (const x of [-0.84, 0.84]) for (const z of [-0.36, 0.16]) k.box("leg", [0.045, 0.65, 0.045], [x, 0, z], "steel");

    // the pegboard: a thin ash panel, its holes as small boxes standing 2 mm proud of it
    k.box("pegboard", [1.7, 0.9, 0.012], [0, 0.85, -0.412], "ash");
    for (let x = -0.7; x <= 0.71; x += 0.175) for (let y = 0.95; y <= 1.66; y += 0.175)
      k.box("peg", [0.008, 0.008, 0.002], [x, y, -0.405], "smoked-light");
    // tools hung on the pegs: pliers, a screwdriver tip down, a ruler, a coil of cable
    k.box("pliers", [0.02, 0.15, 0.012], [-0.47, 1.2, -0.397], "steel");
    k.box("pliers", [0.02, 0.15, 0.012], [-0.43, 1.2, -0.397], "steel");
    k.box("pliers", [0.06, 0.03, 0.012], [-0.45, 1.35, -0.397], "steel");
    k.box("screwdriver", [0.008, 0.12, 0.008], [0.3, 1.38, -0.399], "steel");
    k.box("screwdriver", [0.03, 0.09, 0.02], [0.3, 1.5, -0.393], "rust");
    k.box("ruler", [0.03, 0.3, 0.004], [0.5, 1.15, -0.401], "smoked");
    k.cyl("cable", 0.05, 0.02, [-0.1, 1.4, -0.403], "sage", { rot: [Math.PI / 2, 0, 0], seg: 14 });

    // the 3D printer: a steel frame of two plates and four posts, a brushed bed, a print on the bed
    k.box("plate", [0.3, 0.015, 0.3], [PX, TOP, PZ], "steel");
    for (const dx of [-0.15, 0.15]) for (const dz of [-0.15, 0.15]) k.box("post", [0.02, 0.3, 0.02], [PX + dx, TOP + 0.015, PZ + dz], "steel");
    k.box("plate", [0.3, 0.015, 0.3], [PX, TOP + 0.315, PZ], "steel");
    k.box("bed", [0.24, 0.012, 0.22], [PX, 0.8, PZ], "brushed");
    k.box("print", [0.08, 0.03, 0.06], [PX - 0.02, 0.812, PZ], "print");
    k.cyl("print", 0.025, 0.04, [PX - 0.02, 0.842, PZ], "print", { seg: 10 });

    // a filament spool at the bench's right end: two flanges and a barrel
    k.cyl("spool", 0.05, 0.012, [0.68, TOP, -0.1], "ochre", { seg: 14 });
    k.cyl("spool", 0.035, 0.05, [0.68, TOP + 0.012, -0.1], "ochre", { seg: 14 });
    k.cyl("spool", 0.05, 0.012, [0.68, TOP + 0.062, -0.1], "ochre", { seg: 14 });

    // a linen parts box and a sage cutting mat, 1 cm thick
    k.box("parts-box", [0.22, 0.14, 0.2], [-0.7, TOP, -0.1], "linen");
    k.box("mat", [0.44, 0.01, 0.34], [-0.2, TOP, -0.02], "sage");
  },
});
