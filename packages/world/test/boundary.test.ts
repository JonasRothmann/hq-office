// The package's boundary: it imports nothing from outside itself but `three` (and node:/bun: builtins in tools and
// tests), statically or with import(); src/ reaches its own files only by relative paths; packs and examples use the
// public entries; nothing changes three.js's shared state or writes globals; tests never read the agents' sandbox
// (examples/); the package names no host concept; every file opens with a comment; every import links.
import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { dirname, extname, relative, resolve } from "node:path";
import { PKG, walk, specifiers, exportTarget, exportNames, codeOf, dynamicImports, withoutStrings } from "./source.ts";

const files = walk(PKG).filter((f) => [".js", ".ts", ".html"].includes(extname(f)));
const rel = (f: string) => relative(PKG, f);
const code = new Map(files.map((f) => [f, codeOf(f, readFileSync(f, "utf8"))]));
// The files that state these rules name what they look for; every other file is checked.
const RULES = new Set(["test/boundary.test.ts", "test/source.ts"]);
const checked = files.filter((f) => !RULES.has(rel(f)));

// Where a specifier may point from file f (static or dynamic): inside the package, three, builtins outside the runtime
// code, public entries outside src.
function allowed(f: string, spec: string) {
  const inSrc = rel(f).startsWith("src/");
  if (spec.startsWith(".")) return resolve(dirname(f), spec).startsWith(PKG + "/");
  if (spec === "three") return true;
  if (/^(node|bun):/.test(spec) || spec === "bun") return !inSrc && !rel(f).startsWith("packs/");
  if (exportTarget(spec)) return !inSrc; // src uses relative paths, so a public entry never imports itself
  return false; // a deep "@hq/world/..." path, an absolute path, another package
}

// import() of something that is not a plain string: allowed only where loading a file the user names is the point.
const LOADS_USER_FILES: Record<string, string> = {
  "tools/check.ts": "checks the world or pack file named on its command line",
  "tools/catalog.ts": "lists the packs named on its command line",
  "lab/index.html": "loads the world named in ?world=",
};

// three.js state every three.js user on the page shares: only ever read a member, never assign, alias or pass it.
const SHARED_THREE = /\b(ShaderChunk|ShaderLib|UniformsLib|ColorManagement)\b/g;
const ASSIGN = /^\s*(?:[-+*/%&|^]|\*\*|<<|>>>?|&&|\|\||\?\?)?=(?!=)|^\s*(?:\+\+|--)/;
const lineAt = (text: string, i: number) => text.slice(text.lastIndexOf("\n", i) + 1, (text.indexOf("\n", i) + 1 || text.length + 1) - 1).trim();
function sharedStateWrites(text: string): string[] {
  const bad: string[] = [];
  for (const m of text.matchAll(SHARED_THREE)) {
    const after = text.slice(m.index! + m[0].length), before = text.slice(Math.max(0, m.index! - 14), m.index!);
    const member = /^(?:\.\w+|\[\s*["'`]\w+["'`]\s*\])/.exec(after);
    if (!member || ASSIGN.test(after.slice(member[0].length)) || /(?:\bdelete|\+\+|--)\s*(?:THREE\.)?$/.test(before)) bad.push(lineAt(text, m.index!));
  }
  return bad;
}

// The page's globals: runtime code (src, packs, examples) never writes them, aliases them or passes them whole.
function globalWrites(text: string): string[] {
  const bad: string[] = [];
  // a file that binds the name itself (the starter pack imports its window object as `window`)
  const local = (name: string) => new RegExp(`\\b(?:import|const|let|var)\\s+${name}\\b`).test(text);
  for (const m of text.matchAll(/\b(globalThis|window|self|global)\b/g)) {
    if (text[m.index! - 1] === "." || (m[1] !== "globalThis" && local(m[1]))) continue;
    const after = text.slice(m.index! + m[0].length);
    const member = /^(?:\.\w+|\[[^\]]+\])/.exec(after);
    if (m[1] === "globalThis" || !member || ASSIGN.test(after.slice(member[0].length))) bad.push(lineAt(text, m.index!));
  }
  return bad;
}

describe("package boundary", () => {
  test("there are files to check", () => expect(files.length).toBeGreaterThan(20));

  for (const f of files) {
    test(`${rel(f)} imports only inside the package, or three, statically and with import()`, () => {
      for (const spec of specifiers(readFileSync(f, "utf8"))) expect({ file: rel(f), spec, ok: allowed(f, spec) }).toEqual({ file: rel(f), spec, ok: true });
      for (const spec of RULES.has(rel(f)) ? [] : dynamicImports(code.get(f)!)) {
        if (spec === null) expect({ file: rel(f), "import(non-literal)": LOADS_USER_FILES[rel(f)] ?? "not allowed: import a literal path inside the package" }).toEqual({ file: rel(f), "import(non-literal)": LOADS_USER_FILES[rel(f)] ?? "allowed" });
        else expect({ file: rel(f), spec, ok: allowed(f, spec) }).toEqual({ file: rel(f), spec, ok: true });
      }
    });
  }

  test("the pure half (everything @hq/world/model reaches, and the view's driver) never imports three", () => {
    const pure = /^src\/(model|catalog|nav|lot|anim|camera|arch|lint|sim|view)\//;
    const bad = files.filter((f) => pure.test(rel(f)) && specifiers(readFileSync(f, "utf8")).includes("three")).map(rel);
    expect(bad).toEqual([]);
  });

  test("nothing changes three.js's shared state (ShaderChunk, ShaderLib, UniformsLib, ColorManagement): members are only read", () => {
    const bad = checked.flatMap((f) => sharedStateWrites(withoutStrings(code.get(f)!)).map((l) => `${rel(f)}: ${l}`));
    expect(bad).toEqual([]);
  });

  test("runtime code (src, packs, examples) never writes the page's globals (globalThis, window, self)", () => {
    const runtime = files.filter((f) => /^(src|packs|examples)\//.test(rel(f)));
    expect(runtime.length).toBeGreaterThan(20);
    const bad = runtime.flatMap((f) => globalWrites(withoutStrings(code.get(f)!)).map((l) => `${rel(f)}: ${l}`));
    expect(bad).toEqual([]);
  });

  test("tests and the proof never read examples/ (agents edit it freely): they use test/fixtures", () => {
    const bad = checked.filter((f) => (rel(f).startsWith("test/") || rel(f) === "tools/proof.ts") && /examples\//.test(code.get(f)!)).map(rel);
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
