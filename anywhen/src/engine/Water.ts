// Sea/lake/river surface (follows the player) plus extra water rectangles (moats, upper rivers).
import * as THREE from 'three';
import { GLOBAL } from './materials';
import type { WaterRect } from '../gen/landmarks';

export function waterColor(biome: string, temp: number, eraId: string): THREE.Color {
  if (eraId === 'farfuture') return new THREE.Color('#3ab8d8');
  if (biome === 'ice' || temp < 2) return new THREE.Color('#3a6a8a');
  if (temp > 22) return new THREE.Color('#2aa0b8');
  if (biome === 'wetland' || biome === 'rainforest') return new THREE.Color('#4a7a5a');
  return new THREE.Color('#2f7aa0');
}

export class Water {
  readonly root = new THREE.Group();
  private main: THREE.Mesh;
  private mat: THREE.MeshPhongMaterial;
  constructor(color: THREE.Color, extra: WaterRect[]) {
    this.mat = new THREE.MeshPhongMaterial({ color, transparent: true, opacity: 0.84, shininess: 90, specular: new THREE.Color('#c8e0f0'), flatShading: true, depthWrite: false });
    this.mat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = GLOBAL.uTime;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          vec4 wp = modelMatrix * vec4(transformed, 1.0);
          transformed.y += sin(wp.x * 0.09 + uTime * 1.1) * 0.18 + cos(wp.z * 0.11 + uTime * 0.9) * 0.15 + sin((wp.x + wp.z) * 0.03 + uTime * 0.5) * 0.25;`);
    };
    this.mat.customProgramCacheKey = () => 'water';
    const geo = new THREE.PlaneGeometry(2400, 2400, 120, 120);
    geo.rotateX(-Math.PI / 2);
    this.main = new THREE.Mesh(geo, this.mat);
    this.main.renderOrder = 2;
    this.main.frustumCulled = false;
    this.root.add(this.main);
    for (const w of extra) {
      const g = new THREE.PlaneGeometry(w.w, w.d, Math.max(1, Math.round(w.w / 20)), Math.max(1, Math.round(w.d / 20)));
      g.rotateX(-Math.PI / 2);
      const m = new THREE.Mesh(g, this.mat);
      m.position.set(w.x, w.y, w.z);
      m.rotation.y = -w.rot;
      m.renderOrder = 2;
      this.root.add(m);
    }
  }
  update(px: number, pz: number) {
    this.main.position.set(Math.round(px / 20) * 20, 0, Math.round(pz / 20) * 20);
  }
  destroy() { this.root.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) m.geometry.dispose(); }); this.mat.dispose(); this.root.removeFromParent(); }
}
