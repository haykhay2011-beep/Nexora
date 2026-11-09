import * as THREE from 'three';
import { damp } from '../core/rng.js';

// Chase camera with fov kick for boost and trauma-based screen shake.
export class CameraRig {
  constructor(camera, path) {
    this.camera = camera;
    this.path = path;
    this.frame = { x: 0, y: 0, z: 0, tx: 0, ty: 0, tz: -1, rx: 1, rz: 0, k: 0, heading: 0, pitch: 0 };
    this.frame2 = { ...this.frame };
    this.trauma = 0;
    this.baseFov = 64;
    this.fov = 64;
    this.lx = 0;
    this.pos = new THREE.Vector3();
    this.look = new THREE.Vector3();
    this.orbit = 0;
  }

  shake(amount) { this.trauma = Math.min(1, this.trauma + amount); }

  snap(player) { this.update(0, player, false, true); }

  update(dt, player, boosting, snap = false) {
    const f = this.frame;
    const back = 7.4 + Math.min(1.6, player.speed * 0.02);
    this.path.sample(player.s - back, f);
    this.lx = snap ? player.x * 0.75 : damp(this.lx, player.x * 0.75, 5, dt);
    const target = this.pos.set(f.x + f.rx * this.lx, f.y + 2.85 + player.y * 0.5, f.z + f.rz * this.lx);
    const cam = this.camera;
    if (snap) cam.position.copy(target);
    else cam.position.lerp(target, 1 - Math.exp(-12 * dt));
    const f2 = this.frame2;
    this.path.sample(player.s + 9, f2);
    this.look.set(f2.x + f2.rx * player.x * 0.85, f2.y + 0.9 + player.y * 0.4, f2.z + f2.rz * player.x * 0.85);
    cam.lookAt(this.look);
    // fov kick
    const tf = this.baseFov + Math.min(8, player.speed * 0.08) + (boosting ? 16 : 0);
    this.fov = snap ? tf : damp(this.fov, tf, boosting ? 6 : 3, dt);
    cam.fov = this.fov;
    cam.updateProjectionMatrix();
    // shake
    if (this.trauma > 0) {
      const t = this.trauma * this.trauma;
      const time = performance.now() * 0.05;
      cam.position.x += Math.sin(time * 1.3) * 0.35 * t;
      cam.position.y += Math.sin(time * 1.7 + 1) * 0.25 * t;
      cam.rotation.z += Math.sin(time * 1.1 + 2) * 0.04 * t;
      this.trauma = Math.max(0, this.trauma - dt * 1.4);
    }
  }

  // slow orbit around the car for menus
  updateMenu(dt, player) {
    this.orbit += dt * 0.18;
    const m = player.mesh.position;
    const r = 8.5;
    this.camera.position.set(m.x + Math.sin(this.orbit) * r, m.y + 2.6, m.z + Math.cos(this.orbit) * r);
    // frame the car right of centre on wide screens so the menu panel doesn't cover it
    const wide = this.camera.aspect > 1.2;
    const off = wide ? 2.6 : 0;
    const rx = Math.cos(this.orbit), rz = -Math.sin(this.orbit);
    this.camera.lookAt(m.x - rx * off, m.y + (wide ? 0.6 : -0.8), m.z - rz * off);
    this.camera.fov = 50;
    this.camera.updateProjectionMatrix();
  }
}
