// Small props (street furniture, camp items, boats, carts, vehicles). Shared by worker and main thread.
import { MeshKit, shade } from './meshkit';

const CAR_COLORS = ['#c83a2a', '#2a5aa8', '#e8e8e8', '#2a2a2a', '#e8c83a', '#4a8a5a', '#8a8a92', '#e87a2a'];

export function buildProp(k: MeshKit, kind: string, v = 0, tech = 5): { h: number; r: number } {
  switch (kind) {
    case 'campfire': {
      for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2; k.rock(0.25, '#7a766c', Math.cos(a) * 0.7, 0.1, Math.sin(a) * 0.7); }
      for (let i = 0; i < 4; i++) k.cyl(0.06, 0.08, 0.9, 4, '#5a4030', 0, 0, 0, { rz: 0.9, ry: (i * Math.PI) / 2, y: 0.25 });
      k.curGlow = 1; k.cone(0.35, 0.8, 5, '#ff9a2a', 0, 0.1, 0); k.cone(0.18, 0.5, 4, '#ffe06a', 0, 0.15, 0); k.curGlow = 0;
      return { h: 1, r: 1 };
    }
    case 'hide_rack': { k.box(0.1, 2, 0.1, '#5a4030', -1, 0, 0); k.box(0.1, 2, 0.1, '#5a4030', 1, 0, 0); k.box(2.1, 0.08, 0.08, '#5a4030', 0, 1.9, 0); k.box(1.6, 1.3, 0.05, '#a8885a', 0, 0.55, 0); return { h: 2, r: 1.1 }; }
    case 'drying_rack': { for (const x of [-1.2, 1.2]) k.box(0.08, 1.6, 0.08, '#5a4030', x, 0, 0); k.box(2.5, 0.06, 0.06, '#5a4030', 0, 1.5, 0); for (let i = 0; i < 5; i++) k.box(0.18, 0.6, 0.05, '#c8a070', -1 + i * 0.5, 0.9, 0); return { h: 1.6, r: 1.3 }; }
    case 'log_seat': { k.cyl(0.25, 0.25, 1.8, 6, '#6b4a2e', 0, 0.25, 0, { rz: Math.PI / 2 }); return { h: 0.5, r: 0.9 }; }
    case 'stone_pile': { for (let i = 0; i < 4; i++) k.rock(0.3 + (i % 2) * 0.15, '#8a8478', (i - 1.5) * 0.4, 0.2, (i % 2) * 0.3); return { h: 0.6, r: 0.8 }; }
    case 'well': { k.cyl(0.9, 0.95, 0.9, 10, '#8a8478', 0, 0, 0); k.cyl(0.75, 0.75, 0.05, 10, '#3a5a7a', 0, 0.8, 0); for (const x of [-0.8, 0.8]) k.box(0.12, 2, 0.12, '#5a4030', x, 0, 0); k.gable(2, 0.6, 1.4, '#6b5238', 0, 2, 0); return { h: 2.6, r: 1 }; }
    case 'fountain': { k.cyl(2.4, 2.5, 0.6, 14, '#d8ccb4', 0, 0, 0); k.cyl(2.2, 2.2, 0.06, 14, '#5a9ac0', 0, 0.55, 0); k.cyl(0.3, 0.4, 1.8, 8, '#d8ccb4', 0, 0, 0); k.cyl(0.9, 0.5, 0.3, 10, '#d8ccb4', 0, 1.8, 0); return { h: 2.1, r: 2.5 }; }
    case 'market_stall': {
      const awn = ['#c84a3a', '#e8b83a', '#3a7aa8', '#4a8a5a', '#e8e0d0', '#a85a8a'][v % 6];
      for (const x of [-1.2, 1.2]) for (const z of [-0.8, 0.8]) k.box(0.1, 2.2, 0.1, '#6b4a2e', x, 0, z);
      k.box(2.5, 0.8, 1.6, '#8a6a48', 0, 0, 0);
      k.pyramid(3, 2.2, 0.6, awn, 0, 2.2, 0);
      for (let i = 0; i < 4; i++) k.box(0.35, 0.25, 0.35, ['#c8642a', '#e8c84a', '#8a3a2a', '#5a8a3a'][i], -0.8 + i * 0.55, 0.8, 0);
      return { h: 2.8, r: 1.6 };
    }
    case 'cart': { k.box(1.6, 0.5, 2.6, '#7a5a3a', 0, 0.6, 0); for (const x of [-0.9, 0.9]) k.cyl(0.55, 0.55, 0.12, 8, '#4a3826', x, 0.55, 0.3, { rz: Math.PI / 2, y: 0.55 }); k.box(0.08, 0.08, 2, '#5a4030', 0, 0.6, -2); return { h: 1.2, r: 1.6 }; }
    case 'barrel': { k.cyl(0.4, 0.38, 1, 8, '#7a5a3a', 0, 0, 0); k.cyl(0.42, 0.42, 0.06, 8, '#3a3a3a', 0, 0.2, 0); k.cyl(0.42, 0.42, 0.06, 8, '#3a3a3a', 0, 0.75, 0); return { h: 1, r: 0.45 }; }
    case 'crate': { k.box(0.9, 0.9, 0.9, '#a8885a', 0, 0, 0); k.box(0.95, 0.1, 0.95, '#7a5a3a', 0, 0.85, 0); return { h: 0.9, r: 0.6 }; }
    case 'haystack': { k.cone(1.4, 2.4, 8, '#d8b85a', 0, 0, 0); k.cyl(1.4, 1.5, 0.6, 8, '#c8a84a', 0, 0, 0); return { h: 2.6, r: 1.5 }; }
    case 'hay_bale': { k.cyl(0.8, 0.8, 1.4, 10, '#d8b85a', 0, 0.8, 0, { rz: Math.PI / 2, y: 0.8 }); return { h: 1.6, r: 0.9 }; }
    case 'lamp_post': {
      const c = tech >= 8 ? '#4a4e54' : '#2a2a2a';
      k.cyl(0.08, 0.12, 4, 6, c, 0, 0, 0);
      k.curGlow = 1; k.box(0.4, 0.5, 0.4, '#ffe8a8', 0, 4, 0); k.curGlow = 0;
      k.pyramid(0.55, 0.55, 0.3, c, 0, 4.5, 0);
      return { h: 4.8, r: 0.2 };
    }
    case 'bench': { k.box(1.8, 0.1, 0.5, '#7a5a3a', 0, 0.45, 0); k.box(1.8, 0.4, 0.08, '#7a5a3a', 0, 0.55, 0.22); for (const x of [-0.8, 0.8]) k.box(0.08, 0.45, 0.45, '#3a3a3a', x, 0, 0); return { h: 0.9, r: 1 }; }
    case 'tree_planter': { k.box(1.4, 0.6, 1.4, '#9a9a96', 0, 0, 0); k.cyl(0.1, 0.14, 2.4, 5, '#5a4330', 0, 0.6, 0); k.blob(1.2, '#4f8a3a', 0, 3.4, 0, { sy: 1.1 }); return { h: 4.4, r: 0.8 }; }
    case 'planter_glow': { k.cyl(0.9, 0.8, 0.5, 10, '#f2f2f8', 0, 0, 0); k.curGlow = 0.8; k.blob(0.8, '#7dffb2', 0, 1, 0); k.curGlow = 0; return { h: 1.8, r: 0.9 }; }
    case 'holo_kiosk': { k.cyl(0.4, 0.5, 1.1, 8, '#e8eef8', 0, 0, 0); k.curGlow = 1; k.boxC(0.9, 0.6, 0.04, '#00d4ff', { y: 1.6 }); k.curGlow = 0; return { h: 2, r: 0.5 }; }
    case 'bus_stop': { k.box(3, 0.1, 1.4, '#5a6a7a', 0, 2.4, 0); for (const x of [-1.4, 1.4]) k.box(0.08, 2.4, 0.08, '#5a6a7a', x, 0, 0.6); k.box(3, 1.8, 0.05, '#a8c8d8', 0, 0.4, 0.65); k.box(2.4, 0.08, 0.4, '#7a7a7a', 0, 0.45, 0.4); return { h: 2.5, r: 1.6 }; }
    case 'car': {
      const c = CAR_COLORS[v % CAR_COLORS.length];
      k.box(1.8, 0.7, 4.2, c, 0, 0.35, 0);
      k.box(1.6, 0.6, 2.2, shade(c, 0.9), 0, 1.05, 0.2);
      k.box(1.62, 0.45, 2.0, '#2a3a4a', 0, 1.1, 0.2);
      for (const x of [-0.85, 0.85]) for (const z of [-1.3, 1.3]) k.cyl(0.36, 0.36, 0.25, 8, '#1a1a1a', x, 0.36, z, { rz: Math.PI / 2, y: 0.36 });
      k.curGlow = 0.8; k.box(1.4, 0.15, 0.05, '#fff2c8', 0, 0.6, -2.12); k.curGlow = 0;
      return { h: 1.6, r: 2.2 };
    }
    case 'fence': {
      // v = depth, s handled by caller as width (we draw a unit 1x1 fence ring scaled by instance)
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 2;
        k.box(1, 0.08, 0.04, '#7a5a3a', Math.sin(a) * 0.5, 0.75, Math.cos(a) * 0.5, a);
        k.box(1, 0.08, 0.04, '#7a5a3a', Math.sin(a) * 0.5, 0.35, Math.cos(a) * 0.5, a);
      }
      return { h: 1, r: 0.5 };
    }
    case 'pier': { k.box(4, 0.3, 26, '#8a6a48', 0, 0.6, 9); for (let i = 0; i < 6; i++) for (const x of [-1.8, 1.8]) k.cyl(0.18, 0.18, 4, 5, '#5a4030', x, -3, i * 4.5); return { h: 1, r: 13 }; }
    case 'pier_concrete': { k.box(8, 1.2, 30, '#a8a8a4', 0, -0.2, 11); for (let i = 0; i < 4; i++) k.cyl(0.25, 0.25, 0.7, 6, '#3a3a3a', 3.5, 1, i * 7); return { h: 1.2, r: 15 }; }
    default:
      if (kind.startsWith('boat:')) { buildBoat(k, kind.slice(5)); return { h: 3, r: 5 }; }
      k.box(0.6, 0.6, 0.6, '#8a8478', 0, 0, 0);
      return { h: 0.6, r: 0.4 };
  }
}

/** Boats: front faces -z, waterline at y = 0. */
export function buildBoat(k: MeshKit, type: string): void {
  switch (type) {
    case 'dugout': case 'kayak': {
      k.boxC(0.8, 0.45, 5, type === 'kayak' ? '#b89a6a' : '#6b4a2e', { y: 0.1 });
      k.boxC(0.5, 0.3, 1, type === 'kayak' ? '#b89a6a' : '#6b4a2e', { y: 0.05, z: -2.9, rx: 0.3 });
      return;
    }
    case 'reed_boat': {
      k.cyl(0.6, 0.6, 6, 8, '#d8c48a', 0, 0.3, 0, { rx: Math.PI / 2, y: 0.3 });
      k.cyl(0.35, 0.05, 1.6, 6, '#d8c48a', 0, 0.9, -3.4, { rx: -1.1, y: 0.9 });
      k.cyl(0.35, 0.05, 1.6, 6, '#d8c48a', 0, 0.9, 3.4, { rx: 1.1, y: 0.9 });
      return;
    }
    case 'felucca': case 'sailboat': case 'longship': case 'galley': case 'voyaging_canoe': {
      const hullC = type === 'longship' ? '#5a4030' : '#7a5a3a';
      const L = type === 'galley' ? 14 : type === 'longship' ? 12 : 8;
      k.boxC(2.2, 1.1, L, hullC, { y: 0.2 });
      k.boxC(1.4, 0.8, 1.8, hullC, { y: 0.4, z: -L / 2 - 0.6, rx: 0.4 });
      if (type === 'voyaging_canoe') { k.boxC(1.2, 0.8, L, hullC, { x: 3, y: 0.2 }); k.boxC(4.2, 0.15, 3, '#a8885a', { x: 1.5, y: 0.9 }); }
      k.cyl(0.1, 0.12, L * 0.8, 5, '#5a4030', 0, 0.7, 0);
      const sail = type === 'longship' ? '#c84a3a' : type === 'galley' ? '#e8dcc0' : '#f2ead8';
      if (type === 'felucca') k.tris([0, 0.9, -1, 0, L * 0.85, 2.5, 0, 1.2, L * 0.35], sail, { x: 0.12 });
      else k.boxC(0.08, L * 0.45, L * 0.45, sail, { y: L * 0.45, x: 0.15, ry: Math.PI / 2 });
      if (type === 'galley') for (let i = 0; i < 6; i++) for (const sx of [-1, 1]) k.boxC(3, 0.1, 0.15, '#6b4a2e', { x: sx * 2.2, y: 0.5, z: -L / 2 + 2 + i * 2, rz: sx * 0.3 });
      return;
    }
    case 'tall_ship': {
      k.boxC(4, 2.4, 20, '#5a3e2a', { y: 0.4 });
      k.boxC(3.6, 1.6, 4, '#6b4a2e', { y: 2.2, z: 7.5 });
      for (const z of [-5, 0, 5]) {
        k.cyl(0.18, 0.22, 16, 6, '#4a3424', 0, 1.6, z);
        k.boxC(0.1, 4, 7, '#f2ead8', { y: 8, z, ry: Math.PI / 2 });
        k.boxC(0.1, 3, 5.5, '#f2ead8', { y: 12.5, z, ry: Math.PI / 2 });
      }
      return;
    }
    case 'junk': {
      k.boxC(3.4, 2, 14, '#7a4a2e', { y: 0.4 });
      for (const z of [-3, 3]) { k.cyl(0.15, 0.2, 11, 6, '#4a3424', 0, 1.4, z); k.boxC(0.08, 6, 4.5, '#c8784a', { y: 7, z, ry: Math.PI / 2 }); }
      return;
    }
    case 'steamship': {
      k.boxC(6, 3, 30, '#2a2a2e', { y: 0.6 });
      k.boxC(5, 2.4, 14, '#e8e4dc', { y: 3.2, z: 2 });
      for (const z of [-1, 5]) { k.cyl(1, 1, 6, 10, '#c83a2a', 0, 4.4, z); k.cyl(1.05, 1.05, 1, 10, '#1a1a1a', 0, 9.6, z); }
      return;
    }
    case 'motorboat': {
      k.boxC(2.6, 1, 7, '#f2f2f0', { y: 0.3 });
      k.boxC(2, 1, 2.4, '#2a3a4a', { y: 1.2, z: 0.4 });
      k.boxC(2.65, 0.25, 7.05, '#2a5aa8', { y: 0.2 });
      return;
    }
    case 'solar_boat': case 'hover_ship': {
      k.curGlow = type === 'hover_ship' ? 0.6 : 0;
      k.boxC(3, 0.8, 9, '#f2f6f8', { y: type === 'hover_ship' ? 1.2 : 0.3 });
      k.curGlow = 0;
      k.boxC(2.6, 0.12, 5, '#2a3a5a', { y: type === 'hover_ship' ? 2.1 : 1.2, rx: 0.08 });
      k.curGlow = 1; k.boxC(3.05, 0.1, 9.05, '#00d4ff', { y: type === 'hover_ship' ? 0.85 : 0.0 }); k.curGlow = 0;
      return;
    }
    default:
      k.boxC(1.4, 0.6, 5, '#7a5a3a', { y: 0.2 });
  }
}
