// The page's event channel. A feature listens here instead of being called from another area's file, so adding
// one is adding a folder, not editing boot.js or the world.
//
//   "state" (S)      after every /api/state load, once the built-in panels have rendered
//   "tick"           whenever the page clock wakes: only for a visible change, never on a fixed timer
//   "select" (lane)  a lane was selected (card/card.js select())
//   "settings" (settings) when the owner's settings change, here, on another page or from the server
//   "theme" (theme)  "light" or "dark", when the theme in effect changes (theme/index.js)
//   "stage" (what)   "room" while a conference room covers the office, "office" after
//   "world:ready", "world:select" (lane), "world:hover" (lane or null), "world:layout" (lanes): the 3D office
//   (world/api.js has the frame hook, desk anchors and projection for drawing over it)
const handlers = new Map();

export function on(name, fn) {
  const list = handlers.get(name) ?? handlers.set(name, []).get(name);
  list.push(fn);
  return () => list.splice(list.indexOf(fn), 1);
}

export function emit(name, ...args) {
  const list = handlers.get(name);
  if (!list) return;
  for (const fn of [...list]) {
    try { fn(...args); } catch (e) { console.error(`${name} listener failed`, e); }
  }
}
