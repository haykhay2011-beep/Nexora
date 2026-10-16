// Streams terrain chunks (LOD by distance) and per-chunk instanced flora around the player.
import * as THREE from 'three';
import type { WorkerPool } from './WorkerPool';
import type { WorldPlan } from '../gen/planTypes';
import { TerrainSampler, CHUNK, AREA_HALF } from '../gen/terrain';
import type { ChunkResult } from '../gen/chunk';
import { MATS, GLOBAL } from './materials';
import { floraGeometry, castsShadow } from './floraLib';
import { FLORA } from '../data';

interface Chunk {
  cx: number; cz: number; lod: number;
  group: THREE.Group;
  terrain: THREE.Mesh;
  flora: THREE.InstancedMesh[];
}

const MAXC = Math.floor(AREA_HALF / CHUNK);
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();
const _c = new THREE.Color();
const _up = new THREE.Vector3(0, 1, 0);

export class ChunkManager {
  readonly root = new THREE.Group();
  private chunks = new Map<string, Chunk>();
  private inflight = new Map<string, number>(); // key -> lod requested
  private far: THREE.Mesh | null = null;
  viewDistance = 640;
  floraDistance = 420;
  shadowsNear = true;
  densityScale = 1;
  private lastCenter = '';
  private grassColor = '#7a9a4a';

  constructor(private pool: WorkerPool, private plan: WorldPlan, private ts: TerrainSampler) {
    this.root.name = 'chunks';
    const g = FLORA.biomes[plan.biome]?.grass;
    if (g) this.grassColor = g;
    this.buildFar();
  }

  get loadedCount() { return this.chunks.size; }
  get pendingCount() { return this.inflight.size; }

  private buildFar() {
    const N = 110, size = AREA_HALF * 4, step = size / N;
    const pos: number[] = [], col: number[] = [];
    const H: number[] = [];
    const C: number[] = [];
    const tmp: [number, number, number] = [0, 0, 0];
    for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
      const x = -size / 2 + i * step, z = -size / 2 + j * step;
      const h = this.ts.height(x, z);
      H.push(h);
      this.ts.color(x, z, h, 0.95, this.plan.ground, tmp);
      const fog = Math.min(1, Math.hypot(x, z) / (size * 0.5));
      C.push(tmp[0] * (1 - fog * 0.1), tmp[1] * (1 - fog * 0.1), tmp[2] * (1 - fog * 0.1));
    }
    const idx = (i: number, j: number) => j * (N + 1) + i;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const quad = [[i, j], [i, j + 1], [i + 1, j], [i + 1, j], [i, j + 1], [i + 1, j + 1]];
      let r = 0, g = 0, b = 0;
      for (const [a, c] of quad.slice(0, 4)) { const k = idx(a, c) * 3; r += C[k]; g += C[k + 1]; b += C[k + 2]; }
      for (const [a, c] of quad) {
        pos.push(-size / 2 + a * step, H[idx(a, c)] - 0.6, -size / 2 + c * step);
        col.push(r / 4, g / 4, b / 4);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.computeVertexNormals();
    const mat = MATS.terrain.clone();
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uPlayer = GLOBAL.uPlayer;
      sh.uniforms.uNearRadius = GLOBAL.uNearRadius;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform vec3 uPlayer;\nuniform float uNearRadius;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          float dn = length(transformed.xz - uPlayer.xz);
          transformed.y -= 40.0 * (1.0 - smoothstep(uNearRadius - 150.0, uNearRadius - 40.0, dn));`);
    };
    mat.customProgramCacheKey = () => 'farterrain';
    this.far = new THREE.Mesh(geo, mat);
    this.far.receiveShadow = false;
    this.far.frustumCulled = false;
    this.root.add(this.far);
  }

  private lodFor(dist: number): number {
    if (dist < CHUNK * 1.6) return 0;
    if (dist < CHUNK * 3.8) return 1;
    return 2;
  }

  update(px: number, pz: number) {
    GLOBAL.uNearRadius.value = Math.min(this.viewDistance, MAXC * CHUNK) ;
    const R = Math.ceil(this.viewDistance / CHUNK);
    const pcx = Math.floor(px / CHUNK), pcz = Math.floor(pz / CHUNK);
    const want: { key: string; cx: number; cz: number; lod: number; d: number }[] = [];
    for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {
      const cx = pcx + dx, cz = pcz + dz;
      if (cx < -MAXC || cx >= MAXC || cz < -MAXC || cz >= MAXC) continue;
      const ccx = (cx + 0.5) * CHUNK, ccz = (cz + 0.5) * CHUNK;
      const d = Math.hypot(ccx - px, ccz - pz);
      if (d > this.viewDistance + CHUNK * 0.7) continue;
      want.push({ key: `${cx},${cz}`, cx, cz, lod: this.lodFor(d), d });
    }
    want.sort((a, b) => a.d - b.d);
    const keep = new Set(want.map((w) => w.key));
    // drop far chunks (with hysteresis)
    for (const [key, c] of this.chunks) {
      if (keep.has(key)) continue;
      const d = Math.hypot((c.cx + 0.5) * CHUNK - px, (c.cz + 0.5) * CHUNK - pz);
      if (d > this.viewDistance + CHUNK * 1.6) this.dispose(key, c);
    }
    // request missing/changed LODs
    const maxInflight = this.pool.size * 3;
    for (const w of want) {
      if (this.inflight.size >= maxInflight) break;
      const c = this.chunks.get(w.key);
      if (c && c.lod === w.lod) continue;
      if (this.inflight.has(w.key)) continue;
      this.request(w.key, w.cx, w.cz, w.lod);
    }
    // flora visibility by distance
    const center = `${pcx},${pcz}`;
    if (center !== this.lastCenter) {
      this.lastCenter = center;
      for (const c of this.chunks.values()) {
        const d = Math.hypot((c.cx + 0.5) * CHUNK - px, (c.cz + 0.5) * CHUNK - pz);
        for (const f of c.flora) {
          f.visible = d < this.floraDistance + (f.userData.big ? 260 : 0);
          f.castShadow = this.shadowsNear && d < 220 && f.userData.shadow;
        }
      }
    }
  }

  private request(key: string, cx: number, cz: number, lod: number) {
    this.inflight.set(key, lod);
    this.pool.chunk(this.plan.key, cx, cz, lod).then((res) => {
      this.inflight.delete(key);
      this.install(res);
    }).catch(() => this.inflight.delete(key));
  }

  private install(r: ChunkResult) {
    const old = this.chunks.get(r.key);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(r.pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(r.nor, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(r.col, 3));
    geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, MATS.terrain);
    mesh.receiveShadow = true;
    const group = new THREE.Group();
    group.add(mesh);
    const flora: THREE.InstancedMesh[] = [];
    for (const fb of r.flora) {
      const n = fb.data.length / 6;
      if (!n) continue;
      const big = fb.species !== '_grass' && castsShadow(fb.species);
      const g = floraGeometry(fb.species, r.lod === 0 ? 0 : 1, fb.species === '_grass' ? this.grassColor : undefined);
      const count = Math.max(1, Math.round(n * (fb.species === '_grass' ? this.densityScale : Math.min(1, this.densityScale + 0.3))));
      const im = new THREE.InstancedMesh(g, fb.species === '_grass' ? MATS.flora : big ? MATS.floraStatic : MATS.flora, Math.min(n, count));
      im.userData.big = big;
      im.userData.shadow = big;
      for (let i = 0; i < im.count; i++) {
        const o = i * 6;
        const s = fb.data[o + 4];
        _q.setFromAxisAngle(_up, fb.data[o + 3]);
        _m.compose(_p.set(fb.data[o], fb.data[o + 1], fb.data[o + 2]), _q, _s.set(s, s, s));
        im.setMatrixAt(i, _m);
        const t = 0.82 + fb.data[o + 5] * 0.3;
        im.setColorAt(i, _c.setRGB(t, t, t * 0.97));
      }
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
      im.computeBoundingSphere();
      im.receiveShadow = true;
      flora.push(im);
      group.add(im);
    }
    if (old) this.dispose(r.key, old, true);
    const c: Chunk = { cx: r.cx, cz: r.cz, lod: r.lod, group, terrain: mesh, flora };
    this.chunks.set(r.key, c);
    this.root.add(group);
    this.lastCenter = '';
  }

  private dispose(key: string, c: Chunk, keepEntry = false) {
    this.root.remove(c.group);
    c.terrain.geometry.dispose();
    for (const f of c.flora) f.dispose();
    if (!keepEntry) this.chunks.delete(key);
  }

  /** True when the chunks around (px, pz) are ready (for loading screens). */
  readyAround(px: number, pz: number, radius = 200): boolean {
    const r = Math.ceil(radius / CHUNK);
    const pcx = Math.floor(px / CHUNK), pcz = Math.floor(pz / CHUNK);
    for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
      const cx = pcx + dx, cz = pcz + dz;
      if (cx < -MAXC || cx >= MAXC || cz < -MAXC || cz >= MAXC) continue;
      if (!this.chunks.has(`${cx},${cz}`)) return false;
    }
    return true;
  }

  destroy() {
    for (const [k, c] of this.chunks) this.dispose(k, c);
    if (this.far) { this.root.remove(this.far); this.far.geometry.dispose(); }
    this.root.removeFromParent();
  }
}
