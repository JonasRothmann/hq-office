// Every client module links the way a browser will link it: each import names a file that exists and names that
// file exports (a bare name, such as "three" in a vendored addon, through the shell's import map), every module is
// reached from main.js or a feature's index.js, and every file opens with a comment saying what it is for. A browser fails on the first of these after a module moves or a name changes; this test
// fails first, with the file and the name.
import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const ROOT = join(import.meta.dir, "..", "..");
const CLIENT = join(ROOT, "src", "client");
const walk = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));
const files = walk(CLIENT);
const modules = files.filter((f) => f.endsWith(".js"));
const transpiler = new Bun.Transpiler({ loader: "js" });
const name = (f: string) => relative(CLIENT, f);
const SHELL = readFileSync(join(ROOT, "public", "index.html"), "utf8");
const importMap: Record<string, string> = JSON.parse(SHELL.match(/<script type="importmap">([\s\S]*?)<\/script>/)?.[1] ?? "{}").imports ?? {};
// Where a browser finds an import: next to the importing file, or a bare name through the import map.
const target = (from: string, spec: string) => (spec.startsWith(".") ? resolve(dirname(from), spec) : importMap[spec] ? join(ROOT, importMap[spec]) : null);

type Import = { spec: string; names: string[]; def: string | null };
function importsOf(code: string): Import[] {
  const out: Import[] = [];
  for (const m of code.matchAll(/^import\s+(?:([\w$]+)\s*,?\s*)?(?:\{([^}]*)\}\s*)?(?:from\s*)?(["'])([^"']+)\3;/gm)) {
    const names = (m[2] ?? "").split(",").map((s) => s.trim()).filter(Boolean).map((s) => s.split(/\s+as\s+/)[0]);
    out.push({ spec: m[4], names, def: m[1] ?? null });
  }
  return out;
}

// A dynamic import with a literal path (the world's modules are loaded this way, only when the world starts).
const dynamicOf = (code: string) => [...code.matchAll(/\bimport\(\s*(["'])([^"']+)\1\s*\)/g)].map((m) => m[2]);

// A module's exported names, read when first asked: page modules, and a package's public entry reached through the
// import map (packages/world), following its `export * from`.
const exportsOf = new Map<string, Set<string>>();
function exportsFor(f: string): Set<string> {
  if (exportsOf.has(f)) return exportsOf.get(f)!;
  const code = readFileSync(f, "utf8");
  const names = new Set(transpiler.scan(code).exports);
  exportsOf.set(f, names);
  for (const m of code.matchAll(/^export\s+\*\s+from\s+["']([^"']+)["']/gm)) for (const n of exportsFor(resolve(dirname(f), m[1]))) if (n !== "default") names.add(n);
  return names;
}

describe("client modules", () => {
  test("there are modules, and main.js is one of them", () => {
    expect(modules.length).toBeGreaterThan(10);
    expect(existsSync(join(CLIENT, "main.js"))).toBe(true);
  });

  for (const f of modules) {
    test(`${name(f)} links`, () => {
      const code = readFileSync(f, "utf8");
      expect(code.startsWith("//")).toBe(true);
      for (const imp of importsOf(code)) {
        // no packages: the browser loads files as they are, and a bare name only through the import map
        const to = target(f, imp.spec);
        expect({ from: name(f), spec: imp.spec, mapped: !!to }).toEqual({ from: name(f), spec: imp.spec, mapped: true });
        expect({ from: name(f), spec: imp.spec, exists: existsSync(to!) }).toEqual({ from: name(f), spec: imp.spec, exists: true });
        const exported = exportsFor(to!);
        for (const n of imp.names) expect({ from: name(f), to: name(to!), name: n, exported: exported.has(n) }).toEqual({ from: name(f), to: name(to!), name: n, exported: true });
        if (imp.def) expect({ from: name(f), to: name(to!), default: exported.has("default") }).toEqual({ from: name(f), to: name(to!), default: true });
      }
      for (const spec of dynamicOf(code)) expect({ from: name(f), spec, exists: existsSync(target(f, spec) ?? "") }).toEqual({ from: name(f), spec, exists: true });
    });
  }

  test("every module is loaded by the page", () => {
    const entries = [join(CLIENT, "main.js"), ...modules.filter((f) => /^[^/]+\/index\.js$/.test(name(f)))];
    const seen = new Set<string>();
    const visit = (f: string) => {
      if (seen.has(f)) return;
      seen.add(f);
      const code = readFileSync(f, "utf8");
      for (const spec of [...importsOf(code).map((i) => i.spec), ...dynamicOf(code)]) { const to = target(f, spec); if (to) visit(to); }
    };
    entries.forEach(visit);
    expect(modules.filter((f) => !seen.has(f)).map(name)).toEqual([]);
  });

  test("every stylesheet opens with a comment", () => {
    for (const f of files.filter((f) => f.endsWith(".css"))) expect({ file: name(f), comment: readFileSync(f, "utf8").startsWith("/*") }).toEqual({ file: name(f), comment: true });
  });

  test("the shell loads main.js and leaves room for styles and features", () => {
    const shell = SHELL;
    expect(shell).toContain(`<script type="module" src="/src/client/main.js"></script>`);
    expect(shell).toContain("<!-- styles -->");
    expect(shell).toContain("<!-- features -->");
    expect(shell).not.toMatch(/<script>|\son[a-z]+="/); // no inline script or handler: modules do not share globals
    expect(importMap.three).toBe("/src/client/vendor/three/three.module.min.js");
  });
});
