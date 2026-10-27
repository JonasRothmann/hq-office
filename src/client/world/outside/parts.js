// The outside's three.js tools: one material that fades into the background past the view's edge (and takes the
// moon), a merger that turns primitives into one vertex-coloured geometry, and instanced meshes from plain items.
import * as THREE from "../../vendor/three/three.module.min.js";

export { THREE };

const colors = new Map();
export function color(hex) {
  if (!colors.has(hex)) colors.set(hex, new THREE.Color(hex));
  return colors.get(hex);
}

// Shared by every material of one outside: the colour everything fades into, the lot (x0, z0, x1, z1), the fade's
// start and end in metres from the lot, a dim for cross-fades, the moon added to everything lit, and the clock.
export function uniforms() {
  return {
    uFadeColor: { value: new THREE.Color("#b4c0a2") },
    uLot: { value: new THREE.Vector4(0, 0, 0, 0) },
    uFade: { value: new THREE.Vector2(34, 60) },
    uDim: { value: 0 },
    uMoon: { value: new THREE.Color(0, 0, 0) },
    uTime: { value: 0 },
    uSheen: { value: new THREE.Color("#ffffff") },
  };
}

// kind: "lit" (Lambert, flat), "glow" (unlit), "add" (unlit, additive, for pools of light), "water" (lit, see
// through, with a moving sheen along aFlow.x).
export function material(U, kind = "lit", o = {}) {
  const basic = kind === "glow" || kind === "add";
  const water = kind === "water";
  const m = basic
    ? new THREE.MeshBasicMaterial({ vertexColors: o.vertexColors ?? true, map: o.map ?? null, transparent: kind === "add", depthWrite: kind !== "add", blending: kind === "add" ? THREE.AdditiveBlending : THREE.NormalBlending })
    : new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: !water, transparent: water, opacity: water ? 0.86 : 1, depthWrite: !water });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", `#include <common>\nvarying vec2 vOutXZ;${water ? "\nattribute vec2 aFlow;\nvarying vec2 vFlow;" : ""}`)
      .replace("#include <project_vertex>", `#include <project_vertex>
  {
    vec4 wp = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
    wp = instanceMatrix * wp;
  #endif
    wp = modelMatrix * wp;
    vOutXZ = wp.xz;
  }${water ? "\n  vFlow = aFlow;" : ""}`);
    let f = sh.fragmentShader.replace("#include <common>", `#include <common>
uniform vec3 uFadeColor; uniform vec4 uLot; uniform vec2 uFade; uniform float uDim; uniform vec3 uMoon; uniform float uTime; uniform vec3 uSheen;
varying vec2 vOutXZ;${water ? "\nvarying vec2 vFlow;" : ""}`);
    if (!basic) f = f.replace("#include <lights_fragment_end>", "#include <lights_fragment_end>\n\treflectedLight.indirectDiffuse += diffuseColor.rgb * uMoon;");
    if (water) {
      // slow bands drifting downstream, broken up across the stream, brightest mid-river
      f = f.replace("#include <color_fragment>", `#include <color_fragment>
  {
    float wob = sin(vFlow.y * 5.3 + vFlow.x * 0.37 + uTime * 0.5) * 0.7 + sin(vFlow.x * 0.13 - vFlow.y * 2.0) * 1.3;
    float band = sin(vFlow.x * 1.7 - uTime * 1.3 + wob);
    float glint = smoothstep(0.93, 1.0, band) * (1.0 - smoothstep(0.35, 0.8, abs(vFlow.y)));
    diffuseColor.rgb = mix(diffuseColor.rgb, uSheen, glint * 0.22);
  }`);
    }
    f = f.replace("#include <opaque_fragment>", `#include <opaque_fragment>
  {
    vec2 q = max(abs(vOutXZ - (uLot.xy + uLot.zw) * 0.5) - (uLot.zw - uLot.xy) * 0.5, 0.0);
    float fade = max(smoothstep(uFade.x, uFade.y, length(q)), uDim);
    ${kind === "add" ? "gl_FragColor.rgb *= 1.0 - fade;" : "gl_FragColor.rgb = mix(gl_FragColor.rgb, uFadeColor, fade);"}
  }`);
    sh.fragmentShader = f;
  };
  m.customProgramCacheKey = () => `outside:${kind}`;
  return m;
}

// Primitives in, one non-indexed geometry with position, normal and colour out.
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3();
export function at(x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  return new THREE.Matrix4().compose(_v.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz, "YXZ")), _s.set(sx, sy, sz));
}

export class Parts {
  constructor() { this.pos = []; this.col = []; this.flow = null; }

  add(geo, hex, m = null) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    if (m) g.applyMatrix4(m);
    const P = g.attributes.position, c = color(hex);
    for (let i = 0; i < P.count; i++) { this.pos.push(P.getX(i), P.getY(i), P.getZ(i)); this.col.push(c.r, c.g, c.b); }
    g.dispose();
    geo.dispose();
    return this;
  }
  box(w, h, d, hex, x, y, z, ry = 0, o = {}) { const g = new THREE.BoxGeometry(w, h, d); g.translate(0, h / 2, 0); return this.add(g, hex, at(x, y, z, ry, o.rx ?? 0, o.rz ?? 0)); }
  cyl(r, h, hex, x, y, z, seg = 6, top = r) { const g = new THREE.CylinderGeometry(top, r, h, seg, 1, false); g.translate(0, h / 2, 0); return this.add(g, hex, at(x, y, z)); }
  cone(r, h, hex, x, y, z, seg = 7, o = {}) { const g = new THREE.ConeGeometry(r, h, seg, 1, false); g.translate(0, h / 2, 0); return this.add(g, hex, at(x, y, z, o.ry ?? 0, o.rx ?? 0, o.rz ?? 0)); }
  ico(r, hex, x, y, z, sy = 1, sx = 1, sz = 1, ry = 0) { const g = new THREE.IcosahedronGeometry(r, 0); g.scale(sx, sy, sz); return this.add(g, hex, at(x, y, z, ry)); }
  // A flat quad at height y, from (x0, z0) to (x1, z1), facing up.
  quad(x0, z0, x1, z1, y, hex) {
    const c = color(hex);
    this.pos.push(x0, y, z0, x0, y, z1, x1, y, z1, x0, y, z0, x1, y, z1, x1, y, z0);
    for (let k = 0; k < 6; k++) this.col.push(c.r, c.g, c.b);
    return this;
  }
  get empty() { return this.pos.length === 0; }

  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(this.col, 3));
    if (this.flow) g.setAttribute("aFlow", new THREE.Float32BufferAttribute(this.flow, 2));
    g.computeVertexNormals();
    g.computeBoundingSphere();
    return g;
  }
}

// An InstancedMesh of `geo` for items; place(item, i) returns the item's matrix, tint(item, i) its colour or null.
export function instanced(name, geo, mat, items, place, tint = null) {
  if (!items.length) { geo.dispose(); return null; }
  const mesh = new THREE.InstancedMesh(geo, mat, items.length);
  mesh.name = name;
  items.forEach((it, i) => {
    mesh.setMatrixAt(i, place(it, i));
    if (tint) mesh.setColorAt(i, tint(it, i));
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.computeBoundingSphere();
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  return mesh;
}

// A soft round pool of light, drawn once.
let poolTex = null;
export function poolTexture() {
  if (poolTex) return poolTex;
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d");
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, "rgba(255,255,255,0.9)");
  r.addColorStop(0.45, "rgba(255,255,255,0.35)");
  r.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = r;
  g.fillRect(0, 0, 64, 64);
  poolTex = new THREE.CanvasTexture(c);
  poolTex.colorSpace = THREE.SRGBColorSpace;
  return poolTex;
}
