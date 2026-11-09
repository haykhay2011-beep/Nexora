// Sky, lights, fog, endless countryside plane, distant mountains and clouds.
import * as THREE from 'three';
import { ROAD } from './config.js';
import { PartBuilder } from './models.js';
import { BIOMES, getCountry } from './countries.js';

const FOG_COLOR = 0xcfe7f4;
const TILE = 80; // metres covered by one tile of the grass texture

function grassTexture(base = '#6bb84a', shades = ['#64b043', '#73c252', '#5ea83f', '#7cc85a', '#6ab547']) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 256, 256);
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

function volcano({ radius, height, profile, snowLine, seed, scaleX = 1, haze, rockCols }) {
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
  const rock = (rockCols || [0x8d7d74, 0x735f5f, 0x5f5058]).map((c) => new THREE.Color(c));
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

// Bake simple sun shading into a flat-coloured, non-indexed geometry.
function shadeFaces(geo) {
  const col = geo.attributes.color;
  const nor = geo.attributes.normal;
  const sun = new THREE.Vector3(0.45, 0.75, 0.55).normalize();
  const n = new THREE.Vector3();
  for (let i = 0; i < col.count; i++) {
    n.set(nor.getX(i), nor.getY(i), nor.getZ(i));
    const k = 0.62 + 0.5 * Math.max(0, n.dot(sun));
    col.setXYZ(i, col.getX(i) * k, col.getY(i) * k, col.getZ(i) * k);
  }
  geo.deleteAttribute('normal');
  return geo;
}

const HAZE = 0xd6e4ee;
const baseMat = () => new THREE.MeshBasicMaterial({ vertexColors: true, fog: false });

function landmarkVolcano() {
  const group = new THREE.Group();
  const big = new THREE.Mesh(
    volcano({ radius: 300, height: 235, seed: 2.2, haze: HAZE, snowLine: 0.6, profile: [[1, 0], [0.8, 0.1], [0.55, 0.28], [0.34, 0.52], [0.2, 0.76], [0.1, 0.92], [0.05, 0.98], [0.03, 0.96], [0, 0.96]] }),
    baseMat()
  );
  big.position.set(0, -6, -720);
  const hills = new THREE.Mesh(
    volcano({ radius: 520, height: 34, seed: 7.7, haze: HAZE, snowLine: 9, scaleX: 1.6, profile: [[1, 0], [0.8, 0.35], [0.55, 0.8], [0.3, 1], [0, 1]] }),
    baseMat()
  );
  hills.position.set(0, -8, -740);
  group.add(hills, big);
  return group;
}

function landmarkAlps() {
  const group = new THREE.Group();
  const prof = [[1, 0], [0.72, 0.14], [0.46, 0.4], [0.26, 0.68], [0.11, 0.9], [0.03, 1], [0, 1]];
  const peaks = [[-480, 190, 150, 1.1], [-240, 250, 170, 2.3], [20, 290, 190, 3.7], [260, 235, 165, 4.4], [500, 185, 150, 5.8]];
  for (const [x, h, r, seed] of peaks) {
    const m = new THREE.Mesh(volcano({ radius: r, height: h, seed, haze: HAZE, snowLine: 0.42, profile: prof, rockCols: [0x8a8f98, 0x6f747e, 0x575b66] }), baseMat());
    m.position.set(x, -6, -690 - (seed % 2) * 40);
    group.add(m);
  }
  return group;
}

function landmarkPyramids() {
  const b = new PartBuilder();
  const defs = [[-60, -690, 190, 150], [190, -720, 130, 105], [-300, -710, 90, 70]];
  for (const [x, z, r, h] of defs) {
    b.cone(r, h, 4, 0xe2c27c, [x, h / 2 - 6, z], [0, Math.PI / 4, 0]);
    b.cone(r * 1.02, h * 0.18, 4, 0xf4e3b0, [x, h * 0.91 - 6, z], [0, Math.PI / 4, 0]);
  }
  b.cone(520, 30, 6, 0xd9b777, [0, 9, -760], [0, 0.3, 0]); // sandy plateau
  const g = shadeFaces(b.build());
  const group = new THREE.Group();
  group.add(new THREE.Mesh(g, baseMat()));
  return group;
}

function landmarkUluru() {
  const group = new THREE.Group();
  const m = new THREE.Mesh(
    volcano({ radius: 330, height: 78, seed: 3.1, haze: HAZE, snowLine: 9, scaleX: 1.9, profile: [[1, 0], [0.96, 0.2], [0.88, 0.45], [0.7, 0.72], [0.42, 0.92], [0.15, 1], [0, 1]], rockCols: [0xc4673a, 0xa8512f, 0x8a4128] }),
    baseMat()
  );
  m.position.set(0, -6, -640);
  group.add(m);
  return group;
}

function landmarkMesa() {
  const group = new THREE.Group();
  const prof = [[1, 0], [0.94, 0.45], [0.9, 0.9], [0.82, 1], [0, 1]];
  for (const [x, z, r, h, seed] of [[-300, -700, 190, 120, 1.2], [60, -660, 150, 90, 2.6], [330, -720, 220, 140, 4.1]]) {
    const m = new THREE.Mesh(volcano({ radius: r, height: h, seed, haze: HAZE, snowLine: 9, profile: prof, rockCols: [0xc9784a, 0xb0603a, 0x934a30] }), baseMat());
    m.position.set(x, -6, z);
    group.add(m);
  }
  return group;
}

function landmarkSkyline() {
  const b = new PartBuilder();
  const cols = [0xb8c6d4, 0x9db3c8, 0xd9e2ea, 0x8fa6bd, 0xc7d3de, 0x7f98b2];
  for (let i = 0; i < 34; i++) {
    const x = -420 + (i / 33) * 840 + Math.sin(i * 12.9898) * 14;
    const h = 40 + Math.abs(Math.sin(i * 3.7)) * 120 * (1 - Math.abs(x) / 700) + (i % 7 === 0 ? 60 : 0);
    const w = 24 + Math.abs(Math.sin(i * 5.3)) * 26;
    const z = -660 - (i % 3) * 22;
    b.box(w, h, w * 0.9, cols[i % cols.length], [x, h / 2 - 6, z]);
    if (i % 5 === 0) b.box(w * 0.5, 14, w * 0.5, 0xe8eef3, [x, h + 1, z]);
  }
  // a tall spire in the middle
  b.cone(14, 120, 6, 0xdfe7ee, [30, 232, -650]);
  b.box(30, 190, 30, 0xaec0d2, [30, 90, -650]);
  const group = new THREE.Group();
  group.add(new THREE.Mesh(shadeFaces(b.build()), baseMat()));
  return group;
}

function buildLandmark(kind) {
  switch (kind) {
    case 'ararat': return buildArarat();
    case 'volcano': return landmarkVolcano();
    case 'alps': return landmarkAlps();
    case 'pyramids': return landmarkPyramids();
    case 'uluru': return landmarkUluru();
    case 'mesa': return landmarkMesa();
    case 'skyline': return landmarkSkyline();
    default: return null;
  }
}

function disposeGroup(g) {
  g.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) o.material.dispose();
  });
}

export class Environment {
  constructor(scene) {
    this.scene = scene;
    scene.background = new THREE.Color(FOG_COLOR);
    scene.fog = new THREE.Fog(FOG_COLOR, 150, 520);

    const hemi = new THREE.HemisphereLight(0xd9efff, 0x5d7f3e, 1.55);
    this.hemi = hemi;
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff1d6, 2.1);
    sun.position.set(-0.5, 1, 0.35);
    scene.add(sun);

    // sky dome with a vertical gradient (recoloured per biome)
    const skyGeo = new THREE.SphereGeometry(1000, 24, 12);
    skyGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(skyGeo.attributes.position.count * 3), 3));
    this.skyGeo = skyGeo;
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

    this.mountains = null;
    this.landmark = null;
    this.landmarkYaw = null;
    this._dir = new THREE.Vector3();
    this.biomeKey = null;

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

  _paintSky(top, mid, hor) {
    const g = this.skyGeo;
    const sp = g.attributes.position;
    const arr = g.attributes.color.array;
    const tmp = new THREE.Color();
    const T = new THREE.Color(top), M = new THREE.Color(mid), H = new THREE.Color(hor);
    for (let i = 0; i < sp.count; i++) {
      const h = sp.getY(i) / 1000;
      if (h > 0.25) tmp.copy(M).lerp(T, Math.min(1, (h - 0.25) / 0.6));
      else tmp.copy(H).lerp(M, Math.max(0, h / 0.25));
      tmp.toArray(arr, i * 3);
    }
    g.attributes.color.needsUpdate = true;
  }

  _buildRing(ring) {
    if (this.mountains) {
      this.scene.remove(this.mountains);
      this.mountains.geometry.dispose();
      this.mountains.material.dispose();
    }
    const mb = new PartBuilder();
    const rnd = (i) => Math.abs(Math.sin(i * 91.7 + 3.3));
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * Math.PI * 2 + rnd(i) * 0.15;
      const r = 820 + rnd(i + 40) * 80;
      const h = ring.h[0] + rnd(i + 80) * (ring.h[1] - ring.h[0]);
      const rad = 110 + rnd(i + 120) * 120;
      const seg = 5 + (i % 3);
      const pos = [Math.cos(a) * r, h / 2 - 30, Math.sin(a) * r];
      mb.cone(rad, h, seg, ring.cols[i % ring.cols.length], pos, [0, rnd(i + 5) * 6, 0]);
      if (ring.snow) mb.cone(rad * 0.3, h * 0.3, seg, 0xf3f7fa, [pos[0], h - 30 - h * 0.15, pos[2]], [0, rnd(i + 5) * 6, 0]);
    }
    this.mountains = new THREE.Mesh(mb.build(), new THREE.MeshBasicMaterial({ vertexColors: true, fog: false }));
    this.scene.add(this.mountains);
  }

  // Re-skin the world for a destination: sky, haze, ground, mountains, landmark.
  setCountry(code) {
    const country = getCountry(code);
    const biome = BIOMES[country.biome];
    this.biome = biome;
    const [top, mid, hor] = biome.sky;
    this._paintSky(top, mid, hor);
    this.scene.background.set(hor);
    this.scene.fog.color.set(hor);
    this.hemi.color.set(biome.hemi[0]);
    this.hemi.groundColor.set(biome.hemi[1]);
    // ground texture
    const tex = grassTexture(biome.ground, biome.shades);
    tex.repeat.set(1800 / TILE, 1800 / TILE);
    if (this.ground.material.map) this.ground.material.map.dispose();
    this.ground.material.map = tex;
    this.ground.material.needsUpdate = true;
    this._buildRing(biome.ring);
    if (this.landmark) {
      this.scene.remove(this.landmark);
      disposeGroup(this.landmark);
      this.landmark = null;
    }
    this.landmark = buildLandmark(country.landmark);
    if (this.landmark) this.scene.add(this.landmark);
    return biome;
  }

  update(dt, camera) {
    const p = camera.position;
    this.sky.position.copy(p);
    if (this.mountains) this.mountains.position.set(p.x, 0, p.z);
    this.clouds.position.set(p.x, 0, p.z);
    // the landmark hangs ahead of the car and drifts slowly across the view in bends
    if (this.landmark) {
      camera.getWorldDirection(this._dir);
      const want = Math.atan2(-this._dir.x, -this._dir.z);
      if (this.landmarkYaw === null) this.landmarkYaw = want;
      let diff = want - this.landmarkYaw;
      diff -= Math.PI * 2 * Math.round(diff / (Math.PI * 2));
      this.landmarkYaw += diff * (1 - Math.exp(-dt * 0.35));
      this.landmark.position.set(p.x, 0, p.z);
      this.landmark.rotation.y = this.landmarkYaw;
    }
    this.clouds.rotation.y += dt * 0.004;
    this.ground.position.x = Math.round(p.x / TILE) * TILE;
    this.ground.position.z = Math.round(p.z / TILE) * TILE;
  }
}
