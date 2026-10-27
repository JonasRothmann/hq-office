// The owner's settings (sound, performance, the office renderer, level names, the land round the office): kept on the server, with a copy in this browser for the first paint.
import { emit, on } from "../core/bus.js";
import { post } from "../core/net.js";

// The owner's choices, not per-view state such as the open tab. The defaults: the chime is off, the office moves
// smoothly, the lane tree's levels (one name per depth, comma-separated) are Manager, Lead, Engineer, the office
// stands in a valley, and the classic renderer draws it. Choices
// kept on the server for the pixel room of earlier versions (hero, season, hat, theme) are left there untouched.
export const DEFAULTS = { sound: false, performance: "smooth", levels: "Manager, Lead, Engineer", outside: "nature", office: "classic" };
// How much the 3D office moves, and so what it costs (world/index.js).
export const PERFORMANCE_CHOICES = ["smooth", "balanced", "saver"];
// What surrounds the office (world/outside/): a valley, a town, or the garden alone. outsideSeed, when set (REROLL),
// is what the land grows from; without it the land grows from the owner's name, so each installation has its own.
export const OUTSIDE_CHOICES = ["nature", "city", "off"];
// Which renderer draws the office (world/index.js): the classic one, or the new engine (@hq/world, office-view/).
export const OFFICE_CHOICES = ["classic", "new"];
const LOCAL_KEY = "hq-settings";
// Before 0.3.0 the SOUND switch was remembered on its own, under this key.
const LOCAL_SOUND_KEY = "hq-sound";

// What this browser remembered: the copy of the server's settings from the last visit, or, from before the server
// kept settings, the only copy.
export function localSettings() {
  try {
    const out = JSON.parse(localStorage.getItem(LOCAL_KEY) || "{}");
    const own = out && typeof out === "object" && !Array.isArray(out) ? out : {};
    const sound = localStorage.getItem(LOCAL_SOUND_KEY);
    if (sound !== null && !("sound" in own)) own.sound = sound === "1";
    return own;
  } catch { return {}; }
}
function saveLocal() { try { localStorage.setItem(LOCAL_KEY, JSON.stringify(settings)); } catch {} }

// The defaults with the given choices over them, each checked against what this page offers.
export function withDefaults(v) {
  const s = { ...DEFAULTS, ...v };
  s.sound = s.sound === true;
  if (!PERFORMANCE_CHOICES.includes(s.performance)) s.performance = DEFAULTS.performance;
  if (typeof s.levels !== "string" || !s.levels.split(",").some((n) => n.trim())) s.levels = DEFAULTS.levels;
  if (!OUTSIDE_CHOICES.includes(s.outside)) s.outside = DEFAULTS.outside;
  if (!OFFICE_CHOICES.includes(s.office)) s.office = DEFAULTS.office;
  if (typeof s.outsideSeed !== "string" || !s.outsideSeed || s.outsideSeed.length > 40) delete s.outsideSeed;
  return s;
}

// What the page does with the server's settings. The server's are the truth once it has any. A server with none
// yet gets what this browser remembered, sent up once (ifEmpty, so it never overwrites a choice made elsewhere);
// with nothing remembered either, the defaults stand and nothing is sent.
export function plan(server, local, migrated) {
  if (server && Object.keys(server).length) return { use: server, migrate: null };
  if (!Object.keys(local).length) return { use: null, migrate: null };
  return { use: local, migrate: migrated ? null : local };
}

export let settings = withDefaults(localSettings());

// Makes these the settings: the copy in this browser and the "settings" event on the bus, which the settings panel,
// the world and SOUND listen to. Nothing happens when nothing changed.
function adopt(v) {
  const next = withDefaults(v);
  const same = JSON.stringify(next) === JSON.stringify(settings);
  settings = next;
  saveLocal();
  if (same) return;
  emit("settings", settings);
}

// The owner changed something on this page: it shows at once and goes to the server, whose reply is the truth.
// While a change is on its way, the stream's older settings are not applied over it.
let pending = 0, migrated = false, lastServer = null;
export async function changeSettings(changes) {
  adopt({ ...settings, ...changes });
  pending++;
  try {
    const reply = await post("/api/settings", { settings: changes });
    if (pending === 1) adopt(reply.settings);
  } catch (e) {
    console.warn("settings were not saved on the server:", e.message);
  } finally {
    pending--;
  }
}
export const resetSettings = () => changeSettings({ ...DEFAULTS, outsideSeed: null });

on("state", (S) => {
  if (!S.settings || S.settings === lastServer) return;
  lastServer = S.settings;
  if (pending) return;
  const { use, migrate } = plan(S.settings, localSettings(), migrated);
  if (use) adopt(use);
  if (!migrate) return;
  migrated = true;
  post("/api/settings", { settings: withDefaults(migrate), ifEmpty: true })
    .then(() => { try { localStorage.removeItem(LOCAL_SOUND_KEY); } catch {} })
    .catch((e) => console.warn("settings were not sent to the server:", e.message));
});
