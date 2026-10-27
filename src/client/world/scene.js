// The renderer, the lights for day and night, soft shadows, and a frame loop capped to stay cheap beside other work.
import { THREE } from "./kit.js";

const MAX_DPR = 2;
const SHADOW_MAP = 2048;

export function createScene(canvas, { fps = 30 } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "low-power", preserveDrawingBuffer: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_DPR));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  // a flat ambient carries most of the light (the reference lights rooms evenly); the hemisphere and the key add form
  const amb = new THREE.AmbientLight("#ffffff", 1.8);
  const hemi = new THREE.HemisphereLight("#fff6e8", "#b9a58a", 0.8);
  const key = new THREE.DirectionalLight("#fff1dc", 1.2);
  key.castShadow = true;
  key.shadow.mapSize.set(SHADOW_MAP, SHADOW_MAP);
  key.shadow.radius = 4;
  key.shadow.blurSamples = 12;
  key.shadow.bias = -0.0006;
  key.shadow.normalBias = 0.02;
  scene.add(amb, hemi, key, key.target);

  // Lights for a look: the key comes from the upper left of the default view, high, so shadows stay short and soft.
  function setLights(L, bounds) {
    const l = L.light;
    scene.background = new THREE.Color(L.bg);
    amb.color.set(l.amb); amb.intensity = l.ambI;
    hemi.color.set(l.sky); hemi.groundColor.set(l.ground); hemi.intensity = l.hemi;
    key.color.set(l.key); key.intensity = l.keyI;
    key.castShadow = l.shadow > 0;
    if ("intensity" in key.shadow) key.shadow.intensity = l.shadow;
    const cx = (bounds.minX + bounds.maxX) / 2, cz = (bounds.minZ + bounds.maxZ) / 2;
    const span = Math.max(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ) / 2 + 6;
    // from the front left of the default view: back walls (facing +z) catch it, side walls (facing +x) do not
    key.position.set(cx - 16, 24, cz + 17);
    key.target.position.set(cx, 0, cz);
    const c = key.shadow.camera;
    c.left = -span * 1.2; c.right = span * 1.2; c.top = span * 1.2; c.bottom = -span * 1.2;
    c.near = 1; c.far = 90;
    c.updateProjectionMatrix();
    key.shadow.needsUpdate = true;
  }

  let raf = 0, last = 0, running = false;
  const frame = 1000 / fps;
  function start(tick) {
    running = true;
    const loop = (now) => {
      if (!running) return;
      raf = requestAnimationFrame(loop);
      if (document.hidden) return;
      if (now - last < frame - 2) return;
      const dt = Math.min(0.1, (now - (last || now)) / 1000);
      last = now;
      tick(now, dt);
    };
    raf = requestAnimationFrame(loop);
  }
  function stop() { running = false; cancelAnimationFrame(raf); }

  function resize(w, h) {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_DPR));
    renderer.setSize(w, h, false);
  }

  return { renderer, scene, hemi, key, setLights, start, stop, resize };
}
