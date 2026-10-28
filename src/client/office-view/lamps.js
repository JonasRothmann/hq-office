// The rooms' own lamps at night: one warm light over the middle of each team room and the HQ suite, on the engine's
// host lamps (world.addLamp: dark by day, lit by night). A room is lit while one of its lanes is active and dim when
// none is. A dim lamp is kept at intensity 0, not removed, since a change in the number of lights recompiles every
// shader; a room's lamp comes with the room and goes with it.
import { WALL_H } from "@hq/world";

// A wide soft cone from just under the ceiling that washes a 7 m by 5 m room to its corners. Its reach and the cone's
// edge keep the next room nearly dark, so a busy room reads beside a quiet one.
const LAMP = { intensity: 4, reach: 7, angle: 1.2, penumbra: 0.6, decay: 1 };
const Y = WALL_H - 0.1;

export function roomLamps(world) {
  const lamps = new Map(); // room id -> { lamp, x, z, lit }

  // rooms: [{ id, x, z, lit }], x and z the room's middle on the lot.
  function sync(rooms) {
    const want = new Map(rooms.map((r) => [r.id, r]));
    for (const [id, l] of lamps) if (!want.has(id)) { l.lamp.remove(); lamps.delete(id); }
    for (const r of rooms) {
      let l = lamps.get(r.id);
      // the building grew and the room moved on the lot: its lamp moves with it (one out, one in: the count holds)
      if (l && (l.x !== r.x || l.z !== r.z)) { l.lamp.remove(); lamps.delete(r.id); l = null; }
      if (!l) {
        l = { lamp: world.addLamp([r.x, Y, r.z], { ...LAMP, intensity: r.lit ? LAMP.intensity : 0 }), x: r.x, z: r.z, lit: r.lit };
        lamps.set(r.id, l);
      } else if (l.lit !== r.lit) {
        l.lamp.set({ intensity: r.lit ? LAMP.intensity : 0 });
        l.lit = r.lit;
      }
    }
  }

  return {
    sync,
    lit: (id) => lamps.get(id)?.lit ?? false,
    get count() { return lamps.size; },
    dispose() { for (const l of lamps.values()) l.lamp.remove(); lamps.clear(); },
  };
}
