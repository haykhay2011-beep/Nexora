// Domes, cathedrals, castles, palaces, towers.
import { shade } from '../meshkit';
import { type Builder, num, str, bool, tone, isRuin, building, boxCol, cylCol, scaffoldBox, column } from './common';

export const basilica_dome: Builder = (k, c) => {
  const D = num(c, 'dome', 31), H = num(c, 'h', 55), W = num(c, 'w', 70), L = num(c, 'l', 75);
  const col = str(c, 'color', '#d8a888'), dc = str(c, 'domeColor', '#8a9aa8');
  k.box(W, H * 0.45, L, tone(c, col), 0, 0, 0);
  boxCol(c, 0, 0, W, L, 0, H * 0.45);
  // stepped half-domes and buttresses
  for (const sz of [-1, 1]) { k.dome(D * 0.42, 14, 5, tone(c, dc), 0, H * 0.42, sz * L * 0.32, { sz: 0.8 }); }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box(10, H * 0.55, 10, tone(c, shade(col, 0.95)), sx * (W / 2 - 4), 0, sz * (L / 2 - 4));
  k.cyl(D / 2 + 1, D / 2 + 1.5, H * 0.1, 24, tone(c, shade(col, 1.04)), 0, H * 0.45, 0);
  // ring of windows at the base of the dome
  k.curGlow = 0.3;
  for (let i = 0; i < 40; i++) { const a = (i / 40) * Math.PI * 2; k.box(0.8, 2, 0.3, '#ffe8b0', Math.cos(a) * (D / 2 + 1.55), H * 0.47, Math.sin(a) * (D / 2 + 1.55), -a); }
  k.curGlow = 0;
  k.dome(D / 2, 24, 8, tone(c, dc), 0, H * 0.55, 0, { sy: 0.55 });
  if (c.year >= num(c, 'minaretsFrom', 1481)) for (const [x, z] of [[-W / 2 - 6, -L / 2 - 6], [W / 2 + 6, -L / 2 - 6], [-W / 2 - 6, L / 2 + 6], [W / 2 + 6, L / 2 + 6]]) {
    k.cyl(1.6, 1.9, 55, 10, tone(c, '#ece4d8'), x, 0, z);
    k.cyl(2.4, 2.4, 0.8, 10, tone(c, '#ece4d8'), x, 40, z);
    k.cone(1.9, 9, 10, tone(c, '#7a8a98'), x, 55, z);
    cylCol(c, x, z, 2, 0, 55);
  }
  c.height = H;
};

export const cathedral: Builder = (k, c) => {
  const L = num(c, 'l', 128), W = num(c, 'w', 48), TH = num(c, 'towerH', 69), SP = num(c, 'spire', 96);
  const col = str(c, 'color', '#d8ccb0'), roof = str(c, 'roof', '#5a6068');
  const gaudi = str(c, 'style', '') === 'gaudi';
  const tc = tone(c, col);
  const nave = W * 0.45;
  const naveH = gaudi ? 45 : 33;
  const constr = building(c);
  const progress = gaudi ? Math.min(1, Math.max(0.3, (c.year - 1882) / 148)) : constr && c.year < 1300 ? Math.max(0.35, (c.year - 1163) / 140) : 1;
  // nave, aisles, transept
  k.box(nave, naveH * (constr && !gaudi ? progress : 1), L * (constr && !gaudi ? progress : 1), tc, 0, 0, L * (1 - (constr && !gaudi ? progress : 1)) / 2);
  for (const sx of [-1, 1]) k.box(W * 0.25, naveH * 0.55, L * 0.9, tone(c, shade(col, 0.95)), sx * (nave / 2 + W * 0.125), 0, 0);
  k.box(W * 1.1, naveH * 0.95, nave, tc, 0, 0, L * 0.12);
  boxCol(c, 0, 0, W, L, 0, naveH);
  const roofOn = !(c.state === 'construction' && c.year >= 2019 && c.year < 2024) && !(constr && c.year < 1250);
  if (roofOn && !gaudi) { k.gable(nave, 12, L, tone(c, roof), 0, naveH, 0, 0, 0.5); k.gable(nave, 12, W * 1.1, tone(c, roof), 0, naveH, L * 0.12, Math.PI / 2, 0.5); }
  // flying buttresses
  for (let i = 0; i < 10; i++) for (const sx of [-1, 1]) {
    const z = -L / 2 + 8 + i * ((L - 16) / 9);
    k.box(2, naveH * 0.7, 2, tc, sx * (W / 2 + 3), 0, z);
    k.boxC(1, 1.2, W * 0.32, tc, { x: sx * (W / 2 - 4), y: naveH * 0.78, z, ry: Math.PI / 2, rx: sx * 0.6 });
    k.cone(1.2, 4, 6, tc, sx * (W / 2 + 3), naveH * 0.7, z);
  }
  // west front with twin towers and rose window
  const fz = -L / 2;
  if (!gaudi) {
    const tH = constr && c.year < 1250 ? TH * 0.5 : TH;
    for (const sx of [-1, 1]) { k.box(W * 0.36, tH, 14, tc, sx * W * 0.3, 0, fz + 2); boxCol(c, sx * W * 0.3, fz + 2, W * 0.36, 14, 0, tH); for (let r = 0; r < 3; r++) k.box(3, 8, 0.3, '#3a3a44', sx * W * 0.3, tH * 0.55 + r * 0.01, fz - 5.2 + r * 0.01); }
    k.box(W * 0.3, TH * 0.68, 12, tc, 0, 0, fz + 3);
    k.curGlow = 0.5; k.cyl(5.5, 5.5, 0.4, 16, '#5a6aa8', 0, TH * 0.45, fz - 3.1, { rx: Math.PI / 2, y: TH * 0.45 }); k.curGlow = 0;
    for (let i = 0; i < 3; i++) k.box(5, 9, 0.6, '#3a2a20', -10 + i * 10, 0, fz - 3.2);
    k.box(W * 0.95, 1.6, 2, tone(c, shade(col, 0.9)), 0, TH * 0.6, fz - 3.6);
    const spire = (c.year < 1786 && c.year >= 1250) || (c.year >= 1859 && c.year < 2019) || c.year >= 2024;
    if (spire && roofOn) { k.cyl(0.4, 3.2, SP - naveH, 8, tone(c, roof), 0, naveH + 6, L * 0.12); }
  } else {
    // Sagrada Família: clusters of tall perforated spires
    const towers = [[-14, fz, 0.8], [-5, fz - 2, 0.95], [5, fz - 2, 0.95], [14, fz, 0.8], [-14, L / 2, 0.75], [-5, L / 2 + 2, 0.9], [5, L / 2 + 2, 0.9], [14, L / 2, 0.75]];
    for (const [x, z, s] of towers) { k.cyl(1.2, 3.4, TH * (s as number), 10, tc, x as number, 0, z as number); k.cone(1.5, 8, 8, '#c84a3a', x as number, TH * (s as number), z as number); }
    const centre = c.state === 'complete' ? 1 : progress;
    k.cyl(3, 8, SP * centre, 12, tone(c, '#e2d8c8'), 0, 0, L * 0.12);
    if (c.state === 'complete') { k.curGlow = 0.8; k.sphere(3, 8, 6, '#f2f2f8', 0, SP + 3, L * 0.12); k.curGlow = 0; }
    for (const [x, z] of [[-12, L * 0.12 - 12], [12, L * 0.12 - 12], [-12, L * 0.12 + 12], [12, L * 0.12 + 12]]) k.cyl(2, 5, SP * 0.78 * centre, 10, tone(c, '#d8ccb8'), x, 0, z);
    cylCol(c, 0, L * 0.12, 8, 0, SP * centre);
  }
  if (constr) scaffoldBox(k, gaudi ? 30 : nave, gaudi ? 30 : 30, gaudi ? SP * 0.8 : naveH + 14, 0, gaudi ? L * 0.12 : L * 0.3, 4);
  // island setting (Île de la Cité)
  if (bool(c, 'island')) k.box(W * 3, 0.6, L * 2, tone(c, '#b8b0a0'), 0, -0.3, 0);
  c.height = gaudi ? SP : TH;
};

export const castle: Builder = (k, c) => {
  const T = num(c, 'towers', 6);
  const col = str(c, 'color', '#efe8dc'), roof = str(c, 'roof', '#5a7a9a');
  const tc = tone(c, col);
  const abbey = bool(c, 'abbey');
  if (abbey) {
    // a hill town spiralling up to an abbey church with a spire
    for (let i = 0; i < 6; i++) {
      const r = 110 - i * 16, y = c.h(r, 0);
      for (let j = 0; j < 10; j++) { const a = (j / 10) * Math.PI * 2 + i; const x = Math.cos(a) * r, z = Math.sin(a) * r; k.box(7, 7, 7, tone(c, shade(col, 0.95)), x, c.h(x, z) - 1, z, -a); k.gable(7, 3, 7, tone(c, roof), x, c.h(x, z) + 6, z, -a); }
      void y;
    }
    const top = c.h(0, 0);
    k.box(60, 16, 22, tc, 0, top, 0);
    k.gable(22, 10, 60, tone(c, roof), 0, top + 16, 0, Math.PI / 2, 0.5);
    k.box(10, 30, 10, tc, -8, top, 0);
    k.cyl(0.3, 3, 42, 8, tone(c, roof), -8, top + 30, 0);
    k.curGlow = 0.6; k.sphere(1.4, 6, 4, '#e8c860', -8, top + 73, 0); k.curGlow = 0;
    boxCol(c, 0, 0, 60, 22, top, top + 16);
    // ramparts at the base
    for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2; const x = Math.cos(a) * 140, z = Math.sin(a) * 140; k.box(18, 9, 4, tc, x, c.h(x, z) - 2, z, -a + Math.PI / 2); }
    c.height = top + 75;
    return;
  }
  const top = 0;
  const sc = building(c) ? 0.6 : 1;
  k.box(70, 22 * sc, 18, tc, 0, top, 0);
  k.box(18, 26 * sc, 40, tc, 30, top, 10);
  boxCol(c, 0, 0, 70, 18, 0, 22 * sc); boxCol(c, 30, 10, 18, 40, 0, 26 * sc);
  for (let f = 0; f < 4; f++) for (let i = 0; i < 12; i++) k.box(1.2, 2, 0.2, '#3a4a5a', -32 + i * 5.6, top + 3 + f * 5, -9.1);
  if (!building(c)) {
    k.gable(18, 10, 70, tone(c, roof), 0, top + 22, 0, Math.PI / 2, 0.6);
    const tw: [number, number, number, number][] = [[-35, -9, 4, 34], [-20, -9, 3, 30], [10, -9, 3.5, 40], [36, -12, 5, 52], [38, 30, 4, 36], [-35, 9, 3, 28]];
    for (let i = 0; i < Math.min(T, tw.length); i++) {
      const [x, z, r, h] = tw[i];
      k.cyl(r, r, h, 12, tc, x, top, z);
      k.cone(r * 1.25, r * 3, 12, tone(c, roof), x, top + h, z);
      cylCol(c, x, z, r, 0, h);
    }
  } else scaffoldBox(k, 70, 18, 26, 0, 0, 3);
  c.height = 60;
};

export const castle_tiers: Builder = (k, c) => {
  const tiers = num(c, 'tiers', 5), W = num(c, 'w', 28), B = num(c, 'base', 15);
  const col = str(c, 'color', '#f6f6f2'), roof = str(c, 'roof', '#5a6068');
  // sloped stone base
  k.pyramid(W * 1.5, W * 1.3, B, tone(c, '#a8a296'), 0, 0, 0, 0, W * 1.15, W * 0.95);
  boxCol(c, 0, 0, W * 1.2, W * 1.0, 0, B);
  let y = B, w = W, d = W * 0.82;
  const n = building(c) ? Math.ceil(tiers / 2) : tiers;
  for (let i = 0; i < n; i++) {
    const h = 6.5 - i * 0.4;
    k.box(w, h, d, tone(c, col), 0, y, 0);
    for (let j = 0; j < 4; j++) k.box(1.2, 1.5, 0.15, '#3a3a3a', -w / 3 + j * (w / 4.5), y + 2.5, -d / 2 - 0.05);
    k.pyramid(w + 4, d + 4, 2.4, tone(c, roof), 0, y + h, 0, 0, w + 0.5, d + 0.5);
    // gables on the roofs
    if (i % 2 === 0) k.gable(w * 0.4, 3, 2.5, tone(c, col), 0, y + h, -d / 2 - 1.2, 0, 0.3);
    boxCol(c, 0, 0, w, d, y, y + h);
    y += h + 1.4; w *= 0.8; d *= 0.8;
  }
  if (!building(c)) {
    k.gable(w + 2, 3.5, d + 2, tone(c, roof), 0, y - 1.2, 0, 0, 0.5);
    for (const sx of [-1, 1]) k.box(0.6, 1.4, 0.5, '#d8c860', sx * (w / 2 + 0.5), y + 1.6, 0);
    // smaller keeps
    for (const [x, z] of [[-W, W * 0.4], [W * 0.9, W * 0.6]]) { k.box(W * 0.45, 14, W * 0.4, tone(c, col), x, B * 0.4, z); k.pyramid(W * 0.55, W * 0.5, 4, tone(c, roof), x, B * 0.4 + 14, z, 0, W * 0.1, W * 0.05); }
  } else scaffoldBox(k, W, W * 0.82, 20, 0, 0, 3);
  c.height = y + 4;
};

export const palace_complex: Builder = (k, c) => {
  const W = num(c, 'w', 750), L = num(c, 'l', 960), WH = num(c, 'wallH', 10), M = num(c, 'moat', 52);
  const col = str(c, 'color', '#a8322a'), roof = str(c, 'roof', '#e8b83a');
  const sc = 0.5; // the complex is scaled to fit the play area nicely
  const w = W * sc, l = L * sc;
  c.waters.push({ x: 0, z: 0, w: w + M * 2 * sc + 8, d: l + M * 2 * sc + 8, rot: 0, y: -0.5 });
  k.box(w + 6, 0.8, l + 6, '#c8b89a', 0, -0.4, 0);
  for (const [x, z, ww, dd] of [[0, -l / 2, w, 3], [0, l / 2, w, 3], [-w / 2, 0, 3, l], [w / 2, 0, 3, l]] as const) {
    k.box(ww + 3, WH, dd + 3, tone(c, col), x, 0, z);
    k.box(ww + 4, 1, dd + 4, tone(c, roof), x, WH, z);
    if (z === -l / 2) continue;
    c.colliders.push({ k: 'box', x, z, hw: (ww + 3) / 2, hd: (dd + 3) / 2, rot: 0, y0: 0, y1: WH });
  }
  // south wall with Meridian Gate opening
  for (const sx of [-1, 1]) boxCol(c, sx * (w / 4 + 10), -l / 2, w / 2 - 20, 4, 0, WH);
  const hall = (z: number, hw: number, hd: number, terraces: number, roofs: number) => {
    let y = 0;
    for (let t = 0; t < terraces; t++) { k.box(hw * 1.5 - t * 6, 2, hd * 1.6 - t * 6, tone(c, '#f2eee4'), 0, y, z); y += 2; }
    boxCol(c, 0, z, hw * 1.5, hd * 1.6, 0, y);
    k.box(hw, 9, hd, tone(c, col), 0, y, z);
    boxCol(c, 0, z, hw, hd, y, y + 9);
    for (let i = 0; i < 10; i++) k.cyl(0.5, 0.5, 9, 6, tone(c, shade(col, 0.85)), -hw / 2 + i * (hw / 9), y, z - hd / 2 - 1);
    for (let r = 0; r < roofs; r++) {
      const ry = y + 9 + r * 5;
      k.pyramid(hw + 8 - r * 6, hd + 8 - r * 4, 2.2, tone(c, roof), 0, ry, z, 0, hw - 2 - r * 6, hd - 2 - r * 4);
      k.pyramid(hw - r * 6, hd - r * 4, 4, tone(c, roof), 0, ry + 2.2, z, 0, (hw - r * 6) * 0.6, 1);
    }
  };
  if (building(c)) { scaffoldBox(k, 60, 30, 20, 0, -40, 3); scaffoldBox(k, 40, 25, 16, 0, 40, 3); c.height = 25; return; }
  // Meridian gate
  k.box(60, 12, 18, tone(c, col), 0, 0, -l / 2 + 4);
  k.pyramid(70, 26, 6, tone(c, roof), 0, 12, -l / 2 + 4, 0, 50, 4);
  hall(-l * 0.18, 64, 34, 3, 2); // Hall of Supreme Harmony
  hall(0, 30, 30, 3, 1);
  hall(l * 0.16, 50, 26, 2, 2);
  for (let i = 0; i < 16; i++) { const sx = i % 2 ? 1 : -1; const z = -l * 0.35 + Math.floor(i / 2) * (l * 0.1); k.box(36, 6, 18, tone(c, col), sx * w * 0.32, 0, z); k.pyramid(40, 22, 5, tone(c, roof), sx * w * 0.32, 6, z, 0, 22, 2); boxCol(c, sx * w * 0.32, z, 36, 18, 0, 6); }
  // corner watchtowers
  for (const [x, z] of [[-w / 2, -l / 2], [w / 2, -l / 2], [-w / 2, l / 2], [w / 2, l / 2]]) { k.box(14, 8, 14, tone(c, col), x, WH, z); k.pyramid(18, 18, 6, tone(c, roof), x, WH + 8, z, 0, 2, 2); }
  c.height = 40;
};

export const round_hall: Builder = (k, c) => {
  const R = num(c, 'r', 16), H = num(c, 'h', 38), tiers = num(c, 'tiers', 3), ter = num(c, 'terrace', 3);
  const col = str(c, 'color', '#a8322a'), roof = str(c, 'roof', '#2a4a9a');
  let y = 0;
  for (let t = 0; t < ter; t++) { k.cyl(R * 2.6 - t * 6, R * 2.6 - t * 6 + 0.5, 1.8, 24, tone(c, '#f2f2ec'), 0, y, 0); for (let i = 0; i < 32; i++) { const a = (i / 32) * Math.PI * 2, rr = R * 2.6 - t * 6; k.box(0.4, 1, 0.4, '#f2f2ec', Math.cos(a) * rr, y + 1.8, Math.sin(a) * rr); } cylCol(c, 0, 0, R * 2.6 - t * 6, y, y + 1.8); y += 1.8; }
  if (building(c)) { scaffoldBox(k, R * 2, R * 2, H * 0.6, 0, 0, 3); c.height = H * 0.6; return; }
  k.cyl(R, R, H * 0.3, 20, tone(c, col), 0, y, 0);
  cylCol(c, 0, 0, R, y, y + H * 0.3);
  let r = R + 3, yy = y + H * 0.3;
  for (let t = 0; t < tiers; t++) {
    k.cone(r + 2, H * 0.12, 20, tone(c, roof), 0, yy, 0);
    k.cyl(r * 0.8, r * 0.8, H * 0.08, 20, tone(c, col), 0, yy + H * 0.08, 0);
    yy += H * 0.17; r *= 0.75;
  }
  k.cone(r + 1.5, H * 0.14, 20, tone(c, roof), 0, yy, 0);
  k.sphere(1.6, 8, 6, '#e8c860', 0, yy + H * 0.14 + 1, 0);
  c.height = H + y;
};

export const round_tower: Builder = (k, c) => {
  const H = num(c, 'h', 56), R = num(c, 'r', 7.8), tiers = num(c, 'tiers', 8);
  const col = str(c, 'color', '#f2ece0');
  // tilt grows during construction, reduced after 2001
  let tilt = num(c, 'tilt', 4);
  if (c.year < 1180) tilt = 0.5; else if (c.year < 1278) tilt = 1.6; else if (c.year < 1990) tilt = Math.min(5.5, 2 + (c.year - 1278) / 160); else if (c.year < 2001) tilt = 5.5;
  const built = building(c) ? Math.max(3, Math.round(((c.year - 1173) / 200) * tiers)) : tiers;
  k.push({ rz: (tilt * Math.PI) / 180 });
  const th = H / tiers;
  for (let i = 0; i < built; i++) {
    k.cyl(R, R, th * 0.86, 20, tone(c, col), 0, i * th, 0);
    k.cyl(R + 0.8, R + 0.8, th * 0.14, 20, tone(c, shade(col, 0.94)), 0, i * th + th * 0.86, 0);
    if (i > 0) for (let a = 0; a < 20; a++) { const an = (a / 20) * Math.PI * 2; k.cyl(0.25, 0.25, th * 0.86, 5, tone(c, col), Math.cos(an) * (R + 0.6), i * th, Math.sin(an) * (R + 0.6)); }
  }
  if (!building(c)) k.cyl(R * 0.6, R * 0.6, th, 16, tone(c, col), 0, H, 0);
  k.pop();
  // cathedral beside it
  k.box(30, 22, 80, tone(c, col), -45, 0, 20); k.gable(30, 8, 80, '#b5523b', -45, 22, 20, 0, 0.6);
  boxCol(c, -45, 20, 30, 80, 0, 22);
  cylCol(c, Math.sin((tilt * Math.PI) / 180) * -H * 0.5, 0, R + 0.8, 0, H);
  c.height = H;
};

export const minaret_tower: Builder = (k, c) => {
  const H = num(c, 'h', 72.5), R = num(c, 'r', 7.2), tiers = num(c, 'tiers', 5);
  const col = str(c, 'color', '#b8644a');
  const built = c.year < 1220 ? 1 : c.year < 1368 ? 3 : tiers;
  let y = 0, r = R;
  for (let t = 0; t < built; t++) {
    const th = (H / tiers) * (1 - t * 0.08);
    // fluted shaft (alternating round/angular ribs)
    k.cyl(r * 0.92, r, th, 24, tone(c, t >= 3 ? '#e8dcc8' : col), 0, y, 0);
    for (let f = 0; f < 12; f++) { const a = (f / 12) * Math.PI * 2; k.cyl(r * 0.12, r * 0.14, th, 4, tone(c, shade(col, 0.92)), Math.cos(a) * r * 0.92, y, Math.sin(a) * r * 0.92); }
    k.cyl(r * 1.2, r * 1.15, 1.2, 20, tone(c, shade(col, 0.85)), 0, y + th, 0);
    y += th + 1.2; r *= 0.82;
  }
  if (built === tiers) k.cyl(r * 0.6, r * 0.8, 3, 12, tone(c, '#e8dcc8'), 0, y, 0);
  cylCol(c, 0, 0, R, 0, y);
  // the courtyard ruins nearby
  for (let i = 0; i < 6; i++) k.box(4, c.rng.range(4, 12), 2, tone(c, '#a8907a'), -40 + i * 7, 0, 30);
  c.height = y + 3;
};

export const domed_mausoleum: Builder = (k, c) => {
  const P = num(c, 'platform', 95), D = num(c, 'dome', 24), H = num(c, 'h', 73), MH = num(c, 'minaretH', 40), G = num(c, 'garden', 300);
  const col = str(c, 'color', '#f6f2ec');
  const tc = tone(c, col);
  // garden with long reflecting pool towards the viewer (-z)
  c.waters.push({ x: 0, z: -G * 0.4, w: 8, d: G * 0.55, rot: 0, y: 0.45 });
  k.box(14, 0.5, G * 0.58, '#d8d0c4', 0, 0, -G * 0.4);
  for (let i = 0; i < 18; i++) for (const sx of [-1, 1]) k.cone(1.8, 7, 6, '#2e5a32', sx * 12, 0, -G * 0.15 - i * 9);
  k.box(P, 7, P, tone(c, '#ece6dc'), 0, 0, 0);
  boxCol(c, 0, 0, P, P, 0, 7);
  if (building(c)) {
    k.box(56, 20, 56, '#c8b89a', 0, 7, 0);
    scaffoldBox(k, 58, 58, 40, 0, 0, 4);
    k.dome(D * 0.9, 12, 5, '#d8c8a8', 0, 27, 0);
    c.height = 47; return;
  }
  const S = 57;
  k.box(S, 33, S, tc, 0, 7, 0);
  boxCol(c, 0, 0, S, S, 7, 40);
  // chamfered corners + great iwan arches
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2;
    k.push({ ry: a });
    k.box(18, 28, 0.6, tone(c, shade(col, 0.9)), 0, 7, -S / 2 - 0.1);
    k.box(12, 22, 0.8, tone(c, '#d8d0c4'), 0, 7, -S / 2 - 0.2);
    k.pyramid(12, 0.8, 6, tone(c, '#d8d0c4'), 0, 29, -S / 2 - 0.2, 0, 0.1, 0.8);
    k.pop();
    const ca = a + Math.PI / 4;
    k.cyl(4, 4, 36, 8, tc, Math.cos(ca) * S * 0.62, 7, Math.sin(ca) * S * 0.62);
    k.dome(4, 8, 4, tc, Math.cos(ca) * S * 0.38, 40, Math.sin(ca) * S * 0.38);
    k.cyl(3.6, 3.6, 4, 8, tc, Math.cos(ca) * S * 0.38, 40, Math.sin(ca) * S * 0.38);
  }
  // drum + onion dome + finial
  k.cyl(D * 0.8, D * 0.8, 9, 20, tc, 0, 40, 0);
  k.sphere(D, 20, 10, tc, 0, 49 + D * 0.55, 0, { sy: 0.95 });
  k.cone(D * 0.25, 6, 10, tc, 0, 49 + D * 1.4, 0);
  k.cyl(0.3, 0.3, 6, 6, '#e8c860', 0, 49 + D * 1.6, 0);
  // four minarets
  for (const [x, z] of [[-P / 2 + 4, -P / 2 + 4], [P / 2 - 4, -P / 2 + 4], [-P / 2 + 4, P / 2 - 4], [P / 2 - 4, P / 2 - 4]]) {
    k.cyl(2.6, 3, MH, 10, tc, x, 7, z);
    for (const y of [0.33, 0.66]) k.cyl(3.6, 3.6, 0.9, 10, tc, x, 7 + MH * y, z);
    k.dome(3.2, 8, 4, tc, x, 7 + MH + 3, z);
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; k.box(0.4, 3, 0.4, tc, x + Math.cos(a) * 2.8, 7 + MH, z + Math.sin(a) * 2.8); }
    cylCol(c, x, z, 3, 7, 7 + MH);
  }
  // red sandstone mosque and guest house either side
  for (const sx of [-1, 1]) { k.box(26, 14, 60, tone(c, '#a8503a'), sx * (P / 2 + 28), 0, 0); for (const dz of [-16, 0, 16]) k.dome(5, 10, 4, tc, sx * (P / 2 + 28), 14, dz); boxCol(c, sx * (P / 2 + 28), 0, 26, 60, 0, 14); }
  c.height = H;
};

export const clock_tower: Builder = (k, c) => {
  const H = num(c, 'h', 96), W = num(c, 'w', 12);
  const col = str(c, 'color', '#c8b48a'), roof = str(c, 'roof', '#3a4a4a');
  const chinese = str(c, 'style', '') === 'chinese';
  if (chinese) {
    // Su Song's water-driven astronomical clock tower
    if (isRuin(c)) { k.box(W, 1.5, W, tone(c, '#8a8478'), 0, 0, 0); for (let i = 0; i < 6; i++) k.box(0.4, c.rng.range(1, 4), 0.4, '#6b4a2e', c.rng.range(-W / 2, W / 2), 1.5, c.rng.range(-W / 2, W / 2)); c.height = 3; return; }
    k.box(W, 1.6, W, '#8a8478', 0, 0, 0);
    const levels = building(c) ? 2 : 3;
    for (let i = 0; i < levels; i++) {
      const y = 1.6 + i * (H / 3.4);
      k.box(W * (1 - i * 0.1), H / 3.4 - 1, W * (1 - i * 0.1), tone(c, i === 0 ? col : '#d8c8a8'), 0, y, 0);
      for (let j = 0; j < 4; j++) k.cyl(0.25, 0.25, H / 3.4 - 1, 5, tone(c, col), -W / 2 + 0.3 + j * (W - 0.6) / 3, y, -W / 2 * (1 - i * 0.1) - 0.3);
      k.pyramid(W * (1.35 - i * 0.1), W * (1.35 - i * 0.1), 1.2, tone(c, roof), 0, y + H / 3.4 - 1, 0, 0, W * (0.9 - i * 0.1), W * (0.9 - i * 0.1));
      // little figures in the windows announce the hours
      if (i === 0) for (let f = 0; f < 3; f++) k.box(0.4, 0.9, 0.3, '#c84a3a', -2 + f * 2, y + 1.2, -W / 2 - 0.1);
    }
    // the great water wheel on the side
    k.torus(3.8, 0.35, 4, 16, '#6b4a2e', { x: W / 2 + 1, y: 4.5, z: 0, ry: Math.PI / 2 });
    for (let s = 0; s < 8; s++) k.boxC(0.2, 7.4, 0.3, '#7a5a3a', { x: W / 2 + 1, y: 4.5, rx: (s * Math.PI) / 8 });
    // armillary sphere on the roof terrace
    if (!building(c) && bool(c, 'armillary')) {
      const top = 1.6 + 3 * (H / 3.4) + 0.8;
      for (const [rx, ry] of [[0, 0], [Math.PI / 2, 0], [Math.PI / 2, Math.PI / 2], [0.4, 0.3]]) k.torus(2, 0.12, 3, 20, '#c8a050', { y: top + 2.5, rx, ry });
      k.box(0.6, 1.6, 0.6, '#5a4a3a', 0, top, 0);
    } else if (building(c)) scaffoldBox(k, W, W, H * 0.7, 0, 0, 2);
    boxCol(c, 0, 0, W, W, 0, H);
    c.height = H + 4;
    return;
  }
  // Gothic clock tower (Elizabeth Tower)
  k.box(W, H * 0.55, W, tone(c, col), 0, 0, 0);
  for (let i = 0; i < 4; i++) { const a = (i * Math.PI) / 2; k.push({ ry: a }); for (let j = 0; j < 4; j++) k.box(0.6, H * 0.52, 0.4, tone(c, shade(col, 0.9)), -W / 2 + 1.5 + j * (W - 3) / 3, 0, -W / 2 - 0.2); k.pop(); }
  k.box(W * 1.1, H * 0.12, W * 1.1, tone(c, col), 0, H * 0.55, 0);
  k.curGlow = 0.7;
  for (let i = 0; i < 4; i++) { const a = (i * Math.PI) / 2; k.cyl(W * 0.4, W * 0.4, 0.3, 20, '#f2ead0', Math.sin(a) * (W * 0.56), H * 0.61, -Math.cos(a) * (W * 0.56), { rx: Math.PI / 2, rz: 0, ry: -a, y: H * 0.61 }); }
  k.curGlow = 0;
  for (let i = 0; i < 4; i++) { const a = (i * Math.PI) / 2; k.push({ ry: a }); k.boxC(0.3, W * 0.32, 0.1, '#1a1a1a', { y: H * 0.61, z: -W * 0.57, rz: 0.5 }); k.boxC(0.3, W * 0.22, 0.1, '#1a1a1a', { y: H * 0.61, z: -W * 0.58, rz: -1.2 }); k.pop(); }
  k.box(W, H * 0.08, W, tone(c, col), 0, H * 0.67, 0);
  k.pyramid(W * 1.05, W * 1.05, H * 0.18, tone(c, roof), 0, H * 0.75, 0, 0, W * 0.3, W * 0.3);
  k.cyl(0.2, 1.2, H * 0.08, 8, tone(c, '#c8a050'), 0, H * 0.93, 0);
  boxCol(c, 0, 0, W, W, 0, H * 0.75);
  if (bool(c, 'palace')) { k.box(240, 22, 30, tone(c, col), -130, 0, 10); for (let i = 0; i < 40; i++) k.box(0.8, 4, 0.8, tone(c, shade(col, 0.9)), -250 + i * 6, 22, -5); boxCol(c, -130, 10, 240, 30, 0, 22); }
  if (building(c)) scaffoldBox(k, W, W, H * (c.year > 2000 ? 0.95 : 0.6), 0, 0, 3);
  c.height = H;
};
