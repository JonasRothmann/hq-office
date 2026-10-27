// Materials: Lambert with vertex colours (matte), unlit glow, and glass; patterned variants with small textures drawn
// in code. Every engine material swaps three's screen-space shadow dither for a fixed rotation, per material (never by
// editing THREE.ShaderChunk, which the app's other three.js code shares). An outdoor variant of each (the ground and
// the scenery) takes no light from the lamps, which would shine through walls, and fades into the background colour
// away from a box (the scenery's fade).
import * as THREE from "three";

// three r186's PCF filter rotates its taps by interleavedGradientNoise(gl_FragCoord.xy): a dither fixed to the screen,
// so every penumbra crawls while the world pans under it. A constant angle fixes the taps to the shadow map (the world).
const SCREEN_NOISE = "interleavedGradientNoise( gl_FragCoord.xy ) * PI2";
let warned = false;
export function worldFixedShadows(material, then = null) {
  material.onBeforeCompile = (shader) => {
    const chunk = THREE.ShaderChunk.shadowmap_pars_fragment;
    if (!chunk.includes(SCREEN_NOISE)) {
      if (!warned) console.warn("@hq/world: three's shadow chunk changed; shadows keep the screen-space dither");
      warned = true;
    } else shader.fragmentShader = shader.fragmentShader.replace("#include <shadowmap_pars_fragment>", chunk.replace(SCREEN_NOISE, "0.7853981"));
    then?.(shader);
  };
  material.customProgramCacheKey = () => `hq-world-fixed-shadows${then ? "-outdoor" : ""}`;
  return material;
}

// Lamps are spot lights with no shadows, so they light whatever lies in their cone, walls or not. Outdoor surfaces
// leave every spot light out (the lamps are the lot's own, indoors), and fade toward the fade colour from `from` to
// `to` metres outside the fade box. The colour is in the output space, like the cleared background, so they meet.
const SPOTS = "#if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )";
// A light (a pool of light) adds its colour, fading out from its object's origin to 0.5 m and past the fade box.
function outdoor(fade, light = false) {
  return (shader) => {
    Object.assign(shader.uniforms, { hqFadeBox: fade.box, hqFadeRange: fade.range, hqFadeColor: fade.color });
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec2 hqXZ;\nvarying vec2 hqLocal;")
      .replace("#include <project_vertex>", `#include <project_vertex>
  hqLocal = position.xz;
  {
    vec4 hqW = vec4( transformed, 1.0 );
  #ifdef USE_INSTANCING
    hqW = instanceMatrix * hqW;
  #endif
    hqXZ = ( modelMatrix * hqW ).xz;
  }`);
    const lights = THREE.ShaderChunk.lights_fragment_begin;
    let f = shader.fragmentShader;
    if (lights.includes(SPOTS)) f = f.replace("#include <lights_fragment_begin>", lights.replace(SPOTS, "#if 0"));
    shader.fragmentShader = f
      .replace("#include <common>", "#include <common>\nvarying vec2 hqXZ;\nvarying vec2 hqLocal;\nuniform vec4 hqFadeBox;\nuniform vec2 hqFadeRange;\nuniform vec3 hqFadeColor;")
      .replace("#include <colorspace_fragment>", `#include <colorspace_fragment>
  {
    vec2 hqD = max( max( hqFadeBox.xy - hqXZ, hqXZ - hqFadeBox.zw ), 0.0 );
    float hqFar = smoothstep( hqFadeRange.x, hqFadeRange.y, length( hqD ) );
    ${light ? "gl_FragColor.rgb *= ( 1.0 - smoothstep( 0.0, 0.5, length( hqLocal ) ) ) * ( 1.0 - hqFar );" : "gl_FragColor.rgb = mix( gl_FragColor.rgb, hqFadeColor, hqFar );"}
  }`);
  };
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
  } else if (pattern === "battens") {
    // upright battens 4 cm apart (u runs along the wall), each a slightly different tone, with dark gaps between
    const n = 25, w = S / n;
    for (let i = 0; i < n; i++) {
      g.fillStyle = `rgba(0,0,0,${[0.0, 0.06, 0.03, 0.08, 0.02][i % 5]})`;
      g.fillRect(i * w, 0, w, S);
      g.fillStyle = "rgba(255,255,255,0.18)";
      g.fillRect(i * w + 1.2, 0, 0.8, S);
      g.fillStyle = "rgba(25,15,5,0.62)";
      g.fillRect(i * w, 0, 1.2, S);
    }
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
  // the outdoor variants' fade, shared by all of them: off (infinitely far) until setFade
  const fade = { box: { value: new THREE.Vector4(0, 0, 0, 0) }, range: { value: new THREE.Vector2(1e6, 2e6) }, color: { value: new THREE.Color(1, 1, 1) } };
  const fix = (m, then = null) => {
    if (!screenNoise) return worldFixedShadows(m, then);
    if (then) { m.onBeforeCompile = then; m.customProgramCacheKey = () => "hq-world-outdoor"; }
    return m;
  };
  const cache = new Map();
  // opts.outdoor: the variant for the ground and the scenery (no lamp light; the fade). Outdoor glass is water.
  const make = (finish, pattern, { outdoor: out = false } = {}) => {
    const key = `${finish}:${pattern ?? ""}${out ? ":outdoor" : ""}`;
    if (cache.has(key)) return cache.get(key);
    const then = out ? outdoor(fade) : null;
    let m;
    if (finish === "light") {
      m = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
      m.onBeforeCompile = outdoor(fade, true);
      m.customProgramCacheKey = () => "hq-world-light";
    } else if (finish === "glow") { m = new THREE.MeshBasicMaterial({ vertexColors: true }); if (then) { m.onBeforeCompile = then; m.customProgramCacheKey = () => "hq-world-outdoor"; } }
    else if (finish === "glass") m = fix(new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: out ? 0.86 : 0.45, depthWrite: false }), then);
    else m = fix(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, map: pattern && pattern !== "plain" ? patternTexture(pattern) : null }), then);
    cache.set(key, m);
    return m;
  };
  // The outdoor fade: from `from` to `to` metres outside `box` ({ minX, minZ, maxX, maxZ }) everything outdoors turns
  // to `color` (the background's hex). null switches it off.
  function setFade(f, color) {
    if (!f) { fade.range.value.set(1e6, 2e6); return; }
    fade.box.value.set(f.box.minX, f.box.minZ, f.box.maxX, f.box.maxZ);
    fade.range.value.set(f.from, f.to);
    if (color) fade.color.value.set(color).convertLinearToSRGB();
  }
  const highlight = fix(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, emissive: new THREE.Color("#ffd27a"), emissiveIntensity: 0.28 }));
  return {
    get: make,
    setFade,
    highlight,
    dispose() { for (const m of cache.values()) { m.map?.dispose(); m.dispose(); } highlight.dispose(); },
  };
}
