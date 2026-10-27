// Tools for low-poly models: collect primitive parts, merge them into one vertex-coloured mesh, and light it per room.
import * as THREE from "../vendor/three/three.module.min.js";
import { RoundedBoxGeometry } from "../vendor/three/addons/RoundedBoxGeometry.js";

export { THREE };

const _c = new THREE.Color();
const FACES = { "+x": [1, 0, 0], "-x": [-1, 0, 0], "+y": [0, 1, 0], "-y": [0, -1, 0], "+z": [0, 0, 1], "-z": [0, 0, -1] };
export const color = (hex) => _c.set(hex).clone();

// A Lambert material, flat shaded, that also takes a per-room light: the room's lamps add `uRoom × albedo`, the way
// each room in the reference carries its own ambient light. Every material of one office shares one uniform.
export function roomLight() {
  return { value: new THREE.Color(0, 0, 0) };
}

export function roomMaterial({ map = null, room = roomLight(), vertexColors = true, transparent = false, side = THREE.FrontSide } = {}) {
  const m = new THREE.MeshLambertMaterial({ vertexColors, map, flatShading: true, transparent, side });
  m.userData.room = room;
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uRoom = room;
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform vec3 uRoom;")
      .replace("#include <lights_fragment_end>", "#include <lights_fragment_end>\n\treflectedLight.indirectDiffuse += diffuseColor.rgb * uRoom;");
  };
  m.customProgramCacheKey = () => "room-lit";
  return m;
}

// Like roomMaterial, for meshes that span rooms (the walls): each vertex carries `aRoom`, an index into `rooms`
// (an array of the rooms' light colours, 0 = outdoors), so a wall's face lights with the room it faces.
export const MAX_ROOMS = 96;
export function roomsMaterial({ map = null, rooms } = {}) {
  const m = new THREE.MeshLambertMaterial({ vertexColors: true, map, flatShading: true });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uRooms = rooms;
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nattribute float aRoom;\nvarying float vRoom;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\n\tvRoom = aRoom;");
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", `#include <common>\nuniform vec3 uRooms[${MAX_ROOMS}];\nvarying float vRoom;`)
      .replace("#include <lights_fragment_end>", "#include <lights_fragment_end>\n\treflectedLight.indirectDiffuse += diffuseColor.rgb * uRooms[int(vRoom + 0.5)];");
  };
  m.customProgramCacheKey = () => "rooms-lit";
  return m;
}

// Parts in, one mesh out. Positions are in the kit's current frame (see `at`); `y` is the bottom of a part.
export class Kit {
  constructor() {
    this.parts = [];
    this.frame = new THREE.Matrix4();
    this.stack = [];
    this.bone = undefined;
    this.tex = undefined;
  }

  // Run fn with the frame moved to (x, y, z) and turned by ry about the vertical.
  at(x, y, z, ry, fn) {
    this.stack.push(this.frame.clone());
    this.frame.multiply(new THREE.Matrix4().makeTranslation(x, y, z)).multiply(new THREE.Matrix4().makeRotationY(ry || 0));
    try { fn(); } finally { this.frame = this.stack.pop(); }
    return this;
  }

  add(geo, hex, x, y, z, o = {}) {
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(o.rx || 0, o.ry || 0, o.rz || 0, "YXZ")),
      new THREE.Vector3(1, 1, 1),
    );
    this.parts.push({ geo, color: color(hex), matrix: this.frame.clone().multiply(m), shade: o.shade, uv: o.uv, room: o.room, tex: o.tex ?? this.tex, bone: this.bone });
    return this;
  }

  // Run fn with every part it adds bound to bone i (a rigid skin: one bone per vertex, weight 1).
  withBone(i, fn) {
    const was = this.bone;
    this.bone = i;
    try { fn(); } finally { this.bone = was; }
    return this;
  }

  // Run fn with every part it adds painted from an atlas region (see Kit.geometry's atlas mode).
  withTex(tex, fn) {
    const was = this.tex;
    this.tex = tex;
    try { fn(); } finally { this.tex = was; }
    return this;
  }

  box(w, h, d, hex, x, y, z, o = {}) {
    const g = new THREE.BoxGeometry(w, h, d);
    g.translate(0, h / 2, 0);
    return this.add(g, hex, x, y, z, o);
  }

  // A box with softened edges: chunky furniture. r is the edge radius.
  rbox(w, h, d, hex, x, y, z, r = 0.03, o = {}) {
    const g = new RoundedBoxGeometry(w, h, d, 1, Math.min(r, w / 2, h / 2, d / 2) * 0.999);
    g.translate(0, h / 2, 0);
    return this.add(g, hex, x, y, z, o);
  }

  cyl(r, h, hex, x, y, z, o = {}) {
    const g = new THREE.CylinderGeometry(o.top ?? r, r, h, o.seg ?? 8, 1, !!o.open);
    g.translate(0, h / 2, 0);
    return this.add(g, hex, x, y, z, o);
  }

  sphere(r, hex, x, y, z, o = {}) {
    const g = new THREE.IcosahedronGeometry(r, o.detail ?? 0);
    if (o.sy) g.scale(1, o.sy, 1);
    return this.add(g, hex, x, y, z, o);
  }

  // A thin quad lying on the floor (y up) or standing, w × d.
  plane(w, d, hex, x, y, z, o = {}) {
    const g = new THREE.PlaneGeometry(w, d);
    g.rotateX(-Math.PI / 2);
    return this.add(g, hex, x, y, z, o);
  }

  get empty() { return this.parts.length === 0; }

  // A point given in the current frame (see `at`), in the kit's own frame: where a separate mesh (a screen, a light)
  // goes to sit on a part.
  point(x, y, z) { return new THREE.Vector3(x, y, z).applyMatrix4(this.frame); }

  // The current frame's turn about the vertical.
  get turn() { const e = new THREE.Euler().setFromRotationMatrix(this.frame, "YXZ"); return e.y; }

  // One BufferGeometry with position, normal, color (and uv when asked). shade(normal, worldPos) -> factor tints faces.
  //   uv: true      world-mapped uvs (walls by run and height, floors by x and z; one texture repeat per metre)
  //   atlas: size   uvs into a square texture atlas of that many pixels: a part with `tex: { r: [x, y, w, h], face }`
  //                 shows that canvas region on its faces whose local normal points to `face` ("+z", "-y", ... or
  //                 "all"); every other face samples the plain texel at `white`, so its vertex colour shows as it is.
  //   skin: true    skinIndex and skinWeight from each part's bone (withBone), for a SkinnedMesh.
  //   ownUv: true   each part's own uvs (a plane shows its whole texture), for decals such as light pools.
  geometry({ uv = false, shade = null, atlas = 0, white = [1, 1], skin = false, ownUv = false } = {}) {
    let n = 0;
    const geos = this.parts.map((p) => {
      const g0 = p.geo.index ? p.geo.toNonIndexed() : p.geo.clone();
      const local = p.tex ? g0.attributes.normal.array.slice() : null;
      const g = g0.applyMatrix4(p.matrix);
      n += g.attributes.position.count;
      return { g, p, local };
    });
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3);
    const uvs = uv || atlas || ownUv ? new Float32Array(n * 2) : null;
    const rooms = this.parts.some((p) => p.room) ? new Float32Array(n) : null;
    const si = skin ? new Uint16Array(n * 4) : null, sw = skin ? new Float32Array(n * 4) : null;
    const wu = atlas ? (white[0] + 0.5) / atlas : 0, wv = atlas ? 1 - (white[1] + 0.5) / atlas : 0;
    let o = 0;
    const v = new THREE.Vector3(), nv = new THREE.Vector3();
    for (const { g, p, local } of geos) {
      const P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv;
      const t = p.tex, dir = t && t.face !== "all" ? FACES[t.face ?? "+z"] : null;
      for (let i = 0; i < P.count; i++, o++) {
        v.fromBufferAttribute(P, i);
        nv.fromBufferAttribute(N, i);
        pos.set([v.x, v.y, v.z], o * 3);
        nor.set([nv.x, nv.y, nv.z], o * 3);
        const f = (p.shade ?? shade)?.(nv, v) ?? 1;
        if (rooms) rooms[o] = p.room ? p.room(nv) : 0;
        col.set([p.color.r * f, p.color.g * f, p.color.b * f], o * 3);
        if (si) { si[o * 4] = p.bone ?? 0; sw[o * 4] = 1; }
        if (atlas) {
          const hit = t && U && (!dir || local[i * 3] * dir[0] + local[i * 3 + 1] * dir[1] + local[i * 3 + 2] * dir[2] > 0.5);
          if (hit) {
            const [rx, ry, rw, rh] = t.r;
            uvs.set([(rx + U.getX(i) * rw) / atlas, 1 - (ry + (1 - U.getY(i)) * rh) / atlas], o * 2);
          } else uvs.set([wu, wv], o * 2);
        } else if (ownUv) {
          uvs.set(U ? [U.getX(i), U.getY(i)] : [0.5, 0.5], o * 2);
        } else if (uvs) {
          // world-mapped: walls by their run and height, floors by x and z (one texture repeat per metre)
          const ax = Math.abs(nv.x), ay = Math.abs(nv.y);
          uvs.set(ay > 0.5 ? [v.x, -v.z] : ax > 0.5 ? [v.z, v.y] : [v.x, v.y], o * 2);
        }
      }
      g.dispose();
    }
    const out = new THREE.BufferGeometry();
    out.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    out.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
    out.setAttribute("color", new THREE.BufferAttribute(col, 3));
    if (uvs) out.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
    if (rooms) out.setAttribute("aRoom", new THREE.BufferAttribute(rooms, 1));
    if (si) { out.setAttribute("skinIndex", new THREE.BufferAttribute(si, 4)); out.setAttribute("skinWeight", new THREE.BufferAttribute(sw, 4)); }
    out.computeBoundingSphere();
    return out;
  }

  mesh(material, opts = {}) {
    const mesh = new THREE.Mesh(this.geometry(opts), material);
    mesh.castShadow = opts.cast ?? true;
    mesh.receiveShadow = opts.receive ?? true;
    return mesh;
  }
}
