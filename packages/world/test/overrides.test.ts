// The engine's own colours (the wall caps, the ground, the background) can be recoloured: by a pack's `overrides` for
// every world that uses it, and by a world doc's `palette` over that. checkPack and validateWorld name a bad map with
// its fix, the doc keeps its palette through JSON, and an edit that changes only the palette is a change.
import { describe, expect, test } from "bun:test";
import { checkPack, createCatalog, definePack, defineObject, validateWorld, diffWorld, fromJSON, toJSON, PALETTES } from "@hq/world/model";
import { createDriver } from "../src/view/driver.js";
import house from "./fixtures/house.world.js";

const tinted = (overrides: any) => definePack({ id: "tint", palette: { light: { moss: "#5c6a4e" }, dark: { moss: "#4c5a40" } }, overrides, objects: [
  defineObject({ id: "block", footprint: [1, 1], build(k: any) { k.box("b", [0.5, 0.5, 0.5], [0, 0, 0], "moss"); } }),
] });
const CAPS = { light: { cap: "#4a3a2e", ground: "#8d9478" }, dark: { cap: "#3a2e25", ground: "#566050" } };
const codes = (ps: any[]) => ps.map((p) => p.code);

describe("a pack's overrides", () => {
  test("recolour the engine's tokens in both themes and leave the rest alone", () => {
    const pack = tinted(CAPS);
    expect(checkPack(pack)).toEqual([]);
    const cat = createCatalog([pack]);
    expect([cat.palette("light").cap, cat.palette("light").ground]).toEqual(["#4a3a2e", "#8d9478"]);
    expect([cat.palette("dark").cap, cat.palette("dark").ground]).toEqual(["#3a2e25", "#566050"]);
    expect(cat.palette("light")["ground-dark"]).toBe(PALETTES.light["ground-dark"]);
    expect(cat.palette("light")["tint/moss"]).toBe("#5c6a4e");
    expect(PALETTES.light.cap).not.toBe("#4a3a2e"); // the engine's table is untouched
    expect(createCatalog([tinted(undefined)]).palette("light").cap).toBe(PALETTES.light.cap);
  });

  test("a later pack wins", () => {
    const later = definePack({ id: "later", objects: [], overrides: { light: { cap: "#111111" }, dark: { cap: "#222222" } } });
    expect(createCatalog([tinted(CAPS), later]).palette("light").cap).toBe("#111111");
    expect(createCatalog([later, tinted(CAPS)]).palette("light").cap).toBe("#4a3a2e");
  });

  test("checkPack names a bad map with its fix", () => {
    const flat = checkPack(tinted({ cap: "#4a3a2e" }));
    expect(codes(flat)).toEqual(["pack.overrides"]);
    expect(flat[0].fix).toContain("light: { cap:");
    const odd = checkPack(tinted({ light: { cap: "#4a3a2e" }, dark: {} }));
    expect(odd.map((p: any) => p.fix)).toEqual(['add "cap": "#hex" to tint.overrides.dark']);
    const typo = checkPack(tinted({ light: { grund: "#8d9478" }, dark: { grund: "#566050" } }));
    expect(codes(typo)).toEqual(["pack.overrides"]);
    expect(typo[0].fix).toContain("ground");
    const own = checkPack(tinted({ light: { moss: "#000000" }, dark: { moss: "#000000" } }));
    expect(own[0].fix).toContain("set it in palette, not overrides");
    const notHex = checkPack(tinted({ light: { cap: "brown" }, dark: { cap: "#3a2e25" } }));
    expect(notHex[0].message).toContain('"brown" is not a hex colour');
  });
});

describe("a world doc's palette", () => {
  const withPalette = (palette: any) => fromJSON({ ...structuredClone(house.doc), palette }, house.packs);

  test("beats the packs, survives JSON, and is checked", () => {
    const world = withPalette({ light: { cap: "#4a3a2e" }, dark: { cap: "#3a2e25" } });
    expect(validateWorld(world)).toEqual([]);
    expect(JSON.parse(toJSON(world)).palette.light.cap).toBe("#4a3a2e");
    expect("palette" in house.doc).toBe(false); // a doc without one gains no key
    const cat = createCatalog([...house.packs, tinted(CAPS)], { palette: world.doc.palette });
    expect(cat.palette("light").cap).toBe("#4a3a2e");
    expect(cat.palette("light").ground).toBe("#8d9478");
    const bad = validateWorld(withPalette({ light: { capp: "#4a3a2e" }, dark: { capp: "#3a2e25" } }));
    expect(codes(bad)).toEqual(["world.palette"]);
    expect(bad[0].fix).toContain("cap");
  });

  test("an edit that changes only the palette is a change, and the driver takes it", () => {
    const a = withPalette({ light: { cap: "#4a3a2e" }, dark: { cap: "#3a2e25" } });
    const b = withPalette({ light: { cap: "#5a4a3e" }, dark: { cap: "#3a2e25" } });
    const d = diffWorld(a.doc, b.doc);
    expect([d.same, d.palette, d.lot, d.packs]).toEqual([false, true, false, false]);
    expect(diffWorld(a.doc, a.doc).palette).toBe(false);
    const drv = createDriver(a, { size: { w: 800, h: 600, dpr: 1 } });
    expect(drv.catalog.palette("light").cap).toBe("#4a3a2e");
    expect(drv.apply(b)?.palette).toBe(true);
    expect(drv.catalog.palette("light").cap).toBe("#5a4a3e");
  });
});
