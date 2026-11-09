import * as THREE from 'three';
import { PLAYER, ROAD } from '../game/config.js';
import { clamp, damp } from '../core/rng.js';
import { buildRoadster } from './carModel.js';

const KMH100 = 100 / 3.6;

// The player's car: arcade physics in road space (s along the road, x lateral,
// y hop height), battery, launch control, Ludicrous boost and power-ups.
export class Vehicle {
  constructor(scene, path) {
    this.path = path;
    this.mesh = buildRoadster();
    scene.add(this.mesh);
    this.frame = { x: 0, y: 0, z: 0, tx: 0, ty: 0, tz: -1, rx: 1, rz: 0, k: 0, heading: 0, pitch: 0 };
    this.events = []; // { type, ... } drained by the game each frame
    this._q = new THREE.Quaternion();
    this._e = new THREE.Euler(0, 0, 0, 'YXZ');
    this.wheelSpin = 0;
    this.applyUpgrades({});
    this.reset(30);
  }

  setPaint(hex) { this.mesh.userData.paint.color.set(hex); }

  applyUpgrades(u) {
    const lv = (id) => u[id] || 0;
    this.stats = {
      capacity: PLAYER.batteryCapacity * (1 + 0.18 * lv('battery')),
      accelMul: 1 + 0.12 * lv('motor'),
      topBonus: 2.2 * lv('motor'),
      grip: 1 + 0.16 * lv('tires'),
      brakeMul: 1 + 0.15 * lv('brakes'),
      regenMul: 1 + 0.25 * lv('brakes'),
      drainMul: 1 - 0.08 * lv('aero'),
      boostDuration: PLAYER.boostDuration * (1 + 0.14 * lv('aero')),
      lives: lv('life'),
    };
  }

  reset(s) {
    this.s = s; this.x = 0; this.y = 0; this.vy = 0;
    this.speed = 0; this.vx = 0;
    this.yaw = 0; this.roll = 0; this.pitchV = 0;
    this.battery = this.stats.capacity;
    this.flatTime = 0;
    this.boostTime = 0; this.boostMeter = 0.35;
    this.magnetTime = 0; this.shieldTime = 0;
    this.hopCooldown = 0;
    this.launchCharge = 0; this.launched = false; this.launchTimer = -1; this.launchAccelMul = 1;
    this.crashed = false; this.spin = 0; this.spinV = 0; this.crashTime = 0;
    this.invuln = 0;
    this.skid = 0;
    this.braking = false; this.brakeLevel = 0;
    this.railCooldown = 0;
    this.distance = 0;
    this.lives = this.stats.lives;
    this.events.length = 0;
    this.mesh.userData.body.rotation.set(0, 0, 0);
    this.place();
  }

  get batteryPct() { return this.battery / this.stats.capacity; }
  get grounded() { return this.y <= 0.001; }

  topSpeed(diffDistance) {
    const ramp = Math.min(1, diffDistance / PLAYER.topSpeedRamp);
    return PLAYER.baseTopSpeed + (PLAYER.maxTopSpeed - PLAYER.baseTopSpeed) * ramp + this.stats.topBonus;
  }

  // Launch control at the start line: returns true once launched.
  updatePrelaunch(dt, input) {
    if (input.launchHeld) {
      this.launchCharge = Math.min(1, this.launchCharge + dt / 0.9);
    } else if (this.launchCharge > 0.05) {
      this.launch(this.launchCharge);
    }
    this.place(dt);
    return this.launched;
  }

  launch(charge) {
    this.launched = true;
    this.launchAccelMul = 0.45 + 0.55 * charge;
    this.launchTimer = 0;
    this.events.push({ type: 'launch', charge });
  }

  startBoost() {
    this.boostTime = this.stats.boostDuration;
    this.events.push({ type: 'boost' });
  }

  update(dt, input, runDistance) {
    const st = this.stats;
    if (this.crashed) return this._updateCrash(dt);
    if (this.invuln > 0) this.invuln -= dt;
    this.hopCooldown -= dt; this.railCooldown -= dt;
    if (this.magnetTime > 0) this.magnetTime -= dt;
    if (this.shieldTime > 0) this.shieldTime -= dt;

    // --- longitudinal ---
    const flat = this.battery <= 0;
    let target = this.topSpeed(runDistance);
    let accel = PLAYER.cruiseAccel * st.accelMul;
    if (this.launchTimer >= 0) {
      this.launchTimer += dt;
      accel = Math.max(accel, PLAYER.launchAccel * this.launchAccelMul * st.accelMul * (this.speed < KMH100 ? 1 : 0.5));
      if (this.speed >= KMH100) {
        this.events.push({ type: 'zeroToHundred', time: this.launchTimer });
        this.launchTimer = -1;
      } else if (this.launchTimer > 8) this.launchTimer = -1;
    }
    if (this.boostTime > 0) {
      this.boostTime -= dt;
      target *= PLAYER.boostSpeedMul;
      accel = PLAYER.boostAccel * st.accelMul;
    }
    if (flat) { target = PLAYER.crawlSpeed; this.flatTime += dt; } else this.flatTime = 0;

    this.braking = input.brake && this.launched;
    if (this.braking) {
      this.brakeLevel = input.brakeTaps;
      const power = [1, 1, 1.5, 2.1][this.brakeLevel] || 1;
      const dec = PLAYER.brakeDecel * st.brakeMul * power;
      const before = this.speed;
      this.speed = Math.max(PLAYER.minSpeed * (flat ? 0.5 : 1), this.speed - dec * dt);
      // regenerative braking puts energy back in the pack
      const regen = PLAYER.regenRate * st.regenMul * power * Math.min(1, before / 30) * dt;
      if (before > PLAYER.minSpeed + 0.5) this.battery = Math.min(st.capacity, this.battery + regen * st.capacity / 100);
    } else {
      this.brakeLevel = 0;
      if (this.speed < target) this.speed = Math.min(target, this.speed + accel * dt);
      else this.speed = Math.max(target, this.speed - (flat ? 6 : 3.5) * dt);
    }

    // --- battery drain ---
    const dist = this.speed * dt;
    if (!this.braking) {
      const drain = PLAYER.drainPerMeter * (0.35 + 0.65 * this.speed / 40) * st.drainMul * (this.boostTime > 0 ? 2 : 1);
      // drain is in absolute units, so a bigger pack (Battery upgrade) lasts longer
      this.battery = Math.max(0, this.battery - dist * drain);
    }
    if (this.battery <= 0 && !flat) this.events.push({ type: 'flat' });

    // --- lateral ---
    this.path.sample(this.s, this.frame);
    const k = this.frame.k;
    const steer = input.steer;
    const sp = clamp(this.speed / 40, 0.4, 1.3);
    const targetVx = steer * PLAYER.steerSpeed * (0.7 + 0.3 * sp) * (1 + 0.05 * (st.grip - 1) / 0.16);
    const resp = PLAYER.steerResponse * st.grip * (this.grounded ? 1 : 0.35);
    this.vx = damp(this.vx, targetVx, resp, dt);
    const centrifugal = -k * this.speed * this.speed * 0.9 / st.grip;
    if (this.grounded) this.vx += centrifugal * dt;
    this.x += this.vx * dt;

    // skidding: hard steering at speed, heavy curve load or hard braking
    const load = Math.abs(centrifugal) / 16 + (Math.abs(steer) > 0.7 && this.speed > 30 ? Math.abs(this.vx) / 12 + Math.abs(targetVx - this.vx) / 30 : 0)
      + (this.braking && this.brakeLevel >= 2 && this.speed > 25 ? 0.8 : 0);
    this.skid = this.grounded ? clamp((load - 0.55) * 1.6, 0, 1) : 0;

    // guardrails
    const lim = ROAD.railOffset - PLAYER.halfWidth - 0.15;
    if (Math.abs(this.x) > lim) {
      const side = Math.sign(this.x);
      this.x = side * lim;
      if (this.vx * side > 0) this.vx = -this.vx * 0.35;
      if (this.railCooldown <= 0) {
        this.speed *= 0.93;
        this.railCooldown = 0.35;
        this.events.push({ type: 'rail', side });
      }
      this.skid = Math.max(this.skid, 0.6);
    }

    // --- hop ---
    if (input.takeHop() && this.grounded && this.hopCooldown <= 0 && this.launched) {
      this.vy = PLAYER.hopVelocity;
      this.hopCooldown = PLAYER.hopCooldown;
      this.events.push({ type: 'hop' });
    }
    if (!this.grounded || this.vy > 0) {
      this.y += this.vy * dt;
      this.vy -= PLAYER.gravity * dt;
      if (this.y <= 0) { this.y = 0; this.vy = 0; this.events.push({ type: 'land' }); }
    }

    this.s += dist;
    this.distance += dist;
    this.place(dt);
  }

  crash(lateralDir) {
    this.crashed = true;
    this.crashTime = 0;
    this.spinV = (lateralDir >= 0 ? 1 : -1) * (9 + this.speed * 0.12);
    this.slideVx = lateralDir * 4 + this.vx * 0.5;
    this.boostTime = 0;
  }

  _updateCrash(dt) {
    this.crashTime += dt;
    this.speed *= Math.exp(-2.6 * dt);
    this.spinV *= Math.exp(-1.6 * dt);
    this.spin += this.spinV * dt;
    this.slideVx *= Math.exp(-2 * dt);
    this.x = clamp(this.x + this.slideVx * dt, -ROAD.railOffset + 1.2, ROAD.railOffset - 1.2);
    if (this.y > 0 || this.vy > 0) { this.y = Math.max(0, this.y + this.vy * dt); this.vy -= PLAYER.gravity * dt; }
    this.s += this.speed * dt;
    this.place(dt);
  }

  // Revive after a crash when an extra life is available.
  revive() {
    this.crashed = false;
    this.spin = 0; this.spinV = 0;
    this.x = 0; this.vx = 0; this.y = 0; this.vy = 0;
    this.speed = Math.max(this.speed, 22);
    this.invuln = 2.5;
    this.mesh.userData.body.rotation.set(0, 0, 0);
  }

  place(dt = 0) {
    const f = this.frame;
    this.path.sample(this.s, f);
    const m = this.mesh;
    m.position.set(f.x + f.rx * this.x, f.y + this.y, f.z + f.rz * this.x);
    const slip = this.speed > 1 ? Math.atan2(this.vx, this.speed) : 0;
    const targetYaw = slip * 1.2 + this.skid * Math.sign(this.vx) * 0.12;
    this.yaw = dt ? damp(this.yaw, targetYaw, 10, dt) : targetYaw;
    const targetRoll = clamp(-this.vx * 0.012 - this.frame.k * this.speed * this.speed * 0.0009, -0.09, 0.09);
    this.roll = dt ? damp(this.roll, targetRoll, 6, dt) : 0;
    const airPitch = this.y > 0 ? clamp(this.vy * 0.025, -0.15, 0.15) : 0;
    const brakeDive = this.braking ? 0.025 : 0;
    this.pitchV = dt ? damp(this.pitchV, airPitch - brakeDive, 8, dt) : 0;
    this._e.set(f.pitch + this.pitchV, -f.heading - this.yaw - this.spin, this.roll, 'YXZ');
    m.quaternion.setFromEuler(this._e);
    // wheels
    this.wheelSpin -= (this.speed * dt) / 0.36;
    const steerAngle = clamp(this.vx * 0.04, -0.4, 0.4);
    for (const w of m.userData.wheels) {
      w.spin.rotation.x = this.wheelSpin;
      if (w.front) w.pivot.rotation.y = -steerAngle;
    }
    const sh = m.userData.shadow;
    sh.position.y = 0.03 - this.y;
    sh.material.opacity = clamp(1 - this.y * 0.35, 0.2, 1);
    m.userData.tailMat.color.setHex(this.braking ? 0xff5566 : 0xd0101e);
    m.visible = this.invuln > 0 ? Math.floor(this.invuln * 12) % 2 === 0 : true;
  }
}
