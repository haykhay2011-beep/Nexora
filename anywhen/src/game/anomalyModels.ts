// Procedural models for anomalies (objects and small creatures out of their time).
import * as THREE from 'three';
import { MeshKit } from '../gen/meshkit';

export function anomalyGeometry(model: string): THREE.BufferGeometry {
  const k = new MeshKit();
  switch (model) {
    case 'phone': k.boxC(0.38, 0.72, 0.05, '#1a1a22', { y: 0.5 }); k.curGlow = 1; k.boxC(0.33, 0.62, 0.02, '#5ac8ff', { y: 0.5, z: 0.03 }); break;
    case 'robot_vacuum': k.cyl(0.35, 0.35, 0.12, 14, '#3a3a40', 0, 0.05, 0); k.curGlow = 1; k.cyl(0.08, 0.08, 0.03, 8, '#4aff8a', 0, 0.17, 0.15); break;
    case 'bicycle': for (const z of [-0.55, 0.55]) k.torus(0.35, 0.03, 4, 14, '#2a2a2a', { y: 0.38, z, ry: Math.PI / 2 }); k.boxC(0.05, 0.05, 1.1, '#c83a2a', { y: 0.6 }); k.boxC(0.05, 0.5, 0.05, '#c83a2a', { y: 0.55, z: -0.2 }); k.boxC(0.4, 0.04, 0.04, '#2a2a2a', { y: 0.9, z: 0.5 }); k.boxC(0.18, 0.05, 0.25, '#2a2a2a', { y: 0.85, z: -0.25 }); break;
    case 'alarm_clock': k.cyl(0.25, 0.25, 0.12, 14, '#c8a050', 0, 0.3, 0, { rx: Math.PI / 2, y: 0.4 }); k.cyl(0.21, 0.21, 0.13, 14, '#f2ead8', 0, 0.4, 0.01, { rx: Math.PI / 2, y: 0.4 }); for (const x of [-0.15, 0.15]) k.dome(0.09, 8, 3, '#c8a050', x, 0.62, 0); break;
    case 'camera': k.boxC(0.4, 0.3, 0.3, '#2a2420', { y: 0.35 }); k.cyl(0.1, 0.1, 0.12, 10, '#5a5a5a', 0, 0.35, 0.18, { rx: Math.PI / 2, y: 0.35 }); break;
    case 'skateboard': k.boxC(0.25, 0.04, 0.85, '#e8b83a', { y: 0.12 }); for (const z of [-0.3, 0.3]) for (const x of [-0.1, 0.1]) k.cyl(0.04, 0.04, 0.04, 8, '#f2f2f2', x, 0.05, z, { rz: Math.PI / 2, y: 0.05 }); break;
    case 'headphones': k.torus(0.22, 0.03, 4, 14, '#2a2a2a', { y: 0.45, sz: 0.4 }); for (const x of [-0.22, 0.22]) k.cyl(0.09, 0.09, 0.06, 10, '#c83a5a', x, 0.3, 0, { rz: Math.PI / 2, y: 0.3 }); break;
    case 'rubber_duck': k.blob(0.2, '#ffd83a', 0, 0.2, 0, { sz: 1.3 }); k.blob(0.13, '#ffd83a', 0, 0.42, 0.12); k.cone(0.05, 0.12, 4, '#ff8a2a', 0, 0.42, 0.25, { rx: Math.PI / 2, y: 0.42 }); break;
    case 'teddy': k.blob(0.2, '#a8784a', 0, 0.25, 0, { sy: 1.2 }); k.blob(0.14, '#a8784a', 0, 0.55, 0); for (const x of [-0.1, 0.1]) k.blob(0.05, '#8a5a3a', x, 0.67, 0); break;
    case 'bulb': k.curGlow = 1; k.sphere(0.2, 10, 8, '#fff2a8', 0, 0.45, 0); k.curGlow = 0; k.cyl(0.08, 0.1, 0.18, 10, '#a8a8a8', 0, 0.15, 0); break;
    case 'gramophone': k.box(0.45, 0.2, 0.45, '#6b4a2e', 0, 0, 0); k.cyl(0.18, 0.18, 0.02, 14, '#1a1a1a', 0, 0.2, 0); k.cone(0.3, 0.5, 12, '#c8a050', 0.15, 0.4, 0, { rz: 2.3 }); break;
    case 'typewriter': k.box(0.55, 0.15, 0.4, '#2a2a2a', 0, 0, 0); k.boxC(0.6, 0.08, 0.1, '#3a3a3a', { y: 0.25, z: -0.12 }); for (let i = 0; i < 12; i++) k.cyl(0.02, 0.02, 0.04, 6, '#e8e8e8', -0.2 + (i % 6) * 0.08, 0.15, 0.05 + Math.floor(i / 6) * 0.08); break;
    case 'toy_train': k.boxC(0.3, 0.25, 0.6, '#c83a2a', { y: 0.2 }); k.cyl(0.08, 0.08, 0.25, 8, '#2a2a2a', 0, 0.35, 0.18); for (const z of [-0.2, 0.2]) for (const x of [-0.16, 0.16]) k.cyl(0.07, 0.07, 0.04, 8, '#2a2a2a', x, 0.07, z, { rz: Math.PI / 2, y: 0.07 }); break;
    case 'globe': k.cyl(0.03, 0.12, 0.25, 8, '#6b4a2e', 0, 0, 0); k.sphere(0.25, 12, 8, (_x, ny, _z, f) => (f % 3 ? '#3a7ab8' : '#c8a86a'), 0, 0.5, 0); k.torus(0.28, 0.015, 3, 16, '#c8a050', { y: 0.5, rx: 0.4 }); break;
    case 'telescope': k.cyl(0.05, 0.08, 0.8, 10, '#c8a050', 0, 0.4, 0, { rx: 1.1 }); for (const a of [0, 2.1, 4.2]) k.cyl(0.015, 0.015, 0.45, 4, '#6b4a2e', Math.cos(a) * 0.12, 0, Math.sin(a) * 0.12, { rz: Math.cos(a) * 0.3, rx: Math.sin(a) * 0.3 }); break;
    case 'pocket_watch': k.cyl(0.18, 0.18, 0.05, 14, '#e8c860', 0, 0.3, 0, { rx: Math.PI / 2, y: 0.3 }); k.cyl(0.15, 0.15, 0.055, 14, '#f2ead8', 0, 0.3, 0.005, { rx: Math.PI / 2, y: 0.3 }); k.torus(0.05, 0.012, 3, 8, '#e8c860', { y: 0.5 }); break;
    case 'book': k.boxC(0.3, 0.06, 0.4, '#7a2a2a', { y: 0.2 }); k.boxC(0.28, 0.05, 0.38, '#f2ead8', { y: 0.2, x: 0.01 }); break;
    case 'astrolabe': k.cyl(0.25, 0.25, 0.03, 16, '#c8a050', 0, 0.4, 0, { rx: Math.PI / 2, y: 0.4 }); k.torus(0.2, 0.02, 3, 16, '#e8c860', { y: 0.4 }); k.boxC(0.45, 0.02, 0.02, '#e8c860', { y: 0.4, rz: 0.5 }); k.torus(0.05, 0.015, 3, 8, '#c8a050', { y: 0.68 }); break;
    case 'compass': k.cyl(0.2, 0.2, 0.06, 14, '#5a7a8a', 0, 0.2, 0); k.boxC(0.3, 0.02, 0.04, '#c83a2a', { y: 0.27, ry: 0.4 }); break;
    case 'type_block': for (let i = 0; i < 6; i++) k.box(0.12, 0.12, 0.12, '#a8784a', (i % 3) * 0.14 - 0.14, 0.05, Math.floor(i / 3) * 0.14 - 0.07); break;
    case 'vase_blue': k.lathe([[0, 0], [0.12, 0], [0.2, 0.2], [0.18, 0.45], [0.08, 0.55], [0.1, 0.62], [0, 0.62]], 12, '#f2f2f8', { y: 0 }); k.torus(0.19, 0.02, 3, 12, '#2a4aa8', { y: 0.25, rx: Math.PI / 2 }); break;
    case 'stained_glass': k.curGlow = 0.6; k.boxC(0.5, 0.7, 0.03, (_x, _y, _z, f) => ['#c83a3a', '#3a5ac8', '#e8c83a', '#3a9a5a'][f % 4], { y: 0.5 }); k.curGlow = 0; k.boxC(0.54, 0.74, 0.02, '#3a3a3a', { y: 0.5, z: -0.02 }); break;
    case 'figurehead': k.cyl(0.06, 0.12, 0.8, 6, '#6b4a2e', 0, 0, 0, { rx: 0.3 }); k.boxC(0.18, 0.25, 0.35, '#7a5a3a', { y: 0.85, z: 0.2 }); break;
    case 'scroll': k.cyl(0.07, 0.07, 0.5, 10, '#e8dcb8', 0, 0.2, 0, { rz: Math.PI / 2, y: 0.2 }); for (const x of [-0.28, 0.28]) k.cyl(0.03, 0.03, 0.08, 6, '#6b4a2e', x, 0.2, 0, { rz: Math.PI / 2, y: 0.2 }); break;
    case 'tablet': k.boxC(0.3, 0.42, 0.08, '#b8946a', { y: 0.3, rx: -0.2 }); for (let i = 0; i < 6; i++) k.boxC(0.2, 0.02, 0.01, '#8a6a4a', { y: 0.45 - i * 0.05, z: 0.04, rx: -0.2 }); break;
    case 'sundial': k.boxC(0.6, 0.06, 0.12, '#c8b48a', { y: 0.1 }); k.boxC(0.1, 0.25, 0.12, '#c8b48a', { x: -0.25, y: 0.25 }); break;
    case 'amphora': k.lathe([[0, 0], [0.04, 0], [0.18, 0.3], [0.2, 0.5], [0.08, 0.7], [0.06, 0.82], [0, 0.82]], 10, '#c86a3a'); for (const x of [-0.1, 0.1]) k.torus(0.06, 0.015, 3, 8, '#c86a3a', { x, y: 0.7, ry: Math.PI / 2 }); break;
    case 'kite': k.tris([0, 0.9, 0, 0.35, 0.5, 0, 0, 0, 0, 0, 0.9, 0, 0, 0, 0, -0.35, 0.5, 0], (_x, _y, _z, f) => (f ? '#c83a3a' : '#e8c83a'), { y: 0.3 }); k.boxC(0.01, 0.6, 0.01, '#e8e0c8', { y: 0.1 }); break;
    case 'abacus': k.boxC(0.5, 0.35, 0.05, '#6b4a2e', { y: 0.3 }); for (let r = 0; r < 4; r++) for (let i = 0; i < 5; i++) k.sphere(0.03, 5, 3, '#c83a2a', -0.18 + i * 0.07, 0.18 + r * 0.08, 0.03); break;
    case 'hand_axe': k.blob(0.18, '#8a8478', 0, 0.2, 0, { sy: 1.4, sz: 0.4 }, 0); break;
    case 'ochre_pot': k.lathe([[0, 0], [0.12, 0], [0.15, 0.12], [0.1, 0.2], [0, 0.2]], 8, '#8a6a4a'); k.cyl(0.09, 0.09, 0.02, 8, '#a8402a', 0, 0.19, 0); break;
    case 'hoverboard': k.curGlow = 1; k.boxC(0.3, 0.03, 0.9, '#36e0ff', { y: 0.32 }); k.curGlow = 0; k.boxC(0.32, 0.06, 0.92, '#f2f2f8', { y: 0.36 }); break;
    case 'solar_drone': k.boxC(0.8, 0.03, 0.5, '#2a3a6a', { y: 0.6 }); k.curGlow = 1; k.boxC(0.1, 0.1, 0.1, '#ffd83a', { y: 0.55 }); break;
    case 'holo_cube': k.curGlow = 1; k.boxC(0.35, 0.35, 0.35, '#a07aff', { y: 0.5, rx: 0.6, rz: 0.6 }); k.boxC(0.2, 0.2, 0.2, '#7dffb2', { y: 0.5, ry: 0.8 }); break;
    case 'time_crystal': k.curGlow = 1; k.cone(0.15, 0.6, 5, '#7af0ff', 0, 0.3, 0); k.cone(0.15, 0.3, 5, '#7af0ff', 0, 0.3, 0, { rx: Math.PI, y: 0.3 }); break;
    case 'casing_stone': k.pyramid(1.2, 1.0, 0.7, '#f4ecd8', 0, 0, 0, 0, 1.2, 0.5); break;
    case 'rocket': k.cyl(0.08, 0.08, 0.9, 10, '#f2f2f0', 0, 0, 0); k.cone(0.08, 0.2, 10, '#f2f2f0', 0, 0.9, 0); k.cyl(0.081, 0.081, 0.08, 10, '#1a1a1a', 0, 0.5, 0); break;
    case 'film_reel': k.cyl(0.25, 0.25, 0.06, 14, '#9a9aa2', 0, 0.3, 0, { rx: Math.PI / 2, y: 0.3 }); k.cyl(0.18, 0.18, 0.065, 14, '#3a2a1a', 0, 0.3, 0, { rx: Math.PI / 2, y: 0.3 }); break;
    case 'ammonite': for (let i = 0; i < 14; i++) { const a = i * 0.55, r = 0.06 + i * 0.016; k.sphere(0.06 + i * 0.008, 6, 4, i % 2 ? '#c8a878' : '#a8885a', Math.cos(a) * r, 0.3 + Math.sin(a) * r, 0); } break;
    case 'robot': k.boxC(0.4, 0.45, 0.3, '#e8f0f8', { y: 0.55 }); k.boxC(0.32, 0.25, 0.28, '#e8f0f8', { y: 0.95 }); k.curGlow = 1; for (const x of [-0.08, 0.08]) k.sphere(0.04, 5, 4, '#36e0ff', x, 0.98, 0.15); k.curGlow = 0; for (const x of [-0.12, 0.12]) k.box(0.1, 0.32, 0.12, '#8a9aa8', x, 0, 0); break;
    default: k.boxC(0.3, 0.3, 0.3, '#a07aff', { y: 0.3 });
  }
  return k.toGeometry();
}

/** Creature anomalies reuse an animal model, scaled down. */
export const CREATURE_MODEL: Record<string, { species: string; scale: number }> = {
  mammoth_calf: { species: 'mammoth', scale: 0.32 },
  sabertooth_kitten: { species: 'smilodon', scale: 0.35 },
  baby_trike: { species: 'triceratops', scale: 0.18 },
  dodo: { species: 'wild_turkey', scale: 0.9 },
  moa_chick: { species: 'emu', scale: 0.35 },
  solar_drone: { species: 'garden_drone', scale: 1.2 },
  robot: { species: 'robo_hound', scale: 0.8 },
};
