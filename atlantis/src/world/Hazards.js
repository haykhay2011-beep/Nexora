import * as THREE from 'three';
import { shared } from './Materials.js';

const tmp = new THREE.Vector3();

// Open-water currents that push the player, and hot vent chimneys with scalding plumes.
export class Hazards {
  constructor(game) {
    this.game = game;
    this.currents = [];
    this.chimneys = [];
  }

  // A current is a box: center, heading angle (radians, 0 = north), length, width, vertical range.
  addCurrent({ x, z, angle, length, width, y0, y1, force = 14, hot = false }) {
    const dx = Math.sin(angle), dz = -Math.cos(angle);
    this.currents.push({ x, z, dx, dz, length, width, y0, y1, force, hot });
  }

  addChimney(x, y, z, height = 10) {
    this.chimneys.push({ x, y, z, top: y + height });
  }

  finalize(scene) {
    // current streak particles
    const per = 90;
    const n = this.currents.length * per;
    if (n > 0) {
      const base = new Float32Array(n * 3), dir = new Float32Array(n * 3), rnd = new Float32Array(n * 4);
      let k = 0;
      for (const c of this.currents) {
        for (let i = 0; i < per; i++, k++) {
          base[k * 3] = c.x; base[k * 3 + 1] = (c.y0 + c.y1) / 2; base[k * 3 + 2] = c.z;
          dir[k * 3] = c.dx; dir[k * 3 + 1] = 0; dir[k * 3 + 2] = c.dz;
          rnd[k * 4] = Math.random(); rnd[k * 4 + 1] = Math.random() - 0.5; rnd[k * 4 + 2] = Math.random() - 0.5; rnd[k * 4 + 3] = c.hot ? 1 : 0;
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(base, 3));
      geo.setAttribute('aDir', new THREE.BufferAttribute(dir, 3));
      geo.setAttribute('aRnd', new THREE.BufferAttribute(rnd, 4));
      const size = new Float32Array(n * 3);
      k = 0;
      for (const c of this.currents) for (let i = 0; i < per; i++, k++) { size[k * 3] = c.length; size[k * 3 + 1] = c.width; size[k * 3 + 2] = c.y1 - c.y0; }
      geo.setAttribute('aSize', new THREE.BufferAttribute(size, 3));
      const mat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        uniforms: { uTime: shared.uTime },
        vertexShader: /* glsl */`
          uniform float uTime;
          attribute vec3 aDir; attribute vec4 aRnd; attribute vec3 aSize;
          varying float vA; varying float vHot;
          void main() {
            float t = fract(uTime * 0.35 + aRnd.x);
            vec3 side = vec3(-aDir.z, 0.0, aDir.x);
            vec3 p = position + aDir * (t - 0.5) * aSize.x + side * aRnd.y * aSize.y + vec3(0.0, aRnd.z * aSize.z, 0.0);
            vA = sin(t * 3.14159);
            vHot = aRnd.w;
            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            vA *= 1.0 - smoothstep(50.0, 90.0, -mv.z);
            gl_PointSize = 110.0 / max(-mv.z, 0.5);
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: /* glsl */`
          varying float vA; varying float vHot;
          void main() {
            vec2 c = gl_PointCoord - 0.5;
            float a = smoothstep(0.5, 0.0, length(c)) * vA * 0.5;
            vec3 col = mix(vec3(0.75, 0.95, 1.0), vec3(1.0, 0.6, 0.3), vHot);
            gl_FragColor = vec4(col * a, a);
          }`,
      });
      this.streaks = new THREE.Points(geo, mat);
      this.streaks.frustumCulled = false;
      scene.add(this.streaks);
    }
    // chimney smoke / heat shimmer
    const per2 = 40;
    const m = this.chimneys.length * per2;
    if (m > 0) {
      const base = new Float32Array(m * 3), rnd = new Float32Array(m), hgt = new Float32Array(m);
      let k = 0;
      for (const c of this.chimneys) {
        for (let i = 0; i < per2; i++, k++) {
          base[k * 3] = c.x; base[k * 3 + 1] = c.top; base[k * 3 + 2] = c.z;
          rnd[k] = Math.random();
          hgt[k] = 16;
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(base, 3));
      geo.setAttribute('aRnd', new THREE.BufferAttribute(rnd, 1));
      geo.setAttribute('aH', new THREE.BufferAttribute(hgt, 1));
      const mat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false,
        uniforms: { uTime: shared.uTime },
        vertexShader: /* glsl */`
          uniform float uTime; attribute float aRnd; attribute float aH;
          varying float vA; varying float vY;
          void main() {
            float t = fract(uTime * (0.15 + aRnd * 0.1) + aRnd);
            float y = t * aH;
            vec3 p = position + vec3(sin(aRnd * 40.0 + uTime) * (0.3 + y * 0.12), y, cos(aRnd * 23.0 + uTime * 0.8) * (0.3 + y * 0.12));
            vA = (1.0 - t) * smoothstep(0.0, 0.08, t);
            vY = t;
            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            gl_PointSize = (1.5 + y * 0.35) * 70.0 / max(-mv.z, 0.5);
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: /* glsl */`
          varying float vA; varying float vY;
          void main() {
            vec2 c = gl_PointCoord - 0.5;
            float a = smoothstep(0.5, 0.1, length(c)) * vA * 0.45;
            vec3 col = mix(vec3(1.0, 0.45, 0.15), vec3(0.12, 0.1, 0.1), smoothstep(0.0, 0.35, vY));
            gl_FragColor = vec4(col, a);
          }`,
      });
      this.smoke = new THREE.Points(geo, mat);
      this.smoke.frustumCulled = false;
      scene.add(this.smoke);
    }
  }

  update(dt) {
    const g = this.game;
    if (g.mode !== 'playing') return;
    const p = g.player.pos;
    for (const c of this.currents) {
      if (p.y < c.y0 || p.y > c.y1) continue;
      const rx = p.x - c.x, rz = p.z - c.z;
      const along = rx * c.dx + rz * c.dz;
      const across = -rx * c.dz + rz * c.dx;
      if (Math.abs(along) > c.length / 2 || Math.abs(across) > c.width / 2) continue;
      const edge = Math.min(1, (c.width / 2 - Math.abs(across)) / 3);
      g.player.external.x += c.dx * c.force * edge;
      g.player.external.z += c.dz * c.force * edge;
      if (c.hot && !(g.state.upgrades.heat > 0)) g.survival.damage(4 * dt, 'heat', null, true);
    }
    for (const c of this.chimneys) {
      const dx = p.x - c.x, dz = p.z - c.z;
      if (dx * dx + dz * dz < 2.4 * 2.4 && p.y > c.y && p.y < c.top + 14) {
        if (g.survival.damage(10, 'heat', tmp.set(c.x, p.y - 2, c.z)) && !this.warned) {
          this.warned = true;
          g.ui.toast('Scalding plume! Keep clear of the vent chimneys.', 'warn');
        }
      }
    }
  }
}
