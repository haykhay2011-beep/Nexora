// Procedural settlement layout: roads, plots, farms, ports, walls, props, ruins.
import { Rng, hash32 } from '../core/rng';
import { STYLE_BY_ID, CROP_BY_ID } from '../data';
import type { SettlementTier, BuildingStyle, EraProfile } from '../data/types';
import { TIER_ORDER } from '../data/types';
import type { TerrainSampler } from './terrain';
import { AREA_HALF } from './terrain';
import type { Settlement, RoadSeg, Plot, Farm, Prop, PlotRole } from './planTypes';
import type { WorldProfile } from './profiles';

export const TIER_RADIUS: Record<SettlementTier, number> = {
  none: 0, camp: 34, hamlet: 70, village: 130, town: 260, city: 520, metropolis: 1050,
};

interface Ctx {
  rng: Rng;
  ts: TerrainSampler;
  profile: WorldProfile;
  era: EraProfile;
  avoid: { x: number; z: number; r: number }[];
  plots: Plot[];
  nextId: number;
}

function obbOverlap(a: Plot, b: Plot, pad: number): boolean {
  // separating axis test for two rectangles in XZ
  const axes = [a.rot, a.rot + Math.PI / 2, b.rot, b.rot + Math.PI / 2];
  const corners = (p: Plot) => {
    const c = Math.cos(p.rot), s = Math.sin(p.rot);
    const hw = p.w / 2 + pad, hd = p.d / 2 + pad;
    return [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].map(([u, v]) => [p.x + u * c - v * s, p.z + u * s + v * c]);
  };
  const ca = corners(a), cb = corners(b);
  for (const ang of axes) {
    const ax = Math.cos(ang), az = Math.sin(ang);
    let amin = Infinity, amax = -Infinity, bmin = Infinity, bmax = -Infinity;
    for (const [x, z] of ca) { const p = x * ax + z * az; amin = Math.min(amin, p); amax = Math.max(amax, p); }
    for (const [x, z] of cb) { const p = x * ax + z * az; bmin = Math.min(bmin, p); bmax = Math.max(bmax, p); }
    if (amax < bmin || bmax < amin) return false;
  }
  return true;
}

function segDist(x: number, z: number, r: RoadSeg): number {
  const vx = r.bx - r.ax, vz = r.bz - r.az;
  const l2 = vx * vx + vz * vz || 1;
  const t = Math.max(0, Math.min(1, ((x - r.ax) * vx + (z - r.az) * vz) / l2));
  return Math.hypot(x - (r.ax + vx * t), z - (r.az + vz * t));
}

function plotOk(ctx: Ctx, p: Plot, roads: RoadSeg[], minH: number): boolean {
  if (Math.abs(p.x) > AREA_HALF - 120 || Math.abs(p.z) > AREA_HALF - 120) return false;
  for (const a of ctx.avoid) if (Math.hypot(p.x - a.x, p.z - a.z) < a.r + Math.max(p.w, p.d) / 2) return false;
  const c = Math.cos(p.rot), s = Math.sin(p.rot);
  const hw = p.w / 2, hd = p.d / 2;
  let lo = Infinity, hi = -Infinity;
  for (const [u, v] of [[0, 0], [-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]]) {
    const h = ctx.ts.height(p.x + u * c - v * s, p.z + u * s + v * c);
    lo = Math.min(lo, h); hi = Math.max(hi, h);
  }
  if (lo < minH || hi - lo > Math.max(3.5, p.w * 0.35)) return false;
  if (ctx.ts.riverDist(p.x, p.z) < Math.max(p.w, p.d)) return false;
  for (const r of roads) if (segDist(p.x, p.z, r) < r.w / 2 + Math.min(p.w, p.d) / 2 - 0.5) return false;
  for (const q of ctx.plots) if (Math.abs(q.x - p.x) < 60 && Math.abs(q.z - p.z) < 60 && obbOverlap(p, q, 1.2)) return false;
  return true;
}

function makePlot(ctx: Ctx, style: BuildingStyle, x: number, z: number, rot: number, role: PlotRole, sizeMul = 1): Plot {
  const r = ctx.rng;
  const w = r.range(style.width[0], style.width[1]) * sizeMul;
  const d = r.range(style.depth[0], style.depth[1]) * sizeMul;
  const floors = r.int(style.floors[0], style.floors[1]);
  return { id: ctx.nextId++, x, z, rot, w, d, floors, style: style.id, role, seed: hash32(x, z, style.id), base: 0 };
}

function styleFor(ctx: Ctx, role: PlotRole, distFrac: number, tier: SettlementTier): BuildingStyle {
  const ids = ctx.profile.styles.filter((s) => STYLE_BY_ID.has(s));
  const r = ctx.rng;
  if (!ids.length) return STYLE_BY_ID.get('hide_tent')!;
  // big cities: towers in the core
  if (tier === 'metropolis' && distFrac < 0.45) {
    const tall = ctx.era.id === 'nearfuture' ? 'nearfuture_tower' : ctx.era.id === 'farfuture' ? 'far_future_spire' : 'skyscraper';
    if (r.chance(0.8 - distFrac)) return STYLE_BY_ID.get(tall)!;
  }
  if (tier === 'metropolis' || tier === 'city') {
    const apt = ids.find((s) => s.includes('apartment') || s.includes('insula') || s.includes('rowhouse') || s.includes('shophouse') || s.includes('tower'));
    if (apt && r.chance(0.6 - distFrac * 0.3)) return STYLE_BY_ID.get(apt)!;
  }
  if (role === 'workshop' && ids.includes('factory') && r.chance(0.6)) return STYLE_BY_ID.get('factory')!;
  const nonFactory = ids.filter((s) => s !== 'factory');
  const pool = nonFactory.length ? nonFactory : ids;
  // first style is the most common
  const weighted = pool.map((s, i) => [s, i === 0 ? 2.2 : 1] as const);
  return STYLE_BY_ID.get(r.weighted(weighted))!;
}

function addRoad(roads: RoadSeg[], ax: number, az: number, bx: number, bz: number, w: number, main: boolean) {
  const lim = AREA_HALF - 60;
  const cl = (v: number) => Math.max(-lim, Math.min(lim, v));
  roads.push({ ax: cl(ax), az: cl(az), bx: cl(bx), bz: cl(bz), w, main });
}

/** Place buildings along both sides of each road. */
function fillAlongRoads(ctx: Ctx, s: Settlement, roads: RoadSeg[], maxPlots: number, minH: number) {
  const r = ctx.rng;
  for (const road of roads) {
    const len = Math.hypot(road.bx - road.ax, road.bz - road.az);
    const dx = (road.bx - road.ax) / len, dz = (road.bz - road.az) / len;
    const ang = Math.atan2(dz, dx);
    for (const side of [-1, 1]) {
      let t = r.range(4, 12);
      while (t < len - 4 && ctx.plots.length < maxPlots) {
        const cx = road.ax + dx * t, cz = road.az + dz * t;
        const distFrac = Math.hypot(cx - s.x, cz - s.z) / s.radius;
        if (distFrac > 1.05) { t += 12; continue; }
        const role: PlotRole = distFrac < 0.18 && r.chance(0.35) ? 'market' : r.chance(0.12) ? 'workshop' : 'home';
        const st = styleFor(ctx, role, distFrac, s.tier);
        const p = makePlot(ctx, st, 0, 0, ang, role);
        const setback = road.w / 2 + p.d / 2 + r.range(1, st.shape === 'skyscraper' ? 8 : 4);
        p.x = cx + -dz * side * setback;
        p.z = cz + dx * side * setback;
        p.rot = ang + (side > 0 ? 0 : Math.PI);
        if (st.shape === 'round' || st.shape === 'tent' || st.shape === 'dome') p.rot = r.range(0, Math.PI * 2);
        if (plotOk(ctx, p, roads, minH)) {
          p.base = ctx.ts.height(p.x, p.z);
          ctx.plots.push(p);
          t += p.w + r.range(1.5, st.shape === 'skyscraper' ? 14 : 6);
        } else t += 5;
      }
    }
  }
}

export interface SettlementInput {
  tier: SettlementTier;
  cx: number; cz: number;
  profile: WorldProfile;
  era: EraProfile;
  ts: TerrainSampler;
  seed: number;
  avoid: { x: number; z: number; r: number }[];
  baseHeight: number;
  hasCoast: boolean;
  previousStyles: string[] | null;
}

export function layoutSettlement(inp: SettlementInput): Settlement {
  const rng = new Rng(hash32(inp.seed, 'settlement'));
  const ctx: Ctx = { rng, ts: inp.ts, profile: inp.profile, era: inp.era, avoid: inp.avoid, plots: [], nextId: 1 };
  const radius = TIER_RADIUS[inp.tier] * rng.range(0.85, 1.15);
  const tierIdx = TIER_ORDER.indexOf(inp.tier);
  const noun = inp.profile.nouns[inp.tier] ?? inp.tier;
  const s: Settlement = {
    tier: inp.tier, noun, x: inp.cx, z: inp.cz, radius, baseHeight: inp.baseHeight,
    layout: inp.profile.layout, roads: [], plots: [], farms: [], props: [], walls: null, port: null,
    plaza: { x: inp.cx, z: inp.cz, r: Math.max(8, radius * (inp.tier === 'camp' ? 0.25 : 0.09)) },
  };
  const roadType = inp.era.roads;
  const roadW = (main: boolean) => (inp.tier === 'metropolis' ? (main ? 22 : 14) : inp.tier === 'city' ? (main ? 12 : 7) : main ? 7 : 4.5) * (roadType === 'trail' ? 0.5 : 1);
  const angle = rng.range(0, Math.PI);
  const maxPlots = [0, 9, 14, 34, 80, 170, 300][tierIdx];
  const minH = 0.9;
  const roads = s.roads;

  if (inp.tier === 'camp') {
    // tents in a ring around a fire
    const st = styleFor(ctx, 'home', 0.5, inp.tier);
    const n = rng.int(4, 8);
    for (let i = 0; i < n * 2 && ctx.plots.length < n; i++) {
      const a = (i / n) * Math.PI * 2 + rng.range(-0.2, 0.2);
      const rr = radius * rng.range(0.45, 0.85);
      const p = makePlot(ctx, st, inp.cx + Math.cos(a) * rr, inp.cz + Math.sin(a) * rr, a + Math.PI / 2, 'home');
      if (plotOk(ctx, p, roads, minH)) { p.base = inp.ts.height(p.x, p.z); ctx.plots.push(p); }
    }
    s.props.push({ kind: 'campfire', x: inp.cx, z: inp.cz, rot: 0, s: 1 });
    for (let i = 0; i < 4; i++) s.props.push({ kind: rng.pick(['hide_rack', 'log_seat', 'stone_pile', 'drying_rack']), x: inp.cx + rng.range(-radius, radius) * 0.6, z: inp.cz + rng.range(-radius, radius) * 0.6, rot: rng.range(0, 6.28), s: 1 });
  } else {
    const layout = inp.tier === 'hamlet' ? 'organic' : s.layout;
    if (layout === 'grid') {
      const block = inp.tier === 'metropolis' ? 120 : inp.tier === 'city' ? 80 : 60;
      const n = Math.max(1, Math.round(radius / block));
      const ca = Math.cos(angle), sa = Math.sin(angle);
      const P = (u: number, v: number) => [inp.cx + u * ca - v * sa, inp.cz + u * sa + v * ca];
      for (let i = -n; i <= n; i++) {
        const main = i === 0 || i % 3 === 0;
        const [ax, az] = P(i * block, -n * block), [bx, bz] = P(i * block, n * block);
        addRoad(roads, ax, az, bx, bz, roadW(main), main);
        const [cx2, cz2] = P(-n * block, i * block), [dx2, dz2] = P(n * block, i * block);
        addRoad(roads, cx2, cz2, dx2, dz2, roadW(main), main);
      }
    } else if (layout === 'radial') {
      const spokes = rng.int(6, 8);
      for (let i = 0; i < spokes; i++) {
        const a = angle + (i / spokes) * Math.PI * 2;
        addRoad(roads, inp.cx + Math.cos(a) * s.plaza.r, inp.cz + Math.sin(a) * s.plaza.r, inp.cx + Math.cos(a) * radius * 1.1, inp.cz + Math.sin(a) * radius * 1.1, roadW(true), true);
      }
      for (const rf of [0.4, 0.75]) {
        const segs = 18;
        for (let i = 0; i < segs; i++) {
          const a0 = (i / segs) * Math.PI * 2, a1 = ((i + 1) / segs) * Math.PI * 2;
          addRoad(roads, inp.cx + Math.cos(a0) * radius * rf, inp.cz + Math.sin(a0) * radius * rf, inp.cx + Math.cos(a1) * radius * rf, inp.cz + Math.sin(a1) * radius * rf, roadW(false), false);
        }
      }
    } else {
      // organic: a main road through the centre, branches, and a few winding lanes
      const L = radius * 1.25;
      const ca = Math.cos(angle), sa = Math.sin(angle);
      let px = inp.cx - ca * L, pz = inp.cz - sa * L;
      const steps = 6;
      for (let i = 1; i <= steps; i++) {
        const t = -L + (2 * L * i) / steps;
        const bend = rng.range(-0.12, 0.12) * radius;
        const nx = inp.cx + ca * t - sa * bend, nz = inp.cz + sa * t + ca * bend;
        addRoad(roads, px, pz, nx, nz, roadW(true), true);
        px = nx; pz = nz;
      }
      const branches = Math.max(1, Math.round(tierIdx * 1.4));
      for (let b = 0; b < branches; b++) {
        const t = rng.range(-0.7, 0.7) * L;
        const bx = inp.cx + ca * t, bz = inp.cz + sa * t;
        const dir = angle + Math.PI / 2 + rng.range(-0.5, 0.5) + (rng.chance(0.5) ? Math.PI : 0);
        let qx = bx, qz = bz;
        const len = radius * rng.range(0.5, 0.95);
        let a = dir;
        for (let k = 0; k < 3; k++) {
          a += rng.range(-0.35, 0.35);
          const nx = qx + Math.cos(a) * (len / 3), nz = qz + Math.sin(a) * (len / 3);
          addRoad(roads, qx, qz, nx, nz, roadW(false), false);
          qx = nx; qz = nz;
        }
      }
    }
    // remove road pieces that run into water
    for (let i = roads.length - 1; i >= 0; i--) {
      const r = roads[i];
      const mx = (r.ax + r.bx) / 2, mz = (r.az + r.bz) / 2;
      if (inp.ts.height(mx, mz) < 0.3 || inp.ts.height(r.bx, r.bz) < -1) roads.splice(i, 1);
    }

    // civic building on the plaza edge
    const civicStyle = styleFor(ctx, 'civic', 0, inp.tier);
    const civic = makePlot(ctx, civicStyle, inp.cx + Math.cos(angle + 1.2) * (s.plaza.r + 10), inp.cz + Math.sin(angle + 1.2) * (s.plaza.r + 10), angle + 1.2 + Math.PI / 2, 'civic', 1.35);
    civic.floors = Math.min(civicStyle.floors[1] + 1, civic.floors + 1);
    if (plotOk(ctx, civic, roads, minH)) { civic.base = inp.ts.height(civic.x, civic.z); ctx.plots.push(civic); }

    fillAlongRoads(ctx, s, roads, maxPlots, minH);

    // plaza props
    const plazaKinds = inp.era.tech <= 2 ? ['campfire', 'stone_pile'] : inp.era.tech <= 6 ? ['well', 'market_stall', 'market_stall', 'cart'] : inp.era.tech <= 7 ? ['lamp_post', 'market_stall', 'bench', 'cart'] : inp.era.tech <= 8 ? ['bench', 'lamp_post', 'tree_planter', 'car', 'bus_stop'] : ['planter_glow', 'bench', 'holo_kiosk', 'tree_planter'];
    if (inp.era.tech >= 3 && inp.era.tech <= 5 && rng.chance(0.4)) s.props.push({ kind: 'fountain', x: inp.cx, z: inp.cz, rot: 0, s: 1 });
    else s.props.push({ kind: plazaKinds[0], x: inp.cx, z: inp.cz, rot: 0, s: 1 });
    const stalls = Math.min(10, 2 + tierIdx * 2);
    for (let i = 0; i < stalls; i++) {
      const a = rng.range(0, Math.PI * 2), rr = s.plaza.r * rng.range(0.4, 0.95);
      s.props.push({ kind: rng.pick(plazaKinds), x: inp.cx + Math.cos(a) * rr, z: inp.cz + Math.sin(a) * rr, rot: a + Math.PI / 2, s: 1 });
    }
    // street props along roads
    const streetKinds = inp.era.tech >= 8 ? ['car', 'lamp_post', 'tree_planter', 'bench'] : inp.era.tech === 7 ? ['lamp_post', 'cart', 'barrel'] : inp.era.tech >= 3 ? ['barrel', 'crate', 'cart'] : ['stone_pile'];
    for (const road of roads) {
      const len = Math.hypot(road.bx - road.ax, road.bz - road.az);
      const n = Math.floor(len / (inp.era.tech >= 7 ? 28 : 60));
      for (let i = 0; i < n; i++) {
        if (!rng.chance(0.55)) continue;
        const t = rng.next();
        const side = rng.chance(0.5) ? 1 : -1;
        const dx = (road.bx - road.ax) / len, dz = (road.bz - road.az) / len;
        const off = road.w / 2 + 0.8;
        const kind = rng.pick(streetKinds);
        s.props.push({ kind, x: road.ax + dx * len * t - dz * off * side, z: road.az + dz * len * t + dx * off * side, rot: Math.atan2(dz, dx), s: 1, v: rng.int(0, 7) });
      }
    }
    // city walls
    if (inp.profile.walls && tierIdx >= TIER_ORDER.indexOf('town')) {
      s.walls = { r: radius * 1.02, h: inp.tier === 'city' ? 9 : 6, gates: roads.filter((r) => r.main).slice(0, 4).map((r) => Math.atan2((r.az + r.bz) / 2 - inp.cz, (r.ax + r.bx) / 2 - inp.cx)) };
    }
  }

  // farms ring
  const crops = inp.profile.crops.filter((c) => CROP_BY_ID.has(c));
  if (crops.length && inp.era.tech >= 2 && inp.tier !== 'metropolis' && inp.tier !== 'camp') {
    const nFarms = [0, 0, 6, 10, 16, 22, 0][tierIdx];
    const farmAngle = angle;
    for (let i = 0; i < nFarms * 3 && s.farms.length < nFarms; i++) {
      const a = rng.range(0, Math.PI * 2);
      const rr = radius * rng.range(1.15, 2.3) + 30;
      const fx = inp.cx + Math.cos(a) * rr, fz = inp.cz + Math.sin(a) * rr;
      const w = rng.range(30, 70), d = rng.range(25, 60);
      if (Math.abs(fx) > AREA_HALF - 100 || Math.abs(fz) > AREA_HALF - 100) continue;
      const h = inp.ts.height(fx, fz);
      if (h < 1 || inp.ts.slope(fx, fz, 6) < 0.96) continue;
      if (inp.avoid.some((v) => Math.hypot(fx - v.x, fz - v.z) < v.r + 40)) continue;
      if (s.farms.some((f) => Math.hypot(f.x - fx, f.z - fz) < (Math.max(f.w, f.d) + Math.max(w, d)) * 0.55)) continue;
      if (inp.ts.riverDist(fx, fz) < 20) continue;
      s.farms.push({ x: fx, z: fz, w, d, rot: farmAngle + rng.range(-0.2, 0.2), crop: rng.pick(crops), base: h });
    }
    for (const f of s.farms) {
      if (rng.chance(0.35)) s.props.push({ kind: inp.era.tech >= 7 ? 'hay_bale' : 'haystack', x: f.x + f.w * 0.55, z: f.z, rot: f.rot, s: 1 });
      if (rng.chance(0.4)) s.props.push({ kind: 'fence', x: f.x, z: f.z, rot: f.rot, s: f.w, v: Math.round(f.d) });
    }
  }

  // port: find the nearest water edge
  if (inp.hasCoast && tierIdx >= 3) {
    let best: { x: number; z: number; d: number; a: number } | null = null;
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * Math.PI * 2;
      for (let rr = 40; rr < radius * 1.8; rr += 20) {
        const x = inp.cx + Math.cos(a) * rr, z = inp.cz + Math.sin(a) * rr;
        if (inp.ts.height(x, z) < -0.5) {
          if (!best || rr < best.d) best = { x, z, d: rr, a };
          break;
        }
      }
    }
    if (best) {
      s.port = { x: best.x, z: best.z, rot: best.a };
      const boats = inp.profile.boats.length ? inp.profile.boats : ['dugout'];
      for (let i = 0; i < Math.min(6, tierIdx); i++) {
        const off = (i - 2) * 14;
        const px = best.x + Math.cos(best.a) * (8 + (i % 2) * 10) - Math.sin(best.a) * off;
        const pz = best.z + Math.sin(best.a) * (8 + (i % 2) * 10) + Math.cos(best.a) * off;
        s.props.push({ kind: 'boat:' + rng.pick(boats), x: px, z: pz, rot: best.a + Math.PI / 2, s: 1 });
      }
      s.props.push({ kind: inp.era.tech >= 7 ? 'pier_concrete' : 'pier', x: best.x, z: best.z, rot: best.a, s: 1 });
    }
  }

  // ruins of an earlier era on the outskirts
  if (inp.previousStyles && inp.previousStyles.length && tierIdx >= 2 && rng.chance(0.55)) {
    const n = rng.int(3, 7);
    const ra = rng.range(0, Math.PI * 2);
    const rx = inp.cx + Math.cos(ra) * radius * 1.4, rz = inp.cz + Math.sin(ra) * radius * 1.4;
    const ruinStyle = STYLE_BY_ID.get('ruin')!;
    for (let i = 0; i < n * 3 && ctx.plots.filter((p) => p.role === 'ruin').length < n; i++) {
      const p = makePlot(ctx, ruinStyle, rx + rng.range(-40, 40), rz + rng.range(-40, 40), rng.range(0, Math.PI), 'ruin');
      p.ruinOf = rng.pick(inp.previousStyles);
      if (plotOk(ctx, p, roads, minH)) { p.base = inp.ts.height(p.x, p.z); ctx.plots.push(p); }
    }
  }

  // one building under construction in growing places
  const homes = ctx.plots.filter((p) => p.role === 'home');
  if (homes.length > 6 && inp.era.tech >= 3 && rng.chance(0.7)) rng.pick(homes).role = 'construction';

  s.plots = ctx.plots;
  return s;
}
