import * as THREE from 'three';
import { mergeParts, part } from '../core/geometry.js';

// Low-poly scenery props built from primitives. Each returns a merged,
// vertex-coloured BufferGeometry with its base at y = 0.
const cyl = (rt, rb, h, seg = 6) => new THREE.CylinderGeometry(rt, rb, h, seg, 1);
const cone = (r, h, seg = 6) => new THREE.ConeGeometry(r, h, seg, 1);
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const ico = (r, d = 0) => new THREE.IcosahedronGeometry(r, d);
const dodec = (r) => new THREE.DodecahedronGeometry(r, 0);

export const PROPS = {
  palm() {
    const parts = [];
    // curved trunk from stacked, offset segments
    for (let i = 0; i < 5; i++) {
      parts.push(part(cyl(0.22 - i * 0.02, 0.26 - i * 0.02, 1.6, 5), i % 2 ? '#8a6a45' : '#7a5b3a', [i * i * 0.05, 0.8 + i * 1.5, 0], [0, 0, -i * 0.06]));
    }
    const top = [1.0, 7.9, 0];
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      parts.push(part(box(3.2, 0.08, 0.7), i % 2 ? '#3f9e4d' : '#2f8a3e',
        [top[0] + Math.cos(a) * 1.4, top[1] - 0.35, Math.sin(a) * 1.4], [0, -a, -0.45]));
    }
    parts.push(part(ico(0.4), '#5b4a2f', top));
    return mergeParts(parts);
  },
  shrub(color = '#4f9a4a', color2 = '#3f8640') {
    return mergeParts([
      part(ico(1.0), color, [0, 0.7, 0], [0, 0, 0], [1.2, 0.8, 1.1]),
      part(ico(0.7), color2, [0.8, 0.5, 0.3]),
      part(ico(0.6), color, [-0.7, 0.45, -0.2]),
    ]);
  },
  rock(color = '#9b8f84', color2 = '#857a70') {
    return mergeParts([
      part(dodec(1.1), color, [0, 0.6, 0], [0.3, 0.5, 0], [1.3, 0.8, 1]),
      part(dodec(0.6), color2, [1.0, 0.35, 0.4], [0.2, 0, 0.6]),
    ]);
  },
  cactus() {
    const g = '#3d8b4f', g2 = '#357a45';
    return mergeParts([
      part(cyl(0.38, 0.42, 5.2, 7), g, [0, 2.6, 0]),
      part(new THREE.SphereGeometry(0.38, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2), g, [0, 5.2, 0]),
      part(cyl(0.25, 0.25, 1.2, 6), g2, [0.75, 2.2, 0], [0, 0, Math.PI / 2]),
      part(cyl(0.25, 0.25, 1.8, 6), g2, [1.3, 3.0, 0]),
      part(cyl(0.22, 0.22, 1.0, 6), g2, [-0.65, 2.9, 0], [0, 0, Math.PI / 2]),
      part(cyl(0.22, 0.22, 1.4, 6), g2, [-1.1, 3.5, 0]),
    ]);
  },
  dryBush() {
    return mergeParts([
      part(ico(0.9), '#b59b5a', [0, 0.5, 0], [0, 0, 0], [1.3, 0.6, 1.2]),
      part(ico(0.6), '#9c8448', [0.7, 0.35, 0.3]),
    ]);
  },
  pine(snow = false) {
    const parts = [part(cyl(0.22, 0.3, 1.6, 5), '#6b4a2e', [0, 0.8, 0])];
    const greens = ['#24613a', '#2b7043', '#1f5732'];
    for (let i = 0; i < 3; i++) {
      parts.push(part(cone(2.1 - i * 0.55, 2.6, 7), greens[i], [0, 2.2 + i * 1.5, 0]));
      if (snow) parts.push(part(cone(1.25 - i * 0.35, 1.1, 7), '#f2f6fa', [0, 3.1 + i * 1.5, 0]));
    }
    return mergeParts(parts);
  },
  building() {
    // unit-ish tower; instance scale stretches it. Bands give a window look.
    const parts = [];
    const levels = 8;
    for (let i = 0; i < levels; i++) {
      parts.push(part(box(1, 0.62, 1), '#c9cfd8', [0, i + 0.31, 0]));
      parts.push(part(box(1.02, 0.38, 1.02), i % 3 === 0 ? '#ffd58a' : '#3a4a66', [0, i + 0.81, 0]));
    }
    parts.push(part(box(0.5, 0.4, 0.5), '#8c95a3', [0.15, levels + 0.2, -0.1]));
    parts.push(part(box(0.06, 0.9, 0.06), '#e04a4a', [-0.3, levels + 0.45, 0.3]));
    return mergeParts(parts);
  },
  sakura() {
    return mergeParts([
      part(cyl(0.2, 0.3, 2.4, 5), '#5c3d2e', [0, 1.2, 0]),
      part(ico(1.4), '#f7b6c8', [0, 3.0, 0], [0, 0, 0], [1.2, 0.85, 1.2]),
      part(ico(0.9), '#f4a3bb', [0.9, 2.7, 0.4]),
      part(ico(0.8), '#fbc9d6', [-0.8, 2.8, -0.3]),
    ]);
  },
  streetLamp() {
    return mergeParts([
      part(cyl(0.08, 0.1, 6, 5), '#5a6170', [0, 3, 0]),
      part(box(1.4, 0.12, 0.2), '#5a6170', [0.65, 6, 0]),
      part(box(0.5, 0.15, 0.3), '#fff2b3', [1.25, 5.9, 0]),
    ]);
  },
  moss() {
    return mergeParts([
      part(ico(1.2), '#7d9c5b', [0, 0.4, 0], [0, 0, 0], [1.4, 0.55, 1.2]),
      part(ico(0.8), '#6b8a4c', [1.0, 0.3, 0.4], [0, 0, 0], [1, 0.6, 1]),
      part(dodec(0.5), '#2e2b2b', [-0.9, 0.3, 0.2]),
    ]);
  },
  lavaRock() {
    return mergeParts([
      part(dodec(1.2), '#2a2626', [0, 0.6, 0], [0.4, 0.2, 0.1], [1.4, 0.9, 1.1]),
      part(dodec(0.7), '#3a3333', [1.1, 0.4, -0.3]),
      part(box(1.2, 0.06, 0.25), '#ff6a1f', [0.2, 0.05, 0.9], [0, 0.6, 0]),
    ]);
  },
  lavaVent() {
    return mergeParts([
      part(cyl(1.3, 1.8, 0.5, 7), '#2b2626', [0, 0.25, 0]),
      part(cyl(0.9, 0.9, 0.08, 7), '#ff7b25', [0, 0.52, 0]),
      part(cone(0.5, 2.2, 6), '#e8e8e8', [0, 1.7, 0]),
      part(cone(0.35, 1.4, 6), '#f4f4f4', [0.3, 2.9, 0.1]),
    ]);
  },
};

// ---- Landmarks (built large; rendered without fog on the horizon) ----
const lm = {
  bridge() {
    const red = '#c8452f', dark = '#9e3424';
    const parts = [];
    for (const x of [-260, 260]) {
      parts.push(part(box(18, 230, 18), red, [x, 115, 0]));
      parts.push(part(box(30, 10, 22), dark, [x, 150, 0]));
      parts.push(part(box(30, 10, 22), dark, [x, 215, 0]));
    }
    parts.push(part(box(1200, 9, 30), dark, [0, 70, 0]));
    // main cable as segments of a parabola
    const segs = 24;
    for (let i = 0; i < segs; i++) {
      const x0 = -600 + (i / segs) * 1200, x1 = -600 + ((i + 1) / segs) * 1200;
      const y = (x) => (Math.abs(x) <= 260 ? 80 + 150 * (x / 260) ** 2 : 230 - (Math.abs(x) - 260) * 0.45);
      const y0 = y(x0), y1 = y(x1);
      const len = Math.hypot(x1 - x0, y1 - y0);
      parts.push(part(box(len, 3, 3), red, [(x0 + x1) / 2, (y0 + y1) / 2, 0], [0, 0, Math.atan2(y1 - y0, x1 - x0)]));
    }
    parts.push(part(cone(380, 260, 7), '#5f7f52', [-820, 90, 120]));
    parts.push(part(cone(300, 190, 7), '#6a8a5a', [800, 60, 160]));
    return mergeParts(parts);
  },
  mesas() {
    return mergeParts([
      part(cyl(180, 230, 200, 8), '#b8653f', [-300, 100, 0]),
      part(cyl(190, 195, 14, 8), '#cf7a4b', [-300, 207, 0]),
      part(cyl(90, 120, 280, 7), '#a8553a', [120, 140, -80]),
      part(cyl(95, 98, 12, 7), '#c46f45', [120, 286, -80]),
      part(cyl(140, 200, 140, 8), '#b9683f', [450, 70, 60]),
      // arch
      part(box(40, 160, 60), '#a24f33', [-40, 80, 120]),
      part(box(40, 160, 60), '#a24f33', [120, 80, 120]),
      part(box(200, 40, 60), '#a24f33', [40, 175, 120]),
    ]);
  },
  peak() {
    return mergeParts([
      part(cone(520, 900, 6), '#6f7a86', [0, 450, 0], [0, 0.3, 0]),
      part(cone(205, 355, 6), '#f4f7fb', [0, 723, 0], [0, 0.3, 0]),
      part(cone(380, 520, 6), '#7d8894', [-560, 260, 120], [0, 1, 0]),
      part(cone(150, 210, 6), '#eef3f8', [-560, 418, 120], [0, 1, 0]),
      part(cone(420, 600, 6), '#76818d', [600, 300, 80], [0, 0.6, 0]),
      part(cone(160, 230, 6), '#f1f5fa', [600, 487, 80], [0, 0.6, 0]),
    ]);
  },
  tower() {
    const parts = [];
    const red = '#e5452c', white = '#f3f3f3';
    const H = 420;
    const levels = 10;
    for (let i = 0; i < levels; i++) {
      const t0 = i / levels, t1 = (i + 1) / levels;
      const w0 = 70 * (1 - t0) ** 1.6 + 6, w1 = 70 * (1 - t1) ** 1.6 + 6;
      const h = H / levels;
      parts.push(part(cyl(w1 * 0.7, w0 * 0.7, h, 4), i % 2 ? white : red, [0, (t0 + 0.5 / levels) * H, 0], [0, Math.PI / 4, 0]));
    }
    parts.push(part(box(80, 10, 80), red, [0, 125, 0]));
    parts.push(part(box(46, 8, 46), white, [0, 255, 0]));
    parts.push(part(cyl(1.5, 3, 70, 4), white, [0, H + 35, 0]));
    // snow-capped volcano in the far distance
    parts.push(part(cone(900, 520, 9), '#6c7fa6', [700, 200, -900]));
    parts.push(part(cone(300, 175, 9), '#f2f4f8', [700, 373, -900]));
    // skyline blocks
    for (let i = 0; i < 18; i++) {
      const x = -700 + i * 80 + ((i * 37) % 23);
      const h = 80 + ((i * 53) % 140);
      parts.push(part(box(55, h, 55), i % 2 ? '#2f3b56' : '#3b486a', [x, h / 2 - 40, 140]));
      parts.push(part(box(56, 6, 56), '#ffcf7a', [x, h * 0.6 - 40, 140]));
    }
    return mergeParts(parts);
  },
  volcano() {
    const parts = [
      part(cone(720, 430, 9), '#3a3534', [0, 195, 0]),
      part(cyl(150, 175, 26, 9), '#2a2626', [0, 400, 0]),
      part(cyl(120, 120, 6, 9), '#ff6a1f', [0, 414, 0]),
      part(cone(520, 300, 8), '#e9eef3', [-950, 120, 250]),
      part(cone(470, 250, 8), '#dfe6ec', [900, 95, 200]),
    ];
    // glowing lava flows running down the flank
    const slope = Math.atan2(430, 720);
    for (const [a, len] of [[0.25, 420], [-0.35, 360], [0.7, 300]]) {
      const r0 = 160, mid = r0 + (len / 2) * Math.cos(slope);
      const y = 410 - (len / 2) * Math.sin(slope);
      parts.push(part(box(14, 4, len), '#ff7b25', [Math.sin(a) * mid, y, Math.cos(a) * mid], [slope, a, 0, 'YXZ']));
    }
    // ash plume: soft puffs drifting downwind
    for (let i = 0; i < 9; i++) {
      const t = i / 8;
      parts.push(part(ico(90 + t * 120, 1), i % 2 ? '#d9d8d6' : '#eceae8', [t * 380 + (i % 3) * 40, 500 + t * 420, -t * 60], [i, i * 2, 0]));
    }
    return mergeParts(parts);
  },
};
export const LANDMARKS = lm;
