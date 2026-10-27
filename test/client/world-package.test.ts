// The app's side of the @hq/world boundary: code outside the package (the app, scripts, tests, docs/ and every other
// package) reaches packages/world only through its public entries: a bare "@hq/world..." name, or, where there is no
// import map (Bun outside the package), a path to exactly the file an export names. No deep path, no deep name, no
// require, no import() of a computed path. Imports are read with Bun's parser, so no spacing or quoting slips past.
// The page's import map maps exactly public entries to those files; the server serves the package's browser modules only.
import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { packagePath } from "../../src/server/routes/packages.ts";

const ROOT = join(import.meta.dir, "..", "..");
const PKG = join(ROOT, "packages", "world");
const pkg = JSON.parse(readFileSync(join(PKG, "package.json"), "utf8"));
const entries = Object.fromEntries(Object.entries(pkg.exports as Record<string, string>).map(([k, v]) => [k === "." ? pkg.name : `${pkg.name}/${k.slice(2)}`, `/packages/world/${v.slice(2)}`]));
const walk = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (["node_modules", ".git", ".claude"].includes(e.name) || join(dir, e.name) === PKG ? [] : e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));
// Every file a module could be: JS and TS in all their flavours, and HTML (its scripts).
const scanned = (f: string) => /\.(?:[cm]?[jt]sx?|html)$/.test(f);
const appFiles = ["src", "scripts", "test", "bin", "public", "docs", "packages"].filter((d) => existsSync(join(ROOT, d))).flatMap((d) => walk(join(ROOT, d))).concat([join(ROOT, "server.ts"), join(ROOT, "hud.ts")]).filter((f) => scanned(f) && existsSync(f));
// This file states the rules, so its patterns and probes name what they look for; every other file is checked.
const checked = appFiles.filter((f) => f !== import.meta.path);
const targets = new Set(Object.values(pkg.exports as Record<string, string>).map((v) => join(PKG, v)));

// import() of a computed path: allowed only where the app loads its own files by name.
const NON_LITERAL_OK: Record<string, string> = { "src/server/router.ts": "loads its own route files" };

const transpilers = new Map<string, Bun.Transpiler>();
const transpiler = (f: string) => { const l = /\.[cm]?ts$/.test(f) ? "ts" : /\.tsx$/.test(f) ? "tsx" : /\.jsx$/.test(f) ? "jsx" : "js"; if (!transpilers.has(l)) transpilers.set(l, new Bun.Transpiler({ loader: l as any })); return transpilers.get(l)!; };
const scripts = (f: string, text: string) => (f.endsWith(".html") ? [...text.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)].filter((m) => !/importmap/.test(m[1])).map((m) => m[2]) : [text]);
const withoutStrings = (code: string) => code.replace(/(["'`])((?:\\.|(?!\1)[^\\])*)\1/g, (_m, q: string, body: string) => q + " ".repeat(body.length) + q);

/** What in one app file reaches past the package's public entries; [] for a clean file. rel: its path in the repo. */
function boundaryProblems(rel: string, text: string): string[] {
  const bad: string[] = [];
  const f = join(ROOT, rel);
  for (const src of scripts(rel, text)) {
    const t = transpiler(rel);
    for (const { path: s } of t.scan(src).imports) {
      const to = s.startsWith(".") ? resolve(dirname(f), s) : s.startsWith("/packages/") ? join(ROOT, s) : null;
      const intoPkg = (to !== null && to.startsWith(PKG + "/") && !targets.has(to)) || (to === null && s.includes("packages/world/"));
      const deepName = s.startsWith(`${pkg.name}/`) && !entries[s];
      if (intoPkg || deepName) bad.push(`imports ${s} (use ${Object.keys(entries).join(" or ")})`);
    }
    const code = withoutStrings(t.transformSync(src));
    // after the transform a template without ${} is a plain string, so only a quote after "import(" is a literal
    if (/\bimport\s*\(\s*(?!["'])/.test(code) && !NON_LITERAL_OK[rel]) bad.push("import() of a computed path: name a literal public entry");
    if (/\b(?:require|createRequire)\b/.test(code)) bad.push("require: use import");
  }
  return bad;
}

describe("@hq/world from the app", () => {
  test("app code imports the package only through its public entries", () => {
    const bad = checked.flatMap((f) => boundaryProblems(relative(ROOT, f), readFileSync(f, "utf8")).map((p) => `${relative(ROOT, f)}: ${p}`));
    expect(bad).toEqual([]);
  });

  test("the walk reaches docs/ and other packages, the ECS comparison among them", () => {
    expect(appFiles.some((f) => f.includes("/docs/engine/compare/"))).toBe(true);
    expect(appFiles.some((f) => f.startsWith(PKG + "/"))).toBe(false);
  });

  test("the page's import map maps public entries, each to the file the package exports", () => {
    const shell = readFileSync(join(ROOT, "public", "index.html"), "utf8");
    const map: Record<string, string> = JSON.parse(shell.match(/<script type="importmap">([\s\S]*?)<\/script>/)![1]).imports;
    const mapped = Object.entries(map).filter(([k]) => k === pkg.name || k.startsWith(`${pkg.name}/`));
    expect(mapped.length).toBeGreaterThan(0);
    for (const [k, v] of mapped) expect({ k, v }).toEqual({ k, v: entries[k] });
    for (const [, v] of mapped) expect(packagePath(v)).not.toBeNull();
  });

  test("Bun's half of the import map (tsconfig.json paths) maps every public entry to the file the package exports", () => {
    const text = readFileSync(join(ROOT, "tsconfig.json"), "utf8").replace(/^\s*\/\/.*$/gm, "");
    const paths: Record<string, string[]> = JSON.parse(text).compilerOptions.paths;
    const mapped = Object.fromEntries(Object.entries(paths).filter(([k]) => k === pkg.name || k.startsWith(`${pkg.name}/`)));
    expect(mapped).toEqual(Object.fromEntries(Object.entries(entries).map(([k, v]) => [k, [`.${v}`]])));
  });

  test("the server serves the package's browser modules only", () => {
    expect(packagePath("/packages/world/src/index.js")).toBe(join(ROOT, "packages/world/src/index.js"));
    expect(packagePath("/packages/world/packs/starter/chair.js")).not.toBeNull();
    for (const p of ["/packages/world/test/model.test.ts", "/packages/world/tools/serve.ts", "/packages/world/package.json", "/packages/world/lab/index.html", "/packages/world/examples/tiny-house.world.js", "/packages/world/src/../../../hud.db", "/packages/world/src/%2e%2e/x.js"]) expect({ p, served: packagePath(p) }).toEqual({ p, served: null });
  });
});

// Each probe is an app file the boundary must refuse: [path in the repo, its text, what the refusal names].
const DEEP = "packages/world/src/lot/lot.js";
const PROBES: [string, string, RegExp][] = [
  ["src/client/x.js", `import { analyse } from "../../${DEEP}";`, /imports/],
  ["src/client/x.js", `import{analyse}from"../../${DEEP}";`, /imports/],
  ["src/client/x.js", `export*from"../../${DEEP}";`, /imports/],
  ["src/client/x.js", `import "/${DEEP}";`, /imports/],
  ["src/client/x.js", `const m = await import("/${DEEP}");`, /imports/],
  ["src/client/x.js", `import { analyse } from "@hq/world/src/lot/lot.js";`, /imports/],
  ["src/client/x.js", "const base = '/packages/world'; const m = await import(`${base}/src/lot/lot.js`);", /computed path/],
  ["src/server/x.ts", `const lot = require("../../${DEEP}");`, /require/],
  ["src/server/x.ts", `const lot = import.meta.require("../../${DEEP}");`, /require/],
  ["src/client/x.mts", `import { analyse } from "../../${DEEP}";`, /imports/],
  ["scripts/x.cjs", `const lot = require("../${DEEP}");`, /require/],
  ["public/x.html", `<script type="module">import { analyse } from "/${DEEP}";</script>`, /imports/],
];

describe("app boundary probes: each is refused", () => {
  for (const [path, text, why] of PROBES) {
    test(`${path}: ${text}`, () => {
      expect(scanned(path)).toBe(true);
      const problems = boundaryProblems(path, text);
      expect(problems.length).toBeGreaterThan(0);
      expect(problems.join("\n")).toMatch(why);
    });
  }
  test("the public entries stay allowed", () => {
    expect(boundaryProblems("src/client/x.js", `import { createWorld } from "@hq/world"; import { rect } from "@hq/world/model"; const m = await import("@hq/world/packs/starter");`)).toEqual([]);
  });
});
