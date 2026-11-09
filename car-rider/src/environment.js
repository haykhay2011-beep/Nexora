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


// ---------------------------------------------------------------------------
// Mount Ararat (Masis): the big snow-capped volcano with its smaller twin,
// Little Ararat (Sis), as seen across the plain from Armenia.

function ridgeNoise(a, y, seed) {
  // periodic in the angle so the seam closes
  return (
    Math.sin(a * 3 + seed + y * 5) * 0.5 +
    Math.sin(a * 7 + seed * 1.7 - y * 9) * 0.3 +
    Math.sin(a * 13 + seed * 2.3 + y * 3) * 0.2
  );
}

function volcano({ radius, height, profile, snowLine, seed, scaleX = 1, haze }) {
  const pts = profile.map(([r, h]) => new THREE.Vector2(r * radius, h * height));
  const g = new THREE.LatheGeometry(pts, 18).toNonIndexed();
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const a = Math.atan2(z, x);
    const h = y / height;
    const k = 1 + ridgeNoise(a, h, seed) * 0.09 * (0.3 + h) * (h > 0.97 ? 0 : 1);
    pos.setXYZ(i, x * k * scaleX, y + ridgeNoise(a * 2, h, seed + 4) * height * 0.012 * h, z * k);
  }
  g.computeVertexNormals();
  const colors = new Float32Array(pos.count * 3);
  const sun = new THREE.Vector3(0.45, 0.75, 0.55).normalize();
  const n = new THREE.Vector3();
  const c = new THREE.Color();
  const rock = [new THREE.Color(0x8d7d74), new THREE.Color(0x735f5f), new THREE.Color(0x5f5058)];
  const snow = new THREE.Color(0xfbfdff);
  const hazeC = new THREE.Color(haze);
  for (let t = 0; t < pos.count; t += 3) {
    const cy = (pos.getY(t) + pos.getY(t + 1) + pos.getY(t + 2)) / 3 / height;
    const ca = Math.atan2(pos.getZ(t) + pos.getZ(t + 1) + pos.getZ(t + 2), pos.getX(t) + pos.getX(t + 1) + pos.getX(t + 2));
    n.set(g.attributes.normal.getX(t), g.attributes.normal.getY(t), g.attributes.normal.getZ(t));
    const light = 0.62 + 0.5 * Math.max(0, n.dot(sun));
    const jag = ridgeNoise(ca * 2, cy * 3, seed + 9) * 0.07;
    const snowy = cy + jag > snowLine;
    if (snowy) c.copy(snow).multiplyScalar(0.8 + 0.25 * Math.max(0, n.dot(sun)));
    else {
      const m = Math.min(1, cy / (snowLine + 0.05));
      c.copy(rock[0]).lerp(rock[1], Math.min(1, m * 1.6)).lerp(rock[2], Math.max(0, m - 0.6) * 1.5).multiplyScalar(light);
      c.offsetHSL(0, 0, ridgeNoise(ca * 3, cy * 6, seed) * 0.03);
    }
    // aerial perspective: the lower slopes melt into the haze
    c.lerp(hazeC, Math.max(0, 0.55 - cy * 0.75));
    for (let k = 0; k < 3; k++) c.toArray(colors, (t + k) * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  g.deleteAttribute('normal');
  return g;
}

function buildArarat() {
  const group = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, fog: false });
  const haze = 0xd6e4ee;
  // Greater Ararat: broad, gently domed, snow from high up
  const big = new THREE.Mesh(
    volcano({
      radius: 300, height: 215, seed: 1.3, haze,
      snowLine: 0.5,
      profile: [[1, 0], [0.86, 0.07], [0.68, 0.2], [0.5, 0.38], [0.36, 0.58], [0.24, 0.78], [0.13, 0.92], [0.05, 0.99], [0, 1]],
    }),
    mat
  );
  big.position.set(120, -6, -720);
  // Little Ararat: a cleaner, steeper cone
  const small = new THREE.Mesh(
    volcano({
      radius: 190, height: 135, seed: 4.1, haze,
      snowLine: 0.74,
      profile: [[1, 0], [0.74, 0.16], [0.5, 0.4], [0.3, 0.66], [0.14, 0.88], [0.04, 0.98], [0, 1]],
    }),
    mat
  );
  small.position.set(-330, -6, -700);
  // foothills and the Ararat plain's tawny skirt
  const hills = new THREE.Mesh(
    volcano({
      radius: 520, height: 38, seed: 7.7, haze, snowLine: 9, scaleX: 1.6,
      profile: [[1, 0], [0.8, 0.35], [0.55, 0.8], [0.3, 1], [0, 1]],
    }),
    mat
  );
  hills.position.set(-100, -8, -740);
  group.add(hills, big, small);
  return group;
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
    const mCols = [0xb9a89a, 0xa89a94, 0xc3b3a2, 0x9d9a9c];
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * Math.PI * 2 + Math.random() * 0.15;
      const r = 820 + Math.random() * 80;
      const h = 28 + Math.random() * 55;
      const rad = 110 + Math.random() * 120;
      mb.cone(rad, h, 5 + (i % 3), mCols[i % mCols.length], [Math.cos(a) * r, h / 2 - 30, Math.sin(a) * r], [0, Math.random(), 0]);
    }
    this.mountains = new THREE.Mesh(mb.build(), new THREE.MeshBasicMaterial({ vertexColors: true, fog: false }));
    scene.add(this.mountains);

    // Mount Ararat and Little Ararat, always somewhere ahead
    this.ararat = buildArarat();
    this.araratYaw = null;
    this._dir = new THREE.Vector3();
    scene.add(this.ararat);

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
    // the twin peaks hang ahead of the car and drift slowly across the view in bends
    camera.getWorldDirection(this._dir);
    const want = Math.atan2(-this._dir.x, -this._dir.z);
    if (this.araratYaw === null) this.araratYaw = want;
    let diff = want - this.araratYaw;
    diff -= Math.PI * 2 * Math.round(diff / (Math.PI * 2));
    this.araratYaw += diff * (1 - Math.exp(-dt * 0.35));
    this.ararat.position.set(p.x, 0, p.z);
    this.ararat.rotation.y = this.araratYaw;
    this.clouds.rotation.y += dt * 0.004;
    this.ground.position.x = Math.round(p.x / TILE) * TILE;
    this.ground.position.z = Math.round(p.z / TILE) * TILE;
  }
}
