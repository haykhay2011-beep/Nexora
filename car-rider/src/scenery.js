// Roadside decoration: trees, rocks, bushes, fences and the odd farmhouse.
// Each scenery type is one InstancedMesh shared by all road chunks; every chunk
// slot owns a fixed range of instances which are rewritten when the chunk is
// recycled. Placement is deterministic per chunk and run seed.
import * as THREE from 'three';
import { ROAD } from './config.js';
import { PartBuilder, flatMaterial } from './models.js';
import { RNG } from './rng.js';

function roundTree() {
  const b = new PartBuilder();
  b.cyl(0.18, 0.28, 2.2, 5, 0x7a5232, [0, 1.1, 0]);
  b.sphere(1.5, 0x4fa83a, [0, 3.0, 0], [1, 0.9, 1]);
  b.sphere(1.0, 0x5cba44, [0.6, 3.7, 0.3], [1, 0.9, 1]);
  b.sphere(0.9, 0x469c35, [-0.7, 2.7, -0.4], [1, 0.9, 1]);
  return b.build();
}

function pineTree() {
  const b = new PartBuilder();
  b.cyl(0.15, 0.22, 1.4, 5, 0x6d4a2c, [0, 0.7, 0]);
  b.cone(1.6, 2.4, 6, 0x2f7f4a, [0, 2.2, 0]);
  b.cone(1.2, 2.0, 6, 0x37905a, [0, 3.4, 0]);
  b.cone(0.8, 1.6, 6, 0x3fa064, [0, 4.5, 0]);
  return b.build();
}

function rock() {
  const b = new PartBuilder();
  const g = new THREE.DodecahedronGeometry(1, 0);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) * 0.6);
  b.add(g, 0x9a9a92, [0, 0.35, 0]);
  return b.build();
}

function bush() {
  const b = new PartBuilder();
  b.sphere(0.8, 0x4c9e36, [0, 0.45, 0], [1.2, 0.8, 1]);
  b.sphere(0.6, 0x5aae40, [0.6, 0.4, 0.2], [1, 0.8, 1]);
  b.sphere(0.5, 0xe8d35a, [0.2, 0.9, 0.1], [0.25, 0.25, 0.25]);
  return b.build();
}

function fenceSection() {
  // 4 m long section along the local Z axis
  const b = new PartBuilder();
  b.box(0.14, 1.1, 0.14, 0xe9dcc3, [0, 0.55, -2]);
  b.box(0.14, 1.1, 0.14, 0xe9dcc3, [0, 0.55, 0]);
  b.box(0.08, 0.14, 4, 0xd8c7a8, [0, 0.85, 0]);
  b.box(0.08, 0.14, 4, 0xd8c7a8, [0, 0.45, 0]);
  return b.build();
}

function house() {
  const b = new PartBuilder();
  b.box(6, 3.2, 5, 0xf2e6cf, [0, 1.6, 0]);
  // gable roof as a 3-sided prism
  const roof = new THREE.CylinderGeometry(3.6, 3.6, 6.6, 3, 1);
  b.add(roof, 0xc8553d, [0, 3.2 + 0.95, 0], [0, 0, Math.PI / 2], [1, 1, 0.82]);
  b.box(1.0, 1.9, 0.1, 0x7a4e32, [0.8, 0.95, 2.52]);
  b.box(1.0, 0.9, 0.1, 0x8fc3e0, [-1.6, 1.8, 2.52]);
  b.box(1.0, 0.9, 0.1, 0x8fc3e0, [2.2, 1.8, 2.52]);
  b.box(0.6, 1.4, 0.6, 0x9c4a3a, [-1.8, 5.0, -1.0]);
  return b.build();
}

function barn() {
  const b = new PartBuilder();
  b.box(7, 4, 9, 0xb8432f, [0, 2, 0]);
  const roof = new THREE.CylinderGeometry(4.3, 4.3, 9.4, 3, 1);
  b.add(roof, 0x59433a, [0, 4 + 1.1, 0], [Math.PI / 2, Math.PI / 2, 0], [0.86, 1, 1]);
  b.box(3, 3, 0.1, 0xf3ece0, [0, 1.5, 4.52]);
  b.box(2.6, 2.6, 0.12, 0xa63a28, [0, 1.5, 4.55]);
  return b.build();
}

const TYPES = [
  { name: 'round', geo: roundTree, per: 10 },
  { name: 'pine', geo: pineTree, per: 10 },
  { name: 'rock', geo: rock, per: 5 },
  { name: 'bush', geo: bush, per: 8 },
  { name: 'fence', geo: fenceSection, per: 14 },
  { name: 'house', geo: house, per: 1 },
  { name: 'barn', geo: barn, per: 1 },
];

const _zero = new THREE.Matrix4().makeScale(0, 0, 0);
const _m = new THREE.Matrix4();
const _p = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _f = {};
const _yAxis = new THREE.Vector3(0, 1, 0);
const _c = new THREE.Color();

export class Scenery {
  constructor(scene, road) {
    this.road = road;
    this.path = road.path;
    this.slots = road.slots;
    this.rng = new RNG(1);
    this.seed = 1;
    this.meshes = {};
    for (const t of TYPES) {
      const mesh = new THREE.InstancedMesh(t.geo(), flatMaterial, t.per * this.slots);
      mesh.frustumCulled = false;
      for (let i = 0; i < mesh.count; i++) {
        mesh.setMatrixAt(i, _zero);
        mesh.setColorAt(i, _c.set(0xffffff));
      }
      scene.add(mesh);
      this.meshes[t.name] = { mesh, per: t.per };
    }
    road.onBuild = (slot, idx) => this.build(slot, idx);
    road.onRelease = (slot) => this.clear(slot);
  }

  setSeed(seed) {
    this.seed = seed;
  }

  clear(slot) {
    for (const k in this.meshes) {
      const { mesh, per } = this.meshes[k];
      for (let i = 0; i < per; i++) mesh.setMatrixAt(slot * per + i, _zero);
      mesh.instanceMatrix.needsUpdate = true;
    }
  }

  // terrain height at offset d next to the road (matches the embankment)
  groundY(s, d) {
    const y = this.path.height(s);
    const ad = Math.abs(d);
    if (ad <= ROAD.VERGE) return y - 0.1;
    const w = 3 + (y - ROAD.GROUND_Y + 0.4) * 2.2;
    const t = Math.min(1, (ad - ROAD.VERGE) / w);
    return y - 0.12 + (ROAD.GROUND_Y - y - 0.28) * t;
  }

  _place(type, slot, counter, s, d, scale, rotY, tint) {
    const entry = this.meshes[type];
    if (counter[type] >= entry.per) return false;
    const f = this.path.frame(s, _f);
    const x = f.x + f.rx * d;
    const z = f.z + f.rz * d;
    const minClear = type === 'fence' ? ROAD.VERGE + 2 : ROAD.VERGE + 1.5 + scale * 1.5;
    if (this.path.clearance(x, z, s, 160) < minClear) return false;
    _p.set(x, this.groundY(s, d), z);
    _q.setFromAxisAngle(_yAxis, rotY);
    _s.set(scale, scale, scale);
    _m.compose(_p, _q, _s);
    const i = slot * entry.per + counter[type]++;
    entry.mesh.setMatrixAt(i, _m);
    entry.mesh.setColorAt(i, _c.setScalar(tint));
    return true;
  }

  build(slot, idx) {
    this.clear(slot);
    const r = this.rng;
    r.seed((this.seed ^ Math.imul(idx + 7, 0x9e3779b1)) >>> 0);
    const L = ROAD.CHUNK_LEN;
    const s0 = idx * L;
    if (s0 < 0) return;
    const counter = {};
    for (const t of TYPES) counter[t.name] = 0;

    // trees in loose clumps on both sides
    for (let i = 0; i < 20; i++) {
      const s = s0 + r.range(0, L);
      const side = r.sign();
      const d = side * (ROAD.VERGE + 3 + Math.pow(r.next(), 1.6) * 70);
      const f = this.path.frame(s, _f);
      const type = r.chance(0.45) ? 'pine' : 'round';
      const yaw = f.heading + r.range(0, 6.28);
      this._place(type, slot, counter, s, d, r.range(0.8, 1.35), yaw, r.range(0.85, 1.12));
    }
    for (let i = 0; i < 8; i++) {
      const s = s0 + r.range(0, L);
      const d = r.sign() * (ROAD.VERGE + 1.5 + r.range(0, 30));
      this._place('bush', slot, counter, s, d, r.range(0.7, 1.3), r.range(0, 6.28), r.range(0.85, 1.1));
    }
    for (let i = 0; i < 4; i++) {
      const s = s0 + r.range(0, L);
      const d = r.sign() * (ROAD.VERGE + 2 + r.range(0, 40));
      this._place('rock', slot, counter, s, d, r.range(0.5, 1.6), r.range(0, 6.28), r.range(0.85, 1.1));
    }

    // a fence run parallel to the road
    if (r.chance(0.45)) {
      const side = r.sign();
      const d = side * r.range(13, 22);
      const start = s0 + r.range(0, 10);
      const n = r.int(6, 12);
      for (let k = 0; k < n; k++) {
        const s = start + k * 4 + 2;
        if (s > s0 + L) break;
        const f = this.path.frame(s, _f);
        this._place('fence', slot, counter, s, d, 1, -f.heading, 1);
      }
    }

    // the odd house or barn in the distance
    if (r.chance(0.22)) {
      const s = s0 + r.range(5, L - 5);
      const side = r.sign();
      const d = side * r.range(45, 85);
      const f = this.path.frame(s, _f);
      // face the road
      const yaw = -f.heading + (side > 0 ? -Math.PI / 2 : Math.PI / 2);
      this._place(r.chance(0.6) ? 'house' : 'barn', slot, counter, s, d, r.range(0.9, 1.15), yaw, r.range(0.9, 1.05));
    }

    for (const k in this.meshes) {
      const { mesh } = this.meshes[k];
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }
}
