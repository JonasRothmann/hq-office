// The one scale rule for small things drawn over the office (subagent balls, desk lights, badges): grow them at far
// zooms so they stay readable, and keep their true size once the camera is close enough.

// The scale that makes something `metres` across at least `px` CSS pixels across at `ppm` (the camera's CSS px per
// metre, world.camera.state.ppm). Never below 1.
export const atLeast = (metres, ppm, px) => (ppm > 0 ? Math.max(1, px / (metres * ppm)) : 1);
