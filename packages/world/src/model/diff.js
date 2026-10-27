// What changed between two world docs: the lot (size, floors, walls, openings, room labels), objects and characters
// by id, and acts that are new. An edit at run time rebuilds only what this names. Pure.

/**
 * @typedef {object} WorldDiff
 * @property {boolean} same        nothing changed
 * @property {boolean} lot         the lot's size, floors, walls, openings or room labels changed
 * @property {boolean} packs       the doc names other packs
 * @property {{ added: string[], removed: string[], changed: string[] }} objects      changed: type, at or facing (an
 *   edit at run time also names objects whose height moved with a floor under them; this pure diff cannot see that)
 * @property {{ added: string[], removed: string[], changed: string[] }} characters   changed: look (a character's
 *   `at` is where it first appears; after that the sim owns where it is)
 * @property {object[]} acts       acts in the new doc that the old one did not have
 */

const key = (v) => JSON.stringify(v);

/** @stability experimental  @returns {WorldDiff} */
export function diffWorld(a, b) {
  const lot = key([a.lot, a.floors, a.walls, a.openings, a.rooms]) !== key([b.lot, b.floors, b.walls, b.openings, b.rooms]);
  const packs = key(a.packs) !== key(b.packs);
  const objects = byId(a.objects, b.objects, (x, y) => key([x.type, x.at, x.facing]) === key([y.type, y.at, y.facing]));
  const characters = byId(a.characters, b.characters, (x, y) => key(x.look ?? {}) === key(y.look ?? {}));
  const had = new Map();
  for (const act of a.acts) had.set(key(act), (had.get(key(act)) ?? 0) + 1);
  const acts = b.acts.filter((act) => { const n = had.get(key(act)) ?? 0; if (n) had.set(key(act), n - 1); return !n; });
  const empty = (d) => !d.added.length && !d.removed.length && !d.changed.length;
  return { same: !lot && !packs && empty(objects) && empty(characters) && !acts.length, lot, packs, objects, characters, acts };
}

function byId(before, after, same) {
  const old = new Map(before.map((o) => [o.id, o]));
  const now = new Map(after.map((o) => [o.id, o]));
  return {
    added: [...now.keys()].filter((id) => !old.has(id)),
    removed: [...old.keys()].filter((id) => !now.has(id)),
    changed: [...now.keys()].filter((id) => old.has(id) && !same(old.get(id), now.get(id))),
  };
}
