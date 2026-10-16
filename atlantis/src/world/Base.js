import * as THREE from 'three';
import { T } from './Batcher.js';
import { BASE_GEO as G, M } from './Props.js';
import { getMaterials } from './Materials.js';
import { RELICS, RELIC_ORDER } from '../items/content.js';
import { relicModel } from '../items/Models.js';

export const BASE_POS = new THREE.Vector3(0, -14, 560);
const DOME_R = 6.5;
const RING_Y = BASE_POS.y + 5;

// The player's base: a diving bell station with an air pocket, upgrade console and relic shelves.
export class Base {
  constructor(game, ctx) {
    this.game = game;
    this.inside = false;
    this.wasInside = true;
    const { B, C } = ctx;
    const x = BASE_POS.x, y = BASE_POS.y, z = BASE_POS.z;
    const yellow = 0xf2b632, metal = 0x8d9aa6, dark = 0x3a444c;

    // platform
    B.add(G.cyl12, 'stone', T(x, y + 0.3, z, 0, DOME_R * 2 + 1, 0.6, DOME_R * 2 + 1), metal, 0.05);
    B.add(G.cyl12, 'stone', T(x, y + 0.62, z, 0, DOME_R * 2 - 0.6, 0.06, DOME_R * 2 - 0.6), 0x5c6b74, 0.08);
    C.cylinder(x, z, DOME_R + 0.5, y - 2, y + 0.6);
    // struts
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const sx = x + Math.cos(a) * DOME_R, sz = z + Math.sin(a) * DOME_R;
      B.add(G.cyl6, 'shiny', T(sx, y + 2.8, sz, 0, 0.5, 5, 0.5), yellow, 0.03);
      B.add(G.box, 'stone', T(sx, y + 0.8, sz, a, 1, 0.5, 1), dark, 0.05);
      C.cylinder(sx, sz, 0.35, y, RING_Y);
    }
    // dome ring and lamp
    B.add(new THREE.TorusGeometry(DOME_R, 0.3, 5, 24), 'shiny', T(x, RING_Y, z, 0, 1, 1, 1, Math.PI / 2), yellow, 0.03);
    B.add(G.cyl6, 'stone', T(x, RING_Y + DOME_R + 0.2, z, 0, 1.2, 0.6, 1.2), dark, 0.05);
    B.add(G.ico0, 'emissive', T(x, RING_Y + DOME_R + 0.7, z, 0, 0.45), 0xfff0b0, 0.02);
    // glass dome
    const dome = new THREE.Mesh(new THREE.SphereGeometry(DOME_R, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2), getMaterials().glass);
    dome.position.set(x, RING_Y, z);
    ctx.scene.add(dome);
    // trapped air pocket: silvery surface inside the dome
    const air = new THREE.Mesh(new THREE.CircleGeometry(DOME_R * 0.93, 24), getMaterials().airPocket);
    air.rotation.x = Math.PI / 2;
    air.position.set(x, RING_Y + 2.2, z);
    ctx.scene.add(air);
    this.air = air;

    // console (shop)
    const cx = x, cz = z - 2.5;
    B.add(G.box, 'stone', T(cx, y + 1.3, cz, 0, 1.6, 1.4, 0.9), dark, 0.05);
    B.add(G.box, 'stone', T(cx, y + 2.3, cz - 0.1, 0, 1.8, 1.0, 0.25, -0.35), dark, 0.05);
    B.add(G.box, 'emissive', T(cx, y + 2.33, cz + 0.05, 0, 1.5, 0.75, 0.05, -0.35), 0x41e0ff, 0.05);
    C.box(cx, y + 1.5, cz, 0.85, 1.2, 0.5);
    game.interact.add({
      pos: new THREE.Vector3(cx, y + 2.2, cz + 0.6), radius: 3.5, priority: 1,
      prompt: 'Use upgrade console',
      onUse: () => game.ui.openShop(),
    });
    // first log on a little desk
    B.add(G.box, 'stone', T(x + 3, y + 1, z + 1.5, 0.4, 1.4, 0.15, 0.9), 0x6b4a2e, 0.05);
    B.add(G.box, 'stone', T(x + 3, y + 0.5, z + 1.5, 0.4, 0.25, 1, 0.25), 0x4a3220, 0.05);
    game.items.addPage('log_start', x + 3, y + 1.4, z + 1.5, 0.4);

    // relic shelves: 12 pedestals around the inside of the ring
    this.slots = [];
    RELIC_ORDER.forEach((id, i) => {
      const a = (i / RELIC_ORDER.length) * Math.PI * 2 + 0.26;
      const px = x + Math.cos(a) * (DOME_R - 1.3), pz = z + Math.sin(a) * (DOME_R - 1.3);
      B.add(G.cyl6, 'stone', T(px, y + 1.0, pz, 0, 0.6, 0.8, 0.6), metal, 0.05);
      B.add(G.cyl6, 'emissive', T(px, y + 1.42, pz, 0, 0.62, 0.05, 0.62), 0x3a7a88, 0.05);
      this.slots.push({ id, pos: new THREE.Vector3(px, y + 1.9, pz), model: null });
    });

    // research ship silhouette at the surface + anchor line
    const sx = x + 24, sz = z - 22;
    B.add(G.box, 'stone', T(sx, -0.6, sz, 0.3, 7, 2.2, 26), 0x2b3238, 0.04);
    B.add(G.cone5, 'stone', T(sx + Math.sin(0.3) * 15, -0.6, sz + Math.cos(0.3) * 15, 0.3, 4.5, 6, 2.2, Math.PI / 2), 0x2b3238, 0.04);
    B.add(G.box, 'stone', T(sx, -1.9, sz, 0.3, 1.2, 0.6, 22), 0xa83a2a, 0.04);
    B.add(G.cyl6, 'stone', T(sx, (y - 1) / 2, sz, 0, 0.1, Math.abs(y) - 1, 0.1), 0xd8cfa8, 0.02);
    B.add(G.box, 'stone', T(sx, y + 0.4, sz, 0.5, 1.6, 0.8, 1.6), 0x3a3f44, 0.05);
    C.cylinder(sx, sz, 0.3, y, -1);
    // crates and a sign outside
    for (const [ox, oz, s] of [[9, 3, 1.2], [10, 5, 0.9], [-9, 4, 1.1], [-8.5, -6, 1]]) {
      B.add(G.box, 'stone', T(x + ox, y + s / 2, z + oz, ox * 0.3, s, s, s), 0x8a6a3a, 0.08);
      C.box(x + ox, y + s / 2, z + oz, s / 2, s / 2, s / 2, ox * 0.3);
    }

    this.light = game.world.addLight({ pos: new THREE.Vector3(x, y + 4, z), color: 0xffe2a8, intensity: 40, distance: 26 });
    this.center = new THREE.Vector3(x, y, z);
  }

  // Dome glass collision + detect being inside.
  update(dt) {
    const p = this.game.player.pos;
    const dx = p.x - BASE_POS.x, dz = p.z - BASE_POS.z;
    const horiz = Math.hypot(dx, dz);
    if (p.y > RING_Y - 0.5) {
      const dy = p.y - RING_Y;
      const d = Math.hypot(dx, dy, dz);
      const r = this.game.player.radius;
      if (this.domeSide === undefined) this.domeSide = d < DOME_R ? -1 : 1;
      if (this.domeSide < 0 && d > DOME_R - r) {
        const k = (DOME_R - r) / d;
        p.set(BASE_POS.x + dx * k, RING_Y + dy * k, BASE_POS.z + dz * k);
      } else if (this.domeSide > 0 && d < DOME_R + r) {
        const k = (DOME_R + r) / Math.max(d, 0.01);
        p.set(BASE_POS.x + dx * k, RING_Y + dy * k, BASE_POS.z + dz * k);
      }
    } else {
      this.domeSide = horiz < DOME_R ? -1 : 1;
    }
    this.inside = horiz < DOME_R - 0.3 && p.y < RING_Y + DOME_R && p.y > BASE_POS.y;
    if (this.inside && !this.wasInside) this.game.onReturnToBase();
    this.wasInside = this.inside;
    this.air.position.y = RING_Y + 2.2 + Math.sin(performance.now() * 0.001) * 0.05;
  }

  refreshDisplay() {
    const st = this.game.state;
    for (const s of this.slots) {
      if (st.relics.has(s.id) && !s.model) {
        const def = RELICS[s.id];
        s.model = relicModel(def.shape, def.color);
        s.model.position.copy(s.pos);
        s.model.scale.setScalar(1.2);
        this.game.scene.add(s.model);
      }
    }
  }

  spin(dt) {
    for (const s of this.slots) if (s.model) s.model.rotation.y += dt * 0.6;
  }
}

export { DOME_R, RING_Y };
