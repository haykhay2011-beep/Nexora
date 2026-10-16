import * as THREE from 'three';
import { Simplex2, smoothstep, lerp, clamp } from '../core/math.js';
import { ZONES, PADS, WORLD_SEED, WORLD_HALF, CHUNK_SIZE } from './config.js';
import { getMaterials } from './Materials.js';

const noiseA = new Simplex2(WORLD_SEED);
const noiseB = new Simplex2(WORLD_SEED + 101);
const noiseC = new Simplex2(WORLD_SEED + 202);

const NZ = ZONES.length;
const weights = new Float32Array(NZ);
const STYLE_INDEX = { dunes: 0, rolling: 1, flat: 2, terrace: 3, ridged: 4, canyon: 5 };

// Blend weights of each zone at (x, z). Shepard weighting normalized by zone radius
// gives flat zone "plateaus" with smooth slopes between them.
export function zoneWeights(x, z, out = weights) {
  let sum = 0;
  for (let i = 0; i < NZ; i++) {
    const zn = ZONES[i];
    const dx = x - zn.x, dz = z - zn.z;
    const q = (dx * dx + dz * dz) / (zn.r * zn.r);
    const w = 1 / (q * q * q + 1e-5);
    out[i] = w;
    sum += w;
  }
  for (let i = 0; i < NZ; i++) out[i] /= sum;
  return out;
}

export function zoneIndexAt(x, z) {
  let best = 0, bestQ = Infinity;
  for (let i = 0; i < NZ; i++) {
    const zn = ZONES[i];
    const dx = x - zn.x, dz = z - zn.z;
    const q = (dx * dx + dz * dz) / (zn.r * zn.r);
    if (q < bestQ) { bestQ = q; best = i; }
  }
  return best;
}
export const zoneAt = (x, z) => ZONES[zoneIndexAt(x, z)];

const styleW = new Float32Array(6);

export function heightAt(x, z) {
  zoneWeights(x, z);
  let depth = 0, amp = 0;
  styleW.fill(0);
  for (let i = 0; i < NZ; i++) {
    const w = weights[i];
    depth += ZONES[i].depth * w;
    amp += ZONES[i].amp * w;
    styleW[STYLE_INDEX[ZONES[i].style]] += w;
  }
  let h = -depth;
  h += noiseA.fbm(x * 0.0035, z * 0.0035, 3) * 5;

  if (styleW[0] > 0.01) { // dunes
    const n = noiseB.fbm(x * 0.02, z * 0.02, 3);
    h += styleW[0] * amp * (n * 0.7 + Math.sin(x * 0.07 + z * 0.03 + n * 3) * 0.35);
  }
  if (styleW[1] > 0.01) { // rolling
    h += styleW[1] * amp * noiseB.fbm(x * 0.012, z * 0.012, 4);
  }
  if (styleW[2] > 0.01) { // flat city ground
    h += styleW[2] * amp * noiseC.fbm(x * 0.03, z * 0.03, 2);
  }
  if (styleW[3] > 0.01) { // terraces
    const v = noiseB.fbm(x * 0.009, z * 0.009, 3) * amp * 4;
    const s = v / 3, f = Math.floor(s), t = s - f;
    h += styleW[3] * (f + smoothstep(0.75, 1, t)) * 3;
  }
  if (styleW[4] > 0.01) { // volcanic ridges
    const r = noiseC.ridged(x * 0.011, z * 0.011, 4);
    h += styleW[4] * amp * (r * 2.2 - 0.8);
  }
  if (styleW[5] > 0.01) { // abyssal canyons
    const n = noiseB.fbm(x * 0.007, z * 0.007, 4);
    const c = 1 - Math.abs(noiseC.noise(x * 0.005 + 7, z * 0.005 - 3));
    h += styleW[5] * (amp * n - 30 * Math.pow(c, 8));
  }

  // World edge: rise into steep walls.
  const e = Math.max(Math.abs(x), Math.abs(z));
  if (e > WORLD_HALF - 120) {
    const t = smoothstep(WORLD_HALF - 120, WORLD_HALF - 15, e);
    h = lerp(h, -5 + noiseA.noise(x * 0.05, z * 0.05) * 2, t);
  }

  // Building pads
  for (let i = 0; i < PADS.length; i++) {
    const p = PADS[i];
    const dx = x - p.x, dz = z - p.z;
    const lim = p.r + p.blend;
    if (dx > lim || dx < -lim || dz > lim || dz < -lim) continue;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d < lim) h = lerp(h, p.y, smoothstep(lim, p.r, d));
  }
  return Math.min(h, -2.5);
}

// Terrain color at a point, with a small hash so faces differ slightly.
const tmpA = new THREE.Color();
const tmpB = new THREE.Color();
export function groundColor(x, z, h, slope, out) {
  zoneWeights(x, z);
  out.setRGB(0, 0, 0);
  for (let i = 0; i < NZ; i++) {
    const w = weights[i];
    if (w < 0.002) continue;
    tmpA.setHex(ZONES[i].sand);
    tmpB.setHex(ZONES[i].rock);
    tmpA.lerp(tmpB, clamp(slope * 1.6, 0, 1));
    out.r += tmpA.r * w; out.g += tmpA.g * w; out.b += tmpA.b * w;
  }
  const n = noiseC.noise(x * 0.15, z * 0.15) * 0.06 + noiseA.noise(x * 0.03, z * 0.03) * 0.05;
  out.r = clamp(out.r + n, 0, 1);
  out.g = clamp(out.g + n, 0, 1);
  out.b = clamp(out.b + n * 0.8, 0, 1);
  return out;
}

const LODS = [32, 16, 8];

export class Terrain {
  constructor(scene, quality) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'terrain';
    scene.add(this.group);
    this.material = getMaterials().terrain;
    this.chunks = new Map();
    this.setQuality(quality);
    this.cache = new Map(); // geometry cache keyed by chunk+lod (bounded)
  }

  setQuality(q) {
    this.radius = q === 'low' ? 2 : q === 'high' ? 4 : 3;
  }

  key(cx, cz) { return `${cx},${cz}`; }

  lodFor(dist) {
    if (dist < CHUNK_SIZE * 1.6) return 0;
    if (dist < CHUNK_SIZE * 3) return 1;
    return 2;
  }

  buildGeometry(cx, cz, lod) {
    const seg = LODS[lod];
    const size = CHUNK_SIZE;
    const step = size / seg;
    const x0 = cx * size, z0 = cz * size;
    const n = seg + 3; // one skirt vertex on each side
    const positions = new Float32Array(n * n * 3);
    const colors = new Float32Array(n * n * 3);
    const heights = new Float32Array(n * n);
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const gi = clamp(i - 1, 0, seg), gj = clamp(j - 1, 0, seg);
        const x = x0 + gi * step, z = z0 + gj * step;
        heights[j * n + i] = heightAt(x, z);
      }
    }
    const col = new THREE.Color();
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const gi = clamp(i - 1, 0, seg), gj = clamp(j - 1, 0, seg);
        const x = x0 + gi * step, z = z0 + gj * step;
        const skirt = i === 0 || j === 0 || i === n - 1 || j === n - 1;
        let h = heights[j * n + i];
        const hl = heights[j * n + clamp(i - 1, 1, n - 2)], hr = heights[j * n + clamp(i + 1, 1, n - 2)];
        const hd = heights[clamp(j - 1, 1, n - 2) * n + i], hu = heights[clamp(j + 1, 1, n - 2) * n + i];
        const slope = Math.sqrt((hr - hl) ** 2 + (hu - hd) ** 2) / (2 * step);
        if (skirt) h -= 6;
        const k = (j * n + i) * 3;
        positions[k] = x; positions[k + 1] = h; positions[k + 2] = z;
        groundColor(x, z, h, slope, col);
        colors[k] = col.r; colors[k + 1] = col.g; colors[k + 2] = col.b;
      }
    }
    const indices = new (n * n > 65535 ? Uint32Array : Uint16Array)((n - 1) * (n - 1) * 6);
    let p = 0;
    for (let j = 0; j < n - 1; j++) {
      for (let i = 0; i < n - 1; i++) {
        const a = j * n + i, b = a + 1, c = a + n, d = c + 1;
        if ((i + j) & 1) { indices[p++] = a; indices[p++] = c; indices[p++] = b; indices[p++] = b; indices[p++] = c; indices[p++] = d; }
        else { indices[p++] = a; indices[p++] = c; indices[p++] = d; indices[p++] = a; indices[p++] = d; indices[p++] = b; }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    g.setIndex(new THREE.BufferAttribute(indices, 1));
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }

  // Load/unload chunks around the player. Builds a limited number per frame.
  update(px, pz, budget = 2) {
    const ccx = Math.floor(px / CHUNK_SIZE), ccz = Math.floor(pz / CHUNK_SIZE);
    const R = this.radius;
    const maxC = Math.floor(WORLD_HALF / CHUNK_SIZE);
    const wanted = [];
    for (let dz = -R; dz <= R; dz++) {
      for (let dx = -R; dx <= R; dx++) {
        const cx = ccx + dx, cz = ccz + dz;
        if (cx < -maxC - 1 || cx > maxC || cz < -maxC - 1 || cz > maxC) continue;
        const centerX = (cx + 0.5) * CHUNK_SIZE, centerZ = (cz + 0.5) * CHUNK_SIZE;
        const dist = Math.hypot(centerX - px, centerZ - pz);
        if (dist > (R + 0.75) * CHUNK_SIZE) continue;
        wanted.push({ cx, cz, dist, lod: this.lodFor(dist) });
      }
    }
    wanted.sort((a, b) => a.dist - b.dist);
    const keep = new Set();
    let built = 0;
    for (const w of wanted) {
      const k = this.key(w.cx, w.cz);
      keep.add(k);
      const existing = this.chunks.get(k);
      if (existing && existing.lod === w.lod) continue;
      if (built >= budget && existing) continue; // keep old LOD until we have budget
      if (built >= budget && !existing && w.dist > CHUNK_SIZE) continue;
      const geo = this.getGeometry(w.cx, w.cz, w.lod);
      built++;
      if (existing) {
        existing.mesh.geometry = geo;
        existing.lod = w.lod;
      } else {
        const mesh = new THREE.Mesh(geo, this.material);
        mesh.matrixAutoUpdate = false;
        mesh.updateMatrix();
        this.group.add(mesh);
        this.chunks.set(k, { mesh, lod: w.lod });
      }
    }
    for (const [k, ch] of this.chunks) {
      if (!keep.has(k)) {
        this.group.remove(ch.mesh);
        this.chunks.delete(k);
      }
    }
  }

  // Small LRU of built geometries so turning around does not rebuild everything.
  getGeometry(cx, cz, lod) {
    const k = `${cx},${cz},${lod}`;
    let g = this.cache.get(k);
    if (g) {
      this.cache.delete(k);
      this.cache.set(k, g);
      return g;
    }
    g = this.buildGeometry(cx, cz, lod);
    this.cache.set(k, g);
    if (this.cache.size > 160) {
      const inUse = new Set([...this.chunks.values()].map((c) => c.mesh.geometry));
      for (const [ck, cg] of this.cache) {
        if (this.cache.size <= 120) break;
        if (inUse.has(cg) || cg === g) continue;
        cg.dispose();
        this.cache.delete(ck);
      }
    }
    return g;
  }

  // Build everything close to a point immediately (used on spawn / teleport).
  prime(px, pz) {
    this.update(px, pz, 999);
  }
}
