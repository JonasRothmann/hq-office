// The Japandi pack's colours (docs/decisions.md D15): oat, sand and warm white plaster, pale oak and ash, smoked oak,
// blackened steel, linen, wool, paper, stone and ceramics, and a few muted earth accents. Night keeps what things are
// made of; only what gives light warms. Objects name these bare ("oak"); the pack makes them "japandi/oak".
const DAY = {
  // timber
  oak: "#dbc49e", "oak-light": "#e9dbbf", "oak-edge": "#c4a77a", ash: "#e8dcc4", "ash-edge": "#b49a76",
  smoked: "#4f3f33", "smoked-dark": "#3a2e26", "smoked-light": "#6a5443", bamboo: "#cdb98a",
  // floors and walls
  "floor-oak": "#e6d4b2", "floor-stone": "#d9d2c4", "floor-terrazzo": "#e3dccf", plaster: "#f2ece2", cladding: "#3d3c38",
  // metal
  steel: "#2b2b2e", "steel-light": "#3a3a3c", brushed: "#a9a7a1",
  // cloth, paper, stone and clay
  linen: "#e6ddcc", oat: "#ded3bf", sand: "#d3c7b2", wool: "#b9b1a4", felt: "#a39b8c", cord: "#d3c39c",
  paper: "#f6efe0", "paper-edge": "#e2d8c2", charcoal: "#3a3937", ink: "#26272a", stone: "#a8a196", "stone-light": "#c9c1b1",
  clay: "#b98a6a", ceramic: "#ece6db", "ceramic-grey": "#8a7a68",
  sofa: "#c9c0ae", "sofa-cushion": "#d8d0bf", counter: "#f2efe8",
  tatami: "#cdc890", "tatami-dark": "#c2bd84", "tatami-edge": "#3d3c30",
  // accents
  rust: "#a65a3c", sage: "#94a088", indigo: "#34405a", "indigo-light": "#55657e", "indigo-pale": "#8a9bb3", ochre: "#c39a4e", moss: "#5c6a4e", blush: "#c49a86",
  // greens and branches
  leaf: "#5d7a4f", "leaf-dark": "#43603f", "leaf-light": "#6b8757", "leaf-pale": "#8fa874", olive: "#8a9a74", branch: "#4a3a2e", soil: "#4a3a2a",
  // what gives light: paper shades, the bulb, screens
  "washi-glow": "#fbf3e2", "bulb-glow": "#fff4dc", "screen-glow": "#c9dde0", "screen-code": "#2a3a3a",
  // the print on the HQ workbench, the ink on the scroll
  print: "#e8e2d4",
};

const NIGHT = {
  ...DAY,
  "washi-glow": "#ffe2b0", "bulb-glow": "#ffd9a0", "screen-glow": "#a9cbd2",
};

export const PALETTE = { light: DAY, dark: NIGHT };
