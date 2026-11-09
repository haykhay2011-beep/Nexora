import * as THREE from 'three';

// One pooled point-sprite system for smoke, dust and sparks. Fixed capacity:
// new particles overwrite the oldest, so memory never grows.
export class Particles {
  constructor(scene, capacity = 500) {
    this.cap = capacity;
    this.pos = new Float32Array(capacity * 3);
    this.col = new Float32Array(capacity * 3);
    this.alpha = new Float32Array(capacity);
    this.size = new Float32Array(capacity);
    this.vel = new Float32Array(capacity * 3);
    this.life = new Float32Array(capacity);
    this.maxLife = new Float32Array(capacity);
    this.grow = new Float32Array(capacity);
    this.drag = new Float32Array(capacity);
    this.grav = new Float32Array(capacity);
    this.baseAlpha = new Float32Array(capacity);
    this.next = 0;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo = g;
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { scale: { value: 400 } },
      vertexShader: `attribute float alpha; attribute float size; attribute vec3 color; varying float vA; varying vec3 vC; uniform float scale;
        void main(){ vA = alpha; vC = color; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = size * scale / max(1.0, -mv.z); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `varying float vA; varying vec3 vC; void main(){ vec2 d = gl_PointCoord - 0.5; float r = dot(d,d); if (r > 0.25) discard; gl_FragColor = vec4(vC, vA * (1.0 - r * 4.0)); }`,
    });
    this.mat = mat;
    this.points = new THREE.Points(g, mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  setViewport(h) { this.mat.uniforms.scale.value = h * 0.9; }

  emit(x, y, z, vx, vy, vz, color, size, life, opts = {}) {
    const i = this.next;
    this.next = (this.next + 1) % this.cap;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.col[i * 3] = color.r; this.col[i * 3 + 1] = color.g; this.col[i * 3 + 2] = color.b;
    this.size[i] = size;
    this.life[i] = life; this.maxLife[i] = life;
    this.grow[i] = opts.grow ?? 1.5;
    this.drag[i] = opts.drag ?? 1.5;
    this.grav[i] = opts.gravity ?? 0;
    this.baseAlpha[i] = opts.alpha ?? 0.6;
    this.alpha[i] = this.baseAlpha[i];
  }

  update(dt) {
    for (let i = 0; i < this.cap; i++) {
      if (this.life[i] <= 0) { this.alpha[i] = 0; continue; }
      this.life[i] -= dt;
      const t = Math.max(0, this.life[i] / this.maxLife[i]);
      const dr = Math.exp(-this.drag[i] * dt);
      this.vel[i * 3] *= dr; this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * dr - this.grav[i] * dt; this.vel[i * 3 + 2] *= dr;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      this.size[i] += this.grow[i] * dt;
      this.alpha[i] = this.baseAlpha[i] * t;
    }
    const a = this.geo.attributes;
    a.position.needsUpdate = a.alpha.needsUpdate = a.size.needsUpdate = a.color.needsUpdate = true;
  }

  clear() { this.life.fill(0); this.alpha.fill(0); }
}

// Skid marks: a ring buffer of quads laid on the road surface.
export class SkidMarks {
  constructor(scene, segments = 320) {
    this.cap = segments;
    this.pos = new Float32Array(segments * 4 * 3);
    this.alpha = new Float32Array(segments * 4);
    const idx = new Uint16Array(segments * 6);
    for (let i = 0; i < segments; i++) {
      idx.set([i * 4, i * 4 + 2, i * 4 + 1, i * 4 + 1, i * 4 + 2, i * 4 + 3], i * 6);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    this.geo = g;
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
      vertexShader: `attribute float alpha; varying float vA; void main(){ vA = alpha; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `varying float vA; void main(){ gl_FragColor = vec4(0.07,0.07,0.08, vA); }`,
      side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(g, mat);
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
    this.next = 0;
    this.last = [null, null];
  }

  // add a segment for wheel `w` from its last point to (x,y,z) with right vector (rx,rz)
  add(w, x, y, z, rx, rz, strength) {
    const prev = this.last[w];
    const hw = 0.13;
    if (prev && strength > 0) {
      const i = this.next;
      this.next = (this.next + 1) % this.cap;
      const p = this.pos, o = i * 12;
      p[o] = prev.x - prev.rx * hw; p[o + 1] = prev.y; p[o + 2] = prev.z - prev.rz * hw;
      p[o + 3] = prev.x + prev.rx * hw; p[o + 4] = prev.y; p[o + 5] = prev.z + prev.rz * hw;
      p[o + 6] = x - rx * hw; p[o + 7] = y; p[o + 8] = z - rz * hw;
      p[o + 9] = x + rx * hw; p[o + 10] = y; p[o + 11] = z + rz * hw;
      const a = Math.min(0.55, strength * 0.6);
      this.alpha[i * 4] = this.alpha[i * 4 + 1] = prev.a;
      this.alpha[i * 4 + 2] = this.alpha[i * 4 + 3] = a;
      this.geo.attributes.position.needsUpdate = true;
      this.geo.attributes.alpha.needsUpdate = true;
    }
    if (strength > 0) {
      const l = this.last[w] || (this.last[w] = { x: 0, y: 0, z: 0, rx: 0, rz: 0, a: 0 });
      l.x = x; l.y = y; l.z = z; l.rx = rx; l.rz = rz; l.a = Math.min(0.55, strength * 0.6);
    } else this.last[w] = null;
  }

  clear() { this.alpha.fill(0); this.geo.attributes.alpha.needsUpdate = true; this.last = [null, null]; }
}
