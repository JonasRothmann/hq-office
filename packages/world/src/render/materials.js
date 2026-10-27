// Materials: Lambert with vertex colours (matte), unlit glow, and glass; patterned variants with small textures drawn
// in code. Every engine material swaps three's screen-space shadow dither for a fixed rotation, per material (never by
// editing THREE.ShaderChunk, which the app's other three.js code shares).
import * as THREE from "three";

// three r186's PCF filter rotates its taps by interleavedGradientNoise(gl_FragCoord.xy): a dither fixed to the screen,
// so every penumbra crawls while the world pans under it. A constant angle fixes the taps to the shadow map (the world).
const SCREEN_NOISE = "interleavedGradientNoise( gl_FragCoord.xy ) * PI2";
let warned = false;
export function worldFixedShadows(material) {
  material.onBeforeCompile = (shader) => {
    const chunk = THREE.ShaderChunk.shadowmap_pars_fragment;
    if (!chunk.includes(SCREEN_NOISE)) {
      if (!warned) console.warn("@hq/world: three's shadow chunk changed; shadows keep the screen-space dither");
      warned = true;
      return;
    }
    shader.fragmentShader = shader.fragmentShader.replace("#include <shadowmap_pars_fragment>", chunk.replace(SCREEN_NOISE, "0.7853981"));
  };
  material.customProgramCacheKey = () => "hq-world-fixed-shadows";
  return material;
}

// Greyscale patterns, one metre per repeat (UVs are world-mapped), multiplied by the vertex colour.
function patternTexture(pattern) {
  const S = 128, c = document.createElement("canvas");
  c.width = c.height = S;
  const g = c.getContext("2d");
  g.fillStyle = "#fff";
  g.fillRect(0, 0, S, S);
  if (pattern === "planks") {
    // boards 0.2 m wide along x, with staggered joints and a slight tone per board
    for (let i = 0; i < 5; i++) {
      const y = (i * S) / 5;
      g.fillStyle = `rgba(0,0,0,${[0.0, 0.05, 0.02, 0.07, 0.03][i]})`;
      g.fillRect(0, y, S, S / 5);
      g.fillStyle = "rgba(60,40,20,0.28)";
      g.fillRect(0, y, S, 1.5);
      g.fillRect(((i * 53) % S), y, 1.5, S / 5);
    }
  } else if (pattern === "boards") {
    for (let i = 0; i < 8; i++) { g.fillStyle = "rgba(20,30,40,0.22)"; g.fillRect(0, (i * S) / 8, S, 2); }
  } else if (pattern === "tiles") {
    g.fillStyle = "rgba(0,0,0,0.18)";
    for (let i = 0; i < 2; i++) { g.fillRect(0, (i * S) / 2, S, 2); g.fillRect((i * S) / 2, 0, 2, S); }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}

export function createMaterials({ screenNoise = false } = {}) {
  const fix = (m) => (screenNoise ? m : worldFixedShadows(m));
  const cache = new Map();
  const make = (finish, pattern) => {
    const key = `${finish}:${pattern ?? ""}`;
    if (cache.has(key)) return cache.get(key);
    let m;
    if (finish === "glow") m = new THREE.MeshBasicMaterial({ vertexColors: true });
    else if (finish === "glass") m = fix(new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.45, depthWrite: false }));
    else m = fix(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, map: pattern && pattern !== "plain" ? patternTexture(pattern) : null }));
    cache.set(key, m);
    return m;
  };
  const highlight = fix(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, emissive: new THREE.Color("#ffd27a"), emissiveIntensity: 0.28 }));
  return {
    get: make,
    highlight,
    dispose() { for (const m of cache.values()) { m.map?.dispose(); m.dispose(); } highlight.dispose(); },
  };
}
