// The tools an agent uses, from outside the package: a pack and a world in a folder of their own check from any
// working directory; the lab serves the folder that holds a world and everything it imports; --map draws the lot.
import { describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildLot, lotMap } from "@hq/world/model";
import { rootFor, importedFiles } from "../tools/paths.ts";
import house from "./fixtures/house.world.js";

const CHECK = join(import.meta.dir, "..", "tools", "check.ts");

// A host folder: worlds/den.world.js imports packs/cozy/index.js, which imports its sofa.
function hostFolder() {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), "hq-world-host-")));
  mkdirSync(join(dir, "packs", "cozy"), { recursive: true });
  mkdirSync(join(dir, "worlds"));
  writeFileSync(join(dir, "packs", "cozy", "sofa.js"), `// A sofa.\nimport { defineObject } from "@hq/world/model";\nexport default defineObject({ id: "sofa", footprint: [2, 1], height: 0.6, slots: { left: { at: [-0.45, 0.1], y: 0.45, facing: "s", stand: [[0, 1]], clip: "sit" } }, build(k) { k.box("base", [1.8, 0.45, 0.8], [0, 0, 0], "sofa"); } });\n`);
  writeFileSync(join(dir, "packs", "cozy", "index.js"), `// The cozy pack.\nimport { definePack } from "@hq/world/model";\nimport sofa from "./sofa.js";\nexport default definePack({ id: "cozy", palette: { light: { sofa: "#7d9a8c" }, dark: { sofa: "#6f8a7e" } }, objects: [sofa] });\n`);
  writeFileSync(join(dir, "worlds", "den.world.js"), `// The den.\nimport { defineWorld, rect } from "@hq/world/model";\nimport starter from "@hq/world/packs/starter";\nimport cozy from "../packs/cozy/index.js";\nexport default defineWorld({ id: "den", packs: [starter, cozy], lot: { w: 8, d: 6 }, floors: [{ rect: [1, 1, 6, 4], finish: "starter/oak" }], walls: [{ path: rect(1, 1, 6, 4) }], openings: [{ type: "starter/door", at: [3, 4], side: "s" }], objects: [{ id: "sofa-1", type: "cozy/sofa", at: [2, 2] }, { id: "sofa-2", type: "cozy/sofa", at: [4, 2] }] });\n`);
  return dir;
}
const check = async (cwd: string, ...args: string[]) => {
  const p = Bun.spawn(["bun", CHECK, ...args], { cwd, stdout: "pipe", stderr: "pipe" });
  const out = (await new Response(p.stdout).text()) + (await new Response(p.stderr).text());
  return { code: await p.exited, out };
};

describe("tools from outside the package", () => {
  test("a host pack and a world placing two of its sofas check clean from any working directory", async () => {
    const dir = hostFolder();
    try {
      for (const [cwd, world, pack] of [[dir, "worlds/den.world.js", "packs/cozy/index.js"], [join(dir, "worlds"), "den.world.js", "../packs/cozy/index.js"], [tmpdir(), join(dir, "worlds/den.world.js"), join(dir, "packs/cozy/index.js")]]) {
        const r = await check(cwd, pack, world, "--map");
        expect({ cwd, code: r.code }).toEqual({ cwd, code: 0 });
        expect(r.out).toContain("pack cozy");
        expect(r.out).toContain("world den");
        expect(r.out).toMatch(/a  sofa-1 \(cozy\/sofa\) at \(2,2\)/);
      }
    } finally { rmSync(dir, { recursive: true, force: true }); }
  }, 60_000);

  test("a .mjs world checks like a .js one; a .ts world is refused with the extensions check.ts takes", async () => {
    const dir = hostFolder();
    try {
      writeFileSync(join(dir, "worlds", "den.world.mjs"), await Bun.file(join(dir, "worlds", "den.world.js")).text());
      writeFileSync(join(dir, "worlds", "den.world.ts"), await Bun.file(join(dir, "worlds", "den.world.js")).text());
      const mjs = await check(dir, "worlds/den.world.mjs");
      expect({ code: mjs.code, ok: mjs.out.includes("world den") }).toEqual({ code: 0, ok: true });
      const ts = await check(dir, "worlds/den.world.ts");
      expect(ts.code).toBe(2);
      expect(ts.out).toContain("worlds/den.world.ts: world and pack files are .js or .mjs");
      expect(ts.out).toContain("rename it to worlds/den.world.js");
    } finally { rmSync(dir, { recursive: true, force: true }); }
  }, 60_000);

  test("the lab serves the folder that holds the world and every file it imports", () => {
    const dir = hostFolder();
    try {
      expect(importedFiles([join(dir, "worlds/den.world.js")]).sort()).toEqual([join(dir, "packs/cozy/index.js"), join(dir, "packs/cozy/sofa.js"), join(dir, "worlds/den.world.js")]);
      expect(rootFor([join(dir, "worlds/den.world.js")])).toBe(dir);
      expect(rootFor([join(dir, "packs/cozy/sofa.js")])).toBe(join(dir, "packs/cozy"));
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test("--map draws walls, doors, windows, objects and characters where they are", () => {
    const map = lotMap(buildLot(house).lot).split("\n");
    expect(map[0]).toBe("      0 1 2 3 4 5 6 7 8 9 0 1 2 3");
    expect(map.slice(5, 9)).toEqual([
      "         +-+-+W+-+-+-+-+W+-+-+",
      "  2   , ,|d . . . .|. . . . h|, ,",
      "         +         +         +",
      "  3   , ,|. a a c .|. . . . .|, ,",
    ]);
    expect(map).toContain("  5   , ,|. . . . .D. . . . .|, ,"); // the inner door on tile (6,5)'s east edge
    expect(map).toContain("  7   , ,|. . . . .|. . 1 . .|, ,"); // ada
    expect(map).toContain("a  desk-1 (starter/desk) at (3,3) facing s, covers (3,3) (4,3)");
  });
});
