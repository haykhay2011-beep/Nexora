// Anomalies in the world (catch / chase / puzzle / sneak challenges) and item pickups.
import * as THREE from 'three';
import { Rng } from '../core/rng';
import { ANOMALY_BY_ID, ANIMAL_BY_ID, ITEM_BY_ID } from '../data';
import type { AnomalyDef } from '../data/types';
import type { AnomalySpawn } from '../gen/planTypes';
import type { Physics } from '../engine/Physics';
import { anomalyGeometry, CREATURE_MODEL } from './anomalyModels';
import { MATS, GLOBAL } from '../engine/materials';
import type { AnimalManager, Animal } from '../entities/Animals';
import type { NPCManager, Npc } from '../entities/NPCs';
import { AREA_HALF } from '../gen/terrain';

export interface ActiveAnomaly {
  spawn: AnomalySpawn;
  def: AnomalyDef;
  pos: THREE.Vector3;
  home: THREE.Vector3;
  group: THREE.Group;
  animal: Animal | null;
  state: 'idle' | 'flee' | 'tired' | 'blink';
  timer: number;
  hop: THREE.Vector3 | null;
  story: boolean;
  watcherNpc: Npc | null;
  watcherAnimal: Animal | null;
  done: boolean;
  noticed: boolean;
}

const auraMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  uniforms: { uTime: GLOBAL.uTime, uColor: { value: new THREE.Color('#7af0ff') } },
  vertexShader: `varying vec3 vN; varying vec3 vV; void main(){ vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `uniform float uTime; uniform vec3 uColor; varying vec3 vN; varying vec3 vV;
    void main(){ float f = pow(1.0 - abs(dot(vN, vV)), 2.0); float p = 0.65 + 0.35 * sin(uTime * 4.0); gl_FragColor = vec4(uColor * (f * 1.4 + 0.08) * p, f * 0.9); }`,
});
const auraGeo = new THREE.SphereGeometry(1, 16, 10);

function sparkles(n: number): THREE.Points {
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) pos.set([(Math.random() - 0.5) * 2.4, Math.random() * 2.2, (Math.random() - 0.5) * 2.4], i * 3);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uTime: GLOBAL.uTime },
    vertexShader: `uniform float uTime; void main(){ vec3 p = position; p.y = mod(p.y + uTime * 0.6, 2.2); p.x += sin(uTime * 2.0 + position.z * 5.0) * 0.1; vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_PointSize = 90.0 / max(1.0, -mv.z); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `void main(){ float d = length(gl_PointCoord - 0.5); gl_FragColor = vec4(0.6, 0.95, 1.0, smoothstep(0.5, 0.0, d)); }`,
  });
  const p = new THREE.Points(g, m);
  p.frustumCulled = false;
  return p;
}

export class AnomalyManager {
  readonly list: ActiveAnomaly[] = [];
  private rng: Rng;
  onDetected: ((a: ActiveAnomaly) => void) | null = null;
  onBlink: ((a: ActiveAnomaly) => void) | null = null;
  onNotice: ((a: ActiveAnomaly) => void) | null = null;

  constructor(private scene: THREE.Scene, private phys: Physics, private animals: AnimalManager, private npcs: NPCManager, seed: number) {
    this.rng = new Rng(seed ^ 0xa0a0);
  }

  add(sp: AnomalySpawn, story = false): ActiveAnomaly | null {
    const def = ANOMALY_BY_ID.get(sp.anomalyId);
    if (!def) return null;
    const y = this.phys.groundAt(sp.x, sp.z).y;
    const group = new THREE.Group();
    let animal: Animal | null = null;
    const cm = def.creature ? CREATURE_MODEL[def.model] : undefined;
    if (cm && ANIMAL_BY_ID.get(cm.species)) {
      animal = this.animals.spawn(ANIMAL_BY_ID.get(cm.species)!, sp.x, sp.z, 6, cm.scale);
      if (animal) { animal.state = 'idle'; animal.def = { ...animal.def, behaviour: 'wander' }; }
    }
    if (!animal) {
      const mesh = new THREE.Mesh(anomalyGeometry(def.model), MATS.prop);
      mesh.castShadow = true;
      mesh.name = 'model';
      group.add(mesh);
    }
    const aura = new THREE.Mesh(auraGeo, auraMat);
    aura.scale.setScalar(def.model === 'casing_stone' ? 1.5 : 0.9);
    aura.position.y = 0.6;
    group.add(aura, sparkles(24));
    group.position.set(sp.x, y, sp.z);
    this.scene.add(group);
    const a: ActiveAnomaly = {
      spawn: sp, def, pos: new THREE.Vector3(sp.x, y, sp.z), home: new THREE.Vector3(sp.x, y, sp.z), group, animal, state: 'idle', timer: 0, hop: null,
      story, watcherNpc: null, watcherAnimal: null, done: false, noticed: false,
    };
    if (sp.challenge === 'sneak' && sp.watcher) {
      if (sp.watcher.kind === 'npc') {
        a.watcherNpc = this.npcs.add({
          id: 'watcher-' + sp.instanceId, name: 'Watchful local', job: 'watcher', jobName: 'Curious onlooker', work: 'idle', fact: '',
          x: sp.watcher.x, z: sp.watcher.z, home: [sp.watcher.x, sp.watcher.z], workAt: [sp.watcher.x, sp.watcher.z], social: [sp.watcher.x, sp.watcher.z],
          outfit: { body: 'tunic', hat: 'none', colors: ['#c99568', '#7a5a8a', '#e8c84a', '#2a2018', '#3a2a1e'], hair: 0, scale: 1, glow: false },
          trader: false, questGiver: false, age: 'adult', seed: sp.seed, sleepsOutside: true,
        }, { watcher: true });
      } else if (sp.watcher.species && ANIMAL_BY_ID.get(sp.watcher.species)) {
        a.watcherAnimal = this.animals.spawn(ANIMAL_BY_ID.get(sp.watcher.species)!, sp.watcher.x, sp.watcher.z, 3);
        if (a.watcherAnimal) a.watcherAnimal.def = { ...a.watcherAnimal.def, behaviour: 'wander' };
      }
    }
    this.list.push(a);
    return a;
  }

  remove(a: ActiveAnomaly) {
    a.done = true;
    this.scene.remove(a.group);
    if (a.animal) { a.animal.pos.y = -999; a.animal.home.y = -999; a.animal.state = 'rest'; a.animal.def = { ...a.animal.def, behaviour: 'swimmer' }; }
    if (a.watcherNpc) this.npcs.remove(a.watcherNpc);
    const i = this.list.indexOf(a);
    if (i >= 0) this.list.splice(i, 1);
  }

  nearest(p: THREE.Vector3): ActiveAnomaly | null {
    let best: ActiveAnomaly | null = null, bd = Infinity;
    for (const a of this.list) { const d = a.pos.distanceTo(p); if (d < bd) { bd = d; best = a; } }
    return best;
  }

  private blink(a: ActiveAnomaly) {
    for (let i = 0; i < 10; i++) {
      const ang = this.rng.range(0, Math.PI * 2), r = this.rng.range(15, 35);
      const x = a.home.x + Math.cos(ang) * r, z = a.home.z + Math.sin(ang) * r;
      if (Math.abs(x) > AREA_HALF - 100 || Math.abs(z) > AREA_HALF - 100) continue;
      const g = this.phys.groundAt(x, z);
      if (g.y > 0.6 && !this.phys.blocked(x, z, g.y)) { a.pos.set(x, g.y, z); break; }
    }
    if (a.watcherNpc) { a.watcherNpc.spawn.x = a.pos.x + 8; a.watcherNpc.spawn.z = a.pos.z + 3; a.watcherNpc.pos.set(a.pos.x + 8, this.phys.groundAt(a.pos.x + 8, a.pos.z + 3).y, a.pos.z + 3); }
    this.onBlink?.(a);
  }

  /** Returns the anomaly the player can capture right now (in reach), if any. */
  update(dt: number, player: THREE.Vector3, crouching: boolean, running: boolean): ActiveAnomaly | null {
    let reachable: ActiveAnomaly | null = null;
    for (const a of this.list) {
      const dP = Math.hypot(player.x - a.pos.x, player.z - a.pos.z);
      if (!a.noticed && dP < 30) { a.noticed = true; this.onNotice?.(a); }
      const ch = a.spawn.challenge;
      a.timer -= dt;
      if (ch === 'catch' || ch === 'chase') {
        const fleeR = ch === 'catch' ? 9 : 16;
        if (a.state === 'tired') { if (a.timer <= 0) { a.state = 'idle'; a.timer = this.rng.range(5, 9); } }
        else if (dP < fleeR) {
          if (ch === 'chase' && a.state === 'flee' && a.timer <= 0) { a.state = 'tired'; a.timer = 2.8; }
          else {
            if (a.state !== 'flee') { a.state = 'flee'; a.timer = ch === 'chase' ? this.rng.range(6, 9) : 99; }
            const speed = ch === 'chase' ? 7.3 : running ? 3.6 : 2.6;
            let dx = a.pos.x - player.x, dz = a.pos.z - player.z;
            const d = Math.hypot(dx, dz) || 1;
            dx /= d; dz /= d;
            // tether to home so it stays catchable
            const hx = a.home.x - a.pos.x, hz = a.home.z - a.pos.z, hd = Math.hypot(hx, hz);
            if (hd > 45) { dx += (hx / hd) * 1.5; dz += (hz / hd) * 1.5; }
            const swerve = Math.sin(a.timer * 2.3 + a.spawn.seed) * 0.7;
            const mx = dx * Math.cos(swerve) - dz * Math.sin(swerve), mz = dx * Math.sin(swerve) + dz * Math.cos(swerve);
            const r = this.phys.move(a.pos.x, a.pos.z, a.pos.x + mx * speed * dt, a.pos.z + mz * speed * dt, a.pos.y, 0.3, 1, 0.8);
            if (r.ground > 0.3) { a.pos.x = r.x; a.pos.z = r.z; a.pos.y += (r.ground - a.pos.y) * Math.min(1, dt * 10); }
            else a.timer = 0;
          }
        } else if (a.state === 'flee' && dP > fleeR * 1.6) a.state = 'idle';
      } else if (ch === 'sneak') {
        let seen = false;
        const w = a.watcherNpc ? { x: a.watcherNpc.pos.x, z: a.watcherNpc.pos.z, h: a.watcherNpc.heading, y: a.watcherNpc.pos.y } : a.watcherAnimal ? { x: a.watcherAnimal.pos.x, z: a.watcherAnimal.pos.z, h: a.watcherAnimal.heading, y: a.watcherAnimal.pos.y } : null;
        if (w) {
          const dx = player.x - w.x, dz = player.z - w.z;
          const d = Math.hypot(dx, dz);
          const ang = Math.abs(Math.atan2(Math.sin(Math.atan2(dx, dz) - w.h), Math.cos(Math.atan2(dx, dz) - w.h)));
          const range = crouching ? 7 : running ? 20 : 14;
          if (d < range && ang < 0.8 && this.phys.lineOfSight(w.x, w.y + 1.6, w.z, player.x, player.y + 1, player.z)) seen = true;
          if (d < 2.2) seen = !crouching;
        }
        if (seen && a.state !== 'blink') {
          a.state = 'blink'; a.timer = 2;
          if (a.watcherNpc?.watcher) a.watcherNpc.watcher.alert = 2.5;
          this.onDetected?.(a);
          this.blink(a);
        }
        if (a.state === 'blink' && a.timer <= 0) a.state = 'idle';
      }
      // visuals
      const bob = Math.sin(GLOBAL.uTime.value * 2 + a.spawn.seed) * 0.12;
      a.group.position.set(a.pos.x, a.pos.y + (a.animal ? 0 : 0.25 + bob), a.pos.z);
      const model = a.group.getObjectByName('model');
      if (model) model.rotation.y += dt * (a.state === 'flee' ? 6 : 1.2);
      if (a.animal) { a.animal.pos.copy(a.pos); a.animal.speed = a.state === 'flee' ? 5 : 0; a.animal.heading = Math.atan2(a.pos.x - player.x, a.pos.z - player.z); }
      if (dP < 2.4 && Math.abs(player.y - a.pos.y) < 2.5 && a.state !== 'blink') reachable = a;
    }
    return reachable;
  }

  destroy() { for (const a of [...this.list]) this.remove(a); }
}

// ------------------------------------------------------------------------------------------------
export interface Pickup { id: string; item: string; pos: THREE.Vector3; sprite: THREE.Sprite; orb: THREE.Mesh; tag: string }

const texCache = new Map<string, THREE.Texture>();
function emojiTexture(icon: string): THREE.Texture {
  let t = texCache.get(icon);
  if (t) return t;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.font = '88px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(icon, 64, 70);
  t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  texCache.set(icon, t);
  return t;
}

export class PickupManager {
  readonly list: Pickup[] = [];
  constructor(private scene: THREE.Scene, private phys: Physics) {}
  add(id: string, item: string, x: number, z: number, tag: string): Pickup {
    const g = this.phys.groundAt(x, z);
    const def = ITEM_BY_ID.get(item);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: emojiTexture(def?.icon ?? '✨'), transparent: true, depthWrite: false }));
    sprite.scale.set(0.9, 0.9, 0.9);
    const orb = new THREE.Mesh(auraGeo, auraMat);
    orb.scale.setScalar(0.7);
    this.scene.add(sprite, orb);
    const p: Pickup = { id, item, pos: new THREE.Vector3(x, g.y, z), sprite, orb, tag };
    this.list.push(p);
    return p;
  }
  remove(p: Pickup) {
    this.scene.remove(p.sprite, p.orb);
    (p.sprite.material as THREE.SpriteMaterial).dispose();
    const i = this.list.indexOf(p);
    if (i >= 0) this.list.splice(i, 1);
  }
  update(player: THREE.Vector3): Pickup | null {
    let near: Pickup | null = null;
    const t = GLOBAL.uTime.value;
    for (const p of this.list) {
      const y = p.pos.y + 1 + Math.sin(t * 2 + p.pos.x) * 0.15;
      p.sprite.position.set(p.pos.x, y, p.pos.z);
      p.orb.position.set(p.pos.x, y, p.pos.z);
      if (Math.hypot(player.x - p.pos.x, player.z - p.pos.z) < 2.2 && Math.abs(player.y - p.pos.y) < 3) near = p;
    }
    return near;
  }
  destroy() { for (const p of [...this.list]) this.remove(p); }
}
