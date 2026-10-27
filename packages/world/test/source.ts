// Test helpers that read the package's source: its files, what each one loads (Bun's own parser, not regexes), the
// names each public entry exports, and the boundary rules every file is held to (boundary.test.ts runs them).
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

export const PKG = resolve(import.meta.dir, "..");
export const pkgJson = JSON.parse(readFileSync(join(PKG, "package.json"), "utf8"));

export const walk = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.name === "node_modules" ? [] : e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));

/** Every file a module could be: JS and TS in all their flavours, and HTML (its scripts). */
export const CODE = /\.(?:[cm]?[jt]sx?|html)$/;

const transpilers = new Map<string, Bun.Transpiler>();
const loaderOf = (file: string) => (/\.[cm]?ts$/.test(file) ? "ts" : /\.tsx$/.test(file) ? "tsx" : /\.jsx$/.test(file) ? "jsx" : "js");
const transpiler = (file: string) => { const l = loaderOf(file); if (!transpilers.has(l)) transpilers.set(l, new Bun.Transpiler({ loader: l as any })); return transpilers.get(l)!; };
// An HTML file's code is its scripts (an import map is data, not code).
const scripts = (file: string, text: string) => (file.endsWith(".html") ? [...text.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)].filter((m) => !/importmap/.test(m[1])).map((m) => m[2]) : [text]);

/**
 * What a file loads. specs: every literal specifier (static imports, `export ... from`, side-effect imports, import()
 * of a string or a template without ${}), from Bun's parser. nonLiteral: import() calls whose argument is anything else.
 * requires: every mention of require (require(), require.resolve, import.meta.require, module.require, createRequire).
 */
export function loads(file: string, text: string): { specs: string[]; nonLiteral: number; requires: number } {
  const out = { specs: [] as string[], nonLiteral: 0, requires: 0 };
  for (const src of scripts(file, text)) {
    const t = transpiler(file);
    for (const i of t.scan(src).imports) out.specs.push(i.path);
    const code = withoutStrings(t.transformSync(src));
    // after the transform a template without ${} is a plain string, so only a quote after "import(" is a literal
    out.nonLiteral += [...code.matchAll(/\bimport\s*\(\s*(?!["'])/g)].length;
    out.requires += [...code.matchAll(/\b(?:require|createRequire)\b/g)].length;
  }
  return out;
}

// "@hq/world/model" → the file it maps to, through package.json's exports.
export function exportTarget(spec: string): string | null {
  const name = pkgJson.name as string;
  if (spec !== name && !spec.startsWith(`${name}/`)) return null;
  const key = spec === name ? "." : `./${spec.slice(name.length + 1)}`;
  const rel = pkgJson.exports[key];
  return rel ? join(PKG, rel) : null;
}

// The names a module exports, following `export * from`.
const jsT = new Bun.Transpiler({ loader: "js" });
export function exportNames(file: string, seen = new Set<string>()): Set<string> {
  const names = new Set<string>();
  if (seen.has(file) || !existsSync(file)) return names;
  seen.add(file);
  const code = readFileSync(file, "utf8");
  for (const n of jsT.scan(code).exports) names.add(n);
  for (const m of code.matchAll(/^export\s+\*\s+from\s+["']([^"']+)["']/gm)) for (const n of exportNames(resolve(dirname(file), m[1]), seen)) if (n !== "default") names.add(n);
  return names;
}

/** The code without comments (Bun's transpiler), so a word in a comment never counts; an HTML file's scripts. */
export function codeOf(file: string, text: string): string {
  return scripts(file, text).map((s) => transpiler(file).transformSync(s)).join("\n");
}

// The code with every string's contents blanked (quotes kept), so a word in a message never counts as code.
export function withoutStrings(code: string): string {
  return code.replace(/(["'`])((?:\\.|(?!\1)[^\\])*)\1/g, (_m, q: string, body: string) => q + " ".repeat(body.length) + q);
}

// --- the rules. Each takes a file's path inside the package and its text, and returns what breaks the boundary.

// Where a specifier may point from a file: inside the package, three, builtins outside the runtime code, public
// entries outside src (src uses relative paths, so a public entry never imports itself).
function allowed(rel: string, spec: string) {
  const inSrc = rel.startsWith("src/");
  if (spec.startsWith(".")) return resolve(dirname(join(PKG, rel)), spec).startsWith(PKG + "/");
  if (spec === "three") return true;
  if (/^(node|bun):/.test(spec) || spec === "bun") return !inSrc && !rel.startsWith("packs/");
  if (exportTarget(spec)) return !inSrc;
  return false; // a deep "@hq/world/..." path, an absolute path, another package
}

/** import() of something that is not a plain string: allowed only where loading a file the user names is the point. */
export const LOADS_USER_FILES: Record<string, string> = {
  "tools/check.ts": "checks the world or pack file named on its command line",
  "tools/catalog.ts": "lists the packs named on its command line",
  "lab/index.html": "loads the world named in ?world=",
};

// three.js state every three.js user on the page shares. Runtime code names it only at a listed read, of a value
// that cannot be changed through the read (a string); any other mention (an alias, a write, a call) breaks the rule.
const SHARED_THREE = /\b(?:THREE\s*\.\s*)?(?:ShaderChunk|ShaderLib|UniformsLib|ColorManagement|Cache|DefaultLoadingManager|DEFAULT_UP|DEFAULT_MATRIX_AUTO_UPDATE|DEFAULT_MATRIX_WORLD_AUTO_UPDATE)\b(?:\s*\.\s*\w+)*|\bTHREE\s*\[/g;
export const SHARED_READS: Record<string, string[]> = {
  "src/render/materials.js": ["THREE.ShaderChunk.shadowmap_pars_fragment"], // a string: copied into the engine's own shaders
};
function sharedState(rel: string, code: string): string[] {
  const bad: string[] = [];
  for (const m of code.matchAll(SHARED_THREE)) {
    const expr = m[0].replace(/\s+/g, "");
    const next = code.slice(m.index! + m[0].length).trimStart();
    const read = (SHARED_READS[rel] ?? []).includes(expr) && /^(?:[;,)]|$)/.test(next);
    if (!read) bad.push(`shares three.js state: ${lineAt(code, m.index!)}`);
  }
  return bad;
}

// The page's globals: runtime code (src, packs, examples) never writes them, aliases them or passes them whole.
const ASSIGN = /^\s*(?:[-+*/%&|^]|\*\*|<<|>>>?|&&|\|\||\?\?)?=(?!=)|^\s*(?:\+\+|--)/;
function globalWrites(code: string): string[] {
  const bad: string[] = [];
  // a file that binds the name itself (the starter pack imports its window object as `window`)
  const local = (name: string) => new RegExp(`\\b(?:import|const|let|var)\\s+${name}\\b`).test(code);
  for (const m of code.matchAll(/\b(globalThis|window|self|global)\b/g)) {
    if (code[m.index! - 1] === "." || (m[1] !== "globalThis" && local(m[1]))) continue;
    const after = code.slice(m.index! + m[0].length);
    const member = /^(?:\.\w+|\[[^\]]+\])/.exec(after);
    if (m[1] === "globalThis" || !member || ASSIGN.test(after.slice(member[0].length))) bad.push(`writes a global: ${lineAt(code, m.index!)}`);
  }
  return bad;
}

// The page's own state: runtime code never touches storage, the URL, the history or the document, except to make a
// canvas (textures drawn in code).
function pageState(code: string): string[] {
  const bad: string[] = [];
  for (const m of code.matchAll(/(?<![.\w$])(localStorage|sessionStorage|indexedDB|cookieStore|history|location|navigator|document)\b/g)) {
    if (m[1] === "document" && /^\s*\.\s*createElement\s*\(/.test(code.slice(m.index! + m[0].length))) continue;
    bad.push(`touches the page: ${lineAt(code, m.index!)}`);
  }
  return bad;
}

const lineAt = (text: string, i: number) => text.slice(text.lastIndexOf("\n", i) + 1, (text.indexOf("\n", i) + 1 || text.length + 1) - 1).trim();

/** Everything in one file that breaks the package's boundary; [] for a clean file. rel: its path in the package. */
export function boundaryProblems(rel: string, text: string): string[] {
  const bad: string[] = [];
  const l = loads(rel, text);
  for (const spec of l.specs) if (!allowed(rel, spec)) bad.push(`imports ${spec}`);
  if (l.nonLiteral && !LOADS_USER_FILES[rel]) bad.push(`import() of a non-literal ${l.nonLiteral}×: import a literal path inside the package`);
  if (l.requires) bad.push(`require ${l.requires}×: use import`);
  const code = withoutStrings(codeOf(rel, text));
  bad.push(...sharedState(rel, code));
  if (/^(src|packs|examples)\//.test(rel)) bad.push(...globalWrites(code), ...pageState(code));
  return bad;
}
