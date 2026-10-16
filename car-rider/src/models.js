// Helpers for building low-poly models out of Three.js primitives.
// Parts are baked into a single vertex-coloured geometry so each model is a
// single draw call.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export const flatMaterial = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _c = new THREE.Color();

export class PartBuilder {
  constructor() {
    this.parts = [];
  }

  // pos: [x,y,z], rot: [rx,ry,rz], scale: [sx,sy,sz]
  add(geometry, color, pos = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1]) {
    let g = geometry.index ? geometry.toNonIndexed() : geometry;
    if (g === geometry) g = geometry.clone();
    for (const name of Object.keys(g.attributes)) {
      if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
    }
    _e.set(rot[0], rot[1], rot[2]);
    _q.setFromEuler(_e);
    _p.set(pos[0], pos[1], pos[2]);
    _s.set(scale[0], scale[1], scale[2]);
    _m.compose(_p, _q, _s);
    g.applyMatrix4(_m);
    _c.set(color);
    const n = g.attributes.position.count;
    const colors = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      colors[i * 3] = _c.r;
      colors[i * 3 + 1] = _c.g;
      colors[i * 3 + 2] = _c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    this.parts.push(g);
    if (geometry !== g) geometry.dispose();
    return this;
  }

  box(w, h, d, color, pos, rot) {
    return this.add(new THREE.BoxGeometry(w, h, d), color, pos, rot);
  }

  // Box whose top face is shrunk (cabins, wedges).
  taper(w, h, d, color, pos, rot, topX = 0.8, topZ = 0.7, shiftZ = 0) {
    const g = new THREE.BoxGeometry(w, h, d);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      if (p.getY(i) > 0) {
        p.setX(i, p.getX(i) * topX);
        p.setZ(i, p.getZ(i) * topZ + shiftZ);
      }
    }
    g.computeVertexNormals();
    return this.add(g, color, pos, rot);
  }

  cyl(rTop, rBottom, h, seg, color, pos, rot) {
    return this.add(new THREE.CylinderGeometry(rTop, rBottom, h, seg), color, pos, rot);
  }

  sphere(r, color, pos, scale, detail = 0) {
    return this.add(new THREE.IcosahedronGeometry(r, detail), color, pos, [0, 0, 0], scale);
  }

  cone(r, h, seg, color, pos, rot) {
    return this.add(new THREE.ConeGeometry(r, h, seg), color, pos, rot);
  }

  build() {
    const merged = mergeGeometries(this.parts, false);
    for (const p of this.parts) p.dispose();
    this.parts = [];
    merged.computeBoundingSphere();
    return merged;
  }

  mesh(material = flatMaterial) {
    return new THREE.Mesh(this.build(), material);
  }
}

// A wheel pointing along the X axis (spins around X).
export function wheelGeometry(radius, width, tire = 0x26262b, hub = 0xd8d8dc) {
  const b = new PartBuilder();
  b.cyl(radius, radius, width, 10, tire, [0, 0, 0], [0, 0, Math.PI / 2]);
  b.cyl(radius * 0.5, radius * 0.5, width * 1.08, 6, hub, [0, 0, 0], [0, 0, Math.PI / 2]);
  // a bar across the hub so the spin is visible
  b.box(width * 1.12, radius * 1.6, radius * 0.2, 0x8c8f99, [0, 0, 0]);
  return b.build();
}

// Soft round blob texture used for fake shadows.
let shadowTex = null;
export function shadowTexture() {
  if (shadowTex) return shadowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 4, 32, 32, 31);
  g.addColorStop(0, 'rgba(0,0,0,0.55)');
  g.addColorStop(0.6, 'rgba(0,0,0,0.3)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  shadowTex = new THREE.CanvasTexture(c);
  return shadowTex;
}

export function makeBlobShadow(w, l) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(w, l),
    new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false })
  );
  m.rotation.x = -Math.PI / 2;
  m.renderOrder = 1;
  return m;
}
