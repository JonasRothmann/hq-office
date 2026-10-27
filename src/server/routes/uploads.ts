// Routes for uploads (see src/server/uploads.ts). The router loads every file in this folder; see src/server/router.ts.
import { json } from "../json.ts";
import { Refused, keep, serve } from "../uploads.ts";
import type { Route } from "../router.ts";

const routes: Route[] = [
  { method: "GET", prefix: "/uploads/", handle: async ({ path }) => (await serve(path.slice("/uploads/".length))) ?? json({ error: "not found" }, 404) },
  // A file travels as raw bytes, so this route reads the body itself; ?name= is the file's own name.
  { method: "POST", path: "/api/uploads", raw: true, handle: async ({ req, url }) => {
    try {
      return json(await keep(req, url));
    } catch (e) {
      return json({ error: (e as Error).message }, e instanceof Refused ? e.status : 400);
    }
  } },
];
export default routes;
