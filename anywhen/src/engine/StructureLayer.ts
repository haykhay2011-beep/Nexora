// Turns worker StructureResults into instanced/static meshes.
import * as THREE from 'three';
import type { StructureResult } from '../gen/structures';
import { arraysToGeometry } from '../gen/meshkit';
import { MATS } from './materials';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _c = new THREE.Color();
const _up = new THREE.Vector3(0, 1, 0);

export class StructureLayer {
  readonly root = new THREE.Group();
  constructor(res: StructureResult, shadows: boolean) {
    this.root.name = 'structures';
    for (const g of res.groups) {
      const geo = arraysToGeometry(g.arrays);
      const n = g.inst.length / 8;
      const im = new THREE.InstancedMesh(geo, g.kind === 'building' ? MATS.building : MATS.prop, n);
      for (let i = 0; i < n; i++) {
        const o = i * 8;
        _q.setFromAxisAngle(_up, g.inst[o + 3]);
        _m.compose(_p.set(g.inst[o], g.inst[o + 1], g.inst[o + 2]), _q, _s.set(g.inst[o + 4], g.inst[o + 5], g.inst[o + 6]));
        im.setMatrixAt(i, _m);
        const t = 0.9 + g.inst[o + 7] * 0.18;
        im.setColorAt(i, _c.setRGB(t, t * 0.99, t * 0.97));
      }
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
      im.computeBoundingSphere();
      im.castShadow = shadows && g.shadow;
      im.receiveShadow = true;
      this.root.add(im);
    }
    for (const st of res.statics) {
      const geo = arraysToGeometry(st.arrays);
      const mesh = new THREE.Mesh(geo, MATS.building);
      mesh.position.set(st.x, st.y, st.z);
      mesh.castShadow = shadows && st.shadow;
      mesh.receiveShadow = true;
      mesh.name = st.key;
      this.root.add(mesh);
    }
  }
  setShadows(on: boolean) {
    this.root.traverse((o) => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = on; });
  }
  destroy() {
    this.root.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) m.geometry.dispose(); });
    this.root.removeFromParent();
  }
}
