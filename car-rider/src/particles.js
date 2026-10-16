// Pooled particle system (dust, smoke, sparks, flames, confetti) and skid marks.
// Both are fixed-size InstancedMeshes, so nothing is allocated at runtime.
import * as THREE from 'three';

const MAX = 420;
const _m = new THREE.Matrix4();
const _p = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _c = new THREE.Color();
const _e = new THREE.Euler();

export class Particles {
  constructor(scene) {
    const geo = new THREE.IcosahedronGeometry(0.5, 0);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.mesh = new THREE.InstancedMesh(geo, mat, MAX);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    for (let i = 0; i < MAX; i++) this.mesh.setColorAt(i, _c.set(0xffffff));
    scene.add(this.mesh);
    this.n = 0;
    this.px = new Float32Array(MAX);
    this.py = new Float32Array(MAX);
    this.pz = new Float32Array(MAX);
    this.vx = new Float32Array(MAX);
    this.vy = new Float32Array(MAX);
    this.vz = new Float32Array(MAX);
    this.age = new Float32Array(MAX);
    this.life = new Float32Array(MAX);
    this.s0 = new Float32Array(MAX);
    this.s1 = new Float32Array(MAX);
    this.grav = new Float32Array(MAX);
    this.drag = new Float32Array(MAX);
    this.rot = new Float32Array(MAX);
    this.col = new Float32Array(MAX * 3);
  }

  clear() {
    this.n = 0;
    this.mesh.count = 0;
  }

  spawn(x, y, z, vx, vy, vz, life, size0, size1, color, gravity = 0, drag = 1) {
    let i = this.n;
    if (i >= MAX) i = (Math.random() * MAX) | 0; // overwrite a random one when full
    else this.n++;
    this.px[i] = x; this.py[i] = y; this.pz[i] = z;
    this.vx[i] = vx; this.vy[i] = vy; this.vz[i] = vz;
    this.age[i] = 0;
    this.life[i] = life;
    this.s0[i] = size0;
    this.s1[i] = size1;
    this.grav[i] = gravity;
    this.drag[i] = drag;
    this.rot[i] = Math.random() * 6.28;
    _c.set(color);
    this.col[i * 3] = _c.r; this.col[i * 3 + 1] = _c.g; this.col[i * 3 + 2] = _c.b;
    this.mesh.setColorAt(i, _c);
    this.mesh.instanceColor.needsUpdate = true;
  }

  // Convenience emitters ---------------------------------------------------
  dust(x, y, z, vel, color = 0xd9cfae) {
    const r = Math.random;
    this.spawn(x + (r() - 0.5) * 0.4, y + 0.1, z + (r() - 0.5) * 0.4, (r() - 0.5) * 2 + vel.x * 0.1, 0.8 + r() * 1.2, (r() - 0.5) * 2 + vel.z * 0.1, 0.55 + r() * 0.4, 0.3, 1.5, color, -1, 0.92);
  }

  smoke(x, y, z, size = 1.2, color = 0x6a6a70) {
    const r = Math.random;
    this.spawn(x, y, z, (r() - 0.5) * 2.5, 1.5 + r() * 2.5, (r() - 0.5) * 2.5, 0.9 + r() * 0.8, size * 0.6, size * 1.9, color, -0.5, 0.95);
  }

  spark(x, y, z, dir) {
    const r = Math.random;
    this.spawn(x, y, z, dir.x * 4 + (r() - 0.5) * 5, 1 + r() * 3, dir.z * 4 + (r() - 0.5) * 5, 0.3 + r() * 0.3, 0.14, 0.04, r() < 0.5 ? 0xffd34a : 0xff8a2a, 14, 0.97);
  }

  flame(x, y, z, vx, vy, vz) {
    const r = Math.random;
    const hot = r() < 0.45;
    this.spawn(x + (r() - 0.5) * 0.12, y + (r() - 0.5) * 0.12, z + (r() - 0.5) * 0.12, vx + (r() - 0.5) * 1.5, vy + (r() - 0.5) * 1.2, vz + (r() - 0.5) * 1.5, 0.22 + r() * 0.16, hot ? 0.34 : 0.5, 0.05, hot ? 0xfff3a0 : r() < 0.5 ? 0xff8a1f : 0xff4a1a, 0, 0.9);
  }

  burst(x, y, z, color, count = 10, speed = 5, size = 0.28) {
    const r = Math.random;
    for (let k = 0; k < count; k++) {
      const a = r() * 6.28;
      const u = r() * 2 - 1;
      const w = Math.sqrt(1 - u * u);
      this.spawn(x, y, z, Math.cos(a) * w * speed, u * speed * 0.8 + speed * 0.5, Math.sin(a) * w * speed, 0.5 + r() * 0.4, size, size * 0.2, color, 12, 0.95);
    }
  }

  update(dt) {
    let i = 0;
    while (i < this.n) {
      this.age[i] += dt;
      if (this.age[i] >= this.life[i]) {
        // swap-remove
        const last = --this.n;
        if (i !== last) {
          for (const arr of [this.px, this.py, this.pz, this.vx, this.vy, this.vz, this.age, this.life, this.s0, this.s1, this.grav, this.drag, this.rot]) arr[i] = arr[last];
          this.col[i * 3] = this.col[last * 3];
          this.col[i * 3 + 1] = this.col[last * 3 + 1];
          this.col[i * 3 + 2] = this.col[last * 3 + 2];
          _c.setRGB(this.col[i * 3], this.col[i * 3 + 1], this.col[i * 3 + 2]);
          this.mesh.setColorAt(i, _c);
          this.mesh.instanceColor.needsUpdate = true;
        }
        continue;
      }
      const d = Math.pow(this.drag[i], dt * 60);
      this.vx[i] *= d;
      this.vz[i] *= d;
      // grav > 0 pulls down, grav < 0 is buoyancy (rises)
      this.vy[i] = this.vy[i] * d - this.grav[i] * dt;
      this.px[i] += this.vx[i] * dt;
      this.py[i] += this.vy[i] * dt;
      this.pz[i] += this.vz[i] * dt;
      const u = this.age[i] / this.life[i];
      const size = (this.s0[i] + (this.s1[i] - this.s0[i]) * u) * (1 - u * u * 0.6);
      _p.set(this.px[i], this.py[i], this.pz[i]);
      _e.set(this.rot[i], this.rot[i] * 1.3, 0);
      _q.setFromEuler(_e);
      _s.setScalar(Math.max(size, 0.001));
      _m.compose(_p, _q, _s);
      this.mesh.setMatrixAt(i, _m);
      i++;
    }
    this.mesh.count = this.n;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

// ---------------------------------------------------------------------------

const SKID_MAX = 220;

export class SkidMarks {
  constructor(scene) {
    const geo = new THREE.PlaneGeometry(0.24, 1.2);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x15151a,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4,
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, SKID_MAX);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 2;
    this.zero = new THREE.Matrix4().makeScale(0, 0, 0);
    scene.add(this.mesh);
    this.i = 0;
    this.clear();
  }

  clear() {
    for (let k = 0; k < SKID_MAX; k++) this.mesh.setMatrixAt(k, this.zero);
    this.mesh.instanceMatrix.needsUpdate = true;
    this.i = 0;
  }

  // position, orientation (quaternion), stretch along the heading
  add(pos, quat, stretch = 1) {
    _s.set(1, 1, stretch);
    _m.compose(pos, quat, _s);
    this.mesh.setMatrixAt(this.i, _m);
    this.i = (this.i + 1) % SKID_MAX;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
