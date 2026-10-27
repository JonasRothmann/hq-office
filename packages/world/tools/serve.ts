#!/usr/bin/env bun
// The lab server: serves a root folder (where your world files live) at /, this package at /@hq/world/, three.js at
// /three.js, and gives the lab an import map built from package.json's exports. Files only, on 127.0.0.1.
//
//   bun packages/world/tools/serve.ts [--root .] [--port 4791] [--three path/to/three.module.js]   (--root: from the current directory)
//   then open http://127.0.0.1:4791/  (the tiny house) or /?world=/path/under/root/x.world.js
import { existsSync, readFileSync } from "node:fs";
import { dirname, extname, join, normalize, resolve } from "node:path";

export const PKG = resolve(import.meta.dir, "..");
const TYPES: Record<string, string> = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json", ".css": "text/css; charset=utf-8", ".png": "image/png", ".jpg": "image/jpeg" };

// three.js: --three, HQ_WORLD_THREE, node_modules/three upward from here or the root, or a host's vendored copy.
export function findThree(root: string, flag?: string): string {
  const tries = [flag, process.env.HQ_WORLD_THREE];
  for (const start of [root, PKG]) {
    for (let d = resolve(start); ; d = dirname(d)) {
      tries.push(join(d, "node_modules/three/build/three.module.min.js"), join(d, "node_modules/three/build/three.module.js"), join(d, "src/client/vendor/three/three.module.min.js"));
      if (dirname(d) === d) break;
    }
  }
  const found = tries.find((p) => p && existsSync(p));
  if (!found) throw new Error("three.js not found: pass --three path/to/three.module.js or set HQ_WORLD_THREE");
  return found;
}

export function importMap(): Record<string, string> {
  const pkg = JSON.parse(readFileSync(join(PKG, "package.json"), "utf8"));
  const map: Record<string, string> = { three: "/three.js" };
  for (const [k, v] of Object.entries(pkg.exports as Record<string, string>)) map[k === "." ? pkg.name : `${pkg.name}/${k.slice(2)}`] = `/${pkg.name}/${v.slice(2)}`;
  return map;
}

export function serve({ root = process.cwd(), port = 0, three }: { root?: string; port?: number; three?: string } = {}) {
  root = resolve(root);
  const threePath = findThree(root, three);
  const map = importMap();
  const file = (base: string, rel: string) => {
    const p = normalize(join(base, rel));
    return p === base || p.startsWith(base + "/") ? p : null;
  };
  return Bun.serve({
    port, hostname: "127.0.0.1",
    async fetch(req) {
      const url = new URL(req.url);
      const path = decodeURIComponent(url.pathname);
      if (path === "/") return Response.redirect(`/@hq/world/lab/index.html${url.search || "?world=/@hq/world/examples/tiny-house.world.js"}`, 302);
      if (path === "/three.js") return new Response(Bun.file(threePath), { headers: { "content-type": TYPES[".js"], "cache-control": "no-store" } });
      const p = path.startsWith("/@hq/world/") ? file(PKG, path.slice("/@hq/world/".length)) : file(root, path.slice(1));
      if (!p || !existsSync(p)) return new Response("not found", { status: 404 });
      const headers = { "content-type": TYPES[extname(p)] ?? "application/octet-stream", "cache-control": "no-store" };
      if (p === join(PKG, "lab", "index.html")) {
        const html = readFileSync(p, "utf8").replace("<!-- importmap -->", `<script type="importmap">${JSON.stringify({ imports: map })}</script>`);
        return new Response(html, { headers });
      }
      return new Response(Bun.file(p), { headers });
    },
  });
}

if (import.meta.main) {
  const arg = (name: string) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : undefined; };
  const server = serve({ root: arg("root"), port: Number(arg("port") ?? 4791), three: arg("three") });
  console.log(`world lab on http://127.0.0.1:${server.port}/`);
}
