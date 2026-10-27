// The land pack's colours, day and night: the valley, the town and the garden, calmer than the office so they frame
// it. Night keeps what things are made of and turns them toward moonlit blue; what gives light (windows, lamps,
// lanterns, car lights) warms. Pieces name these bare ("rock"); the pack makes them "land/rock". A piece whose colour
// varies per copy is white where the copy's tint shows, and the land names a tint token ("land/car-3") per copy.
const DAY = {
  // the valley's ground, by what grows there
  "ground-lawn": "#a8b98c", "ground-grass": "#a3b487", "ground-meadow": "#afb98a", "ground-forest": "#8f9f74",
  "ground-bank": "#c2b894", "ground-bed": "#8c8f7a", "ground-dry": "#b5b78f",
  water: "#86a7ad", path: "#cfc2a3", rock: "#a9a59b", reed: "#8f9a62", "reed-tip": "#7a5a3a", tuft: "#93a777", "tuft-2": "#a2b07c",
  "flower-0": "#f2efe6", "flower-1": "#e8d27a", "flower-2": "#d9a8b4", "flower-3": "#a9a3cf", "flower-4": "#e6b07a",
  "bridge-deck": "#a8875f", "bridge-rail": "#a5533f", "bridge-post": "#6b4f3a",
  // trees
  "conifer-leaf": "#58745a", "conifer-leaf-2": "#4c6850", "conifer-trunk": "#5c4636",
  "birch-leaf": "#a2b56f", "birch-leaf-2": "#93a865", "birch-trunk": "#ebe7dc", "birch-mark": "#4a4540",
  "maple-leaf": "#7f9a5c", "maple-leaf-2": "#8ca663", "maple-trunk": "#5f4a3a",
  "red-leaf": "#b0583c", "red-leaf-2": "#c06a44", "red-trunk": "#4f3d31",
  "shrub-leaf": "#7a9262", "shrub-leaf-2": "#6c8457",
  "round-leaf": "#7d975e", "round-leaf-2": "#6f8a55", "round-trunk": "#5f4a3a",
  // the town's ground: Copenhagen-ish streets, bike tracks with blue crossings, pavements, the canal and its quays
  "city-grass": "#a9b68e", yard: "#bdb6a2", gravel: "#d3cdbf", road: "#8f9195", setts: "#a19c94", "bike-track": "#7b7d83",
  "bike-blue": "#6a8cb4", mark: "#ece9e0", walk: "#cdc8be", kerb: "#bab4a8", pit: "#6d5d4c",
  quay: "#bdb5a6", "quay-wall": "#857d72", "quay-edge": "#d6d0c4", "city-water": "#71929a",
  // the town's buildings: plaster in calm pastels and ochres, red brick (the last three walls), slate and tile roofs,
  // copper green on the civic roof (the last roof)
  "wall-0": "#d8ad66", "wall-1": "#c98462", "wall-2": "#ddc075", "wall-3": "#b3bc9b", "wall-4": "#abbdc9", "wall-5": "#e2bcae",
  "wall-6": "#e7d496", "wall-7": "#ece3cb", "wall-8": "#e6e1d6", "wall-9": "#a65d4b", "wall-10": "#97523f", "wall-11": "#b0705a",
  base: "#7d766c", "roof-0": "#55595f", "roof-1": "#61656c", "roof-2": "#a65f47", "roof-3": "#985843", "roof-4": "#7fae99",
  "flat-roof": "#9b988f", frame: "#f1eee7", door: "#5c4636",
  "awning-0": "#5f8a87", "awning-1": "#c9a24a", "awning-2": "#a8553f", "awning-3": "#3f5170", "awning-4": "#7b8b5a",
  "lamp-head": "#d6d3cb", wire: "#3a3b40", stone: "#b9b3a8", bench: "#7a5a40", iron: "#3c3d42",
  // panes: glass by day; by night most are lit, a few in two warmths, some dark. A lamp's pool adds its colour: none by day
  "pane-a": "#8193a0", "pane-b": "#8a9ba7", "pane-dark": "#75878f", "lamp-glow": "#e9e6dc", "lamp-pool": "#000000",
  "head-light": "#e8e4d8", "tail-light": "#9a4a40",
  // what moves: paints, shirts, trousers, skins, hair
  "car-0": "#f1efe9", "car-1": "#bfc3c6", "car-2": "#4a4e55", "car-3": "#2f3c56", "car-4": "#9a4a40", "car-5": "#8a9a86",
  "car-6": "#d9cdb4", "car-7": "#26282c", "car-8": "#6f8fa8", bus: "#e2b83e", "car-glass": "#4a5560", tyre: "#2a2a2c",
  "bike-0": "#2b2d31", "bike-1": "#3f5a4a", "bike-2": "#8a3a34", "bike-3": "#2f4466", "bike-4": "#ddd6c4", "bike-5": "#8a8f96", "bike-6": "#6a5040",
  "boat-0": "#2f3b4a", "boat-1": "#f0ece2", "boat-2": "#6b3a2e", "boat-3": "#3f5a4a", "boat-4": "#2a2a2c", "boat-5": "#8a6a3a",
  deck: "#b39c7c", sail: "#f2eee4", mast: "#8a6a4a", cargo: "#a8875f",
  "shirt-0": "#e9e4da", "shirt-1": "#3f4a5a", "shirt-2": "#8aa39b", "shirt-3": "#c9b79c", "shirt-4": "#5c6f8a",
  "shirt-5": "#d7a68a", "shirt-6": "#2f3a33", "shirt-7": "#b9c4cc", "shirt-8": "#a8553f", "shirt-9": "#c9a24a",
  "pants-0": "#33384a", "pants-1": "#4b4f5c", "pants-2": "#5c4a3a", "pants-3": "#2d3e50", "pants-4": "#6b6f58", "pants-5": "#3d3d42",
  "skin-0": "#f1c9a5", "skin-1": "#e0ac83", "skin-2": "#c68a5e", "skin-3": "#9a6440", "skin-4": "#6e4529", "skin-5": "#f6d7bd",
  "hair-0": "#2a1d15", "hair-1": "#4a3020", "hair-2": "#7a4b28", "hair-3": "#c08a4a", "hair-4": "#1d1d22", "hair-5": "#8c8c94", "hair-6": "#a33a2a",
  // the garden: raked gravel, moss, stone, a maple in reds, a paper lantern, bamboo, oak and steel
  "garden-gravel": "#dcd6c9", "garden-rake": "#c6bfaf", "drip-gravel": "#cdc6b8", moss: "#6b7f4e", "moss-2": "#5f7546",
  "garden-stone": "#a29d92", "garden-stone-2": "#8f8a80", "step-stone": "#c9c3b7", "step-stone-2": "#bdb6a8", paver: "#d3ccbf", "paver-2": "#cbc4b6",
  "maple-red-0": "#9e4a32", "maple-red-1": "#b4593a", "maple-red-2": "#88402c", "maple-red-3": "#c06a44", "garden-trunk": "#4a3a2e",
  "lantern-paper": "#fff1d6", "bollard-glow": "#f7f1e2", "basin-water": "#5f7f8e", bamboo: "#8a8a5a", ladle: "#b8925a",
  "garden-oak": "#cfa77c", "garden-oak-dark": "#a9825a", "garden-deck": "#b39c7c", "garden-deck-2": "#a8916f", charcoal: "#3a3937", steel: "#2b2b2e",
  canvas: "#e2d7c3", "pine-leaf": "#3f6b3c", "pine-leaf-2": "#365d34", "pine-trunk": "#5a4632", "clipped": "#55704a", "clipped-2": "#4a6542",
  grass: "#a3a160", "grass-2": "#8f9a58",
};

const NIGHT = {
  "ground-lawn": "#6a8a80", "ground-grass": "#66857c", "ground-meadow": "#6f8a80", "ground-forest": "#4f6b66",
  "ground-bank": "#7a8484", "ground-bed": "#46596a", "ground-dry": "#748680",
  water: "#34506e", path: "#8a8f96", rock: "#7d8590", reed: "#5a6e66", "reed-tip": "#4a4a40", tuft: "#5c7a72", "tuft-2": "#66837a",
  "flower-0": "#c9d2e6", "flower-1": "#b8bd9a", "flower-2": "#a993b6", "flower-3": "#8f8fc4", "flower-4": "#b39b8f",
  "bridge-deck": "#7a6a5c", "bridge-rail": "#7d4a48", "bridge-post": "#4a3d36",
  "conifer-leaf": "#3d5a5c", "conifer-leaf-2": "#34505a", "conifer-trunk": "#3c3438",
  "birch-leaf": "#6c8478", "birch-leaf-2": "#627a70", "birch-trunk": "#b9c0cc", "birch-mark": "#3a3a44",
  "maple-leaf": "#557466", "maple-leaf-2": "#5e7c6c", "maple-trunk": "#3f3a3c",
  "red-leaf": "#7a4c52", "red-leaf-2": "#86545a", "red-trunk": "#3a3236",
  "shrub-leaf": "#4f6c62", "shrub-leaf-2": "#46635c",
  "round-leaf": "#527064", "round-leaf-2": "#4a675e", "round-trunk": "#3f3a3c",
  "city-grass": "#5f7a74", yard: "#646a76", gravel: "#6c7280", road: "#40454f", setts: "#4c515c", "bike-track": "#3a3f49",
  "bike-blue": "#3c5478", mark: "#9aa2ae", walk: "#6a707e", kerb: "#5d6370", pit: "#3a3436",
  quay: "#636977", "quay-wall": "#3e4350", "quay-edge": "#7a808c", "city-water": "#2c4560",
  "wall-0": "#9a8e7e", "wall-1": "#8e7672", "wall-2": "#9c9480", "wall-3": "#87928e", "wall-4": "#8a98a8", "wall-5": "#9e8e92",
  "wall-6": "#a29c88", "wall-7": "#a6a6aa", "wall-8": "#a2a6ae", "wall-9": "#6e5458", "wall-10": "#644c50", "wall-11": "#76605e",
  base: "#4a4e58", "roof-0": "#30343e", "roof-1": "#383c46", "roof-2": "#5a4448", "roof-3": "#523e42", "roof-4": "#4c6a68",
  "flat-roof": "#5f6470", frame: "#7f8794", door: "#3e3638",
  "awning-0": "#3f5e66", "awning-1": "#7e6d44", "awning-2": "#6e4440", "awning-3": "#2f3c56", "awning-4": "#4e5e48",
  "lamp-head": "#fff1c9", wire: "#22242a", stone: "#5e6470", bench: "#4a3e3a", iron: "#2a2c32",
  "pane-a": "#ffd59a", "pane-b": "#ffe7bf", "pane-dark": "#28324a", "lamp-glow": "#fff0c8", "lamp-pool": "#8a6f45",
  "head-light": "#fff6dc", "tail-light": "#ff6a5a",
  "car-0": "#aab0bb", "car-1": "#8a909a", "car-2": "#3a3f48", "car-3": "#283246", "car-4": "#5e3c40", "car-5": "#5e6a66",
  "car-6": "#8c8478", "car-7": "#202228", "car-8": "#4c627a", bus: "#a08c4a", "car-glass": "#2a3446", tyre: "#1c1c20",
  "bike-0": "#1e2026", "bike-1": "#2c3e3a", "bike-2": "#5a3236", "bike-3": "#24324a", "bike-4": "#8a8a8e", "bike-5": "#5a6068", "bike-6": "#46383a",
  "boat-0": "#232c3a", "boat-1": "#8a909c", "boat-2": "#4a3034", "boat-3": "#2c3e3a", "boat-4": "#1c1c20", "boat-5": "#5e4c3a",
  deck: "#6e6458", sail: "#a6aab4", mast: "#4a3e36", cargo: "#6e5e4c",
  "shirt-0": "#a6abb6", "shirt-1": "#323a48", "shirt-2": "#5f7470", "shirt-3": "#8a8278", "shirt-4": "#45546a",
  "shirt-5": "#957a70", "shirt-6": "#283030", "shirt-7": "#8590a0", "shirt-8": "#6e4440", "shirt-9": "#8a7448",
  "pants-0": "#262a38", "pants-1": "#363a46", "pants-2": "#40363a", "pants-3": "#242e3c", "pants-4": "#4a4e48", "pants-5": "#2e2e34",
  "skin-0": "#b59a8c", "skin-1": "#a3887a", "skin-2": "#8c7064", "skin-3": "#6e5450", "skin-4": "#503c3c", "skin-5": "#bea69a",
  "hair-0": "#1e1a1c", "hair-1": "#2e2626", "hair-2": "#4a3a34", "hair-3": "#7a6450", "hair-4": "#18181c", "hair-5": "#6a6e78", "hair-6": "#5e3434",
  "garden-gravel": "#7c8290", "garden-rake": "#6c7280", "drip-gravel": "#737a88", moss: "#3f5a48", "moss-2": "#46604c",
  "garden-stone": "#6e7482", "garden-stone-2": "#5e6470", "step-stone": "#7a808c", "step-stone-2": "#6e7480", paver: "#7a808c", "paver-2": "#727884",
  "maple-red-0": "#6e4448", "maple-red-1": "#7a4c52", "maple-red-2": "#5e3c40", "maple-red-3": "#86545a", "garden-trunk": "#3a3236",
  "lantern-paper": "#ffe2a8", "bollard-glow": "#fff0c8", "basin-water": "#2c3d52", bamboo: "#5a5e48", ladle: "#7a6450",
  "garden-oak": "#8a7462", "garden-oak-dark": "#6a5848", "garden-deck": "#6e6458", "garden-deck-2": "#665c50", charcoal: "#2a2a2e", steel: "#1e1e22",
  canvas: "#8c8a8a", "pine-leaf": "#2c4a44", "pine-leaf-2": "#26423e", "pine-trunk": "#3c3438", "clipped": "#3a5450", "clipped-2": "#344c48",
  grass: "#5e6450", "grass-2": "#545c4a",
};

export const PALETTE = { light: DAY, dark: NIGHT };
// how many of each varied colour there are (tint tokens "<name>-<i>")
export const COUNTS = { wall: 12, roof: 5, awning: 5, car: 9, bike: 7, boat: 6, shirt: 10, pants: 6, skin: 6, hair: 7, flower: 5 };
