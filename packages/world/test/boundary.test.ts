// The package's boundary: it imports nothing from outside itself but `three` (and node:/bun: builtins in tools and
// tests); src/ reaches its own files only by relative paths; packs and examples use the public entries; nothing
// mutates three.js globals; the package names no host concept; every file opens with a comment; every import links.
import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { dirname, extname, relative, resolve } from "node:path";
import { PKG, walk, specifiers, exportTarget, exportNames } from "./source.ts";

const files = walk(PKG).filter((f) => [".js", ".ts", ".html"].includes(extname(f)));
const rel = (f: string) => relative(PKG, f);

describe("package boundary", () => {
  test("there are files to check", () => expect(files.length).toBeGreaterThan(20));

  for (const f of files) {
    test(`${rel(f)} imports only inside the package, or three`, () => {
      const code = readFileSync(f, "utf8");
      const inSrc = rel(f).startsWith("src/");
      for (const spec of specifiers(code)) {
        let ok: boolean;
        if (spec.startsWith(".")) ok = resolve(dirname(f), spec).startsWith(PKG + "/");
        else if (spec === "three") ok = true;
        else if (/^(node|bun):/.test(spec) || spec === "bun") ok = !rel(f).startsWith("src/") && !rel(f).startsWith("packs/");
        else if (exportTarget(spec)) ok = !inSrc; // src uses relative paths, so a public entry never imports itself
        else if (spec.startsWith("/@hq/world/") || spec.startsWith("@hq/world")) ok = false; // a deep path
        else ok = false;
        expect({ file: rel(f), spec, ok }).toEqual({ file: rel(f), spec, ok: true });
      }
    });
  }

  test("the pure half (everything @hq/world/model reaches) never imports three", () => {
    const pure = /^src\/(model|catalog|nav|anim|camera|arch|lint|sim)\//;
    const bad = files.filter((f) => pure.test(rel(f)) && specifiers(readFileSync(f, "utf8")).includes("three")).map(rel);
    expect(bad).toEqual([]);
  });

  test("nothing assigns to three.js globals (ShaderChunk, ColorManagement, ...)", () => {
    const bad = files.filter((f) => /\b(ShaderChunk|ShaderLib|ColorManagement)(\.\w+|\[[^\]]+\])*\s*=[^=]/.test(readFileSync(f, "utf8"))).map(rel);
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
