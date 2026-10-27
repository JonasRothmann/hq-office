// Routes for the owner's inbox (src/server/owner-inbox.ts): the same list the page has as S.inbox.
import { json } from "../json.ts";
import { ownerInbox } from "../owner-inbox.ts";
import type { Route } from "../router.ts";

const routes: Route[] = [
  { method: "GET", path: "/api/owner-inbox", handle: () => json(ownerInbox()) },
];
export default routes;
