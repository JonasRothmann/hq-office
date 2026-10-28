// Packs: every object file in a pack folder is listed in its index.js, ids are namespaced by pack, checkPack finds
// nothing wrong, two packs claiming one id is an error naming both, unknown colour tokens and clips are named with the
// fix, and palettes are per theme and per pack, so two packs never overwrite each other's colours.
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { checkPack, createCatalog, definePack, defineObject, buildPrims, validateWorld, defineWorld, PALETTES } from "@hq/world/model";
import starter from "@hq/world/packs/starter";
import { packFileProblems } from "../tools/pack-files.ts";

const DIR = join(import.meta.dir, "..", "packs", "starter");

describe("packs", () => {
  test("the starter pack checks clean", () => {
    expect(checkPack(starter)).toEqual([]);
    expect(packFileProblems(DIR)).toEqual([]);
  });

  test("ids are prefixed with the pack's id; every file is one object", () => {
    expect(starter.objects.every((o: any) => o.id.startsWith("starter/"))).toBe(true);
    const files = readdirSync(DIR).filter((f) => f.endsWith(".js") && f !== "index.js");
    expect(files.length).toBe(starter.objects.length);
    for (const f of files) expect(readFileSync(join(DIR, f), "utf8")).toContain(`id: "${f.replace(/\.js$/, "")}"`);
  });

  test("a file missing from index.js is named, with the line to add", () => {
    const fake = { "index.js": `import a from "./a.js";\nexport default definePack({ id: "p", objects: [a] });`, "a.js": "", "sofa.js": "" };
    const problems = packFileProblems("/nowhere", fake);
    expect(problems.map((p) => p.code)).toEqual(["pack.unlisted"]);
    expect(problems[0].fix).toContain(`import sofa from "./sofa.js"`);
  });

  test("two packs defining one id is an error naming both", () => {
    const a = definePack({ id: "a", objects: [defineObject({ id: "x", kind: "floor", color: "oak" })] });
    const b = definePack({ id: "b", objects: [defineObject({ id: "a/x", kind: "floor", color: "oak" })] });
    const c = createCatalog([a, b]);
    expect(c.problems.map((p: any) => p.code)).toEqual(["catalog.duplicate"]);
    expect(c.problems[0].message).toContain("'a'");
    expect(c.problems[0].message).toContain("'b'");
  });

  test("an object built past its footprint, in centimetres, or with flat parts lying on each other, is caught", () => {
    const bad = definePack({ id: "bad", objects: [
      defineObject({ id: "wide", footprint: [1, 1], build(k: any) { k.box("top", [1.2, 0.04, 0.6], [0, 0.7, 0], "wood"); } }),
      defineObject({ id: "cm", footprint: [1, 1], build(k: any) { k.box("top", [45, 4, 45], [0, 0, 0], "wood"); } }),
      defineObject({ id: "rug", footprint: [1, 1], build(k: any) { k.box("base", [0.8, 0.02, 0.8], [0, 0, 0], "wood"); k.box("rug", [0.6, 0.02, 0.6], [0, 0, 0], "fabric"); } }),
    ] });
    const codes = checkPack(bad).map((p: any) => p.code);
    expect(codes).toContain("prim.outside");
    expect(codes).toContain("prim.units");
    expect(codes).toContain("prim.coplanar");
  });

  // the reviewer's probe: a 2×1 sofa with a misspelt colour and a misspelt clip
  const sofa = defineObject({ id: "sofa", footprint: [2, 1], height: 0.8, tags: ["seat"],
    slots: { left: { at: [-0.5, 0], y: 0.42, facing: "s", stand: [[0, 1]], clip: "sit" }, right: { at: [0.5, 0], y: 0.42, facing: "s", stand: [[0, 1]], clip: "sitt" } },
    build(k: any) { k.box("base", [1.9, 0.4, 0.8], [0, 0, 0], "fabirc"); k.box("back", [1.9, 0.4, 0.2], [0, 0.4, -0.3], "fabric"); } });

  test("an unknown colour token or clip is an error that names the fix, in checkPack and in validateWorld", () => {
    const mine = definePack({ id: "mine", objects: [sofa] });
    const problems = checkPack(mine).map((p: any) => [p.code, p.path, p.fix]);
    expect(problems).toEqual([
      ["color.token", "mine.objects[0] (mine/sofa) part 'base'", "did you mean fabric?"],
      ["clip.unknown", "mine.objects[0] (mine/sofa) slot 'right'.clip", "did you mean sit?"],
    ]);
    const world = defineWorld({ id: "w", packs: [starter, mine], lot: { w: 6, d: 6 }, objects: [{ id: "s", type: "mine/sofa", at: [1, 1] }] });
    expect(validateWorld(world).map((p: any) => p.code)).toEqual(["color.token", "clip.unknown"]);
  });

  test("a pack's palette has light and dark maps with the same tokens; a flat map or a missing theme names the fix", () => {
    const flat = definePack({ id: "f", objects: [], palette: { teal: "#118899" } as any });
    expect(checkPack(flat).map((p: any) => p.code)).toEqual(["pack.palette"]);
    expect(checkPack(flat)[0].fix).toContain("palette: { light: {");
    const bad = definePack({ id: "h", objects: [], palette: { light: { teal: "#118899", sand: "#ddccaa" }, dark: { teal: "#0c5560", sand: "beige" } } });
    expect(checkPack(bad).map((p: any) => p.message)).toEqual(['"beige" is not a hex colour']);
    const odd = definePack({ id: "o", objects: [], palette: { light: { teal: "#118899" }, dark: {} } });
    expect(checkPack(odd).map((p: any) => p.fix)).toEqual(['add "teal": "#hex" to palette.dark']);
  });

  test("two packs with a token of the same name keep their own colours, per theme", () => {
    const mk = (id: string, light: string, dark: string) => definePack({ id, palette: { light: { oak: light }, dark: { oak: dark } }, objects: [
      defineObject({ id: "block", footprint: [1, 1], build(k: any) { k.box("b", [0.5, 0.5, 0.5], [0, 0, 0], "oak"); } }),
      defineObject({ id: "floor", kind: "floor", color: "oak" }),
    ] });
    const a = mk("a", "#aa0000", "#550000"), b = mk("b", "#00aa00", "#005500");
    expect(checkPack(a)).toEqual([]);
    const cat = createCatalog([starter, a, b]);
    const light = cat.palette("light"), dark = cat.palette("dark");
    expect([light["a/oak"], light["b/oak"], dark["a/oak"], dark["b/oak"]]).toEqual(["#aa0000", "#00aa00", "#550000", "#005500"]);
    expect(light.oak).toBe(PALETTES.light.oak); // the engine's own oak is untouched
    expect(buildPrims(cat.get("a/block"))[0].color).toBe("a/oak");
    expect(buildPrims(cat.get("b/block"))[0].color).toBe("b/oak");
    expect([cat.get("a/floor").color, cat.get("b/floor").color]).toEqual(["a/oak", "b/oak"]);
    expect(buildPrims(cat.get("starter/chair")).some((p: any) => p.color === "wood")).toBe(true); // engine tokens stay bare
  });
});
