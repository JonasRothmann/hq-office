// The stage: the renderer (MSAA, sRGB, Neutral tone mapping), the light rig and time of day, and one sun shadow
// fitted to the lot and snapped to whole shadow texels. The shadow map redraws only when told something moved.
import * as THREE from "three";

const SHADOW_MAP = 2048;
const SHADOW_RADIUS = 1.5; // texels; the taps are world-fixed (materials.js), so a soft edge stays still

// Sun colour through the day (outside light, after the Sims 1 reference): sunrise and sunset #D96D32, day white,
// dusk #575757, night #3E5898.
const SKY = [
  [0, "#3e5898", 0.35], [5, "#3e5898", 0.35], [6.5, "#d96d32", 0.75], [8, "#fff1dc", 1], [12, "#ffffff", 1],
  [17, "#fff1dc", 1], [19, "#d96d32", 0.75], [20, "#575757", 0.45], [21, "#3e5898", 0.35], [24, "#3e5898", 0.35],
];
const _a = new THREE.Color(), _b = new THREE.Color();

// A lamp's light at full night: warm, no shadow, out by day. It shines down in a wide soft cone, so it makes a pool on
// the floor and the desks under it, and a lamp in a corner does not burn a white patch on the wall beside it. The
// square fall-off within REACH metres leaves the rest of a room to the night's low fill. INTENSITY keeps a desk 1 m
// under a pendant short of white.
const LAMP = { intensity: 4.2, reach: 6, decay: 2, angle: 1.05, penumbra: 0.9 };
// How much of the day's fill (ambient and sky) is left at a light level: a curve, so dusk stays bright and night drops.
const fill = (level) => level ** 1.35;

export function parseTime(t) {
  if (typeof t === "number") return ((t % 24) + 24) % 24;
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(t));
  return m ? (Number(m[1]) + Number(m[2]) / 60) % 24 : 14;
}

// { color, level (0..1 of daylight), sun: unit vector toward the sun, day: whether the sun is up }
export function skyAt(hours) {
  let i = 0;
  while (i < SKY.length - 2 && SKY[i + 1][0] <= hours) i++;
  const [h0, c0, l0] = SKY[i], [h1, c1, l1] = SKY[i + 1];
  const k = h1 > h0 ? (hours - h0) / (h1 - h0) : 0;
  const color = _a.set(c0).lerp(_b.set(c1), k).clone();
  const level = l0 + (l1 - l0) * k;
  // the sun rises in the east (+x) at 6:00, stands south (+z) at 12:30 and sets in the west at 19:00
  const day = hours > 6 && hours < 19;
  const phi = day ? (Math.PI * (hours - 6)) / 13 : Math.PI * 0.62;
  const elev = day ? Math.max(0.35, Math.sin((Math.PI * (hours - 6)) / 13) * 1.05) : 0.9; // the moon stays high
  const sun = new THREE.Vector3(Math.cos(elev) * Math.cos(phi), Math.sin(elev), Math.cos(elev) * Math.sin(phi)).normalize();
  return { color, level, sun, day };
}

export function createStage(canvas, { antialias = true } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias, alpha: false, powerPreference: "high-performance" });
  renderer.setPixelRatio(1); // sizes are in device pixels already (view/size.js)
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;

  const scene = new THREE.Scene();
  const ambient = new THREE.AmbientLight("#ffffff", 1);
  const hemi = new THREE.HemisphereLight("#fff6e8", "#b9a58a", 1);
  const sun = new THREE.DirectionalLight("#ffffff", 1.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(SHADOW_MAP, SHADOW_MAP);
  sun.shadow.radius = SHADOW_RADIUS;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.015;
  scene.add(ambient, hemi, sun, sun.target);

  let box = { min: [0, 0, 0], max: [10, 3, 10] }, sunDir = new THREE.Vector3(0, 1, 0);

  // Fit the sun's shadow camera to the box, centred on it and snapped to whole texels in the light's frame, so the
  // same world point always falls on the same texel: shadows never swim when the lot is refitted or the sun returns.
  function fitShadow() {
    const centre = new THREE.Vector3((box.min[0] + box.max[0]) / 2, (box.min[1] + box.max[1]) / 2, (box.min[2] + box.max[2]) / 2);
    const fwd = sunDir.clone().negate();
    const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize();
    const up = new THREE.Vector3().crossVectors(right, fwd).normalize();
    let half = 0, depth = 0;
    for (const x of [box.min[0], box.max[0]]) for (const y of [box.min[1], box.max[1]]) for (const z of [box.min[2], box.max[2]]) {
      const v = new THREE.Vector3(x, y, z).sub(centre);
      half = Math.max(half, Math.abs(v.dot(right)), Math.abs(v.dot(up)));
      depth = Math.max(depth, Math.abs(v.dot(fwd)));
    }
    half = Math.ceil(half + 0.5); // whole metres: the texel size only changes when the lot does
    const texel = (2 * half) / SHADOW_MAP;
    const snap = (axis) => { const d = centre.dot(axis); return axis.clone().multiplyScalar(Math.round(d / texel) * texel - d); };
    centre.add(snap(right)).add(snap(up));
    const dist = depth + 20;
    sun.position.copy(centre).addScaledVector(sunDir, dist);
    sun.target.position.copy(centre);
    const c = sun.shadow.camera;
    c.left = -half; c.right = half; c.top = half; c.bottom = -half;
    c.near = 1; c.far = dist + depth + 20;
    c.updateProjectionMatrix();
    sun.updateMatrixWorld();
    sun.target.updateMatrixWorld();
    renderer.shadowMap.needsUpdate = true;
  }

  function setShadowBox(b) { box = b; fitShadow(); }

  // Lamps: one light per object with a light anchor (or the host's, view.addLamp), at `at` in world space, aimed
  // straight down, lit by night only. Each keeps its own base intensity and colour (null: the palette's `lamp`); its
  // light is that base times the night. Spot lights, so the outdoor materials leave them out (materials.js).
  const lamps = new Set();
  let night = 0, lampColor = "#ffe3ad";
  const light = (l) => { const o = l.userData.lamp; l.intensity = o.intensity * night; l.color.set(o.color ?? lampColor); };
  function addLamp(at, o = {}) {
    const l = new THREE.SpotLight(lampColor, 0, o.reach ?? LAMP.reach, o.angle ?? LAMP.angle, o.penumbra ?? LAMP.penumbra, o.decay ?? LAMP.decay);
    l.userData.lamp = { intensity: o.intensity ?? LAMP.intensity, color: o.color ?? null };
    light(l);
    l.position.set(...at);
    l.target.position.set(at[0], 0, at[2]);
    scene.add(l, l.target);
    l.updateMatrixWorld();
    l.target.updateMatrixWorld();
    lamps.add(l);
    return l;
  }
  // { intensity?, color? }: a new base; color null follows the palette again
  function setLamp(l, o) {
    if (o.intensity !== undefined) l.userData.lamp.intensity = o.intensity;
    if (o.color !== undefined) l.userData.lamp.color = o.color;
    light(l);
  }
  function removeLamp(l) { scene.remove(l, l.target); l.dispose(); lamps.delete(l); }

  function setTime(t, palette) {
    const s = skyAt(parseTime(t));
    sunDir = s.sun;
    night = 1 - s.level;
    const f = fill(s.level);
    sun.color.copy(s.color);
    sun.intensity = 1.7 * s.level ** 1.3;
    sun.castShadow = true;
    sun.shadow.intensity = 0.55 + 0.25 * s.level;
    ambient.color.copy(s.color).lerp(new THREE.Color("#ffffff"), 0.4);
    ambient.intensity = 1.3 * f;
    hemi.color.set(palette?.sky ?? "#fff6e8").lerp(s.color, 0.5);
    hemi.groundColor.set("#b9a58a");
    hemi.intensity = 1.2 * f;
    scene.background = new THREE.Color(palette?.bg ?? "#dfe6ea");
    lampColor = palette?.lamp ?? lampColor;
    for (const l of lamps) light(l);
    fitShadow();
    return { night };
  }

  // The backing store, in device pixels (whole numbers); the canvas's CSS size is left to the page.
  function resize(bw, bh) {
    renderer.setSize(bw, bh, false);
  }

  return { renderer, scene, sun, ambient, hemi, setTime, setShadowBox, resize, addLamp, setLamp, removeLamp, invalidateShadows: () => { renderer.shadowMap.needsUpdate = true; } };
}
