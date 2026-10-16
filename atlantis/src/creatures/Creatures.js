import * as THREE from 'three';
import { heightAt, zoneAt } from '../world/Terrain.js';
import { ZONE_BY_ID } from '../world/config.js';
import { RNG, clamp, angleLerp } from '../core/math.js';
import { getMaterials } from '../world/Materials.js';
import {
  fishGeometry, turtleModel, rayModel, dolphinModel, sharkModel, octopusModel, jellyModel, eelModel, anglerModel,
} from './models.js';
import { Companion } from './Companion.js';

const FISH_PER_SCHOOL = { low: 10, medium: 16, high: 24 };
const UPDATE_RANGE = 120;
const tmpV = new THREE.Vector3();
const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpE = new THREE.Euler();
const tmpS = new THREE.Vector3();

function clampAboveGround(p, margin = 1) {
  const h = heightAt(p.x, p.z) + margin;
  if (p.y < h) p.y = h;
  if (p.y > -1.5) p.y = -1.5;
}

// Steer an object toward a target with a max speed; faces its velocity.
function steer(c, target, speed, dt, turn = 2) {
  tmpV.subVectors(target, c.pos);
  const d = tmpV.length();
  if (d > 0.01) tmpV.multiplyScalar(Math.min(speed, d * 2) / d);
  c.vel.lerp(tmpV, 1 - Math.exp(-turn * dt));
  c.pos.addScaledVector(c.vel, dt);
  return d;
}

function face(obj, vel, dt, rate = 4) {
  const sp = Math.hypot(vel.x, vel.z);
  if (sp < 0.05 && Math.abs(vel.y) < 0.05) return;
  const yaw = Math.atan2(vel.x, vel.z);
  const pitch = -Math.atan2(vel.y, Math.max(sp, 0.001));
  obj.rotation.order = 'YXZ';
  obj.rotation.y = angleLerp(obj.rotation.y, yaw, 1 - Math.exp(-rate * dt));
  obj.rotation.x += (clamp(pitch, -0.8, 0.8) - obj.rotation.x) * (1 - Math.exp(-rate * dt));
}

// Every living thing in the sea: ambient life, hazards and the dolphin companion.
export class Creatures {
  constructor(game) {
    this.game = game;
    this.scene = game.scene;
    this.pending = [];
    this.list = [];
    this.schools = [];
    this.rng = new RNG(4242);
    this.quality = game.settings.quality;
    this.fishGeo = fishGeometry();
    this.fishMat = new THREE.MeshLambertMaterial({ flatShading: true });
    this.glowFishMat = new THREE.MeshBasicMaterial();
    this.sharkAlerted = false;
  }

  spawnLater(type, x, y, z, opts = {}) {
    this.pending.push({ type, x, y, z, opts });
  }

  finalize() {
    for (const s of this.pending) this.spawn(s.type, s.x, s.y, s.z, s.opts);
    this.pending = [];
    this.spawnAmbient();
    this.companion = new Companion(this.game, this);
  }

  spawn(type, x, y, z, opts) {
    const make = {
      jelly: () => this.makeJelly(x, y, z, opts),
      shark: () => this.makeShark(x, y, z, opts),
      octopus: () => this.makeOctopus(x, y, z, opts),
      eel: () => this.makeEel(x, y, z, opts),
      angler: () => this.makeAngler(x, y, z, opts),
      turtle: () => this.makeTurtle(x, y, z, opts),
      ray: () => this.makeRay(x, y, z, opts),
      dolphin: () => this.makeDolphin(x, y, z, opts),
    }[type];
    if (!make) return null;
    const c = make();
    this.list.push(c);
    return c;
  }

  // Ambient life per zone.
  spawnAmbient() {
    const r = this.rng;
    const plan = {
      reef: { schools: 11, turtles: 4, rays: 3, colors: [0xffd166, 0xff7a6b, 0x48dbfb, 0xa29bfe, 0xff9f43, 0x7bed9f] },
      kelp: { schools: 7, turtles: 2, rays: 1, colors: [0xc8d8d0, 0xa8c890, 0xffd166] },
      city: { schools: 6, turtles: 1, rays: 2, colors: [0x9ab8d8, 0xd8c8a8, 0x48dbfb] },
      temple: { schools: 4, turtles: 0, rays: 2, colors: [0x6a8aff, 0xb8a8ff] },
      vents: { schools: 3, turtles: 0, rays: 0, colors: [0xff6a3a, 0xffb040], glow: true },
      palace: { schools: 3, turtles: 1, rays: 1, colors: [0xffd166, 0xe9c25a] },
      abyss: { schools: 5, turtles: 0, rays: 0, colors: [0x3af0ff, 0xb06aff, 0x3affb0], glow: true },
    };
    for (const [zid, p] of Object.entries(plan)) {
      const zn = ZONE_BY_ID[zid];
      const pick = () => {
        for (let t = 0; t < 20; t++) {
          const a = r.float(0, Math.PI * 2), d = Math.sqrt(r.next()) * zn.r * 0.9;
          const x = zn.x + Math.cos(a) * d, z = zn.z + Math.sin(a) * d;
          if (zoneAt(x, z).id === zid) return [x, z];
        }
        return [zn.x, zn.z];
      };
      for (let i = 0; i < p.schools; i++) {
        const [x, z] = pick();
        this.makeSchool(x, heightAt(x, z) + r.float(3, 10), z, r.pick(p.colors), !!p.glow, zid);
      }
      for (let i = 0; i < p.turtles; i++) { const [x, z] = pick(); this.list.push(this.makeTurtle(x, heightAt(x, z) + 5, z, {})); }
      for (let i = 0; i < p.rays; i++) { const [x, z] = pick(); this.list.push(this.makeRay(x, heightAt(x, z) + 2, z, {})); }
    }
    // a pod of wild dolphins in the reef
    for (let i = 0; i < 3; i++) this.list.push(this.makeDolphin(30 + i * 3, -7, 520, { pod: true, i }));
  }

  // ---------- Fish schools (instanced) ----------
  makeSchool(x, y, z, color, glow, zoneId) {
    const n = FISH_PER_SCHOOL[this.quality] || 16;
    const mesh = new THREE.InstancedMesh(this.fishGeo, glow ? this.glowFishMat : this.fishMat, 24);
    mesh.count = n;
    mesh.frustumCulled = false;
    const col = new THREE.Color();
    const fish = [];
    for (let i = 0; i < 24; i++) {
      col.set(color).offsetHSL((Math.random() - 0.5) * 0.05, 0, (Math.random() - 0.5) * 0.15);
      mesh.setColorAt(i, col);
      fish.push({
        pos: new THREE.Vector3(x + (Math.random() - 0.5) * 4, y + (Math.random() - 0.5) * 2, z + (Math.random() - 0.5) * 4),
        vel: new THREE.Vector3(),
        off: new THREE.Vector3((Math.random() - 0.5) * 5, (Math.random() - 0.5) * 2.5, (Math.random() - 0.5) * 5),
        ph: Math.random() * 10,
        s: 0.7 + Math.random() * 0.6,
      });
    }
    mesh.instanceColor.needsUpdate = true;
    this.scene.add(mesh);
    const school = {
      mesh, fish, anchor: new THREE.Vector3(x, y, z), center: new THREE.Vector3(x, y, z), target: new THREE.Vector3(x, y, z),
      vel: new THREE.Vector3(), flee: 0, retarget: 0, zoneId, glow,
    };
    this.schools.push(school);
    return school;
  }

  updateSchool(s, dt, pp) {
    const dist = s.center.distanceTo(pp);
    s.mesh.visible = dist < this.game.atmosphere.viewDist * 0.8;
    if (dist > UPDATE_RANGE) return;
    s.retarget -= dt;
    if (s.retarget <= 0) {
      s.retarget = 5 + Math.random() * 6;
      s.target.set(s.anchor.x + (Math.random() - 0.5) * 50, 0, s.anchor.z + (Math.random() - 0.5) * 50);
      s.target.y = heightAt(s.target.x, s.target.z) + 3 + Math.random() * 8;
    }
    // flee from the player
    if (dist < 8) {
      tmpV.subVectors(s.center, pp).normalize();
      s.target.copy(s.center).addScaledVector(tmpV, 18);
      s.target.y = Math.max(s.target.y, heightAt(s.target.x, s.target.z) + 2);
      s.flee = 1;
      s.retarget = 3;
    }
    s.flee = Math.max(0, s.flee - dt * 0.5);
    const speed = 2 + s.flee * 7;
    tmpV.subVectors(s.target, s.center);
    const d = tmpV.length();
    if (d > 0.1) s.vel.lerp(tmpV.multiplyScalar(speed / d), 1 - Math.exp(-2 * dt));
    s.center.addScaledVector(s.vel, dt);
    clampAboveGround(s.center, 1.5);
    const t = this.game.time;
    const spread = 1 + s.flee * 1.8;
    for (let i = 0; i < s.mesh.count; i++) {
      const f = s.fish[i];
      const ox = f.off.x * spread + Math.sin(t * 0.7 + f.ph) * 1.2;
      const oy = f.off.y * spread + Math.sin(t * 0.9 + f.ph * 2) * 0.5;
      const oz = f.off.z * spread + Math.cos(t * 0.6 + f.ph) * 1.2;
      tmpV.set(s.center.x + ox, s.center.y + oy, s.center.z + oz);
      tmpV.sub(f.pos);
      const fd = tmpV.length();
      const fs = speed * 1.3 + fd;
      if (fd > 0.01) f.vel.lerp(tmpV.multiplyScalar(Math.min(fs, fd * 3) / fd), 1 - Math.exp(-(3 + s.flee * 4) * dt));
      f.pos.addScaledVector(f.vel, dt);
      const sp = f.vel.length();
      const yaw = Math.atan2(f.vel.x, f.vel.z) + Math.sin(t * 12 + f.ph) * 0.15 * Math.min(1, sp);
      const pitch = -Math.atan2(f.vel.y, Math.hypot(f.vel.x, f.vel.z) + 0.001) * 0.8;
      tmpE.set(pitch, yaw, 0, 'YXZ');
      tmpQ.setFromEuler(tmpE);
      tmpS.setScalar(f.s);
      tmpM.compose(f.pos, tmpQ, tmpS);
      s.mesh.setMatrixAt(i, tmpM);
    }
    s.mesh.instanceMatrix.needsUpdate = true;
  }

  // ---------- Simple creatures ----------
  base(type, obj, x, y, z) {
    obj.position.set(x, y, z);
    this.scene.add(obj);
    return { type, obj, pos: obj.position, vel: new THREE.Vector3(), anchor: new THREE.Vector3(x, y, z), target: new THREE.Vector3(x, y, z), t: Math.random() * 10, retarget: 0 };
  }

  makeTurtle(x, y, z) {
    const c = this.base('turtle', turtleModel(), x, y, z);
    c.update = (dt) => {
      c.retarget -= dt;
      if (c.retarget <= 0 || c.pos.distanceTo(c.target) < 2) {
        c.retarget = 8 + Math.random() * 8;
        c.target.set(c.anchor.x + (Math.random() - 0.5) * 70, 0, c.anchor.z + (Math.random() - 0.5) * 70);
        c.target.y = heightAt(c.target.x, c.target.z) + 2 + Math.random() * 8;
      }
      steer(c, c.target, 1.6, dt, 0.8);
      clampAboveGround(c.pos, 1.2);
      face(c.obj, c.vel, dt, 1.2);
      for (const f of c.obj.userData.flippers) f.pivot.rotation.z = Math.sin(c.t * 2.2) * 0.5 * f.side;
    };
    return c;
  }

  makeRay(x, y, z) {
    const c = this.base('ray', rayModel(Math.random() < 0.5 ? 0x4a5a6a : 0x2a3a4a), x, y, z);
    c.update = (dt) => {
      c.retarget -= dt;
      if (c.retarget <= 0 || c.pos.distanceTo(c.target) < 3) {
        c.retarget = 7 + Math.random() * 6;
        c.target.set(c.anchor.x + (Math.random() - 0.5) * 80, 0, c.anchor.z + (Math.random() - 0.5) * 80);
        c.target.y = heightAt(c.target.x, c.target.z) + 1.5 + Math.random() * 3;
      }
      steer(c, c.target, 2.6, dt, 0.7);
      clampAboveGround(c.pos, 1);
      face(c.obj, c.vel, dt, 1);
      for (const w of c.obj.userData.wings) w.pivot.rotation.z = Math.sin(c.t * 1.8) * 0.45 * w.side;
    };
    return c;
  }

  makeDolphin(x, y, z, opts) {
    const c = this.base('dolphin', dolphinModel(), x, y, z);
    c.update = (dt) => {
      const t = c.t;
      const i = opts.i || 0;
      // pod circles a slowly moving center
      const cx = c.anchor.x + Math.sin(t * 0.05) * 40, cz = c.anchor.z + Math.cos(t * 0.04) * 30;
      c.target.set(cx + Math.cos(t * 0.35 + i * 2.1) * 12, -6 + Math.sin(t * 0.8 + i) * 4, cz + Math.sin(t * 0.35 + i * 2.1) * 12);
      steer(c, c.target, 6, dt, 1.2);
      clampAboveGround(c.pos, 2);
      face(c.obj, c.vel, dt, 2);
      c.obj.userData.tail.rotation.x = Math.sin(t * 6) * 0.35;
    };
    return c;
  }

  makeOctopus(x, y, z) {
    const colors = [0xd8643a, 0xb03a5a, 0x8a4ab0, 0xc8783a];
    const c = this.base('octopus', octopusModel(colors[Math.floor(Math.random() * colors.length)]), x, y + 0.2, z);
    c.hide = 0;
    c.home = new THREE.Vector3(x, y + 0.2, z);
    c.update = (dt, pp) => {
      const d = c.pos.distanceTo(pp);
      if (d < 6 && c.hide <= 0) {
        c.hide = 8;
        this.game.audio.play('ink', c.pos);
        this.inkPuff(c.pos);
        tmpV.subVectors(c.pos, pp).setY(0).normalize();
        c.target.copy(c.home).addScaledVector(tmpV, 5);
        c.target.y = heightAt(c.target.x, c.target.z) + 0.2;
      }
      if (c.hide > 0) {
        c.hide -= dt;
        c.pos.lerp(c.target, 1 - Math.exp(-3 * dt));
        c.obj.scale.setScalar(Math.max(0.35, c.obj.scale.x - dt * 2));
        if (c.hide <= 0) c.target.copy(c.home);
      } else {
        c.pos.lerp(c.home, 1 - Math.exp(-0.5 * dt));
        c.obj.scale.setScalar(Math.min(1, c.obj.scale.x + dt * 0.5));
      }
      for (const a of c.obj.userData.arms) {
        a.p1.rotation.z = -0.4 + Math.sin(c.t * 1.5 + a.ph) * 0.25;
        a.p2.rotation.z = -0.5 + Math.sin(c.t * 1.8 + a.ph + 1) * 0.4;
      }
      c.obj.rotation.y = Math.sin(c.t * 0.3) * 0.5;
    };
    return c;
  }

  inkPuff(pos) {
    if (!this.inkMat) this.inkMat = new THREE.MeshBasicMaterial({ color: 0x0a0a14, transparent: true, opacity: 0.7, depthWrite: false });
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), this.inkMat.clone());
    m.position.copy(pos).add(new THREE.Vector3(0, 1, 0));
    this.scene.add(m);
    this.puffs = this.puffs || [];
    this.puffs.push({ m, t: 0 });
  }

  makeJelly(x, y, z, opts) {
    const c = this.base('jelly', jellyModel(!!opts.glow), x, y, z);
    c.update = (dt, pp, interactive) => {
      const t = c.t;
      const pulse = Math.sin(t * 2.2);
      c.obj.userData.bell.scale.set(1 + pulse * 0.12, 1 - pulse * 0.15, 1 + pulse * 0.12);
      c.obj.userData.tent.rotation.y = Math.sin(t * 0.5) * 0.3;
      c.pos.set(c.anchor.x + Math.sin(t * 0.13) * 4, c.anchor.y + Math.sin(t * 0.4) * 2 + Math.max(0, pulse) * 0.2, c.anchor.z + Math.cos(t * 0.11) * 4);
      if (interactive) {
        const dx = pp.x - c.pos.x, dz = pp.z - c.pos.z, dy = pp.y - (c.pos.y - 0.8);
        if (dx * dx + dz * dz < 1.9 * 1.9 && Math.abs(dy) < 2.2) {
          if (this.game.survival.damage(10, 'sting', c.pos) && !this.jellyWarned) {
            this.jellyWarned = true;
            this.game.ui.toast('Stung by a jellyfish! (-10 O₂)', 'warn', 'Give the drifting jellies some room.');
          }
        }
      }
    };
    return c;
  }

  makeShark(x, y, z, opts) {
    const c = this.base('shark', sharkModel(), x, y, z);
    c.path = (opts.path || [[x, z]]).map(([px, pz]) => new THREE.Vector3(px, y, pz));
    c.wp = 0;
    c.state = 'patrol';
    c.timer = 0;
    c.cooldown = 0;
    c.home = c.pos.clone();
    c.update = (dt, pp, interactive) => {
      c.cooldown = Math.max(0, c.cooldown - dt);
      const d = c.pos.distanceTo(pp);
      const g = this.game;
      if (c.state === 'patrol') {
        const wp = c.path[c.wp];
        if (steer(c, wp, 3, dt, 0.8) < 4) c.wp = (c.wp + 1) % c.path.length;
        if (interactive && d < 16 && c.cooldown <= 0 && !g.base.inside) {
          c.state = 'chase';
          c.timer = 7;
          g.audio.play('shark');
          if (!this.sharkAlerted) {
            this.sharkAlerted = true;
            g.ui.toast('A shark has noticed you!', 'warn', 'Sprint away (Shift). It will lose interest.');
          }
        }
      } else if (c.state === 'chase') {
        c.timer -= dt;
        tmpV.copy(pp);
        steer(c, tmpV, 7.2, dt, 2.2);
        if (d < 2.4 && interactive) {
          g.survival.damage(18, 'bite', c.pos);
          c.state = 'retreat';
          c.timer = 5;
          c.cooldown = 10;
        } else if (c.timer <= 0 || d > 30 || g.base.inside) {
          c.state = 'retreat';
          c.timer = 4;
          c.cooldown = 8;
        }
      } else {
        c.timer -= dt;
        tmpV.subVectors(c.pos, pp).normalize().multiplyScalar(20).add(c.pos);
        steer(c, tmpV, 5, dt, 1.5);
        if (c.timer <= 0) c.state = 'patrol';
      }
      clampAboveGround(c.pos, 2.5);
      face(c.obj, c.vel, dt, 2.5);
      c.obj.userData.tail.rotation.y = Math.sin(c.t * (c.state === 'chase' ? 9 : 4)) * 0.4;
    };
    c.reset = () => { c.state = 'patrol'; c.cooldown = 6; };
    return c;
  }

  makeEel(x, y, z, opts) {
    const c = this.base('eel', eelModel(!!opts.glow), x, y, z);
    const dir = new THREE.Vector3(opts.dir ? opts.dir[0] : 1, 0, opts.dir ? opts.dir[1] : 0).normalize();
    c.dir = dir;
    c.out = 0; // 0 hidden .. 1 lunged
    c.state = 'hide';
    c.cooldown = 0;
    // a rocky hole for it to live in
    const hole = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.35, 5, 8), getMaterials().stone);
    hole.geometry.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(hole.geometry.attributes.position.count * 3).fill(0.3), 3));
    hole.position.set(x, y, z);
    hole.lookAt(x + dir.x, y, z + dir.z);
    this.scene.add(hole);
    c.update = (dt, pp, interactive) => {
      c.cooldown = Math.max(0, c.cooldown - dt);
      const d = c.anchor.distanceTo(pp);
      const g = this.game;
      if (c.state === 'hide' && d < 7 && c.cooldown <= 0 && interactive) {
        c.state = 'lunge';
        c.lungeT = 0;
        g.audio.play('eel', c.anchor);
        tmpV.subVectors(pp, c.anchor).normalize();
        c.aim = tmpV.clone();
      }
      if (c.state === 'lunge') {
        c.lungeT += dt;
        c.out = Math.min(1, c.out + dt * 3);
        const head = c.obj.userData.segs[0];
        tmpV.copy(head.position).applyMatrix4(c.obj.matrixWorld);
        if (interactive && tmpV.distanceTo(pp) < 1.8) {
          if (g.survival.damage(12, 'zap', tmpV)) {
            g.player.stun = 1.2;
            if (!this.eelWarned) {
              this.eelWarned = true;
              g.ui.toast('Zapped by an electric eel! (-12 O₂)', 'warn', 'Eels lurk in holes in walls. Keep your distance.');
            }
          }
        }
        if (c.lungeT > 1.4) { c.state = 'retract'; c.cooldown = 3.5; }
      } else if (c.state === 'retract') {
        c.out = Math.max(0, c.out - dt * 1.2);
        if (c.out <= 0) c.state = 'hide';
      } else {
        c.out = Math.max(0, Math.min(0.15, c.out + (Math.sin(c.t * 0.5) * 0.1) * dt));
      }
      const aim = c.state === 'hide' ? c.dir : (c.aim || c.dir);
      const segs = c.obj.userData.segs;
      for (let i = 0; i < segs.length; i++) {
        const k = (segs.length - i) / segs.length;
        const reach = c.out * 3.2 * k;
        segs[i].position.set(aim.x * reach + Math.sin(c.t * 8 + i) * 0.08 * c.out, aim.y * reach * 0.7, aim.z * reach + Math.cos(c.t * 8 + i) * 0.08 * c.out);
        segs[i].rotation.y = Math.atan2(aim.x, aim.z);
        segs[i].visible = reach > 0.05 || i === 0;
      }
      c.obj.userData.spark.material.opacity = c.state === 'lunge' ? 0.25 + Math.random() * 0.3 : 0;
    };
    return c;
  }

  makeAngler(x, y, z) {
    const c = this.base('angler', anglerModel(), x, y, z);
    c.update = (dt) => {
      c.retarget -= dt;
      if (c.retarget <= 0) {
        c.retarget = 10 + Math.random() * 8;
        c.target.set(c.anchor.x + (Math.random() - 0.5) * 30, 0, c.anchor.z + (Math.random() - 0.5) * 30);
        c.target.y = heightAt(c.target.x, c.target.z) + 3 + Math.random() * 8;
      }
      steer(c, c.target, 1, dt, 0.5);
      clampAboveGround(c.pos, 2);
      face(c.obj, c.vel, dt, 0.8);
      c.obj.userData.tail.rotation.y = Math.sin(c.t * 3) * 0.3;
      c.obj.userData.halo.scale.setScalar(1 + Math.sin(c.t * 2) * 0.2);
    };
    return c;
  }

  // ---------- Hooks ----------
  freeDolphin(silent) {
    this.companion.free(silent);
  }

  companionSing(pos) {
    this.companion.sing(pos);
  }

  applyState() {
    this.companion.applyState();
  }

  onRespawn() {
    for (const c of this.list) if (c.reset) c.reset();
  }

  setQuality(q) {
    this.quality = q;
    const n = FISH_PER_SCHOOL[q] || 16;
    for (const s of this.schools) s.mesh.count = n;
  }

  update(dt, pp, interactive) {
    for (const s of this.schools) this.updateSchool(s, dt, pp);
    const view = this.game.atmosphere.viewDist;
    for (const c of this.list) {
      const d = c.pos.distanceTo(pp);
      c.obj.visible = d < view;
      if (d > UPDATE_RANGE && c.type !== 'shark') continue;
      c.t += dt;
      c.update(dt, pp, interactive);
    }
    if (this.puffs) {
      for (const p of this.puffs) {
        p.t += dt;
        p.m.scale.setScalar(1 + p.t * 2);
        p.m.material.opacity = Math.max(0, 0.7 - p.t * 0.35);
      }
      this.puffs = this.puffs.filter((p) => {
        if (p.t > 2) { this.scene.remove(p.m); p.m.geometry.dispose(); p.m.material.dispose(); return false; }
        return true;
      });
    }
    this.companion.update(dt, pp, interactive);
  }
}
