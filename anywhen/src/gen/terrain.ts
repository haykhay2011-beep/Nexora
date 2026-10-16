// TerrainSampler: deterministic height + ground colour for a world plan. Built only from plain
// plan data so the worker (meshing) and main thread (collision) agree exactly.
import { Noise2, clamp, lerp, smoothstep } from '../core/noise';
import { hash32 } from '../core/rng';
import { CELL_M } from '../geo/earth';

export const AREA_HALF = 3000; // world spans -3000..3000 m on x and z
export const CHUNK = 128;

export interface Line { px: number; pz: number; dx: number; dz: number; width: number; valley: number }

export interface TMod {
  type: 'flatten' | 'peak' | 'canyon' | 'falls' | 'monolith' | 'reef' | 'island' | 'pit' | 'lake' | 'gorge' | 'crater';
  x: number; z: number; radius: number;
  height?: number; depth?: number; width?: number; angle?: number; flat?: number; crater?: boolean; target?: number;
}

export interface TerrainParams {
  seed: number;
  grid: { n: number; step: number; water: number[] };
  baseInland: number;
  relief: number;
  ridged: number;
  dunes: number;
  duneAngle: number;
  plateau: number;
  rough: number;
  river: Line | null;
  streams: Line[];
  mods: TMod[];
  iceSheet: boolean;
  moon: boolean;
  craters: { x: number; z: number; r: number; d: number }[];
}

export interface GroundStyle {
  ground: [number, number, number];
  grass: [number, number, number];
  rock: [number, number, number];
  sand: [number, number, number];
  snow: [number, number, number];
  seabed: [number, number, number];
  dirt: [number, number, number];
  snowCover: number; // 0..1 seasonal
  snowLine: number; // metres
  strata: boolean;
  mud: number;
  grassVariation: number;
  autumn: number;
}

export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export class TerrainSampler {
  readonly p: TerrainParams;
  private n1: Noise2;
  private n2: Noise2;
  private n3: Noise2;
  private grid: Float32Array;
  constructor(p: TerrainParams) {
    this.p = p;
    this.n1 = new Noise2(hash32(p.seed, 'terrain1'));
    this.n2 = new Noise2(hash32(p.seed, 'terrain2'));
    this.n3 = new Noise2(hash32(p.seed, 'terrain3'));
    this.grid = Float32Array.from(p.grid.water);
  }

  /** Interpolated water coverage (0 land … 1 water) from the coarse geo grid. */
  waterCoverage(x: number, z: number): number {
    const { n, step } = this.p.grid;
    const half = ((n - 1) * step) / 2;
    const fx = clamp((x + half) / step, 0, n - 1.001), fz = clamp((z + half) / step, 0, n - 1.001);
    const x0 = Math.floor(fx), z0 = Math.floor(fz), tx = fx - x0, tz = fz - z0;
    const g = this.grid;
    const a = g[z0 * n + x0], b = g[z0 * n + x0 + 1], c = g[(z0 + 1) * n + x0], d = g[(z0 + 1) * n + x0 + 1];
    return (a * (1 - tx) + b * tx) * (1 - tz) + (c * (1 - tx) + d * tx) * tz;
  }

  /** Signed distance to the shoreline in metres (+ on land). */
  shoreDist(x: number, z: number): number {
    if (this.p.moon) return 99999;
    const w = this.waterCoverage(x, z);
    const warp = this.n1.fbm(x / 1100, z / 1100, 3) * 0.06 + this.n2.noise(x / 260, z / 260) * 0.012;
    return (0.5 - w + warp) * CELL_M;
  }

  private lineDist(l: Line, x: number, z: number): number {
    const rx = x - l.px, rz = z - l.pz;
    const along = rx * l.dx + rz * l.dz;
    const perp = rx * -l.dz + rz * l.dx;
    const meander = this.n3.noise(along / 520, 3.7) * l.width * 3 + this.n3.noise(along / 170, 9.1) * l.width * 0.8;
    return Math.abs(perp - meander);
  }

  riverDist(x: number, z: number): number {
    let d = Infinity;
    if (this.p.river) d = this.lineDist(this.p.river, x, z) - this.p.river.width * 0.5;
    for (const s of this.p.streams) d = Math.min(d, this.lineDist(s, x, z) - s.width * 0.5);
    return d;
  }

  height(x: number, z: number): number {
    const p = this.p;
    if (p.moon) return this.moonHeight(x, z);
    const sd = this.shoreDist(x, z);
    let h: number;
    if (sd > 0) {
      const inland = smoothstep(0, 1100, sd);
      h = lerp(0.7, p.baseInland, inland);
      const land = smoothstep(0, 500, sd);
      const r = p.relief * land;
      h += (this.n1.fbm(x / 760, z / 760, 4) * 0.5 + 0.5) * r * (1 - p.ridged * 0.6);
      if (p.ridged > 0) {
        const rd = this.n2.ridged(x / 1500, z / 1500, 5);
        h += rd * rd * r * 1.6 * p.ridged;
      }
      if (p.dunes > 0) {
        const ca = Math.cos(p.duneAngle), sa = Math.sin(p.duneAngle);
        const u = (x * ca + z * sa) / 46 + this.n3.noise(x / 300, z / 300) * 2.5;
        const s = Math.sin(u) * 0.5 + 0.5;
        h += s * s * p.dunes * land * (0.6 + 0.4 * this.n1.noise(x / 500, z / 500));
      }
      if (p.plateau > 0) {
        const stepH = 14;
        const q = h / stepH;
        const f = q - Math.floor(q);
        h = lerp(h, (Math.floor(q) + smoothstep(0.7, 0.95, f)) * stepH, p.plateau);
      }
      h += this.n2.noise(x / 55, z / 55) * 0.55 * p.rough + this.n3.noise(x / 14, z / 14) * 0.12 * p.rough;
    } else {
      h = Math.max(-26, sd * 0.03) - 0.6 + this.n2.noise(x / 120, z / 120) * 0.8;
    }

    // rivers and streams flatten their valleys to water level and cut a channel
    if (p.river || p.streams.length) {
      const all = p.river ? [p.river, ...p.streams] : p.streams;
      for (const l of all) {
        const d = this.lineDist(l, x, z);
        const half = l.width * 0.5;
        if (d > half + l.valley) continue;
        const v = 1 - smoothstep(half, half + l.valley, d);
        h = lerp(h, Math.min(h, 1.1 + d * 0.004), v * 0.92);
        const c = 1 - smoothstep(half * 0.55, half + 1.5, d);
        h = lerp(h, -2.2 - (l.width > 60 ? 2 : 0), c);
      }
    }

    for (const m of p.mods) h = this.applyMod(m, x, z, h);
    if (p.iceSheet) h += this.n2.noise(x / 90, z / 90) * 0.6;
    return h;
  }

  private applyMod(m: TMod, x: number, z: number, h: number): number {
    const dx = x - m.x, dz = z - m.z;
    const d = Math.hypot(dx, dz);
    switch (m.type) {
      case 'flatten': {
        if (d > m.radius) return h;
        const t = 1 - smoothstep(m.radius * 0.65, m.radius, d);
        return lerp(h, m.target ?? 2, t);
      }
      case 'peak': {
        if (d > m.radius) return h;
        const pr = 1 - d / m.radius;
        const H = m.height ?? 500;
        let add = H * Math.pow(pr, 1.55) * (0.9 + 0.1 * this.n1.noise(x / 300, z / 300));
        add += this.n2.ridged(x / 420, z / 420, 4) * H * 0.12 * pr;
        if (m.flat) {
          const top = H * Math.pow(1 - m.flat / m.radius, 1.55);
          if (d < m.flat * 1.4) add = lerp(add, top, 1 - smoothstep(m.flat, m.flat * 1.4, d));
        }
        if (m.crater) {
          const cr = m.radius * 0.07;
          if (d < cr) add -= (1 - (d / cr) ** 2) * H * 0.07;
        }
        return h + add;
      }
      case 'canyon':
      case 'gorge': {
        const ang = ((m.angle ?? 0) * Math.PI) / 180;
        const ax = Math.cos(ang), az = Math.sin(ang);
        const along = dx * ax + dz * az;
        const perp = -dx * az + dz * ax;
        const mw = (m.width ?? 800) / 2;
        const meander = this.n3.noise(along / 1500, 1.3) * mw * 0.6 + this.n1.noise(along / 400, 5.1) * mw * 0.15;
        // side canyons
        const side = Math.abs(this.n2.noise(along / 600, perp / 900)) * mw * 0.5;
        const pd = Math.abs(perp - meander) - side * smoothstep(mw * 2.5, 0, Math.abs(perp - meander));
        if (pd > mw) return h;
        const f = 1 - pd / mw;
        const terraces = 7;
        const q = f * terraces;
        const stepped = (Math.floor(q) + smoothstep(0.55, 1, q - Math.floor(q))) / terraces;
        const depth = m.depth ?? 600;
        return h - depth * lerp(f, stepped, 0.7) * Math.min(1, f * 3);
      }
      case 'falls': {
        const ang = ((m.angle ?? 0) * Math.PI) / 180;
        const ax = Math.cos(ang), az = Math.sin(ang);
        const along = dx * ax + dz * az; // flow direction
        const perp = -dx * az + dz * ax;
        if (Math.abs(along) > m.radius || Math.abs(perp) > m.radius) return h;
        const drop = m.height ?? 80;
        const halfW = (m.width ?? 800) / 2;
        // upstream plateau (along < 0) raised by the drop, downstream a gorge
        const up = 1 - smoothstep(-12, 6, along + this.n1.noise(perp / 80, 0.5) * 6);
        let hh = h + up * (drop + 2);
        // upper river channel on the plateau
        if (along < 0 && Math.abs(perp) < halfW) {
          const c = 1 - smoothstep(halfW * 0.85, halfW, Math.abs(perp));
          hh = lerp(hh, drop + 0.2, c * up);
        }
        // gorge downstream
        if (along > 0) {
          const gw = Math.max(60, halfW * 0.12);
          const g = 1 - smoothstep(gw, gw * 2.5, Math.abs(along - gw * 1.5));
          const inW = 1 - smoothstep(halfW, halfW * 1.15, Math.abs(perp));
          hh = lerp(hh, -1.5, g * inW);
        }
        return hh;
      }
      case 'monolith': {
        const a = (m.width ?? m.radius) / 2, b = m.radius / 2.6;
        const e = Math.pow(Math.pow(Math.abs(dx) / a, 4) + Math.pow(Math.abs(dz) / b, 4), 0.25);
        if (e > 1.15) return h;
        const H = m.height ?? 300;
        const wall = 1 - smoothstep(0.9, 1.04, e);
        const top = 1 - 0.08 * e * e + this.n1.noise(x / 120, z / 120) * 0.04;
        const gullies = Math.abs(this.n2.noise(Math.atan2(dz, dx) * 8, 2.2)) * 0.12;
        return Math.max(h, h + H * wall * (top - gullies * (1 - wall)));
      }
      case 'reef': {
        if (d > m.radius) return h;
        if (h > 0.5) return h;
        const t = 1 - smoothstep(m.radius * 0.8, m.radius, d);
        const depth = m.depth ?? 4;
        return lerp(h, -depth + this.n1.fbm(x / 140, z / 140, 3) * depth * 0.7, t);
      }
      case 'island': {
        if (d > m.radius) return h;
        const H = m.height ?? 20;
        const t = 1 - d / m.radius;
        const prof = H * Math.pow(t, 0.9) + 1.5;
        const flatTop = m.flat ? Math.min(prof, H * 0.25 + 2) : prof;
        return Math.max(h, flatTop + this.n2.noise(x / 40, z / 40) * 0.6);
      }
      case 'pit': {
        const r = m.radius;
        if (Math.abs(dx) > r * 1.6 || Math.abs(dz) > r * 1.6) return h;
        const e = Math.max(Math.abs(dx), Math.abs(dz));
        const t = 1 - smoothstep(r * 0.98, r * 1.02, e);
        return lerp(h, (m.target ?? h) - (m.depth ?? 10), t);
      }
      case 'lake': {
        if (d > m.radius) return h;
        const t = 1 - smoothstep(m.radius * 0.6, m.radius, d);
        return lerp(h, -(m.depth ?? 4), t);
      }
      case 'crater': {
        if (d > m.radius * 1.4) return h;
        const r = d / m.radius;
        const depth = m.depth ?? 10;
        if (r < 1) return h - depth * (1 - r * r) + depth * 0.25;
        return h + depth * 0.25 * (1 - smoothstep(1, 1.4, r));
      }
    }
    return h;
  }

  private moonHeight(x: number, z: number): number {
    let h = this.n1.fbm(x / 900, z / 900, 4) * 14 + this.n2.noise(x / 90, z / 90) * 1.2 + 10;
    for (const c of this.p.craters) {
      const d = Math.hypot(x - c.x, z - c.z);
      if (d > c.r * 1.5) continue;
      const r = d / c.r;
      if (r < 1) h += -c.d * (1 - r * r) + c.d * 0.3;
      else h += c.d * 0.3 * (1 - smoothstep(1, 1.5, r));
    }
    for (const m of this.p.mods) if (m.type === 'flatten') h = this.applyMod(m, x, z, h);
    return h;
  }

  /** Approximate surface normal y-component (1 = flat). */
  slope(x: number, z: number, e = 2): number {
    const hx = this.height(x + e, z) - this.height(x - e, z);
    const hz = this.height(x, z + e) - this.height(x, z - e);
    const nx = -hx / (2 * e), nz = -hz / (2 * e);
    return 1 / Math.sqrt(1 + nx * nx + nz * nz);
  }

  isWater(x: number, z: number): boolean {
    return this.height(x, z) < 0;
  }

  /** Ground colour. h = height, ny = normal y. */
  color(x: number, z: number, h: number, ny: number, g: GroundStyle, out: [number, number, number]): void {
    const n = this.n3.noise(x / 37, z / 37);
    const n2 = this.n1.noise(x / 210, z / 210);
    let r: number, gg: number, b: number;
    // grass / ground blend
    const gm = clamp(0.5 + n2 * 0.6 + n * 0.15 * g.grassVariation, 0, 1);
    r = lerp(g.ground[0], g.grass[0], gm);
    gg = lerp(g.ground[1], g.grass[1], gm);
    b = lerp(g.ground[2], g.grass[2], gm);
    if (g.autumn > 0 && n2 > 0.2) {
      r = lerp(r, 0.62, g.autumn * 0.4); gg = lerp(gg, 0.48, g.autumn * 0.3); b = lerp(b, 0.25, g.autumn * 0.3);
    }
    // rock on steep slopes
    const rockT = smoothstep(0.86, 0.68, ny);
    if (rockT > 0) {
      let rr = g.rock[0], rg = g.rock[1], rb = g.rock[2];
      if (g.strata) {
        const band = Math.sin(h / 9 + n * 0.8) * 0.5 + 0.5;
        const band2 = Math.sin(h / 23) * 0.5 + 0.5;
        rr = lerp(0.62, 0.82, band) * lerp(0.85, 1.05, band2);
        rg = lerp(0.36, 0.52, band) * lerp(0.85, 1.0, band2);
        rb = lerp(0.24, 0.38, band);
      }
      r = lerp(r, rr, rockT); gg = lerp(gg, rg, rockT); b = lerp(b, rb, rockT);
    }
    // beaches and river banks
    if (h < 1.8 && h > -0.6 && !this.p.moon) {
      const t = 1 - smoothstep(0.6, 1.8, h);
      const sandT = t * (this.p.river && this.riverDist(x, z) < 30 ? 0.55 : 1);
      r = lerp(r, g.sand[0], sandT); gg = lerp(gg, g.sand[1], sandT); b = lerp(b, g.sand[2], sandT);
      if (g.mud > 0) { r = lerp(r, 0.36, g.mud * t); gg = lerp(gg, 0.3, g.mud * t); b = lerp(b, 0.2, g.mud * t); }
    }
    if (h <= -0.6) {
      const t = smoothstep(-0.6, -6, h);
      r = lerp(g.sand[0], g.seabed[0], t); gg = lerp(g.sand[1], g.seabed[1], t); b = lerp(g.sand[2], g.seabed[2], t);
    }
    // snow: permanent above the snow line, seasonal cover elsewhere
    const snowLine = g.snowLine + n * 25;
    let snow = smoothstep(snowLine - 30, snowLine + 30, h) * (ny > 0.55 ? 1 : 0.4);
    snow = Math.max(snow, g.snowCover * (h > 0.3 ? 1 : 0) * clamp(0.75 + n * 0.4, 0, 1) * (ny > 0.6 ? 1 : 0.5));
    if (snow > 0) { r = lerp(r, g.snow[0], snow); gg = lerp(gg, g.snow[1], snow); b = lerp(b, g.snow[2], snow); }
    const v = 1 + n * 0.05;
    out[0] = r * v; out[1] = gg * v; out[2] = b * v;
  }
}
