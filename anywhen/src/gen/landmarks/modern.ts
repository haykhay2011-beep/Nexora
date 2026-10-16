// Industrial, modern and imagined-future landmarks, plus natural wonders.
import { shade } from '../meshkit';
import { type Builder, num, str, bool, tone, isRuin, building, boxCol, cylCol, scaffoldBox, column } from './common';

export const lattice_tower: Builder = (k, c) => {
  const H = num(c, 'h', 300), B = num(c, 'base', 125);
  const col = str(c, 'color', '#7a5a40'), white = str(c, 'white', '');
  const levels = (c.p.levels as number[]) ?? [57, 116, 276];
  const built = building(c) ? Math.max(0.25, Math.min(0.9, (c.year - 1887 + 0.5) / 2.2)) : 1;
  const Hb = H * built;
  // half-width of the outer edge at height y (concave taper), and the pier width below the leg junction
  const half = (y: number) => (B / 2 - 2) * Math.pow(1 - y / H, 1.9) + 2;
  const legTop = num(c, 'legTop', Math.min(levels[0], H * 0.2));
  const legW = (y: number) => B * 0.17 * (1 - 0.45 * Math.min(1, y / legTop));
  const colAt = (y: number) => tone(c, white && Math.floor((y / H) * 7) % 2 === 1 ? white : col);
  // segment boundaries aligned with the leg junction
  const ys: number[] = [];
  const nLeg = 6, nTop = 24;
  for (let i = 0; i <= nLeg; i++) ys.push((i / nLeg) * legTop);
  for (let i = 1; i <= nTop; i++) ys.push(legTop + (i / nTop) * (H - legTop));
  const CORNERS: [number, number][] = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  const thick = (y: number) => Math.max(0.5, 2.6 * (1 - y / H));
  for (let i = 0; i < ys.length - 1; i++) {
    const y0 = ys[i];
    if (y0 >= Hb) break;
    const y1 = Math.min(ys[i + 1], Hb);
    const h0 = half(y0), h1 = half(y1), t = thick(y0), cc = colAt(y0);
    const flip = i % 2 === 0;
    if (y0 < legTop - 0.01) {
      // four separate piers, each a small braced square shaft
      const w0 = legW(y0), w1 = legW(y1);
      for (const [sx, sz] of CORNERS) {
        const pc = (h: number, w: number, a: number, b: number): [number, number] => [sx * (h - a * w), sz * (h - b * w)];
        const q: [number, number][] = [[0, 0], [1, 0], [1, 1], [0, 1]];
        for (let j = 0; j < 4; j++) {
          const [a0, b0] = q[j], [a1, b1] = q[(j + 1) % 4];
          const p0 = pc(h0, w0, a0, b0), p1 = pc(h1, w1, a0, b0);
          k.beam(p0[0], y0, p0[1], p1[0], y1, p1[1], t, cc);
          const d0 = pc(h0, w0, flip ? a0 : a1, flip ? b0 : b1), d1 = pc(h1, w1, flip ? a1 : a0, flip ? b1 : b0);
          k.beam(d0[0], y0, d0[1], d1[0], y1, d1[1], t * 0.4, cc);
        }
      }
    } else {
      // single tapering shaft: corner chords, alternating diagonals and girts on each face
      for (let j = 0; j < 4; j++) {
        const [ax, az] = CORNERS[j], [bx, bz] = CORNERS[(j + 1) % 4];
        k.beam(ax * h0, y0, az * h0, ax * h1, y1, az * h1, t, cc);
        if (flip) k.beam(ax * h0, y0, az * h0, bx * h1, y1, bz * h1, t * 0.4, cc);
        else k.beam(bx * h0, y0, bz * h0, ax * h1, y1, az * h1, t * 0.4, cc);
        k.beam(ax * h1, y1, az * h1, bx * h1, y1, bz * h1, t * 0.5, cc);
      }
    }
  }
  for (const [sx, sz] of CORNERS) {
    const r = half(0) - legW(0) / 2;
    c.colliders.push({ k: 'box', x: sx * r, z: sz * r, hw: legW(0) / 2, hd: legW(0) / 2, rot: 0, y0: 0, y1: 20 });
  }
  // decorative arches spanning the piers on each face
  if (bool(c, 'arches') && Hb > legTop) {
    const apex = legTop * 0.82, foot = legTop * 0.12, n = 14;
    for (let f = 0; f < 4; f++) {
      const rot = (f * Math.PI) / 2, cs = Math.cos(rot), sn = Math.sin(rot);
      let prev: [number, number, number] | null = null;
      for (let j = 0; j <= n; j++) {
        const u = -1 + (2 * j) / n;
        const y = foot + (apex - foot) * Math.sqrt(Math.max(0, 1 - u * u));
        const lx = u * (half(y) - legW(y)), lz = half(y) - 0.5;
        const p: [number, number, number] = [lx * cs - lz * sn, y, lx * sn + lz * cs];
        if (prev) k.beam(prev[0], prev[1], prev[2], p[0], p[1], p[2], 1.4, tone(c, col));
        prev = p;
      }
    }
  }
  for (const ly of levels) if (ly < Hb) {
    const r = half(ly), w = r * 2 + 6;
    k.box(w, 3, w, tone(c, white || shade(col, 1.15)), 0, ly, 0);
    k.box(w - 1, 2.4, w - 1, tone(c, shade(white || col, 0.8)), 0, ly + 3, 0);
    boxCol(c, 0, 0, w, w, ly, ly + 3);
  }
  if (!building(c)) {
    k.cyl(1.2, 2.5, H * 0.08, 8, tone(c, col), 0, H * 0.92, 0);
    k.cyl(0.4, 0.4, num(c, 'antenna', 20), 4, '#c8c8c8', 0, H, 0);
    k.curGlow = 1; k.sphere(1.2, 6, 4, white ? '#ff4a2a' : '#ffe8a8', 0, H + 2, 0); k.curGlow = 0;
  }
  c.height = H;
};

export const statue: Builder = (k, c) => {
  const H = num(c, 'h', 46), P = num(c, 'pedestal', 47);
  const pose = str(c, 'pose', 'torch');
  const col = c.state === 'weathered' || c.state === 'restored' ? str(c, 'patina', '#7ab8a0') : str(c, 'color', '#b87a4a');
  if (bool(c, 'fort')) {
    // star-shaped fort base
    for (let i = 0; i < 11; i++) { const a = (i / 11) * Math.PI * 2; k.box(14, 8, 40, '#a8a296', Math.cos(a) * 34, 0, Math.sin(a) * 34, -a); }
    k.cyl(36, 36, 8, 22, '#b8b2a6', 0, 0, 0);
    cylCol(c, 0, 0, 40, 0, 8);
  }
  const base = bool(c, 'fort') ? 8 : 0;
  k.box(P * 0.42, P * 0.65, P * 0.42, '#c8c0b0', 0, base, 0);
  k.box(P * 0.36, P * 0.35, P * 0.36, '#d8d0c0', 0, base + P * 0.65, 0);
  boxCol(c, 0, 0, P * 0.42, P * 0.42, base, base + P);
  const y0 = base + P;
  if (building(c)) { scaffoldBox(k, H * 0.3, H * 0.3, H * 0.6, 0, 0, 3); k.box(H * 0.2, H * 0.5, H * 0.15, col, 0, y0, 0); c.height = y0 + H * 0.6; return; }
  const s = H / 46;
  k.push({ y: y0, sx: s, sy: s, sz: s });
  if (pose === 'torch') {
    // robed figure: long gown, raised right arm with torch, tablet in left
    k.cyl(5.5, 8, 22, 10, col, 0, 0, 0);
    k.cyl(4, 5.5, 8, 10, col, 0, 22, 0);
    k.sphere(3, 8, 6, col, 0, 33.5, 0);
    for (let i = 0; i < 7; i++) { const a = (i / 6 - 0.5) * Math.PI * 0.9; k.cone(0.7, 3.4, 4, col, Math.sin(a) * 2.6, 35.3, -Math.cos(a) * 2.6, { rx: -Math.cos(a) * 0.6, rz: -Math.sin(a) * 0.6 }); }
    k.boxC(2, 14, 2, col, { x: 4.6, y: 36, z: 0, rz: -0.12 });
    k.cyl(1.4, 0.9, 3, 8, col, 5.6, 42.5, 0);
    k.curGlow = 1; k.cone(1.4, 3, 6, '#ffd24a', 5.6, 45.5, 0); k.curGlow = 0;
    k.boxC(1.5, 6.5, 4.4, col, { x: -4.5, y: 24, z: -1.5, rz: 0.2 });
    k.boxC(1.4, 7, 1.6, col, { x: -4.2, y: 23, z: 1, rz: 0.3 });
  } else {
    // arms outstretched
    k.cyl(3.2, 4.4, 20, 10, col, 0, 0, 0);
    k.box(6.4, 7, 3.4, col, 0, 19, 0);
    k.boxC(28, 2.2, 2.4, col, { y: 24 });
    for (const sx of [-1, 1]) k.box(2.6, 2.6, 2.6, col, sx * 14, 22.8, 0);
    k.sphere(2, 8, 6, col, 0, 28.6, 0);
  }
  k.pop();
  c.height = y0 + H;
};

export const opera_shells: Builder = (k, c) => {
  const L = num(c, 'l', 183), W = num(c, 'w', 120), H = num(c, 'h', 65);
  const col = str(c, 'color', '#f6f4ee');
  k.box(W, 8, L, '#c89a78', 0, 0, 0);
  boxCol(c, 0, 0, W, L, 0, 8);
  for (let i = 0; i < 12; i++) k.box(W * 0.6, 0.5, 2, '#b88a68', 0, 8 - i * 0.6, -L / 2 - i * 1.6);
  const shellSet = (x: number, scale: number) => {
    const n = building(c) ? 2 : 4;
    for (let i = 0; i < n; i++) {
      const z = -L * 0.35 + i * L * 0.18;
      const h = H * scale * (1 - i * 0.18);
      // each shell: two leaning curved panels forming a sail
      for (const sx of [-1, 1]) {
        k.tris([0, 0, 0, sx * 18 * scale, 0, 8, 0, h, 18 * scale, 0, 0, 0, 0, h, 18 * scale, sx * 2, h * 0.6, -6 * scale], (nx, ny) => shade(col, 0.9 + ny * 0.1), { x, y: 8, z });
      }
      k.tris([-14 * scale, 0, 10, 14 * scale, 0, 10, 0, h * 0.85, 16 * scale], '#c8a888', { x, y: 8, z: z + 0.5 });
    }
  };
  shellSet(-W * 0.2, 1);
  shellSet(W * 0.25, 0.75);
  if (building(c)) scaffoldBox(k, W * 0.6, L * 0.4, H * 0.5, 0, 0, 4);
  c.height = H + 8;
};

export const skyscraper: Builder = (k, c) => {
  const H = num(c, 'h', 380), B = num(c, 'base', 50);
  const style = str(c, 'style', 'box');
  const col = str(c, 'color', '#c8d4e0');
  const built = building(c) ? 0.55 : 1;
  const win = '#8ab4d8';
  const band = (w: number, d: number, y0: number, h: number) => {
    k.curGlow = 0.85;
    for (let y = y0 + 2; y < y0 + h - 1; y += 4) { k.box(w + 0.1, 1.6, d * 0.94, win, 0, y, 0); k.box(w * 0.94, 1.6, d + 0.1, win, 0, y, 0); }
    k.curGlow = 0;
  };
  if (style === 'twin') {
    for (const sx of [-1, 1]) {
      const x = sx * B * 0.75;
      let y = 0, r = B / 2;
      for (let t = 0; t < 6; t++) { const h = (H * 0.85 * built) / 6; k.push({ x }); k.cyl(r, r, h, 16, tone(c, col), 0, y, 0); k.curGlow = 0.8; for (let yy = y + 2; yy < y + h; yy += 4) k.cyl(r + 0.1, r + 0.1, 1.4, 16, win, 0, yy, 0); k.curGlow = 0; k.pop(); y += h; r *= 0.93; }
      if (!building(c)) { k.cone(r, H * 0.08, 16, tone(c, col), x, y, 0); k.cyl(0.6, 1, H * 0.08, 6, '#d8d8d8', x, y + H * 0.08, 0); }
      cylCol(c, x, 0, B / 2, 0, H * built);
    }
    if (!building(c)) k.box(B * 0.9, 6, 4, '#c8ccd4', 0, 170, 0);
  } else if (style === 'spire_y') {
    let y = 0, w = B;
    for (let t = 0; t < 10; t++) {
      const h = (H * 0.72 * built) / 10;
      for (let a = 0; a < 3; a++) { const ang = (a * Math.PI * 2) / 3 + t * 0.12; k.box(w * 0.38, h, w * (0.7 - t * 0.05), tone(c, col), Math.cos(ang) * w * 0.25, y, Math.sin(ang) * w * 0.25, -ang); }
      k.cyl(w * 0.2, w * 0.2, h, 8, tone(c, shade(col, 1.05)), 0, y, 0);
      y += h; w *= 0.88;
      if (y >= H * 0.72 * built) break;
    }
    if (!building(c)) k.cyl(0.8, 6, H * 0.28, 8, tone(c, col), 0, y, 0);
    cylCol(c, 0, 0, B * 0.5, 0, H * built);
  } else {
    // stepped Art Deco tower
    const steps: [number, number][] = [[1, 0.2], [0.8, 0.5], [0.62, 0.75], [0.45, 0.85], [0.3, 0.9]];
    let y = 0;
    for (const [s, top] of steps) {
      const h = H * top * built - y;
      if (h <= 0) break;
      k.box(B * s, h, B * s * 0.75, tone(c, col), 0, y, 0);
      band(B * s, B * s * 0.75, y, h);
      for (let i = 0; i < 6; i++) k.box(0.6, h, 0.6, tone(c, shade(col, 1.1)), -B * s / 2 + (i * B * s) / 5, y, -B * s * 0.375 - 0.2);
      y += h;
    }
    if (!building(c)) { k.cyl(3, 5, H * 0.06, 8, tone(c, col), 0, y, 0); k.cyl(0.5, 1.2, H * 0.06, 6, '#d8d8d8', 0, y + H * 0.06, 0); k.curGlow = 1; k.sphere(1, 5, 4, '#ff4a2a', 0, H, 0); k.curGlow = 0; }
    boxCol(c, 0, 0, B, B * 0.75, 0, H * 0.2 * built);
    boxCol(c, 0, 0, B * 0.8, B * 0.6, 0, H * built);
  }
  if (building(c)) { k.box(4, H * built * 1.15, 4, '#e8b83a', B * 0.6, 0, 0); k.boxC(60, 2, 2, '#e8b83a', { x: B * 0.6 + 20, y: H * built * 1.15 }); }
  c.height = H;
};

export const needle_tower: Builder = (k, c) => {
  const H = num(c, 'h', 553), POD = num(c, 'pod', 342);
  const col = str(c, 'color', '#d8d4cc');
  const built = building(c) ? 0.5 : 1;
  for (let a = 0; a < 3; a++) { const ang = (a * Math.PI * 2) / 3; k.pyramid(10, 30, POD * 0.9 * built, tone(c, col), Math.cos(ang) * 8, 0, Math.sin(ang) * 8, -ang, 3, 4); }
  k.cyl(7, 12, POD * built, 12, tone(c, col), 0, 0, 0);
  cylCol(c, 0, 0, 14, 0, POD * built);
  if (!building(c)) {
    k.cyl(22, 18, 14, 16, tone(c, shade(col, 0.95)), 0, POD, 0);
    k.curGlow = 0.8; k.cyl(22.3, 22.3, 4, 16, '#8ab4d8', 0, POD + 5, 0); k.curGlow = 0;
    k.cyl(18, 22, 6, 16, tone(c, col), 0, POD + 14, 0);
    k.cyl(5, 7, 100, 10, tone(c, col), 0, POD + 20, 0);
    k.cyl(9, 9, 6, 12, tone(c, col), 0, POD + 104, 0);
    k.cyl(1, 3, H - POD - 110, 8, '#c8c8c8', 0, POD + 110, 0);
  }
  c.height = H;
};

export const suspension_bridge: Builder = (k, c) => {
  const S = num(c, 'span', 1280), TH = num(c, 'towerH', 227), D = num(c, 'deck', 67);
  const col = str(c, 'color', '#c0362c');
  const built = building(c);
  const total = S * 1.6;
  // runs along x; towers at ±S/2
  for (const sx of [-1, 1]) {
    const x = (sx * S) / 2;
    for (const sz of [-1, 1]) { k.box(6, TH, 6, col, x, -10, sz * 13); boxCol(c, x, sz * 13, 6, 6, -10, TH); }
    for (let i = 0; i < 4; i++) k.box(5, 6, 30, col, x, D + 30 + i * 42, 0);
  }
  if (!built) {
    // deck
    k.box(total, 4, 26, col, 0, D, 0);
    k.box(total, 0.4, 20, '#4a4a4e', 0, D + 4, 0);
    c.colliders.push({ k: 'box', x: 0, z: 0, hw: total / 2, hd: 13, rot: 0, y0: D, y1: D + 4 });
    // main cables (parabola) + suspenders
    for (const sz of [-1, 1]) {
      const pts = 40;
      for (let i = 0; i < pts; i++) {
        const t0 = i / pts - 0.5, t1 = (i + 1) / pts - 0.5;
        const x0 = t0 * S, x1 = t1 * S;
        const y0 = D + 8 + (TH - D - 8) * (4 * t0 * t0), y1 = D + 8 + (TH - D - 8) * (4 * t1 * t1);
        k.boxC(Math.hypot(x1 - x0, y1 - y0), 1.2, 1.2, col, { x: (x0 + x1) / 2, y: (y0 + y1) / 2, z: sz * 13, rz: Math.atan2(y1 - y0, x1 - x0) });
        if (i % 2 === 0) k.box(0.3, y0 - D - 4, 0.3, col, x0, D + 4, sz * 13);
      }
      // side spans down to the shore
      for (const sx of [-1, 1]) k.boxC(S * 0.32, 1.2, 1.2, col, { x: sx * S * 0.66, y: (TH + D) / 2, z: sz * 13, rz: sx * -Math.atan2(TH - D, S * 0.3) });
    }
  } else for (const sx of [-1, 1]) k.box(S * 0.15, 4, 26, col, sx * S * 0.5, D, 0);
  c.height = TH;
};

export const tower_bridge: Builder = (k, c) => {
  const S = num(c, 'span', 244), TH = num(c, 'towerH', 65);
  const col = str(c, 'color', '#d8d0c0'), blue = str(c, 'blue', '#6a9ac0');
  const built = building(c);
  for (const sx of [-1, 1]) {
    const x = sx * 40;
    k.box(18, built ? TH * 0.6 : TH, 22, col, x, -6, 0);
    boxCol(c, x, 0, 18, 22, -6, TH);
    if (!built) {
      k.pyramid(16, 20, 12, '#4a5058', x, TH - 6, 0, 0, 2, 2);
      for (const [dx, dz] of [[-8, -10], [8, -10], [-8, 10], [8, 10]]) { k.cyl(1.4, 1.4, 8, 8, col, x + dx, TH - 10, dz); k.cone(1.8, 5, 8, '#4a5058', x + dx, TH - 2, dz); }
      k.box(30, 3, 22, col, x + sx * 30, 14, 0);
    }
  }
  if (!built) {
    k.box(62, 3, 8, blue, 0, TH - 14, -6); k.box(62, 3, 8, blue, 0, TH - 14, 6);
    k.box(62, 2, 16, blue, 0, 10, 0);
    for (const sx of [-1, 1]) k.boxC(S * 0.3, 1.2, 1, blue, { x: sx * 85, y: 30, z: -8, rz: sx * 0.4 });
    c.colliders.push({ k: 'box', x: 0, z: 0, hw: S / 2, hd: 8, rot: 0, y0: 10, y1: 12 });
    k.box(S, 2, 16, '#5a5a5e', 0, 10, 0);
  }
  c.height = TH;
};

export const gate: Builder = (k, c) => {
  const W = num(c, 'w', 65), H = num(c, 'h', 26), n = num(c, 'cols', 6);
  const col = str(c, 'color', '#e2d8c0');
  k.box(W, 1, 12, tone(c, col), 0, 0, 0);
  for (let i = 0; i < n; i++) for (const sz of [-4, 4]) { const x = -W * 0.4 + (i * W * 0.8) / (n - 1); column(k, x, sz, H * 0.6, 0.9, tone(c, col), 1); cylCol(c, x, sz, 1, 0, H * 0.6); }
  for (let i = 0; i < n - 1; i++) { const x = -W * 0.4 + ((i + 0.5) * W * 0.8) / (n - 1); if (i !== 2) k.box(1.2, H * 0.6, 8, tone(c, shade(col, 0.95)), x, 1, 0); }
  k.box(W * 0.85, H * 0.18, 12, tone(c, col), 0, 1 + H * 0.6, 0);
  k.box(W * 0.4, H * 0.12, 9, tone(c, col), 0, 1 + H * 0.78, 0);
  boxCol(c, 0, 0, W * 0.85, 12, H * 0.6, H * 0.9);
  if (bool(c, 'quadriga') && c.year >= 1793) {
    const g = '#5a7a6a';
    for (let i = 0; i < 4; i++) k.box(1.2, 2.4, 3.4, g, -2.4 + i * 1.6, H * 0.9 + 1, 0);
    k.box(3, 2, 2.4, g, 0, H * 0.9 + 1, 2.5);
    k.box(0.8, 4, 0.8, g, 0, H * 0.9 + 3, 3);
  }
  for (const sx of [-1, 1]) { k.box(14, 14, 10, tone(c, col), sx * (W / 2 + 6), 0, 0); boxCol(c, sx * (W / 2 + 6), 0, 14, 10, 0, 14); }
  c.height = H;
};

export const launch_pad: Builder = (k, c) => {
  const H = num(c, 'h', 110);
  k.box(120, 12, 120, '#b8b4ac', 0, 0, 0);
  boxCol(c, 0, 0, 120, 120, 0, 12);
  k.box(30, 10, 40, '#7a7a7a', 0, 12, 18);
  // launch umbilical tower
  k.box(12, H + 30, 12, '#c84a2a', 26, 12, 0);
  for (let i = 0; i < 9; i++) k.boxC(18, 1, 2, '#c84a2a', { x: 15, y: 30 + i * 12, z: 0 });
  boxCol(c, 26, 0, 12, 12, 12, H + 42);
  if (c.year >= 1967 && c.year <= 1972) {
    // Saturn V
    const w = '#f2f2f0', b = '#1a1a1a';
    k.cyl(5, 5, 42, 16, w, 0, 12, 0);
    for (let i = 0; i < 4; i++) k.box(5, 6, 0.5, b, Math.cos(i * 1.57) * 5, 20, Math.sin(i * 1.57) * 5, -i * 1.57);
    for (let i = 0; i < 4; i++) k.boxC(1, 6, 4, w, { x: Math.cos(i * 1.57 + 0.78) * 5.5, y: 15, z: Math.sin(i * 1.57 + 0.78) * 5.5, ry: -(i * 1.57 + 0.78) });
    k.cyl(5, 5, 25, 16, w, 0, 54, 0);
    k.cyl(5, 5, 1, 16, b, 0, 66, 0);
    k.cyl(3.3, 5, 4, 16, w, 0, 79, 0);
    k.cyl(3.3, 3.3, 18, 16, w, 0, 83, 0);
    k.cyl(3.3, 3.3, 1.5, 16, b, 0, 92, 0);
    k.cyl(2, 3.3, 5, 16, '#d8d8d8', 0, 101, 0);
    k.cone(2, 6, 12, '#d8d8d8', 0, 106, 0);
    k.cyl(0.2, 0.3, 8, 4, '#d8d8d8', 0, 112, 0);
    cylCol(c, 0, 0, 5.5, 12, 112);
  }
  c.height = H + 20;
};

export const railway: Builder = (k, c) => {
  const L = num(c, 'length', 1600);
  // straight double track running along x with sleepers
  for (const zz of [-3, 3]) {
    for (let x = -L / 2; x < L / 2; x += 40) {
      const y = c.h(x + 20, zz);
      k.boxC(40.2, 0.3, 3.2, '#8a7a6a', { x: x + 20, y: y + 0.15, z: zz });
      for (const r of [-0.72, 0.72]) k.boxC(40.2, 0.15, 0.1, '#5a5a5e', { x: x + 20, y: y + 0.45, z: zz + r });
      for (let s = 0; s < 40; s += 1) k.boxC(0.25, 0.12, 2.4, '#5a4030', { x: x + s, y: y + 0.32, z: zz });
    }
  }
  // grandstand and the Rocket locomotive (yellow, tall chimney)
  k.box(40, 5, 10, '#8a6a48', 0, 0, -20); k.gable(40, 3, 10, '#5a4a3a', 0, 5, -20, 0, 0.4);
  for (let i = 0; i < 4; i++) k.box(38, 0.5, 2, '#a8885a', 0, 1 + i, -17.5 + i * 1.6);
  boxCol(c, 0, -20, 40, 10, 0, 5);
  const ry = c.h(30, -3);
  k.push({ x: 30, y: ry + 0.5, z: -3 });
  k.cyl(0.9, 0.9, 3, 10, '#e8c83a', 0, 1.8, 0, { rz: Math.PI / 2, y: 1.8 });
  k.cyl(0.25, 0.3, 4, 8, '#2a2a2a', 1.6, 2.2, 0);
  for (const [x, r] of [[-1.1, 1.2], [1.2, 0.7]]) for (const sz of [-0.8, 0.8]) k.cyl(r, r, 0.15, 12, '#e8c83a', x, r, sz, { rx: Math.PI / 2, y: r });
  k.box(1.6, 1, 1.6, '#5a4030', -2.4, 0.4, 0);
  k.pop();
  c.height = 6;
};

export const seed_vault: Builder = (k, c) => {
  const col = str(c, 'color', '#c8ccd0'), light = str(c, 'light', '#7ad8ff');
  const y = c.h(0, -30);
  k.pyramid(8, 26, 8, col, 0, y - 2, -40, 0, 8, 22);
  k.box(8, 9, 30, col, 0, y - 2, -28);
  k.curGlow = 1;
  for (let i = 0; i < 6; i++) k.box(5.6, 0.5, 0.2, light, 0, y + 1 + i * 1.1, -43.2);
  k.curGlow = 0;
  k.box(2.4, 3, 0.3, '#3a3a3e', 0, y - 2, -43.4);
  boxCol(c, 0, -28, 8, 30, y - 2, y + 7);
  c.height = 12;
};

export const lunar_lander: Builder = (k, c) => {
  const gold = '#d8a83a', foil = '#c8b080';
  k.box(4.2, 1.6, 4.2, gold, 0, 1.4, 0);
  for (const [x, z] of [[-2.8, -2.8], [2.8, -2.8], [2.8, 2.8], [-2.8, 2.8]]) {
    k.boxC(0.15, 3, 0.15, '#c8c8c8', { x: x * 0.75, y: 1.4, z: z * 0.75, rz: x > 0 ? 0.4 : -0.4, rx: z > 0 ? -0.4 : 0.4 });
    k.cyl(0.6, 0.6, 0.12, 8, '#c8c8c8', x, 0, z);
  }
  k.box(0.9, 0.12, 2, foil, 0, 1.2, -2.6); // ladder porch
  for (let i = 0; i < 5; i++) k.box(0.8, 0.06, 0.08, '#c8c8c8', 0, 0.3 + i * 0.25, -2.4);
  // flag, experiments, footprints
  k.cyl(0.03, 0.03, 2.4, 4, '#e8e8e8', 7, 0, -3);
  k.box(1.6, 0.9, 0.02, '#e8e8f2', 7.8, 1.5, -3);
  k.box(1, 0.4, 0.7, '#c8c8c8', 10, 0, 2);
  for (let i = 0; i < 40; i++) k.box(0.15, 0.02, 0.3, '#6a6a6a', 2 + Math.sin(i * 0.5) * 6 + i * 0.1, 0.02, -2 + Math.cos(i * 0.3) * 4);
  boxCol(c, 0, 0, 4.4, 4.4, 0, 3);
  c.height = 3;
};

export const archive_spire: Builder = (k, c) => {
  const H = num(c, 'h', 420);
  const col = str(c, 'color', '#ffffff'), glow = str(c, 'glow', '#8a7bff');
  const built = building(c) ? 0.45 : 1;
  // plinth garden ring
  k.cyl(140, 150, 4, 32, '#e8f0ff', 0, 0, 0);
  k.cyl(120, 120, 4.2, 32, '#7ac88a', 0, 0, 0);
  for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2; k.cyl(2, 2.5, 18, 8, '#f2f0ff', Math.cos(a) * 130, 4, Math.sin(a) * 130); }
  // a woven helix of light around a tall white spire
  let y = 4, r = 40;
  const segs = 16;
  for (let i = 0; i < segs; i++) {
    const h = ((H - 40) * built) / segs;
    k.cyl(r * 0.9, r, h, 16, col, 0, y, 0);
    k.curGlow = 1; k.torus(r + 1.5, 0.8, 4, 24, glow, { y: y + h, rx: Math.PI / 2 }); k.curGlow = 0;
    y += h; r *= 0.88;
  }
  cylCol(c, 0, 0, 40, 0, y);
  if (!building(c)) {
    k.curGlow = 1;
    for (let i = 0; i < 60; i++) { const t = i / 60, a = t * Math.PI * 10; k.sphere(1.6, 5, 4, i % 2 ? glow : '#7dffb2', Math.cos(a) * (45 - t * 30), 10 + t * (H - 60), Math.sin(a) * (45 - t * 30)); }
    k.sphere(8, 10, 8, '#f2f2ff', 0, y + 10, 0);
    k.curGlow = 0;
    // floating library discs
    for (let i = 0; i < 4; i++) { const a = i * 1.57 + 0.7; k.cyl(18, 14, 4, 16, '#f2f0ff', Math.cos(a) * 90, 60 + i * 50, Math.sin(a) * 90); k.curGlow = 0.8; k.torus(18, 0.6, 3, 20, glow, { x: Math.cos(a) * 90, y: 64 + i * 50, z: Math.sin(a) * 90, rx: Math.PI / 2 }); k.curGlow = 0; }
  } else scaffoldBox(k, 60, 60, y, 0, 0, 10);
  // the heart of light at the entrance
  k.curGlow = 1; k.box(10, 14, 1, '#d8d0ff', 0, 4, -44); k.curGlow = 0;
  c.height = H;
};

// ---------------- natural wonders ----------------

export const falls: Builder = (k, c) => {
  const W = num(c, 'width', 1700), D = num(c, 'drop', 108);
  // the terrain mod makes the plateau; here: upper river surface, falling curtain, mist
  c.waters.push({ x: 0, z: -600, w: W, d: 1200, rot: 0, y: D + 1.2, flow: 1 });
  const n = Math.round(W / 40);
  k.curGlow = 0.15;
  for (let i = 0; i < n; i++) {
    const x = -W / 2 + (i + 0.5) * (W / n);
    if (bool(c, 'horseshoe') && false) continue;
    k.boxC(W / n + 1, D + 2, 3, (i % 3 === 0 ? '#e8f4f8' : '#c8e4f0'), { x, y: D / 2, z: 4 + Math.sin(i * 0.7) * 3 });
  }
  k.curGlow = 0;
  for (let i = 0; i < 8; i++) c.mists.push({ x: -W / 2 + (i + 0.5) * (W / 8), y: 20, z: 40, r: 70 });
  c.height = D;
};

export const reef: Builder = (k, c) => {
  const n = num(c, 'count', 260);
  const cols = ['#e86a8a', '#f2a24a', '#a87ad8', '#4ac8b8', '#e8d84a', '#f27a5a'];
  for (let i = 0; i < n; i++) {
    const a = c.rng.range(0, Math.PI * 2), r = Math.sqrt(c.rng.next()) * 900;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const y = c.h(x, z);
    if (y > -0.6) continue;
    const col = cols[i % cols.length];
    const t = i % 4;
    if (t === 0) k.blob(c.rng.range(1, 3), col, x, y + 0.5, z, { sy: 0.6 });
    else if (t === 1) for (let j = 0; j < 4; j++) k.cyl(0.15, 0.25, c.rng.range(1, 2.4), 5, col, x + c.rng.range(-1, 1), y, z + c.rng.range(-1, 1));
    else if (t === 2) k.cyl(1.6, 0.4, 0.6, 7, col, x, y + 0.6, z);
    else k.rock(c.rng.range(0.8, 2), col, x, y + 0.3, z);
  }
  // a sandy cay with a few palms
  k.cyl(40, 50, 2.4, 12, '#efe2b8', 0, -2, 160);
  for (let i = 0; i < 4; i++) { k.cyl(0.25, 0.35, 7, 5, '#8a7458', -14 + i * 9, 0.4, 160 + (i % 2) * 6); for (let j = 0; j < 6; j++) k.boxC(4, 0.12, 0.8, '#4a8a3a', { x: -14 + i * 9 + Math.cos(j) * 1.5, y: 7.4, z: 160 + (i % 2) * 6 + Math.sin(j) * 1.5, ry: -j, rz: -0.35 }); }
  c.colliders.push({ k: 'cyl', x: 0, z: 160, r: 45, y0: -2, y1: 0.4 });
  c.height = 6;
};

export const karst_islands: Builder = (k, c) => {
  const n = num(c, 'count', 40);
  const [h0, h1] = (c.p.h as number[]) ?? [40, 120];
  for (let i = 0; i < n; i++) {
    const a = c.rng.range(0, Math.PI * 2), r = 200 + Math.sqrt(c.rng.next()) * 2200;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const h = c.rng.range(h0, h1), rad = h * c.rng.range(0.25, 0.45);
    k.cyl(rad * 0.8, rad, h, 8, (nx, ny) => (ny > 0.6 ? '#4a7a3a' : '#7a8a72'), x, -6, z, { ry: c.rng.range(0, 3) });
    k.blob(rad * 0.85, '#4a7a3a', x, h - 6, z, { sy: 0.5 });
    cylCol(c, x, z, rad, -6, h - 6);
  }
  void isRuin;
  c.height = h1;
};

export const none: Builder = (_k, c) => { c.height = 0; };
