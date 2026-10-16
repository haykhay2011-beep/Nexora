// Terrain chunk meshing (with LOD + skirts) and flora scatter. Pure; runs in workers.
import { hash2, hash32 } from '../core/rng';
import { Noise2, clamp } from '../core/noise';
import { CROP_BY_ID, SPECIES_BY_ID, era as getEra } from '../data';
import { TerrainSampler, CHUNK, AREA_HALF, hexToRgb } from './terrain';
import type { WorldPlan, RoadSeg, Plot, Farm } from './planTypes';

export const LOD_SEGS = [40, 20, 10];

export interface FloraBatch { species: string; data: Float32Array } // x,y,z,rotY,scale,tint per instance
export interface ChunkResult {
  key: string; cx: number; cz: number; lod: number;
  pos: Float32Array; nor: Float32Array; col: Float32Array;
  flora: FloraBatch[];
}

const ROAD_COLORS: Record<string, [number, number, number]> = {
  none: [0.5, 0.42, 0.3], trail: [0.6, 0.52, 0.38], dirt: [0.58, 0.48, 0.34], stone: [0.66, 0.62, 0.55],
  cobble: [0.5, 0.49, 0.47], asphalt: [0.25, 0.26, 0.28], glow: [0.86, 0.94, 0.98],
};

interface ChunkCtx {
  ts: TerrainSampler;
  plan: WorldPlan;
  roads: RoadSeg[];
  plots: Plot[];
  farms: Farm[];
  roadCol: [number, number, number];
  plazaCol: [number, number, number];
  noise: Noise2;
}

const ctxCache = new Map<string, { roads: RoadSeg[]; plots: Plot[]; farms: Farm[]; noise: Noise2 }>();

function segDist2(x: number, z: number, r: RoadSeg): number {
  const vx = r.bx - r.ax, vz = r.bz - r.az;
  const l2 = vx * vx + vz * vz || 1;
  const t = Math.max(0, Math.min(1, ((x - r.ax) * vx + (z - r.az) * vz) / l2));
  const dx = x - (r.ax + vx * t), dz = z - (r.az + vz * t);
  return dx * dx + dz * dz;
}

function inRect(x: number, z: number, cx: number, cz: number, w: number, d: number, rot: number, pad: number): [number, number] | null {
  const c = Math.cos(rot), s = Math.sin(rot);
  const dx = x - cx, dz = z - cz;
  const u = dx * c + dz * s, v = -dx * s + dz * c;
  if (Math.abs(u) <= w / 2 + pad && Math.abs(v) <= d / 2 + pad) return [u, v];
  return null;
}

function bboxFilter<T>(items: T[], getter: (t: T) => [number, number, number], x0: number, z0: number, x1: number, z1: number): T[] {
  return items.filter((t) => {
    const [x, z, r] = getter(t);
    return x + r >= x0 && x - r <= x1 && z + r >= z0 && z - r <= z1;
  });
}

export function buildChunk(plan: WorldPlan, ts: TerrainSampler, cx: number, cz: number, lod: number): ChunkResult {
  let shared = ctxCache.get(plan.key);
  if (!shared) {
    const s = plan.settlement;
    shared = {
      roads: s ? s.roads : [],
      plots: [...(s ? s.plots : []), ...plan.outlying],
      farms: s ? s.farms : [],
      noise: new Noise2(hash32(plan.seed, 'chunkcol')),
    };
    ctxCache.clear();
    ctxCache.set(plan.key, shared);
  }
  const x0 = cx * CHUNK, z0 = cz * CHUNK, x1 = x0 + CHUNK, z1 = z0 + CHUNK;
  const era = getEra(plan.eraId);
  const ctx: ChunkCtx = {
    ts, plan,
    roads: bboxFilter(shared.roads, (r) => [(r.ax + r.bx) / 2, (r.az + r.bz) / 2, Math.hypot(r.bx - r.ax, r.bz - r.az) / 2 + r.w], x0, z0, x1, z1),
    plots: bboxFilter(shared.plots, (p) => [p.x, p.z, Math.max(p.w, p.d) + 4], x0, z0, x1, z1),
    farms: bboxFilter(shared.farms, (f) => [f.x, f.z, Math.max(f.w, f.d)], x0, z0, x1, z1),
    roadCol: ROAD_COLORS[era.roads] ?? ROAD_COLORS.dirt,
    plazaCol: era.tech >= 8 ? [0.62, 0.62, 0.6] : era.tech >= 3 ? [0.7, 0.64, 0.52] : [0.55, 0.47, 0.34],
    noise: shared.noise,
  };

  const segs = LOD_SEGS[lod];
  const step = CHUNK / segs;
  const N = segs + 1;
  // heights + colours on a grid with a 1-cell border for normals
  const H = new Float32Array((N + 2) * (N + 2));
  for (let j = -1; j <= N; j++) for (let i = -1; i <= N; i++) H[(j + 1) * (N + 2) + (i + 1)] = ts.height(x0 + i * step, z0 + j * step);
  const h = (i: number, j: number) => H[(j + 1) * (N + 2) + (i + 1)];
  const C = new Float32Array(N * N * 3);
  const tmp: [number, number, number] = [0, 0, 0];
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x = x0 + i * step, z = z0 + j * step;
    const hx = h(i + 1, j) - h(i - 1, j), hz = h(i, j + 1) - h(i, j - 1);
    const ny = 1 / Math.sqrt(1 + (hx / (2 * step)) ** 2 + (hz / (2 * step)) ** 2);
    ts.color(x, z, h(i, j), ny, plan.ground, tmp);
    overlayColor(ctx, x, z, h(i, j), tmp);
    const o = (j * N + i) * 3;
    C[o] = tmp[0]; C[o + 1] = tmp[1]; C[o + 2] = tmp[2];
  }

  const quads = segs * segs + segs * 4;
  const pos = new Float32Array(quads * 18);
  const nor = new Float32Array(quads * 18);
  const col = new Float32Array(quads * 18);
  let p = 0;
  const pushTri = (ax: number, ay: number, az: number, bx: number, by: number, bz: number, qx: number, qy: number, qz: number, r: number, g: number, b: number) => {
    const ux = bx - ax, uy = by - ay, uz = bz - az, vx = qx - ax, vy = qy - ay, vz = qz - az;
    let nx = uy * vz - uz * vy, ny2 = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny2, nz) || 1;
    nx /= l; ny2 /= l; nz /= l;
    for (const [X, Y, Z] of [[ax, ay, az], [bx, by, bz], [qx, qy, qz]]) {
      pos[p] = X; pos[p + 1] = Y; pos[p + 2] = Z;
      nor[p] = nx; nor[p + 1] = ny2; nor[p + 2] = nz;
      col[p] = r; col[p + 1] = g; col[p + 2] = b;
      p += 3;
    }
  };
  const cAt = (i: number, j: number, k: number) => C[(j * N + i) * 3 + k];
  for (let j = 0; j < segs; j++) for (let i = 0; i < segs; i++) {
    const xa = x0 + i * step, xb = xa + step, za = z0 + j * step, zb = za + step;
    const h00 = h(i, j), h10 = h(i + 1, j), h01 = h(i, j + 1), h11 = h(i + 1, j + 1);
    const alt = (i + j) % 2 === 0;
    if (alt) {
      const r = (cAt(i, j, 0) + cAt(i, j + 1, 0) + cAt(i + 1, j, 0)) / 3, g = (cAt(i, j, 1) + cAt(i, j + 1, 1) + cAt(i + 1, j, 1)) / 3, b = (cAt(i, j, 2) + cAt(i, j + 1, 2) + cAt(i + 1, j, 2)) / 3;
      pushTri(xa, h00, za, xa, h01, zb, xb, h10, za, r, g, b);
      const r2 = (cAt(i + 1, j, 0) + cAt(i, j + 1, 0) + cAt(i + 1, j + 1, 0)) / 3, g2 = (cAt(i + 1, j, 1) + cAt(i, j + 1, 1) + cAt(i + 1, j + 1, 1)) / 3, b2 = (cAt(i + 1, j, 2) + cAt(i, j + 1, 2) + cAt(i + 1, j + 1, 2)) / 3;
      pushTri(xb, h10, za, xa, h01, zb, xb, h11, zb, r2, g2, b2);
    } else {
      const r = (cAt(i, j, 0) + cAt(i, j + 1, 0) + cAt(i + 1, j + 1, 0)) / 3, g = (cAt(i, j, 1) + cAt(i, j + 1, 1) + cAt(i + 1, j + 1, 1)) / 3, b = (cAt(i, j, 2) + cAt(i, j + 1, 2) + cAt(i + 1, j + 1, 2)) / 3;
      pushTri(xa, h00, za, xa, h01, zb, xb, h11, zb, r, g, b);
      const r2 = (cAt(i, j, 0) + cAt(i + 1, j + 1, 0) + cAt(i + 1, j, 0)) / 3, g2 = (cAt(i, j, 1) + cAt(i + 1, j + 1, 1) + cAt(i + 1, j, 1)) / 3, b2 = (cAt(i, j, 2) + cAt(i + 1, j + 1, 2) + cAt(i + 1, j, 2)) / 3;
      pushTri(xa, h00, za, xb, h11, zb, xb, h10, za, r2, g2, b2);
    }
  }
  // skirts hide cracks between LODs
  const skirt = 4 + step * 0.6;
  const edge = (ia: number, ja: number, ib: number, jb: number) => {
    const xa = x0 + ia * step, za = z0 + ja * step, xb = x0 + ib * step, zb = z0 + jb * step;
    const ha = h(ia, ja), hb = h(ib, jb);
    const r = cAt(ia, ja, 0) * 0.8, g = cAt(ia, ja, 1) * 0.8, b = cAt(ia, ja, 2) * 0.8;
    pushTri(xa, ha, za, xb, hb - skirt, zb, xb, hb, zb, r, g, b);
    pushTri(xa, ha, za, xa, ha - skirt, za, xb, hb - skirt, zb, r, g, b);
    pushTri(xa, ha, za, xb, hb, zb, xb, hb - skirt, zb, r, g, b);
    pushTri(xa, ha, za, xb, hb - skirt, zb, xa, ha - skirt, za, r, g, b);
  };
  for (let i = 0; i < segs; i++) {
    edge(i, 0, i + 1, 0); edge(i, segs, i + 1, segs); edge(0, i, 0, i + 1); edge(segs, i, segs, i + 1);
  }

  const flora = lod <= 1 ? scatterFlora(ctx, cx, cz, lod) : [];
  return { key: `${cx},${cz}`, cx, cz, lod, pos: pos.subarray(0, p), nor: nor.subarray(0, p), col: col.subarray(0, p), flora };
}

function overlayColor(ctx: ChunkCtx, x: number, z: number, h: number, out: [number, number, number]) {
  if (h < 0.2) return;
  const s = ctx.plan.settlement;
  const n = ctx.noise.noise(x / 9, z / 9);
  for (const r of ctx.roads) {
    const d2 = segDist2(x, z, r);
    const hw = r.w / 2;
    if (d2 < hw * hw * 1.6) {
      const t = d2 < hw * hw ? 1 : 0.5;
      const rc = ctx.roadCol;
      out[0] = out[0] * (1 - t) + rc[0] * t * (1 + n * 0.04);
      out[1] = out[1] * (1 - t) + rc[1] * t * (1 + n * 0.04);
      out[2] = out[2] * (1 - t) + rc[2] * t * (1 + n * 0.04);
      return;
    }
  }
  if (s && Math.hypot(x - s.plaza.x, z - s.plaza.z) < s.plaza.r) {
    const pc = ctx.plazaCol;
    out[0] = pc[0] + n * 0.03; out[1] = pc[1] + n * 0.03; out[2] = pc[2] + n * 0.03;
    return;
  }
  for (const f of ctx.farms) {
    const uv = inRect(x, z, f.x, f.z, f.w, f.d, f.rot, 0);
    if (!uv) continue;
    const crop = CROP_BY_ID.get(f.crop);
    if (!crop) continue;
    const soil = hexToRgb(crop.soil), plant = hexToRgb(crop.color);
    const row = Math.sin(uv[1] * 2.1) > 0.1;
    const c = crop.shape === 'paddy' ? (row ? plant : [0.42, 0.55, 0.6]) : row ? plant : soil;
    out[0] = c[0]; out[1] = c[1]; out[2] = c[2];
    return;
  }
  for (const p of ctx.plots) {
    if (inRect(x, z, p.x, p.z, p.w, p.d, p.rot, 2.5)) {
      out[0] = out[0] * 0.55 + 0.6 * 0.45 * 0.9; out[1] = out[1] * 0.55 + 0.52 * 0.45 * 0.9; out[2] = out[2] * 0.55 + 0.4 * 0.45 * 0.9;
      return;
    }
  }
}

function blocked(ctx: ChunkCtx, x: number, z: number, pad: number): boolean {
  for (const r of ctx.roads) { const hw = r.w / 2 + pad; if (segDist2(x, z, r) < hw * hw) return true; }
  for (const p of ctx.plots) if (inRect(x, z, p.x, p.z, p.w, p.d, p.rot, pad + 1.5)) return true;
  for (const f of ctx.farms) if (inRect(x, z, f.x, f.z, f.w, f.d, f.rot, 1)) return true;
  const s = ctx.plan.settlement;
  if (s && Math.hypot(x - s.plaza.x, z - s.plaza.z) < s.plaza.r + 2) return true;
  if (s && s.tier === 'camp' && Math.hypot(x - s.x, z - s.z) < s.radius) return true;
  for (const l of ctx.plan.landmarks) if (l.clear > 0 && Math.hypot(x - l.x, z - l.z) < l.clear) return true;
  if (Math.hypot(x - ctx.plan.spawn.x, z - ctx.plan.spawn.z) < 6) return true;
  return false;
}

function scatterFlora(ctx: ChunkCtx, cx: number, cz: number, lod: number): FloraBatch[] {
  const plan = ctx.plan;
  const ts = ctx.ts;
  const out = new Map<string, number[]>();
  const density = plan.floraDensity;
  const s = plan.settlement;
  const urban = s ? (s.tier === 'metropolis' ? 1 : s.tier === 'city' ? 0.8 : 0.5) : 0;
  const x0 = cx * CHUNK, z0 = cz * CHUNK;
  if (density > 0) {
    const spacing = 5.5;
    const n = Math.floor(CHUNK / spacing);
    const total = plan.flora.reduce((a, [, w]) => a + w, 0);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const gx = cx * n + i, gz = cz * n + j;
      const r1 = hash2(gx, gz, plan.seed), r2 = hash2(gx, gz, plan.seed + 7), r3 = hash2(gx, gz, plan.seed + 13), r4 = hash2(gx, gz, plan.seed + 29);
      const x = x0 + (i + r2) * spacing, z = z0 + (j + r3) * spacing;
      if (Math.abs(x) > AREA_HALF || Math.abs(z) > AREA_HALF) continue;
      const patch = ctx.noise.noise(x / 160, z / 160) * 0.5 + 0.5;
      let p = density * (0.35 + patch * 1.1) * 0.55;
      if (s) {
        const d = Math.hypot(x - s.x, z - s.z);
        if (d < s.radius * 1.1) p *= urban >= 0.8 ? 0.03 : 1 - urban * 0.9;
        else if (d < s.radius * 1.6 && urban >= 0.8) p *= 0.35;
      }
      if (r1 > p) continue;
      // species pick
      let pick = r4 * total, sp = plan.flora[0][0];
      for (const [id, w] of plan.flora) { pick -= w; if (pick <= 0) { sp = id; break; } }
      const def = SPECIES_BY_ID.get(sp);
      if (!def) continue;
      const h = ts.height(x, z);
      const water = h < 0.35;
      if (water && !(def.arch === 'reed' || def.arch === 'mangrove')) continue;
      if (h < -1) continue;
      if (def.nearWater && h > 3 && ts.riverDist(x, z) > 70) continue;
      const big = ['broadleaf', 'conifer', 'emergent', 'palm', 'baobab', 'acacia', 'eucalyptus', 'araucaria', 'cedar', 'cypress', 'birch', 'glow', 'banyan', 'willow', 'boulder'].includes(def.arch);
      if (blocked(ctx, x, z, big ? 3 : 1)) continue;
      const sl = ts.slope(x, z, 1.5);
      if (sl < (big ? 0.8 : 0.65) && def.arch !== 'rock' && def.arch !== 'boulder') continue;
      const scale = def.size[0] + (def.size[1] - def.size[0]) * hash2(gx, gz, plan.seed + 41);
      let arr = out.get(sp);
      if (!arr) out.set(sp, (arr = []));
      arr.push(x, h - 0.15, z, hash2(gx, gz, plan.seed + 53) * Math.PI * 2, scale, hash2(gx, gz, plan.seed + 61));
    }
  }
  // grass tufts close to the player only
  if (lod === 0 && !['desert', 'ice', 'moon', 'beach', 'ocean'].includes(plan.biome) && plan.ground.snowCover < 0.6) {
    const spacing = 2.4;
    const n = Math.floor(CHUNK / spacing);
    const arr: number[] = [];
    const gd = clamp(plan.floraDensity + 0.3, 0.3, 1);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const gx = cx * n + i, gz = cz * n + j;
      if (hash2(gx, gz, plan.seed + 101) > gd * 0.55) continue;
      const x = x0 + (i + hash2(gx, gz, plan.seed + 103)) * spacing, z = z0 + (j + hash2(gx, gz, plan.seed + 107)) * spacing;
      const h = ts.height(x, z);
      if (h < 0.6) continue;
      if (blocked(ctx, x, z, 0.3)) continue;
      if (ts.slope(x, z, 1) < 0.75) continue;
      arr.push(x, h - 0.05, z, hash2(gx, gz, plan.seed + 109) * 6.28, 0.6 + hash2(gx, gz, plan.seed + 113) * 0.7, hash2(gx, gz, plan.seed + 127));
    }
    if (arr.length) out.set('_grass', arr);
  }
  return [...out.entries()].map(([species, a]) => ({ species, data: new Float32Array(a) }));
}
