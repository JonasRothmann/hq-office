// Packs: every object file in a pack folder is listed in its index.js, ids are namespaced by pack, checkPack finds
// nothing wrong, and two packs claiming one id is an error naming both.
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { checkPack, createCatalog, definePack, defineObject } from "@hq/world/model";
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
});
