import * as THREE from 'three';
import { upgradeValue, ZONE_BY_ID } from '../world/config.js';
import { zoneWeights } from '../world/Terrain.js';
import { ZONES } from '../world/config.js';
import { smoothstep } from '../core/math.js';

const VENTS_I = ZONES.findIndex((z) => z.id === 'vents');
const ABYSS_I = ZONES.findIndex((z) => z.id === 'abyss');
const w = new Float32Array(ZONES.length);
const push = new THREE.Vector3();

// Oxygen, refills, depth/heat/darkness limits and damage from hazards.
export class Survival {
  constructor(game) {
    this.game = game;
    this.oxygen = 100;
    this.refilling = false;
    this.hurtCooldown = 0;
    this.warning = null;
    this.lowWarned = false;
    this.zoneHintCooldown = 0;
  }

  get max() {
    return upgradeValue('tank', this.game.state.upgrades.tank || 0);
  }

  get maxDepth() {
    return upgradeValue('pressure', this.game.state.upgrades.pressure || 0);
  }

  reset(value) {
    this.oxygen = value ?? this.max;
    if (this.oxygen <= 0) this.oxygen = this.max;
  }

  damage(amount, source, from) {
    if (this.game.mode !== 'playing') return;
    if (this.hurtCooldown > 0 && source !== 'heat') return;
    this.oxygen = Math.max(0, this.oxygen - amount);
    if (source !== 'heat' && source !== 'pressure') this.hurtCooldown = 0.8;
    this.game.ui.hurt(source);
    this.game.audio.play(source === 'zap' ? 'zap' : source === 'sting' ? 'sting' : 'hurt');
    if (from) {
      push.subVectors(this.game.player.pos, from).normalize().multiplyScalar(9);
      this.game.player.vel.add(push);
    }
  }

  update(dt) {
    const g = this.game;
    const p = g.player;
    const st = g.state;
    this.hurtCooldown = Math.max(0, this.hurtCooldown - dt);
    this.zoneHintCooldown = Math.max(0, this.zoneHintCooldown - dt);
    const depth = -p.pos.y;
    let warning = null;

    // --- Refill sources ---
    let refill = 0;
    if (g.base.inside) refill = 60;
    if (depth < 1.2) refill = Math.max(refill, 25);
    for (const v of g.world.airVents) {
      const dx = p.pos.x - v.x, dz = p.pos.z - v.z;
      if (dx * dx + dz * dz < 2.6 * 2.6 && p.pos.y > v.y - 1 && p.pos.y < v.y + v.h) { refill = Math.max(refill, 45); break; }
    }
    for (const a of g.world.airPockets) {
      const dx = p.pos.x - a.x, dy = p.pos.y - a.y, dz = p.pos.z - a.z;
      if (dx * dx + dy * dy + dz * dz < a.r * a.r) { refill = Math.max(refill, 50); break; }
    }
    this.refilling = refill > 0 && this.oxygen < this.max;

    // --- Drain ---
    let drain = p.sprinting ? 2.3 : 1;
    if (!p.moving) drain *= 0.8;

    // --- Pressure ---
    const maxDepth = this.maxDepth;
    if (depth > maxDepth - 6 && maxDepth < 300) {
      if (depth > maxDepth) {
        drain += 7;
        p.external.y += 22 * smoothstep(maxDepth, maxDepth + 6, depth) + 6;
        warning = { text: `Crushing pressure! Max safe depth ${maxDepth} m`, sub: 'Buy a stronger Pressure Suit at the base console.', level: 'danger' };
        if (this.zoneHintCooldown <= 0) { g.audio.play('creak'); this.zoneHintCooldown = 2.5; }
      } else {
        warning = { text: `Approaching max safe depth (${maxDepth} m)`, sub: '', level: 'caution' };
      }
    }

    // --- Heat (Thermal Vents zone) ---
    zoneWeights(p.pos.x, p.pos.z, w);
    const heat = w[VENTS_I];
    if (heat > 0.35 && !(st.upgrades.heat > 0) && depth > 30) {
      const center = ZONE_BY_ID.vents;
      push.set(p.pos.x - center.x, 0, p.pos.z - center.z).normalize().multiplyScalar(18 * smoothstep(0.35, 0.7, heat) + 4);
      p.external.add(push);
      drain += 6 * heat;
      warning = { text: 'Scalding water! You need a Heat Suit.', sub: 'The base console sells one.', level: 'danger' };
      if (this.zoneHintCooldown <= 0) { g.audio.play('sizzle'); this.zoneHintCooldown = 2; }
    }

    // --- Darkness (Abyss) ---
    const dark = w[ABYSS_I];
    if (dark > 0.4 && !(st.upgrades.light > 0) && depth > 60) {
      const center = ZONE_BY_ID.abyss;
      push.set(p.pos.x - center.x, 0, p.pos.z - center.z).normalize().multiplyScalar(16 * smoothstep(0.4, 0.75, dark) + 4);
      p.external.add(push);
      warning = { text: 'The darkness swallows your light.', sub: 'A stronger flashlight is needed to navigate the Abyss.', level: 'danger' };
    }

    // --- Hot vent plumes and local hazards are applied by creatures/world via damage() ---
    if (refill > 0) this.oxygen = Math.min(this.max, this.oxygen + refill * dt);
    else this.oxygen = Math.max(0, this.oxygen - drain * dt);

    if (!warning && this.oxygen / this.max < 0.25) {
      warning = { text: 'Oxygen low!', sub: 'Find an air vent, an air pocket, the surface or the base.', level: 'danger' };
      if (!this.lowWarned) { g.audio.play('alarm'); this.lowWarned = true; }
    }
    if (this.oxygen / this.max > 0.35) this.lowWarned = false;
    this.warning = warning;
    g.ui.setWarning(warning);

    if (this.oxygen <= 0) g.blackout();
  }
}
