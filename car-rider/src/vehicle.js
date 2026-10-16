// The player's vehicle: road-relative physics + the scene object that shows it.
//
// State is expressed in road coordinates: s = distance along the centerline,
// d = offset to the right of it, yaw = heading relative to the road tangent,
// h = height above the road surface. Bends push the car outward (centrifugal
// drift) so staying on the road is an active job.
import * as THREE from 'three';
import { PHYS, POWER, ROAD } from './config.js';
import { flatMaterial, makeBlobShadow } from './models.js';
import { createVehicleObject, getVehicle } from './vehicleModels.js';

const TAU = Math.PI * 2;
const wrapPi = (a) => a - TAU * Math.floor((a + Math.PI) / TAU);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

const _qBasis = new THREE.Quaternion();
const _qYaw = new THREE.Quaternion();
const _up = new THREE.Vector3(0, 1, 0);
const _v = new THREE.Vector3();
const _w = new THREE.Vector3();
const _fwd = new THREE.Vector3();

export class Vehicle {
  constructor(scene, road, fx, skids) {
    this.scene = scene;
    this.road = road;
    this.path = road.path;
    this.fx = fx;
    this.skids = skids;
    this.hooks = { emit: () => {}, beforeCrash: () => false };

    this.holder = new THREE.Group();
    scene.add(this.holder);

    this.shadow = makeBlobShadow(2.6, 4.6);
    scene.add(this.shadow);

    this.bubble = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1, 1),
      new THREE.MeshBasicMaterial({ color: 0x66e0ff, transparent: true, opacity: 0.28, depthWrite: false })
    );
    this.bubble.visible = false;

    this.def = getVehicle('compact');
    this.obj = null;
    this.setDef(this.def);
    this.reset();
  }

  setDef(def) {
    this.def = def;
    if (this.obj) {
      this.holder.remove(this.obj.root);
      this.obj.dispose();
    }
    this.obj = createVehicleObject(def, flatMaterial);
    this.holder.add(this.obj.root);
    this.obj.root.add(this.bubble);
    const r = Math.max(def.hl * 0.95, this.obj.height * 0.7);
    this.bubble.scale.set(Math.max(def.hw * 1.5, 1.2), r * 0.85, r * 1.1);
    this.bubble.position.y = this.obj.height * 0.5;
    this.shadow.scale.set(Math.max(def.hw * 1.2, 0.9), 1, def.hl / 1.9);
    this.hw = def.hw * 0.9;
    this.hl = def.hl * 0.9;
  }

  reset(s = 0, d = 0) {
    this.s = s;
    this.d = d;
    this.yaw = 0;
    this.speed = 0;
    this.h = 0;
    this.vy = 0;
    this.grounded = true;
    this.rampVy = 0;
    this.spin = 0;
    this.spinVel = 0;
    this.spinSnap = 0;
    this.airTime = 0;
    this.alive = true;
    this.crashT = 0;
    this.crashSpin = 0;
    this.crashRoll = 0;
    this.crashLat = 0;
    this.tumble = 0;
    this.pitch = 0;
    this.lean = 0;
    this.slip = 0;
    this.skid = 0;
    this.steerV = 0;
    this.onShoulder = false;
    this.scraping = false;
    this.invuln = 0;
    this.wheelRot = 0;
    this.time = 0;
    this.susp = { x: 0, v: 0 };
    this.fxClock = 0;
    this.skidClock = 0;
    this.obj.root.visible = true;
    this.bubble.visible = false;
    this.updateVisual(0);
  }

  get speedKmh() {
    return this.speed * 3.6;
  }

  // --------------------------------------------------------------- physics
  step(dt, steer, wantHop, env) {
    this.time += dt;
    if (!this.alive) {
      this._crashStep(dt);
      return;
    }
    const D = this.def;
    if (this.invuln > 0) this.invuln -= dt;

    // speed
    let target = env.targetSpeed * D.speedMul;
    this.onShoulder = this.grounded && Math.abs(this.d) + D.hw * 0.4 > ROAD.HALF_WIDTH;
    if (this.onShoulder) target *= PHYS.SHOULDER_SPEED;
    const nitro = env.nitro > 0;
    if (nitro) target *= 1 + POWER.NITRO_BOOST;
    const acc = D.accel * (nitro ? 2.8 : 1);
    if (this.speed < target) this.speed = Math.min(target, this.speed + acc * dt);
    else this.speed = Math.max(target, this.speed - 14 * dt);

    this.steerV += (steer - this.steerV) * (1 - Math.exp(-16 * dt));

    // steering (ground) or spinning (air)
    if (this.grounded) {
      let resp = D.steerResp;
      if (this.slip > 0) {
        this.slip -= dt;
        resp *= 0.22;
      }
      const targetYaw = this.steerV * D.yawMax;
      this.yaw += (targetYaw - this.yaw) * (1 - Math.exp(-resp * dt));
      if (this.slip > 0) this.yaw += Math.sin(this.time * 12) * 0.55 * D.oil * dt;
      this.yaw = clamp(this.yaw, -PHYS.MAX_YAW, PHYS.MAX_YAW);
      const want = clamp(Math.abs(this.yaw) / Math.max(0.2, D.yawMax) - 0.55, 0, 1) * 2.2;
      this.skid += ((this.slip > 0 ? 1 : Math.min(1, want)) - this.skid) * (1 - Math.exp(-14 * dt));
    } else {
      this.spinVel += (steer * D.spin - this.spinVel) * (1 - Math.exp((steer !== 0 ? -9 : -12) * dt));
      this.spin += this.spinVel * dt;
      this.yaw *= Math.exp(-0.6 * dt);
      this.skid *= Math.exp(-10 * dt);
    }

    // motion along / across the road
    const k = this.path.curvature(this.s);
    let lat = this.speed * Math.sin(this.yaw) - k * this.speed * this.speed * PHYS.DRIFT * D.drift * (this.grounded ? 1 : 0.55);
    if (this.slip > 0) lat += Math.sin(this.time * 7.3) * 2.4 * D.oil;
    this.s += this.speed * Math.cos(this.yaw) * dt;
    this.d += lat * dt;

    // guardrail
    this.scraping = false;
    const lim = ROAD.RAIL - this.hw - 0.12;
    if (Math.abs(this.d) > lim) {
      const side = Math.sign(this.d);
      const toward = this.yaw * side;
      const crashAngle = this.grounded ? PHYS.RAIL_CRASH_ANGLE : PHYS.RAIL_CRASH_ANGLE * 0.75;
      if (toward > crashAngle && this.invuln <= 0) {
        if (this.hooks.beforeCrash('rail')) {
          this.yaw = -side * 0.35;
          this.d = side * (lim - 0.5);
          this.speed *= 0.85;
          this.invuln = 1.2;
        } else {
          this.crash('rail', side);
          return;
        }
      } else {
        this.d = side * lim;
        this.yaw += (-side * 0.04 - this.yaw) * (1 - Math.exp(-10 * dt));
        this.speed *= Math.exp(-0.7 * dt);
        this.scraping = true;
      }
    }

    // vertical
    const ground = env.groundAt(this.s, this.d);
    if (this.grounded) {
      if (wantHop) {
        this.vy = PHYS.HOP_V * D.hop;
        this.grounded = false;
        this.hooks.emit('hop');
      } else if (ground < this.h - 0.06) {
        let vy = Math.max(this.rampVy, 0);
        if (vy > 2) vy = (vy + PHYS.RAMP_BONUS) * D.ramp;
        this.vy = vy;
        this.grounded = false;
        this.hooks.emit('launch', vy);
      } else {
        const rv = (ground - this.h) / Math.max(dt, 1e-4);
        this.rampVy += (rv - this.rampVy) * 0.5;
        this.h = ground;
      }
    }
    if (!this.grounded) {
      this.vy -= PHYS.GRAVITY * dt;
      this.h += this.vy * dt;
      this.airTime += dt;
      if (this.h <= ground && this.vy < 0) this._land(ground);
    }

    // suspension spring
    const s = this.susp;
    s.v += (-130 * s.x - 9 * s.v) * dt;
    s.x += s.v * dt;

    // visuals-related smoothing
    const yawN = this.yaw / Math.max(0.2, D.yawMax);
    this.lean += (clamp(yawN, -1, 1) * 0.14 * D.lean + k * this.speed * 0.012 * D.lean - this.lean) * (1 - Math.exp(-9 * dt));
    const pitchT = this.grounded ? (nitro ? -0.04 : 0) : clamp(this.vy * 0.035, -0.4, 0.4);
    this.pitch += (pitchT - this.pitch) * (1 - Math.exp(-7 * dt));
    this.spinSnap *= Math.exp(-14 * dt);
    this.wheelRot += (this.speed * dt);
  }

  _land(ground) {
    const impact = -this.vy;
    this.grounded = true;
    this.h = ground;
    this.vy = 0;
    this.rampVy = 0;
    const spun = Math.abs(this.spin) > 0.4;
    const w = wrapPi(this.spin);
    const tricks = Math.round(Math.abs(this.spin) / TAU);
    if (spun && Math.abs(w) > 1.05) {
      const absorbed = this.invuln <= 0 ? this.hooks.beforeCrash('landing') : true;
      if (!absorbed) {
        this.spin = w;
        this.crash('landing', 0);
        return;
      }
      this.invuln = Math.max(this.invuln, 1.2);
    }
    this.spinSnap = w;
    this.spin = 0;
    this.spinVel = 0;
    this.airTime = 0;
    this.susp.v = -Math.min(impact, 16) * 0.55;
    this.hooks.emit('land', { impact, tricks: spun ? tricks : 0 });
  }

  crash(reason, side = 0) {
    if (!this.alive) return;
    this.alive = false;
    this.crashT = 0;
    const r = Math.random;
    this.crashSpin = (r() < 0.5 ? -1 : 1) * (7 + r() * 4);
    this.crashRoll = (r() < 0.5 ? -1 : 1) * (5 + r() * 4);
    this.crashLat = reason === 'rail' ? -side * 5 : (r() - 0.5) * 6;
    this.vy = Math.max(this.vy, 0) + (reason === 'landing' ? 3.5 : 6.5);
    this.grounded = false;
    this.slip = 0;
    this.skid = 0;
    this.yaw *= 0.5;
    this.hooks.emit('crash', { reason });
  }

  _crashStep(dt) {
    this.crashT += dt;
    this.speed *= Math.exp(-1.15 * dt);
    this.s += this.speed * Math.cos(this.yaw) * dt;
    this.d += (this.crashLat + this.speed * Math.sin(this.yaw)) * dt;
    this.crashLat *= Math.exp(-1.6 * dt);
    this.vy -= PHYS.GRAVITY * 1.3 * dt;
    this.h += this.vy * dt;
    if (this.h < 0) {
      this.h = 0;
      if (this.vy < -3) {
        this.vy = -this.vy * 0.36;
        this.crashSpin *= 0.6;
        this.crashRoll *= 0.6;
        this.hooks.emit('bounce', -this.vy);
      } else {
        this.vy = 0;
      }
    }
    const decay = this.h <= 0.01 ? Math.exp(-2.4 * dt) : Math.exp(-0.5 * dt);
    this.crashSpin *= decay;
    this.crashRoll *= decay;
    this.spin += this.crashSpin * dt;
    this.tumble += this.crashRoll * dt;
    const lim = ROAD.RAIL - this.hw;
    if (Math.abs(this.d) > lim) {
      this.d = Math.sign(this.d) * lim;
      this.crashLat = 0;
    }
    this.susp.x *= 0.9;
    this.wheelRot += this.speed * dt;
  }

  // ---------------------------------------------------------------- visuals
  updateVisual(dt) {
    const root = this.obj.root;
    const path = this.path;
    path.point(this.s, this.d, this.h, root.position);
    path.basis(this.s, _qBasis);
    _qYaw.setFromAxisAngle(_up, -(this.yaw + this.spin + this.spinSnap));
    root.quaternion.copy(_qBasis).multiply(_qYaw);

    const pivot = this.obj.pivot;
    pivot.position.y = this.susp.x;
    const crashed = !this.alive;
    pivot.rotation.set(
      this.pitch + (crashed ? this.tumble * 0.35 : 0),
      0,
      this.lean + (crashed ? this.tumble : 0)
    );
    const steerAng = -this.steerV * 0.45;
    for (const w of this.obj.wheels) {
      w.mesh.rotation.x = -this.wheelRot / w.r;
      if (w.front) w.holder.rotation.y = steerAng;
    }
    if (this.invuln > 0 && this.alive) root.visible = Math.floor(this.time * 18) % 2 === 0 || this.invuln > 1.1;
    else root.visible = true;

    // blob shadow stays on the road under the vehicle
    path.point(this.s, this.d, 0.05, this.shadow.position);
    this.shadow.quaternion.copy(_qBasis).multiply(_qYaw);
    this.shadow.rotateX(-Math.PI / 2);
    const fade = clamp(1 - this.h / 9, 0.15, 1);
    this.shadow.material.opacity = fade;
    root.updateMatrixWorld(true);
  }

  setShield(active, blink) {
    this.bubble.visible = active && (!blink || Math.floor(this.time * 8) % 2 === 0);
    if (this.bubble.visible) {
      const p = 1 + Math.sin(this.time * 5) * 0.03;
      this.bubble.rotation.y += 0.02;
      this.bubble.material.opacity = 0.22 + Math.sin(this.time * 6) * 0.05 * p;
    }
  }

  // Particles & skid marks. Call after updateVisual.
  emitEffects(dt, nitro) {
    const fx = this.fx;
    const root = this.obj.root;
    _fwd.set(0, 0, -1).applyQuaternion(root.quaternion);
    if (!this.alive) {
      this.fxClock -= dt;
      if (this.crashT < 2.2 && this.fxClock <= 0) {
        this.fxClock = 0.05;
        fx.smoke(root.position.x, root.position.y + 1, root.position.z, 0.8, this.crashT < 0.7 ? 0x4a4a52 : 0x9a9aa2);
      }
      return;
    }
    // exhaust flames
    if (nitro) {
      for (const e of this.obj.exhaust) {
        _v.copy(e);
        root.localToWorld(_v);
        for (let i = 0; i < 2; i++) {
          fx.flame(_v.x, _v.y, _v.z, -_fwd.x * (6 + this.speed * 0.2), 0.3, -_fwd.z * (6 + this.speed * 0.2));
        }
      }
    }
    // tyre dust / smoke / skid marks
    const wantDust = this.grounded && (this.skid > 0.35 || this.onShoulder || this.slip > 0);
    this.fxClock -= dt;
    const doSkid = this.grounded && this.skid > 0.55 && this.h < 0.1;
    this.skidClock -= dt;
    if ((wantDust && this.fxClock <= 0) || (doSkid && this.skidClock <= 0)) {
      for (const w of this.obj.wheels) {
        if (w.front && this.obj.wheels.length > 2) continue;
        w.holder.getWorldPosition(_w);
        if (wantDust && this.fxClock <= 0) {
          _v.set(_fwd.x * this.speed, 0, _fwd.z * this.speed);
          const col = this.onShoulder ? 0xb9a982 : this.slip > 0 ? 0x4a4a52 : 0xd8d8d8;
          fx.dust(_w.x, _w.y - w.r + 0.1, _w.z, _v, col);
        }
        if (doSkid && this.skidClock <= 0) {
          _w.y = root.position.y + 0.05;
          this.skids.add(_w, root.quaternion, this.speed * 0.06);
        }
      }
      if (wantDust && this.fxClock <= 0) this.fxClock = 0.045;
      if (doSkid && this.skidClock <= 0) this.skidClock = 0.04;
    }
    // sparks while grinding the rail
    if (this.scraping && Math.random() < dt * 40) {
      root.getWorldPosition(_v);
      _w.set(-_fwd.x, 0, -_fwd.z);
      fx.spark(_v.x, _v.y + 0.5, _v.z, _w);
    }
  }
}
