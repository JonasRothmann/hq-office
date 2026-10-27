// The package's boundary: it imports nothing from outside itself but `three` (and node:/bun: builtins in tools and
// tests), statically, with import() or with require; src/ reaches its own files only by relative paths; packs and
// examples use the public entries; nothing changes three.js's shared state, the page's globals or the page itself;
// tests never read the agents' sandbox (examples/); the package names no host concept; every file opens with a
// comment; every import links. The rules live in source.ts; the probes below are ways past them that once worked.
import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { PKG, CODE, walk, loads, exportTarget, exportNames, codeOf, boundaryProblems } from "./source.ts";

const files = walk(PKG).filter((f) => CODE.test(f));
const rel = (f: string) => relative(PKG, f);
// The files that state these rules name what they look for; every other file is checked.
const RULES = new Set(["test/boundary.test.ts", "test/source.ts"]);
const checked = files.filter((f) => !RULES.has(rel(f)));

describe("package boundary", () => {
  test("there are files to check", () => expect(checked.length).toBeGreaterThan(20));

  for (const f of checked) {
    test(`${rel(f)} stays inside the package and leaves shared state alone`, () => {
      expect({ file: rel(f), problems: boundaryProblems(rel(f), readFileSync(f, "utf8")) }).toEqual({ file: rel(f), problems: [] });
    });
  }

  test("the pure half (everything @hq/world/model reaches, and the view's driver) never imports three", () => {
    const pure = /^src\/(model|catalog|nav|lot|anim|camera|arch|lint|sim|view)\//;
    const bad = files.filter((f) => pure.test(rel(f)) && loads(f, readFileSync(f, "utf8")).specs.includes("three")).map(rel);
    expect(bad).toEqual([]);
  });

  test("tests and the proof never read examples/ (agents edit it freely): they use test/fixtures", () => {
    const bad = checked.filter((f) => (rel(f).startsWith("test/") || rel(f) === "tools/proof.ts") && /examples\//.test(codeOf(f, readFileSync(f, "utf8")))).map(rel);
    expect(bad).toEqual([]);
  });

  test("the package names no host concept (lanes, asks, the bus, herdr)", () => {
    const words = /\b(lanes?|asks?|herdr|hud\.db|core\/bus)\b/i;
    const bad = files.filter((f) => !rel(f).startsWith("test/")).flatMap((f) => readFileSync(f, "utf8").split("\n").map((l, i) => [rel(f), i + 1, l] as const).filter(([, , l]) => words.test(l)));
    expect(bad).toEqual([]);
  });

  test("every file opens with a comment saying what it is for", () => {
    const bad = files.filter((f) => {
      const code = readFileSync(f, "utf8");
      if (f.endsWith(".html")) return !/^<!doctype html>\n<!-- /.test(code);
      return !(code.startsWith("//") || code.startsWith("#!/usr/bin/env bun\n//"));
    }).map(rel);
    expect(bad).toEqual([]);
  });

  test("every relative import names a file that exists and the names it exports", () => {
    const problems: string[] = [];
    for (const f of files.filter((f) => f.endsWith(".js"))) {
      const code = readFileSync(f, "utf8");
      for (const m of code.matchAll(/^import\s+(?:([\w$]+)\s*,?\s*)?(?:\{([^}]*)\}\s*)?from\s*["']([^"']+)["']/gm)) {
        const spec = m[3];
        const to = spec.startsWith(".") ? resolve(dirname(f), spec) : exportTarget(spec);
        if (!to) continue; // three
        if (!existsSync(to)) { problems.push(`${rel(f)}: ${spec} does not exist`); continue; }
        const names = exportNames(to);
        for (const n of (m[2] ?? "").split(",").map((s) => s.trim().split(/\s+as\s+/)[0]).filter(Boolean)) if (!names.has(n)) problems.push(`${rel(f)}: ${spec} does not export ${n}`);
        if (m[1] && !names.has("default")) problems.push(`${rel(f)}: ${spec} has no default export`);
      }
    }
    expect(problems).toEqual([]);
  });
});

// Each probe is a file the boundary must refuse: [path in the package, its text, what the refusal names].
const OUT = "../../../src/client/core/net.js";
const PROBES: [string, string, RegExp][] = [
  ["src/x.js", `import { post } from "${OUT}";`, /imports/],
  ["src/x.js", `import{post}from"${OUT}";`, /imports/],
  ["src/x.js", `export*from"${OUT}";`, /imports/],
  ["src/x.js", `export { post } from "${OUT}";`, /imports/],
  ["src/x.js", `import "${OUT}";`, /imports/],
  ["src/x.js", `const m = await import("${OUT}");`, /imports/],
  ["src/x.js", "const m = await import(`" + OUT + "`);", /imports/],
  ["src/x.js", "const base = '../../..'; const m = await import(`${base}/src/server/db.ts`);", /non-literal/],
  ["src/x.js", "const name = './y.js'; const m = await import(name);", /non-literal/],
  ["src/x.mts", `import { post } from "${OUT}";`, /imports/],
  ["src/x.cjs", `const db = require("../../../src/server/db.ts");`, /require/],
  ["tools/x.ts", `const db = require("../../../src/server/db.ts");`, /require/],
  ["test/x.test.ts", `const db = import.meta.require("../../../src/server/db.ts");`, /require/],
  ["tools/x.ts", `import { createRequire } from "node:module"; const r = createRequire(import.meta.url); r("x");`, /require/],
  ["src/x.js", `import { x } from "@hq/world/src/lot/lot.js";`, /imports/],
  ["src/x.js", `import fs from "node:fs";`, /imports/],
  ["lab/x.html", `<!doctype html>\n<!-- x -->\n<script type="module">import { post } from "../${OUT}";</script>`, /imports/],
  ["src/render/x.js", `import * as THREE from "three"; THREE.ShaderChunk.common = "";`, /three\.js state/],
  ["src/render/x.js", `import * as THREE from "three"; const s = THREE.ShaderLib.standard; s.fragmentShader = "";`, /three\.js state/],
  ["src/render/x.js", `import { ShaderLib } from "three"; const s = ShaderLib.standard; s.fragmentShader = "";`, /three\.js state/],
  ["src/render/x.js", `import * as THREE from "three"; THREE.Object3D.DEFAULT_UP.set(0, 0, 1);`, /three\.js state/],
  ["src/render/x.js", `import * as THREE from "three"; THREE.Cache.enabled = true;`, /three\.js state/],
  ["src/render/x.js", `import * as THREE from "three"; THREE["Cache"].enabled = true;`, /three\.js state/],
  ["src/render/x.js", `import * as THREE from "three"; THREE.ColorManagement.enabled = false;`, /three\.js state/],
  ["src/render/materials.js", `import * as THREE from "three"; THREE.ShaderChunk.shadowmap_pars_fragment = "";`, /three\.js state/],
  ["src/x.js", `globalThis.world = 1;`, /global/],
  ["src/x.js", `window.world = 1;`, /global/],
  ["src/x.js", `document.title = "x";`, /page/],
  ["src/x.js", `localStorage.setItem("k", "v");`, /page/],
  ["src/x.js", `const d = document; d.title = "x";`, /page/],
  ["src/x.js", `history.pushState(null, "", "/x");`, /page/],
];

describe("boundary probes: each is refused", () => {
  for (const [path, text, why] of PROBES) {
    test(`${path}: ${text.split("\n").pop()}`, () => {
      const problems = boundaryProblems(path, text);
      expect(problems.length).toBeGreaterThan(0);
      expect(problems.join("\n")).toMatch(why);
    });
  }
  test("the clean reads stay allowed: a literal import inside the package, three, and the listed shared read", () => {
    expect(boundaryProblems("src/x.js", `import { a } from "./y.js"; import * as THREE from "three"; const m = await import("./z.js");`)).toEqual([]);
    expect(boundaryProblems("src/render/materials.js", `import * as THREE from "three"; const chunk = THREE.ShaderChunk.shadowmap_pars_fragment;`)).toEqual([]);
    expect(boundaryProblems("src/render/x.js", `const c = document.createElement("canvas");`)).toEqual([]);
  });
});
