// The SETTINGS panel.
import { $ } from "../core/dom.js";
import { esc } from "../core/format.js";
import { DEFAULTS, PERFORMANCE_CHOICES, changeSettings, resetSettings, settings } from "./prefs.js";
import { on } from "../core/bus.js";

// SETTINGS opens a panel of choices. Each choice has a default, and RESET puts them all back.
const SETTING_OPTIONS = { performance: PERFORMANCE_CHOICES };
const SETTING_TITLES = { performance: "PERFORMANCE" };
// SMOOTH: the office moves at 30 frames a second. BALANCED: at 15. POWER SAVER: it draws only when something
// changes (a lane, the camera, the theme); an idle office shows no new frames.
const PERFORMANCE_LABELS = { smooth: "SMOOTH", balanced: "BALANCED", saver: "POWER SAVER" };
const label = (key, v) => (key === "performance" ? PERFORMANCE_LABELS[v] : v).toUpperCase();
function renderSettings() {
  const row = (key) => `<div class="srow"><span class="k">${SETTING_TITLES[key]}</span><div class="opts2">${SETTING_OPTIONS[key].map((v) =>
    `<button class="btn-s ${settings[key] === v ? "on" : ""}" type="button" data-set="${key}" data-val="${esc(v)}">${esc(label(key, v))}</button>`).join("")}</div></div>`;
  $("settings").innerHTML = `<div class="shead"><b class="k">SETTINGS</b><span class="spacer"></span><button class="btn-s" type="button" data-close>CLOSE</button></div>`
    + row("performance")
    // The lane tree: what each level is called (from the top: lanes under HQ first; deeper lanes take the last
    // name), shown on the worker card.
    + `<form class="srow" data-levels><span class="k">LEVEL NAMES</span><div class="opts2"><input class="levels" name="levels" maxlength="200" spellcheck="false" autocomplete="off" value="${esc(settings.levels)}" aria-label="Level names, comma-separated"><button class="btn-s" type="submit">SAVE</button></div><span class="hint">From the top, comma-separated. Deeper lanes use the last name.</span></form>`
    + `<div class="sfoot"><button class="btn-s" type="button" data-reset>RESET TO DEFAULTS</button></div>`;
}
function renderSettingsButton() { $("settingsBtn").textContent = "SETTINGS"; }
// The settings changed, here, on another page or from the server.
on("settings", () => {
  if (!$("settings").hidden) renderSettings();
});
$("settingsBtn").addEventListener("click", () => {
  const panel = $("settings");
  panel.hidden = !panel.hidden;
  if (!panel.hidden) renderSettings();
});
$("settings").addEventListener("submit", (e) => {
  const form = e.target.closest("[data-levels]");
  if (!form) return;
  e.preventDefault();
  const levels = form.elements.levels.value.split(",").map((n) => n.trim()).filter(Boolean).join(", ");
  changeSettings({ levels: levels || DEFAULTS.levels });
});
$("settings").addEventListener("click", (e) => {
  const choice = e.target.closest("[data-set]");
  if (choice) { changeSettings({ [choice.dataset.set]: choice.dataset.val }); return; }
  if (e.target.closest("[data-reset]")) { resetSettings(); return; }
  if (e.target.closest("[data-close]")) $("settings").hidden = true;
});
renderSettingsButton();
