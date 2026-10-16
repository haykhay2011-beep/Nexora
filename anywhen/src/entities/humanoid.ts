// Low-poly people: body variants + head accessories (hair/hat) as instanced meshes animated on the GPU.
import * as THREE from 'three';
import { MeshKit, arraysToGeometry, rgb } from '../gen/meshkit';
import { characterMaterial, type CharMaterialSet } from '../engine/materials';
import type { Outfit } from '../gen/planTypes';

// part ids: 0 torso, 1 head, 2 armL, 3 armR, 4 legL, 5 legR, 6 skirt, 7 head accessory
// slots: 0 skin, 1 primary, 2 accent, 3 hair, 4 shoes, 5 fixed colour, 6 glow (fixed colour)
export const HUMAN_PIVOTS = [
  new THREE.Vector3(0, 0.9, 0), new THREE.Vector3(0, 1.52, 0), new THREE.Vector3(0.27, 1.44, 0), new THREE.Vector3(-0.27, 1.44, 0),
  new THREE.Vector3(0.11, 0.9, 0), new THREE.Vector3(-0.11, 0.9, 0), new THREE.Vector3(0, 0.95, 0), new THREE.Vector3(0, 1.52, 0),
];

function part(k: MeshKit, p: number, slot: number) { k.curPart = p; k.curSlot = slot; }

export function buildBody(body: string, timeWalker = false): THREE.BufferGeometry {
  const k = new MeshKit();
  k.useParts = true;
  const bulky = body === 'fur';
  // legs
  for (const [p, x] of [[4, 0.11], [5, -0.11]] as const) {
    part(k, p, body === 'coat' ? 2 : 1);
    k.box(bulky ? 0.2 : 0.16, 0.8, bulky ? 0.22 : 0.18, '#ffffff', x, 0.1, 0);
    part(k, p, 4);
    k.box(bulky ? 0.21 : 0.17, 0.12, 0.26, '#ffffff', x, 0, 0.03);
  }
  // torso
  part(k, 0, 1);
  const tw = bulky ? 0.5 : 0.42, td = bulky ? 0.32 : 0.24;
  k.box(tw, 0.6, td, '#ffffff', 0, 0.88, 0);
  k.box(tw * 0.8, 0.12, td * 0.9, '#ffffff', 0, 1.42, 0);
  part(k, 0, 2);
  k.box(tw + 0.02, 0.08, td + 0.02, '#ffffff', 0, 0.98, 0); // belt / sash
  if (body === 'fur') { k.box(tw + 0.06, 0.1, td + 0.06, '#ffffff', 0, 1.36, 0); k.box(tw + 0.04, 0.1, td + 0.04, '#ffffff', 0, 0.86, 0); }
  if (body === 'future') { part(k, 0, 6); k.box(0.04, 0.5, td + 0.02, '#7af0ff', tw / 2, 0.92, 0); k.box(0.04, 0.5, td + 0.02, '#7af0ff', -tw / 2, 0.92, 0); }
  if (body === 'coat') { part(k, 0, 1); k.box(tw + 0.04, 0.42, td + 0.04, '#ffffff', 0, 0.56, 0); }
  // skirts
  if (body === 'tunic') { part(k, 6, 1); k.cyl(0.24, 0.3, 0.42, 8, '#ffffff', 0, 0.55, 0); }
  if (body === 'robe') { part(k, 6, 1); k.cyl(0.24, 0.36, 0.86, 8, '#ffffff', 0, 0.1, 0); part(k, 6, 2); k.cyl(0.365, 0.37, 0.06, 8, '#ffffff', 0, 0.1, 0); }
  if (body === 'fur') { part(k, 6, 1); k.cyl(0.28, 0.32, 0.36, 7, '#ffffff', 0, 0.56, 0); }
  // neck + head
  part(k, 1, 0);
  k.box(0.1, 0.08, 0.1, '#ffffff', 0, 1.5, 0);
  k.box(0.24, 0.27, 0.25, '#ffffff', 0, 1.56, 0);
  k.box(0.05, 0.05, 0.04, '#ffffff', 0, 1.65, 0.135); // nose
  part(k, 1, 5);
  k.box(0.04, 0.04, 0.02, '#1a1410', 0.06, 1.71, 0.126);
  k.box(0.04, 0.04, 0.02, '#1a1410', -0.06, 1.71, 0.126);
  // arms
  for (const [p, x] of [[2, 0.27], [3, -0.27]] as const) {
    part(k, p, bulky ? 2 : 1);
    k.box(bulky ? 0.14 : 0.11, 0.5, bulky ? 0.15 : 0.12, '#ffffff', x, 0.94, 0);
    part(k, p, 0);
    k.box(0.09, 0.11, 0.1, '#ffffff', x, 0.84, 0);
  }
  if (timeWalker) {
    // the Chronometer on the left wrist + a scarf
    part(k, 2, 6);
    k.box(0.13, 0.07, 0.14, '#36e0ff', 0.27, 0.96, 0);
    part(k, 0, 2);
    k.box(0.32, 0.08, 0.28, '#ffffff', 0, 1.43, 0);
    k.box(0.08, 0.32, 0.04, '#ffffff', 0.08, 1.12, -0.14);
  }
  return arraysToGeometry(k.toArrays());
}

/** hair (0 short, 1 long, 2 bun, 3 none) combined with a hat type. */
export function buildHead(hair: number, hat: string): THREE.BufferGeometry {
  const k = new MeshKit();
  k.useParts = true;
  part(k, 7, 3);
  const hy = 1.56;
  if (hair !== 3 && hat !== 'fur_hood' && hat !== 'hood' && hat !== 'wrap') {
    k.box(0.26, 0.07, 0.27, '#ffffff', 0, hy + 0.25, 0);
    k.box(0.26, 0.16, 0.06, '#ffffff', 0, hy + 0.1, -0.11);
    if (hair === 1) k.box(0.27, 0.3, 0.08, '#ffffff', 0, hy - 0.16, -0.12);
    if (hair === 2) k.sphere(0.07, 5, 4, '#ffffff', 0, hy + 0.3, -0.1);
  }
  switch (hat) {
    case 'cap': part(k, 7, 2); k.box(0.27, 0.08, 0.28, '#ffffff', 0, hy + 0.28, 0); k.box(0.22, 0.03, 0.12, '#ffffff', 0, hy + 0.28, 0.17); break;
    case 'wide_hat': part(k, 7, 2); k.cyl(0.32, 0.32, 0.03, 10, '#ffffff', 0, hy + 0.26, 0); k.cyl(0.13, 0.15, 0.14, 8, '#ffffff', 0, hy + 0.28, 0); break;
    case 'brimmed': part(k, 7, 4); k.cyl(0.24, 0.24, 0.03, 10, '#ffffff', 0, hy + 0.27, 0); k.cyl(0.14, 0.14, 0.16, 8, '#ffffff', 0, hy + 0.29, 0); break;
    case 'hood': part(k, 7, 1); k.box(0.3, 0.32, 0.3, '#ffffff', 0, hy - 0.02, -0.02); k.box(0.34, 0.12, 0.3, '#ffffff', 0, hy - 0.08, -0.05); break;
    case 'fur_hood': part(k, 7, 1); k.box(0.32, 0.33, 0.31, '#ffffff', 0, hy - 0.03, -0.02); part(k, 7, 2); k.box(0.34, 0.06, 0.06, '#ffffff', 0, hy + 0.27, 0.13); k.box(0.06, 0.3, 0.06, '#ffffff', 0.15, hy, 0.13); k.box(0.06, 0.3, 0.06, '#ffffff', -0.15, hy, 0.13); break;
    case 'wrap': part(k, 7, 2); k.box(0.28, 0.16, 0.29, '#ffffff', 0, hy + 0.2, -0.005); k.box(0.26, 0.2, 0.06, '#ffffff', 0, hy + 0.02, -0.12); break;
    case 'headband': part(k, 7, 2); k.box(0.265, 0.04, 0.275, '#ffffff', 0, hy + 0.2, 0); break;
    case 'visor': part(k, 7, 6); k.box(0.27, 0.06, 0.05, '#7af0ff', 0, hy + 0.15, 0.13); break;
  }
  return arraysToGeometry(k.toArrays());
}

// ---- instancing layer --------------------------------------------------------------------------

export interface HumanHandle { body: number; head: number; bodyKey: string; headKey: string }

class Batch {
  mesh: THREE.InstancedMesh;
  anim: THREE.InstancedBufferAttribute;
  cols: THREE.InstancedBufferAttribute[];
  free: number[] = [];
  used = 0;
  constructor(geo: THREE.BufferGeometry, mat: CharMaterialSet, cap: number, scene: THREE.Object3D, shadows: boolean) {
    this.anim = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4);
    this.anim.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aAnim', this.anim);
    this.cols = [];
    for (let i = 0; i < 5; i++) {
      const a = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
      geo.setAttribute('aC' + i, a);
      this.cols.push(a);
    }
    this.mesh = new THREE.InstancedMesh(geo, mat.mat, cap);
    this.mesh.customDepthMaterial = mat.depth;
    this.mesh.castShadow = shadows;
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    for (let i = cap - 1; i >= 0; i--) this.free.push(i);
    scene.add(this.mesh);
  }
  alloc(): number {
    const i = this.free.pop();
    if (i === undefined) return -1;
    this.used = Math.max(this.used, i + 1);
    this.mesh.count = this.used;
    return i;
  }
  release(i: number) {
    // park off-screen and hidden
    this.anim.setXYZW(i, 0, 0, 4, 0);
    this.anim.needsUpdate = true;
    this.free.push(i);
  }
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);

export class HumanoidLayer {
  private bodies = new Map<string, Batch>();
  private heads = new Map<string, Batch>();
  private mat: CharMaterialSet;
  constructor(private scene: THREE.Object3D, private cap = 80, private shadows = true, private timeWalker = false) {
    this.mat = characterMaterial('human', HUMAN_PIVOTS);
  }
  private batch(map: Map<string, Batch>, key: string, make: () => THREE.BufferGeometry): Batch {
    let b = map.get(key);
    if (!b) { b = new Batch(make(), this.mat, this.cap, this.scene, this.shadows); map.set(key, b); }
    return b;
  }
  add(o: Outfit): HumanHandle | null {
    const bodyKey = o.body, headKey = `${o.hair}|${o.hat}`;
    const b = this.batch(this.bodies, bodyKey, () => buildBody(o.body, this.timeWalker));
    const h = this.batch(this.heads, headKey, () => buildHead(o.hair, o.hat));
    const bi = b.alloc(), hi = h.alloc();
    if (bi < 0 || hi < 0) { if (bi >= 0) b.release(bi); if (hi >= 0) h.release(hi); return null; }
    for (const [batch, i] of [[b, bi], [h, hi]] as const) {
      o.colors.forEach((c, ci) => { const v = rgb(c); batch.cols[ci].setXYZ(i, v[0], v[1], v[2]); batch.cols[ci].needsUpdate = true; });
    }
    return { body: bi, head: hi, bodyKey, headKey };
  }
  setColors(hd: HumanHandle, colors: Outfit['colors']) {
    for (const [batch, i] of [[this.bodies.get(hd.bodyKey)!, hd.body], [this.heads.get(hd.headKey)!, hd.head]] as const) {
      colors.forEach((c, ci) => { const v = rgb(c); batch.cols[ci].setXYZ(i, v[0], v[1], v[2]); batch.cols[ci].needsUpdate = true; });
    }
  }
  remove(hd: HumanHandle) {
    this.bodies.get(hd.bodyKey)?.release(hd.body);
    this.heads.get(hd.headKey)?.release(hd.head);
  }
  /** heading: radians, character faces +z rotated by heading. */
  set(hd: HumanHandle, x: number, y: number, z: number, heading: number, scale: number, phase: number, amount: number, mode: number, extra: number, tilt = 0) {
    _q.setFromAxisAngle(_up, heading);
    if (tilt) _q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), tilt));
    _m.compose(_p.set(x, y, z), _q, _s.set(scale, scale, scale));
    for (const [batch, i] of [[this.bodies.get(hd.bodyKey)!, hd.body], [this.heads.get(hd.headKey)!, hd.head]] as const) {
      batch.mesh.setMatrixAt(i, _m);
      batch.anim.setXYZW(i, phase, amount, mode, extra);
    }
  }
  commit() {
    for (const b of [...this.bodies.values(), ...this.heads.values()]) { b.mesh.instanceMatrix.needsUpdate = true; b.anim.needsUpdate = true; }
  }
  dispose() {
    for (const b of [...this.bodies.values(), ...this.heads.values()]) { this.scene.remove(b.mesh); b.mesh.geometry.dispose(); b.mesh.dispose(); }
    this.bodies.clear(); this.heads.clear();
  }
}
