import * as THREE from 'three';
import { dolphinModel } from './models.js';
import { heightAt } from '../world/Terrain.js';
import { angleLerp, clamp } from '../core/math.js';

const COURT = new THREE.Vector3(-85, -48, 60);
const ECHO = new THREE.Vector3(95, -26, 330);
const tmp = new THREE.Vector3();
const DIRS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];

// The dolphin freed from the net. Follows the player and points toward nearby secrets.
export class Companion {
  constructor(game) {
    this.game = game;
    this.obj = dolphinModel(0x6f9cc8);
    // a little woven band so it is recognisable
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.05, 4, 12), new THREE.MeshBasicMaterial({ color: 0x7ff3ff }));
    band.position.z = 0.35;
    this.obj.add(band);
    this.obj.position.copy(COURT);
    game.scene.add(this.obj);
    this.pos = this.obj.position;
    this.vel = new THREE.Vector3();
    this.state = 'captive';
    this.t = 0;
    this.hintTimer = 8;
    this.guideT = 0;
  }

  free(silent) {
    this.state = 'follow';
    if (!silent) {
      this.game.audio.play('dolphin');
      this.game.ui.toast('The dolphin chirps happily and decides to follow you!', 'discover', 'It will point toward nearby secrets. It keeps looking toward the Kelp Forest...');
      this.setHint(ECHO, 'echo');
    }
  }

  applyState() {
    const st = this.game.state;
    if (st.flags.companion) {
      this.state = 'follow';
      this.pos.copy(this.game.player.pos).add(new THREE.Vector3(2, 0, 2));
      if (!st.shards.has('song')) this.setHint(ECHO, 'echo');
    } else {
      this.state = 'captive';
      this.pos.copy(COURT);
    }
  }

  setHint(pos, id) {
    this.game.companionHint = { x: pos.x, z: pos.z, id, pos: pos.clone ? pos.clone() : pos };
  }

  sing(pos) {
    this.state = 'sing';
    this.singT = 2.5;
    this.singPos = pos.clone().add(new THREE.Vector3(-3, 0.5, 0));
  }

  findSecret(pp) {
    const items = this.game.items.uncollected();
    let best = null, bestD = 140;
    for (const it of items) {
      if (it.type === 'pearl') continue;
      const d = it.pos.distanceTo(pp);
      if (d < 12) continue;
      if (d < bestD) { bestD = d; best = it; }
    }
    return best;
  }

  update(dt, pp, interactive) {
    this.t += dt;
    const g = this.game;
    const tail = this.obj.userData.tail;
    if (this.state === 'captive') {
      tmp.set(COURT.x + Math.cos(this.t * 0.6) * 4, COURT.y + Math.sin(this.t * 1.1) * 0.8, COURT.z + Math.sin(this.t * 0.6) * 4);
      this.move(tmp, 4, dt);
      tail.rotation.x = Math.sin(this.t * 5) * 0.35;
      return;
    }
    // clear hints that are done
    const hint = g.companionHint;
    if (hint) {
      if (hint.id === 'echo' && g.state.shards.has('song')) g.companionHint = null;
      else if (hint.item && !g.items.uncollected().some((u) => u.pos === hint.item.pos)) g.companionHint = null;
    }
    if (this.state === 'sing') {
      this.singT -= dt;
      this.move(this.singPos, 6, dt);
      this.obj.rotation.z = Math.sin(this.t * 10) * 0.3;
      if (this.singT <= 0) { this.state = 'follow'; this.obj.rotation.z = 0; }
    } else if (this.state === 'guide') {
      this.guideT -= dt;
      const d = this.move(this.guideTarget, 9, dt);
      if (this.guideT <= 0 || d < 6) this.state = 'follow';
    } else {
      // follow: hold a spot beside and slightly ahead of the player
      const f = g.player.forward;
      tmp.set(pp.x + f.x * 3 + Math.cos(this.t * 0.7) * 2.5, pp.y + 0.5 + Math.sin(this.t * 0.9) * 0.8, pp.z + f.z * 3 + Math.sin(this.t * 0.7) * 2.5);
      const far = this.pos.distanceTo(pp);
      if (far > 80) this.pos.copy(pp).add(new THREE.Vector3(-4, 1, 4)); // catch up after teleports
      this.move(tmp, clamp(far * 0.9, 3, 14), dt);
      if (interactive) {
        this.hintTimer -= dt;
        if (this.hintTimer <= 0) {
          this.hintTimer = 25;
          const s = this.findSecret(pp);
          if (s && !(hint && hint.id === 'echo')) {
            this.guideTarget = s.pos.clone();
            this.guideT = 5;
            this.state = 'guide';
            this.game.companionHint = { x: s.pos.x, z: s.pos.z, id: 'item', item: s };
            g.audio.play('dolphin', this.pos);
            const bearing = Math.atan2(s.pos.x - pp.x, -(s.pos.z - pp.z));
            const idx = Math.round(((bearing / (Math.PI * 2)) * 8 + 8)) % 8;
            const what = s.type === 'shard' ? 'something that hums like crystal' : s.type === 'relic' ? 'something glinting' : s.type === 'page' ? 'something old and written' : 'a clam';
            g.ui.toast(`Your dolphin clicks toward ${what} to the ${DIRS[idx]}.`, 'discover', 'Look for the dolphin icon on your compass.');
          }
        }
      }
    }
    tail.rotation.x = Math.sin(this.t * (this.vel.length() > 4 ? 9 : 5)) * 0.35;
  }

  move(target, speed, dt) {
    tmp.subVectors(target, this.pos);
    const d = tmp.length();
    if (d > 0.01) tmp.multiplyScalar(Math.min(speed, d * 1.5) / d);
    this.vel.lerp(tmp, 1 - Math.exp(-2 * dt));
    this.pos.addScaledVector(this.vel, dt);
    const gy = heightAt(this.pos.x, this.pos.z) + 1.2;
    if (this.pos.y < gy) this.pos.y = gy;
    if (this.pos.y > -1) this.pos.y = -1;
    const sp = Math.hypot(this.vel.x, this.vel.z);
    if (sp > 0.1) {
      this.obj.rotation.order = 'YXZ';
      this.obj.rotation.y = angleLerp(this.obj.rotation.y, Math.atan2(this.vel.x, this.vel.z), 1 - Math.exp(-3 * dt));
      this.obj.rotation.x = -Math.atan2(this.vel.y, sp) * 0.7;
    }
    return d;
  }
}
