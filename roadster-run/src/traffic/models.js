import * as THREE from 'three';
import { mergeParts, part } from '../core/geometry.js';

const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const wheel = () => { const g = new THREE.CylinderGeometry(0.34, 0.34, 0.26, 8); g.rotateZ(Math.PI / 2); return g; };

// Traffic vehicle types. Body is white (tinted per car by its material colour);
// details carry their own vertex colours. Forward is -Z.
function vehicleType(spec) {
  const { L, W, H, cabin, cabinZ = 0, cabinH = 0.55, kind } = spec;
  const lower = H - cabinH;
  const bodyParts = [part(box(W, lower - 0.25, L), '#ffffff', [0, 0.25 + (lower - 0.25) / 2, 0])];
  const det = [];
  if (kind === 'truck') {
    // cab + cargo box
    bodyParts.length = 0;
    bodyParts.push(part(box(W, 1.6, 2.0), '#ffffff', [0, 1.25, -L / 2 + 1.0]));
    det.push(part(box(W + 0.05, 2.7, L - 2.3), '#e9e6df', [0, 1.85, 1.1]));
    det.push(part(box(W - 0.2, 0.5, 0.06), '#1d2633', [0, 1.65, -L / 2 - 0.01]));
    det.push(part(box(W, 0.3, L), '#30343a', [0, 0.35, 0]));
  } else {
    bodyParts.push(part(box(W * 0.86, cabinH, cabin), '#ffffff', [0, lower + cabinH / 2, cabinZ]));
    // windows
    det.push(part(box(W * 0.87, cabinH * 0.62, cabin * 0.9), '#1d2633', [0, lower + cabinH * 0.5, cabinZ]));
    det.push(part(box(W * 0.8, cabinH * 0.6, 0.05), '#26344a', [0, lower + cabinH * 0.48, cabinZ - cabin / 2 - 0.01]));
    det.push(part(box(W + 0.04, 0.18, L + 0.04), '#2b2f36', [0, 0.32, 0]));
  }
  // lights
  det.push(part(box(0.38, 0.14, 0.05), '#fff6d8', [-W / 2 + 0.3, lower - 0.15, -L / 2 - 0.02]));
  det.push(part(box(0.38, 0.14, 0.05), '#fff6d8', [W / 2 - 0.3, lower - 0.15, -L / 2 - 0.02]));
  det.push(part(box(0.42, 0.16, 0.05), '#c4141f', [-W / 2 + 0.3, lower - 0.12, L / 2 + 0.02]));
  det.push(part(box(0.42, 0.16, 0.05), '#c4141f', [W / 2 - 0.3, lower - 0.12, L / 2 + 0.02]));
  const wz = L / 2 - 0.85;
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) det.push(part(wheel(), '#16181b', [x * (W / 2 - 0.12), 0.34, z * wz]));
  if (kind === 'truck') det.push(part(wheel(), '#16181b', [-(W / 2 - 0.12), 0.34, wz - 1.1]), part(wheel(), '#16181b', [W / 2 - 0.12, 0.34, wz - 1.1]));
  return {
    kind,
    body: mergeParts(bodyParts),
    detail: mergeParts(det),
    halfL: L / 2, halfW: W / 2, height: H,
    indicatorY: lower - 0.12, indicatorZ: L / 2 + 0.03,
    speed: spec.speed,
    weight: spec.weight,
  };
}

let TYPES = null;
export function trafficTypes() {
  if (TYPES) return TYPES;
  TYPES = [
    vehicleType({ kind: 'sedan', L: 4.5, W: 1.82, H: 1.45, cabin: 2.3, cabinZ: 0.2, speed: [19, 27], weight: 4 }),
    vehicleType({ kind: 'hatch', L: 3.9, W: 1.74, H: 1.52, cabin: 2.1, cabinZ: 0.45, speed: [18, 25], weight: 3 }),
    vehicleType({ kind: 'suv', L: 4.8, W: 1.96, H: 1.8, cabin: 2.7, cabinZ: 0.35, cabinH: 0.7, speed: [18, 25], weight: 3 }),
    vehicleType({ kind: 'van', L: 5.2, W: 2.0, H: 2.3, cabin: 4.0, cabinZ: 0.5, cabinH: 1.1, speed: [16, 22], weight: 2 }),
    vehicleType({ kind: 'truck', L: 8.4, W: 2.4, H: 3.2, cabin: 0, speed: [14, 19], weight: 1.5 }),
  ];
  return TYPES;
}

export const TRAFFIC_COLORS = ['#e9ecef', '#2b2d42', '#adb5bd', '#3a86ff', '#ef476f', '#ffd166', '#06d6a0', '#8d99ae', '#f77f00', '#6a4c93'];

// Static obstacle geometry
let OBST = null;
export function obstacleTypes() {
  if (OBST) return OBST;
  const cone = mergeParts([
    part(box(0.6, 0.06, 0.6), '#222222', [0, 0.03, 0]),
    part(new THREE.ConeGeometry(0.25, 0.72, 8), '#ff6b1a', [0, 0.42, 0]),
    part(new THREE.CylinderGeometry(0.15, 0.19, 0.12, 8), '#f5f5f5', [0, 0.45, 0]),
  ]);
  const barrel = mergeParts([
    part(new THREE.CylinderGeometry(0.42, 0.42, 0.98, 9), '#ff7a1a', [0, 0.49, 0]),
    part(new THREE.CylinderGeometry(0.43, 0.43, 0.14, 9), '#f5f5f5', [0, 0.36, 0]),
    part(new THREE.CylinderGeometry(0.43, 0.43, 0.14, 9), '#f5f5f5', [0, 0.7, 0]),
    part(new THREE.CylinderGeometry(0.32, 0.32, 0.04, 9), '#222222', [0, 0.99, 0]),
  ]);
  const rb = [];
  rb.push(part(box(0.12, 1.15, 0.12), '#dddddd', [-1.45, 0.58, 0]));
  rb.push(part(box(0.12, 1.15, 0.12), '#dddddd', [1.45, 0.58, 0]));
  for (let i = 0; i < 8; i++) {
    rb.push(part(box(0.375, 0.32, 0.1), i % 2 ? '#f5f5f5' : '#e5383b', [-1.31 + i * 0.375, 0.95, 0]));
    rb.push(part(box(0.375, 0.24, 0.1), i % 2 ? '#e5383b' : '#f5f5f5', [-1.31 + i * 0.375, 0.5, 0]));
  }
  rb.push(part(box(0.6, 0.08, 0.6), '#333333', [-1.45, 0.04, 0]));
  rb.push(part(box(0.6, 0.08, 0.6), '#333333', [1.45, 0.04, 0]));
  const roadblock = mergeParts(rb);
  OBST = {
    cone: { geo: cone, halfW: 0.3, halfL: 0.3, height: 0.75, soft: true },
    barrel: { geo: barrel, halfW: 0.42, halfL: 0.42, height: 1.0, soft: false },
    roadblock: { geo: roadblock, halfW: 1.55, halfL: 0.3, height: 1.15, soft: false },
  };
  return OBST;
}
