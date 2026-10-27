// Routes for threads (see src/server/threads.ts). The router loads every file in this folder; see src/server/router.ts.
import { reopen, reply } from "../threads.ts";
import type { Route } from "../router.ts";

const routes: Route[] = [
  // The owner's reply on a question or an update: { text, to } (to: the item's lane, the default, or hq).
  { method: "POST", pattern: /^\/api\/threads\/(question|update)\/(\d+)$/, handle: ({ body, m }) => reply(m[1], Number(m[2]), body) },
  { method: "POST", pattern: /^\/api\/asks\/(\d+)\/reopen$/, handle: ({ m }) => reopen(Number(m[1])) },
];
export default routes;
