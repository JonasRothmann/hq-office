// The coplanar lint of one lot in many views (cut sets) for about the cost of one. A clash is a property of two
// primitives alone, so the lint runs once over every distinct primitive of every view (each wall full and as a
// kerb, each object once), and a view has findings only if it holds both primitives of some clash. Only such a view
// is linted again on its own, which gives exactly what lintCoplanar(lotPrims(lot, catalog, cut)) gives. Pure.
import { buildArchitecture, objectPrims } from "../arch/build.js";
import { lintCoplanar, clashes } from "./coplanar.js";

/**
 * The coplanar pairs of a lot in each view: one list per cut set, equal to lintCoplanar(lotPrims(lot, catalog, cut)).
 * @stability stable
 * @param {Iterable<string>[]} cuts
 * @returns {import("./coplanar.js").CoplanarPair[][]}
 */
export function lintViews(lot, catalog, cuts) {
  const objects = lot.objects.flatMap(objectPrims);
  const views = new Map(); // cut key → { prims, members }
  const union = [], at = new Map(), text = new Map();
  const keyOf = (p) => { let s = text.get(p); if (s === undefined) { s = JSON.stringify(p); text.set(p, s); } return s; };
  const keys = [...cuts].map((cut) => [...cut].sort().join(";"));
  [...cuts].forEach((cut, n) => {
    if (views.has(keys[n])) return;
    const prims = [...buildArchitecture(lot, catalog, new Set(cut)), ...objects];
    // a primitive's k-th copy in one view is its own entry, so two equal primitives in one view still meet
    const copies = new Map();
    const members = new Set(prims.map((p) => {
      const s = keyOf(p), k = (copies.get(s) ?? 0) + 1;
      copies.set(s, k);
      const id = `${k}|${s}`;
      if (!at.has(id)) { at.set(id, union.length); union.push(p); }
      return at.get(id);
    }));
    views.set(keys[n], { prims, members });
  });
  const found = clashes(union);
  const out = new Map();
  for (const [key, { prims, members }] of views) out.set(key, found.some((c) => members.has(c.i) && members.has(c.j)) ? lintCoplanar(prims) : []);
  return keys.map((k) => out.get(k));
}
