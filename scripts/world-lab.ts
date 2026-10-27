#!/usr/bin/env bun
// The world lab: a tiny static server over the repo root, so docs/design/world-lab.html can load src/client/world.
//
//   bun scripts/world-lab.ts [--port=4790]     then open http://127.0.0.1:4790/docs/design/world-lab.html
//
// It serves files only (no API, no data dir), on 127.0.0.1, and never writes anything.
import { resolve, normalize, join, extname } from "node:path";

const ROOT = resolve(import.meta.dir, "..");
const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".md": "text/plain; charset=utf-8",
};

export function serveLab(port = 4790) {
  return Bun.serve({
    port,
    hostname: "127.0.0.1",
    async fetch(req) {
      const url = new URL(req.url);
      if (url.pathname === "/") return Response.redirect("/docs/design/world-lab.html", 302);
      const path = normalize(join(ROOT, decodeURIComponent(url.pathname)));
      if (!path.startsWith(ROOT + "/")) return new Response("no", { status: 403 });
      const file = Bun.file(path);
      if (!(await file.exists())) return new Response("not found", { status: 404 });
      return new Response(file, { headers: { "content-type": TYPES[extname(path)] ?? "application/octet-stream", "cache-control": "no-store" } });
    },
  });
}

if (import.meta.main) {
  const arg = process.argv.find((a) => a.startsWith("--port="));
  const server = serveLab(arg ? Number(arg.slice(7)) : Number(process.env.WORLD_LAB_PORT ?? 4790));
  console.log(`world lab on http://127.0.0.1:${server.port}/docs/design/world-lab.html`);
}
