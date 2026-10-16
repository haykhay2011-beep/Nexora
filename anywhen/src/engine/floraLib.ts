// Flora geometry per species (unit height, scaled per instance), with a low-detail LOD.
import * as THREE from 'three';
import { MeshKit, shade, type Col } from '../gen/meshkit';
import { SPECIES_BY_ID, type FloraSpecies } from '../data';

const cache = new Map<string, THREE.BufferGeometry>();

export function floraGeometry(species: string, lod: number, grassColor?: string): THREE.BufferGeometry {
  const key = species + ':' + lod + ':' + (grassColor ?? '');
  let g = cache.get(key);
  if (g) return g;
  const k = new MeshKit();
  if (species === '_grass') {
    const c = grassColor ?? '#7a9a4a';
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI;
      k.tris([-0.12, 0, 0, 0.12, 0, 0, 0, 0.5, 0], (_x, _y, _z, f) => (f % 2 ? shade(c, 1.1) : c), { ry: a, rz: (i - 1) * 0.25 });
    }
  } else {
    const sp = SPECIES_BY_ID.get(species);
    if (sp) buildSpecies(k, sp, lod);
    else k.rock(0.5, '#8a8478', 0, 0.3, 0);
  }
  g = k.toGeometry();
  cache.set(key, g);
  return g;
}

function leafy(k: MeshKit, c: Col[], x: number, y: number, z: number, r: number, lod: number, sy = 1) {
  k.blob(r, (_nx, ny, _nz, f) => shade(c[f % 2 === 0 ? 0 : f % c.length], 0.86 + ny * 0.2), x, y, z, { sy }, lod === 0 ? 1 : 0);
}

function buildSpecies(k: MeshKit, sp: FloraSpecies, lod: number) {
  const c = sp.colors, t = sp.trunk;
  const hi = lod === 0;
  switch (sp.arch) {
    case 'broadleaf': {
      k.cyl(0.035, 0.06, 0.5, hi ? 6 : 4, t, 0, 0, 0);
      leafy(k, c, 0, 0.62, 0, 0.3, lod, 0.8);
      if (hi) { leafy(k, c, 0.18, 0.55, 0.05, 0.2, lod); leafy(k, c, -0.15, 0.58, -0.1, 0.22, lod); leafy(k, c, 0.02, 0.8, 0.02, 0.18, lod); }
      break;
    }
    case 'cherry': case 'willow': {
      k.cyl(0.04, 0.06, 0.45, 5, t, 0, 0, 0);
      leafy(k, c, 0, 0.6, 0, 0.32, lod, 0.7);
      if (hi && sp.arch === 'willow') for (let i = 0; i < 6; i++) { const a = i; k.boxC(0.03, 0.45, 0.12, c[0], { x: Math.cos(a) * 0.28, y: 0.45, z: Math.sin(a) * 0.28 }); }
      break;
    }
    case 'conifer': {
      k.cyl(0.03, 0.05, 0.25, 5, t, 0, 0, 0);
      const tiers = hi ? 4 : 2;
      for (let i = 0; i < tiers; i++) k.cone(0.28 - i * (0.2 / tiers), 0.42 - i * 0.04, hi ? 7 : 5, shade(c[i % c.length], 0.95 + i * 0.04), 0, 0.15 + i * (0.75 / tiers), 0);
      break;
    }
    case 'cedar': {
      k.cyl(0.04, 0.06, 0.6, 5, t, 0, 0, 0);
      for (let i = 0; i < (hi ? 4 : 2); i++) k.cyl(0.28 - i * 0.05, 0.3 - i * 0.05, 0.06, 7, c[i % c.length], 0, 0.35 + i * 0.17, 0);
      break;
    }
    case 'cypress': {
      k.cyl(0.02, 0.03, 0.1, 4, t, 0, 0, 0);
      k.cone(0.14, 0.92, 7, c[0], 0, 0.08, 0);
      if (hi) k.cone(0.11, 0.5, 6, c[1 % c.length], 0, 0.45, 0);
      break;
    }
    case 'birch': {
      k.cyl(0.02, 0.03, 0.75, 5, t, 0, 0, 0);
      if (hi) for (let i = 0; i < 4; i++) k.box(0.031, 0.02, 0.031, '#2a2a2a', 0, 0.15 + i * 0.15, 0);
      leafy(k, c, 0, 0.7, 0, 0.2, lod, 1.4);
      break;
    }
    case 'eucalyptus': {
      k.cyl(0.025, 0.04, 0.7, 5, t, 0, 0, 0);
      leafy(k, c, 0.05, 0.75, 0, 0.18, lod, 1.1);
      if (hi) leafy(k, c, -0.1, 0.65, 0.05, 0.14, lod);
      break;
    }
    case 'palm': {
      for (let i = 0; i < (hi ? 5 : 2); i++) k.cyl(0.03, 0.035, 0.2, 5, shade(t, 1 - i * 0.03), 0.015 * i * i, i * 0.19, 0, { rz: -0.04 * i });
      const top = 0.95, tx = 0.015 * 16;
      for (let i = 0; i < (hi ? 7 : 5); i++) { const a = (i / 7) * Math.PI * 2; k.boxC(0.38, 0.01, 0.07, c[i % c.length], { x: tx + Math.cos(a) * 0.17, y: top - 0.04, z: Math.sin(a) * 0.17, ry: -a, rz: -0.45 }); }
      if (hi) k.blob(0.04, '#6b4a2e', tx, top - 0.03, 0);
      break;
    }
    case 'banana': {
      k.cyl(0.04, 0.05, 0.5, 5, t, 0, 0, 0);
      for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; k.boxC(0.45, 0.01, 0.14, c[i % c.length], { x: Math.cos(a) * 0.2, y: 0.6, z: Math.sin(a) * 0.2, ry: -a, rz: 0.5 }); }
      break;
    }
    case 'bamboo': {
      for (let i = 0; i < (hi ? 6 : 3); i++) { const x = Math.cos(i * 2.4) * 0.06, z = Math.sin(i * 2.4) * 0.06; k.cyl(0.012, 0.014, 1, 4, t, x, 0, z, { rz: (i - 2.5) * 0.03 }); if (hi) leafy(k, c, x, 0.9, z, 0.07, lod, 1.5); }
      break;
    }
    case 'emergent': case 'banyan': {
      k.cyl(0.03, 0.06, 0.75, 6, t, 0, 0, 0);
      if (sp.arch === 'banyan' && hi) for (let i = 0; i < 5; i++) k.cyl(0.008, 0.008, 0.45, 3, t, Math.cos(i) * 0.25, 0, Math.sin(i) * 0.25);
      leafy(k, c, 0, 0.8, 0, 0.35, lod, 0.45);
      if (hi) { leafy(k, c, 0.25, 0.75, 0.1, 0.22, lod, 0.5); leafy(k, c, -0.2, 0.78, -0.15, 0.24, lod, 0.5); }
      break;
    }
    case 'baobab': {
      k.cyl(0.12, 0.16, 0.7, 7, t, 0, 0, 0);
      for (let i = 0; i < (hi ? 6 : 3); i++) { const a = i; k.cyl(0.015, 0.03, 0.25, 4, t, Math.cos(a) * 0.08, 0.65, Math.sin(a) * 0.08, { rz: Math.cos(a) * 0.8, rx: Math.sin(a) * 0.8 }); }
      leafy(k, c, 0, 0.85, 0, 0.22, lod, 0.4);
      break;
    }
    case 'acacia': {
      k.cyl(0.02, 0.035, 0.6, 5, t, 0, 0, 0, { rz: 0.1 });
      k.cyl(0.35, 0.28, 0.1, hi ? 9 : 6, c[0], 0.05, 0.62, 0);
      if (hi) k.cyl(0.22, 0.18, 0.08, 7, c[1 % c.length], -0.1, 0.7, 0.05);
      break;
    }
    case 'araucaria': {
      k.cyl(0.02, 0.035, 0.95, 5, t, 0, 0, 0);
      for (let i = 0; i < (hi ? 5 : 2); i++) for (let j = 0; j < 5; j++) { const a = (j / 5) * Math.PI * 2 + i; k.boxC(0.22 - i * 0.03, 0.02, 0.03, c[0], { x: Math.cos(a) * 0.1, y: 0.55 + i * 0.09, z: Math.sin(a) * 0.1, ry: -a, rz: -0.25 }); }
      leafy(k, c, 0, 0.98, 0, 0.1, lod, 0.6);
      break;
    }
    case 'mangrove': {
      for (let i = 0; i < 5; i++) k.cyl(0.01, 0.015, 0.4, 3, t, Math.cos(i * 1.3) * 0.15, 0, Math.sin(i * 1.3) * 0.15, { rz: Math.cos(i * 1.3) * -0.4, rx: Math.sin(i * 1.3) * 0.4 });
      leafy(k, c, 0, 0.6, 0, 0.32, lod, 0.6);
      break;
    }
    case 'cactus': {
      k.cyl(0.07, 0.08, 0.95, 7, c[0], 0, 0, 0);
      k.dome(0.07, 7, 3, c[0], 0, 0.95, 0);
      if (hi) for (const s of [-1, 1]) { k.cyl(0.045, 0.05, 0.18, 6, c[0], s * 0.12, 0.42, 0, { rz: s * -1.4 }); k.cyl(0.04, 0.045, 0.28, 6, c[0], s * 0.2, 0.5, 0); }
      break;
    }
    case 'agave': {
      for (let i = 0; i < (hi ? 10 : 5); i++) { const a = (i / 10) * Math.PI * 2; k.cone(0.06, 0.8, 3, c[i % c.length], Math.cos(a) * 0.12, 0, Math.sin(a) * 0.12, { rz: Math.cos(a) * 0.6, rx: -Math.sin(a) * 0.6 }); }
      break;
    }
    case 'tussock': case 'plume': {
      for (let i = 0; i < (hi ? 7 : 3); i++) { const a = (i / 7) * Math.PI * 2; k.cone(0.06, 0.9, 3, c[i % c.length], Math.cos(a) * 0.08, 0, Math.sin(a) * 0.08, { rz: Math.cos(a) * 0.35, rx: -Math.sin(a) * 0.35 }); }
      if (sp.arch === 'plume') for (let i = 0; i < 3; i++) k.blob(0.07, '#f2ead8', Math.cos(i * 2) * 0.15, 0.95, Math.sin(i * 2) * 0.15, { sy: 2 });
      break;
    }
    case 'bush': {
      leafy(k, c, 0, 0.42, 0, 0.5, lod, 0.75);
      if (hi) leafy(k, c, 0.3, 0.3, 0.1, 0.32, lod, 0.8);
      break;
    }
    case 'moss': {
      k.blob(0.5, c[0], 0, 0.05, 0, { sy: 0.2 });
      break;
    }
    case 'fern': case 'treefern': {
      const tf = sp.arch === 'treefern';
      if (tf) k.cyl(0.03, 0.04, 0.75, 5, t, 0, 0, 0);
      const y = tf ? 0.75 : 0.05;
      for (let i = 0; i < (hi ? 8 : 4); i++) { const a = (i / 8) * Math.PI * 2; k.boxC(tf ? 0.35 : 0.6, 0.01, 0.1, c[i % c.length], { x: Math.cos(a) * (tf ? 0.16 : 0.25), y: y + (tf ? 0 : 0.25), z: Math.sin(a) * (tf ? 0.16 : 0.25), ry: -a, rz: tf ? -0.3 : 0.6 }); }
      break;
    }
    case 'cycad': {
      k.cyl(0.08, 0.1, 0.35, 6, t, 0, 0, 0);
      for (let i = 0; i < (hi ? 9 : 5); i++) { const a = (i / 9) * Math.PI * 2; k.boxC(0.5, 0.01, 0.1, c[i % c.length], { x: Math.cos(a) * 0.22, y: 0.42, z: Math.sin(a) * 0.22, ry: -a, rz: -0.2 }); }
      break;
    }
    case 'reed': {
      for (let i = 0; i < (hi ? 6 : 3); i++) k.cyl(0.008, 0.012, 1, 3, c[i % c.length], Math.cos(i * 2.2) * 0.08, 0, Math.sin(i * 2.2) * 0.08, { rz: Math.cos(i) * 0.1 });
      if (hi) k.cyl(0.02, 0.02, 0.12, 4, '#6b4a2e', 0.02, 0.9, 0);
      break;
    }
    case 'flower': {
      for (let i = 0; i < (hi ? 5 : 3); i++) {
        const x = Math.cos(i * 2.4) * 0.2, z = Math.sin(i * 2.4) * 0.2;
        k.cyl(0.01, 0.01, 0.7, 3, t, x, 0, z);
        k.blob(0.07, c[i % c.length], x, 0.72, z);
      }
      break;
    }
    case 'glow': {
      k.cyl(0.03, 0.05, 0.55, 6, t, 0, 0, 0);
      k.curGlow = 0.8;
      leafy(k, c, 0, 0.68, 0, 0.26, lod, 0.9);
      if (hi) { leafy(k, [c[1 % c.length]], 0.2, 0.6, 0, 0.13, lod); leafy(k, [c[2 % c.length]], -0.18, 0.62, 0.08, 0.12, lod); }
      k.curGlow = 0;
      break;
    }
    case 'crystal': {
      k.curGlow = 0.6;
      for (let i = 0; i < (hi ? 5 : 3); i++) k.cone(0.07, 0.6 + i * 0.1, 4, c[i % c.length], Math.cos(i * 1.9) * 0.1, 0, Math.sin(i * 1.9) * 0.1, { rz: Math.cos(i) * 0.3, rx: Math.sin(i) * 0.3 });
      k.curGlow = 0;
      break;
    }
    case 'rock': {
      k.rock(0.5, (_x, ny, _z, f) => shade(c[f % c.length], 0.85 + ny * 0.2), 0, 0.15, 0, { sy: 0.6 });
      break;
    }
    case 'boulder': {
      k.rock(0.5, (_x, ny, _z, f) => shade(c[f % c.length], 0.8 + ny * 0.25), 0, 0.2, 0, { sy: 0.75, sx: 1.1 });
      if (hi) k.rock(0.25, c[0], 0.4, 0.05, 0.2);
      break;
    }
    default:
      leafy(k, c, 0, 0.5, 0, 0.3, lod);
  }
}

/** Large rocks/boulders and big trees cast shadows; small flora does not. */
export function castsShadow(species: string): boolean {
  if (species === '_grass') return false;
  const sp = SPECIES_BY_ID.get(species);
  if (!sp) return false;
  return sp.size[1] > 3;
}
