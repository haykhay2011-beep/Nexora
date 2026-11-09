import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Build one merged, vertex-coloured, non-indexed geometry from primitive parts.
// parts: [{ geo, color, pos:[x,y,z], rot:[x,y,z], scale:[x,y,z] }]
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _v = new THREE.Vector3();
const _s = new THREE.Vector3();
const _c = new THREE.Color();

export function part(geo, color, pos = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1]) {
  return { geo, color, pos, rot, scale };
}

export function mergeParts(parts) {
  const geos = parts.map((p) => {
    let g = p.geo.index ? p.geo.toNonIndexed() : p.geo.clone();
    g.deleteAttribute('uv');
    _e.set(p.rot[0], p.rot[1], p.rot[2], p.rot[3] || 'XYZ');
    _q.setFromEuler(_e);
    _m.compose(_v.set(p.pos[0], p.pos[1], p.pos[2]), _q, _s.set(p.scale[0], p.scale[1], p.scale[2]));
    g.applyMatrix4(_m);
    const n = g.attributes.position.count;
    const col = new Float32Array(n * 3);
    _c.set(p.color);
    for (let i = 0; i < n; i++) {
      col[i * 3] = _c.r; col[i * 3 + 1] = _c.g; col[i * 3 + 2] = _c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return g;
  });
  const merged = mergeGeometries(geos, false);
  geos.forEach((g) => g.dispose());
  merged.computeVertexNormals();
  merged.computeBoundingSphere();
  return merged;
}

// Shared materials (created once).
export const MAT = {
  flat: new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }),
  flatNoFog: new THREE.MeshBasicMaterial({ vertexColors: true, fog: false }),
  glow: new THREE.MeshBasicMaterial({ vertexColors: true }),
};
