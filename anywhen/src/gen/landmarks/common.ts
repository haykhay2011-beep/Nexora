// Shared types and helpers for landmark builders.
import type { Rng } from '../../core/rng';
import { MeshKit, mixCol, shade, type Col } from '../meshkit';
import type { LandmarkStage } from '../../data/types';

export type LmState = LandmarkStage['state'];

export type Collider =
  | { k: 'box'; x: number; z: number; hw: number; hd: number; rot: number; y0: number; y1: number }
  | { k: 'cyl'; x: number; z: number; r: number; y0: number; y1: number };

export interface WaterRect { x: number; z: number; w: number; d: number; rot: number; y: number; flow?: number }

export interface LmCtx {
  id: string;
  state: LmState;
  year: number;
  rng: Rng;
  /** terrain height at local (x,z), relative to the landmark base */
  h: (x: number, z: number) => number;
  p: Record<string, unknown>;
  colliders: Collider[];
  waters: WaterRect[];
  mists: { x: number; y: number; z: number; r: number }[];
  /** extra photo-interest points (local), the landmark centre is always added */
  height: number;
}

export type Builder = (k: MeshKit, c: LmCtx) => void;

export const num = (c: LmCtx, key: string, d: number) => (typeof c.p[key] === 'number' ? (c.p[key] as number) : d);
export const str = (c: LmCtx, key: string, d: string) => (typeof c.p[key] === 'string' ? (c.p[key] as string) : d);
export const bool = (c: LmCtx, key: string) => c.p[key] === true;

/** Era-state colour treatment. */
export function tone(c: LmCtx, col: Col): [number, number, number] {
  switch (c.state) {
    case 'weathered': return shade(mixCol(col, '#9a8a72', 0.28), 0.9);
    case 'ruined': return shade(mixCol(col, '#8a8070', 0.4), 0.82);
    case 'construction': return shade(col, 0.97);
    case 'restored': return shade(mixCol(col, '#ffffff', 0.04), 1.0);
    default: return shade(col, 1.02);
  }
}

export const isRuin = (c: LmCtx) => c.state === 'ruined';
export const building = (c: LmCtx) => c.state === 'construction';

export function boxCol(c: LmCtx, x: number, z: number, w: number, d: number, y0: number, y1: number, rot = 0) {
  c.colliders.push({ k: 'box', x, z, hw: w / 2, hd: d / 2, rot, y0, y1 });
}
export function cylCol(c: LmCtx, x: number, z: number, r: number, y0: number, y1: number) {
  c.colliders.push({ k: 'cyl', x, z, r, y0, y1 });
}

/** Wooden scaffolding around a box footprint. */
export function scaffoldBox(k: MeshKit, w: number, d: number, h: number, x = 0, z = 0, step = 3) {
  const col = '#a8885a';
  const nx = Math.max(2, Math.round(w / 4)), nz = Math.max(2, Math.round(d / 4));
  for (let i = 0; i <= nx; i++) for (const sz of [-1, 1]) k.box(0.2, h, 0.2, col, x - w / 2 + (i * w) / nx, 0, z + sz * (d / 2 + 1));
  for (let i = 0; i <= nz; i++) for (const sx of [-1, 1]) k.box(0.2, h, 0.2, col, x + sx * (w / 2 + 1), 0, z - d / 2 + (i * d) / nz);
  for (let y = step; y < h; y += step) {
    k.box(w + 2, 0.15, 0.15, col, x, y, z - d / 2 - 1); k.box(w + 2, 0.15, 0.15, col, x, y, z + d / 2 + 1);
    k.box(0.15, 0.15, d + 2, col, x - w / 2 - 1, y, z); k.box(0.15, 0.15, d + 2, col, x + w / 2 + 1, y, z);
  }
}

export function rubble(k: MeshKit, rng: Rng, col: Col, n: number, r: number, x = 0, z = 0) {
  for (let i = 0; i < n; i++) {
    const a = rng.range(0, Math.PI * 2), d = rng.range(0, r);
    k.box(rng.range(0.6, 1.8), rng.range(0.4, 1.1), rng.range(0.6, 1.6), shade(col, rng.range(0.8, 1)), x + Math.cos(a) * d, 0, z + Math.sin(a) * d, rng.range(0, 3));
  }
}

/** Column with base and capital. */
export function column(k: MeshKit, x: number, z: number, h: number, r: number, col: Col, y = 0, seg = 8) {
  k.cyl(r * 1.25, r * 1.3, h * 0.04, seg, col, x, y, z);
  k.cyl(r * 0.9, r, h * 0.9, seg, col, x, y + h * 0.04, z);
  k.box(r * 2.6, h * 0.06, r * 2.6, col, x, y + h * 0.94, z);
}
