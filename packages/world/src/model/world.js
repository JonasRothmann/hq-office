// World files: defineWorld (the data an author writes plus the packs it uses), and JSON in and out. Pure.

/**
 * @typedef {[number, number]} Tile
 * @typedef {"n"|"e"|"s"|"w"} Side
 * @typedef {object} WorldDoc
 * @property {1} format
 * @property {string} id
 * @property {string[]} packs                    pack ids (the packs themselves travel beside the doc)
 * @property {{ w: number, d: number }} lot      tiles
 * @property {{ rect: [number, number, number, number], finish: string }[]} floors   x, z, w, d
 * @property {{ path: Tile[], finish?: string, outside?: string }[]} walls          paths along grid lines
 * @property {{ type: string, at: Tile, side: Side }[]} openings                   on the wall edge at that tile's side
 * @property {{ at: Tile, id: string, name?: string }[]} rooms                     labels for found rooms
 * @property {{ id?: string, type: string, at: Tile, facing?: Side }[]} objects    at: the footprint's north-west tile
 * @property {{ id: string, at: Tile, facing?: Side, look?: Record<string, string> }[]} characters
 * @property {{ who: string, do: "sit"|"use"|"walk", target?: string, slot?: string, to?: Tile }[]} acts
 */

/** @typedef {{ doc: WorldDoc, packs: import("../catalog/define.js").Pack[] }} World */

export const FORMAT = 1;

// The world an author writes: plain data (JSON-able) plus `packs`, the pack modules it uses.
/** @stability stable  @returns {World} */
export function defineWorld(spec) {
  const { packs = [], ...data } = spec;
  const doc = normalise({ ...data, packs: packs.map((p) => p?.id ?? String(p)) });
  return Object.freeze({ doc, packs });
}

function normalise(d) {
  const counts = {};
  const objects = (d.objects ?? []).map((o) => {
    if (o.id) return { facing: "s", ...o };
    const base = String(o.type ?? "object").split("/").pop();
    counts[base] = (counts[base] ?? 0) + 1;
    return { facing: "s", ...o, id: `${base}-${counts[base]}` };
  });
  return {
    format: d.format ?? FORMAT, id: d.id ?? "world", packs: d.packs ?? [], lot: d.lot,
    floors: d.floors ?? [], walls: d.walls ?? [], openings: d.openings ?? [], rooms: d.rooms ?? [],
    objects, characters: (d.characters ?? []).map((c) => ({ facing: "s", ...c })), acts: d.acts ?? [],
  };
}

/** @stability stable */
export function toJSON(world) {
  return JSON.stringify(world.doc, null, 2);
}

// A world from JSON and the packs its doc names (by id). A pack it names but is not given is a validation error.
/** @stability stable */
export function fromJSON(json, packs) {
  const doc = typeof json === "string" ? JSON.parse(json) : json;
  return Object.freeze({ doc: normalise(doc), packs: packs.filter((p) => doc.packs?.includes(p.id)) });
}
