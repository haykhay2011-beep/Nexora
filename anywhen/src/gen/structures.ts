// Builds all static structures of a world: instanced building archetypes, props, city walls and landmarks.
import { Rng, hash32 } from '../core/rng';
import { LANDMARK_BY_ID, STYLE_BY_ID, era as getEra } from '../data';
import { MeshKit, type MeshArrays } from './meshkit';
import { buildBuilding } from './buildings';
import { buildProp } from './props';
import { BUILDERS, type Collider, type WaterRect, type LmCtx } from './landmarks';
import type { TerrainSampler } from './terrain';
import type { WorldPlan, Plot } from './planTypes';

export interface InstGroup { key: string; arrays: MeshArrays; inst: Float32Array; shadow: boolean; kind: 'building' | 'prop' }
export interface StaticMesh { key: string; arrays: MeshArrays; x: number; y: number; z: number; shadow: boolean }
export interface Interest { id: string; name: string; x: number; y: number; z: number; r: number; kind: 'landmark' | 'building' }

export interface StructureResult {
  key: string;
  groups: InstGroup[];
  statics: StaticMesh[];
  colliders: Collider[];
  waters: WaterRect[];
  mists: { x: number; y: number; z: number; r: number }[];
  interest: Interest[];
  doors: { x: number; z: number; rot: number; plot: number }[];
}

const INST = 8; // x,y,z,ry,sx,sy,sz,tint

export function buildStructures(plan: WorldPlan, ts: TerrainSampler): StructureResult {
  const era = getEra(plan.eraId);
  const out: StructureResult = { key: plan.key, groups: [], statics: [], colliders: [], waters: [], mists: [], interest: [], doors: [] };
  const plots: Plot[] = [...(plan.settlement?.plots ?? []), ...plan.outlying];

  // ---- buildings as instanced archetypes
  const variants = new Map<string, { plot: Plot; list: Plot[] }>();
  for (const p of plots) {
    const style = STYLE_BY_ID.get(p.style);
    if (!style) continue;
    const q = style.shape === 'skyscraper' ? 4 : 2;
    const key = [p.style, Math.round(p.w / q) * q, Math.round(p.d / q) * q, p.floors, p.role === 'civic' ? 'c' : '', p.role === 'ruin' ? 'r' + p.ruinOf : '', p.role === 'construction' ? 'k' : ''].join('|');
    let v = variants.get(key);
    if (!v) variants.set(key, (v = { plot: p, list: [] }));
    v.list.push(p);
  }
  for (const [key, v] of variants) {
    const style = STYLE_BY_ID.get(v.plot.style)!;
    const k = new MeshKit();
    const rng = new Rng(hash32(plan.seed, key));
    const vw = v.plot.w, vd = v.plot.d;
    const info = buildBuilding(k, style, vw, vd, v.plot.floors, rng, { role: v.plot.role, ruin: v.plot.role === 'ruin', ruinOf: v.plot.ruinOf, construction: v.plot.role === 'construction', tech: era.tech });
    const inst = new Float32Array(v.list.length * INST);
    v.list.forEach((p, i) => {
      const sx = p.w / vw, sz = p.d / vd;
      inst.set([p.x, p.base, p.z, -p.rot, sx, 1, sz, rng.next()], i * INST);
      out.colliders.push({ k: 'box', x: p.x, z: p.z, hw: p.w / 2, hd: p.d / 2, rot: p.rot, y0: p.base - 3, y1: p.base + Math.min(info.height, style.shape === 'tent' ? 2.5 : info.height * 0.92) });
      // door position (front = local -z)
      out.doors.push({ x: p.x + Math.sin(p.rot) * (p.d / 2 + 0.8), z: p.z - Math.cos(p.rot) * (p.d / 2 + 0.8), rot: p.rot, plot: p.id });
      if (p.role === 'civic') out.interest.push({ id: 'civic', name: 'civic', x: p.x, y: p.base + info.height / 2, z: p.z, r: Math.max(p.w, p.d), kind: 'building' });
    });
    out.groups.push({ key: 'b:' + key, arrays: k.toArrays(), inst, shadow: true, kind: 'building' });
  }

  // ---- props
  const propGroups = new Map<string, number[]>();
  const props = plan.settlement?.props ?? [];
  for (const pr of props) {
    const v = pr.kind === 'car' || pr.kind === 'market_stall' ? (pr.v ?? 0) % 8 : 0;
    const key = pr.kind + '#' + v;
    let arr = propGroups.get(key);
    if (!arr) propGroups.set(key, (arr = []));
    const y = pr.kind.startsWith('boat:') || pr.kind.startsWith('pier') ? 0 : ts.height(pr.x, pr.z);
    const sx = pr.kind === 'fence' ? pr.s : 1, sz = pr.kind === 'fence' ? (pr.v ?? 1) : 1;
    arr.push(pr.x, y, pr.z, -pr.rot, sx, 1, sz, 0.5);
  }
  for (const [key, arr] of propGroups) {
    const [kind, vs] = key.split('#');
    const k = new MeshKit();
    const info = buildProp(k, kind, Number(vs), era.tech);
    out.groups.push({ key: 'p:' + key, arrays: k.toArrays(), inst: new Float32Array(arr), shadow: info.h > 1.5, kind: 'prop' });
    if (kind !== 'fence' && !kind.startsWith('boat') && info.r > 0.4) for (let i = 0; i < arr.length; i += INST) out.colliders.push({ k: 'cyl', x: arr[i], z: arr[i + 2], r: info.r * 0.8, y0: arr[i + 1] - 1, y1: arr[i + 1] + info.h });
    if (kind.startsWith('pier')) for (let i = 0; i < arr.length; i += INST) {
      const rot = -arr[i + 3];
      out.colliders.push({ k: 'box', x: arr[i] + Math.cos(rot) * 11, z: arr[i + 2] + Math.sin(rot) * 11, hw: 13, hd: 2.2, rot, y0: -3, y1: kind === 'pier' ? 0.9 : 1 });
    }
  }

  // ---- city walls
  const s = plan.settlement;
  if (s && s.walls) {
    const k = new MeshKit();
    const col = era.tech <= 4 ? '#b8a07a' : '#9a948a';
    const segs = Math.max(24, Math.round((s.walls.r * Math.PI * 2) / 14));
    for (let i = 0; i < segs; i++) {
      const a0 = (i / segs) * Math.PI * 2, a1 = ((i + 1) / segs) * Math.PI * 2, am = (a0 + a1) / 2;
      if (s.walls.gates.some((g) => Math.abs(Math.atan2(Math.sin(am - g), Math.cos(am - g))) < 10 / s.walls!.r)) {
        // gate towers
        continue;
      }
      const x = s.x + Math.cos(am) * s.walls.r, z = s.z + Math.sin(am) * s.walls.r;
      const h = ts.height(x, z);
      if (h < 0.3) continue;
      const len = (s.walls.r * Math.PI * 2) / segs + 0.5;
      const ang = am + Math.PI / 2;
      k.boxC(len, s.walls.h + 3, 3, col, { x: x - s.x, y: h - s.baseHeight + (s.walls.h - 3) / 2, z: z - s.z, ry: -ang });
      for (let m = 0; m < 3; m++) k.boxC(1, 1, 3.2, col, { x: x - s.x + Math.cos(ang) * (m - 1) * len * 0.33, y: h - s.baseHeight + s.walls.h + 0.5, z: z - s.z + Math.sin(ang) * (m - 1) * len * 0.33, ry: -ang });
      if (i % 6 === 0) { k.box(6, s.walls.h + 4, 6, col, x - s.x, h - s.baseHeight - 3, z - s.z, -ang); out.colliders.push({ k: 'cyl', x, z, r: 3.5, y0: h - 3, y1: h + s.walls.h + 1 }); }
      out.colliders.push({ k: 'box', x, z, hw: len / 2, hd: 1.5, rot: ang, y0: h - 3, y1: h + s.walls.h });
    }
    for (const g of s.walls.gates) {
      for (const side of [-1, 1]) {
        const a = g + (side * 9) / s.walls.r;
        const x = s.x + Math.cos(a) * s.walls.r, z = s.z + Math.sin(a) * s.walls.r;
        const h = ts.height(x, z);
        k.box(6, s.walls.h + 5, 6, col, x - s.x, h - s.baseHeight - 3, z - s.z, -a);
        out.colliders.push({ k: 'cyl', x, z, r: 3.5, y0: h - 3, y1: h + s.walls.h + 2 });
      }
    }
    out.statics.push({ key: 'walls', arrays: k.toArrays(), x: s.x, y: s.baseHeight, z: s.z, shadow: true });
  }

  // ---- landmarks
  for (const pl of plan.landmarks) {
    const def = LANDMARK_BY_ID.get(pl.id);
    if (!def) continue;
    const builder = BUILDERS[def.builder];
    if (!builder) continue;
    const k = new MeshKit();
    const ctx: LmCtx = {
      id: pl.id, state: pl.state, year: plan.year, rng: new Rng(hash32(plan.seed, pl.id)),
      h: (x, z) => ts.height(pl.x + x, pl.z + z) - pl.base, p: def.params, colliders: [], waters: [], mists: [], height: 20,
    };
    try {
      builder(k, ctx);
    } catch (e) {
      // a broken builder must never break world generation
      console.warn('landmark builder failed', pl.id, e);
      continue;
    }
    if (k.vertexCount > 0) out.statics.push({ key: 'lm:' + pl.id, arrays: k.toArrays(), x: pl.x, y: pl.base, z: pl.z, shadow: true });
    for (const col of ctx.colliders) {
      if (col.k === 'box') out.colliders.push({ ...col, x: col.x + pl.x, z: col.z + pl.z, y0: col.y0 + pl.base, y1: col.y1 + pl.base });
      else out.colliders.push({ ...col, x: col.x + pl.x, z: col.z + pl.z, y0: col.y0 + pl.base, y1: col.y1 + pl.base });
    }
    for (const w of ctx.waters) out.waters.push({ ...w, x: w.x + pl.x, z: w.z + pl.z, y: w.y + pl.base });
    for (const m of ctx.mists) out.mists.push({ x: m.x + pl.x, y: m.y + pl.base, z: m.z + pl.z, r: m.r });
    out.interest.push({ id: pl.id, name: pl.name, x: pl.x, y: pl.base + Math.max(4, ctx.height * 0.5), z: pl.z, r: Math.max(10, ctx.height * 0.6), kind: 'landmark' });
  }
  return out;
}
