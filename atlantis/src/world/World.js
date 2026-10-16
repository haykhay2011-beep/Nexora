import * as THREE from 'three';
import { Terrain } from './Terrain.js';
import { StaticBatcher } from './Batcher.js';
import { Flora, kelpGeometry, seagrassGeometry, tubeWormGeometry } from './Flora.js';
import { RNG, hashString } from '../core/math.js';
import { AIR_VENTS, WORLD_SEED } from './config.js';
import { ventList } from './Atmosphere.js';
import { Hazards } from './Hazards.js';
import { buildReef } from './zones/reef.js';
import { buildKelp } from './zones/kelp.js';
import { buildCity } from './zones/city.js';
import { buildTemple } from './zones/temple.js';
import { buildVents } from './zones/vents.js';
import { buildAbyss } from './zones/abyss.js';
import { buildPalace } from './zones/palace.js';

const POOL_SIZE = 3;

// Owns terrain, static props, flora and local light emitters.
export class World {
  constructor(game) {
    this.game = game;
    this.scene = game.scene;
    this.terrain = new Terrain(this.scene, game.settings.quality);
    this.B = new StaticBatcher(this.scene);
    this.emitters = [];
    this.updaters = [];
    this.flora = {
      kelp: new Flora(this.scene, kelpGeometry()),
      grass: new Flora(this.scene, seagrassGeometry()),
      worms: new Flora(this.scene, tubeWormGeometry()),
    };
    this.pool = [];
    for (let i = 0; i < POOL_SIZE; i++) {
      const l = new THREE.PointLight(0xffffff, 0, 20, 1.2);
      l.position.set(0, -9999, 0);
      this.scene.add(l);
      this.pool.push(l);
    }
    this.airVents = ventList(AIR_VENTS);
    this.airPockets = []; // {x,y,z,r} spheres of air
    this.hazards = new Hazards(game);
  }

  build() {
    const g = this.game;
    const ctx = {
      B: this.B, C: g.colliders, scene: this.scene, world: this, game: g,
      items: g.items, flora: this.flora, rng: null,
    };
    const builders = [
      ['reef', buildReef], ['kelp', buildKelp], ['city', buildCity], ['temple', buildTemple],
      ['vents', buildVents], ['abyss', buildAbyss], ['palace', buildPalace],
    ];
    for (const [name, fn] of builders) {
      ctx.rng = new RNG(hashString(name) ^ WORLD_SEED);
      fn(ctx);
    }
    this.B.finalize();
    for (const f of Object.values(this.flora)) f.finalize();
    this.hazards.finalize(this.scene);
    g.atmosphere.setVents(this.airVents);
  }

  addLight(def) {
    const e = { pos: def.pos, color: new THREE.Color(def.color), intensity: def.intensity ?? 20, distance: def.distance ?? 20, active: def.active || (() => true), boost: 1 };
    this.emitters.push(e);
    return e;
  }

  addAirPocket(x, y, z, r) {
    this.airPockets.push({ x, y, z, r });
  }

  addUpdater(fn) {
    this.updaters.push(fn);
  }

  update(dt, pos) {
    const view = this.game.atmosphere.viewDist;
    this.terrain.update(pos.x, pos.z);
    this.B.update(pos.x, pos.z, view);
    for (const f of Object.values(this.flora)) f.update(pos.x, pos.z, view);
    for (const u of this.updaters) u(dt, pos);
    this.hazards.update(dt);

    // Assign the light pool to the closest active emitters.
    const cand = [];
    for (const e of this.emitters) {
      const d = e.pos.distanceTo(pos);
      if (d > 70 || !e.active()) continue;
      cand.push({ e, d });
    }
    cand.sort((a, b) => a.d - b.d);
    for (let i = 0; i < POOL_SIZE; i++) {
      const l = this.pool[i];
      const c = cand[i];
      if (!c) { l.intensity = 0; continue; }
      l.position.copy(c.e.pos);
      l.color.copy(c.e.color);
      l.distance = c.e.distance;
      const fade = 1 - Math.max(0, (c.d - 50) / 20);
      l.intensity = c.e.intensity * c.e.boost * fade;
    }
  }
}
