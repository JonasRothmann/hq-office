// A small entity-component-system: entities are string ids, components are plain JSON data stored per kind, and
// systems run in a fixed order on every step. The world's moving parts live here (placed objects, characters, what
// they are doing); the lot's grid, walls and rooms stay plain data beside it. Pure: no three.js.

/**
 * @typedef {object} System
 * @property {string} name
 * @property {string} [step]    the step kind it runs: the sequence system starts a character's next step only when it
 *                              holds no component of any registered step kind
 * @property {(ecs: Ecs, dt: number, ctx: object) => boolean | void} run   returns true while it is still moving
 */

/** @typedef {ReturnType<typeof createEcs>} Ecs */

/** @stability experimental */
export function createEcs() {
  /** @type {Map<string, Map<string, any>>} */
  const kinds = new Map();
  /** @type {System[]} */
  const systems = [];
  const store = (kind) => { let m = kinds.get(kind); if (!m) kinds.set(kind, (m = new Map())); return m; };

  const ecs = {
    add(id, kind, data = {}) { store(kind).set(id, data); return data; },
    get: (id, kind) => kinds.get(kind)?.get(id),
    has: (id, kind) => !!kinds.get(kind)?.has(id),
    remove(id, kind) { kinds.get(kind)?.delete(id); },
    despawn(id) { for (const m of kinds.values()) m.delete(id); },
    /** Every entity holding all the kinds, as [id, ...components] in the order asked; a copy, so systems may add and remove. */
    query(...need) {
      const maps = need.map(store);
      const smallest = maps.reduce((a, m) => (m.size < a.size ? m : a));
      const out = [];
      for (const id of smallest.keys()) if (maps.every((m) => m.has(id))) out.push([id, ...maps.map((m) => m.get(id))]);
      return out;
    },
    entities: () => [...new Set([...kinds.values()].flatMap((m) => [...m.keys()]))].sort(),
    /** @param {System} s */
    system(s) {
      if (systems.some((x) => x.name === s.name)) throw new Error(`a system '${s.name}' is already registered; give it another name`);
      systems.push(s);
    },
    systems: () => systems.map((s) => s.name),
    stepKinds: () => systems.filter((s) => s.step).map((s) => s.step),
    step(dt, ctx) { let busy = false; for (const s of systems) busy = s.run(ecs, dt, ctx) === true || busy; return busy; },
    /** { kind: { id: data } }, every kind and id sorted; what a save or a test snapshot holds. */
    toJSON() {
      const out = {};
      for (const k of [...kinds.keys()].sort()) {
        const m = kinds.get(k);
        if (m.size) out[k] = Object.fromEntries([...m.keys()].sort().map((id) => [id, m.get(id)]));
      }
      return out;
    },
    load(json) { kinds.clear(); for (const [k, byId] of Object.entries(json)) for (const [id, data] of Object.entries(byId)) store(k).set(id, structuredClone(data)); },
  };
  return ecs;
}
