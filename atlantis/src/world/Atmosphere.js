import * as THREE from 'three';
import { ZONES } from './config.js';
import { zoneWeights, heightAt } from './Terrain.js';
import { smoothstep, lerp, clamp } from '../core/math.js';
import { shared } from './Materials.js';

const QUALITY_VIEW = { low: 125, medium: 175, high: 230 };
const QUALITY_PARTICLES = { low: 700, medium: 1400, high: 2400 };

const cA = new THREE.Color();
const cB = new THREE.Color();
const cTmp = new THREE.Color();

// Fog, lighting, light rays from the surface, floating particles, bubbles and the water surface.
export class Atmosphere {
  constructor(scene, camera, quality) {
    this.scene = scene;
    this.camera = camera;
    this.fog = new THREE.FogExp2(0x3cb4c4, 0.012);
    scene.fog = this.fog;
    scene.background = new THREE.Color(0x3cb4c4);
    this.weights = new Float32Array(ZONES.length);
    this.restored = 0; // 0..1 after the ending, brightens the city
    this.flash = 0;

    this.hemi = new THREE.HemisphereLight(0xbff4ff, 0x23464f, 1.6);
    scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff1cc, 1.6);
    this.sun.position.set(40, 100, 30);
    scene.add(this.sun);
    scene.add(this.sun.target);

    this.buildSurface();
    this.buildRays();
    this.setQuality(quality);
    this.buildBubbles();
    this.ventPoints = null;
  }

  setQuality(q) {
    this.quality = q;
    this.viewDist = QUALITY_VIEW[q] || 175;
    this.camera.far = this.viewDist + 30;
    this.camera.updateProjectionMatrix();
    if (this.snow) {
      this.scene.remove(this.snow);
      this.snow.geometry.dispose();
    }
    this.buildSnow(QUALITY_PARTICLES[q] || 1400);
  }

  buildSurface() {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#7fd8ea';
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 140; i++) {
      const x = Math.random() * 256, y = Math.random() * 256, r = 10 + Math.random() * 40;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(230,255,255,0.35)');
      g.addColorStop(1, 'rgba(230,255,255,0)');
      ctx.fillStyle = g;
      for (const ox of [-256, 0, 256]) for (const oy of [-256, 0, 256]) {
        ctx.save(); ctx.translate(ox, oy); ctx.fillRect(x - r, y - r, r * 2, r * 2); ctx.restore();
      }
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(90, 90);
    tex.colorSpace = THREE.SRGBColorSpace;
    this.surfaceTex = tex;
    const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, transparent: true, opacity: 0.9, depthWrite: false });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1800, 1800), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 0;
    mesh.renderOrder = -1;
    this.surface = mesh;
    this.scene.add(mesh);
  }

  buildRays() {
    this.rays = [];
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: { uTime: shared.uTime, uIntensity: { value: 1 }, uColor: { value: new THREE.Color(0xd8fbff) } },
      vertexShader: /* glsl */`
        varying vec2 vUv;
        varying float vFade;
        void main() {
          vUv = uv;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vFade = 1.0 - smoothstep(25.0, 70.0, -mv.z);
          vFade *= smoothstep(1.0, 6.0, -mv.z);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */`
        uniform float uTime;
        uniform float uIntensity;
        uniform vec3 uColor;
        varying vec2 vUv;
        varying float vFade;
        void main() {
          float edge = smoothstep(0.0, 0.35, vUv.x) * smoothstep(1.0, 0.65, vUv.x);
          float stripes = 0.6 + 0.4 * sin(vUv.x * 18.0 + uTime * 0.6 + sin(vUv.y * 3.0 + uTime * 0.3) * 2.0);
          float down = pow(vUv.y, 1.6);
          float a = edge * stripes * down * vFade * uIntensity * 0.16;
          gl_FragColor = vec4(uColor * a, a);
        }`,
    });
    this.rayMat = mat;
    for (let i = 0; i < 14; i++) {
      const w = 2.5 + Math.random() * 5;
      const geo = new THREE.PlaneGeometry(w, 80, 1, 1);
      geo.translate(0, -40, 0);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.frustumCulled = false;
      mesh.userData.tilt = (Math.random() - 0.5) * 0.25;
      mesh.position.set(Infinity, 0, 0);
      this.rays.push(mesh);
      this.scene.add(mesh);
    }
  }

  buildSnow(count) {
    const box = 60;
    const pos = new Float32Array(count * 3);
    const rnd = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = Math.random() * box;
      pos[i * 3 + 1] = Math.random() * box;
      pos[i * 3 + 2] = Math.random() * box;
      rnd[i] = Math.random();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aRnd', new THREE.BufferAttribute(rnd, 1));
    this.snowUniforms = {
      uTime: shared.uTime,
      uCam: { value: new THREE.Vector3() },
      uBox: { value: box },
      uColor: { value: new THREE.Color(0xdff6ff) },
      uGlowColor: { value: new THREE.Color(0x6af0ff) },
      uGlowMix: { value: 0 },
      uBright: { value: 1 },
      uPixel: { value: 1 },
    };
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: this.snowUniforms,
      vertexShader: /* glsl */`
        uniform float uTime; uniform vec3 uCam; uniform float uBox; uniform float uPixel;
        attribute float aRnd;
        varying float vA; varying float vGlow;
        void main() {
          vec3 drift = vec3(sin(uTime * 0.2 + aRnd * 30.0) * 1.5, -uTime * (0.15 + aRnd * 0.2), cos(uTime * 0.17 + aRnd * 20.0) * 1.5);
          vec3 p = mod(position + drift - uCam + uBox * 0.5, uBox) - uBox * 0.5 + uCam;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          float d = -mv.z;
          vA = (1.0 - smoothstep(uBox * 0.25, uBox * 0.5, length(p - uCam))) * smoothstep(0.3, 2.0, d);
          vGlow = step(0.82, aRnd);
          gl_PointSize = (0.8 + aRnd * 1.6) * uPixel * 60.0 / max(d, 0.5);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */`
        uniform vec3 uColor; uniform vec3 uGlowColor; uniform float uGlowMix; uniform float uBright;
        varying float vA; varying float vGlow;
        void main() {
          vec2 c = gl_PointCoord - 0.5;
          float r = length(c);
          float a = smoothstep(0.5, 0.0, r) * vA;
          float g = vGlow * uGlowMix;
          vec3 col = mix(uColor * uBright, uGlowColor, g);
          a *= mix(0.35 * uBright, 1.0, g);
          gl_FragColor = vec4(col * a, a);
        }`,
    });
    this.snow = new THREE.Points(geo, mat);
    this.snow.frustumCulled = false;
    this.scene.add(this.snow);
  }

  // Player bubbles: CPU-simulated pool.
  buildBubbles() {
    const N = 220;
    this.bubbleN = N;
    this.bubbleData = Array.from({ length: N }, () => ({ life: 0, x: 0, y: 0, z: 0, vy: 0, ph: 0, s: 1 }));
    this.bubbleNext = 0;
    const pos = new Float32Array(N * 3);
    const size = new Float32Array(N);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { uPixel: { value: 1 } },
      vertexShader: /* glsl */`
        attribute float aSize; uniform float uPixel;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * uPixel * 70.0 / max(-mv.z, 0.3);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */`
        void main() {
          vec2 c = gl_PointCoord - 0.5;
          float r = length(c);
          if (r > 0.5) discard;
          float rim = smoothstep(0.3, 0.48, r) * (1.0 - smoothstep(0.48, 0.5, r));
          float hl = smoothstep(0.16, 0.0, length(c - vec2(-0.15, -0.15)));
          float a = rim * 0.8 + hl * 0.9 + 0.08;
          gl_FragColor = vec4(vec3(0.9, 1.0, 1.0), a);
        }`,
    });
    this.bubbles = new THREE.Points(geo, mat);
    this.bubbles.frustumCulled = false;
    this.bubbleMat = mat;
    this.scene.add(this.bubbles);
  }

  emitBubbles(x, y, z, count, spread = 0.15) {
    for (let i = 0; i < count; i++) {
      const b = this.bubbleData[this.bubbleNext];
      this.bubbleNext = (this.bubbleNext + 1) % this.bubbleN;
      b.life = 3 + Math.random() * 2;
      b.x = x + (Math.random() - 0.5) * spread;
      b.y = y + (Math.random() - 0.5) * spread;
      b.z = z + (Math.random() - 0.5) * spread;
      b.vy = 0.8 + Math.random() * 1.2;
      b.ph = Math.random() * 10;
      b.s = 0.25 + Math.random() * 0.5;
    }
  }

  // Bubble columns from vents (air refills). One draw call for all of them.
  setVents(vents) {
    if (this.ventPoints) this.scene.remove(this.ventPoints);
    const per = 60;
    const n = vents.length * per;
    const base = new Float32Array(n * 3);
    const rnd = new Float32Array(n);
    const hgt = new Float32Array(n);
    for (let v = 0; v < vents.length; v++) {
      for (let i = 0; i < per; i++) {
        const k = v * per + i;
        base[k * 3] = vents[v].x; base[k * 3 + 1] = vents[v].y; base[k * 3 + 2] = vents[v].z;
        rnd[k] = Math.random();
        hgt[k] = vents[v].h;
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(base, 3));
    geo.setAttribute('aRnd', new THREE.BufferAttribute(rnd, 1));
    geo.setAttribute('aH', new THREE.BufferAttribute(hgt, 1));
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { uTime: shared.uTime, uPixel: { value: 1 } },
      vertexShader: /* glsl */`
        uniform float uTime; uniform float uPixel;
        attribute float aRnd; attribute float aH;
        varying float vA;
        void main() {
          float t = uTime * (2.0 + aRnd * 2.0) + aRnd * 100.0;
          float y = mod(t, aH);
          vec3 p = position + vec3(sin(t * 1.7 + aRnd * 40.0) * (0.3 + y * 0.04), y, cos(t * 1.3 + aRnd * 17.0) * (0.3 + y * 0.04));
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          vA = smoothstep(0.0, 1.0, y) * (1.0 - smoothstep(aH * 0.8, aH, y)) * (1.0 - smoothstep(60.0, 110.0, -mv.z));
          gl_PointSize = (0.3 + aRnd * 0.6) * uPixel * 90.0 / max(-mv.z, 0.3);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */`
        varying float vA;
        void main() {
          vec2 c = gl_PointCoord - 0.5;
          float r = length(c);
          if (r > 0.5) discard;
          float rim = smoothstep(0.28, 0.48, r);
          float hl = smoothstep(0.16, 0.0, length(c - vec2(-0.15, -0.15)));
          gl_FragColor = vec4(vec3(0.85, 1.0, 1.0), (rim * 0.7 + hl + 0.1) * vA);
        }`,
    });
    this.ventMat = mat;
    this.ventPoints = new THREE.Points(geo, mat);
    this.ventPoints.frustumCulled = false;
    this.scene.add(this.ventPoints);
  }

  setPixelRatio(pr) {
    if (this.snowUniforms) this.snowUniforms.uPixel.value = pr;
    this.bubbleMat.uniforms.uPixel.value = pr;
    if (this.ventMat) this.ventMat.uniforms.uPixel.value = pr;
  }

  // Fog color/density and light for a position. Returns info used by other systems.
  update(dt, pos, flashlightOn) {
    const depth = Math.max(0, -pos.y);
    const w = zoneWeights(pos.x, pos.z, this.weights);
    cA.setRGB(0, 0, 0); cB.setRGB(0, 0, 0);
    for (let i = 0; i < ZONES.length; i++) {
      if (w[i] < 0.001) continue;
      cTmp.setHex(ZONES[i].fog[0]); cA.r += cTmp.r * w[i]; cA.g += cTmp.g * w[i]; cA.b += cTmp.b * w[i];
      cTmp.setHex(ZONES[i].fog[1]); cB.r += cTmp.r * w[i]; cB.g += cTmp.g * w[i]; cB.b += cTmp.b * w[i];
    }
    const t = smoothstep(0, 110, depth);
    cA.lerp(cB, t);
    const darkness = lerp(1, 0.18, smoothstep(30, 165, depth));
    cA.multiplyScalar(darkness);
    if (this.restored > 0) {
      cTmp.setHex(0x2a8fb8);
      cA.lerp(cTmp, this.restored * 0.6);
    }
    if (this.flash > 0) {
      cTmp.setHex(0xffffff);
      cA.lerp(cTmp, Math.min(1, this.flash) * 0.5);
      this.flash = Math.max(0, this.flash - dt * 1.5);
    }
    this.fog.color.lerp(cA, 1 - Math.exp(-dt * 3));
    this.scene.background.copy(this.fog.color);
    const baseDensity = 2.4 / this.viewDist;
    this.fog.density = lerp(this.fog.density, baseDensity * lerp(1, 1.5, smoothstep(40, 160, depth)) * (1 - this.restored * 0.25), 1 - Math.exp(-dt * 2));

    const light = lerp(1, 0.04, smoothstep(5, 150, depth)) + this.restored * 0.35;
    this.light = light;
    this.hemi.intensity = 1.7 * light;
    this.hemi.color.copy(this.fog.color).lerp(cTmp.setHex(0xffffff), 0.45);
    this.sun.intensity = 1.8 * (1 - smoothstep(10, 95, depth));
    this.sun.position.set(pos.x + 40, pos.y + 100, pos.z + 30);
    this.sun.target.position.set(pos.x, pos.y, pos.z);
    shared.uCaustic.value = 1.1 * (1 - smoothstep(15, 90, depth));

    // Light rays near the player
    const rayI = (1 - smoothstep(15, 75, depth)) * (1 - this.restored * 0.3);
    this.rayMat.uniforms.uIntensity.value = rayI;
    for (const r of this.rays) {
      r.visible = rayI > 0.01;
      if (!r.visible) continue;
      const dx = r.position.x - pos.x, dz = r.position.z - pos.z;
      if (dx * dx + dz * dz > 50 * 50 || !isFinite(r.position.x)) {
        const a = Math.random() * Math.PI * 2, d = 8 + Math.random() * 38;
        r.position.set(pos.x + Math.cos(a) * d, 0, pos.z + Math.sin(a) * d);
      }
      r.rotation.set(0, Math.atan2(this.camera.position.x - r.position.x, this.camera.position.z - r.position.z), r.userData.tilt);
    }

    // Particles
    this.snowUniforms.uCam.value.copy(this.camera.position);
    const glowMix = smoothstep(80, 140, depth);
    this.snowUniforms.uGlowMix.value = glowMix;
    this.snowUniforms.uBright.value = 0.35 + light * 0.65 + (flashlightOn ? 0.3 : 0);

    // Surface ripple
    this.surfaceTex.offset.x += dt * 0.004;
    this.surfaceTex.offset.y += dt * 0.0025;
    this.surface.visible = depth < this.viewDist;

    // Bubbles
    const posAttr = this.bubbles.geometry.attributes.position;
    const sizeAttr = this.bubbles.geometry.attributes.aSize;
    for (let i = 0; i < this.bubbleN; i++) {
      const b = this.bubbleData[i];
      if (b.life > 0) {
        b.life -= dt;
        b.vy = Math.min(b.vy + dt * 1.5, 3.5);
        b.y += b.vy * dt;
        b.x += Math.sin(b.ph + b.life * 6) * dt * 0.4;
        b.z += Math.cos(b.ph + b.life * 5) * dt * 0.4;
        if (b.y > -0.2) b.life = 0;
      }
      posAttr.array[i * 3] = b.x; posAttr.array[i * 3 + 1] = b.y; posAttr.array[i * 3 + 2] = b.z;
      sizeAttr.array[i] = b.life > 0 ? b.s : 0;
    }
    posAttr.needsUpdate = true;
    sizeAttr.needsUpdate = true;

    return { depth, light };
  }
}

export function ventList(points) {
  return points.map(([x, z]) => ({ x, z, y: heightAt(x, z), h: 26 }));
}
