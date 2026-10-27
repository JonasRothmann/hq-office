// Palette tokens: the colours objects and finishes name ("wood", "leaf"), per theme. A pack adds its own tokens, for
// both themes, under its own prefix ("<pack>/<token>"); see definePack.
// Original colours, picked for a calm, warm late-90s life-sim look; nothing is sampled from a real game.

export const PALETTES = {
  light: {
    bg: "#dfe6ea", ground: "#9db37a", "ground-dark": "#7f9a5f",
    oak: "#cfa77c", "oak-dark": "#a9825a", wood: "#b98b5e", "wood-dark": "#6f5239",
    plaster: "#efe8dc", siding: "#9fb3c1", cap: "#97784c", trim: "#f4f1ea", foundation: "#8f8476",
    fabric: "#5f84a8", "fabric-warm": "#c0714f", cushion: "#e2cfa9",
    metal: "#8e959c", steel: "#4a5058", paper: "#f3eee5", screen: "#2c3b4e", "screen-on": "#9fd4ff",
    leaf: "#5c8f4a", "leaf-dark": "#41703a", pot: "#c56b4b", soil: "#5a4030",
    glass: "#bcd8e8", lamp: "#ffe3ad", shade: "#f6ecd6",
    skin: "#e2b48f", hair: "#3b2a20", shirt: "#4f7f6a", pants: "#3e4a5c", shoe: "#2b2622",
  },
  dark: {
    bg: "#151a24", ground: "#8fa56e", "ground-dark": "#738c58",
    oak: "#cfa77c", "oak-dark": "#a9825a", wood: "#b98b5e", "wood-dark": "#6f5239",
    plaster: "#ebe3d6", siding: "#93a8b8", cap: "#8a6c45", trim: "#ede9e0", foundation: "#7d7366",
    fabric: "#5f84a8", "fabric-warm": "#c0714f", cushion: "#e2cfa9",
    metal: "#8e959c", steel: "#4a5058", paper: "#f3eee5", screen: "#2c3b4e", "screen-on": "#9fd4ff",
    leaf: "#5c8f4a", "leaf-dark": "#41703a", pot: "#c56b4b", soil: "#5a4030",
    glass: "#2a3b58", lamp: "#ffd58a", shade: "#f6ecd6",
    skin: "#e2b48f", hair: "#3b2a20", shirt: "#4f7f6a", pants: "#3e4a5c", shoe: "#2b2622",
  },
};

export const isHex = (c) => typeof c === "string" && /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(c);

// A token or a hex colour to a hex colour; an unknown token is magenta, so it shows (checkPack names it first).
export function resolveColor(c, palette) {
  if (typeof c === "string" && c.startsWith("#")) return c;
  return palette[c] ?? "#ff00ff";
}
