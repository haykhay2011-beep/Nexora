// Low-poly versions of the cars you actually see on Armenian roads: the Lada
// Niva, the boxy Lada "Zhiguli" sedans, the Volga, old Mercedes saloons and the
// white Gazelle marshrutka minibus. Models face -Z, origin on the ground.
import { PartBuilder } from './models.js';

const GLASS = 0x34465a;
const DARK = 0x2a2c33;
const CHROME = 0xc9ced6;
const HEAD = 0xfff3b0;
const TAIL = 0xd8231f;

function addWheels(b, specs) {
  for (const [x, z, r, w] of specs) b.cyl(r, r, w, 9, 0x26262b, [x, r, z], [0, 0, Math.PI / 2]);
}

// Lada Niva (VAZ-2121): short, square, tall roof, big tyres.
export function nivaGeometry(color, withWheels = true) {
  const b = new PartBuilder();
  b.box(1.7, 0.62, 3.72, color, [0, 0.86, 0]);
  b.box(1.64, 0.58, 2.15, GLASS, [0, 1.46, 0.42]);
  b.box(1.72, 0.07, 2.22, color, [0, 1.78, 0.42]);
  for (const sx of [-1, 1]) {
    b.box(0.09, 0.58, 0.1, color, [sx * 0.83, 1.46, -0.6]);
    b.box(0.14, 0.58, 0.14, color, [sx * 0.83, 1.46, 1.5]);
    b.cyl(0.14, 0.14, 0.08, 10, HEAD, [sx * 0.62, 0.98, -1.87], [Math.PI / 2, 0, 0]);
    b.box(0.14, 0.3, 0.06, TAIL, [sx * 0.78, 0.98, 1.87]);
    b.box(0.1, 0.06, 0.06, 0xff9a1f, [sx * 0.8, 0.82, -1.87]);
  }
  b.box(1.0, 0.3, 0.06, DARK, [0, 0.92, -1.87]);
  b.box(1.78, 0.16, 0.14, DARK, [0, 0.56, -1.9]);
  b.box(1.78, 0.16, 0.14, DARK, [0, 0.56, 1.9]);
  b.box(1.4, 0.05, 1.5, DARK, [0, 1.84, 0.45]); // roof rack
  if (withWheels) addWheels(b, [[0.86, -1.15, 0.37, 0.28], [-0.86, -1.15, 0.37, 0.28], [0.86, 1.15, 0.37, 0.28], [-0.86, 1.15, 0.37, 0.28]]);
  return b.build();
}

// Boxy three-box sedans: Lada 2105/2107, GAZ-24 Volga, Mercedes W124.
export function sedanGeometry({ color, len = 4.1, w = 1.62, cabinLen = 2.0, cabinH = 0.5, topX = 0.88, topZ = 0.78, shift = 0.25, chrome = true, withWheels = true }) {
  const b = new PartBuilder();
  const bumper = chrome ? CHROME : DARK;
  b.box(w, 0.5, len, color, [0, 0.66, 0]);
  b.taper(w * 0.93, cabinH, cabinLen, GLASS, [0, 0.91 + cabinH / 2, shift], [0, 0, 0], topX, topZ);
  b.box(w * 0.74, 0.06, cabinLen * topZ * 0.97, color, [0, 0.93 + cabinH, shift]);
  b.box(w + 0.04, 0.14, 0.14, bumper, [0, 0.5, -len / 2]);
  b.box(w + 0.04, 0.14, 0.14, bumper, [0, 0.5, len / 2]);
  b.box(w * 0.5, 0.16, 0.05, DARK, [0, 0.76, -len / 2 - 0.01]);
  for (const sx of [-1, 1]) {
    b.box(0.26, 0.16, 0.06, HEAD, [sx * w * 0.36, 0.78, -len / 2 - 0.01]);
    b.box(0.34, 0.14, 0.06, TAIL, [sx * w * 0.34, 0.78, len / 2 + 0.01]);
  }
  if (withWheels) {
    const x = w / 2 + 0.01;
    const z = len * 0.31;
    addWheels(b, [[x, -z, 0.33, 0.24], [-x, -z, 0.33, 0.24], [x, z, 0.33, 0.24], [-x, z, 0.33, 0.24]]);
  }
  return b.build();
}

// GAZelle marshrutka minibus.
export function marshrutkaGeometry(color, stripe) {
  const b = new PartBuilder();
  b.box(2.0, 1.45, 4.6, color, [0, 1.35, 0.4]);
  b.box(1.95, 0.9, 1.0, color, [0, 1.05, -2.3]);
  b.box(1.9, 0.62, 0.08, GLASS, [0, 1.75, -1.88]);
  b.box(2.03, 0.5, 3.4, GLASS, [0, 1.7, 0.75]);
  b.box(2.04, 0.14, 5.6, stripe, [0, 1.12, -0.1]);
  b.box(0.8, 0.2, 0.3, 0xffcf3a, [0, 2.18, -1.3]);
  b.box(2.04, 0.18, 0.14, DARK, [0, 0.55, -2.82]);
  b.box(2.04, 0.18, 0.14, DARK, [0, 0.55, 2.72]);
  for (const sx of [-1, 1]) {
    b.box(0.3, 0.16, 0.06, HEAD, [sx * 0.7, 0.98, -2.82]);
    b.box(0.14, 0.4, 0.06, TAIL, [sx * 0.9, 1.2, 2.71]);
  }
  addWheels(b, [[0.98, -1.9, 0.4, 0.3], [-0.98, -1.9, 0.4, 0.3], [0.98, 1.5, 0.4, 0.3], [-0.98, 1.5, 0.4, 0.3]]);
  return b.build();
}

// Traffic roster: family -> colour variants, with footprints for collisions.
export const TRAFFIC = {
  niva: { hl: 1.9, hw: 0.9, h: 1.85, speed: [8.5, 15.5], weight: 0.3, variants: [0xf1f1ec, 0x4f7a4a, 0xd9742b, 0x3e5f8a].map((c) => () => nivaGeometry(c)) },
  vaz: { hl: 2.1, hw: 0.88, h: 1.45, speed: [8.5, 15], weight: 0.32, variants: [0xf1f1ec, 0x7d2630, 0xe3d8b6, 0x7fa6c8].map((c) => () => sedanGeometry({ color: c })) },
  volga: { hl: 2.3, hw: 0.95, h: 1.5, speed: [9, 14], weight: 0.08, variants: [0x1b1b1f, 0xe3d8b6].map((c) => () => sedanGeometry({ color: c, len: 4.6, w: 1.72, cabinLen: 2.3, cabinH: 0.52, topX: 0.9, topZ: 0.8, shift: 0.1 })) },
  merc: { hl: 2.2, hw: 0.92, h: 1.45, speed: [10, 15.5], weight: 0.12, variants: [0xb7bcc2, 0x3d4047].map((c) => () => sedanGeometry({ color: c, len: 4.4, w: 1.7, cabinLen: 2.2, cabinH: 0.5, topX: 0.92, topZ: 0.82, shift: 0.15, chrome: false })) },
  marsh: { hl: 2.9, hw: 1.05, h: 2.6, speed: [7, 10.5], weight: 0.18, variants: [[0xf1f1ec, 0x2f6fb5], [0xf1f1ec, 0xd9462f]].map(([c, s]) => () => marshrutkaGeometry(c, s)) },
};
