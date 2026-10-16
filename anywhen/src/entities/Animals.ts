// Wild and domestic animals: grazing herds, fleeing, predators that chase and knock you down, birds, fish.
import * as THREE from 'three';
import { Rng } from '../core/rng';
import { ANIMAL_BY_ID } from '../data';
import type { AnimalDef } from '../data/types';
import { buildAnimal, type AnimalModel } from './animalModels';
import { characterMaterial } from '../engine/materials';
import type { Physics } from '../engine/Physics';
import type { AnimalSpawn } from '../gen/planTypes';
import { angleDiff } from './NPCs';

export interface Animal {
  def: AnimalDef;
  pos: THREE.Vector3;
  home: THREE.Vector3;
  radius: number;
  heading: number;
  speed: number;
  target: THREE.Vector3;
  state: 'idle' | 'walk' | 'graze' | 'flee' | 'chase' | 'rest' | 'fly' | 'swim' | 'follow';
  timer: number;
  phase: number;
  slot: number;
  species: string;
  chaseT: number;
  cooldown: number;
  alt: number;
  scale: number;
  seen: boolean;
}

interface SpeciesBatch { model: AnimalModel; mesh: THREE.InstancedMesh; anim: THREE.InstancedBufferAttribute; used: number }

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);

export class AnimalManager {
  readonly animals: Animal[] = [];
  private batches = new Map<string, SpeciesBatch>();
  private rng: Rng;
  onKnock: ((a: Animal) => void) | null = null;
  onRoar: ((a: Animal) => void) | null = null;
  onSeen: ((a: Animal) => void) | null = null;

  constructor(private scene: THREE.Scene, private phys: Physics, spawns: AnimalSpawn[], seed: number, private waterLevel: (x: number, z: number) => number, extraScale = 1) {
    this.rng = new Rng(seed ^ 0xa11a);
    const counts = new Map<string, number>();
    for (const s of spawns) counts.set(s.species, (counts.get(s.species) ?? 0) + s.count);
    for (const [sp, n] of counts) {
      const def = ANIMAL_BY_ID.get(sp);
      if (!def) continue;
      this.batch(def, n);
    }
    for (const s of spawns) {
      const def = ANIMAL_BY_ID.get(s.species);
      if (!def) continue;
      for (let i = 0; i < s.count; i++) {
        const a = this.rng.range(0, Math.PI * 2), r = this.rng.range(0, s.radius);
        const x = s.x + Math.cos(a) * r, z = s.z + Math.sin(a) * r;
        this.spawn(def, x, z, s.radius, extraScale);
      }
    }
  }

  private batch(def: AnimalDef, cap: number): SpeciesBatch {
    let b = this.batches.get(def.id);
    if (b) return b;
    const model = buildAnimal(def);
    const mats = characterMaterial(model.kind, model.pivots);
    const anim = new THREE.InstancedBufferAttribute(new Float32Array(Math.max(1, cap) * 4), 4);
    anim.setUsage(THREE.DynamicDrawUsage);
    model.geo.setAttribute('aAnim', anim);
    const mesh = new THREE.InstancedMesh(model.geo, mats.mat, Math.max(1, cap));
    mesh.customDepthMaterial = mats.depth;
    mesh.castShadow = def.scale > 0.8;
    mesh.frustumCulled = false;
    mesh.count = 0;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.scene.add(mesh);
    b = { model, mesh, anim, used: 0 };
    this.batches.set(def.id, b);
    return b;
  }

  spawn(def: AnimalDef, x: number, z: number, radius: number, scale = 1): Animal | null {
    const b = this.batch(def, 4);
    if (b.used >= (b.mesh.instanceMatrix.count ?? 0)) return null;
    const slot = b.used++;
    b.mesh.count = b.used;
    const y = def.behaviour === 'swimmer' ? this.waterLevel(x, z) - 0.8 : this.phys.ts.height(x, z);
    const an: Animal = {
      def, species: def.id, pos: new THREE.Vector3(x, y, z), home: new THREE.Vector3(x, y, z), radius, heading: this.rng.range(0, 6.28),
      speed: 0, target: new THREE.Vector3(x, y, z), state: def.behaviour === 'flyer' ? 'fly' : def.behaviour === 'swimmer' ? 'swim' : 'idle',
      timer: this.rng.range(0, 5), phase: this.rng.range(0, 10), slot, chaseT: 0, cooldown: 0, alt: this.rng.range(14, 40),
      scale: scale * this.rng.range(0.9, 1.1), seen: false,
    };
    this.animals.push(an);
    return an;
  }

  private pickTarget(a: Animal, r: number) {
    for (let i = 0; i < 6; i++) {
      const ang = this.rng.range(0, Math.PI * 2), d = this.rng.range(0, r);
      const x = a.home.x + Math.cos(ang) * d, z = a.home.z + Math.sin(ang) * d;
      const h = this.phys.ts.height(x, z);
      const wl = this.waterLevel(x, z);
      if (a.def.behaviour === 'swimmer' ? h < wl - 1.5 : h > wl + 0.2) { a.target.set(x, h, z); return; }
    }
    a.target.copy(a.home);
  }

  update(dt: number, player: THREE.Vector3, playerHidden: boolean, crouching: boolean, playerOnMount: boolean, night: number) {
    for (const a of this.animals) {
      const b = this.batches.get(a.species)!;
      const dx = player.x - a.pos.x, dz = player.z - a.pos.z;
      const dP = Math.hypot(dx, dz);
      const far = dP > 520;
      a.cooldown = Math.max(0, a.cooldown - dt);
      if (!a.seen && dP < Math.max(28, a.def.scale * 6)) { a.seen = true; this.onSeen?.(a); }
      const beh = a.def.behaviour;
      let mode = 0;
      let moveSpeed = 0;
      a.timer -= dt;
      if (beh === 'flyer') {
        // circle around the home spot, sometimes land
        if (a.timer <= 0) { a.timer = this.rng.range(6, 14); this.pickTarget(a, a.radius + 60); }
        const tx = a.target.x, tz = a.target.z;
        const ddx = tx - a.pos.x, ddz = tz - a.pos.z;
        a.heading += angleDiff(Math.atan2(ddx, ddz), a.heading) * Math.min(1, dt * 1.2);
        moveSpeed = a.def.speed[1] * 0.7;
        const gy = this.phys.ts.height(a.pos.x, a.pos.z);
        a.pos.y += (Math.max(gy, this.waterLevel(a.pos.x, a.pos.z)) + a.alt - a.pos.y) * Math.min(1, dt * 0.8);
        if (dP < 10 && a.def.scale < 1) a.alt = 30;
        mode = 2;
      } else if (beh === 'swimmer') {
        if (a.timer <= 0) { a.timer = this.rng.range(4, 10); this.pickTarget(a, a.radius + 30); }
        const ddx = a.target.x - a.pos.x, ddz = a.target.z - a.pos.z;
        a.heading += angleDiff(Math.atan2(ddx, ddz), a.heading) * Math.min(1, dt * 1.5);
        moveSpeed = Math.hypot(ddx, ddz) > 3 ? a.def.speed[0] : 0;
        const wl = this.waterLevel(a.pos.x, a.pos.z);
        const floor = this.phys.ts.height(a.pos.x, a.pos.z);
        a.pos.y = Math.max(floor + 0.5, wl - 0.6 - (a.def.scale > 6 ? 2.5 : 0) + Math.sin(a.phase * 0.3) * 0.2);
        mode = 0;
      } else {
        const predator = beh === 'predator';
        const skittish = beh === 'skittish' || beh === 'grazer' || beh === 'herd';
        const fleeR = beh === 'skittish' ? 22 : 11 + a.def.scale;
        if (predator && a.state !== 'chase' && a.cooldown <= 0 && !playerHidden && dP < (crouching ? 13 : 24) + a.def.scale && !playerOnMount) {
          a.state = 'chase'; a.chaseT = 9; this.onRoar?.(a);
        }
        if (a.state === 'chase') {
          a.chaseT -= dt;
          if (a.chaseT <= 0 || dP > 55 || playerHidden) { a.state = 'walk'; a.cooldown = 20; this.pickTarget(a, a.radius); }
          else {
            a.target.set(player.x, 0, player.z);
            moveSpeed = Math.min(a.def.speed[1], 8.1);
            if (dP < 1.6 + a.def.body.l * 0.35) { this.onKnock?.(a); a.state = 'walk'; a.cooldown = 25; this.pickTarget(a, a.radius); }
          }
        } else if (skittish && !predator && dP < fleeR && a.state !== 'flee') {
          a.state = 'flee'; a.timer = this.rng.range(3, 5);
          a.target.set(a.pos.x - (dx / (dP || 1)) * 30, 0, a.pos.z - (dz / (dP || 1)) * 30);
        } else if (a.state === 'flee') {
          moveSpeed = a.def.speed[1] * 0.75;
          if (a.timer <= 0) { a.state = 'idle'; a.home.set(a.pos.x, a.pos.y, a.pos.z); }
        } else if (beh === 'follower' && dP < 14 && dP > 3) {
          a.target.set(player.x, 0, player.z);
          moveSpeed = a.def.speed[0] * 1.8;
          a.state = 'follow';
        } else {
          if (a.timer <= 0) {
            const r = this.rng.next();
            a.timer = this.rng.range(3, 10);
            if (r < 0.45) { a.state = 'walk'; this.pickTarget(a, a.radius); }
            else if (r < 0.8 && (beh === 'grazer' || beh === 'herd')) a.state = 'graze';
            else a.state = night > 0.7 && this.rng.chance(0.6) ? 'rest' : 'idle';
          }
          if (a.state === 'walk') {
            moveSpeed = a.def.speed[0];
            if (Math.hypot(a.target.x - a.pos.x, a.target.z - a.pos.z) < 1.5) a.state = 'idle';
          }
          if (a.state === 'graze') mode = 2;
          if (a.state === 'rest') mode = a.def.scale < 3 ? 4 : 1;
        }
        if (moveSpeed > 0) {
          const tdx = a.target.x - a.pos.x, tdz = a.target.z - a.pos.z;
          a.heading += angleDiff(Math.atan2(tdx, tdz), a.heading) * Math.min(1, dt * 4);
        }
      }
      if (moveSpeed > 0 && !far) {
        const nx = a.pos.x + Math.sin(a.heading) * moveSpeed * dt, nz = a.pos.z + Math.cos(a.heading) * moveSpeed * dt;
        if (beh === 'flyer') { a.pos.x = nx; a.pos.z = nz; }
        else {
          const r = this.phys.move(a.pos.x, a.pos.z, nx, nz, a.pos.y, Math.min(2.5, a.def.body.w * 0.4 + 0.2), a.def.body.leg + a.def.body.h, 0.7);
          const wl = this.waterLevel(r.x, r.z);
          const ok = beh === 'swimmer' ? this.phys.ts.height(r.x, r.z) < wl - 1.2 : r.ground > wl - 0.4 || a.def.scale > 3;
          if (ok) { a.pos.x = r.x; a.pos.z = r.z; if (beh !== 'swimmer') a.pos.y += (r.ground - a.pos.y) * Math.min(1, dt * 8); }
          else { a.timer = 0; a.state = 'idle'; }
        }
      }
      a.phase += dt * (moveSpeed > 0 ? moveSpeed * (a.def.archetype === 'hopper' ? 1.2 : 2.2) / Math.max(0.4, a.def.body.leg * 1.6) : 1);
      a.speed = moveSpeed;
      const amt = moveSpeed > 0 ? Math.min(1, 0.4 + moveSpeed / Math.max(1, a.def.speed[1]) * 0.8) : 0;
      _q.setFromAxisAngle(_up, a.heading);
      _m.compose(a.pos, _q, _s.set(a.scale, a.scale, a.scale));
      b.mesh.setMatrixAt(a.slot, _m);
      b.anim.setXYZW(a.slot, a.phase, amt, a.state === 'fly' && moveSpeed === 0 ? 1 : mode, a.slot * 1.7);
    }
    for (const b of this.batches.values()) { b.mesh.instanceMatrix.needsUpdate = true; b.anim.needsUpdate = true; }
  }

  nearest(p: THREE.Vector3, maxD: number, filter?: (a: Animal) => boolean): Animal | null {
    let best: Animal | null = null, bd = maxD;
    for (const a of this.animals) {
      if (filter && !filter(a)) continue;
      const d = a.pos.distanceTo(p);
      if (d < bd) { bd = d; best = a; }
    }
    return best;
  }

  destroy() {
    for (const b of this.batches.values()) { this.scene.remove(b.mesh); b.mesh.geometry.dispose(); b.mesh.dispose(); }
    this.batches.clear();
    this.animals.length = 0;
  }
}
