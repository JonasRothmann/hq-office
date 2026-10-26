// Routes for lane vitals. The router loads every file in this folder; see src/server/router.ts.
//   POST /api/lanes/:name/vitals { model?, effort?, subagents?, contextUsed?, contextMax? }  ->  { vitals }
import { reportVitals } from "../vitals.ts";
import type { Route } from "../router.ts";

const routes: Route[] = [
  { method: "POST", pattern: /^\/api\/lanes\/([^/]+)\/vitals$/, handle: ({ body, m }) => ({ vitals: reportVitals(decodeURIComponent(m[1]), body) }) },
];
export default routes;
