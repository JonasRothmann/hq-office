// Test helpers that read the package's source: its files, their imports and the names each public entry exports.
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

export const PKG = resolve(import.meta.dir, "..");
export const pkgJson = JSON.parse(readFileSync(join(PKG, "package.json"), "utf8"));

export const walk = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.name === "node_modules" ? [] : e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));

// Every module specifier a file names: static imports and re-exports, side-effect imports, and dynamic imports of a
// string literal.
export function specifiers(code: string): string[] {
  const out: string[] = [];
  for (const m of code.matchAll(/^\s*(?:import|export)\s[^;]*?\sfrom\s*["']([^"']+)["']/gm)) out.push(m[1]);
  for (const m of code.matchAll(/^\s*import\s*["']([^"']+)["']/gm)) out.push(m[1]);
  for (const m of code.matchAll(/\bimport\(\s*["']([^"']+)["']\s*\)/g)) out.push(m[1]);
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
const transpiler = new Bun.Transpiler({ loader: "js" });
export function exportNames(file: string, seen = new Set<string>()): Set<string> {
  const names = new Set<string>();
  if (seen.has(file) || !existsSync(file)) return names;
  seen.add(file);
  const code = readFileSync(file, "utf8");
  for (const n of transpiler.scan(code).exports) names.add(n);
  for (const m of code.matchAll(/^export\s+\*\s+from\s+["']([^"']+)["']/gm)) for (const n of exportNames(resolve(dirname(file), m[1]), seen)) if (n !== "default") names.add(n);
  return names;
}
