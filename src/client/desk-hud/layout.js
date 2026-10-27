// Where each desk chip goes so that none overlaps another chip or a panel: a chip wants the spot above its desk; when
// that spot is taken it takes the nearest free spot beside whatever is in the way, within reach, or it is not shown.
// Pure: boxes in, positions out, so it is tested without a browser.

const hits = (a, b, gap) => a.x < b.x + b.w + gap && b.x < a.x + a.w + gap && a.y < b.y + b.h + gap && b.y < a.y + a.h + gap;

// items: [{ key, x, y, w, h }], the top-left each chip wants, in the order they choose (first gets its spot).
// obstacles: [{ x, y, w, h }] no chip may touch (the panels). bounds: { x, y, w, h } a chip must stay inside.
// Returns Map key -> { x, y, moved } (moved: distance from the wanted spot in px) or null when no spot is in reach.
export function place(items, { obstacles = [], bounds, gap = 4, reach = 140, tries = 64 }) {
  const placed = [];
  const out = new Map();
  for (const it of items) {
    const { w, h } = it;
    const dist = (c) => Math.hypot(c.x - it.x, c.y - it.y);
    const inside = (c) => !bounds || (c.x >= bounds.x && c.y >= bounds.y && c.x + w <= bounds.x + bounds.w && c.y + h <= bounds.y + bounds.h);
    const clamp = (c) => (bounds ? { x: Math.min(Math.max(c.x, bounds.x), bounds.x + bounds.w - w), y: Math.min(Math.max(c.y, bounds.y), bounds.y + bounds.h - h) } : c);
    const queue = [{ x: it.x, y: it.y }];
    const seen = new Set();
    let found = null;
    for (let n = 0; queue.length && n < tries; n++) {
      queue.sort((a, b) => dist(a) - dist(b));
      const c = queue.shift();
      const k = `${Math.round(c.x)},${Math.round(c.y)}`;
      if (seen.has(k) || dist(c) > reach) continue;
      seen.add(k);
      if (!inside(c)) { queue.push(clamp(c)); continue; }
      const box = { x: c.x, y: c.y, w, h };
      const hit = placed.find((b) => hits(box, b, gap)) ?? obstacles.find((b) => hits(box, b, gap));
      if (!hit) { found = c; break; }
      // beside what is in the way: above, below, left, right of it, keeping the other coordinate
      queue.push({ x: c.x, y: hit.y - h - gap - 0.5 }, { x: c.x, y: hit.y + hit.h + gap + 0.5 }, { x: hit.x - w - gap - 0.5, y: c.y }, { x: hit.x + hit.w + gap + 0.5, y: c.y });
    }
    if (found) {
      placed.push({ x: found.x, y: found.y, w, h });
      out.set(it.key, { x: found.x, y: found.y, moved: dist(found) });
    } else out.set(it.key, null);
  }
  return out;
}

// How crowded a placement is: the furthest any chip had to move, and how many found no spot.
export function crowding(result) {
  let moved = 0, lost = 0;
  for (const r of result.values()) {
    if (!r) lost++;
    else moved = Math.max(moved, r.moved);
  }
  return { moved, lost };
}
