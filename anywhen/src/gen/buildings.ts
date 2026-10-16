// Parametric low-poly buildings for every style in styles.json.
import { Rng } from '../core/rng';
import { STYLE_BY_ID } from '../data';
import type { BuildingStyle } from '../data/types';
import { MeshKit, shade, type Col } from './meshkit';

export interface BuildOpts { role: string; ruin?: boolean; ruinOf?: string; construction?: boolean; tech: number }

export interface BuiltInfo { height: number }

const FLOOR = 3.1;

/** Build a building centred at the origin, base at y=0, front facing -z. Returns its height. */
export function buildBuilding(k: MeshKit, style: BuildingStyle, w: number, d: number, floors: number, rng: Rng, o: BuildOpts): BuiltInfo {
  const f = new Set(style.features);
  let wall: Col = rng.pick(style.walls);
  let roof: Col = rng.pick(style.roofs);
  const trim: Col = style.trim;
  const win: Col = style.window;
  if (o.ruin) {
    const src = STYLE_BY_ID.get(o.ruinOf ?? '') ?? style;
    wall = shade(rng.pick(src.walls), 0.78);
    roof = shade(rng.pick(src.roofs), 0.7);
    return ruin(k, src, w, d, rng, wall);
  }
  const floorH = style.shape === 'skyscraper' ? 3.6 : style.material === 'concrete' ? 3.2 : FLOOR;
  let H = floors * floorH;
  if (o.construction) H = Math.max(floorH, H * 0.55);
  // foundation hides gaps on slopes
  k.box(w + 0.2, 3, d + 0.2, shade(wall, 0.7), 0, -3, 0);
  let top = H;
  switch (style.shape) {
    case 'tent': top = tent(k, style, w, d, wall, roof, trim, f); break;
    case 'dome': top = domeHouse(k, style, w, wall, roof, trim, f); break;
    case 'round': top = roundHouse(k, style, w, wall, roof, trim, f, floors * floorH); break;
    case 'skyscraper': top = skyscraper(k, style, w, d, H, wall, roof, trim, win, f, rng); break;
    case 'spire': top = spire(k, w, H, wall, roof, trim, rng); break;
    case 'factory': top = factory(k, w, d, H, wall, roof, trim, win, rng); break;
    case 'courtyard': top = courtyard(k, style, w, d, H, wall, roof, trim, win, f); break;
    case 'terrace': top = terrace(k, w, d, floors, wall, trim, win, f); break;
    default: {
      let y0 = 0;
      if (style.shape === 'stilt' || f.has('stilts')) {
        const sh = 2.2;
        for (const sx of [-1, 1]) for (const sz of [-1, 0, 1]) k.cyl(0.14, 0.16, sh, 5, trim, sx * (w / 2 - 0.3), 0, sz * (d / 2 - 0.3));
        k.box(w + 0.6, 0.25, d + 0.6, shade(wall, 0.85), 0, sh - 0.1, 0);
        if (f.has('ladder')) for (let i = 0; i < 5; i++) k.box(0.9, 0.08, 0.08, trim, 0, i * 0.45, -d / 2 - 0.8);
        y0 = sh;
      }
      if (f.has('platform')) { k.box(w + 1.6, 0.6, d + 1.6, shade(trim, 1.4), 0, 0, 0); y0 = Math.max(y0, 0.6); }
      top = boxHouse(k, style, w, d, H, y0, wall, roof, trim, win, f, rng, o);
    }
  }
  if (o.construction) scaffold(k, w, d, H, rng);
  return { height: top };
}

function windowsOn(k: MeshKit, w: number, d: number, H: number, y0: number, floorH: number, win: Col, glow: number, small: boolean, sides: boolean, grid: boolean) {
  const floors = Math.max(1, Math.round(H / floorH));
  const ww = small ? 0.5 : grid ? 1.3 : 0.9, wh = small ? 0.5 : grid ? 1.6 : 1.2;
  k.curGlow = glow;
  for (let fl = 0; fl < floors; fl++) {
    const y = y0 + fl * floorH + floorH * 0.45;
    const nW = Math.max(1, Math.floor(w / (grid ? 2.2 : 3)));
    for (let i = 0; i < nW; i++) {
      const x = -w / 2 + (i + 0.5) * (w / nW);
      if (fl === 0 && Math.abs(x) < 1.2 && !grid) continue;
      k.box(ww, wh, 0.12, win, x, y, -d / 2 - 0.03);
      k.box(ww, wh, 0.12, win, x, y, d / 2 + 0.03);
    }
    if (sides) {
      const nD = Math.max(1, Math.floor(d / (grid ? 2.2 : 3.2)));
      for (let i = 0; i < nD; i++) {
        const z = -d / 2 + (i + 0.5) * (d / nD);
        k.box(0.12, wh, ww, win, -w / 2 - 0.03, y, z);
        k.box(0.12, wh, ww, win, w / 2 + 0.03, y, z);
      }
    }
  }
  k.curGlow = 0;
}

function roofOn(k: MeshKit, style: BuildingStyle, w: number, d: number, y: number, roof: Col, trim: Col, f: Set<string>): number {
  const steep = f.has('steep') ? 1.6 : 1;
  switch (style.roof) {
    case 'flat': {
      k.box(w + 0.1, 0.3, d + 0.1, roof, 0, y, 0);
      if (f.has('parapet')) {
        k.box(w + 0.3, 0.7, 0.3, shade(roof, 0.95), 0, y, -d / 2);
        k.box(w + 0.3, 0.7, 0.3, shade(roof, 0.95), 0, y, d / 2);
        k.box(0.3, 0.7, d, shade(roof, 0.95), -w / 2, y, 0);
        k.box(0.3, 0.7, d, shade(roof, 0.95), w / 2, y, 0);
      }
      if (f.has('pinnacles')) for (let i = 0; i < 5; i++) k.cone(0.45, 1.6, 5, shade(roof, 1.05), -w / 2 + (i + 0.5) * (w / 5), y + 0.3, -d / 2);
      if (f.has('rooftop_units')) { k.box(2, 1.4, 2, '#9a9a9a', w * 0.2, y + 0.3, 0); k.box(1.2, 2.4, 1.2, '#8a8a8a', -w * 0.25, y + 0.3, d * 0.2); }
      if (f.has('roof_ladder')) { k.box(0.1, 2.2, 0.1, trim, w * 0.3, y, -d * 0.1); k.box(0.1, 2.2, 0.1, trim, w * 0.3 + 0.5, y, -d * 0.1); }
      return y + 0.7;
    }
    case 'gable': {
      const rh = Math.min(w, 8) * 0.38 * steep;
      k.gable(w, rh, d, roof, 0, y, 0, 0, 0.5);
      if (f.has('chimney')) k.box(0.8, rh + 1.2, 0.8, shade(trim, 0.6), w * 0.25, y, d * 0.25);
      if (f.has('pediment')) k.gable(w + 0.4, rh * 0.9, 0.3, shade(trim, 1.1), 0, y, -d / 2 - 0.35, 0, 0);
      return y + rh;
    }
    case 'hip': {
      const rh = Math.min(w, d) * 0.35 * steep;
      const ov = f.has('eaves_wide') ? 1.2 : 0.5;
      k.pyramid(w + ov * 2, d + ov * 2, rh, roof, 0, y, 0, 0, Math.max(0, w - d) * 0.6, Math.max(0, d - w) * 0.6);
      if (f.has('chimney')) k.box(0.8, rh + 1, 0.8, shade(trim, 0.6), w * 0.25, y, d * 0.2);
      return y + rh;
    }
    case 'curved': {
      // east Asian roof: wide flared lower hip + ridge
      const rh = Math.min(w, d) * 0.32;
      k.pyramid(w + 2.6, d + 2.6, rh * 0.35, shade(roof, 0.9), 0, y - 0.25, 0, 0, w + 1.2, d + 1.2);
      k.pyramid(w + 1.2, d + 1.2, rh, roof, 0, y + rh * 0.3, 0, 0, Math.max(0.6, w - d + 0.6), 0.5);
      k.box(Math.max(0.6, w - d + 0.6) + 0.6, 0.35, 0.5, shade(roof, 0.75), 0, y + rh * 1.3, 0);
      for (const sx of [-1, 1]) k.cone(0.18, 0.7, 4, shade(roof, 0.7), sx * (w / 2 + 1.3), y - 0.1, -d / 2 - 1.3, { rz: sx * 0.6 });
      return y + rh * 1.6;
    }
    case 'dome': {
      const r = Math.min(w, d) * 0.42;
      k.cyl(r * 1.02, r * 1.05, 0.5, 10, shade(roof, 0.9), 0, y, 0);
      k.dome(r, 10, 5, roof, 0, y + 0.4, 0);
      return y + r + 0.4;
    }
    case 'cone':
    case 'thatch_cone': {
      const r = Math.max(w, d) * 0.62;
      const rh = r * (style.roof === 'thatch_cone' ? 1.0 : 0.6) * (f.has('tall_roof') ? 1.5 : 1);
      k.cone(r, rh, 9, roof, 0, y, 0);
      if (style.roof === 'thatch_cone') k.cone(r * 1.02, rh * 0.25, 9, shade(roof, 0.85), 0, y - 0.05, 0);
      return y + rh;
    }
    case 'vault': {
      const r = w / 2 + 0.3;
      k.cyl(r, r, d + 0.6, 10, roof, 0, y, 0, { rx: Math.PI / 2, y: y, sz: r, sx: r, sy: d + 0.6 });
      return y + r;
    }
    case 'sawtooth': {
      const n = Math.max(2, Math.round(d / 6));
      for (let i = 0; i < n; i++) {
        const z = -d / 2 + (i + 0.5) * (d / n);
        k.tris([-w / 2, 0, -d / n / 2, w / 2, 0, -d / n / 2, w / 2, 3, d / n / 2, -w / 2, 0, -d / n / 2, w / 2, 3, d / n / 2, -w / 2, 3, d / n / 2], roof, { y, z });
        k.box(w, 3, 0.15, '#9ab0c0', 0, y, z + d / n / 2);
      }
      return y + 3;
    }
    case 'pyramid': {
      const rh = Math.min(w, d) * 0.5;
      k.pyramid(w + 0.6, d + 0.6, rh, roof, 0, y, 0);
      return y + rh;
    }
    case 'garden': {
      k.box(w + 0.2, 0.4, d + 0.2, '#6a5a3a', 0, y, 0);
      k.box(w - 0.4, 0.3, d - 0.4, roof, 0, y + 0.4, 0);
      for (let i = 0; i < 3; i++) k.blob(0.9, '#4f8a3a', (i - 1) * w * 0.28, y + 1.5, 0, { sy: 1.1 });
      return y + 2.2;
    }
    default: return y;
  }
}

function boxHouse(k: MeshKit, style: BuildingStyle, w: number, d: number, H: number, y0: number, wall: Col, roof: Col, trim: Col, win: Col, f: Set<string>, rng: Rng, o: BuildOpts): number {
  const floorH = style.material === 'concrete' ? 3.2 : FLOOR;
  if (f.has('open') || f.has('posts')) {
    // open-sided shelter: posts + roof
    const ph = Math.min(H, 2.6);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.cyl(0.13, 0.15, ph, 5, trim, sx * (w / 2 - 0.2), y0, sz * (d / 2 - 0.2));
    if (f.has('rugs')) k.box(w * 0.8, 0.05, d * 0.7, '#a83a2a', 0, y0, 0);
    if (style.material === 'wool') { k.pyramid(w + 0.4, d + 0.4, 1.6, roof, 0, y0 + ph - 0.6, 0, 0, w * 0.1, d * 0.9); return y0 + ph + 1; }
    return roofOn(k, style, w, d, y0 + ph, roof, trim, f);
  }
  const jetty = f.has('jetty') && H > FLOOR * 1.5 ? 0.5 : 0;
  if (jetty) {
    k.box(w, FLOOR, d, wall, 0, y0, 0);
    k.box(w + jetty * 2, H - FLOOR, d + jetty * 2, wall, 0, y0 + FLOOR, 0);
  } else k.box(w, H, d, wall, 0, y0, 0);
  const W = w + jetty * 2, D = d + jetty * 2;
  if (f.has('logs')) for (let y = 0.3; y < H; y += 0.55) { k.box(w + 0.25, 0.22, 0.12, shade(wall, 0.8), 0, y0 + y, -d / 2 - 0.05); k.box(w + 0.25, 0.22, 0.12, shade(wall, 0.8), 0, y0 + y, d / 2 + 0.05); }
  if (f.has('beams')) {
    for (let x = -W / 2; x <= W / 2 + 0.01; x += W / Math.max(2, Math.round(W / 1.6))) { k.box(0.16, H, 0.1, trim, x, y0, -D / 2 - 0.04); k.box(0.16, H, 0.1, trim, x, y0, D / 2 + 0.04); }
    for (let fl = 1; fl <= Math.round(H / FLOOR); fl++) { k.box(W + 0.05, 0.18, 0.1, trim, 0, y0 + fl * FLOOR - 0.2, -D / 2 - 0.05); k.box(W + 0.05, 0.18, 0.1, trim, 0, y0 + fl * FLOOR - 0.2, D / 2 + 0.05); }
    k.box(0.1, 1.8, W * 0.9, trim, -W / 2 - 0.04, y0 + FLOOR + 0.4, 0, Math.PI / 2 * 0, { rx: 0.7, sz: 1 });
  }
  if (f.has('painted_band')) k.box(w + 0.05, 0.5, d + 0.05, trim, 0, y0 + H * 0.35, 0);
  if (f.has('fitted_stone')) for (let y = 0.6; y < H; y += 0.7) k.box(w + 0.04, 0.06, d + 0.04, shade(wall, 0.85), 0, y0 + y, 0);
  if (f.has('red_posts')) for (let i = 0; i <= 4; i++) k.cyl(0.18, 0.2, H, 6, trim, -w / 2 + (i * w) / 4, y0, -d / 2 - 0.6);
  if (f.has('engawa') || f.has('veranda')) k.box(w + 1.6, 0.3, 1.4, shade(trim, 1.3), 0, y0 + 0.2, -d / 2 - 0.7);
  if (f.has('porch')) { k.box(w * 0.6, 0.2, 2, shade(trim, 0.9), 0, y0, -d / 2 - 1); for (const sx of [-1, 1]) k.cyl(0.1, 0.1, FLOOR * 0.9, 5, trim, sx * w * 0.28, y0, -d / 2 - 1.8); }
  if (f.has('columns')) {
    const n = Math.max(4, Math.round(w / 2));
    for (let i = 0; i < n; i++) k.cyl(0.32, 0.36, H, 8, trim, -w / 2 + 0.5 + (i * (w - 1)) / (n - 1), y0, -d / 2 - 1.2);
    k.box(w + 0.4, 0.5, 2.6, trim, 0, y0 + H - 0.5, -d / 2 - 1.1);
  }
  if (f.has('steps')) for (let i = 0; i < 3; i++) k.box(w * 0.7 - i * 0.4, 0.25, 0.6, shade(trim, 1.05), 0, y0 + i * 0.22 - 0.5, -d / 2 - 2.3 + i * 0.4);
  if (f.has('torons')) for (let y = 1.5; y < H; y += 1.4) for (let i = 0; i < Math.round(w / 1.6); i++) k.box(0.12, 0.12, 0.9, '#6b4a2e', -w / 2 + 0.8 + i * 1.6, y0 + y, -d / 2 - 0.3);
  if (f.has('vigas')) for (let i = 0; i < Math.round(w / 1.2); i++) k.box(0.18, 0.18, 0.8, '#6b4a2e', -w / 2 + 0.6 + i * 1.2, y0 + H - 0.5, -d / 2 - 0.3);
  if (f.has('shopfront') || f.has('arcade')) {
    const awn = rng.pick(['#c84a3a', '#3a7aa8', '#e8b83a', '#4a8a5a', '#e8e0d0']);
    k.box(w * 0.9, 0.12, 1.4, awn, 0, y0 + 2.6, -d / 2 - 0.65, 0, { rx: -0.15 });
    k.curGlow = style.lit * 0.6;
    k.box(w * 0.7, 1.8, 0.1, '#e8d8a8', 0, y0 + 0.4, -d / 2 - 0.05);
    k.curGlow = 0;
  }
  if (f.has('balcony') || f.has('balconies')) for (let fl = 1; fl < Math.round(H / floorH); fl++) k.box(w * (f.has('balconies') ? 0.9 : 0.4), 0.15, 1, shade(trim, 0.9), 0, y0 + fl * floorH, -d / 2 - 0.5);
  if (f.has('jharokha')) for (let fl = 1; fl < Math.round(H / FLOOR); fl++) { k.box(2, 1.6, 1, shade(wall, 1.08), 0, y0 + fl * FLOOR + 0.3, -d / 2 - 0.5); k.dome(0.9, 6, 3, shade(wall, 1.1), 0, y0 + fl * FLOOR + 1.9, -d / 2 - 0.5); }
  if (f.has('lattice')) for (let i = 0; i < 3; i++) k.box(w * 0.25, 1.3, 0.08, shade(wall, 0.6), (i - 1) * w * 0.3, y0 + 0.9, -d / 2 - 0.06);
  if (f.has('garage')) k.box(2.8, 2.2, 0.1, '#d8d8d8', w * 0.28, y0, -d / 2 - 0.05);
  if (f.has('carved_trim')) k.box(w + 0.3, 0.25, 0.15, '#e8dcc2', 0, y0 + H - 0.3, -d / 2 - 0.08);
  if (f.has('shutters')) for (let i = 0; i < Math.floor(w / 3); i++) for (const sx of [-0.7, 0.7]) k.box(0.4, 1.2, 0.08, trim, -w / 2 + (i + 0.5) * (w / Math.floor(w / 3)) + sx, y0 + FLOOR * 0.45 + (H > FLOOR * 1.5 ? FLOOR : 0), -d / 2 - 0.08);

  // windows + door
  const lit = style.lit;
  if (f.has('windows') || f.has('windows_grid') || f.has('small_windows')) windowsOn(k, W, D, H, y0, floorH, win, lit, f.has('small_windows'), !f.has('row'), f.has('windows_grid'));
  if (f.has('door') || f.has('trapezoid_door') || f.has('windows')) {
    k.curGlow = lit * 0.5;
    if (f.has('trapezoid_door')) k.pyramid(1.2, 0.12, 2.1, '#2a1f14', 0, y0, -d / 2 - 0.04, 0, 0.7, 0.12);
    else k.box(1.1, 2.1, 0.14, style.material === 'glass' ? win : '#3a2a1e', 0, y0, -D / 2 - 0.04);
    k.curGlow = 0;
  }
  if (f.has('lawn')) { k.box(w + 6, 0.06, 5, '#6a9a4a', 0, 0, -d / 2 - 2.6); k.box(0.1, 0.9, 0.1, '#e8e8e8', -w / 2 - 2.5, 0, -d / 2 - 5); }
  let top = roofOn(k, style, W, D, y0 + H, roof, trim, f);
  if (o.role === 'civic' && o.tech >= 3 && o.tech <= 7 && style.roof !== 'dome' && rng.chance(0.5)) {
    // a little tower / belfry on civic buildings
    k.box(2.6, 4, 2.6, wall, w * 0.3, top - 1, 0);
    k.pyramid(3, 3, 2.5, roof, w * 0.3, top + 3, 0);
    top += 5.5;
  }
  return top;
}

function tent(k: MeshKit, style: BuildingStyle, w: number, d: number, wall: Col, roof: Col, trim: Col, f: Set<string>): number {
  if (style.roof === 'cone') {
    const h = w * 0.95;
    k.cone(w / 2, h, 8, wall, 0, 0, 0);
    for (let i = 0; i < 4; i++) k.cyl(0.04, 0.05, h * 0.35, 4, trim, Math.cos(i * 1.6) * 0.25, h * 0.85, Math.sin(i * 1.6) * 0.25, { rz: Math.cos(i * 1.6) * 0.3, rx: Math.sin(i * 1.6) * 0.3 });
    k.box(0.9, 1.3, 0.1, '#2a1f14', 0, 0, -w * 0.3);
    return h * 1.15;
  }
  if (style.material === 'wool') {
    for (const sx of [-1, 1]) for (const sz of [-1, 0, 1]) k.cyl(0.06, 0.06, 1.9, 4, trim, sx * w * 0.42, 0, sz * d * 0.42);
    k.pyramid(w + 0.5, d + 0.5, 1.2, wall, 0, 1.4, 0, 0, w * 0.15, d * 0.95);
    k.box(w * 0.9, 1.4, 0.06, roof, 0, 0, d / 2);
    if (f.has('rugs')) k.box(w * 0.7, 0.04, d * 0.7, '#a83a2a', 0, 0.02, 0);
    return 2.7;
  }
  // lean-to / bark shelter
  k.tris([-w / 2, 0, -d / 2, w / 2, 0, -d / 2, w / 2, 2.2, d / 2, -w / 2, 0, -d / 2, w / 2, 2.2, d / 2, -w / 2, 2.2, d / 2], roof);
  k.cyl(0.07, 0.08, 2.2, 4, trim, -w / 2, 0, d / 2); k.cyl(0.07, 0.08, 2.2, 4, trim, w / 2, 0, d / 2);
  return 2.3;
}

function domeHouse(k: MeshKit, style: BuildingStyle, w: number, wall: Col, roof: Col, trim: Col, f: Set<string>): number {
  const r = w / 2;
  if (style.material === 'bioglass') {
    k.cyl(r, r, 0.6, 16, trim, 0, 0, 0);
    if (f.has('inner_garden')) { k.blob(r * 0.35, '#4f9a5a', 0, r * 0.3, 0); k.blob(r * 0.25, '#7ac87a', r * 0.35, r * 0.2, r * 0.2); }
    k.curGlow = 0.35;
    k.dome(r, 14, 6, roof, 0, 0.5, 0, { sy: 0.85 });
    k.curGlow = 1;
    if (f.has('glow_ring')) k.torus(r * 1.01, 0.18, 4, 24, style.trim, { y: 0.7, rx: Math.PI / 2 });
    k.curGlow = 0;
    return r * 0.85 + 0.5;
  }
  k.dome(r, 9, 5, wall, 0, 0, 0, { sy: 0.8 });
  if (f.has('tunnel')) k.cyl(0.8, 0.8, 1.8, 6, wall, 0, 0.7, -r, { rx: Math.PI / 2, sy: 1.8, sx: 0.8, sz: 0.8 });
  if (f.has('blocks')) for (let i = 1; i < 4; i++) k.torus(r * Math.cos(i * 0.38), 0.03, 3, 18, shade(wall, 0.9), { y: r * 0.8 * Math.sin(i * 0.38), rx: Math.PI / 2 });
  if (f.has('bones')) for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; k.cyl(0.12, 0.16, r * 0.9, 4, roof, Math.cos(a) * r * 0.85, 0, Math.sin(a) * r * 0.85, { rz: Math.cos(a) * 0.5, rx: -Math.sin(a) * 0.5 }); }
  k.box(1, 1.3, 0.2, '#2a1f14', 0, 0, -r * 0.95);
  void roof; void trim;
  return r * 0.8;
}

function roundHouse(k: MeshKit, style: BuildingStyle, w: number, wall: Col, roof: Col, trim: Col, f: Set<string>, H: number): number {
  const r = w / 2;
  const wh = f.has('sunken') ? 1.0 : Math.min(H, 2.4);
  k.cyl(r, r, wh, 10, wall, 0, 0, 0);
  if (f.has('painted_band')) k.cyl(r + 0.03, r + 0.03, 0.4, 10, trim, 0, wh * 0.4, 0);
  if (f.has('bands')) { k.cyl(r + 0.03, r + 0.03, 0.15, 10, trim, 0, wh * 0.3, 0); k.cyl(r + 0.03, r + 0.03, 0.15, 10, trim, 0, wh * 0.75, 0); }
  k.box(1, 1.8, 0.3, '#2a1f14', 0, 0, -r);
  const top = roofOn(k, style, w, w, wh, roof, trim, f);
  if (f.has('crown')) k.cyl(0.5, 0.5, 0.2, 8, trim, 0, top - 0.1, 0);
  return top;
}

function skyscraper(k: MeshKit, style: BuildingStyle, w: number, d: number, H: number, wall: Col, roof: Col, trim: Col, win: Col, f: Set<string>, rng: Rng): number {
  let y = 0, cw = w, cd = d;
  const tiers = f.has('setbacks') ? rng.int(1, 3) : 1;
  const parts = H / tiers;
  for (let t = 0; t < tiers; t++) {
    const h = t === tiers - 1 ? H - y : parts * rng.range(0.8, 1.1);
    k.box(cw, h, cd, wall, 0, y, 0);
    // window bands (lit at night)
    k.curGlow = style.lit * 0.75;
    for (let yy = y + 2; yy < y + h - 1; yy += 3.6) {
      k.box(cw + 0.06, 1.5, cd * 0.92, win, 0, yy, 0);
      k.box(cw * 0.92, 1.5, cd + 0.06, win, 0, yy, 0);
    }
    k.curGlow = 0;
    if (f.has('terraces') && t < tiers) for (let i = 0; i < 3; i++) k.blob(1.2, '#5a9a4a', (i - 1) * cw * 0.3, y + h + 0.8, cd * 0.3);
    y += h;
    cw *= 0.72; cd *= 0.72;
  }
  k.box(cw / 0.72 + 0.4, 1, cd / 0.72 + 0.4, trim, 0, y, 0);
  if (f.has('solar')) k.box(cw / 0.72 * 0.8, 0.2, cd / 0.72 * 0.8, '#2a3a5a', 0, y + 1, 0, 0, { rx: 0.2 });
  if (f.has('trees_on_roof')) for (let i = 0; i < 4; i++) k.blob(1.5, '#4f8a3a', (i % 2 - 0.5) * cw * 0.6, y + 2.2, (Math.floor(i / 2) - 0.5) * cd * 0.6);
  if (f.has('wind_fins')) for (const sx of [-1, 1]) k.box(0.4, H * 0.5, 3, trim, sx * (w / 2 + 0.2), H * 0.2, 0);
  if (f.has('crown') && rng.chance(0.5)) { k.pyramid(cw / 0.72, cd / 0.72, cw * 0.8, roof, 0, y + 1, 0); y += cw * 0.8; }
  if (f.has('antenna')) { k.cyl(0.25, 0.4, 14, 4, '#c8c8c8', 0, y + 1, 0); k.curGlow = 1; k.sphere(0.5, 4, 3, '#ff3a2a', 0, y + 15, 0); k.curGlow = 0; y += 15; }
  return y + 1;
}

function spire(k: MeshKit, w: number, H: number, wall: Col, roof: Col, trim: Col, rng: Rng): number {
  const r = w / 2;
  const segs = 5;
  let y = 0;
  for (let i = 0; i < segs; i++) {
    const h = H / segs;
    const r0 = r * (1 - i / (segs + 1)), r1 = r * (1 - (i + 1) / (segs + 1));
    k.cyl(r1, r0, h, 12, wall, 0, y, 0);
    k.curGlow = 1;
    k.torus(r1 * 1.05 + 0.2, 0.15, 4, 20, trim, { y: y + h, rx: Math.PI / 2 });
    k.curGlow = 0.6;
    k.cyl(r0 * 1.01, r0 * 1.01, h * 0.25, 12, roof, 0, y + h * 0.4, 0);
    k.curGlow = 0;
    y += h;
  }
  // floating garden discs
  for (let i = 0; i < 2; i++) {
    const a = rng.range(0, 6.28), yy = H * rng.range(0.3, 0.8);
    k.cyl(r * 0.5, r * 0.4, 0.6, 10, '#e8f0ff', Math.cos(a) * r * 1.8, yy, Math.sin(a) * r * 1.8);
    k.blob(r * 0.35, '#5aa86a', Math.cos(a) * r * 1.8, yy + r * 0.25, Math.sin(a) * r * 1.8, { sy: 0.7 });
  }
  k.cone(r * 0.15, H * 0.15, 6, wall, 0, y, 0);
  return y + H * 0.15;
}

function factory(k: MeshKit, w: number, d: number, H: number, wall: Col, roof: Col, trim: Col, win: Col, rng: Rng): number {
  k.box(w, H, d, wall, 0, 0, 0);
  windowsOn(k, w, d, H, 0, 4, win, 0.4, false, true, false);
  k.box(w * 0.3, 3, 0.15, '#4a3a2a', 0, 0, -d / 2 - 0.05);
  const n = Math.max(2, Math.round(d / 6));
  for (let i = 0; i < n; i++) {
    const z = -d / 2 + (i + 0.5) * (d / n);
    k.tris([-w / 2, 0, -d / n / 2, w / 2, 0, -d / n / 2, w / 2, 3, d / n / 2, -w / 2, 0, -d / n / 2, w / 2, 3, d / n / 2, -w / 2, 3, d / n / 2], roof, { y: H, z });
    k.box(w, 3, 0.15, '#9ab0c0', 0, H, z + d / n / 2);
  }
  const stacks = rng.int(1, 3);
  for (let i = 0; i < stacks; i++) {
    k.cyl(0.9, 1.2, H + 14, 8, shade(wall, 0.9), w / 2 - 2 - i * 3, 0, d / 2 - 2);
    k.cyl(1.0, 1.0, 0.6, 8, trim, w / 2 - 2 - i * 3, H + 13.6, d / 2 - 2);
  }
  return H + 14;
}

function courtyard(k: MeshKit, style: BuildingStyle, w: number, d: number, H: number, wall: Col, roof: Col, trim: Col, win: Col, f: Set<string>): number {
  const t = Math.min(w, d) * 0.28;
  const sub = { ...style, roof: style.roof, shape: 'box' as const };
  const rng = new Rng(Math.round(w * 100 + d));
  const wings: [number, number, number, number][] = [[0, -d / 2 + t / 2, w, t], [0, d / 2 - t / 2, w, t], [-w / 2 + t / 2, 0, t, d - t * 2], [w / 2 - t / 2, 0, t, d - t * 2]];
  for (const [x, z, ww, dd] of wings) {
    k.push({ x, z });
    boxHouse(k, sub, ww, dd, H, 0, wall, roof, trim, win, new Set([...f].filter((x) => x !== 'door' && x !== 'jharokha')), rng, { role: 'home', tech: 4 });
    k.pop();
  }
  k.box(2, 2.4, 0.3, '#3a2a1e', 0, 0, -d / 2 - 0.1);
  if (f.has('palm')) { k.cyl(0.18, 0.25, 6, 5, '#8a7458', 0, 0, 0); for (let i = 0; i < 6; i++) k.boxC(3, 0.1, 0.6, '#4a8a3a', { x: Math.cos(i) * 1.3, y: 6, z: Math.sin(i) * 1.3, ry: -i, rz: -0.4 }); }
  if (f.has('jharokha')) { k.box(2.4, 1.8, 1, shade(wall, 1.08), 0, FLOOR + 0.3, -d / 2 - 0.5); k.dome(1, 6, 3, shade(wall, 1.1), 0, FLOOR + 2.1, -d / 2 - 0.5); }
  return H + 0.7;
}

function terrace(k: MeshKit, w: number, d: number, floors: number, wall: Col, trim: Col, win: Col, f: Set<string>): number {
  let y = 0;
  for (let i = 0; i < floors; i++) {
    const dd = d * (1 - i * 0.3), zz = (d - dd) / 2;
    k.box(w * (1 - i * 0.12), 2.6, dd, wall, 0, y, zz);
    k.box(w * (1 - i * 0.12) + 0.2, 0.25, dd + 0.2, shade(wall, 0.9), 0, y + 2.6, zz);
    if (f.has('vigas')) for (let j = 0; j < 5; j++) k.box(0.16, 0.16, 0.7, trim, -w * 0.4 + j * w * 0.2, y + 2.2, zz - dd / 2 - 0.3);
    if (f.has('small_windows')) for (let j = 0; j < 3; j++) k.box(0.5, 0.5, 0.1, win, -w * 0.3 + j * w * 0.3, y + 1.2, zz - dd / 2 - 0.03);
    if (f.has('roof_ladder') && i < floors - 1) { k.box(0.08, 3, 0.08, trim, w * 0.35, y + 1.5, zz - dd / 2 + 1 + (d * 0.3) / 2); k.box(0.08, 3, 0.08, trim, w * 0.35 + 0.5, y + 1.5, zz - dd / 2 + 1 + (d * 0.3) / 2); }
    y += 2.85;
  }
  k.box(0.9, 1.6, 0.12, '#2a1a10', 0, 0, -d / 2 - 0.03);
  return y;
}

function ruin(k: MeshKit, src: BuildingStyle, w: number, d: number, rng: Rng, wall: Col): BuiltInfo {
  const segs = [[0, -d / 2, w, 0.6], [0, d / 2, w, 0.6], [-w / 2, 0, 0.6, d], [w / 2, 0, 0.6, d]] as const;
  for (const [x, z, ww, dd] of segs) {
    const n = 3;
    for (let i = 0; i < n; i++) {
      if (rng.chance(0.3)) continue;
      const hh = rng.range(0.4, 2.8);
      const fx = ww > 1 ? x - ww / 2 + (i + 0.5) * (ww / n) : x, fz = dd > 1 ? z - dd / 2 + (i + 0.5) * (dd / n) : z;
      k.box(ww > 1 ? ww / n : ww, hh, dd > 1 ? dd / n : dd, shade(wall, rng.range(0.85, 1.05)), fx, 0, fz);
    }
  }
  if (src.features.includes('columns')) for (let i = 0; i < 4; i++) if (rng.chance(0.6)) k.cyl(0.32, 0.36, rng.range(1, 5), 8, shade(wall, 1.1), -w / 2 + i * (w / 3), 0, -d / 2 - 1.2);
  for (let i = 0; i < 5; i++) k.rock(rng.range(0.3, 0.7), shade(wall, 0.9), rng.range(-w, w) * 0.6, 0.1, rng.range(-d, d) * 0.6);
  return { height: 3 };
}

function scaffold(k: MeshKit, w: number, d: number, H: number, rng: Rng) {
  const c = '#a8885a';
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box(0.15, H + 2, 0.15, c, sx * (w / 2 + 0.8), 0, sz * (d / 2 + 0.8));
  for (let y = 2; y < H + 2; y += 2) {
    k.box(w + 1.8, 0.12, 0.12, c, 0, y, -d / 2 - 0.8);
    k.box(w + 1.8, 0.12, 0.12, c, 0, y, d / 2 + 0.8);
    k.box(0.12, 0.12, d + 1.8, c, -w / 2 - 0.8, y, 0);
    k.box(0.12, 0.12, d + 1.8, c, w / 2 + 0.8, y, 0);
  }
  for (let i = 0; i < 3; i++) k.box(1.2, 0.5, 0.6, '#c8b48a', rng.range(-w, w) * 0.5, 0, -d / 2 - 2.5);
}
