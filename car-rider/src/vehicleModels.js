// Vehicle roster: stats + low-poly models built from primitives.
// Models face -Z, +Y is up, origin is on the ground at the vehicle's centre.
import * as THREE from 'three';
import { PartBuilder, wheelGeometry } from './models.js';

const GLASS = 0x34465a;
const DARK = 0x2a2c33;

function wheelSpec(x, z, r, w, front = false) {
  return { x, y: r, z, r, w, front };
}

function buildCompact() {
  const b = new PartBuilder();
  const c = 0xe5483c;
  b.box(1.7, 0.45, 3.6, c, [0, 0.6, 0]);
  b.taper(1.56, 0.4, 1.96, GLASS, [0, 1.06, 0.3], [0, 0, 0], 0.8, 0.74);
  b.box(1.1, 0.07, 1.3, c, [0, 1.3, 0.32]);
  b.box(1.74, 0.2, 0.14, DARK, [0, 0.42, -1.8]);
  b.box(1.74, 0.2, 0.14, DARK, [0, 0.42, 1.8]);
  b.box(0.32, 0.14, 0.06, 0xfff3b0, [0.55, 0.66, -1.81]);
  b.box(0.32, 0.14, 0.06, 0xfff3b0, [-0.55, 0.66, -1.81]);
  b.box(0.32, 0.14, 0.06, 0xff3030, [0.55, 0.66, 1.81]);
  b.box(0.32, 0.14, 0.06, 0xff3030, [-0.55, 0.66, 1.81]);
  b.box(1.72, 0.05, 3.62, 0xffffff, [0, 0.44, 0]);
  return {
    body: b.build(),
    wheels: [wheelSpec(0.86, -1.15, 0.34, 0.26, true), wheelSpec(-0.86, -1.15, 0.34, 0.26, true), wheelSpec(0.86, 1.15, 0.34, 0.26), wheelSpec(-0.86, 1.15, 0.34, 0.26)],
    exhaust: [[0.45, 0.3, 1.85]],
    height: 1.4,
    length: 3.8,
  };
}

function buildPickup() {
  const b = new PartBuilder();
  const c = 0x3b82d6;
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
  const c = 0xffc21a;
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
  const c = 0xe8501a;
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
  const c = 0x3ec26b;
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

// speedMul: top speed multiplier        yawMax: max steering angle (rad)
// steerResp: how quickly it reaches it   drift: sensitivity to being flung wide by bends
// oil: how badly oil upsets it           hw/hl: collision half extents (m)
// spin: air spin rate (rad/s)            hop/ramp: jump multipliers
export const VEHICLES = [
  {
    id: 'compact', name: 'Compact', unlock: 0, build: buildCompact,
    blurb: 'Balanced and friendly. A great all-rounder.',
    speedMul: 1, accel: 11, yawMax: 0.42, steerResp: 9, drift: 1, oil: 1, hw: 0.85, hl: 1.7,
    spin: 7.5, hop: 1, ramp: 1, lean: 1, sturdy: false, crusher: false,
    ratings: { speed: 3, handling: 3, tough: 3, air: 3 },
  },
  {
    id: 'pickup', name: 'Pickup Truck', unlock: 800, build: buildPickup,
    blurb: 'Slower but sturdy. Shrugs off potholes.',
    speedMul: 0.9, accel: 9, yawMax: 0.38, steerResp: 7, drift: 0.85, oil: 0.9, hw: 1.0, hl: 2.2,
    spin: 6.6, hop: 0.9, ramp: 0.95, lean: 0.7, sturdy: true, crusher: false,
    ratings: { speed: 2, handling: 2, tough: 5, air: 2 },
  },
  {
    id: 'sports', name: 'Sports Car', unlock: 2500, build: buildSports,
    blurb: 'Blisteringly fast with razor steering. Twitchy!',
    speedMul: 1.14, accel: 15, yawMax: 0.52, steerResp: 15, drift: 1.55, oil: 1.7, hw: 0.9, hl: 2.0,
    spin: 8.2, hop: 0.95, ramp: 1, lean: 1.3, sturdy: false, crusher: false,
    ratings: { speed: 5, handling: 4, tough: 2, air: 3 },
  },
  {
    id: 'moto', name: 'Motorcycle', unlock: 5000, build: buildMoto,
    blurb: 'Super nimble, tiny hitbox, spins like a top.',
    speedMul: 1.04, accel: 14, yawMax: 0.5, steerResp: 12, drift: 1.1, oil: 1.3, hw: 0.4, hl: 1.1,
    spin: 11.5, hop: 1.05, ramp: 1, lean: -2.6, sturdy: false, crusher: false,
    ratings: { speed: 4, handling: 5, tough: 1, air: 5 },
  },
  {
    id: 'monster', name: 'Monster Truck', unlock: 9000, build: buildMonster,
    blurb: 'Crushes cones and barrels. Huge air, wide turns.',
    speedMul: 0.95, accel: 9, yawMax: 0.32, steerResp: 5, drift: 0.8, oil: 0.8, hw: 1.3, hl: 2.2,
    spin: 5.6, hop: 1.25, ramp: 1.35, lean: 0.5, sturdy: true, crusher: true,
    ratings: { speed: 3, handling: 1, tough: 4, air: 5 },
  },
];

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
  return {
    root,
    pivot,
    wheels,
    exhaust: spec.exhaust.map((e) => new THREE.Vector3(e[0], e[1], e[2])),
    height: spec.height,
    length: spec.length,
    dispose() {
      spec.body.dispose();
      for (const g of geoCache.values()) g.dispose();
    },
  };
}
