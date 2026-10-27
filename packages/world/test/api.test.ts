// The public API: the names each `exports` entry offers must equal api.txt. Removing or renaming one is a breaking
// change, so it fails here until api.txt and CHANGELOG.md change in the same commit.
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PKG, pkgJson, exportNames } from "./source.ts";

test("the exported names match api.txt", () => {
  const actual: string[] = [];
  for (const [key, file] of Object.entries(pkgJson.exports as Record<string, string>)) {
    const entry = key === "." ? pkgJson.name : `${pkgJson.name}/${key.slice(2)}`;
    for (const n of [...exportNames(join(PKG, file))].sort()) actual.push(`${entry} ${n}`);
  }
  const listed = readFileSync(join(PKG, "api.txt"), "utf8").split("\n").filter((l) => l && !l.startsWith("#"));
  expect(actual).toEqual(listed);
});

test("every exports entry is mapped by the lab's import map", async () => {
  const { importMap } = await import("../tools/serve.ts");
  const map = importMap();
  for (const key of Object.keys(pkgJson.exports)) expect(Object.keys(map)).toContain(key === "." ? pkgJson.name : `${pkgJson.name}/${key.slice(2)}`);
});
