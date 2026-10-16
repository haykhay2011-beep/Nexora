// Sky, lights, fog, endless countryside plane, distant mountains and clouds.
import * as THREE from 'three';
import { ROAD } from './config.js';
import { PartBuilder } from './models.js';

const FOG_COLOR = 0xcfe7f4;
const TILE = 80; // metres covered by one tile of the grass texture

function grassTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#6bb84a';
  ctx.fillRect(0, 0, 256, 256);
  const shades = ['#64b043', '#73c252', '#5ea83f', '#7cc85a', '#6ab547'];
  // tileable patches: draw each blob with wrap-around copies
  for (let i = 0; i < 70; i++) {
    const x = Math.random() * 256, y = Math.random() * 256;
    const w = 10 + Math.random() * 46, h = 6 + Math.random() * 30;
    ctx.fillStyle = shades[i % shades.length];
    for (const ox of [-256, 0, 256]) {
      for (const oy of [-256, 0, 256]) {
        ctx.beginPath();
        ctx.ellipse(x + ox, y + oy, w, h, (i * 0.7) % Math.PI, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 4;
  return tex;
}

export class Environment {
  constructor(scene) {
    this.scene = scene;
    scene.background = new THREE.Color(FOG_COLOR);
    scene.fog = new THREE.Fog(FOG_COLOR, 150, 520);

    const hemi = new THREE.HemisphereLight(0xd9efff, 0x5d7f3e, 1.55);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff1d6, 2.1);
    sun.position.set(-0.5, 1, 0.35);
    scene.add(sun);

    // sky dome with a vertical gradient
    const skyGeo = new THREE.SphereGeometry(1000, 24, 12);
    const sp = skyGeo.attributes.position;
    const colors = new Float32Array(sp.count * 3);
    const top = new THREE.Color(0x3a8ee6);
    const mid = new THREE.Color(0x8cc6f2);
    const hor = new THREE.Color(FOG_COLOR);
    const tmp = new THREE.Color();
    for (let i = 0; i < sp.count; i++) {
      const h = sp.getY(i) / 1000;
      if (h > 0.25) tmp.copy(mid).lerp(top, Math.min(1, (h - 0.25) / 0.6));
      else tmp.copy(hor).lerp(mid, Math.max(0, h / 0.25));
      tmp.toArray(colors, i * 3);
    }
    skyGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    this.sky = new THREE.Mesh(
      skyGeo,
      new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false })
    );
    this.sky.renderOrder = -10;
    scene.add(this.sky);

    // the countryside: one big plane that follows the camera in tile steps
    const tex = grassTexture();
    const size = 1800;
    tex.repeat.set(size / TILE, size / TILE);
    this.ground = new THREE.Mesh(
      new THREE.PlaneGeometry(size, size),
      new THREE.MeshLambertMaterial({ map: tex })
    );
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.position.y = ROAD.GROUND_Y;
    scene.add(this.ground);

    // distant mountains ring (not fogged, tinted to look hazy)
    const mb = new PartBuilder();
    const mCols = [0x9cc3c9, 0x8fb9c4, 0xa9cbd0, 0x96bfbf];
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * Math.PI * 2 + Math.random() * 0.15;
      const r = 820 + Math.random() * 80;
      const h = 70 + Math.random() * 120;
      const rad = 90 + Math.random() * 110;
      mb.cone(rad, h, 5 + (i % 3), mCols[i % mCols.length], [Math.cos(a) * r, h / 2 - 30, Math.sin(a) * r], [0, Math.random(), 0]);
      if (h > 140) {
        mb.cone(rad * 0.28, h * 0.27, 5, 0xf3f7fa, [Math.cos(a) * r, h - 30 - h * 0.13, Math.sin(a) * r], [0, Math.random(), 0]);
      }
    }
    this.mountains = new THREE.Mesh(mb.build(), new THREE.MeshBasicMaterial({ vertexColors: true, fog: false }));
    scene.add(this.mountains);

    // clouds
    const cb = new PartBuilder();
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 250 + Math.random() * 450;
      const cx = Math.cos(a) * r, cz = Math.sin(a) * r, cy = 140 + Math.random() * 90;
      const n = 3 + ((Math.random() * 3) | 0);
      for (let k = 0; k < n; k++) {
        const s = 14 + Math.random() * 16;
        cb.sphere(1, 0xffffff, [cx + (k - n / 2) * s * 0.9, cy + Math.random() * 6, cz + Math.random() * 10], [s, s * 0.6, s * 0.8]);
      }
    }
    this.clouds = new THREE.Mesh(cb.build(), new THREE.MeshBasicMaterial({ vertexColors: true, fog: false }));
    scene.add(this.clouds);
  }

  update(dt, camera) {
    const p = camera.position;
    this.sky.position.copy(p);
    this.mountains.position.set(p.x, 0, p.z);
    this.clouds.position.set(p.x, 0, p.z);
    this.clouds.rotation.y += dt * 0.004;
    this.ground.position.x = Math.round(p.x / TILE) * TILE;
    this.ground.position.z = Math.round(p.z / TILE) * TILE;
  }
}
