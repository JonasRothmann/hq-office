// Lets Bun load world and pack files that live outside the package: their "@hq/world..." imports are pointed at the
// public entries in package.json's exports, the way the browser's import map does. Import this before a world or a
// pack. (Bun's runtime onResolve does not see bare specifiers, so this rewrites them on load.)
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { plugin } from "bun";

const PKG = resolve(import.meta.dir, "..");
const pkg = JSON.parse(readFileSync(join(PKG, "package.json"), "utf8"));
const entries = Object.fromEntries(Object.entries(pkg.exports as Record<string, string>).map(([k, v]) => [k === "." ? pkg.name : `${pkg.name}/${k.slice(2)}`, join(PKG, v)]));

plugin({
  name: "@hq/world exports",
  setup(build) {
    build.onLoad({ filter: /\.js$/ }, ({ path }) => {
      const code = readFileSync(path, "utf8");
      if (!code.includes(pkg.name)) return { contents: code, loader: "js" };
      const contents = code.replace(/(["'])(@hq\/world(?:\/[\w/.-]+)?)\1/g, (m, _q, spec) => {
        if (!entries[spec]) throw new Error(`${path}: ${spec} is not a public entry of ${pkg.name}; use one of: ${Object.keys(entries).join(", ")}`);
        return JSON.stringify(entries[spec]);
      });
      return { contents, loader: "js" };
    });
  },
});
