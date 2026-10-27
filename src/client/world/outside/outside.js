// The land around the office, mounted on a scene: mountOutside(scene, { mode, seed, lot, theme }) generates the
// valley or the town (gen.js), builds it (build.js), keeps its cars, people and water moving, and fades it out and in
// again when the mode, the seed or the lot (beyond a step, see growLot) changes. It owns the scene's background while
// mounted, so the soft edge it fades into is the colour behind it.
import { THREE, uniforms } from "./parts.js";
import { generate, growLot } from "./gen.js";
import { paletteFor } from "./palette.js";
import { buildOutside } from "./build.js";

const FADE_MS = 380;

export function mountOutside(scene, { mode = "nature", seed = 1, lot, theme = "light" } = {}) {
  const U = uniforms();
  const root = new THREE.Group();
  root.name = "outside";
  scene.add(root);
  const before = scene.isScene ? scene.background : null;
  let state = { mode: mode === "city" ? "city" : "nature", seed, lot: growLot(lot), theme };
  let P = paletteFor(theme), layout = null, built = null;
  let fade = null; // { at, next: state to build at the bottom, out: true while going down }
  const bg = new THREE.Color();

  function rebuild() {
    built?.dispose();
    if (built) root.remove(built.group);
    P = paletteFor(state.theme);
    layout = generate({ mode: state.mode, seed: state.seed, lot: state.lot });
    built = buildOutside(layout, P, U);
    root.add(built.group);
    bg.set(P[state.mode].bg);
    U.uFadeColor.value.copy(bg);
  }

  // Change what is shown: a fade down to the background, a rebuild, a fade back up.
  function change(next) {
    // from wherever a fade in progress has got to, so the dim never jumps
    fade = { at: performance.now() - U.uDim.value * FADE_MS, next: { ...(fade?.next ?? state), ...next }, out: true };
  }

  rebuild();

  return {
    get layout() { return layout; },
    get background() { return bg; },
    setLot(l) {
      const target = fade?.next ?? state;
      const g = growLot(l, target.lot);
      if (g !== target.lot) change({ lot: g });
    },
    setMode(m) { const v = m === "city" ? "city" : "nature"; if (v !== (fade?.next ?? state).mode) change({ mode: v }); },
    setSeed(s) { if (s !== (fade?.next ?? state).seed) change({ seed: s }); },
    // The theme changes at once, as the office relights at once.
    setTheme(t) {
      if (fade) fade.next.theme = t;
      state = { ...state, theme: t };
      rebuild();
    },
    // now: ms (performance.now()), dt: seconds. Nothing moves while the tab is hidden.
    update(now, dt) {
      if (typeof document !== "undefined" && document.hidden) return;
      if (fade) {
        const k = (now - fade.at) / FADE_MS;
        if (fade.out) {
          U.uDim.value = Math.min(1, Math.max(0, k));
          if (k >= 1) { state = fade.next; rebuild(); fade = { at: now, out: false }; U.uDim.value = 1; }
        } else {
          U.uDim.value = 1 - Math.min(1, Math.max(0, k));
          if (k >= 1) { fade = null; U.uDim.value = 0; }
        }
      }
      if (scene.isScene && !(scene.background?.isColor && scene.background.equals(bg))) scene.background = bg.clone();
      built.update(now, dt);
    },
    // What it costs and holds, for the lab and tests.
    inspect() {
      let meshes = 0, instances = 0;
      root.traverse((o) => { if (o.isMesh) { meshes++; instances += o.isInstancedMesh ? o.count : 1; } });
      return { mode: state.mode, seed: state.seed, lot: state.lot, meshes, instances, fading: !!fade };
    },
    dispose() {
      built?.dispose();
      scene.remove(root);
      if (scene.isScene) scene.background = before;
    },
  };
}
