// Vehicle roster: stats + low-poly models built from primitives.
// Models face -Z, +Y is up, origin is on the ground at the vehicle's centre.
import * as THREE from 'three';
import { PartBuilder, wheelGeometry } from './models.js';
import { marshrutkaGeometry, nivaGeometry, sedanGeometry } from './armenianCars.js';

// body panels use this marker colour; it is swapped for the player's paint at runtime
const PAINT = 0xff00ff;
const GLASS = 0x34465a;
const DARK = 0x2a2c33;

function wheelSpec(x, z, r, w, front = false) {
  return { x, y: r, z, r, w, front };
}

function buildCompact() {
  // Lada Niva: the legendary Soviet 4x4
  const R = 0.37;
  return {
    body: nivaGeometry(PAINT, false),
    wheels: [wheelSpec(0.86, -1.15, R, 0.28, true), wheelSpec(-0.86, -1.15, R, 0.28, true), wheelSpec(0.86, 1.15, R, 0.28), wheelSpec(-0.86, 1.15, R, 0.28)],
    exhaust: [[0.5, 0.34, 1.92]],
    height: 1.85,
    length: 3.9,
  };
}

function buildPickup() {
  const b = new PartBuilder();
  const c = PAINT;
  b.box(1.95, 0.5, 4.4, c, [0, 0.78, 0]);
  b.taper(1.85, 0.75, 1.75, c, [0, 1.4, -0.55], [0, 0, 0], 0.82, 0.78);
  b.taper(1.88, 0.5, 1.8, GLASS, [0, 1.45, -0.55], [0, 0, 0], 0.82, 0.76);
  // bed
  b.box(1.7, 0.06, 1.95, 0x4a4d57, [0, 1.06, 1.3]);
  b.box(0.1, 0.45, 1.95, c, [0.92, 1.28, 1.3]);
  b.box(0.1, 0.45, 1.95, c, [-0.92, 1.28, 1.3]);
  b.box(1.95, 0.45, 0.1, c, [0, 1.28, 2.25]);
  b.box(1.95, 0.45, 0.1, c, [0, 1.28, 0.33]);
  b.box(2.0, 0.22, 0.16, 0xc9ced6, [0, 0.5, -2.2]);
  b.box(2.0, 0.22, 0.16, 0xc9ced6, [0, 0.5, 2.25]);
  b.box(0.4, 0.16, 0.06, 0xfff3b0, [0.7, 0.85, -2.21]);
  b.box(0.4, 0.16, 0.06, 0xfff3b0, [-0.7, 0.85, -2.21]);
  b.box(0.2, 0.18, 0.06, 0xff3030, [0.85, 1.0, 2.31]);
  b.box(0.2, 0.18, 0.06, 0xff3030, [-0.85, 1.0, 2.31]);
  return {
    body: b.build(),
    wheels: [wheelSpec(0.98, -1.45, 0.46, 0.34, true), wheelSpec(-0.98, -1.45, 0.46, 0.34, true), wheelSpec(0.98, 1.4, 0.46, 0.34), wheelSpec(-0.98, 1.4, 0.46, 0.34)],
    exhaust: [[-0.7, 0.4, 2.3]],
    height: 1.8,
    length: 4.5,
  };
}

function buildSports() {
  const b = new PartBuilder();
  const c = PAINT;
  b.box(1.85, 0.38, 4.1, c, [0, 0.5, 0]);
  b.taper(1.85, 0.3, 1.5, c, [0, 0.79, -1.2], [0, 0, 0], 0.8, 0.5);
  b.taper(1.5, 0.42, 1.6, GLASS, [0, 0.93, 0.4], [0, 0, 0], 0.72, 0.62);
  b.box(0.4, 0.04, 3.9, 0x23242a, [0, 0.705, 0.1]);
  b.box(1.9, 0.08, 0.5, 0x23242a, [0, 1.06, 1.85]);
  b.box(0.1, 0.34, 0.14, 0x23242a, [0.6, 0.88, 1.85]);
  b.box(0.1, 0.34, 0.14, 0x23242a, [-0.6, 0.88, 1.85]);
  b.box(1.9, 0.1, 0.3, 0x23242a, [0, 0.33, -2.05]);
  b.box(0.35, 0.1, 0.06, 0xfff3b0, [0.65, 0.6, -2.06]);
  b.box(0.35, 0.1, 0.06, 0xfff3b0, [-0.65, 0.6, -2.06]);
  b.box(0.5, 0.1, 0.06, 0xff3030, [0.6, 0.62, 2.06]);
  b.box(0.5, 0.1, 0.06, 0xff3030, [-0.6, 0.62, 2.06]);
  return {
    body: b.build(),
    wheels: [wheelSpec(0.96, -1.3, 0.34, 0.3, true), wheelSpec(-0.96, -1.3, 0.34, 0.3, true), wheelSpec(0.96, 1.3, 0.35, 0.34), wheelSpec(-0.96, 1.3, 0.35, 0.34)],
    exhaust: [[0.5, 0.32, 2.1], [-0.5, 0.32, 2.1]],
    height: 1.2,
    length: 4.2,
  };
}

function buildMoto() {
  const b = new PartBuilder();
  const c = PAINT;
  b.box(0.26, 0.3, 1.5, 0x2a2c33, [0, 0.78, 0.1]);
  b.box(0.38, 0.3, 0.7, c, [0, 1.08, -0.25]);
  b.box(0.32, 0.1, 0.7, DARK, [0, 1.0, 0.5]);
  b.box(0.1, 0.9, 0.1, 0xc9ced6, [0.1, 0.8, -0.85], [0.35, 0, 0]);
  b.box(0.1, 0.9, 0.1, 0xc9ced6, [-0.1, 0.8, -0.85], [0.35, 0, 0]);
  b.box(0.9, 0.07, 0.07, DARK, [0, 1.28, -0.7]);
  b.box(0.2, 0.18, 0.12, 0xfff3b0, [0, 1.12, -1.0]);
  b.box(0.16, 0.08, 0.06, 0xff3030, [0, 0.98, 0.9]);
  b.cyl(0.07, 0.07, 0.7, 6, 0xaab0ba, [0.2, 0.45, 0.95], [Math.PI / 2, 0, 0]);
  // rider
  b.box(0.42, 0.62, 0.3, 0x2457c5, [0, 1.62, 0.28], [-0.35, 0, 0]);
  b.box(0.16, 0.5, 0.2, 0x1d3f8e, [0.26, 1.1, 0.0], [-0.9, 0, 0]);
  b.box(0.16, 0.5, 0.2, 0x1d3f8e, [-0.26, 1.1, 0.0], [-0.9, 0, 0]);
  b.box(0.12, 0.5, 0.12, 0x2457c5, [0.28, 1.5, -0.35], [1.1, 0, 0]);
  b.box(0.12, 0.5, 0.12, 0x2457c5, [-0.28, 1.5, -0.35], [1.1, 0, 0]);
  b.sphere(0.23, 0xffffff, [0, 2.07, 0.05], [1, 1, 1.1], 1);
  b.box(0.3, 0.1, 0.1, 0x222a34, [0, 2.06, -0.14]);
  return {
    body: b.build(),
    wheels: [wheelSpec(0, -0.9, 0.4, 0.16, true), wheelSpec(0, 0.9, 0.4, 0.2)],
    exhaust: [[0.2, 0.55, 1.35]],
    height: 2.2,
    length: 2.3,
  };
}

function buildMonster() {
  const b = new PartBuilder();
  const c = PAINT;
  b.box(1.9, 0.7, 3.6, c, [0, 1.85, 0]);
  b.taper(1.8, 0.8, 1.8, c, [0, 2.6, 0.2], [0, 0, 0], 0.82, 0.76);
  b.taper(1.84, 0.5, 1.84, GLASS, [0, 2.65, 0.2], [0, 0, 0], 0.82, 0.76);
  b.box(0.15, 0.25, 0.5, 0xffe35c, [0.55, 3.15, 0.2]);
  b.box(0.15, 0.25, 0.5, 0xffe35c, [-0.55, 3.15, 0.2]);
  b.box(2.8, 0.18, 0.2, DARK, [0, 0.95, -1.5]);
  b.box(2.8, 0.18, 0.2, DARK, [0, 0.95, 1.5]);
  b.box(0.2, 0.7, 0.2, DARK, [0.8, 1.3, -1.5]);
  b.box(0.2, 0.7, 0.2, DARK, [-0.8, 1.3, -1.5]);
  b.box(0.2, 0.7, 0.2, DARK, [0.8, 1.3, 1.5]);
  b.box(0.2, 0.7, 0.2, DARK, [-0.8, 1.3, 1.5]);
  b.box(2.0, 0.3, 0.2, 0xc9ced6, [0, 1.6, -1.85]);
  b.box(0.4, 0.2, 0.06, 0xfff3b0, [0.65, 1.95, -1.81]);
  b.box(0.4, 0.2, 0.06, 0xfff3b0, [-0.65, 1.95, -1.81]);
  b.box(0.3, 0.2, 0.06, 0xff3030, [0.7, 1.95, 1.81]);
  b.box(0.3, 0.2, 0.06, 0xff3030, [-0.7, 1.95, 1.81]);
  b.cyl(0.08, 0.08, 0.9, 6, 0xaab0ba, [0.8, 2.6, 1.7]);
  b.cyl(0.08, 0.08, 0.9, 6, 0xaab0ba, [-0.8, 2.6, 1.7]);
  return {
    body: b.build(),
    wheels: [wheelSpec(1.4, -1.5, 0.95, 0.75, true), wheelSpec(-1.4, -1.5, 0.95, 0.75, true), wheelSpec(1.4, 1.5, 0.95, 0.75), wheelSpec(-1.4, 1.5, 0.95, 0.75)],
    exhaust: [[0.8, 3.05, 1.7], [-0.8, 3.05, 1.7]],
    height: 3.3,
    length: 4.2,
  };
}


function sedanSpec(opts, wheelX, wheelZ, r, exhaust, height) {
  return {
    body: sedanGeometry({ ...opts, color: PAINT, withWheels: false }),
    wheels: [wheelSpec(wheelX, -wheelZ, r, 0.24, true), wheelSpec(-wheelX, -wheelZ, r, 0.24, true), wheelSpec(wheelX, wheelZ, r, 0.24), wheelSpec(-wheelX, wheelZ, r, 0.24)],
    exhaust: [exhaust],
    height,
    length: opts.len,
  };
}

function buildVaz() {
  return sedanSpec({ len: 4.1 }, 0.82, 1.27, 0.33, [0.45, 0.3, 2.1], 1.45);
}

function buildVolga() {
  return sedanSpec({ len: 4.6, w: 1.72, cabinLen: 2.3, cabinH: 0.52, topX: 0.9, topZ: 0.8, shift: 0.1 }, 0.87, 1.43, 0.34, [0.5, 0.3, 2.35], 1.5);
}

function buildMerc() {
  return sedanSpec({ len: 4.4, w: 1.7, cabinLen: 2.2, cabinH: 0.5, topX: 0.92, topZ: 0.82, shift: 0.15, chrome: false }, 0.86, 1.36, 0.34, [0.5, 0.3, 2.25], 1.45);
}

function buildMarsh() {
  return {
    body: marshrutkaGeometry(PAINT, 0x2f6fb5, false),
    wheels: [wheelSpec(0.98, -1.9, 0.4, 0.3, true), wheelSpec(-0.98, -1.9, 0.4, 0.3, true), wheelSpec(0.98, 1.5, 0.4, 0.3), wheelSpec(-0.98, 1.5, 0.4, 0.3)],
    exhaust: [[0.7, 0.4, 2.8]],
    height: 2.7,
    length: 5.6,
  };
}

function buildRally() {
  const b = new PartBuilder();
  const c = PAINT;
  b.box(1.76, 0.5, 3.7, c, [0, 0.62, 0]);
  b.taper(1.6, 0.52, 2.2, GLASS, [0, 1.1, 0.45], [0, 0, 0], 0.84, 0.7);
  b.box(1.2, 0.06, 1.4, c, [0, 1.36, 0.5]);
  b.box(0.55, 0.03, 1.5, 0x23242a, [0, 0.89, -1.0]); // hood stripe
  b.box(0.3, 0.1, 0.6, 0x23242a, [0, 0.95, -0.9]); // hood scoop
  b.box(1.8, 0.07, 0.55, 0x23242a, [0, 1.38, 1.85]); // wing
  b.box(0.08, 0.34, 0.1, 0x23242a, [0.7, 1.2, 1.85]);
  b.box(0.08, 0.34, 0.1, 0x23242a, [-0.7, 1.2, 1.85]);
  b.box(1.8, 0.18, 0.12, 0x23242a, [0, 0.4, -1.88]);
  for (const sx of [-1, 1]) {
    b.box(0.3, 0.14, 0.06, 0xfff3b0, [sx * 0.55, 0.72, -1.86]);
    b.box(0.2, 0.12, 0.06, 0xffd23f, [sx * 0.76, 0.5, -1.88]);
    b.box(0.3, 0.12, 0.06, 0xff3030, [sx * 0.6, 0.78, 1.86]);
  }
  return {
    body: b.build(),
    wheels: [wheelSpec(0.88, -1.15, 0.36, 0.28, true), wheelSpec(-0.88, -1.15, 0.36, 0.28, true), wheelSpec(0.88, 1.15, 0.36, 0.28), wheelSpec(-0.88, 1.15, 0.36, 0.28)],
    exhaust: [[0.5, 0.32, 1.9]],
    height: 1.45,
    length: 3.8,
  };
}

function buildMuscle() {
  const b = new PartBuilder();
  const c = PAINT;
  b.box(1.9, 0.5, 4.7, c, [0, 0.66, 0]);
  b.taper(1.7, 0.42, 1.7, GLASS, [0, 1.12, 0.7], [0, 0, 0], 0.82, 0.68);
  b.box(1.1, 0.06, 1.1, c, [0, 1.34, 0.7]);
  b.box(0.5, 0.14, 1.2, 0x23242a, [0, 0.95, -1.25]); // hood scoop
  b.box(0.3, 0.03, 4.5, 0xf1f1ec, [0.35, 0.92, 0]); // racing stripes
  b.box(0.3, 0.03, 4.5, 0xf1f1ec, [-0.35, 0.92, 0]);
  b.box(1.95, 0.16, 0.12, 0xc9ced6, [0, 0.46, -2.34]);
  b.box(1.95, 0.16, 0.12, 0xc9ced6, [0, 0.46, 2.34]);
  b.box(1.0, 0.18, 0.05, 0x23242a, [0, 0.74, -2.36]);
  for (const sx of [-1, 1]) {
    b.cyl(0.14, 0.14, 0.08, 10, 0xfff3b0, [sx * 0.62, 0.78, -2.36], [Math.PI / 2, 0, 0]);
    b.box(0.5, 0.16, 0.05, 0xff3030, [sx * 0.56, 0.78, 2.36]);
  }
  return {
    body: b.build(),
    wheels: [wheelSpec(0.96, -1.5, 0.38, 0.3, true), wheelSpec(-0.96, -1.5, 0.38, 0.3, true), wheelSpec(0.98, 1.5, 0.42, 0.38), wheelSpec(-0.98, 1.5, 0.42, 0.38)],
    exhaust: [[0.55, 0.3, 2.4], [-0.55, 0.3, 2.4]],
    height: 1.4,
    length: 4.8,
  };
}

function buildSuper() {
  const b = new PartBuilder();
  const c = PAINT;
  b.box(1.95, 0.3, 4.3, c, [0, 0.46, 0]);
  b.taper(1.9, 0.28, 1.7, c, [0, 0.74, -1.25], [0, 0, 0], 0.7, 0.4);
  b.taper(1.5, 0.4, 1.7, GLASS, [0, 0.84, 0.25], [0, 0, 0], 0.7, 0.55);
  b.box(0.4, 0.04, 1.2, 0x23242a, [0, 1.05, 0.4]);
  b.box(0.5, 0.2, 1.0, 0x23242a, [0.95, 0.55, 0.5]); // side intakes
  b.box(0.5, 0.2, 1.0, 0x23242a, [-0.95, 0.55, 0.5]);
  b.box(2.0, 0.08, 0.55, 0x23242a, [0, 1.0, 1.95]); // wing
  b.box(0.1, 0.4, 0.12, 0x23242a, [0.65, 0.78, 1.95]);
  b.box(0.1, 0.4, 0.12, 0x23242a, [-0.65, 0.78, 1.95]);
  b.box(1.9, 0.12, 0.3, 0x23242a, [0, 0.3, -2.2]);
  b.box(1.6, 0.12, 0.3, 0x23242a, [0, 0.3, 2.2]);
  for (const sx of [-1, 1]) {
    b.box(0.5, 0.06, 0.06, 0xdff6ff, [sx * 0.62, 0.66, -2.16]);
    b.box(0.7, 0.07, 0.06, 0xff3030, [sx * 0.5, 0.58, 2.16]);
  }
  return {
    body: b.build(),
    wheels: [wheelSpec(0.98, -1.35, 0.35, 0.3, true), wheelSpec(-0.98, -1.35, 0.35, 0.3, true), wheelSpec(1.0, 1.35, 0.37, 0.36), wheelSpec(-1.0, 1.35, 0.37, 0.36)],
    exhaust: [[0.4, 0.4, 2.2], [-0.4, 0.4, 2.2]],
    height: 1.15,
    length: 4.4,
  };
}

// speedMul: top speed multiplier        yawMax: max steering angle (rad)
// steerResp: how quickly it reaches it   drift: sensitivity to being flung wide by bends
// oil: how badly oil upsets it           hw/hl: collision half extents (m)
// spin: air spin rate (rad/s)            hop/ramp: jump multipliers
const VEHICLE_LIST = [
  {
    id: 'compact', paint: '#f1f1ec', name: 'Lada Niva', price: 0, build: buildCompact,
    blurb: 'The legendary 4x4. Balanced and friendly.',
    speedMul: 1, accel: 11, yawMax: 0.42, steerResp: 9, drift: 1, oil: 1, hw: 0.9, hl: 1.85,
    spin: 7.5, hop: 1, ramp: 1, lean: 1, sturdy: false, crusher: false,
    ratings: { speed: 3, handling: 3, tough: 3, air: 3 },
  },
  {
    id: 'pickup', paint: '#3b82d6', name: 'Pickup Truck', price: 600, build: buildPickup,
    blurb: 'Slower but sturdy. Shrugs off potholes.',
    speedMul: 0.9, accel: 9, yawMax: 0.38, steerResp: 7, drift: 0.85, oil: 0.9, hw: 1.0, hl: 2.2,
    spin: 6.6, hop: 0.9, ramp: 0.95, lean: 0.7, sturdy: true, crusher: false,
    ratings: { speed: 2, handling: 2, tough: 5, air: 2 },
  },
  {
    id: 'sports', paint: '#ffc21a', name: 'Sports Car', price: 2500, build: buildSports,
    blurb: 'Blisteringly fast with razor steering. Twitchy!',
    speedMul: 1.14, accel: 15, yawMax: 0.52, steerResp: 15, drift: 1.55, oil: 1.7, hw: 0.9, hl: 2.0,
    spin: 8.2, hop: 0.95, ramp: 1, lean: 1.3, sturdy: false, crusher: false,
    ratings: { speed: 5, handling: 4, tough: 2, air: 3 },
  },
  {
    id: 'moto', paint: '#e8501a', name: 'Motorcycle', price: 1800, build: buildMoto,
    blurb: 'Super nimble, tiny hitbox, spins like a top.',
    speedMul: 1.04, accel: 14, yawMax: 0.5, steerResp: 12, drift: 1.1, oil: 1.3, hw: 0.4, hl: 1.1,
    spin: 11.5, hop: 1.05, ramp: 1, lean: -2.6, sturdy: false, crusher: false,
    ratings: { speed: 4, handling: 5, tough: 1, air: 5 },
  },
  {
    id: 'monster', paint: '#3ec26b', name: 'Monster Truck', price: 5000, build: buildMonster,
    blurb: 'Crushes cones and barrels. Huge air, wide turns.',
    speedMul: 0.95, accel: 9, yawMax: 0.32, steerResp: 5, drift: 0.8, oil: 0.8, hw: 1.3, hl: 2.2,
    spin: 5.6, hop: 1.25, ramp: 1.35, lean: 0.5, sturdy: true, crusher: true,
    ratings: { speed: 3, handling: 1, tough: 4, air: 5 },
  },
  {
    id: 'vaz', paint: '#7d2630', name: 'Lada 2107', price: 400, build: buildVaz,
    blurb: 'The classic Zhiguli. Boxy, honest, a bit slow.',
    speedMul: 0.96, accel: 10, yawMax: 0.4, steerResp: 8, drift: 1.05, oil: 1.1, hw: 0.85, hl: 2.0,
    spin: 7, hop: 0.95, ramp: 0.95, lean: 1.1, sturdy: false, crusher: false,
    ratings: { speed: 2, handling: 3, tough: 3, air: 3 },
  },
  {
    id: 'volga', paint: '#1b1b1f', name: 'Volga GAZ-24', price: 900, build: buildVolga,
    blurb: 'Big, heavy and steady. Shrugs off potholes.',
    speedMul: 1.0, accel: 9, yawMax: 0.38, steerResp: 7, drift: 0.9, oil: 0.9, hw: 0.92, hl: 2.2,
    spin: 6, hop: 0.9, ramp: 0.95, lean: 0.8, sturdy: true, crusher: false,
    ratings: { speed: 3, handling: 2, tough: 4, air: 2 },
  },
  {
    id: 'marsh', paint: '#f1f1ec', name: 'Marshrutka', price: 1200, build: buildMarsh,
    blurb: 'The Gazelle minibus. Slow, huge, nearly unbreakable.',
    speedMul: 0.88, accel: 8, yawMax: 0.34, steerResp: 6, drift: 0.8, oil: 0.85, hw: 1.05, hl: 2.7,
    spin: 4.5, hop: 0.75, ramp: 0.85, lean: 0.5, sturdy: true, crusher: false,
    ratings: { speed: 2, handling: 1, tough: 5, air: 1 },
  },
  {
    id: 'merc', paint: '#b7bcc2', name: 'Mercedes W124', price: 1500, build: buildMerc,
    blurb: 'Built like a vault and quick on the motorway.',
    speedMul: 1.08, accel: 12, yawMax: 0.44, steerResp: 10, drift: 0.85, oil: 0.9, hw: 0.9, hl: 2.15,
    spin: 7, hop: 1, ramp: 1, lean: 1, sturdy: false, crusher: false,
    ratings: { speed: 4, handling: 3, tough: 4, air: 3 },
  },
  {
    id: 'rally', paint: '#3b82d6', name: 'Rally Hatch', price: 3600, build: buildRally,
    blurb: 'Gravel-bred grip. Hardly notices oil.',
    speedMul: 1.1, accel: 14, yawMax: 0.5, steerResp: 13, drift: 0.75, oil: 0.6, hw: 0.86, hl: 1.85,
    spin: 8.5, hop: 1.05, ramp: 1.1, lean: 1.2, sturdy: false, crusher: false,
    ratings: { speed: 4, handling: 5, tough: 2, air: 4 },
  },
  {
    id: 'muscle', paint: '#e5483c', name: 'Muscle Car', price: 4200, build: buildMuscle,
    blurb: 'All engine. Great on the straights, a handful in bends.',
    speedMul: 1.15, accel: 15, yawMax: 0.4, steerResp: 8, drift: 1.3, oil: 1.5, hw: 0.95, hl: 2.3,
    spin: 6.5, hop: 0.9, ramp: 1, lean: 1.3, sturdy: false, crusher: false,
    ratings: { speed: 5, handling: 2, tough: 3, air: 3 },
  },
  {
    id: 'super', paint: '#ffc21a', name: 'Supercar', price: 9000, build: buildSuper,
    blurb: 'Ridiculous pace and reflexes. Keep it pointed straight.',
    speedMul: 1.25, accel: 18, yawMax: 0.55, steerResp: 16, drift: 1.6, oil: 1.9, hw: 0.95, hl: 2.15,
    spin: 8.5, hop: 0.9, ramp: 1, lean: 1.4, sturdy: false, crusher: false,
    ratings: { speed: 5, handling: 5, tough: 1, air: 3 },
  },
];

export const VEHICLES = [...VEHICLE_LIST].sort((a, b) => a.price - b.price);

export function getVehicle(id) {
  return VEHICLES.find((v) => v.id === id) || VEHICLES[0];
}

// Scene graph for one vehicle:
//   root                 (position + heading; set every frame)
//     bodyPivot          (lean / pitch / tumble / suspension)
//       body mesh
//       wheel pivots -> wheel meshes
export function createVehicleObject(def, material) {
  const spec = def.build();
  const root = new THREE.Group();
  const pivot = new THREE.Group();
  root.add(pivot);
  pivot.add(new THREE.Mesh(spec.body, material));
  const wheels = [];
  const geoCache = new Map();
  for (const w of spec.wheels) {
    const key = `${w.r}_${w.w}`;
    let geo = geoCache.get(key);
    if (!geo) {
      geo = wheelGeometry(w.r, w.w);
      geoCache.set(key, geo);
    }
    const holder = new THREE.Group();
    holder.position.set(w.x, w.y, w.z);
    const mesh = new THREE.Mesh(geo, material);
    holder.add(mesh);
    pivot.add(holder);
    wheels.push({ holder, mesh, front: w.front, r: w.r });
  }
  // paint: recolour every vertex that carries the marker colour
  const colorAttr = spec.body.attributes.color;
  const paintIdx = [];
  for (let i = 0; i < colorAttr.count; i++) {
    if (colorAttr.getX(i) > 0.98 && colorAttr.getY(i) < 0.02 && colorAttr.getZ(i) > 0.98) paintIdx.push(i);
  }
  const setPaint = (hex) => {
    const c = new THREE.Color(hex);
    for (const i of paintIdx) colorAttr.setXYZ(i, c.r, c.g, c.b);
    colorAttr.needsUpdate = true;
  };

  // brake lights: glowing red bars at the rear, lit while braking
  const brakeMat = new THREE.MeshBasicMaterial({ color: 0xff2a1a });
  const brakeLights = new THREE.Group();
  const moto = def.id === 'moto';
  for (const sx of moto ? [0] : [-1, 1]) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(moto ? 0.2 : 0.42, 0.16, 0.06), brakeMat);
    bar.position.set(sx * def.hw * 0.62, spec.height * (moto ? 0.5 : 0.42), spec.length / 2 + 0.05);
    brakeLights.add(bar);
  }
  brakeLights.visible = false;
  pivot.add(brakeLights);

  return {
    root,
    pivot,
    setPaint,
    setBrake(level) {
      brakeLights.visible = level > 0.08;
      brakeLights.scale.setScalar(0.85 + level * 0.45);
    },
    wheels,
    exhaust: spec.exhaust.map((e) => new THREE.Vector3(e[0], e[1], e[2])),
    height: spec.height,
    length: spec.length,
    dispose() {
      spec.body.dispose();
      brakeMat.dispose();
      for (const g of geoCache.values()) g.dispose();
    },
  };
}
