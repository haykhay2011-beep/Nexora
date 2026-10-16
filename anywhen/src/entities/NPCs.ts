// Townspeople: daily routines (sleep, walk to work, work, socialise), talking, story NPCs, watchers.
import * as THREE from 'three';
import { Rng } from '../core/rng';
import { HumanoidLayer, type HumanHandle } from './humanoid';
import type { Physics } from '../engine/Physics';
import type { NpcSpawn, Outfit } from '../gen/planTypes';

export type NpcActivity = 'sleep' | 'commute' | 'work' | 'lunch' | 'social' | 'home' | 'talk' | 'watch' | 'stand';

export interface Npc {
  spawn: NpcSpawn;
  pos: THREE.Vector3;
  heading: number;
  target: [number, number] | null;
  activity: NpcActivity;
  phase: number;
  moving: boolean;
  handle: HumanHandle | null;
  story: boolean;
  storyId?: string;
  watcher?: { cone: number; sweep: number; alert: number };
  stuck: number;
  wanderT: number;
  talkT: number;
  visible: boolean;
  sitting: boolean;
}

const UPDATE_RADIUS = 170;

export class NPCManager {
  readonly npcs: Npc[] = [];
  private layer: HumanoidLayer;
  private rng: Rng;
  constructor(scene: THREE.Scene, private phys: Physics, seed: number) {
    this.layer = new HumanoidLayer(scene, 90, true, false);
    this.rng = new Rng(seed ^ 0x1234);
  }

  add(sp: NpcSpawn, opts: { story?: boolean; storyId?: string; watcher?: boolean } = {}): Npc {
    const g = this.phys.groundAt(sp.x, sp.z);
    const n: Npc = {
      spawn: sp, pos: new THREE.Vector3(sp.x, g.y, sp.z), heading: this.rng.range(0, 6.28), target: null, activity: 'stand',
      phase: this.rng.range(0, 10), moving: false, handle: null, story: !!opts.story, storyId: opts.storyId,
      watcher: opts.watcher ? { cone: 0.75, sweep: this.rng.range(0, 6.28), alert: 0 } : undefined, stuck: 0, wanderT: 0, talkT: 0, visible: false, sitting: false,
    };
    this.npcs.push(n);
    return n;
  }

  remove(n: Npc) {
    if (n.handle) this.layer.remove(n.handle);
    const i = this.npcs.indexOf(n);
    if (i >= 0) this.npcs.splice(i, 1);
  }

  setOutfit(n: Npc, o: Outfit) {
    if (n.handle) { this.layer.remove(n.handle); n.handle = null; }
    n.spawn.outfit = o;
  }

  private schedule(n: Npc, hour: number): { act: NpcActivity; at: [number, number] } {
    const s = n.spawn;
    if (n.story || n.watcher) return { act: n.watcher ? 'watch' : 'stand', at: [s.x, s.z] };
    if (s.sleepsOutside) {
      if (hour < 6 || hour >= 21) return { act: 'sleep', at: s.home };
      if (hour >= 18) return { act: 'social', at: s.social };
      return { act: 'work', at: s.workAt };
    }
    if (hour < 6 || hour >= 21.5) return { act: 'sleep', at: s.home };
    if (hour < 7.5) return { act: 'commute', at: s.workAt };
    if (hour < 12) return { act: 'work', at: s.workAt };
    if (hour < 13) return { act: 'lunch', at: s.social };
    if (hour < 17) return { act: 'work', at: s.workAt };
    if (hour < 20) return { act: 'social', at: s.social };
    return { act: 'home', at: s.home };
  }

  update(dt: number, hour: number, player: THREE.Vector3, talking: Npc | null) {
    for (const n of this.npcs) {
      const dP = Math.hypot(n.pos.x - player.x, n.pos.z - player.z);
      const near = dP < UPDATE_RADIUS;
      if (!near) {
        if (n.handle) { this.layer.remove(n.handle); n.handle = null; }
        n.visible = false;
        // far away: snap to where the schedule puts them
        const sc = this.schedule(n, hour);
        if (!n.story) { n.pos.x = sc.at[0]; n.pos.z = sc.at[1]; n.activity = sc.act; }
        continue;
      }
      if (!n.handle) { n.handle = this.layer.add(n.spawn.outfit); n.pos.y = this.phys.groundAt(n.pos.x, n.pos.z).y; }
      if (!n.handle) continue;
      n.visible = true;
      let mode = 0, amt = 0;
      if (talking === n) {
        n.activity = 'talk';
        const want = Math.atan2(player.x - n.pos.x, player.z - n.pos.z);
        n.heading += angleDiff(want, n.heading) * Math.min(1, dt * 6);
        mode = 3;
      } else {
        const sc = this.schedule(n, hour);
        n.activity = sc.act;
        let tx = sc.at[0], tz = sc.at[1];
        // small idle wander around the activity spot
        n.wanderT -= dt;
        if (n.wanderT <= 0 && (sc.act === 'work' || sc.act === 'social' || sc.act === 'lunch')) {
          n.wanderT = this.rng.range(6, 18);
          n.target = [tx + this.rng.range(-4, 4), tz + this.rng.range(-4, 4)];
          n.sitting = sc.act === 'social' && this.rng.chance(0.3);
        }
        if (n.target && (sc.act === 'work' || sc.act === 'social' || sc.act === 'lunch')) { tx = n.target[0]; tz = n.target[1]; }
        const dx = tx - n.pos.x, dz = tz - n.pos.z;
        const d = Math.hypot(dx, dz);
        if (d > 1.2 && sc.act !== 'watch' && sc.act !== 'stand') {
          const sp = sc.act === 'commute' || sc.act === 'home' ? 1.5 : 1.15;
          const nx = n.pos.x + (dx / d) * sp * dt, nz = n.pos.z + (dz / d) * sp * dt;
          const r = this.phys.move(n.pos.x, n.pos.z, nx, nz, n.pos.y, 0.32, 1.7, 0.6);
          const movedD = Math.hypot(r.x - n.pos.x, r.z - n.pos.z);
          if (movedD < sp * dt * 0.3) n.stuck += dt; else n.stuck = Math.max(0, n.stuck - dt);
          if (n.stuck > 2.5) {
            // sidestep around obstacles
            const side = this.rng.chance(0.5) ? 1 : -1;
            n.pos.x += (-dz / d) * side * 1.5; n.pos.z += (dx / d) * side * 1.5;
            n.stuck = 0;
            if (dP > 40 && this.rng.chance(0.3)) { n.pos.x = tx; n.pos.z = tz; }
          } else { n.pos.x = r.x; n.pos.z = r.z; }
          n.pos.y += (r.ground - n.pos.y) * Math.min(1, dt * 10);
          n.heading += angleDiff(Math.atan2(dx, dz), n.heading) * Math.min(1, dt * 5);
          amt = 0.8;
          n.moving = true;
          n.sitting = false;
        } else {
          n.moving = false;
          if (sc.act === 'sleep') mode = n.spawn.sleepsOutside ? 2 : 4;
          else if (sc.act === 'home') mode = 4;
          else if (sc.act === 'work') mode = ['farm', 'craft', 'build', 'dock', 'herd', 'cook', 'gather'].includes(n.spawn.work) ? 1 : 3;
          else if (sc.act === 'social' || sc.act === 'lunch') mode = n.sitting ? 2 : 3;
          else if (sc.act === 'watch' && n.watcher) {
            n.watcher.sweep += dt * 0.45;
            n.heading = n.watcher.sweep + Math.sin(n.watcher.sweep * 1.7) * 0.6;
            mode = n.watcher.alert > 0 ? 12 : 0;
            n.watcher.alert = Math.max(0, n.watcher.alert - dt);
          }
          // a lone person who is "home" outside a house stays visible (camps / no house)
          if (mode === 4 && !n.spawn.home) mode = 2;
        }
      }
      n.phase += dt * (n.moving ? 5 : 2);
      this.layer.set(n.handle, n.pos.x, n.pos.y, n.pos.z, n.heading, n.spawn.outfit.scale, n.phase, amt, mode, n.spawn.seed % 10);
    }
    this.layer.commit();
  }

  nearest(p: THREE.Vector3, maxD: number): Npc | null {
    let best: Npc | null = null, bd = maxD;
    for (const n of this.npcs) {
      if (!n.visible || n.activity === 'sleep' || n.activity === 'home') continue;
      const d = Math.hypot(n.pos.x - p.x, n.pos.z - p.z);
      if (d < bd && Math.abs(n.pos.y - p.y) < 3) { bd = d; best = n; }
    }
    return best;
  }

  destroy() { this.layer.dispose(); this.npcs.length = 0; }
}

export function angleDiff(a: number, b: number): number { return Math.atan2(Math.sin(a - b), Math.cos(a - b)); }
