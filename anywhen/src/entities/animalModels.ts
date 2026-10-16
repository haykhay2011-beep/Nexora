// Procedural animal geometry from animals.json body parameters. Faces +z.
import * as THREE from 'three';
import { MeshKit, arraysToGeometry, shade, type Col } from '../gen/meshkit';
import type { AnimalDef } from '../data/types';

// parts: 0 body, 1 head/neck, 2 FL, 3 FR, 4 BL, 5 BR, 6 tail, 7 wingL / rotor, 8 wingR
export interface AnimalModel { geo: THREE.BufferGeometry; pivots: THREE.Vector3[]; kind: number; height: number; length: number }

const KIND: Record<string, number> = { quadruped: 0, sauropod: 0, theropod: 1, penguin: 1, bird: 2, pterosaur: 2, fish: 3, hopper: 4, drone: 5 };

export function buildAnimal(a: AnimalDef): AnimalModel {
  const k = new MeshKit();
  k.useParts = true;
  const b = a.body;
  const f = new Set(a.features);
  const [c0, c1, c2] = [a.colors[0], a.colors[1] ?? a.colors[0], a.colors[2] ?? a.colors[0]];
  const P = (p: number) => { k.curPart = p; k.curSlot = 5; };
  const glow = f.has('glow');
  const piv: THREE.Vector3[] = Array.from({ length: 10 }, () => new THREE.Vector3());
  const kind = KIND[a.archetype] ?? 0;
  let height = b.leg + b.h;
  const body = (col: Col) => (f.has('stripes') ? (_x: number, ny: number, _z: number, fi: number) => (fi % 4 < 2 ? col : c1) : f.has('spots') ? (_x: number, _y: number, _z: number, fi: number) => (fi % 5 === 0 ? c2 : col) : col);

  switch (a.archetype) {
    case 'quadruped':
    case 'sauropod': {
      const legY = b.leg, bl = b.l, bh = b.h, bw = b.w;
      P(0);
      k.blob(1, body(c0), 0, legY + bh * 0.5, 0, { sx: bw * 0.55, sy: bh * 0.55, sz: bl * 0.55 }, 1);
      if (f.has('hump') || f.has('hump_small')) k.blob(1, c0, 0, legY + bh * (f.has('hump_small') ? 0.95 : 1.05), bl * 0.12, { sx: bw * 0.3, sy: bh * 0.35, sz: bl * 0.18 });
      if (f.has('humps2')) for (const z of [-0.15, 0.15]) k.blob(1, c0, 0, legY + bh, bl * z, { sx: bw * 0.25, sy: bh * 0.32, sz: bl * 0.12 });
      if (f.has('wool') || f.has('hair_long') || f.has('hair')) k.blob(1, c0, 0, legY + bh * 0.55, 0, { sx: bw * 0.6, sy: bh * 0.6, sz: bl * 0.5 });
      if (f.has('armor') || f.has('plates')) for (let i = 0; i < 7; i++) k.cone(bw * 0.08, bh * 0.25, 4, c2, (i % 2 - 0.5) * bw * 0.6, legY + bh * 0.95, -bl * 0.4 + i * bl * 0.13);
      if (f.has('shell')) k.dome(1, 8, 4, c1, 0, legY + bh * 0.3, 0, { sx: bw * 0.6, sy: bh * 0.8, sz: bl * 0.55 });
      if (f.has('panda')) { k.blob(1, '#1a1a1a', 0, legY + bh * 0.55, -bl * 0.05, { sx: bw * 0.57, sy: bh * 0.3, sz: bl * 0.15 }); }
      // legs
      const lx = bw * 0.32, lz = bl * 0.36;
      const legs: [number, number, number][] = [[2, lx, lz], [3, -lx, lz], [4, lx, -lz], [5, -lx, -lz]];
      for (const [p, x, z] of legs) {
        P(p);
        piv[p].set(x, legY, z);
        k.box(b.legT, legY, b.legT, f.has('panda') ? '#1a1a1a' : shade(c0, 0.92), x, 0, z);
        k.box(b.legT * 1.1, Math.min(0.15, legY * 0.12), b.legT * 1.2, shade(c2, 0.6), x, 0, z + b.legT * 0.1);
      }
      // neck + head
      P(1);
      const neckBase = new THREE.Vector3(0, legY + bh * 0.7, bl * 0.42);
      piv[1].copy(neckBase);
      const up = b.neckUp, nl = b.neck;
      const headPos = new THREE.Vector3(0, neckBase.y + nl * up, neckBase.z + nl * Math.sqrt(Math.max(0, 1 - up * up)) + b.head * 0.3);
      if (nl > 0.05) k.boxC(b.legT * 1.4 + (a.archetype === 'sauropod' ? bw * 0.15 : 0), b.legT * 1.4, nl + 0.2, c0, { x: 0, y: (neckBase.y + headPos.y) / 2, z: (neckBase.z + headPos.z) / 2 - b.head * 0.15, rx: -Math.asin(Math.min(1, up)) });
      k.boxC(b.head * 0.55, b.head * 0.5, b.head, c0, { x: 0, y: headPos.y, z: headPos.z });
      k.boxC(b.head * 0.4, b.head * 0.32, b.head * 0.4, c1, { x: 0, y: headPos.y - b.head * 0.1, z: headPos.z + b.head * 0.55 });
      k.curSlot = 5;
      for (const sx of [-1, 1]) k.boxC(b.head * 0.08, b.head * 0.08, b.head * 0.08, '#141414', { x: sx * b.head * 0.28, y: headPos.y + b.head * 0.1, z: headPos.z + b.head * 0.25 });
      if (f.has('ears_big')) for (const sx of [-1, 1]) k.boxC(b.head * 0.08, b.head * 0.8, b.head * 0.6, shade(c0, 0.9), { x: sx * b.head * 0.45, y: headPos.y, z: headPos.z - b.head * 0.25, ry: sx * 0.4 });
      if (f.has('ears_long') || f.has('ears_pointed') || f.has('ears_floppy') || f.has('ears_round') || f.has('ears_small'))
        for (const sx of [-1, 1]) k.boxC(b.head * 0.12, b.head * (f.has('ears_long') ? 0.55 : 0.3), b.head * 0.1, c0, { x: sx * b.head * 0.22, y: headPos.y + b.head * 0.35, z: headPos.z - b.head * 0.25, rz: f.has('ears_floppy') ? sx * 1.8 : sx * 0.3 });
      if (f.has('horns') || f.has('horns_long') || f.has('horns_wide') || f.has('horns_back') || f.has('horns_curl') || f.has('horns_thin'))
        for (const sx of [-1, 1]) k.cone(b.head * 0.08, b.head * (f.has('horns_long') ? 0.9 : f.has('horns_wide') ? 0.8 : 0.45), 4, '#e8e0cc', sx * b.head * 0.25, headPos.y + b.head * 0.2, headPos.z - b.head * 0.2, { rz: sx * (f.has('horns_wide') ? -1.3 : -0.5), rx: f.has('horns_back') ? -0.9 : 0 });
      if (f.has('antlers') || f.has('antlers_giant') || f.has('antlers_palm')) {
        const s = f.has('antlers_giant') ? 2.2 : 1;
        for (const sx of [-1, 1]) {
          k.boxC(0.05 * s, b.head * 0.9 * s, 0.05 * s, '#c8b490', { x: sx * b.head * 0.35, y: headPos.y + b.head * 0.7 * s, z: headPos.z - b.head * 0.2, rz: sx * -0.5 });
          k.boxC(0.04 * s, b.head * 0.5 * s, 0.04 * s, '#c8b490', { x: sx * b.head * 0.7 * s, y: headPos.y + b.head * 1.0 * s, z: headPos.z - b.head * 0.1, rz: sx * 0.4 });
          if (f.has('antlers_palm')) k.boxC(b.head * 0.6, 0.06, b.head * 0.5, '#c8b490', { x: sx * b.head * 0.7, y: headPos.y + b.head * 1.1, z: headPos.z - b.head * 0.2, rz: sx * -0.3 });
        }
      }
      if (f.has('horn_big')) k.cone(b.head * 0.14, b.head * 0.6, 5, '#d8d0c0', 0, headPos.y + b.head * 0.1, headPos.z + b.head * 0.55, { rx: 0.5 });
      if (f.has('horns3')) { for (const sx of [-1, 1]) k.cone(b.head * 0.07, b.head * 0.7, 5, '#e8e0cc', sx * b.head * 0.2, headPos.y + b.head * 0.3, headPos.z + b.head * 0.1, { rx: 1.1 }); k.cone(b.head * 0.06, b.head * 0.3, 5, '#e8e0cc', 0, headPos.y, headPos.z + b.head * 0.55, { rx: 0.6 }); }
      if (f.has('frill') || f.has('frill_small')) k.cyl(b.head * (f.has('frill') ? 0.7 : 0.4), b.head * (f.has('frill') ? 0.7 : 0.4), 0.06, 8, c2, 0, headPos.y + b.head * 0.25, headPos.z - b.head * 0.45, { rx: Math.PI / 2 - 0.5, y: headPos.y + b.head * 0.25 });
      if (f.has('trunk')) for (let i = 0; i < 4; i++) k.boxC(b.head * 0.18 * (1 - i * 0.15), b.head * 0.45, b.head * 0.18 * (1 - i * 0.15), c0, { x: 0, y: headPos.y - b.head * 0.35 - i * b.head * 0.38, z: headPos.z + b.head * 0.55 + i * 0.03 });
      if (f.has('tusks') || f.has('tusks_curved') || f.has('tusks_small')) for (const sx of [-1, 1]) k.cone(b.head * 0.06, b.head * (f.has('tusks_small') ? 0.25 : 0.9), 4, '#f2ead8', sx * b.head * 0.2, headPos.y - b.head * 0.25, headPos.z + b.head * 0.5, { rx: f.has('tusks_curved') ? 2.2 : 2.6, rz: sx * 0.2 });
      if (f.has('mane') || f.has('mane_lion')) k.boxC(b.legT * (f.has('mane_lion') ? 3.5 : 0.8), b.head * (f.has('mane_lion') ? 1.0 : 0.6), f.has('mane_lion') ? b.head * 0.6 : nl, f.has('mane_lion') ? c2 : c2, { x: 0, y: headPos.y - (f.has('mane_lion') ? 0 : b.head * 0.1), z: f.has('mane_lion') ? headPos.z - b.head * 0.35 : (neckBase.z + headPos.z) / 2 - 0.1, rx: f.has('mane_lion') ? 0 : -Math.asin(Math.min(1, up)) });
      if (f.has('ossicones')) for (const sx of [-1, 1]) k.cyl(0.04, 0.04, b.head * 0.3, 4, c2, sx * b.head * 0.12, headPos.y + b.head * 0.25, headPos.z - b.head * 0.2);
      if (f.has('sabre_teeth')) for (const sx of [-1, 1]) k.cone(b.head * 0.05, b.head * 0.4, 4, '#f2ead8', sx * b.head * 0.12, headPos.y - b.head * 0.55, headPos.z + b.head * 0.45, { rx: Math.PI });
      if (f.has('beard')) k.boxC(b.head * 0.15, b.head * 0.3, b.head * 0.1, c1, { x: 0, y: headPos.y - b.head * 0.4, z: headPos.z + b.head * 0.4 });
      if (f.has('snout')) k.boxC(b.head * 0.35, b.head * 0.28, b.head * 0.2, '#e8a8a0', { x: 0, y: headPos.y - b.head * 0.05, z: headPos.z + b.head * 0.6 });
      if (f.has('mask')) k.boxC(b.head * 0.6, b.head * 0.15, b.head * 0.1, '#2a2a2a', { x: 0, y: headPos.y + b.head * 0.1, z: headPos.z + b.head * 0.3 });
      if (f.has('robot')) { k.curGlow = 1; k.boxC(b.head * 0.5, b.head * 0.08, b.head * 0.05, c2, { x: 0, y: headPos.y + b.head * 0.1, z: headPos.z + b.head * 0.52 }); k.curGlow = 0; }
      // tail
      P(6);
      piv[6].set(0, legY + bh * 0.7, -bl * 0.5);
      if (b.tail > 0.05) {
        const thick = f.has('tail_thick') ? 0.5 : a.archetype === 'sauropod' || f.has('scales') ? bh * 0.3 : f.has('tail_bushy') ? 0.12 : 0.05;
        k.boxC(Math.max(0.04, thick), Math.max(0.04, thick), b.tail, f.has('tail_bushy') ? c1 : c0, { x: 0, y: legY + bh * (a.archetype === 'sauropod' ? 0.55 : 0.6) - (f.has('tail_up') ? -b.tail * 0.3 : b.tail * 0.15), z: -bl * 0.5 - b.tail * 0.45, rx: f.has('tail_up') ? -0.6 : a.archetype === 'sauropod' || f.has('scales') ? 0.12 : 0.6 });
        if (f.has('tail_club')) k.blob(bw * 0.18, c2, 0, legY + bh * 0.4, -bl * 0.5 - b.tail * 0.9);
        if (f.has('tail_tuft')) k.blob(0.08, c2, 0, legY + bh * 0.2, -bl * 0.5 - b.tail * 0.8);
      }
      height = Math.max(headPos.y + b.head * 0.5, legY + bh);
      break;
    }
    case 'theropod':
    case 'penguin': {
      const legY = b.leg, bl = b.l, bh = b.h;
      const upright = a.archetype === 'penguin' || f.has('feathers_shaggy') || b.neckUp > 0.8;
      P(0);
      if (a.archetype === 'penguin') {
        k.blob(1, c0, 0, legY + bh * 0.5, 0, { sx: b.w * 0.5, sy: bh * 0.55, sz: bl * 0.45 });
        k.blob(1, c1, 0, legY + bh * 0.48, bl * 0.08, { sx: b.w * 0.42, sy: bh * 0.48, sz: bl * 0.4 });
      } else {
        k.blob(1, body(c0), 0, legY + bh * 0.5, 0, { sx: b.w * 0.5, sy: bh * 0.5, sz: bl * 0.55 }, 1);
        if (f.has('feathers') || f.has('feathers_light')) k.blob(1, c2, 0, legY + bh * 0.85, -bl * 0.1, { sx: b.w * 0.3, sy: bh * 0.2, sz: bl * 0.4 });
        if (f.has('tiny_arms')) for (const sx of [-1, 1]) k.boxC(0.08 * b.l, 0.25 * bh, 0.08 * b.l, c0, { x: sx * b.w * 0.4, y: legY + bh * 0.35, z: bl * 0.4, rx: 0.8 });
      }
      for (const [p, x] of [[2, b.w * 0.25], [3, -b.w * 0.25]] as const) {
        P(p);
        piv[p].set(x, legY, 0);
        k.box(b.legT, legY, b.legT * 1.3, a.archetype === 'penguin' ? c2 : shade(c0, 0.9), x, 0, 0.05);
        k.box(b.legT * 1.6, Math.min(0.12, legY * 0.15), b.legT * 2.4, a.archetype === 'penguin' ? c2 : shade(c0, 0.75), x, 0, b.legT * 0.6);
      }
      P(1);
      const nb = new THREE.Vector3(0, legY + bh * 0.7, bl * 0.45);
      piv[1].copy(nb);
      const hp = new THREE.Vector3(0, nb.y + b.neck * b.neckUp, nb.z + b.neck * Math.sqrt(1 - b.neckUp * b.neckUp) + b.head * 0.3);
      if (b.neck > 0.05) k.boxC(b.legT * 1.5, b.legT * 1.5, b.neck + 0.1, c0, { y: (nb.y + hp.y) / 2, z: (nb.z + hp.z) / 2 - b.head * 0.1, rx: -Math.asin(Math.min(1, b.neckUp)) });
      const hs = f.has('big_head') ? 1.3 : 1;
      k.boxC(b.head * 0.55 * hs, b.head * 0.55 * hs, b.head * hs, c0, { y: hp.y, z: hp.z });
      if (f.has('duckbill')) k.boxC(b.head * 0.55, b.head * 0.15, b.head * 0.5, c1, { y: hp.y - b.head * 0.15, z: hp.z + b.head * 0.55 });
      if (f.has('beak') || f.has('beak_hook')) k.cone(b.head * 0.2, b.head * 0.5, 4, c2, 0, hp.y, hp.z + b.head * 0.55, { rx: Math.PI / 2, y: hp.y });
      if (f.has('crest') || f.has('brow_horns')) k.boxC(b.head * 0.1, b.head * 0.5, b.head * 0.6, c2, { y: hp.y + b.head * 0.45, z: hp.z - b.head * 0.1, rx: -0.5 });
      if (a.archetype === 'penguin') k.cone(b.head * 0.12, b.head * 0.4, 4, c2, 0, hp.y, hp.z + b.head * 0.4, { rx: Math.PI / 2, y: hp.y });
      k.curSlot = 5;
      for (const sx of [-1, 1]) k.boxC(b.head * 0.1, b.head * 0.1, b.head * 0.1, '#141414', { x: sx * b.head * 0.3 * hs, y: hp.y + b.head * 0.12, z: hp.z + b.head * 0.2 });
      if (f.has('big_head')) { k.curSlot = 5; k.boxC(b.head * 0.5, b.head * 0.05, b.head * 0.6, '#f2ead8', { y: hp.y - b.head * 0.3, z: hp.z + b.head * 0.2 }); }
      P(6);
      piv[6].set(0, legY + bh * 0.6, -bl * 0.5);
      if (b.tail > 0.05) k.boxC(bh * 0.3, bh * 0.3, b.tail, c0, { y: legY + bh * (upright ? 0.3 : 0.6), z: -bl * 0.5 - b.tail * 0.45, rx: upright ? 0.5 : 0.08 });
      if (a.archetype === 'penguin') for (const sx of [-1, 1]) { k.curPart = 0; k.boxC(0.04, bh * 0.5, bl * 0.3, c0, { x: sx * b.w * 0.52, y: legY + bh * 0.5, rz: sx * 0.2 }); }
      height = hp.y + b.head;
      break;
    }
    case 'bird':
    case 'pterosaur': {
      const legY = Math.max(0.04, b.leg * 0.3);
      P(0);
      k.blob(1, c0, 0, legY + b.h * 0.5, 0, { sx: b.w * 0.45, sy: b.h * 0.5, sz: b.l * 0.5 });
      P(1);
      piv[1].set(0, legY + b.h * 0.6, b.l * 0.4);
      const ny = legY + b.h * 0.6 + b.neck * b.neckUp, nz = b.l * 0.4 + b.neck * 0.5;
      if (b.neck > 0.05) k.boxC(b.h * 0.25, b.h * 0.25, b.neck, c0, { y: (legY + b.h * 0.6 + ny) / 2, z: (b.l * 0.4 + nz) / 2, rx: -b.neckUp });
      k.blob(b.head * 0.5, c0, 0, ny, nz);
      k.cone(b.head * 0.18, b.head * (f.has('beak_long') ? 1.2 : 0.6), 4, c2, 0, ny, nz + b.head * 0.3, { rx: Math.PI / 2, y: ny });
      if (f.has('crest') || f.has('crest_red') || f.has('comb')) k.boxC(b.head * 0.08, b.head * 0.5, b.head * 0.6, f.has('comb') || f.has('crest_red') ? '#c82a2a' : c2, { y: ny + b.head * 0.4, z: nz - b.head * 0.2 });
      for (const [p, x] of [[2, 0.1], [3, -0.1]] as const) { P(p); piv[p].set(x * b.w * 3, legY, 0); k.box(0.02 + b.legT, b.leg, 0.02 + b.legT, '#c8a050', x * b.w * 3, 0, 0); }
      if (!f.has('flightless')) {
        const span = f.has('wings_big') ? b.l * 2.6 : b.l * 1.2;
        for (const [p, sx] of [[7, 1], [8, -1]] as const) {
          P(p);
          piv[p].set(sx * b.w * 0.4, legY + b.h * 0.7, 0);
          if (glow) k.curGlow = 1;
          k.boxC(span, 0.03 + b.h * 0.05, b.l * 0.6, c1, { x: sx * (b.w * 0.4 + span / 2), y: legY + b.h * 0.7 });
          k.curGlow = 0;
        }
      }
      if (f.has('tail_fan')) { P(6); k.cyl(b.l * 0.5, b.l * 0.5, 0.04, 6, c1, 0, legY + b.h * 0.8, -b.l * 0.5, { rx: Math.PI / 2 - 0.4, y: legY + b.h * 0.8 }); }
      else if (b.tail > 0.02) { P(6); k.boxC(b.w * 0.5, 0.03, b.tail, c1, { y: legY + b.h * 0.5, z: -b.l * 0.5 - b.tail * 0.4 }); }
      if (f.has('wattle')) { P(1); k.boxC(0.05, 0.12, 0.05, '#c82a2a', { y: ny - b.head * 0.4, z: nz + b.head * 0.2 }); }
      height = ny + b.head;
      break;
    }
    case 'fish': {
      P(0);
      k.blob(1, c0, 0, 0, 0, { sx: b.w * 0.5, sy: b.h * 0.5, sz: b.l * 0.5 }, 1);
      k.blob(1, c1, 0, -b.h * 0.15, 0.05, { sx: b.w * 0.45, sy: b.h * 0.35, sz: b.l * 0.45 });
      if (f.has('jaws')) k.boxC(b.w * 0.6, b.h * 0.3, b.head, c0, { y: -b.h * 0.1, z: b.l * 0.5 + b.head * 0.3 });
      if (f.has('dorsal')) k.boxC(0.05, b.h * 0.5, b.l * 0.15, c0, { y: b.h * 0.5, z: -0.1, rx: -0.5 });
      if (f.has('flippers')) for (const sx of [-1, 1]) k.boxC(b.w * 0.6, 0.05, b.l * 0.12, c0, { x: sx * b.w * 0.55, y: -b.h * 0.2, z: b.l * 0.2, rz: sx * 0.4 });
      P(6);
      piv[6].set(0, 0, -b.l * 0.45);
      k.boxC(f.has('tail_flukes') ? b.l * 0.35 : 0.04, f.has('tail_flukes') ? 0.05 : b.h * 0.8, b.l * 0.2, c0, { z: -b.l * 0.55 });
      k.curSlot = 5;
      for (const sx of [-1, 1]) k.boxC(0.04, 0.04, 0.04, '#141414', { x: sx * b.w * 0.4, y: b.h * 0.1, z: b.l * 0.38 });
      height = b.h;
      break;
    }
    case 'hopper': {
      const legY = b.leg * 0.6;
      P(0);
      k.blob(1, c0, 0, legY + b.h * 0.45, 0, { sx: b.w * 0.5, sy: b.h * 0.5, sz: b.l * 0.45 });
      P(1);
      piv[1].set(0, legY + b.h * 0.8, b.l * 0.3);
      k.boxC(b.head * 0.6, b.head * 0.6, b.head, c0, { y: legY + b.h * 0.95, z: b.l * 0.35 });
      for (const sx of [-1, 1]) k.boxC(b.head * 0.15, b.head * 0.7, b.head * 0.1, c0, { x: sx * b.head * 0.2, y: legY + b.h * 0.95 + b.head * 0.6, z: b.l * 0.3 });
      k.curSlot = 5;
      for (const sx of [-1, 1]) k.boxC(b.head * 0.1, b.head * 0.1, b.head * 0.1, '#141414', { x: sx * b.head * 0.3, y: legY + b.h * 1.0, z: b.l * 0.55 });
      for (const [p, x, z, L] of [[2, 0.15, 0.3, 0.5], [3, -0.15, 0.3, 0.5], [4, 0.25, -0.15, 1], [5, -0.25, -0.15, 1]] as const) {
        P(p);
        piv[p].set(x * b.w * 2, legY + b.h * 0.3, z * b.l);
        k.box(b.legT, legY * L + b.h * 0.25, b.legT * (L > 0.6 ? 2 : 1), shade(c0, 0.9), x * b.w * 2, 0, z * b.l);
      }
      P(6);
      piv[6].set(0, legY + b.h * 0.3, -b.l * 0.4);
      if (b.tail > 0.05) k.boxC(b.legT * (f.has('tail_thick') ? 1.6 : 0.8), b.legT * 1.2, b.tail, c0, { y: legY * 0.4, z: -b.l * 0.4 - b.tail * 0.4, rx: 0.4 });
      height = legY + b.h + b.head;
      break;
    }
    case 'drone': {
      P(0);
      k.curGlow = glow ? 0.5 : 0;
      k.cyl(b.l * 0.35, b.l * 0.4, b.h, 8, c0, 0, 1.2, 0);
      k.curGlow = 1;
      k.cyl(b.l * 0.15, b.l * 0.15, b.h * 0.3, 8, c2, 0, 1.2 + b.h, 0);
      k.curGlow = 0;
      P(7);
      piv[7].set(0, 1.2 + b.h * 1.3, 0);
      for (let i = 0; i < 4; i++) { const ang = (i * Math.PI) / 2 + Math.PI / 4; k.boxC(b.l * 0.5, 0.02, 0.06, c1, { x: Math.cos(ang) * b.l * 0.25, y: 1.2 + b.h * 1.3, z: Math.sin(ang) * b.l * 0.25, ry: -ang }); }
      height = 1.5;
      break;
    }
  }
  const s = 1;
  const geo = arraysToGeometry(k.toArrays());
  return { geo, pivots: piv.map((v) => v.multiplyScalar(s)), kind, height, length: a.body.l };
}
