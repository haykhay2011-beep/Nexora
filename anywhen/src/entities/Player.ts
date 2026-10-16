// Third-person Time Walker: walking, running, jumping, ledge climbing, swimming, mounts, camera.
import * as THREE from 'three';
import type { Input } from '../engine/Input';
import type { Physics } from '../engine/Physics';
import { HumanoidLayer, type HumanHandle } from './humanoid';
import type { Outfit } from '../gen/planTypes';
import { buildAnimal } from './animalModels';
import { characterMaterial } from '../engine/materials';
import { ANIMAL_BY_ID } from '../data';
import { MeshKit } from '../gen/meshkit';
import { buildBoat } from '../gen/props';
import { MATS } from '../engine/materials';
import { AREA_HALF } from '../gen/terrain';

export type MountKind = 'none' | 'horse' | 'camel' | 'boat' | 'glider';

const R = 0.38;
const HEIGHT = 1.75;

export class Player {
  pos = new THREE.Vector3();
  vel = new THREE.Vector3();
  heading = 0;
  yaw = 0;
  pitch = -0.25;
  camDist = 6.5;
  onGround = true;
  swimming = false;
  crouching = false;
  running = false;
  climbing: { from: THREE.Vector3; to: THREE.Vector3; t: number } | null = null;
  knocked = 0;
  mount: MountKind = 'none';
  mountSpecies = 'horse';
  gravity = 22;
  moon = false;
  private phase = 0;
  private layer: HumanoidLayer;
  private handle: HumanHandle | null = null;
  private mountMesh: THREE.Object3D | null = null;
  private mountAnim: THREE.InstancedBufferAttribute | null = null;
  private mountPhase = 0;
  private boundaryWarn = 0;
  waterLevel: (x: number, z: number) => number = () => 0;
  onBoundary: (() => void) | null = null;
  onSplash: (() => void) | null = null;
  onStep: ((surface: string) => void) | null = null;
  onLand: (() => void) | null = null;
  stepAcc = 0;
  photoMode = false;
  frozen = false;

  constructor(private scene: THREE.Scene, private camera: THREE.PerspectiveCamera, outfit: Outfit) {
    this.layer = new HumanoidLayer(scene, 2, true, true);
    this.handle = this.layer.add(outfit);
  }

  setOutfit(o: Outfit) {
    if (this.handle) this.layer.remove(this.handle);
    this.layer.dispose();
    this.layer = new HumanoidLayer(this.scene, 2, true, true);
    this.handle = this.layer.add(o);
  }

  place(x: number, y: number, z: number, facing: number) {
    this.pos.set(x, y, z);
    this.vel.set(0, 0, 0);
    this.heading = facing;
    this.yaw = facing + Math.PI;
    this.climbing = null;
    this.knocked = 0;
  }

  knockDown(fromX: number, fromZ: number) {
    if (this.knocked > 0) return;
    this.dismount();
    const dx = this.pos.x - fromX, dz = this.pos.z - fromZ;
    const d = Math.hypot(dx, dz) || 1;
    this.vel.set((dx / d) * 9, 5, (dz / d) * 9);
    this.knocked = 1.8;
    this.onGround = false;
  }

  // ---------------------------------------------------------------- mounts
  setMount(kind: MountKind, species = 'horse') {
    this.dismount();
    if (kind === 'none') return;
    this.mount = kind;
    if (kind === 'horse' || kind === 'camel') {
      this.mountSpecies = species;
      const def = ANIMAL_BY_ID.get(species) ?? ANIMAL_BY_ID.get('horse')!;
      const model = buildAnimal(def);
      const mats = characterMaterial(model.kind, model.pivots);
      this.mountAnim = new THREE.InstancedBufferAttribute(new Float32Array(4), 4);
      model.geo.setAttribute('aAnim', this.mountAnim);
      const im = new THREE.InstancedMesh(model.geo, mats.mat, 1);
      im.customDepthMaterial = mats.depth;
      im.castShadow = true;
      im.frustumCulled = false;
      this.mountMesh = im;
      this.mountMesh.userData.saddle = def.body.leg + def.body.h * 0.9;
    } else if (kind === 'boat') {
      const k = new MeshKit();
      buildBoat(k, species || 'dugout');
      const m = new THREE.Mesh(k.toGeometry(), MATS.prop);
      m.castShadow = true;
      this.mountMesh = m;
      this.mountMesh.userData.saddle = 0.35;
    } else if (kind === 'glider') {
      const k = new MeshKit();
      k.curGlow = 1;
      k.boxC(0.9, 0.08, 2.4, '#36e0ff', { y: 0 });
      k.curGlow = 0;
      k.boxC(1.1, 0.12, 2.2, '#f2f6ff', { y: -0.08 });
      for (const sx of [-1, 1]) k.boxC(1.4, 0.04, 0.8, '#e8f0ff', { x: sx * 0.9, y: -0.05, z: -0.4, rz: sx * 0.15 });
      const m = new THREE.Mesh(k.toGeometry(), MATS.prop);
      this.mountMesh = m;
      this.mountMesh.userData.saddle = 0.12;
      this.vel.y = 4;
      this.onGround = false;
    }
    this.scene.add(this.mountMesh!);
  }

  dismount() {
    if (this.mountMesh) {
      this.scene.remove(this.mountMesh);
      (this.mountMesh as THREE.Mesh).geometry?.dispose();
      this.mountMesh = null;
    }
    this.mount = 'none';
  }

  // ---------------------------------------------------------------- update
  update(dt: number, input: Input, phys: Physics) {
    dt = Math.min(dt, 0.05);
    if (!this.photoMode && !this.frozen) {
      const sens = 0.0024 * input.sensitivity;
      this.yaw -= input.mouseDX * sens;
      this.pitch -= input.mouseDY * sens * (input.invertY ? -1 : 1);
      this.pitch = Math.max(-1.3, Math.min(0.6, this.pitch));
      this.camDist = Math.max(2.2, Math.min(16, this.camDist + input.wheel * 0.8));
    }
    const fwdIn = this.frozen ? 0 : (input.isDown('KeyW') || input.isDown('ArrowUp') ? 1 : 0) - (input.isDown('KeyS') || input.isDown('ArrowDown') ? 1 : 0);
    const sideIn = this.frozen ? 0 : (input.isDown('KeyD') || input.isDown('ArrowRight') ? 1 : 0) - (input.isDown('KeyA') || input.isDown('ArrowLeft') ? 1 : 0);
    this.running = input.isDown('ShiftLeft') || input.isDown('ShiftRight');
    this.crouching = (input.isDown('KeyC') || input.isDown('ControlLeft')) && this.mount === 'none' && !this.swimming;
    const jump = !this.frozen && input.wasPressed('Space');

    // camera-relative direction (camera looks along -forward where forward = (sin yaw, cos yaw) behind the player)
    const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
    const rx = -fz, rz = fx;
    let mx = fx * fwdIn + rx * sideIn, mz = fz * fwdIn + rz * sideIn;
    const ml = Math.hypot(mx, mz);
    if (ml > 0) { mx /= ml; mz /= ml; }

    if (this.knocked > 0) {
      this.knocked -= dt;
      mx = mz = 0;
    }

    // ---- climbing animation
    if (this.climbing) {
      this.climbing.t += dt / 0.7;
      const t = Math.min(1, this.climbing.t);
      const up = Math.min(1, t * 1.6), fw = Math.max(0, (t - 0.55) / 0.45);
      this.pos.set(
        this.climbing.from.x + (this.climbing.to.x - this.climbing.from.x) * fw,
        this.climbing.from.y + (this.climbing.to.y - this.climbing.from.y) * up,
        this.climbing.from.z + (this.climbing.to.z - this.climbing.from.z) * fw,
      );
      if (t >= 1) { this.climbing = null; this.vel.set(0, 0, 0); this.onGround = true; }
      this.phase += dt * 8;
      this.render(6, 1);
      this.updateCamera(phys);
      return;
    }

    const wl = this.waterLevel(this.pos.x, this.pos.z);
    const ground = phys.groundAt(this.pos.x, this.pos.z, this.pos.y + 0.6);
    const depth = wl - ground.y;
    const wasSwimming = this.swimming;
    this.swimming = this.mount !== 'boat' && this.mount !== 'glider' && depth > 1.15 && this.pos.y < wl - 0.4 && !this.moon;
    if (this.swimming && !wasSwimming) this.onSplash?.();
    if (this.swimming && (this.mount === 'horse' || this.mount === 'camel')) this.dismount();
    if (this.mount === 'boat' && depth < 0.4) this.dismount();

    // ---- speeds
    let speed = 4.3;
    if (this.mount === 'horse' || this.mount === 'camel') speed = this.running ? 15 : 7.5;
    else if (this.mount === 'boat') speed = this.running ? 11 : 6;
    else if (this.mount === 'glider') speed = this.running ? 26 : 16;
    else if (this.swimming) speed = this.running ? 4 : 2.6;
    else if (this.crouching) speed = 1.9;
    else if (this.running) speed = 8.6;

    const accel = this.onGround || this.swimming || this.mount === 'boat' || this.mount === 'glider' ? 12 : 3;
    const tvx = mx * speed, tvz = mz * speed;
    this.vel.x += (tvx - this.vel.x) * Math.min(1, accel * dt);
    this.vel.z += (tvz - this.vel.z) * Math.min(1, accel * dt);

    // ---- vertical
    if (this.mount === 'glider') {
      const asc = input.isDown('Space') ? 9 : this.crouching || input.isDown('KeyC') ? -14 : -2.2;
      this.vel.y += (asc - this.vel.y) * Math.min(1, 3 * dt);
      const maxAlt = ground.y + 90;
      if (this.pos.y > maxAlt) this.vel.y = Math.min(this.vel.y, 0);
    } else if (this.mount === 'boat') {
      this.vel.y = 0;
      this.pos.y = wl - 0.1;
    } else if (this.swimming) {
      this.vel.y += ((wl - 1.25) - this.pos.y) * 6 * dt - this.vel.y * 4 * dt;
      if (jump && depth < 2.2) { this.vel.y = 4.5; }
    } else {
      this.vel.y -= this.gravity * dt;
      if (jump && this.onGround && this.knocked <= 0) {
        this.vel.y = this.mount !== 'none' ? 7 : this.moon ? 6.5 : 7.6;
        this.onGround = false;
      }
    }

    // ---- horizontal move with collisions
    const nx = this.pos.x + this.vel.x * dt, nz = this.pos.z + this.vel.z * dt;
    const stepUp = this.mount === 'none' ? 0.55 : 0.9;
    const res = phys.move(this.pos.x, this.pos.z, nx, nz, this.pos.y, this.mount === 'none' ? R : 0.9, HEIGHT, stepUp);
    // area boundary
    const lim = AREA_HALF - 60;
    if (Math.abs(res.x) > lim || Math.abs(res.z) > lim) {
      res.x = Math.max(-lim, Math.min(lim, res.x));
      res.z = Math.max(-lim, Math.min(lim, res.z));
      if (this.boundaryWarn <= 0) { this.onBoundary?.(); this.boundaryWarn = 4; }
    }
    this.boundaryWarn -= dt;
    // ledge climbing: blocked by something we can pull ourselves onto
    if (res.hitWall && res.ledge !== null && this.mount === 'none' && !this.swimming && (jump || (!this.onGround && fwdIn > 0)) && res.ledge - this.pos.y < 3.3) {
      const to = new THREE.Vector3(this.pos.x + mx * 0.9, res.ledge, this.pos.z + mz * 0.9);
      const g2 = phys.groundAt(to.x, to.z, res.ledge + 0.2);
      if (Math.abs(g2.y - res.ledge) < 0.3 && phys.ceilingAt(to.x, to.z, res.ledge) > res.ledge + HEIGHT) {
        this.climbing = { from: this.pos.clone(), to, t: 0 };
        this.render(6, 1);
        this.updateCamera(phys);
        return;
      }
    }
    this.pos.x = res.x;
    this.pos.z = res.z;

    if (this.mount !== 'boat') {
      this.pos.y += this.vel.y * dt;
      const g = phys.groundAt(this.pos.x, this.pos.z, this.pos.y + stepUp);
      const ceiling = phys.ceilingAt(this.pos.x, this.pos.z, this.pos.y + 0.5);
      if (this.pos.y + HEIGHT > ceiling && this.vel.y > 0) { this.vel.y = 0; this.pos.y = ceiling - HEIGHT; }
      const wasGround = this.onGround;
      if (this.pos.y <= g.y + 0.02 && !this.swimming) {
        if (!wasGround && this.vel.y < -6) this.onLand?.();
        this.pos.y = g.y;
        if (this.vel.y < 0) this.vel.y = 0;
        this.onGround = true;
        if (this.mount === 'glider' && !input.isDown('Space')) this.onGround = true;
      } else if (this.onGround && !this.swimming && this.pos.y - g.y < 0.6 && this.vel.y <= 0) {
        this.pos.y = g.y; // stick to slopes and stairs
      } else this.onGround = false;
      if (this.swimming) this.onGround = false;
    }

    // ---- heading + animation
    const horiz = Math.hypot(this.vel.x, this.vel.z);
    if (horiz > 0.3) {
      const target = Math.atan2(this.vel.x, this.vel.z);
      let d = target - this.heading;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.heading += d * Math.min(1, dt * 10);
    }
    this.phase += dt * (this.swimming ? 4 : horiz * 2.2 + 0.001);
    if (this.onGround && horiz > 1 && this.mount === 'none') {
      this.stepAcc += horiz * dt;
      if (this.stepAcc > (this.running ? 1.4 : 0.9)) { this.stepAcc = 0; this.onStep?.(ground.collider ? 'stone' : 'ground'); }
    }

    let mode = 0, amt = Math.min(1, horiz / (this.running ? 6 : 4));
    if (this.knocked > 0) mode = 9;
    else if (this.mount === 'horse' || this.mount === 'camel' || this.mount === 'boat') mode = 7;
    else if (this.mount === 'glider') mode = 11;
    else if (this.swimming) { mode = 5; amt = 1; }
    else if (!this.onGround) mode = 8;
    else if (this.crouching) mode = 10;
    this.render(mode, amt);
    this.updateCamera(phys);
  }

  private render(mode: number, amt: number) {
    if (!this.handle) return;
    let y = this.pos.y;
    if (this.mountMesh) {
      const saddle = this.mountMesh.userData.saddle as number;
      const mountY = this.mount === 'glider' ? this.pos.y : this.mount === 'boat' ? this.pos.y : this.pos.y;
      if (this.mount === 'horse' || this.mount === 'camel') {
        const im = this.mountMesh as THREE.InstancedMesh;
        const m = new THREE.Matrix4().compose(new THREE.Vector3(this.pos.x, mountY, this.pos.z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.heading), new THREE.Vector3(1, 1, 1));
        im.setMatrixAt(0, m);
        im.instanceMatrix.needsUpdate = true;
        const sp = Math.hypot(this.vel.x, this.vel.z);
        this.mountPhase += sp * 0.016 * 1.6;
        this.mountAnim!.setXYZW(0, this.mountPhase, Math.min(1, sp / 6), 0, 0);
        this.mountAnim!.needsUpdate = true;
        y = mountY + saddle - 0.55;
      } else {
        this.mountMesh.position.set(this.pos.x, mountY, this.pos.z);
        this.mountMesh.rotation.set(this.mount === 'glider' ? -this.vel.y * 0.02 : 0, this.heading + (this.mount === 'boat' ? Math.PI : 0), 0);
        y = mountY + saddle;
      }
    }
    if (this.swimming) y = this.pos.y;
    this.layer.set(this.handle, this.pos.x, y, this.pos.z, this.heading, 1, this.phase, amt, mode, 0);
    this.layer.commit();
  }

  private camTarget = new THREE.Vector3();
  updateCamera(phys: Physics) {
    if (this.photoMode) return;
    const head = this.camTarget.set(this.pos.x, this.pos.y + (this.crouching ? 1.2 : 1.6) + (this.mount === 'horse' || this.mount === 'camel' ? 1.2 : 0), this.pos.z);
    let dist = this.camDist * (this.mount === 'none' ? 1 : 1.5);
    const dir = new THREE.Vector3(Math.sin(this.yaw) * Math.cos(this.pitch), -Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch));
    // pull in when terrain or a collider blocks the view
    for (let d = 0.8; d < dist; d += 0.5) {
      const p = head.clone().addScaledVector(dir, d);
      if (phys.ts.height(p.x, p.z) > p.y - 0.3 || phys.blocked(p.x, p.z, p.y - 1, 0.1)) { dist = Math.max(1.2, d - 0.4); break; }
    }
    const cam = head.clone().addScaledVector(dir, dist);
    const gh = phys.ts.height(cam.x, cam.z);
    if (cam.y < gh + 0.4) cam.y = gh + 0.4;
    const wl = this.waterLevel(cam.x, cam.z);
    if (cam.y < wl + 0.3 && !this.swimming) cam.y = wl + 0.3;
    this.camera.position.lerp(cam, 0.5);
    this.camera.lookAt(head);
  }

  get eye(): THREE.Vector3 { return new THREE.Vector3(this.pos.x, this.pos.y + 1.6, this.pos.z); }

  destroy() { this.dismount(); this.layer.dispose(); }
}
