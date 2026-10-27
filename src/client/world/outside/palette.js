// The outside's colours, day and night, for the valley and the town: calmer than the office, so they frame it.
// Night keeps what things are made of and turns them toward moonlit blue; the scene's own night light does the rest.

const DAY = {
  nature: {
    bg: "#b4c0a2",
    ground: ["#a8b98c", "#a3b487", "#afb98a", "#8f9f74", "#c2b894", "#8c8f7a", "#b5b78f"], // lawn grass meadow forest bank bed dry
    water: "#86a7ad", sheen: "#eef4f0", path: "#cfc2a3", pathEdge: "#c4b694",
    rock: "#a9a59b", flowers: ["#f2efe6", "#e8d27a", "#d9a8b4", "#a9a3cf", "#e6b07a"], reed: "#8f9a62", tuft: "#93a777", tuft2: "#a2b07c",
    bridge: { deck: "#a8875f", rail: "#a5533f", post: "#6b4f3a" },
  },
  trees: {
    conifer: { leaf: "#58745a", leaf2: "#4c6850", trunk: "#5c4636" },
    birch: { leaf: "#a2b56f", leaf2: "#93a865", trunk: "#ebe7dc", mark: "#4a4540" },
    maple: { leaf: "#7f9a5c", leaf2: "#8ca663", trunk: "#5f4a3a" },
    "maple-red": { leaf: "#b0583c", leaf2: "#c06a44", trunk: "#4f3d31" },
    shrub: { leaf: "#7a9262", leaf2: "#6c8457", trunk: "#5f4a3a" },
    round: { leaf: "#7d975e", leaf2: "#6f8a55", trunk: "#5f4a3a" },
  },
  // The town, Copenhagen-ish: plaster in calm pastels and ochres beside red brick (the last three walls), slate and
  // tile roofs, copper green on the civic roof (the last roof), a yellow bus, blue bike crossings.
  city: {
    bg: "#c9c8bd",
    ground: { grass: "#a9b68e", yard: "#bdb6a2", gravel: "#d3cdbf", lot: "#a8b98c" },
    road: "#8f9195", setts: "#a19c94", bike: "#7b7d83", blue: "#6a8cb4", mark: "#ece9e0", walk: "#cdc8be", kerb: "#bab4a8", pit: "#6d5d4c",
    quay: "#bdb5a6", quayWall: "#857d72", quayEdge: "#d6d0c4", water: "#71929a", sheen: "#eef4f0",
    walls: ["#d8ad66", "#c98462", "#ddc075", "#b3bc9b", "#abbdc9", "#e2bcae", "#e7d496", "#ece3cb", "#e6e1d6", "#a65d4b", "#97523f", "#b0705a"],
    base: "#7d766c",
    roofs: ["#55595f", "#61656c", "#a65f47", "#985843", "#7fae99"],
    flatRoof: "#9b988f", glass: "#8193a0", frame: "#f1eee7", door: "#5c4636",
    awnings: ["#5f8a87", "#c9a24a", "#a8553f", "#3f5170", "#7b8b5a"],
    lampHead: "#d6d3cb", wire: "#3a3b40", stone: "#b9b3a8", bench: "#7a5a40", iron: "#3c3d42",
    cars: ["#f1efe9", "#bfc3c6", "#4a4e55", "#2f3c56", "#9a4a40", "#8a9a86", "#d9cdb4", "#26282c", "#6f8fa8"], bus: "#e2b83e",
    bikes: ["#2b2d31", "#3f5a4a", "#8a3a34", "#2f4466", "#ddd6c4", "#8a8f96", "#6a5040"],
    boats: ["#2f3b4a", "#f0ece2", "#6b3a2e", "#3f5a4a", "#2a2a2c", "#8a6a3a"],
    shirts: ["#e9e4da", "#3f4a5a", "#8aa39b", "#c9b79c", "#5c6f8a", "#d7a68a", "#2f3a33", "#b9c4cc", "#a8553f", "#c9a24a"],
    pants: ["#33384a", "#4b4f5c", "#5c4a3a", "#2d3e50", "#6b6f58", "#3d3d42"],
    skins: ["#f1c9a5", "#e0ac83", "#c68a5e", "#9a6440", "#6e4529", "#f6d7bd"],
    hairs: ["#2a1d15", "#4a3020", "#7a4b28", "#c08a4a", "#1d1d22", "#8c8c94", "#a33a2a"],
  },
  moon: "#000000",
  glow: { window: "#000000", lamp: "#000000" },
};

// Moonlight: the same things, cooler and a little lighter so they read under the dim blue night light.
const NIGHT = {
  nature: {
    bg: "#24324a",
    ground: ["#6a8a80", "#66857c", "#6f8a80", "#4f6b66", "#7a8484", "#46596a", "#748680"],
    water: "#34506e", sheen: "#9fb6d8", path: "#8a8f96", pathEdge: "#80868e",
    rock: "#7d8590", flowers: ["#c9d2e6", "#b8bd9a", "#a993b6", "#8f8fc4", "#b39b8f"], reed: "#5a6e66", tuft: "#5c7a72", tuft2: "#66837a",
    bridge: { deck: "#7a6a5c", rail: "#7d4a48", post: "#4a3d36" },
  },
  trees: {
    conifer: { leaf: "#3d5a5c", leaf2: "#34505a", trunk: "#3c3438" },
    birch: { leaf: "#6c8478", leaf2: "#627a70", trunk: "#b9c0cc", mark: "#3a3a44" },
    maple: { leaf: "#557466", leaf2: "#5e7c6c", trunk: "#3f3a3c" },
    "maple-red": { leaf: "#7a4c52", leaf2: "#86545a", trunk: "#3a3236" },
    shrub: { leaf: "#4f6c62", leaf2: "#46635c", trunk: "#3f3a3c" },
    round: { leaf: "#527064", leaf2: "#4a675e", trunk: "#3f3a3c" },
  },
  city: {
    bg: "#232d40",
    ground: { grass: "#5f7a74", yard: "#646a76", gravel: "#6c7280", lot: "#6a8a80" },
    road: "#40454f", setts: "#4c515c", bike: "#3a3f49", blue: "#3c5478", mark: "#9aa2ae", walk: "#6a707e", kerb: "#5d6370", pit: "#3a3436",
    quay: "#636977", quayWall: "#3e4350", quayEdge: "#7a808c", water: "#2c4560", sheen: "#ffd9a0",
    walls: ["#9a8e7e", "#8e7672", "#9c9480", "#87928e", "#8a98a8", "#9e8e92", "#a29c88", "#a6a6aa", "#a2a6ae", "#6e5458", "#644c50", "#76605e"],
    base: "#4a4e58",
    roofs: ["#30343e", "#383c46", "#5a4448", "#523e42", "#4c6a68"],
    flatRoof: "#5f6470", glass: "#2a3446", frame: "#7f8794", door: "#3e3638",
    awnings: ["#3f5e66", "#7e6d44", "#6e4440", "#2f3c56", "#4e5e48"],
    lampHead: "#fff1c9", wire: "#22242a", stone: "#5e6470", bench: "#4a3e3a", iron: "#2a2c32",
    cars: ["#aab0bb", "#8a909a", "#3a3f48", "#283246", "#5e3c40", "#5e6a66", "#8c8478", "#202228", "#4c627a"], bus: "#a08c4a",
    bikes: ["#1e2026", "#2c3e3a", "#5a3236", "#24324a", "#8a8a8e", "#5a6068", "#46383a"],
    boats: ["#232c3a", "#8a909c", "#4a3034", "#2c3e3a", "#1c1c20", "#5e4c3a"],
    shirts: ["#a6abb6", "#323a48", "#5f7470", "#8a8278", "#45546a", "#957a70", "#283030", "#8590a0", "#6e4440", "#8a7448"],
    pants: ["#262a38", "#363a46", "#40363a", "#242e3c", "#4a4e48", "#2e2e34"],
    skins: ["#b59a8c", "#a3887a", "#8c7064", "#6e5450", "#503c3c", "#bea69a"],
    hairs: ["#1e1a1c", "#2e2626", "#4a3a34", "#7a6450", "#18181c", "#6a6e78", "#5e3434"],
  },
  moon: "#3c5a86",
  glow: { window: "#ffd59a", window2: "#ffe7bf", unlit: "#28324a", lamp: "#fff0c8", pool: "rgba(255,214,150,0.5)", head: "#fff6dc", tail: "#ff6a5a", shop: "#ffcf8a" },
};

// theme: "light" | "dark", or the office's look tokens (lookFor(theme)): then the lawn meets the office's own grass.
export function paletteFor(theme = "light") {
  const night = typeof theme === "object" && theme ? !!theme.night : theme === "dark";
  const P = night ? NIGHT : DAY;
  const out = { night, nature: { ...P.nature, ground: [...P.nature.ground] }, trees: P.trees, city: { ...P.city, ground: { ...P.city.ground } }, moon: P.moon, glow: P.glow ?? {} };
  const lawn = typeof theme === "object" && theme?.ground?.base;
  if (lawn) { out.nature.ground[0] = lawn; out.city.ground.lot = lawn; }
  // the office's own moon, so the lawn round it lights the same as its garden
  if (typeof theme === "object" && "moon" in (theme ?? {})) out.moon = theme.moon ?? "#000000";
  return out;
}
