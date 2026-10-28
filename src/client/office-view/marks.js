// A lane's status on the office, drawn in code: a small lantern on each live desk that glows in the status colour, and
// a badge over a worker the owner should look at (a round disc with a glyph and a short tail pointing down; never a
// diamond or a crystal). Both are the app's own three.js, attached to the engine's desk and worker groups, so they
// follow them; both grow at far zooms (size.js).
import { THREE } from "../world/api.js";
import { deskId, workerId } from "../office/plan.js";
import { atLeast } from "./size.js";

// Status colours, shared with the UI (spec section 3).
export const STATUS = {
  needs_you: "#e5484d", blocked: "#e5484d", hq_turn: "#f5a524", waiting: "#3e63dd", with_lead: "#d6883c",
  moving: "#30a46c", done: "#12a594", parked: "#8b8d98", gone: "#8b8d98", stale: "#8b8d98",
};

// The statuses that keep a room's lamp on at night: everything but parked and gone (and an unknown status, which
// counts as parked).
export const ACTIVE = new Set(["moving", "needs_you", "blocked", "hq_turn", "waiting", "with_lead", "done", "stale"]);

// The desk light's colour for a status, or null when it is off (parked, gone, stale, unknown).
const OFF = new Set(["parked", "gone", "stale"]);
export const lightOf = (status) => (status in STATUS && !OFF.has(status) ? STATUS[status] : null);

// The badge over a head. A lane that works while one of its questions blocks keeps working and wears the red badge.
export function markerOf(status, blocking = 0) {
  switch (status) {
    case "needs_you": case "blocked": return { color: STATUS.needs_you, glyph: "!" };
    case "hq_turn": return { color: STATUS.hq_turn, glyph: "hq" };
    case "waiting": return { color: STATUS.waiting, glyph: "clock" };
    case "with_lead": return { color: STATUS.with_lead, glyph: "clock" };
    default: return blocking > 0 ? { color: STATUS.needs_you, glyph: "!" } : null;
  }
}

// The lantern stands on the desk's back left corner (desk frame: the worker sits toward +z, the screen is in the
// middle at the back, the mug on the back right, the notebook front left), on top of the 0.57 m desk top.
const LIGHT_AT = new THREE.Vector3(-0.64, 0.57, -0.32);
const LANTERN = { r: 0.046, h: 0.1 };
const LIGHT_PX = 5;           // the lantern is never less than 5 CSS px across
const LIGHT_OFF = "#3a3632";  // an unlit lantern: dark paper
// The badge: 0.4 m by 0.5 m, its tail's tip on the engine's head anchor (0.95 m over the hips, clear of a waving
// hand), bobbing a little. Never less than 18 CSS px across.
const BADGE = { w: 0.4, h: 0.5, over: 0.95, bob: 0.03, px: 18 };

export class Marks {
  constructor(world) {
    this.world = world;
    this.lights = new Map();  // lane -> the lantern group on its desk
    this.badges = new Map();  // lane -> the sprite on its worker
    this.state = new Map();   // lane -> { light: "#hex" | null, marker: { color, glyph } | null }
    this.mats = new Map();    // colour -> the lantern's glowing material, one per colour
    this.badgeMats = new Map(); // colour + glyph -> a sprite material with its texture
    this.scale = { lights: 1, markers: 1 };
    this.geo = {
      foot: new THREE.CylinderGeometry(0.04, 0.05, 0.016, 10).translate(0, 0.008, 0),
      shade: new THREE.CylinderGeometry(LANTERN.r, LANTERN.r, LANTERN.h, 10).translate(0, 0.016 + LANTERN.h / 2, 0),
      cap: new THREE.CylinderGeometry(0.018, LANTERN.r + 0.004, 0.016, 10).translate(0, 0.016 + LANTERN.h + 0.008, 0),
    };
    this.steel = new THREE.MeshLambertMaterial({ color: "#2b2a2c" });
  }

  // lanes: Map lane -> { status, blocking } for every live desk (HQ's among them). Returns whether anything changed.
  sync(lanes) {
    let changed = false;
    for (const lane of [...this.state.keys()]) {
      if (lanes.has(lane)) continue;
      this.lights.get(lane)?.removeFromParent();
      this.badges.get(lane)?.removeFromParent();
      this.lights.delete(lane); this.badges.delete(lane); this.state.delete(lane);
      changed = true;
    }
    for (const [lane, { status, blocking }] of lanes) {
      const light = lightOf(status), marker = markerOf(status, blocking);
      const was = this.state.get(lane);
      if (!was || was.light !== light || was.marker?.color !== marker?.color || was.marker?.glyph !== marker?.glyph) changed = true;
      this.state.set(lane, { light, marker });

      let g = this.lights.get(lane);
      if (!g) this.lights.set(lane, (g = this.lantern(lane)));
      g.getObjectByName("shade").material = this.glow(light ?? LIGHT_OFF);
      if (!g.parent && this.world.attach(g, deskId(lane))) changed = true;

      let b = this.badges.get(lane);
      if (!marker) { if (b) { b.removeFromParent(); this.badges.delete(lane); } continue; }
      if (!b) this.badges.set(lane, (b = this.sprite(this.badgeMat(marker), workerId(lane))));
      else b.material = this.badgeMat(marker);
      if (!b.parent && this.world.attach(b, workerId(lane))) changed = true;
    }
    return changed;
  }

  // Every drawn frame: the size for the zoom, and each badge over its worker's head wherever the hips are.
  update(now, ppm) {
    const kl = atLeast(LANTERN.r * 2, ppm, LIGHT_PX), kb = atLeast(BADGE.w, ppm, BADGE.px);
    this.scale = { lights: kl, markers: kb };
    for (const g of this.lights.values()) g.scale.setScalar(kl);
    const bob = Math.sin((now / 1000) * 2.4) * BADGE.bob;
    for (const [lane, b] of this.badges) {
      const c = this.world.character(workerId(lane));
      if (c) b.position.y = c.hips + BADGE.over + bob * kb;
      b.scale.set(BADGE.w * kb, BADGE.h * kb, 1);
    }
  }

  of(lane) { return this.state.get(lane) ?? null; }

  // A click on the lantern is a click on its desk: each part names the desk as its entity (the engine's pick reads it).
  lantern(lane) {
    const g = new THREE.Group();
    g.name = "status-light";
    g.position.copy(LIGHT_AT);
    const foot = new THREE.Mesh(this.geo.foot, this.steel);
    const shade = new THREE.Mesh(this.geo.shade, this.glow(LIGHT_OFF));
    const cap = new THREE.Mesh(this.geo.cap, this.steel);
    shade.name = "shade";
    for (const m of [foot, shade, cap]) { m.castShadow = false; m.receiveShadow = false; m.userData.entity = deskId(lane); g.add(m); }
    return g;
  }

  // Unlit, so the status colour reads the same by day and by night.
  glow(color) {
    if (!this.mats.has(color)) this.mats.set(color, new THREE.MeshBasicMaterial({ color, toneMapped: false }));
    return this.mats.get(color);
  }

  // A click on the badge is a click on its worker (the engine's pick reads userData.entity).
  sprite(material, entity) {
    const s = new THREE.Sprite(material);
    s.name = "marker";
    s.userData.entity = entity;
    s.center.set(0.5, 0); // the tail's tip is the sprite's anchor, so the badge grows upward from the head
    s.renderOrder = 10;
    return s;
  }

  badgeMat({ color, glyph }) {
    const key = `${color}:${glyph}`;
    if (!this.badgeMats.has(key)) this.badgeMats.set(key, new THREE.SpriteMaterial({ map: badgeTexture(color, glyph), depthTest: false, transparent: true, toneMapped: false }));
    return this.badgeMats.get(key);
  }

  dispose() {
    for (const g of this.lights.values()) g.removeFromParent();
    for (const b of this.badges.values()) b.removeFromParent();
    for (const g of Object.values(this.geo)) g.dispose();
    this.steel.dispose();
    for (const m of this.mats.values()) m.dispose();
    for (const m of this.badgeMats.values()) { m.map.dispose(); m.dispose(); }
    this.lights.clear(); this.badges.clear(); this.state.clear(); this.mats.clear(); this.badgeMats.clear();
  }
}

// The badge, 128 by 160 px: a soft drop shadow, a disc in the colour with a white rim, a short tail pointing down and
// the glyph in white ("!", "HQ", or a clock face).
function badgeTexture(color, glyph) {
  const c = document.createElement("canvas");
  c.width = 128; c.height = 160;
  const g = c.getContext("2d");
  const cx = 64, cy = 62, R = 50;
  g.fillStyle = "rgba(0,0,0,0.22)"; g.beginPath(); g.arc(cx + 2, cy + 4, R, 0, 7); g.fill();
  g.fillStyle = color;
  g.beginPath(); g.arc(cx, cy, R, 0, 7); g.fill();
  g.beginPath(); g.moveTo(cx - 14, cy + R - 8); g.lineTo(cx, cy + R + 26); g.lineTo(cx + 14, cy + R - 8); g.fill();
  g.strokeStyle = "rgba(255,255,255,0.9)"; g.lineWidth = 6; g.beginPath(); g.arc(cx, cy, R - 3, 0, 7); g.stroke();
  g.fillStyle = "#fff"; g.strokeStyle = "#fff"; g.textAlign = "center"; g.textBaseline = "middle";
  if (glyph === "!") { g.font = "bold 72px sans-serif"; g.fillText("!", cx, cy + 4); }
  else if (glyph === "hq") { g.font = "bold 40px sans-serif"; g.fillText("HQ", cx, cy + 2); }
  else if (glyph === "clock") {
    g.lineWidth = 7; g.beginPath(); g.arc(cx, cy, 26, 0, 7); g.stroke();
    g.lineCap = "round"; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx, cy - 16); g.moveTo(cx, cy); g.lineTo(cx + 12, cy + 6); g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
