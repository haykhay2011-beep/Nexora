import * as THREE from 'three';
import { ROAD, laneX } from '../game/config.js';
import { createRng, createNoise2D, clamp } from '../core/rng.js';
import { PROPS } from './props.js';
import { mergeParts, part } from '../core/geometry.js';

const ROWS = ROAD.samplesPerChunk + 1;
const CHUNK_LEN = ROAD.samplesPerChunk * ROAD.sampleSpacing;
// lateral terrain profile (distance from road edge), shared by both sides
const TERRAIN_X = [0, 1.2, 3.5, 7, 13, 22, 36, 56, 80];
const TCOLS = TERRAIN_X.length * 2;
const POSTS_PER_SIDE = Math.floor(ROAD.samplesPerChunk / 2);
const MAX_PROPS = 10;

function makeRoadTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const g = c.getContext('2d');
  const W = ROAD.edge * 2;
  const px = (x) => ((x + ROAD.edge) / W) * c.width;
  g.fillStyle = '#8f8c86';
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = '#3d4046';
  g.fillRect(px(-ROAD.halfWidth - 0.3), 0, px(ROAD.halfWidth + 0.3) - px(-ROAD.halfWidth - 0.3), c.height);
  // speckle for texture
  for (let i = 0; i < 2200; i++) {
    g.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.08)';
    g.fillRect(Math.random() * c.width, Math.random() * c.height, 2, 2);
  }
  // shoulder rumble stripes
  g.fillStyle = 'rgba(255,255,255,0.18)';
  for (let y = 0; y < c.height; y += 16) {
    g.fillRect(px(-ROAD.edge + 0.2), y, px(-ROAD.halfWidth - 0.5) - px(-ROAD.edge + 0.2), 6);
    g.fillRect(px(ROAD.halfWidth + 0.5), y, px(ROAD.edge - 0.2) - px(ROAD.halfWidth + 0.5), 6);
  }
  g.fillStyle = '#f4f4f0';
  const lw = (0.16 / W) * c.width;
  g.fillRect(px(-ROAD.halfWidth) - lw / 2, 0, lw, c.height);
  g.fillRect(px(ROAD.halfWidth) - lw / 2, 0, lw, c.height);
  // dashed lane dividers: texture covers 16 m, dash 6 m
  for (let l = 1; l < ROAD.lanes; l++) {
    const x = px(-ROAD.halfWidth + l * ROAD.laneWidth);
    g.fillRect(x - lw / 2, 0, lw, c.height * (6 / 16));
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function gridIndex(rows, cols) {
  const idx = [];
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const a = r * cols + c, b = a + 1, d = a + cols, e = d + 1;
      idx.push(a, b, d, b, e, d);
    }
  }
  return new THREE.BufferAttribute(new Uint16Array(idx), 1);
}

export class Road {
  constructor(scene, path) {
    this.scene = scene;
    this.path = path;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.roadMat = new THREE.MeshLambertMaterial({ map: makeRoadTexture() });
    this.terrainMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
    this.railMat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
    this.postGeo = new THREE.BoxGeometry(0.14, 0.95, 0.14);
    this.postGeo.translate(0, 0.47, 0);
    this.postMat = new THREE.MeshLambertMaterial({ color: '#9aa0a6' });
    this.propMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
    this.propGeoCache = new Map();
    this.roadIndex = gridIndex(ROWS, 2);
    this.terrainIndex = gridIndex(ROWS, TCOLS);
    this.railIndex = gridIndex(ROWS, 3);
    this.chunks = [];
    const poolSize = Math.ceil((ROAD.aheadDistance + ROAD.behindDistance) / CHUNK_LEN) + 2;
    for (let i = 0; i < poolSize; i++) this.chunks.push(this._makeChunk());
    this.frame = { x: 0, y: 0, z: 0, tx: 0, ty: 0, tz: -1, rx: 1, rz: 0, k: 0 };
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._v = new THREE.Vector3();
    this._s = new THREE.Vector3();
    this._up = new THREE.Vector3(0, 1, 0);
    this._c1 = new THREE.Color(); this._c2 = new THREE.Color(); this._c3 = new THREE.Color();
    this._buildStartGantry();
  }

  _makeChunk() {
    const mk = (verts, index, mat, uv) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts * 3), 3));
      if (uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(verts * 2), 2));
      else g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(verts * 3), 3));
      g.setIndex(index);
      const m = new THREE.Mesh(g, mat);
      m.matrixAutoUpdate = false;
      this.group.add(m);
      return m;
    };
    const road = mk(ROWS * 2, this.roadIndex, this.roadMat, true);
    road.geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(ROWS * 2 * 3), 3));
    const terrain = mk(ROWS * TCOLS, this.terrainIndex, this.terrainMat, false);
    const railL = mk(ROWS * 3, this.railIndex, this.railMat, false);
    const railR = mk(ROWS * 3, this.railIndex, this.railMat, false);
    railL.geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(ROWS * 3 * 3), 3));
    railR.geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(ROWS * 3 * 3), 3));
    const posts = new THREE.InstancedMesh(this.postGeo, this.postMat, POSTS_PER_SIDE * 2);
    posts.frustumCulled = false;
    this.group.add(posts);
    const props = [];
    for (let i = 0; i < 3; i++) {
      const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), this.propMat, MAX_PROPS);
      im.count = 0;
      im.frustumCulled = false;
      this.group.add(im);
      props.push(im);
    }
    const chunk = { index: -1, road, terrain, railL, railR, posts, props, active: false };
    this._setVisible(chunk, false);
    return chunk;
  }

  _setVisible(c, v) {
    c.road.visible = c.terrain.visible = c.railL.visible = c.railR.visible = c.posts.visible = v;
    for (const p of c.props) p.visible = v && p.count > 0;
  }

  propGeometry(type) {
    if (!this.propGeoCache.has(type)) {
      let g;
      if (type === 'rockRed') g = PROPS.rock('#b5603c', '#9c4f31');
      else if (type === 'rockGrey') g = PROPS.rock('#8d939a', '#777d84');
      else if (type === 'pineSnow') g = PROPS.pine(true);
      else g = PROPS[type]();
      this.propGeoCache.set(type, g);
    }
    return this.propGeoCache.get(type);
  }

  setDestination(dest, seed) {
    this.dest = dest;
    this.noise = createNoise2D(seed ^ 0x9e3779b9);
    this.c = {
      verge: new THREE.Color(dest.ground.verge),
      near: new THREE.Color(dest.ground.near),
      far: new THREE.Color(dest.ground.far),
    };
    for (const ch of this.chunks) {
      ch.props.forEach((im, i) => {
        const p = dest.props[i];
        if (p) im.geometry = this.propGeometry(p.type);
      });
    }
  }

  reset() {
    for (const c of this.chunks) { c.active = false; c.index = -1; this._setVisible(c, false); }
    this._placeGantry(36);
  }

  // terrain height offset (relative to road) at lateral distance d from the edge, side +-1
  _terrainY(wx, wz, d, side) {
    const t = this.dest.terrain;
    const far = side > 0 ? t.right : t.left;
    const u = clamp((d - 6) / (TERRAIN_X[TERRAIN_X.length - 1] - 6), 0, 1);
    const ditch = d < 6 ? -0.35 * Math.sin((d / 6) * Math.PI) : 0;
    const n = this.noise(wx * 0.018, wz * 0.018) * 0.7 + this.noise(wx * 0.06, wz * 0.06) * 0.3;
    return -0.06 + ditch + far * u * u + n * t.rough * u;
  }

  update(playerS, buildAll = false) {
    const first = Math.max(0, Math.floor((playerS - ROAD.behindDistance) / CHUNK_LEN));
    const last = Math.floor((playerS + ROAD.aheadDistance) / CHUNK_LEN);
    this.path.ensure((last + 1) * CHUNK_LEN + 10);
    for (const c of this.chunks) {
      if (c.active && (c.index < first || c.index > last)) { c.active = false; this._setVisible(c, false); }
    }
    for (let i = first; i <= last; i++) {
      if (this.chunks.some((c) => c.active && c.index === i)) continue;
      const c = this.chunks.find((ch) => !ch.active);
      if (!c) break;
      this._build(c, i);
      // one chunk per frame keeps frame times smooth (they are built well ahead)
      if (!buildAll && i > first + 1) break;
    }
  }

  _build(c, index) {
    c.index = index; c.active = true;
    const path = this.path, f = this.frame;
    const s0 = index * CHUNK_LEN;
    const ds = ROAD.sampleSpacing;
    const rp = c.road.geometry.attributes.position.array;
    const ruv = c.road.geometry.attributes.uv.array;
    const rn = c.road.geometry.attributes.normal.array;
    const tp = c.terrain.geometry.attributes.position.array;
    const tc = c.terrain.geometry.attributes.color.array;
    const rails = [c.railL, c.railR];
    const E = ROAD.edge;
    for (let r = 0; r < ROWS; r++) {
      const s = s0 + r * ds;
      path.sample(s, f);
      // road strip
      for (let side = 0; side < 2; side++) {
        const x = side ? E : -E;
        const o = (r * 2 + side) * 3;
        rp[o] = f.x + f.rx * x; rp[o + 1] = f.y; rp[o + 2] = f.z + f.rz * x;
        rn[o] = 0; rn[o + 1] = 1; rn[o + 2] = 0;
        ruv[(r * 2 + side) * 2] = side;
        ruv[(r * 2 + side) * 2 + 1] = s / 16;
      }
      // inner-curve clamp so the terrain ribbon never folds over itself
      const k = Math.abs(f.k);
      const innerSide = f.k > 0 ? 1 : -1;
      const maxInner = k > 1e-4 ? Math.max(14, 0.8 / k - E) : 999;
      const DMAX = TERRAIN_X[TERRAIN_X.length - 1];
      // terrain: left side from far to near, then right side near to far
      for (let col = 0; col < TCOLS; col++) {
        const side = col < TERRAIN_X.length ? -1 : 1;
        const ti = side < 0 ? TERRAIN_X.length - 1 - col : col - TERRAIN_X.length;
        let d = TERRAIN_X[ti];
        if (side === innerSide && maxInner < DMAX) {
          // monotonic squeeze of the far columns so nothing crosses the curve centre
          const h = maxInner * 0.5;
          if (d > h) d = h + (d - h) * (h / (DMAX - h));
        }
        const x = side * (E + d);
        const wx = f.x + f.rx * x, wz = f.z + f.rz * x;
        const y = f.y + this._terrainY(wx, wz, d, side);
        const o = (r * TCOLS + col) * 3;
        tp[o] = wx; tp[o + 1] = y; tp[o + 2] = wz;
        const col3 = this._c3;
        if (d < 2) col3.copy(this.c.verge);
        else col3.copy(this.c.near).lerp(this.c.far, clamp((d - 8) / 50, 0, 1));
        const shade = 0.93 + this.noise(wx * 0.11, wz * 0.11) * 0.09;
        tc[o] = col3.r * shade; tc[o + 1] = col3.g * shade; tc[o + 2] = col3.b * shade;
      }
      // guardrails (W-beam: three rows of verts)
      for (let side = 0; side < 2; side++) {
        const g = rails[side].geometry;
        const p = g.attributes.position.array, cc = g.attributes.color.array, nn = g.attributes.normal.array;
        const sgn = side ? 1 : -1;
        const x = sgn * ROAD.railOffset;
        const hs = [0.5, 0.68, 0.86];
        const cols = [0.55, 0.85, 0.62];
        for (let v = 0; v < 3; v++) {
          const o = (r * 3 + v) * 3;
          p[o] = f.x + f.rx * x; p[o + 1] = f.y + hs[v]; p[o + 2] = f.z + f.rz * x;
          cc[o] = cols[v]; cc[o + 1] = cols[v] + 0.02; cc[o + 2] = cols[v] + 0.05;
          nn[o] = -f.rx * sgn; nn[o + 1] = 0.2; nn[o + 2] = -f.rz * sgn;
        }
      }
      // posts every other sample
      if (r % 2 === 0 && r / 2 < POSTS_PER_SIDE) {
        for (let side = 0; side < 2; side++) {
          const x = (side ? 1 : -1) * ROAD.railOffset;
          this._v.set(f.x + f.rx * x, f.y, f.z + f.rz * x);
          this._q.setFromAxisAngle(this._up, -f.heading);
          this._m.compose(this._v, this._q, this._s.set(1, 1, 1));
          c.posts.setMatrixAt((r / 2) * 2 + side, this._m);
        }
      }
    }
    for (const m of [c.road, c.terrain, c.railL, c.railR]) {
      const g = m.geometry;
      for (const k in g.attributes) g.attributes[k].needsUpdate = true;
      g.computeBoundingSphere();
    }
    c.terrain.geometry.computeVertexNormals();
    c.posts.instanceMatrix.needsUpdate = true;
    this._placeProps(c, index);
    this._setVisible(c, true);
  }

  _placeProps(c, index) {
    const dest = this.dest;
    const rng = createRng((index * 2654435761) ^ 0x5bd1e995);
    const f = this.frame;
    const s0 = index * CHUNK_LEN;
    c.props.forEach((im, slot) => {
      const p = dest.props[slot];
      if (!p) { im.count = 0; return; }
      let n = 0;
      const count = Math.min(MAX_PROPS, p.count);
      for (let i = 0; i < count; i++) {
        let s, side, d;
        if (p.facing) {
          s = s0 + (i / count) * CHUNK_LEN;
          side = i % 2 ? 1 : -1;
          d = p.minX - ROAD.edge;
        } else {
          s = s0 + rng.next() * CHUNK_LEN;
          side = p.side || (rng.chance(0.5) ? 1 : -1);
          d = rng.range(p.minX, p.maxX) - ROAD.edge;
        }
        if (s < 60) continue; // keep the start line clear
        this.path.sample(s, f);
        const k = Math.abs(f.k);
        if (k > 1e-4 && side === (f.k > 0 ? 1 : -1) && d > 0.7 / k - ROAD.edge) continue;
        const x = side * (ROAD.edge + d);
        const wx = f.x + f.rx * x, wz = f.z + f.rz * x;
        const wy = f.y + this._terrainY(wx, wz, d, side);
        if (dest.water && wy < dest.water.level + 0.3) continue;
        const sc = rng.range(p.scale[0], p.scale[1]);
        this._s.set(sc, p.tall ? rng.range(2, 6) : sc, sc);
        const yaw = p.facing ? -f.heading + (side > 0 ? Math.PI : 0) : rng.range(0, Math.PI * 2);
        this._q.setFromAxisAngle(this._up, yaw);
        this._m.compose(this._v.set(wx, wy - 0.1, wz), this._q, this._s);
        im.setMatrixAt(n++, this._m);
      }
      im.count = n;
      im.instanceMatrix.needsUpdate = true;
    });
  }

  _buildStartGantry() {
    const g = mergeParts([
      part(new THREE.BoxGeometry(0.4, 6.2, 0.4), '#e9ecef', [-ROAD.edge - 0.6, 3.1, 0]),
      part(new THREE.BoxGeometry(0.4, 6.2, 0.4), '#e9ecef', [ROAD.edge + 0.6, 3.1, 0]),
      part(new THREE.BoxGeometry(ROAD.edge * 2 + 1.6, 1.3, 0.3), '#14171c', [0, 6.0, 0]),
      part(new THREE.BoxGeometry(ROAD.edge * 2 - 1, 0.18, 0.32), '#34d399', [0, 5.5, 0]),
    ]);
    // checker line painted on the road
    const parts = [];
    for (let i = 0; i < 22; i++) {
      for (let j = 0; j < 2; j++) {
        parts.push(part(new THREE.BoxGeometry(ROAD.halfWidth * 2 / 22, 0.02, 0.5), (i + j) % 2 ? '#111111' : '#f5f5f5',
          [-ROAD.halfWidth + (i + 0.5) * (ROAD.halfWidth * 2 / 22), 0.02, j * 0.5]));
      }
    }
    const line = mergeParts(parts);
    this.gantry = new THREE.Group();
    this.gantry.add(new THREE.Mesh(g, this.propMat));
    this.gantry.add(new THREE.Mesh(line, new THREE.MeshLambertMaterial({ vertexColors: true })));
    this.scene.add(this.gantry);
  }

  _placeGantry(s) {
    const f = this.frame;
    this.path.sample(s, f);
    this.gantry.position.set(f.x, f.y, f.z);
    this.gantry.rotation.set(0, -f.heading, 0);
  }

  laneX(l) { return laneX(l); }
}

export const CHUNK_LENGTH = CHUNK_LEN;
