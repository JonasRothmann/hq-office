// The lab's generated office: n lanes in two uneven teams and a few on their own, with mixed statuses (or all one).
import { fromJSON } from "@hq/world/model";
import japandi from "../japandi/index.js";
import { officeDoc } from "../plan.js";

const STATUSES = ["moving", "needs_you", "moving", "waiting", "done", "moving", "hq_turn", "blocked", "moving", "parked", "stale", "moving"];

// Team a has six lanes, team b three, and the rest stand alone; past twelve, the extra lanes join a third team.
function lanes(n, status) {
  const out = [];
  const parentOf = (i) => (i === 0 || i === 6 || i === 12 ? "hq" : i < 6 ? (i === 2 ? "a-1" : "a") : i < 9 ? "b" : i < 12 ? "hq" : "c");
  const nameOf = (i) => (i === 0 ? "a" : i < 6 ? `a-${i}` : i === 6 ? "b" : i < 9 ? `b-${i - 6}` : i < 12 ? `solo-${i - 8}` : i === 12 ? "c" : `c-${i - 12}`);
  for (let i = 0; i < n; i++) out.push({ name: nameOf(i), parent: parentOf(i), status: status ?? STATUSES[i % STATUSES.length] });
  return out;
}

// The world for n lanes; in the lab, ?lanes=N (1 to 24) and ?status=S override n and the statuses.
export function labOffice(n) {
  const q = new URLSearchParams(globalThis.location?.search ?? "");
  const count = Math.max(1, Math.min(24, Number(q.get("lanes")) || n));
  const { doc } = officeDoc([{ name: "hq", status: "moving" }, ...lanes(count, q.get("status") ?? undefined)]);
  return fromJSON(doc, [japandi]);
}
