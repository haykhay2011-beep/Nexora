import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { getMaterials } from './Materials.js';

const CELL = 64;

function colorGradient(geo, bottom, top, maxY) {
  const pos = geo.attributes.position;
  const c0 = new THREE.Color(bottom), c1 = new THREE.Color(top), c = new THREE.Color();
  const arr = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    c.copy(c0).lerp(c1, Math.min(1, Math.max(0, pos.getY(i) / maxY)));
    arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}

function strip(g) {
  for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'color') g.deleteAttribute(name);
  return g.index ? g.toNonIndexed() : g;
}

export function kelpGeometry() {
  const H = 20;
  const parts = [];
  const stipe = new THREE.PlaneGeometry(0.35, H, 1, 10);
  stipe.translate(0, H / 2, 0);
  parts.push(stipe);
  const stipe2 = stipe.clone();
  stipe2.rotateY(Math.PI / 2);
  parts.push(stipe2);
  for (let i = 1; i < 10; i++) {
    const leaf = new THREE.PlaneGeometry(0.9, 2.2, 1, 2);
    leaf.translate(0.5, 1.1, 0);
    leaf.rotateZ(-0.6);
    leaf.rotateY((i * 2.4) % (Math.PI * 2));
    leaf.translate(0, i * (H / 10) + 0.5, 0);
    parts.push(leaf);
  }
  const g = mergeGeometries(parts.map((p) => strip(p)));
  colorGradient(g, 0x3b4a1c, 0xa9c23f, H);
  return g;
}

export function seagrassGeometry() {
  const parts = [];
  for (let i = 0; i < 5; i++) {
    const blade = new THREE.PlaneGeometry(0.12, 1.6, 1, 3);
    blade.translate(0, 0.8, 0);
    blade.rotateZ((Math.random() - 0.5) * 0.4);
    blade.rotateY(i * 1.3);
    blade.translate((Math.random() - 0.5) * 0.5, 0, (Math.random() - 0.5) * 0.5);
    parts.push(blade);
  }
  const g = mergeGeometries(parts.map((p) => strip(p)));
  colorGradient(g, 0x4d7a3a, 0x9fdc6a, 1.6);
  return g;
}

export function tubeWormGeometry() {
  const parts = [];
  for (let i = 0; i < 6; i++) {
    const h = 0.8 + Math.random() * 1.6;
    const tube = new THREE.CylinderGeometry(0.07, 0.1, h, 5);
    tube.translate((Math.random() - 0.5) * 0.6, h / 2, (Math.random() - 0.5) * 0.6);
    parts.push(strip(tube));
  }
  const g = mergeGeometries(parts);
  colorGradient(g, 0xe8e0d0, 0xff3b30, 2.4);
  return g;
}

// Instanced swaying plants, split into cells so far ones are skipped entirely.
export class Flora {
  constructor(scene, geometry, material) {
    this.scene = scene;
    this.geometry = geometry;
    this.material = material || getMaterials().kelp;
    this.cells = new Map();
    this.meshes = [];
  }

  add(x, y, z, ry, s, sy = s, color = 0xffffff) {
    const key = `${Math.floor(x / CELL)},${Math.floor(z / CELL)}`;
    let c = this.cells.get(key);
    if (!c) this.cells.set(key, (c = { items: [], cx: (Math.floor(x / CELL) + 0.5) * CELL, cz: (Math.floor(z / CELL) + 0.5) * CELL }));
    c.items.push({ x, y, z, ry, s, sy, color });
  }

  finalize() {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), sc = new THREE.Vector3();
    const col = new THREE.Color();
    for (const c of this.cells.values()) {
      const mesh = new THREE.InstancedMesh(this.geometry, this.material, c.items.length);
      c.items.forEach((it, i) => {
        e.set(0, it.ry, 0);
        q.setFromEuler(e);
        p.set(it.x, it.y, it.z);
        sc.set(it.s, it.sy, it.s);
        m.compose(p, q, sc);
        mesh.setMatrixAt(i, m);
        col.set(it.color);
        mesh.setColorAt(i, col);
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
      mesh.userData.cx = c.cx;
      mesh.userData.cz = c.cz;
      this.scene.add(mesh);
      this.meshes.push(mesh);
    }
    this.cells.clear();
  }

  update(px, pz, viewDist) {
    for (const m of this.meshes) {
      m.visible = Math.hypot(m.userData.cx - px, m.userData.cz - pz) < viewDist + 46;
    }
  }
}
