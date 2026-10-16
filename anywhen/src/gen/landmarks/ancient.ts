// Ancient and pre-modern landmark builders.
import { MeshKit, shade, mixCol } from '../meshkit';
import { type Builder, type LmCtx, num, str, bool, tone, isRuin, building, boxCol, cylCol, scaffoldBox, rubble, column } from './common';

/** Pyramids (smooth or stepped). params.layout = [[dx, dz, scale, base, height], ...] */
export const pyramid: Builder = (k, c) => {
  const layout = (c.p.layout as number[][]) ?? [[0, 0, 1, 100, 60]];
  const steps = num(c, 'steps', 0);
  const casing = str(c, 'casing', '#f0e8d0'), core = str(c, 'core', '#c8a46e');
  layout.forEach(([dx, dz, , base, height], idx) => {
    k.push({ x: dx, z: dz });
    let H = height;
    if (building(c) && idx === 0) H = height * 0.62;
    if (steps === 0) {
      const smooth = c.state === 'complete' || (c.state === 'construction' && idx > 0) || false;
      if (smooth) {
        k.pyramid(base, base, H, tone(c, casing), 0, 0, 0, 0);
        if (c.p.cap && c.state === 'complete' && idx === 0) { k.curGlow = 0.25; k.pyramid(base * 0.04, base * 0.04, H * 0.04, str(c, 'cap', '#e8c860'), 0, H * 0.96, 0); k.curGlow = 0; }
      } else {
        // weathered: rough stepped core, Khafre keeps a casing cap
        const n = 22;
        for (let i = 0; i < n; i++) {
          const t0 = i / n, s = base * (1 - t0) , hh = H / n;
          k.box(s, hh * 1.01, s, shade(tone(c, core), 0.94 + (i % 2) * 0.06), 0, t0 * H, 0);
        }
        if (idx === 1 && c.state !== 'construction') k.pyramid(base * 0.22, base * 0.22, H * 0.22, tone(c, casing), 0, H * 0.78, 0);
        if (c.state === 'construction' && idx === 0) {
          // ramp + scaffold for the pyramid being built
          k.box(base * 0.12, H * 0.5, base * 0.9, '#b8945e', base * 0.62, 0, 0, 0, { rz: 0 });
          k.tris([base / 2, 0, -base * 0.45, base * 1.1, 0, -base * 0.45, base / 2, H * 0.98, -base * 0.45, base / 2, 0, base * 0.45, base / 2, H * 0.98, base * 0.45, base * 1.1, 0, base * 0.45,
            base / 2, H * 0.98, -base * 0.45, base * 1.1, 0, -base * 0.45, base * 1.1, 0, base * 0.45, base / 2, H * 0.98, -base * 0.45, base * 1.1, 0, base * 0.45, base / 2, H * 0.98, base * 0.45], '#c8a46e');
          for (let i = 0; i < 40; i++) k.box(1.5, 1, 1.5, '#e8dcc0', c.rng.range(-base * 0.7, base * 0.9), 0, c.rng.range(base * 0.55, base * 0.8));
        }
      }
      // stacked colliders approximate the slopes
      for (let i = 0; i < 8; i++) { const s = base * (1 - i / 8); boxCol(c, dx, dz, s, s, (i * H) / 8, ((i + 1) * H) / 8); }
    } else {
      // stepped temple pyramid (Mesoamerica)
      const steep = bool(c, 'steep');
      const topW = base * (steep ? 0.25 : 0.32);
      for (let i = 0; i < steps; i++) {
        const t = i / steps;
        const s = base - (base - topW) * t;
        const hh = H / steps;
        k.box(s, hh * 0.92, s, tone(c, i % 2 ? casing : shade(casing, 0.94)), 0, t * H, 0);
        k.box(s + 0.6, hh * 0.08, s + 0.6, tone(c, shade(core, 0.9)), 0, t * H + hh * 0.92, 0);
        boxCol(c, dx, dz, s, s, t * H, t * H + hh);
      }
      const nst = num(c, 'stairs', 4);
      for (let si = 0; si < nst; si++) {
        const a = (si * Math.PI) / 2;
        k.push({ ry: a });
        const len = (base - topW) / 2;
        const ang = Math.atan2(H, len);
        k.boxC(base * 0.12, 1, Math.hypot(H, len), tone(c, shade(casing, 1.05)), { y: H / 2, z: -(topW / 2 + len / 2), rx: -ang + 0 });
        k.boxC(0.6, 1.4, Math.hypot(H, len), tone(c, shade(core, 0.8)), { x: base * 0.065, y: H / 2 + 0.3, z: -(topW / 2 + len / 2), rx: -ang });
        k.boxC(0.6, 1.4, Math.hypot(H, len), tone(c, shade(core, 0.8)), { x: -base * 0.065, y: H / 2 + 0.3, z: -(topW / 2 + len / 2), rx: -ang });
        k.pop();
      }
      if (bool(c, 'temple') && !isRuin(c)) {
        k.box(topW * 0.7, H * 0.13, topW * 0.6, tone(c, casing), 0, H, 0);
        k.box(topW * 0.2, H * 0.08, 0.3, '#2a2420', 0, H, -topW * 0.3);
        k.box(topW * 0.78, H * 0.02, topW * 0.68, tone(c, shade(core, 0.85)), 0, H * 1.13, 0);
        if (bool(c, 'comb')) k.box(topW * 0.55, H * 0.2, topW * 0.12, tone(c, casing), 0, H * 1.15, topW * 0.1);
        boxCol(c, dx, dz, topW * 0.7, topW * 0.6, H, H * 1.13);
      }
      if (isRuin(c)) {
        for (let i = 0; i < 30; i++) k.blob(c.rng.range(1.5, 4), '#3e6e2e', c.rng.range(-base / 2, base / 2), c.rng.range(0, H * 0.8), c.rng.range(-base / 2, base / 2));
      }
    }
    k.pop();
  });
  if (c.p.sphinx && (c.state !== 'construction')) {
    const [sx, sz] = c.p.sphinx as number[];
    k.push({ x: sx, z: sz, ry: -Math.PI / 2 });
    const col = tone(c, '#d2b07a');
    k.box(12, 9, 50, col, 0, 0, 4);
    k.box(10, 10, 9, col, 0, 6, -20);
    k.box(12, 4, 6, col, 0, 13, -21);
    k.boxC(9, 3, 3, tone(c, '#c8a46e'), { y: 11, z: -25 });
    k.box(4, 3, 14, col, -4, 0, -28); k.box(4, 3, 14, col, 4, 0, -28);
    k.pop();
    boxCol(c, sx, sz, 50, 12, 0, 16, 0);
  }
  if (bool(c, 'causeway')) k.box(8, 0.6, 400, tone(c, '#d8c4a0'), 160, 0, 250, 0.6);
  if (bool(c, 'avenue')) k.box(40, 0.3, 1600, tone(c, '#b89a7a'), -150, 0, -300, 0.27);
  c.height = Math.max(...layout.map((l) => l[4]));
};

export const ziggurat: Builder = (k, c) => {
  const [bw, bd] = (c.p.base as number[]) ?? [64, 46];
  const H = num(c, 'h', 30), tiers = num(c, 'tiers', 3);
  const col = str(c, 'color', '#b8946a');
  const built = building(c) ? 2 : isRuin(c) ? 1.4 : tiers;
  for (let i = 0; i < Math.ceil(built); i++) {
    const s = 1 - i * 0.28;
    const hh = (H / tiers) * (i + 1 > built ? built - i : 1);
    k.box(bw * s, hh, bd * s, tone(c, shade(col, 1 - i * 0.05)), 0, (i * H) / tiers, 0);
    // buttress stripes
    for (let j = 0; j < 9; j++) k.box(1.2, hh, 0.5, tone(c, shade(col, 0.9)), -bw * s / 2 + (j + 0.5) * (bw * s / 9), (i * H) / tiers, -bd * s / 2 - 0.2);
    boxCol(c, 0, 0, bw * s, bd * s, (i * H) / tiers, (i * H) / tiers + hh);
  }
  if (!isRuin(c)) {
    // three converging stairways on the front
    for (const a of [-0.6, 0, 0.6]) k.boxC(5, 1, H * 1.2, tone(c, shade(col, 1.08)), { x: a * bw * 0.25, y: H * 0.3, z: -bd / 2 - H * 0.3, rx: -0.6, ry: a * 0.5 });
    if (c.state === 'complete') { k.box(bw * 0.18, 5, bd * 0.18, tone(c, '#e2c89a'), 0, H, 0); k.box(bw * 0.2, 0.8, bd * 0.2, '#3a6aa8', 0, H + 5, 0); }
  }
  if (building(c)) scaffoldBox(k, bw * 0.75, bd * 0.75, H * 0.75);
  c.height = H + 6;
};

export const stone_circle: Builder = (k, c) => {
  const R = num(c, 'radius', 16.5), n = num(c, 'stones', 30), H = num(c, 'h', 4.1);
  const col = str(c, 'color', '#9a968a');
  const bank = num(c, 'bank', 55);
  // ditch and bank
  k.torus(bank, 1.2, 3, 40, tone(c, '#7a8a52'), { y: 0.1, rx: Math.PI / 2, sz: 0.4 });
  const placed = building(c) ? Math.floor(n * 0.35) : n;
  for (let i = 0; i < placed; i++) {
    const a = (i / n) * Math.PI * 2;
    const fallen = (c.state === 'weathered' || c.state === 'restored') && c.rng.chance(c.state === 'restored' ? 0.35 : 0.45);
    const x = Math.cos(a) * R, z = Math.sin(a) * R;
    if (fallen) { k.boxC(2.1, 1.1, H, tone(c, col), { x: x * 1.08, y: 0.5, z: z * 1.08, ry: -a + c.rng.range(-0.4, 0.4), rx: Math.PI / 2 }); continue; }
    k.box(2.1, H, 1.1, tone(c, shade(col, c.rng.range(0.92, 1.05))), x, 0, z, -a + Math.PI / 2);
    cylCol(c, x, z, 1.1, 0, H);
    // lintels
    if (i % 1 === 0 && (c.state === 'complete' || c.rng.chance(0.4))) {
      const a2 = ((i + 0.5) / n) * Math.PI * 2;
      k.boxC(3.4, 0.8, 1.0, tone(c, shade(col, 0.95)), { x: Math.cos(a2) * R, y: H + 0.4, z: Math.sin(a2) * R, ry: -a2 + Math.PI / 2 });
    }
  }
  // trilithon horseshoe
  if (!building(c)) {
    const tri = num(c, 'trilithons', 5);
    for (let i = 0; i < tri; i++) {
      const a = Math.PI * 0.3 + (i / (tri - 1)) * Math.PI * 1.4;
      const r = R * 0.55, x = Math.cos(a) * r, z = Math.sin(a) * r;
      const th = H * (1.3 + (i === 2 ? 0.4 : 0));
      if ((c.state === 'weathered' || c.state === 'restored') && i === 3) { k.boxC(2.2, 1.2, th, tone(c, col), { x, y: 0.6, z, rx: Math.PI / 2, ry: a }); continue; }
      for (const s of [-1.3, 1.3]) k.box(1.8, th, 1.2, tone(c, col), x + Math.sin(a) * s, 0, z - Math.cos(a) * s, -a + Math.PI / 2);
      k.boxC(4.6, 0.9, 1.2, tone(c, col), { x, y: th + 0.45, z, ry: -a + Math.PI / 2 });
      cylCol(c, x, z, 2.2, 0, th + 0.9);
    }
    // heel stone along the midsummer sunrise axis (north-east)
    k.box(2.4, 4.7, 2, tone(c, '#a89a82'), R * 4.2 * Math.cos(-0.87), 0, R * 4.2 * Math.sin(-0.87), 0.3, { rz: 0.15 });
  } else {
    // stones being hauled on sledges
    for (let i = 0; i < 3; i++) { k.boxC(2.1, 1.1, 4, tone(c, col), { x: 30 + i * 9, y: 0.9, z: -20 - i * 6 }); k.box(2.5, 0.3, 5, '#7a5a3a', 30 + i * 9, 0, -20 - i * 6); }
  }
  c.height = H + 3;
};

export const temple_columns: Builder = (k, c) => {
  const W = num(c, 'w', 31), L = num(c, 'l', 70), nx = num(c, 'colsX', 8), nz = num(c, 'colsZ', 17), CH = num(c, 'colH', 10.4);
  const col = str(c, 'color', '#efe6d2');
  // stepped platform (stylobate)
  for (let i = 0; i < 3; i++) k.box(W + 6 - i * 2, 0.55, L + 6 - i * 2, tone(c, shade(col, 0.96)), 0, i * 0.55, 0);
  const y0 = 1.65;
  boxCol(c, 0, 0, W + 6, L + 6, 0, y0);
  const ruinMid = (x: number, z: number) => c.state === 'ruined' && Math.abs(z) < L * 0.2 && Math.abs(x) < W * 0.48;
  for (let i = 0; i < nx; i++) for (const zz of [-1, 1]) {
    const x = -W / 2 + 1 + (i * (W - 2)) / (nx - 1), z = zz * (L / 2 - 1);
    if (building(c) && c.rng.chance(0.3)) { column(k, x, z, CH * c.rng.range(0.3, 0.7), 0.95, tone(c, col), y0); continue; }
    column(k, x, z, CH, 0.95, tone(c, col), y0);
    cylCol(c, x, z, 1, y0, y0 + CH);
  }
  for (let j = 1; j < nz - 1; j++) for (const xx of [-1, 1]) {
    const x = xx * (W / 2 - 1), z = -L / 2 + 1 + (j * (L - 2)) / (nz - 1);
    if (ruinMid(x * 0.5, z)) continue;
    column(k, x, z, CH, 0.95, tone(c, col), y0);
    cylCol(c, x, z, 1, y0, y0 + CH);
  }
  // cella walls
  if (!isRuin(c) || true) k.box(W * 0.6, CH * (c.state === 'ruined' ? 0.25 : 0.95), L * 0.62, tone(c, shade(col, 0.94)), 0, y0, 0);
  if (c.state !== 'ruined' && !building(c)) {
    // entablature + frieze
    k.box(W, 1.4, L, tone(c, col), 0, y0 + CH, 0);
    k.box(W + 0.1, 0.8, L + 0.1, bool(c, 'paint') && c.state === 'complete' ? '#3a5ea8' : tone(c, shade(col, 0.92)), 0, y0 + CH + 1.4, 0);
    k.gable(W, 4.2, L, tone(c, bool(c, 'paint') && c.state === 'complete' ? '#c8604a' : shade(col, 0.95)), 0, y0 + CH + 2.2, 0, 0, 0.4);
    boxCol(c, 0, 0, W, L, y0 + CH, y0 + CH + 6);
  } else if (c.state === 'ruined') {
    for (const zz of [-1, 1]) { k.box(W, 1.4, 8, tone(c, col), 0, y0 + CH, zz * (L / 2 - 4)); k.gable(W, 4.2, 1.5, tone(c, col), 0, y0 + CH + 1.4, zz * (L / 2 - 1)); }
    rubble(k, c.rng, col, 40, W * 0.6);
  }
  if (building(c)) scaffoldBox(k, W, L, CH + 3, 0, 0, 3);
  // the Acropolis hill top & its gateway steps
  if (c.p.hill) for (let i = 0; i < 8; i++) k.box(14, 1.2, 4, tone(c, '#c8b8a0'), -W, -i * 1.2 - 1, L / 2 + 10 + i * 3);
  c.height = y0 + CH + 6;
};

export const pantheon: Builder = (k, c) => {
  const R = num(c, 'radius', 21.7), H = num(c, 'h', 43.3), P = num(c, 'portico', 16);
  const col = str(c, 'color', '#d8ccb4');
  k.cyl(R + 1.4, R + 1.4, H * 0.5, 24, tone(c, shade(col, 0.95)), 0, 0, 0);
  k.cyl(R + 2, R + 2, H * 0.06, 24, tone(c, col), 0, H * 0.45, 0);
  k.dome(R + 1.2, 24, 8, tone(c, c.state === 'complete' ? '#c8b088' : '#9a9a92'), 0, H * 0.5, 0, { sy: 0.85 });
  k.cyl(4.1, 4.1, 0.6, 12, '#2a2620', 0, H * 0.5 + (R + 1.2) * 0.85 - 0.4, 0);
  cylCol(c, 0, 0, R + 1.4, 0, H);
  // portico with 8 columns and pediment
  k.box(34, 1.2, P + 8, tone(c, col), 0, 0, -R - P / 2 + 2);
  for (let i = 0; i < 8; i++) { column(k, -15 + i * (30 / 7), -R - P + 2, 14, 0.75, tone(c, col), 1.2); cylCol(c, -15 + i * (30 / 7), -R - P + 2, 0.8, 0, 15); }
  k.box(33, 3, P + 4, tone(c, col), 0, 15.2, -R - P / 2 + 2);
  k.gable(33, 6, 2, tone(c, col), 0, 18.2, -R - P + 1, 0, 0.2);
  k.gable(33, 6, P, tone(c, shade(col, 0.9)), 0, 18.2, -R - P / 2 + 2, 0, 0.2);
  c.height = H;
};

export const column_hall: Builder = (k, c) => {
  const [pw, pl, ph] = (c.p.platform as number[]) ?? [300, 450, 12];
  const cols = num(c, 'cols', 6), rows = num(c, 'rows', 6), CH = num(c, 'colH', 19), sp = num(c, 'spacing', 8.5);
  const col = str(c, 'color', '#c8b89a');
  k.box(pw * 0.4, ph, pl * 0.3, tone(c, shade(col, 0.9)), 0, 0, 0);
  boxCol(c, 0, 0, pw * 0.4, pl * 0.3, 0, ph);
  // grand double staircase
  for (const sx of [-1, 1]) k.boxC(9, 1, ph * 2.2, tone(c, col), { x: sx * 18, y: ph / 2, z: -pl * 0.15 - ph * 0.9, rx: -0.42 });
  const halls = num(c, 'halls', 4);
  for (let hIdx = 0; hIdx < halls; hIdx++) {
    const hx = (hIdx % 2 - 0.5) * 50, hz = (Math.floor(hIdx / 2) - 0.5) * 50;
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      const x = hx + (i - (cols - 1) / 2) * sp, z = hz + (j - (rows - 1) / 2) * sp;
      if (isRuin(c) && c.rng.chance(0.82)) { if (c.rng.chance(0.4)) k.cyl(0.8, 0.9, c.rng.range(1, 4), 8, tone(c, col), x, ph, z); continue; }
      const hh = CH * (building(c) ? c.rng.range(0.3, 1) : 1);
      column(k, x, z, hh, 0.85, tone(c, col), ph, 10);
      if (!isRuin(c)) k.box(3.5, 1.4, 1.4, tone(c, shade(col, 0.85)), x, ph + hh, z);
      cylCol(c, x, z, 0.9, ph, ph + hh);
    }
    if (!isRuin(c) && !building(c)) k.box(cols * sp + 2, 1.5, rows * sp + 2, tone(c, '#7a5a3a'), hx, ph + CH + 1.3, hz);
  }
  // carved gateway
  k.box(10, 16, 14, tone(c, col), 0, ph, -pl * 0.13);
  if (isRuin(c)) rubble(k, c.rng, col, 60, 60, 0, 0);
  c.height = ph + CH + 3;
};

export const amphitheater: Builder = (k, c) => {
  const RX = num(c, 'rx', 94), RZ = num(c, 'rz', 78), H = num(c, 'h', 48), tiers = num(c, 'tiers', 4), n = num(c, 'arches', 80);
  const col = str(c, 'color', '#d8c4a0');
  const seg = 64;
  const th = H / tiers;
  for (let s = 0; s < seg; s++) {
    const a0 = (s / seg) * Math.PI * 2, a1 = ((s + 1) / seg) * Math.PI * 2, am = (a0 + a1) / 2;
    const ruinedSide = (c.state === 'ruined' || c.state === 'restored') && Math.sin(am) > 0.25;
    const levels = building(c) ? (s < seg * 0.6 ? 2 : 1) : ruinedSide ? 2 : tiers;
    const x = Math.cos(am) * RX, z = Math.sin(am) * RZ;
    const segLen = Math.hypot(Math.cos(a1) * RX - Math.cos(a0) * RX, Math.sin(a1) * RZ - Math.sin(a0) * RZ) + 0.3;
    const ang = Math.atan2(Math.sin(a1) * RZ - Math.sin(a0) * RZ, Math.cos(a1) * RX - Math.cos(a0) * RX);
    for (let t = 0; t < levels; t++) {
      // outer arcade wall: two piers + lintel per segment, leaving an arch opening
      k.boxC(segLen * 0.3, th, 3, tone(c, col), { x: x - Math.cos(ang) * segLen * 0.35, y: t * th + th / 2, z: z - Math.sin(ang) * segLen * 0.35, ry: -ang });
      k.boxC(segLen * 0.3, th, 3, tone(c, col), { x: x + Math.cos(ang) * segLen * 0.35, y: t * th + th / 2, z: z + Math.sin(ang) * segLen * 0.35, ry: -ang });
      k.boxC(segLen, th * 0.28, 3, tone(c, shade(col, 0.96)), { x, y: t * th + th * 0.86, z, ry: -ang });
      if (t === tiers - 1) k.boxC(segLen, th * 0.3, 3, tone(c, shade(col, 0.98)), { x, y: t * th + th * 1.1, z, ry: -ang });
    }
    c.colliders.push({ k: 'box', x, z, hw: segLen / 2, hd: 2.5, rot: ang, y0: 0, y1: levels * th });
    // seating ring sloping inward
    for (let r = 0; r < 5; r++) {
      const f = 0.92 - r * 0.08;
      k.boxC(segLen * f, 2.5, 10, tone(c, shade(col, 0.88 + r * 0.02)), { x: Math.cos(am) * RX * f, y: (5 - r) * 3.6, z: Math.sin(am) * RZ * f, ry: -ang });
    }
  }
  // arena floor
  k.cyl(1, 1, 0.4, 32, tone(c, '#e2d2a8'), 0, 0, 0, { sx: RX * 0.45, sz: RZ * 0.45, sy: 0.4 });
  void n;
  if (building(c)) scaffoldBox(k, RX * 1.6, RZ * 1.6, th * 2.5, 0, 0, 4);
  c.height = H;
};

export const rock_facade: Builder = (k, c) => {
  const W = num(c, 'w', 25), H = num(c, 'h', 39), CW = num(c, 'cliffW', 160), CHh = num(c, 'cliffH', 70);
  const cliff = str(c, 'cliff', '#d08a6a'), carve = str(c, 'carve', '#e2a284');
  // cliff mass behind
  k.box(CW, CHh, 40, cliff, 0, 0, 24);
  for (let i = 0; i < 12; i++) k.rock(c.rng.range(8, 18), shade(cliff, c.rng.range(0.85, 1.05)), c.rng.range(-CW / 2, CW / 2), CHh + c.rng.range(-4, 3), 24 + c.rng.range(-15, 15), { sy: 0.6 });
  boxCol(c, 0, 24, CW, 40, 0, CHh);
  // the Siq canyon walls toward the viewer
  if (bool(c, 'canyon')) for (const sx of [-1, 1]) { k.box(40, CHh, 120, cliff, sx * 34, 0, -60); boxCol(c, sx * 34, -60, 40, 120, 0, CHh); }
  if (building(c)) { scaffoldBox(k, W, 6, H * 0.5, 0, 0, 3); return; }
  const tc = tone(c, carve);
  k.box(W, H * 0.45, 2, tc, 0, 0, 3.5);
  const nc = num(c, 'columns', 6);
  for (let i = 0; i < nc; i++) column(k, -W / 2 + 1.5 + (i * (W - 3)) / (nc - 1), 2.2, H * 0.4, 0.75, tc, 0);
  k.box(W, 2.5, 3, tc, 0, H * 0.4, 2.5);
  k.gable(W, 4, 1.5, tc, 0, H * 0.4 + 2.5, 2.5, 0, 0);
  // upper tholos
  k.cyl(4, 4, H * 0.3, 12, tc, 0, H * 0.55, 3.5);
  k.cone(4.5, 4, 12, tc, 0, H * 0.85, 3.5);
  for (const sx of [-1, 1]) { k.box(5, H * 0.3, 3, tc, sx * 9, H * 0.55, 3.2); k.box(5.5, 1, 3.4, tc, sx * 9, H * 0.85, 3.2); }
  k.box(3.5, 7, 0.4, '#3a2420', 0, 0, 2);
  c.height = CHh;
};

export const rock_temple: Builder = (k, c) => {
  const W = num(c, 'w', 38), H = num(c, 'h', 30), n = num(c, 'colossi', 4);
  const cliff = str(c, 'cliff', '#d8a878');
  k.box(W * 2.4, H * 1.3, 40, cliff, 0, 0, 22);
  boxCol(c, 0, 22, W * 2.4, 40, 0, H * 1.3);
  k.box(W, H, 3, tone(c, shade(cliff, 1.05)), 0, 0, 1.5);
  const sanded = c.state === 'weathered';
  for (let i = 0; i < n; i++) {
    const x = -W / 2 + W / (n * 2) + (i * W) / n;
    const col = tone(c, '#e0b080');
    if (i === 1 && c.state !== 'complete') { k.box(6, 5, 6, col, x, 0, -3); k.blob(3, col, x - 3, 1.5, -6); continue; } // the fallen head
    k.box(6.5, 9, 7, col, x, 0, -3); // legs/lap
    k.box(7, 9, 4.5, col, x, 9, -0.6); // torso
    k.box(3.6, 4.2, 3.6, col, x, 18, -1); // head
    k.box(5.6, 3.5, 3.4, tone(c, '#d8a070'), x, 17.2, -0.4); // headdress
    k.box(2.4, 3.6, 2.4, tone(c, '#e8c090'), x, 21.8, -0.8); // crown
    boxCol(c, x, -3, 7, 7, 0, 9);
  }
  k.box(5, 8, 0.4, '#2a1a10', 0, 0, -0.1);
  if (sanded) k.box(W * 2.2, H * 0.45, 24, '#e2c890', 0, 0, -10, 0, { rx: 0.25 });
  if (building(c)) scaffoldBox(k, W, 6, H, 0, -3, 3);
  c.height = H;
};

export const lighthouse: Builder = (k, c) => {
  const H = num(c, 'h', 100), B = num(c, 'base', 30);
  const col = str(c, 'color', '#ece4d0');
  if (isRuin(c)) { k.box(B, 12, B, tone(c, col), 0, 0, 0); rubble(k, c.rng, col, 50, B); boxCol(c, 0, 0, B, B, 0, 12); c.height = 12; return; }
  if (c.state === 'restored') {
    // the later citadel on the site
    k.box(42, 14, 42, tone(c, '#d8c8a8'), 0, 0, 0);
    for (const [x, z] of [[-21, -21], [21, -21], [-21, 21], [21, 21]]) { k.cyl(4, 4.4, 18, 10, tone(c, '#d8c8a8'), x, 0, z); }
    k.box(18, 22, 18, tone(c, '#e2d4b4'), 0, 0, 0);
    boxCol(c, 0, 0, 42, 42, 0, 22);
    c.height = 22;
    return;
  }
  k.box(B * 2.4, 6, B * 2.4, tone(c, shade(col, 0.9)), 0, 0, 0);
  const H1 = H * 0.55, H2 = H * 0.27, H3 = H * 0.12;
  const sc = building(c) ? 0.6 : 1;
  k.pyramid(B, B, H1 * sc, tone(c, col), 0, 6, 0, 0, B * 0.82, B * 0.82);
  for (let i = 0; i < 12; i++) k.box(1.6, 2, 0.4, '#3a3026', (i % 3 - 1) * 6, 12 + Math.floor(i / 3) * 12, -B / 2 + 0.6);
  boxCol(c, 0, 0, B, B, 0, 6 + H1 * sc);
  if (!building(c)) {
    k.cyl(B * 0.34, B * 0.4, H2, 8, tone(c, col), 0, 6 + H1, 0);
    k.cyl(B * 0.22, B * 0.24, H3, 12, tone(c, col), 0, 6 + H1 + H2, 0);
    k.curGlow = 1; k.cyl(B * 0.15, B * 0.15, 3, 8, '#ffb84a', 0, 6 + H1 + H2 + H3, 0); k.curGlow = 0;
    k.cone(B * 0.2, 6, 8, tone(c, col), 0, 9 + H1 + H2 + H3, 0);
    k.box(1.5, 5, 1.5, '#c8a050', 0, 15 + H1 + H2 + H3, 0);
  } else scaffoldBox(k, B, B, H1 * 0.7, 0, 0, 5);
  c.height = H;
};

export const stupa: Builder = (k, c) => {
  const R = num(c, 'r', 18), H = num(c, 'h', 16), gates = num(c, 'gates', 4);
  const col = str(c, 'color', '#c8b8a0');
  k.cyl(R + 3, R + 3, 4, 24, tone(c, shade(col, 0.95)), 0, 0, 0);
  k.cyl(R + 2.6, R + 2.6, 1.6, 24, tone(c, shade(col, 0.9)), 0, 4, 0);
  if (!building(c)) {
    k.dome(R, 20, 8, tone(c, col), 0, 4, 0, { sy: H / R });
    k.box(5, 2, 5, tone(c, shade(col, 0.9)), 0, 4 + H, 0);
    for (let i = 0; i < 3; i++) k.cyl(2.6 - i * 0.6, 2.6 - i * 0.6, 0.35, 10, tone(c, shade(col, 0.85)), 0, 6.8 + H + i * 1.2, 0);
    k.cyl(0.25, 0.25, 4, 6, tone(c, col), 0, 6 + H, 0);
  } else k.dome(R * 0.98, 16, 6, '#a8885a', 0, 4, 0, { sy: H / R * 0.6 });
  cylCol(c, 0, 0, R + 1, 0, 4 + H);
  // railing and torana gateways
  for (let i = 0; i < 36; i++) { const a = (i / 36) * Math.PI * 2; k.box(0.6, 3, 0.6, tone(c, col), Math.cos(a) * (R + 8), 0, Math.sin(a) * (R + 8)); }
  k.torus(R + 8, 0.35, 3, 36, tone(c, col), { y: 2.4, rx: Math.PI / 2 });
  if (c.state !== 'construction' && c.year >= -100) for (let g = 0; g < gates; g++) {
    const a = (g * Math.PI) / 2;
    k.push({ x: Math.cos(a) * (R + 11), z: Math.sin(a) * (R + 11), ry: -a + Math.PI / 2 });
    for (const sx of [-2.2, 2.2]) k.box(0.8, 8.5, 0.8, tone(c, '#b8a488'), sx, 0, 0);
    for (let i = 0; i < 3; i++) k.boxC(7 + (i === 0 ? 1.2 : 0), 0.6, 0.7, tone(c, '#b8a488'), { y: 6.2 + i * 1.1 });
    k.pop();
  }
  c.height = H + 12;
};

export const stepped_terraces: Builder = (k, c) => {
  const B = num(c, 'base', 123), L = num(c, 'levels', 9), H = num(c, 'h', 35), S = num(c, 'stupas', 72);
  const col = str(c, 'color', '#8a8478');
  const built = building(c) ? 4 : L;
  for (let i = 0; i < built; i++) {
    const sq = i < 6;
    const s = B * (1 - i * 0.085);
    const hh = (H * 0.7) / L * (i < 6 ? 1.2 : 0.7);
    const y = i * (H * 0.7) / L;
    if (sq) { k.box(s, hh, s, tone(c, shade(col, 1 - i * 0.02)), 0, y, 0); k.box(s + 1, 1.4, s + 1, tone(c, shade(col, 0.9)), 0, y + hh - 0.6, 0); }
    else k.cyl(s / 2, s / 2 + 1, hh, 24, tone(c, col), 0, y, 0);
    boxCol(c, 0, 0, s, s, y, y + hh);
  }
  if (!building(c)) {
    const rings = [32, 24, 16];
    let si = 0;
    rings.forEach((n, ri) => {
      const r = B * (0.27 - ri * 0.06), y = (6 + ri) * (H * 0.7) / L + 2;
      for (let i = 0; i < n && si < S; i++, si++) {
        const a = (i / n) * Math.PI * 2;
        k.dome(1.6, 8, 4, tone(c, shade(col, 1.05)), Math.cos(a) * r, y, Math.sin(a) * r, { sy: 1.3 });
        k.cyl(0.25, 0.4, 1.4, 6, tone(c, col), Math.cos(a) * r, y + 2, Math.sin(a) * r);
      }
    });
    k.dome(6, 14, 6, tone(c, shade(col, 1.05)), 0, H * 0.72, 0, { sy: 1.25 });
    k.cyl(0.6, 1.2, 6, 8, tone(c, col), 0, H * 0.72 + 7, 0);
  }
  // stairways on four sides
  for (let s = 0; s < 4; s++) k.push({ ry: (s * Math.PI) / 2 }).boxC(6, 1, H * 0.9, tone(c, shade(col, 1.08)), { y: H * 0.3, z: -B * 0.36, rx: -0.75 }).pop();
  if (isRuin(c)) for (let i = 0; i < 40; i++) k.blob(c.rng.range(2, 6), '#3e6e2e', c.rng.range(-B / 2, B / 2), c.rng.range(0, H * 0.6), c.rng.range(-B / 2, B / 2));
  c.height = H + 8;
};

export const temple_mountain: Builder = (k, c) => {
  const M = num(c, 'moat', 1300), W = num(c, 'w', 215), H = num(c, 'h', 65);
  const col = str(c, 'color', '#9a9078');
  // moat water (rect) and enclosure wall
  c.waters.push({ x: 0, z: 0, w: M, d: M * 0.88, rot: 0, y: -0.4 });
  k.box(M * 0.85, 0.4, M * 0.75, tone(c, '#7a8a52'), 0, -0.2, 0);
  for (const [x, z, w, d] of [[0, -M * 0.375, M * 0.85, 4], [0, M * 0.375, M * 0.85, 4], [-M * 0.425, 0, 4, M * 0.75], [M * 0.425, 0, 4, M * 0.75]] as const) { k.box(w, 4.5, d, tone(c, col), x, 0, z); boxCol(c, x, z, w, d, 0, 4.5); }
  // causeway west -> we use -z as front
  k.box(12, 1.6, M * 0.45, tone(c, col), 0, -0.6, -M * 0.42);
  // three galleried terraces
  for (let i = 0; i < 3; i++) {
    const s = W * (1 - i * 0.28), y = i * 7;
    k.box(s, 7, s * 0.9, tone(c, shade(col, 1 - i * 0.03)), 0, y, 0);
    k.box(s + 1.5, 1.2, s * 0.9 + 1.5, tone(c, shade(col, 0.85)), 0, y + 6.5, 0);
    for (let j = 0; j < 4; j++) { const a = (j * Math.PI) / 2 + Math.PI / 4; k.cyl(3, 4, 8, 8, tone(c, col), Math.cos(a) * s * 0.66, y + 7, Math.sin(a) * s * 0.6); k.cone(3.2, 8, 8, tone(c, col), Math.cos(a) * s * 0.66, y + 15, Math.sin(a) * s * 0.6); }
    boxCol(c, 0, 0, s, s * 0.9, y, y + 7);
  }
  // quincunx of lotus-bud towers
  const towers = num(c, 'towers', 5);
  const tw = (x: number, z: number, h: number) => {
    const sc = building(c) ? 0.5 : 1;
    for (let i = 0; i < 6; i++) k.cyl(7 - i * 1.0, 7.5 - i * 1.0, (h * sc) / 6, 8, tone(c, shade(col, 1 - i * 0.02)), x, 21 + (i * h * sc) / 6, z);
    k.cone(1.6, 5, 8, tone(c, col), x, 21 + h * sc, z);
    cylCol(c, x, z, 7, 21, 21 + h * sc);
  };
  tw(0, 0, H - 21);
  if (towers >= 5) for (const [x, z] of [[-30, -26], [30, -26], [-30, 26], [30, 26]]) tw(x, z, (H - 21) * 0.62);
  if (building(c)) scaffoldBox(k, 40, 40, 30, 0, 0, 4);
  if (c.state === 'weathered') for (let i = 0; i < 25; i++) k.blob(c.rng.range(2, 5), '#4a7a3a', c.rng.range(-W / 2, W / 2), c.rng.range(0, 10), c.rng.range(-W / 2, W / 2));
  c.height = H + 6;
};

export const moai_row: Builder = (k, c) => {
  const n = num(c, 'count', 15);
  const [h0, h1] = (c.p.h as number[]) ?? [5, 9];
  const col = str(c, 'color', '#7a7068'), hat = str(c, 'hat', '#a8503a');
  const len = n * 5.5;
  k.box(len + 6, 1.6, 8, tone(c, '#8a8478'), 0, 0, 0);
  boxCol(c, 0, 0, len + 6, 8, 0, 1.6);
  const placed = building(c) ? Math.ceil(n * 0.4) : n;
  for (let i = 0; i < placed; i++) {
    const x = -len / 2 + 2.75 + i * 5.5;
    const h = c.rng.range(h0, h1);
    const toppled = isRuin(c);
    k.push({ x, y: toppled ? 0.6 : 1.6, z: toppled ? -h * 0.5 - 3 : 0, rx: toppled ? -Math.PI / 2 : 0 });
    // face inland (towards -z here, viewer side)
    k.box(h * 0.42, h * 0.5, h * 0.3, tone(c, col), 0, 0, 0);
    k.box(h * 0.36, h * 0.5, h * 0.32, tone(c, col), 0, h * 0.5, -0.05);
    k.box(h * 0.2, h * 0.08, h * 0.12, tone(c, shade(col, 0.85)), 0, h * 0.82, -h * 0.17); // brow
    k.box(h * 0.08, h * 0.22, h * 0.1, tone(c, shade(col, 0.9)), 0, h * 0.58, -h * 0.2); // nose
    for (const sx of [-1, 1]) k.box(h * 0.05, h * 0.3, h * 0.12, tone(c, col), sx * h * 0.2, h * 0.55, 0); // ears
    if (i % 4 === 1 && !toppled) k.cyl(h * 0.15, h * 0.17, h * 0.15, 8, tone(c, hat), 0, h, 0);
    k.pop();
    if (!toppled) boxCol(c, x, 0, h * 0.42, h * 0.32, 1.6, 1.6 + h);
  }
  c.height = h1 + 2;
};

export const great_wall: Builder = (k, c) => {
  const L = num(c, 'length', 2400), H = num(c, 'h', 7.8), W = num(c, 'w', 5), T = num(c, 'towers', 170);
  const col = str(c, 'color', '#9a948a');
  const earthen = building(c);
  const segs = 120;
  // wall snakes along a ridge-following path through the origin
  const pts: [number, number][] = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs - 0.5;
    const x = t * L, z = Math.sin(t * 7.3) * 120 + Math.sin(t * 17) * 40;
    pts.push([x, z]);
  }
  const towerEvery = Math.max(3, Math.round(segs / Math.min(T, segs / 3)));
  for (let i = 0; i < segs; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
    const ha = c.h(ax, az), hb = c.h(bx, bz);
    const mx = (ax + bx) / 2, mz = (az + bz) / 2, mh = (ha + hb) / 2;
    const len = Math.hypot(bx - ax, bz - az) + 0.4;
    const ang = Math.atan2(bz - az, bx - ax);
    const slope = Math.atan2(hb - ha, len);
    const wc = earthen ? '#b89a72' : tone(c, col);
    const hh = earthen ? H * 0.55 : H;
    k.boxC(len, hh + 6, W, wc, { x: mx, y: mh + hh / 2 - 3, z: mz, ry: -ang, rz: slope });
    if (!earthen) {
      k.boxC(len, 0.3, W - 0.6, tone(c, shade(col, 0.8)), { x: mx, y: mh + H + 0.05, z: mz, ry: -ang, rz: slope });
      // crenellations on both parapets
      for (const side of [-1, 1]) for (let j = 0; j < 4; j++) {
        const t = (j + 0.5) / 4 - 0.5;
        k.boxC(len / 8, 1.0, 0.5, tone(c, col), { x: mx + Math.cos(ang) * t * len - Math.sin(ang) * side * (W / 2 - 0.25), y: mh + H + 0.6 + Math.tan(slope) * t * len, z: mz + Math.sin(ang) * t * len + Math.cos(ang) * side * (W / 2 - 0.25), ry: -ang });
      }
    }
    c.colliders.push({ k: 'box', x: mx, z: mz, hw: len / 2, hd: W / 2, rot: ang, y0: mh - 3, y1: mh + hh });
    if (!earthen && i % towerEvery === 0) {
      k.box(W + 4, H + 5, W + 4, tone(c, col), ax, ha - 3, az, -ang);
      k.box(W + 4.4, 0.6, W + 4.4, tone(c, shade(col, 0.85)), ax, ha + H + 2, az, -ang);
      if (c.state !== 'weathered') k.pyramid(W, W, 2.4, tone(c, '#5a5a5e'), ax, ha + H + 2.6, az, -ang);
      c.colliders.push({ k: 'box', x: ax, z: az, hw: W / 2 + 2, hd: W / 2 + 2, rot: ang, y0: ha - 3, y1: ha + H + 2.6 });
    }
  }
  c.height = H + 4;
};

export const cave: Builder = (k, c) => {
  const col = str(c, 'color', '#a8a090');
  // limestone hill with a cave mouth (walk-in)
  k.blob(30, (nx, ny) => shade(col, 0.85 + ny * 0.15), 0, -6, 30, { sy: 0.7, sx: 1.4 }, 1);
  for (let i = 0; i < 8; i++) k.rock(c.rng.range(4, 9), shade(col, c.rng.range(0.85, 1)), c.rng.range(-35, 35), c.rng.range(0, 12), 30 + c.rng.range(-15, 15));
  // tunnel: walls + roof
  const tw = 6, th = 4.5, tl = 26;
  k.box(1.5, th, tl, shade(col, 0.7), -tw / 2, 0, tl / 2 + 2);
  k.box(1.5, th, tl, shade(col, 0.7), tw / 2, 0, tl / 2 + 2);
  k.box(tw + 3, 2, tl, shade(col, 0.65), 0, th, tl / 2 + 2);
  k.box(tw + 3, th, 1.5, shade(col, 0.6), 0, 0, tl + 2);
  boxCol(c, -tw / 2, tl / 2 + 2, 1.5, tl, 0, th); boxCol(c, tw / 2, tl / 2 + 2, 1.5, tl, 0, th); boxCol(c, 0, tl + 2, tw + 3, 1.5, 0, th);
  c.colliders.push({ k: 'box', x: 0, z: 30, hw: 40, hd: 18, rot: 0, y0: 0, y1: 0.1 });
  // inner walls with paintings (only once painted)
  if (c.state !== 'construction') {
    const pigments = ['#a8402a', '#2a2420', '#c88a3a', '#8a3a22'];
    for (let i = 0; i < 14; i++) {
      const side = i % 2 ? 1 : -1, z = 6 + i * 1.5;
      const pc = pigments[i % 4];
      k.push({ x: side * (tw / 2 - 0.78), y: c.rng.range(1.6, 3), z, ry: side * Math.PI / 2 });
      // a running animal: body, head, legs
      const s = c.rng.range(0.6, 1.1);
      k.boxC(1.4 * s, 0.6 * s, 0.03, pc, {});
      k.boxC(0.4 * s, 0.4 * s, 0.03, pc, { x: 0.85 * s, y: 0.25 * s });
      for (const lx of [-0.5, 0.5]) k.boxC(0.12 * s, 0.6 * s, 0.03, pc, { x: lx * s, y: -0.5 * s, rz: lx * 0.5 });
      if (i % 3 === 0) k.boxC(0.1 * s, 0.6 * s, 0.03, pc, { x: 0.95 * s, y: 0.6 * s, rz: -0.4 });
      k.pop();
    }
    // a lamp
    k.curGlow = 1; k.sphere(0.25, 5, 4, '#ffb84a', 0.5, 0.3, 8); k.curGlow = 0;
  }
  if (c.state === 'weathered') { k.box(4, 3.2, 0.3, '#5a5a5e', 0, 0, 1); k.box(1.2, 2.2, 0.32, '#3a3a3e', 0, 0, 0.98); }
  c.height = 20;
};

export const geoglyphs: Builder = (k, c) => {
  const col = tone(c, str(c, 'color', '#e2c8a8'));
  const line = (pts: [number, number][], w = 1.4) => {
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
      const len = Math.hypot(bx - ax, bz - az);
      k.boxC(len + w * 0.5, 0.06, w, col, { x: (ax + bx) / 2, y: c.h((ax + bx) / 2, (az + bz) / 2) + 0.05, z: (az + bz) / 2, ry: -Math.atan2(bz - az, bx - ax) });
    }
  };
  if (building(c)) { line([[-60, 0], [60, 0]]); c.height = 2; return; }
  // hummingbird
  const hb: [number, number][] = [[0, -50], [4, -20], [30, -5], [10, 0], [40, 18], [6, 8], [0, 40], [-6, 8], [-40, 18], [-10, 0], [-30, -5], [-4, -20], [0, -50]];
  line(hb.map(([x, z]) => [x - 80, z]));
  line([[-80, -50], [-80, -95]]);
  // monkey with spiral tail
  const spiral: [number, number][] = [];
  for (let i = 0; i < 40; i++) { const a = i * 0.45, r = 22 - i * 0.5; spiral.push([60 + Math.cos(a) * r, 40 + Math.sin(a) * r]); }
  line(spiral);
  line([[60, 18], [70, -20], [90, -30], [70, -40], [50, -30], [55, -10], [60, 18]]);
  // spider
  line([[0, 60], [0, 90]]);
  for (let i = 0; i < 4; i++) for (const s of [-1, 1]) line([[0, 66 + i * 6], [s * 18, 60 + i * 9], [s * 26, 70 + i * 9]]);
  // long straight lines and a trapezoid
  line([[-400, 200], [400, 260]], 2.2);
  line([[-300, -200], [-120, -320], [120, -320], [300, -200], [-300, -200]], 2.2);
  c.height = 3;
};

export const earth_mound: Builder = (k, c) => {
  const W = num(c, 'w', 290), L = num(c, 'l', 236), H = num(c, 'h', 30);
  const col = str(c, 'color', '#6a7a42');
  const sc = building(c) ? 0.5 : 1;
  k.pyramid(W, L, H * 0.7 * sc, tone(c, col), 0, 0, 0, 0, W * 0.6, L * 0.55);
  k.pyramid(W * 0.55, L * 0.5, H * 0.3 * sc, tone(c, shade(col, 1.05)), W * 0.08, H * 0.7 * sc, -L * 0.05, 0, W * 0.3, L * 0.3);
  boxCol(c, 0, 0, W * 0.8, L * 0.75, 0, H * 0.7 * sc);
  boxCol(c, W * 0.08, -L * 0.05, W * 0.42, L * 0.4, 0, H * sc);
  if (c.state === 'complete' || building(c)) {
    // temple on top + palisade of logs around the central plaza
    k.box(30, 8, 20, '#8a6a48', W * 0.08, H, -L * 0.05);
    k.gable(30, 6, 20, '#a8915a', W * 0.08, H + 8, -L * 0.05, 0, 1);
    if (bool(c, 'palisade')) {
      const R = 380;
      for (let i = 0; i < 160; i++) { const a = (i / 160) * Math.PI * 2; k.cyl(0.4, 0.45, 5, 5, '#6b4a2e', Math.cos(a) * R, c.h(Math.cos(a) * R, Math.sin(a) * R) - 0.5, Math.sin(a) * R); }
    }
    // staircase
    k.boxC(12, 1, H * 1.6, tone(c, '#7a6a48'), { y: H * 0.35, z: -L * 0.45, rx: -0.45 });
  }
  c.height = H + 10;
};

export const great_house: Builder = (k, c) => {
  const R = num(c, 'r', 95), F = num(c, 'floors', 4), kivas = num(c, 'kivas', 12);
  const col = str(c, 'color', '#c8a47a');
  const seg = 24;
  // D-shaped: curved back wall rising in terraces, straight front wall
  for (let s = 0; s < seg; s++) {
    const a0 = Math.PI + (s / seg) * Math.PI, a1 = Math.PI + ((s + 1) / seg) * Math.PI, am = (a0 + a1) / 2;
    for (let f = 0; f < F; f++) {
      if (isRuin(c) && f > 1 && c.rng.chance(0.6)) continue;
      const r = R - f * 9;
      const x = Math.cos(am) * r, z = -Math.sin(am) * r * 0.75;
      const len = r * (Math.PI / seg) + 0.6;
      k.boxC(len, 3, 9, tone(c, shade(col, 1 - f * 0.03)), { x, y: f * 3 + 1.5, z, ry: am + Math.PI / 2 });
      if (!isRuin(c)) for (let w = 0; w < 2; w++) k.box(0.6, 0.6, 0.1, '#2a1a10', x + Math.cos(am) * 4.6, f * 3 + 1.2, z - Math.sin(am) * 3.5);
    }
    c.colliders.push({ k: 'box', x: Math.cos(am) * R, z: -Math.sin(am) * R * 0.75, hw: R * (Math.PI / seg) / 2 + 0.3, hd: 4.5, rot: -am - Math.PI / 2, y0: 0, y1: F * 3 });
  }
  k.box(R * 2, 3, 3, tone(c, col), 0, 0, 0);
  boxCol(c, 0, 0, R * 2, 3, 0, 3);
  for (let i = 0; i < kivas; i++) {
    const x = c.rng.range(-R * 0.6, R * 0.6), z = c.rng.range(10, R * 0.5);
    k.cyl(5, 5, 0.8, 12, tone(c, shade(col, 0.85)), x, 0, z);
    k.cyl(4.2, 4.2, 0.1, 12, '#3a2a1a', x, 0.75, z);
    if (!isRuin(c)) for (const sx of [-0.3, 0.3]) k.box(0.1, 3, 0.1, '#6b4a2e', x + sx, 0.8, z);
  }
  c.height = F * 3 + 2;
};

export const cliff_dwelling: Builder = (k, c) => {
  const col = str(c, 'color', '#c8a078'), cliff = str(c, 'cliff', '#b89070');
  const rooms = num(c, 'rooms', 40), towers = num(c, 'towers', 4);
  // cliff with an alcove: back wall, overhang, floor shelf at y=0 (we stand in the canyon below)
  const W = 110;
  k.box(W + 40, 60, 30, cliff, 0, -20, 30);
  k.box(W + 40, 26, 40, shade(cliff, 0.95), 0, 22, 8);
  k.box(W, 1, 18, shade(cliff, 0.9), 0, -0.5, 4);
  boxCol(c, 0, 30, W + 40, 30, -20, 40); boxCol(c, 0, 8, W + 40, 40, 22, 48);
  for (let i = 0; i < 10; i++) k.rock(c.rng.range(3, 6), shade(cliff, 0.9), c.rng.range(-W / 2, W / 2), c.rng.range(-8, -2), c.rng.range(-12, -5));
  for (let i = 0; i < rooms; i++) {
    const x = -W / 2 + 4 + c.rng.range(0, W - 8), z = c.rng.range(-2, 12);
    const fl = c.rng.chance(0.4) ? 2 : 1;
    const w = c.rng.range(3, 5), d = c.rng.range(3, 4.5);
    k.box(w, fl * 2.6, d, tone(c, shade(col, c.rng.range(0.9, 1.05))), x, 0, z);
    k.box(0.6, 0.9, 0.1, '#2a1a10', x, 0.8 + (fl - 1) * 2.6, z - d / 2 - 0.02);
    boxCol(c, x, z, w, d, 0, fl * 2.6);
  }
  for (let t = 0; t < towers; t++) { const x = -W / 2 + 15 + t * (W - 30) / Math.max(1, towers - 1); k.box(4, 8, 4, tone(c, col), x, 0, 1); boxCol(c, x, 1, 4, 4, 0, 8); }
  for (let i = 0; i < 3; i++) k.cyl(4.5, 4.5, 0.6, 12, tone(c, shade(col, 0.85)), -30 + i * 30, 0, -4);
  c.height = 30;
};

export const terraced_city: Builder = (k, c) => {
  const nb = num(c, 'buildings', 120), nt = num(c, 'terraces', 30);
  const col = str(c, 'color', '#9a948a'), roof = str(c, 'roof', '#c9a85a');
  // agricultural terraces stepping down the ridge flanks
  for (let i = 0; i < nt; i++) {
    const side = i % 2 ? 1 : -1, j = Math.floor(i / 2);
    const z = -60 + j * 10, x = side * (70 + j * 2);
    const y = c.h(x, z);
    k.box(40, 2.6, 8, tone(c, col), x, y - 2, z, side * 0.2);
    k.box(39, 0.4, 7.6, tone(c, '#6a8a3a'), x, y + 0.6, z, side * 0.2);
  }
  // houses on the ridge top
  const roofs = c.state === 'complete' || c.state === 'construction' || c.state === 'restored';
  for (let i = 0; i < nb; i++) {
    const x = c.rng.range(-55, 55), z = c.rng.range(-90, 90);
    if (Math.abs(x) < 12 && Math.abs(z) < 30) continue; // central plaza
    const y = c.h(x, z);
    const w = c.rng.range(4, 7), d = c.rng.range(4, 8), rot = c.rng.chance(0.5) ? 0 : Math.PI / 2;
    k.box(w, 2.6, d, tone(c, shade(col, c.rng.range(0.9, 1.05))), x, y - 0.5, z, rot);
    k.pyramid(0.9, 1.4, 0.12, '#2a2420', x, y + 0.2, z - d / 2 - 0.02, rot, 0.5, 0.1);
    if (roofs && (c.state !== 'restored' || c.rng.chance(0.15))) k.gable(w, 2.6, d, roof, x, y + 2.1, z, rot, 0.4);
    boxCol(c, x, z, w, d, y - 0.5, y + 2.1);
  }
  // Intihuatana-style carved stone on a little hill
  k.box(3, 1.5, 2, tone(c, '#a8a296'), 30, c.h(30, 60), 60); k.box(0.8, 1.8, 0.8, tone(c, '#a8a296'), 30, c.h(30, 60) + 1.5, 60);
  // Huayna Picchu peak behind
  if (bool(c, 'peak')) { k.cone(80, 260, 9, (_nx, ny) => (ny > 0.5 ? '#5a7a3a' : '#6a7a4a'), 0, c.h(0, 260) - 20, 280); cylCol(c, 0, 280, 70, -50, 240); }
  if (building(c)) for (let i = 0; i < 20; i++) k.box(1.2, 0.8, 1.2, '#a8a296', c.rng.range(-50, 50), c.h(0, 0), c.rng.range(-80, 80));
  if (c.state === 'weathered' || c.state === 'ruined') for (let i = 0; i < 50; i++) { const x = c.rng.range(-60, 60), z = c.rng.range(-90, 90); k.blob(c.rng.range(1, 2.5), '#4a7a3a', x, c.h(x, z) + 0.5, z); }
  c.height = 40;
};

export const stone_enclosure: Builder = (k, c) => {
  const RX = num(c, 'rx', 60), RZ = num(c, 'rz', 45), WH = num(c, 'wallH', 10), TH = num(c, 'tower', 10);
  const col = str(c, 'color', '#9a8a72');
  const seg = 56;
  for (let s = 0; s < seg; s++) {
    if (s === 3 || s === 30) continue; // entrances
    const a0 = (s / seg) * Math.PI * 2, a1 = ((s + 1) / seg) * Math.PI * 2, am = (a0 + a1) / 2;
    const x = Math.cos(am) * RX, z = Math.sin(am) * RZ;
    const len = Math.hypot(Math.cos(a1) * RX - Math.cos(a0) * RX, Math.sin(a1) * RZ - Math.sin(a0) * RZ) + 0.3;
    const ang = Math.atan2(Math.sin(a1) * RZ - Math.sin(a0) * RZ, Math.cos(a1) * RX - Math.cos(a0) * RX);
    let h = WH * (0.75 + 0.25 * Math.max(0, Math.cos(am - 0.5)));
    if (building(c)) h *= s < seg / 2 ? 0.6 : 0.2;
    if (isRuin(c) && c.rng.chance(0.3)) h *= 0.5;
    k.boxC(len, h, 4.5, tone(c, shade(col, 0.95 + (s % 3) * 0.03)), { x, y: h / 2, z, ry: -ang });
    // chevron decoration near the top on the eastern side
    if (Math.cos(am) > 0.4 && h > WH * 0.8) k.boxC(len, 0.5, 4.6, tone(c, shade(col, 0.8)), { x, y: h - 1.2, z, ry: -ang });
    c.colliders.push({ k: 'box', x, z, hw: len / 2, hd: 2.25, rot: ang, y0: 0, y1: h });
  }
  // conical tower and inner parallel wall
  k.cyl(2.5, 3, TH, 12, tone(c, col), RX * 0.55, 0, -RZ * 0.3);
  cylCol(c, RX * 0.55, -RZ * 0.3, 3, 0, TH);
  for (let s = 0; s < 12; s++) { const a = -0.6 + s * 0.1; k.boxC(5, WH * 0.6, 1.5, tone(c, col), { x: Math.cos(a) * RX * 0.82, y: WH * 0.3, z: Math.sin(a) * RZ * 0.82, ry: -a - Math.PI / 2 }); }
  // hill complex silhouette behind
  if (bool(c, 'hill')) { k.blob(55, (_x, ny) => (ny > 0.3 ? '#8a8a6a' : '#7a7a5a'), -40, -18, 180, { sy: 0.5 }, 1); for (let i = 0; i < 6; i++) k.rock(c.rng.range(5, 10), '#8a8478', -60 + i * 15, 6, 165); }
  // daga (clay) houses
  if (c.state !== 'ruined') for (let i = 0; i < 8; i++) { const x = c.rng.range(-RX * 0.5, RX * 0.5), z = c.rng.range(-RZ * 0.5, RZ * 0.4); k.cyl(2.5, 2.5, 2.2, 8, '#b5845a', x, 0, z); k.cone(3.2, 2.6, 8, '#c9a85a', x, 2.2, z); boxCol(c, x, z, 4, 4, 0, 4); }
  c.height = WH + 4;
};

export const mud_mosque: Builder = (k, c) => {
  const W = num(c, 'w', 60), L = num(c, 'l', 70), T = num(c, 'tower', 16), nT = num(c, 'towers', 1), plat = num(c, 'platform', 0);
  const col = str(c, 'color', '#b5845a');
  const tc = tone(c, col);
  if (plat) { k.box(W + 10, plat, L + 10, tone(c, shade(col, 0.9)), 0, 0, 0); boxCol(c, 0, 0, W + 10, L + 10, 0, plat); }
  const y0 = plat;
  const ruined = isRuin(c);
  const wallH = ruined ? 3 : 7;
  k.box(W, wallH, L, tc, 0, y0, 0);
  boxCol(c, 0, 0, W, L, y0, y0 + wallH);
  // buttress pilasters with pinnacles along the front
  for (let i = 0; i < 12; i++) {
    const x = -W / 2 + (i + 0.5) * (W / 12);
    k.box(1.6, wallH + 2.5, 1.4, tc, x, y0, -L / 2 - 0.4);
    if (!ruined) k.cone(0.8, 2.4, 6, tone(c, shade(col, 1.05)), x, y0 + wallH + 2.5, -L / 2 - 0.4);
  }
  // pyramidal tower(s) with torons
  for (let t = 0; t < nT; t++) {
    const tx = nT === 1 ? W * 0.25 : -W / 3 + t * (W / 3);
    const tz = nT === 1 ? L * 0.2 : -L / 2 - 1;
    const th = ruined ? T * 0.4 : T;
    k.pyramid(10, 10, th + 4, tc, tx, y0, tz, 0, 4, 4);
    k.box(4.2, 2, 4.2, tc, tx, y0 + th + 4, tz);
    if (!ruined) k.cone(1.2, 3, 6, tone(c, shade(col, 1.1)), tx, y0 + th + 6, tz);
    if (bool(c, 'torons') && !ruined) for (let y = 2; y < th; y += 1.8) for (const [ox, oz] of [[0, -5.2], [0, 5.2], [-5.2, 0], [5.2, 0]]) {
      const sh = 1 - y / (th + 6);
      k.box(oz ? 0.18 : 1.4, 0.18, oz ? 1.4 : 0.18, '#6b4a2e', tx + ox * sh, y0 + y, tz + oz * sh);
    }
    cylCol(c, tx, tz, 5, y0, y0 + th + 6);
  }
  if (bool(c, 'torons') && !ruined) for (let y = 2; y < wallH; y += 1.8) for (let i = 0; i < 24; i++) k.box(0.15, 0.15, 1.2, '#6b4a2e', -W / 2 + (i + 0.5) * (W / 24), y0 + y, -L / 2 - 0.6);
  // flat roof slab with little roof vents
  if (!ruined) { k.box(W - 0.4, 0.5, L - 0.4, tone(c, shade(col, 0.92)), 0, y0 + wallH, 0); for (let i = 0; i < 6; i++) k.box(0.8, 0.6, 0.8, '#d8c4a0', -W / 3 + (i % 3) * (W / 3), y0 + wallH + 0.5, i < 3 ? -L / 4 : L / 4); }
  // re-plastering scaffolding
  if (building(c)) scaffoldBox(k, W * 0.5, 4, wallH + 4, -W * 0.2, -L / 2 - 2, 2);
  k.box(3, 4.5, 0.4, '#3a2418', 0, y0, -L / 2 - 0.25);
  c.height = y0 + T + 9;
};

export const rock_church: Builder = (k, c) => {
  const S = num(c, 'size', 12), D = num(c, 'depth', 12);
  const col = str(c, 'color', '#b07a5a');
  // cross-shaped church in a pit; pit floor is at -D (terrain 'pit' mod)
  const y0 = -D;
  const ht = building(c) ? D * 0.5 : D;
  k.box(S, ht, S / 3, tone(c, col), 0, y0, 0);
  k.box(S / 3, ht, S, tone(c, col), 0, y0, 0);
  k.box(S * 0.86, 0.5, S * 0.2, tone(c, shade(col, 0.85)), 0, y0 + ht - 0.3, 0);
  k.box(S * 0.2, 0.5, S * 0.86, tone(c, shade(col, 0.85)), 0, y0 + ht - 0.3, 0);
  for (let f = 0; f < 2; f++) for (let i = 0; i < 3; i++) k.box(0.8, 1.6, 0.1, '#2a1a10', -S / 3 + i * S / 3, y0 + 3 + f * 4, -S / 6 - 0.05);
  k.box(1.6, 3, 0.1, '#3a2418', 0, y0, -S / 2 - 0.02);
  boxCol(c, 0, 0, S, S / 3, y0, y0 + ht);
  boxCol(c, 0, 0, S / 3, S, y0, y0 + ht);
  // trench and stairs down
  k.boxC(2.2, 1, D * 2, tone(c, '#9a6a4a'), { x: 0, y: -D / 2, z: -S - D * 0.6, rx: 0.5 });
  c.height = 2;
};
