// The app's side of the @hq/world boundary: app code reaches packages/world only through the package's public
// entries (no relative path into it, no deep "@hq/world/src/..." name); the page's import map maps exactly public
// entries to the files package.json's exports name; the server serves the package's browser modules and nothing else.
import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { packagePath } from "../../src/server/routes/packages.ts";

const ROOT = join(import.meta.dir, "..", "..");
const PKG = join(ROOT, "packages", "world");
const pkg = JSON.parse(readFileSync(join(PKG, "package.json"), "utf8"));
const entries = Object.fromEntries(Object.entries(pkg.exports as Record<string, string>).map(([k, v]) => [k === "." ? pkg.name : `${pkg.name}/${k.slice(2)}`, `/packages/world/${v.slice(2)}`]));
const walk = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (["node_modules", ".git", "packages", ".claude"].includes(e.name) ? [] : e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));
const appFiles = ["src", "scripts", "test", "bin", "public"].filter((d) => existsSync(join(ROOT, d))).flatMap((d) => walk(join(ROOT, d))).concat([join(ROOT, "server.ts"), join(ROOT, "hud.ts")]).filter((f) => /\.(js|ts|html)$/.test(f) && existsSync(f));

const specs = (code: string) => [...code.matchAll(/(?:\bfrom\s*|\bimport\s*\(?\s*)["']([^"']+)["']/g)].map((m) => m[1]);

describe("@hq/world from the app", () => {
  test("app code imports the package only through its public entries", () => {
    const bad: string[] = [];
    for (const f of appFiles) {
      for (const s of specs(readFileSync(f, "utf8"))) {
        const intoPkg = (s.startsWith(".") && resolve(dirname(f), s).startsWith(PKG + "/")) || s.startsWith("/packages/world/") || s.includes("packages/world/");
        const deepName = s.startsWith(`${pkg.name}/`) && !entries[s];
        if (intoPkg || deepName) bad.push(`${relative(ROOT, f)}: ${s} (use ${Object.keys(entries).join(" or ")})`);
      }
    }
    expect(bad).toEqual([]);
  });

  test("the page's import map maps public entries, each to the file the package exports", () => {
    const shell = readFileSync(join(ROOT, "public", "index.html"), "utf8");
    const map: Record<string, string> = JSON.parse(shell.match(/<script type="importmap">([\s\S]*?)<\/script>/)![1]).imports;
    const mapped = Object.entries(map).filter(([k]) => k === pkg.name || k.startsWith(`${pkg.name}/`));
    expect(mapped.length).toBeGreaterThan(0);
    for (const [k, v] of mapped) expect({ k, v }).toEqual({ k, v: entries[k] });
    for (const [, v] of mapped) expect(packagePath(v)).not.toBeNull();
  });

  test("the server serves the package's browser modules only", () => {
    expect(packagePath("/packages/world/src/index.js")).toBe(join(ROOT, "packages/world/src/index.js"));
    expect(packagePath("/packages/world/packs/starter/chair.js")).not.toBeNull();
    for (const p of ["/packages/world/test/model.test.ts", "/packages/world/tools/serve.ts", "/packages/world/package.json", "/packages/world/lab/index.html", "/packages/world/examples/tiny-house.world.js", "/packages/world/src/../../../hud.db", "/packages/world/src/%2e%2e/x.js"]) expect({ p, served: packagePath(p) }).toEqual({ p, served: null });
  });
});
