// Routes for the page's packages under packages/ (the 3D world engine, @hq/world): their browser modules only
// (packages/<name>/src/ and packages/<name>/packs/), served as they are, like src/client. Tests, tools, examples and
// labs inside a package are not served. The page's import map points "@hq/world" here.
import { extname, join } from "node:path";
import { DIR } from "../config.ts";
import { json } from "../json.ts";
import type { Route } from "../router.ts";

const SERVED = /^packages\/[a-z0-9-]+\/(src|packs)\/[\w./-]+\.js$/;

// The file for a request path, or null when the path is not one the page may load.
export function packagePath(path: string): string | null {
  let rel: string;
  try { rel = decodeURIComponent(path.slice(1)); } catch { return null; }
  if (!SERVED.test(rel) || rel.includes("..") || extname(rel) !== ".js") return null;
  return join(DIR, rel);
}

async function packageFile(path: string, req: Request): Promise<Response | null> {
  const p = packagePath(path);
  if (!p) return null;
  const file = Bun.file(p);
  if (!(await file.exists())) return null;
  const tag = `"${file.lastModified.toString(36)}-${file.size.toString(36)}"`;
  const headers = { "content-type": "text/javascript; charset=utf-8", "cache-control": "no-cache", etag: tag };
  if (req.headers.get("if-none-match") === tag) return new Response(null, { status: 304, headers });
  return new Response(file, { headers });
}

const routes: Route[] = [
  { method: "GET", prefix: "/packages/", handle: async ({ req, path }) => (await packageFile(path, req)) ?? json({ error: "not found" }, 404) },
];
export default routes;
