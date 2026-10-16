import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { getMaterials } from './Materials.js';
import { mulberry32 } from '../core/math.js';

const CELL = 64;
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();

// Build a transform matrix: position, rotation (x, y, z radians) and scale.
export function T(x, y, z, ry = 0, sx = 1, sy = sx, sz = sx, rx = 0, rz = 0) {
  _e.set(rx, ry, rz, 'YXZ');
  _q.setFromEuler(_e);
  _s.set(sx, sy, sz);
  _p.set(x, y, z);
  return new THREE.Matrix4().compose(_p, _q, _s);
}

// Merges static props into one mesh per (cell, material) so the world costs few draw calls.
// Cells far from the player are hidden.
export class StaticBatcher {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'static-props';
    scene.add(this.group);
    this.buckets = new Map();
    this.meshes = [];
    this.rand = mulberry32(99);
    this.colorAttrCache = new THREE.Color();
  }

  // geometry: any BufferGeometry. color: hex or THREE.Color (ignored if keepColors and geometry has colors).
  add(geometry, matName, matrix, color = 0xffffff, jitter = 0.08, keepColors = false) {
    let g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    for (const name of Object.keys(g.attributes)) {
      if (name !== 'position' && !(keepColors && name === 'color')) g.deleteAttribute(name);
    }
    if (matrix) g.applyMatrix4(matrix);
    const pos = g.attributes.position;
    if (!keepColors || !g.attributes.color) {
      const col = color instanceof THREE.Color ? color : new THREE.Color(color);
      const arr = new Float32Array(pos.count * 3);
      for (let i = 0; i < pos.count; i += 3) {
        const j = 1 + (this.rand() - 0.5) * 2 * jitter;
        for (let k = 0; k < 3 && i + k < pos.count; k++) {
          arr[(i + k) * 3] = Math.min(1, col.r * j);
          arr[(i + k) * 3 + 1] = Math.min(1, col.g * j);
          arr[(i + k) * 3 + 2] = Math.min(1, col.b * j);
        }
      }
      g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    }
    // cell from first vertex centroid
    g.computeBoundingBox();
    const bb = g.boundingBox;
    const cx = Math.floor((bb.min.x + bb.max.x) / 2 / CELL);
    const cz = Math.floor((bb.min.z + bb.max.z) / 2 / CELL);
    const key = `${cx},${cz}|${matName}`;
    let b = this.buckets.get(key);
    if (!b) this.buckets.set(key, (b = { cx, cz, matName, geos: [] }));
    b.geos.push(g);
    return g;
  }

  finalize() {
    const mats = getMaterials();
    for (const b of this.buckets.values()) {
      const merged = mergeGeometries(b.geos, false);
      for (const g of b.geos) g.dispose();
      merged.computeBoundingSphere();
      const mesh = new THREE.Mesh(merged, mats[b.matName]);
      mesh.matrixAutoUpdate = false;
      mesh.userData.cx = (b.cx + 0.5) * CELL;
      mesh.userData.cz = (b.cz + 0.5) * CELL;
      mesh.userData.radius = merged.boundingSphere.radius;
      this.group.add(mesh);
      this.meshes.push(mesh);
    }
    this.buckets.clear();
  }

  update(px, pz, viewDist) {
    for (const m of this.meshes) {
      const d = Math.hypot(m.userData.cx - px, m.userData.cz - pz) - m.userData.radius;
      m.visible = d < viewDist;
    }
  }
}
