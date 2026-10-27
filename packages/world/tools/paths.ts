// How every tool reads paths, so they agree: a file argument is relative to the current directory, wherever that is;
// the folder the lab serves (for shot.ts and proof.ts) is the nearest one that holds the world and every file it
// imports (its packs, their objects), unless --root names one. Outputs print relative to the current directory when
// they are under it, else in full.
import { existsSync, readFileSync } from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";

export const fileArg = (p: string) => resolve(process.cwd(), p);

export const shown = (p: string) => { const r = relative(process.cwd(), p); return r && !r.startsWith("..") ? r : p; };

const scanner = new Bun.Transpiler({ loader: "js" });

// The world (or pack) files and every file they import by a relative path, transitively.
export function importedFiles(files: string[]): string[] {
  const seen = new Set<string>();
  const queue = files.map((f) => resolve(f));
  while (queue.length) {
    const f = queue.pop()!;
    if (seen.has(f) || !existsSync(f)) continue;
    seen.add(f);
    for (const imp of scanner.scanImports(readFileSync(f, "utf8"))) if (imp.path.startsWith(".")) queue.push(resolve(dirname(f), imp.path));
  }
  return [...seen];
}

// The deepest folder that holds every one of these files.
export function commonRoot(files: string[]): string {
  const parts = files.map((f) => dirname(f).split(sep));
  const out: string[] = [];
  for (let i = 0; parts.every((p) => i < p.length && p[i] === parts[0][i]); i++) out.push(parts[0][i]);
  return out.join(sep) || sep;
}

// What the lab serves for these files: --root if given, else the folder that holds them and all they import.
export const rootFor = (files: string[], flag?: string) => (flag ? fileArg(flag) : commonRoot(importedFiles(files.map(fileArg))));
