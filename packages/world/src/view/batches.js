// Which placed objects draw together. An object's parts depend only on its type, so the objects of one type with
// MIN_COPIES or more copies draw as one batch: an instanced mesh per material, one instance per object. A type with
// fewer copies, or whose definition says `instance: false`, draws each object on its own. An edit redraws only the
// types of the objects it added, removed or changed, as they were and as they are. Pure: create.js draws the plan.

export const MIN_COPIES = 2;

/**
 * @typedef {{ batches: Map<string, string[]>, single: Map<string, string[]>, typeOf: Map<string, string> }} BatchPlan
 *   batches: type → the ids of its objects, in lot order (instance i is ids[i]); single: the same for types drawn
 *   object by object; typeOf: object id → type
 */

/** @param {{ id: string, type: string, def: { instance?: boolean } }[]} objects  @returns {BatchPlan} */
export function planBatches(objects) {
  const byType = new Map();
  for (const o of objects) {
    if (!byType.has(o.type)) byType.set(o.type, { ids: [], def: o.def });
    byType.get(o.type).ids.push(o.id);
  }
  const batches = new Map(), single = new Map();
  for (const [type, { ids, def }] of byType) (ids.length >= MIN_COPIES && def.instance !== false ? batches : single).set(type, ids);
  return { batches, single, typeOf: new Map(objects.map((o) => [o.id, o.type])) };
}

/** The types an edit must redraw: those of the objects it touched, before and after it. @returns {Set<string>} */
export function staleTypes(prev, next, ids) {
  const out = new Set();
  for (const id of ids) for (const plan of [prev, next]) { const t = plan.typeOf.get(id); if (t !== undefined) out.add(t); }
  return out;
}

/** Every type a plan draws. @returns {string[]} */
export const typesOf = (plan) => [...plan.batches.keys(), ...plan.single.keys()];
