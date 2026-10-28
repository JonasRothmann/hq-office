// The theme: system, light or dark. The choice is kept in this browser; <html data-theme> always holds the theme in
// effect ("light" or "dark"), and the bus hears "theme" with it whenever it changes, the system's own changes included.
// A module that starts later reads effectiveTheme() once, then listens.
import { emit } from "../core/bus.js";
import { $ } from "../core/dom.js";

const KEY = "hq-theme";
const CHOICES = ["system", "light", "dark"];
const systemDark = matchMedia("(prefers-color-scheme: dark)");
const read = () => { try { const v = localStorage.getItem(KEY); return CHOICES.includes(v) ? v : "system"; } catch { return "system"; } };
let choice = read();
let shown = null;

export const themeChoice = () => choice;
export const effectiveTheme = () => (choice === "system" ? (systemDark.matches ? "dark" : "light") : choice);

const ICONS = {
  system: `<svg viewBox="0 0 14 14" aria-hidden="true"><circle cx="7" cy="7" r="5.25" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M7 1.75a5.25 5.25 0 0 1 0 10.5z" fill="currentColor"/></svg>`,
  light: `<svg viewBox="0 0 14 14" aria-hidden="true"><circle cx="7" cy="7" r="2.75" fill="currentColor"/><path d="M7 .75v1.5M7 11.75v1.5M.75 7h1.5M11.75 7h1.5M2.6 2.6l1.06 1.06M10.34 10.34l1.06 1.06M2.6 11.4l1.06-1.06M10.34 3.66l1.06-1.06" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>`,
  dark: `<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M11.9 8.6A5.25 5.25 0 0 1 5.4 2.1a5.25 5.25 0 1 0 6.5 6.5z" fill="currentColor"/></svg>`,
};
const WORDS = { system: "AUTO", light: "LIGHT", dark: "DARK" };
const NEXT = { system: "light", light: "dark", dark: "system" };

function apply() {
  const eff = effectiveTheme();
  const root = document.documentElement;
  if (root.dataset.theme !== eff) root.dataset.theme = eff;
  const btn = $("themeBtn");
  if (btn) {
    btn.innerHTML = `${ICONS[choice]}<span class="lbl">${WORDS[choice]}</span>`;
    const tip = `Theme: ${choice === "system" ? `follows the system (${eff})` : choice}. Click for ${NEXT[choice] === "system" ? "the system's" : NEXT[choice]}.`;
    btn.title = tip;
    btn.setAttribute("aria-label", tip);
  }
  if (eff !== shown) { shown = eff; emit("theme", eff); }
}

$("themeBtn")?.addEventListener("click", () => {
  choice = NEXT[choice];
  try { if (choice === "system") localStorage.removeItem(KEY); else localStorage.setItem(KEY, choice); } catch {}
  apply();
});
systemDark.addEventListener("change", apply);
// another tab of the page picked a theme
addEventListener("storage", (e) => { if (e.key === KEY || e.key === null) { choice = read(); apply(); } });
apply();
