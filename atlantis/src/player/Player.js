import * as THREE from 'three';
import { heightAt } from '../world/Terrain.js';
import { clamp, damp } from '../core/math.js';
import { WORLD_HALF, upgradeValue } from '../world/config.js';

const UP = new THREE.Vector3(0, 1, 0);

// First-person diver: floaty momentum-based swimming, flashlight and breathing bubbles.
export class Player {
  constructor(game) {
    this.game = game;
    this.camera = game.camera;
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.external = new THREE.Vector3(); // currents and pushes for this frame
    this.yaw = 0;
    this.pitch = 0;
    this.roll = 0;
    this.radius = 0.55;
    this.sprinting = false;
    this.moving = false;
    this.stun = 0;
    this.time = 0;
    this.breathT = 2;
    this.frozen = false;
    this.flashlightOn = false;
    this.speedNow = 0;

    this.flashlight = new THREE.SpotLight(0xfff3d8, 0, 40, 0.5, 0.55, 1.4);
    this.flashlight.position.set(0.25, -0.2, 0);
    this.flashTarget = new THREE.Object3D();
    this.flashTarget.position.set(0, -0.3, -10);
    this.camera.add(this.flashlight);
    this.camera.add(this.flashTarget);
    this.flashlight.target = this.flashTarget;
    // small fill light so close surfaces are readable in total darkness
    this.glow = new THREE.PointLight(0x9fd8ff, 0, 7, 1.5);
    this.camera.add(this.glow);
  }

  teleport(x, y, z, yaw = this.yaw) {
    this.pos.set(x, y, z);
    this.vel.set(0, 0, 0);
    this.yaw = yaw;
    this.pitch = 0;
    this.syncCamera(0);
  }

  get forward() {
    return new THREE.Vector3(-Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch));
  }

  setFlashlight(on) {
    this.flashlightOn = on;
    this.applyFlashlight();
  }

  applyFlashlight() {
    const strong = (this.game.state.upgrades.light || 0) > 0;
    const fl = this.flashlight;
    fl.intensity = this.flashlightOn ? (strong ? 260 : 70) : 0;
    fl.distance = strong ? 85 : 42;
    fl.angle = strong ? 0.6 : 0.48;
    this.glow.intensity = this.flashlightOn ? (strong ? 4 : 2) : 0;
  }

  update(dt, input, settings) {
    this.time += dt;
    const g = this.game;
    // Look
    const m = input.consumeMouse();
    if (!this.frozen) {
      const sens = 0.0022 * settings.sensitivity;
      this.yaw -= m.x * sens;
      this.pitch -= m.y * sens * (settings.invertY ? -1 : 1);
      this.pitch = clamp(this.pitch, -1.5, 1.5);
    }

    // Swim input
    const fwdIn = (input.down('KeyW') ? 1 : 0) - (input.down('KeyS') ? 1 : 0);
    const sideIn = (input.down('KeyD') ? 1 : 0) - (input.down('KeyA') ? 1 : 0);
    const upIn = (input.down('Space') ? 1 : 0) - (input.down('KeyC') || input.down('ControlLeft') || input.down('ControlRight') ? 1 : 0);
    const fwd = this.forward;
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const wish = new THREE.Vector3();
    if (!this.frozen) {
      wish.addScaledVector(fwd, fwdIn).addScaledVector(right, sideIn).addScaledVector(UP, upIn);
    }
    const hasInput = wish.lengthSq() > 0.01;
    if (hasInput) wish.normalize();
    this.moving = hasInput;
    this.sprinting = hasInput && input.down('ShiftLeft') || (hasInput && input.down('ShiftRight'));
    if (g.survival && g.survival.oxygen <= 0) this.sprinting = false;

    const fins = upgradeValue('fins', g.state.upgrades.fins || 0);
    const drag = 1.35;
    let speed = 5.2 * fins * (this.sprinting ? 1.75 : 1);
    if (this.stun > 0) { this.stun -= dt; speed *= 0.25; }
    const accel = speed * drag;
    this.vel.addScaledVector(wish, accel * dt);
    // external forces (currents) act like acceleration
    this.vel.addScaledVector(this.external, dt);
    this.external.set(0, 0, 0);
    // drag
    const k = Math.exp(-drag * dt);
    this.vel.multiplyScalar(k);
    // gentle buoyancy drift when idle
    if (!hasInput) this.vel.y += Math.sin(this.time * 0.8) * 0.05 * dt;

    this.pos.addScaledVector(this.vel, dt);

    // Collisions
    g.colliders.resolve(this.pos, this.radius, this.vel);
    const ground = heightAt(this.pos.x, this.pos.z) + this.radius + 0.35;
    if (this.pos.y < ground) {
      this.pos.y = ground;
      if (this.vel.y < 0) this.vel.y *= -0.1;
    }
    if (this.pos.y > -0.35) {
      this.pos.y = -0.35;
      if (this.vel.y > 0) this.vel.y = 0;
    }
    const lim = WORLD_HALF - 12;
    this.pos.x = clamp(this.pos.x, -lim, lim);
    this.pos.z = clamp(this.pos.z, -lim, lim);
    this.speedNow = this.vel.length();

    // Bubbles from the regulator
    this.breathT -= dt * (this.sprinting ? 1.8 : 1);
    if (this.breathT <= 0) {
      this.breathT = 3.6 + Math.random() * 0.8;
      this.exhale = true;
    }
    if (this.exhale) {
      this.exhaleT = (this.exhaleT || 0) + dt;
      if (Math.random() < dt * 30) {
        const f = this.forward;
        g.atmosphere.emitBubbles(this.pos.x + f.x * 0.6, this.pos.y - 0.1, this.pos.z + f.z * 0.6, 2, 0.3);
      }
      if (this.exhaleT > 0.9) { this.exhale = false; this.exhaleT = 0; }
    }

    this.syncCamera(dt, sideIn);
  }

  syncCamera(dt, sideIn = 0) {
    this.roll = dt ? damp(this.roll, -sideIn * 0.05 + Math.sin(this.time * 0.6) * 0.012, 3, dt) : 0;
    const bob = Math.sin(this.time * 1.1) * 0.05;
    this.camera.position.set(this.pos.x, this.pos.y + 0.25 + bob, this.pos.z);
    this.camera.rotation.set(this.pitch, this.yaw, this.roll, 'YXZ');
    this.camera.updateMatrixWorld();
  }
}
