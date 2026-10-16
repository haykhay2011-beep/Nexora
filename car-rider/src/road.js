// Procedural squiggly road.
//
// RoadPath: an endless centerline. A seeded "bend generator" lays down coarse
// control points (S-bends that tighten as the run goes on), and a Catmull-Rom
// spline through them is resampled at uniform arc length into a ring buffer.
// Everything else in the game addresses the road as (s, d): distance along the
// centerline and signed offset to the right of it.
//
// Road: a pool of chunk meshes (asphalt, shoulders, verges, embankments,
// markings, guardrails) that are rebuilt in place as the player advances, so
// memory stays flat no matter how long the run is.
import * as THREE from 'three';
import { ROAD } from './config.js';
import { RNG } from './rng.js';

const CAP = ROAD.CAPACITY; // power of two
const MASK = CAP - 1;
const SUB = 24; // spline sub-steps per control segment

function smoothstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

export class RoadPath {
  constructor() {
    this.x = new Float64Array(CAP);
    this.z = new Float64Array(CAP);
    this.fx = new Float32Array(CAP);
    this.fz = new Float32Array(CAP);
    this.k = new Float32Array(CAP);
    this.rng = new RNG(1);
  }

  reset(seed) {
    this.rng.seed(seed);
    const r = this.rng;
    this.count = 0; // samples emitted
    this.minIndex = 0;
    // hills
    this.h1 = { a: r.range(2.2, 3.4), w: (Math.PI * 2) / r.range(380, 520), p: r.range(0, 6.28) };
    this.h2 = { a: r.range(0.8, 1.6), w: (Math.PI * 2) / r.range(150, 230), p: r.range(0, 6.28) };
    // control points (kept in a sliding window)
    this.cpx = [0, 0];
    this.cpz = [ROAD.CP_STEP, 0];
    this.cpBase = 0; // absolute index of cpx[0]
    this.heading = 0;
    this.lastSign = r.sign();
    this.bend = { k: 0, len: 120, done: 0 }; // gentle straight start
    this.cpIndex = 1;
    // fine sampler state
    this.seg = 1;
    this.since = 0;
    this.prevX = 0;
    this.prevZ = 0;
    this._emit(0, 0, 0, -1, 0, 0);
  }

  // --- elevation -----------------------------------------------------------
  height(s) {
    const env = smoothstep(150, 500, s);
    const { h1, h2 } = this;
    return env * (h1.a * (1 - Math.cos(s * h1.w + h1.p)) + h2.a * (1 - Math.cos(s * h2.w + h2.p)));
  }

  slope(s) {
    return (this.height(s + 0.5) - this.height(s - 0.5));
  }

  // --- control points ------------------------------------------------------
  _newBend() {
    const r = this.rng;
    const sGen = this.cpIndex * ROAD.CP_STEP;
    const diff = Math.min(1, sGen / 4200);
    const b = this.bend;
    b.done = 0;
    if (b.k !== 0 && r.chance(0.34 - 0.22 * diff)) {
      b.k = 0;
      b.len = Math.max(40, r.range(70, 150) * (1 - 0.45 * diff));
      return;
    }
    let sign = r.chance(0.8) ? -this.lastSign : this.lastSign;
    if (this.heading > 0.75) sign = -1;
    if (this.heading < -0.75) sign = 1;
    const radius = THREE.MathUtils.lerp(r.range(115, 190), r.range(46, 70), diff);
    let len = THREE.MathUtils.lerp(r.range(120, 190), r.range(60, 95), diff);
    // total heading change of a sine-profile bend is k*len*2/pi; keep heading bounded
    const maxTurn = 1.15 - sign * this.heading;
    const turn = (len / radius) * (2 / Math.PI);
    if (turn > maxTurn) len *= Math.max(0.3, maxTurn / turn);
    b.k = sign / radius;
    b.len = len;
    this.lastSign = sign;
  }

  _addControlPoint() {
    const b = this.bend;
    if (b.done >= b.len) this._newBend();
    const step = ROAD.CP_STEP;
    const u = Math.min(1, (b.done + step / 2) / b.len);
    const k = b.k * Math.sin(Math.PI * u);
    const mid = this.heading + (k * step) / 2;
    this.heading += k * step;
    b.done += step;
    const n = this.cpx.length;
    this.cpx.push(this.cpx[n - 1] + Math.sin(mid) * step);
    this.cpz.push(this.cpz[n - 1] - Math.cos(mid) * step);
    this.cpIndex++;
  }

  _cp(j) {
    return j - this.cpBase;
  }

  // --- fine samples ---------------------------------------------------------
  _emit(x, z, vx, vz, ax, az) {
    const i = this.count & MASK;
    const len = Math.hypot(vx, vz) || 1;
    const fx = vx / len;
    const fz = vz / len;
    this.x[i] = x;
    this.z[i] = z;
    this.fx[i] = fx;
    this.fz[i] = fz;
    // signed curvature, positive = turning right. right = (-fz, fx)
    this.k[i] = (ax * -fz + az * fx) / (len * len);
    this.count++;
  }

  _genSegment() {
    const j = this.seg;
    const a = this._cp(j - 1);
    const x0 = this.cpx[a], x1 = this.cpx[a + 1], x2 = this.cpx[a + 2], x3 = this.cpx[a + 3];
    const z0 = this.cpz[a], z1 = this.cpz[a + 1], z2 = this.cpz[a + 2], z3 = this.cpz[a + 3];
    // uniform Catmull-Rom coefficients: p(t) = c0 + c1 t + c2 t^2 + c3 t^3
    const cx1 = 0.5 * (x2 - x0), cz1 = 0.5 * (z2 - z0);
    const cx2 = 0.5 * (2 * x0 - 5 * x1 + 4 * x2 - x3), cz2 = 0.5 * (2 * z0 - 5 * z1 + 4 * z2 - z3);
    const cx3 = 0.5 * (-x0 + 3 * x1 - 3 * x2 + x3), cz3 = 0.5 * (-z0 + 3 * z1 - 3 * z2 + z3);
    const P = (t, c0, c1, c2, c3) => c0 + t * (c1 + t * (c2 + t * c3));
    const D = (t, c1, c2, c3) => c1 + t * (2 * c2 + 3 * t * c3);
    const A = (t, c2, c3) => 2 * c2 + 6 * t * c3;
    let px = this.prevX, pz = this.prevZ, pt = 0;
    for (let k = 1; k <= SUB; k++) {
      const t = k / SUB;
      const qx = P(t, x1, cx1, cx2, cx3);
      const qz = P(t, z1, cz1, cz2, cz3);
      let chord = Math.hypot(qx - px, qz - pz);
      while (this.since + chord >= ROAD.DS) {
        const need = ROAD.DS - this.since;
        const f = need / chord;
        const ex = px + (qx - px) * f;
        const ez = pz + (qz - pz) * f;
        const et = pt + (t - pt) * f;
        this._emit(ex, ez, D(et, cx1, cx2, cx3), D(et, cz1, cz2, cz3), A(et, cx2, cx3), A(et, cz2, cz3));
        px = ex; pz = ez; pt = et;
        chord -= need;
        this.since = 0;
      }
      this.since += chord;
      px = qx; pz = qz; pt = t;
    }
    this.prevX = px;
    this.prevZ = pz;
    this.seg++;
  }

  // Make sure samples exist up to distance s.
  ensure(s) {
    const need = Math.ceil(s / ROAD.DS) + 2;
    while (this.count < need) {
      while (this.cpBase + this.cpx.length < this.seg + 3) this._addControlPoint();
      this._genSegment();
    }
    // drop control points we no longer need
    const drop = this.seg - 2 - this.cpBase;
    if (drop > 8) {
      this.cpx.splice(0, drop);
      this.cpz.splice(0, drop);
      this.cpBase += drop;
    }
  }

  // Samples behind s can be recycled.
  trim(s) {
    this.minIndex = Math.max(this.minIndex, Math.floor(s / ROAD.DS));
    if (this.count - this.minIndex > CAP - 4) {
      // should never happen with sane settings; keep consistent anyway
      this.minIndex = this.count - CAP + 4;
    }
  }

  _idx(s) {
    let i = Math.floor(s / ROAD.DS);
    if (i < this.minIndex) i = this.minIndex;
    if (i > this.count - 2) {
      this.ensure(s + 50);
    }
    return i;
  }

  // Fills `out` with the road frame at distance s.
  frame(s, out) {
    const i = this._idx(s);
    const f = Math.min(1, Math.max(0, s / ROAD.DS - i));
    const a = i & MASK;
    const b = (i + 1) & MASK;
    out.x = this.x[a] + (this.x[b] - this.x[a]) * f;
    out.z = this.z[a] + (this.z[b] - this.z[a]) * f;
    let fx = this.fx[a] + (this.fx[b] - this.fx[a]) * f;
    let fz = this.fz[a] + (this.fz[b] - this.fz[a]) * f;
    const l = Math.hypot(fx, fz) || 1;
    fx /= l;
    fz /= l;
    out.fx = fx;
    out.fz = fz;
    out.rx = -fz;
    out.rz = fx;
    out.k = this.k[a] + (this.k[b] - this.k[a]) * f;
    out.y = this.height(s);
    out.slope = this.slope(s);
    out.heading = Math.atan2(fx, -fz);
    return out;
  }

  curvature(s) {
    const i = this._idx(s);
    return this.k[i & MASK];
  }

  maxCurvature(s0, s1) {
    let m = 0;
    for (let s = s0; s <= s1; s += 4) m = Math.max(m, Math.abs(this.curvature(s)));
    return m;
  }

  // World-space point at (s, d) with optional height above the road.
  point(s, d, h, out) {
    const f = this.frame(s, _tmpFrame);
    return out.set(f.x + f.rx * d, f.y + h, f.z + f.rz * d);
  }

  // Orientation that maps model space (-Z forward, +Y up, +X right) to the
  // road frame at s, including the slope.
  basis(s, outQuat, ignoreSlope = false) {
    const f = this.frame(s, _tmpFrame);
    const sl = ignoreSlope ? 0 : f.slope;
    _fwd.set(f.fx, sl, f.fz).normalize();
    _right.set(f.rx, 0, f.rz);
    _up.crossVectors(_right, _fwd).normalize();
    _back.copy(_fwd).negate();
    _mat.makeBasis(_right, _up, _back);
    return outQuat.setFromRotationMatrix(_mat);
  }

  // Minimum horizontal distance from (x,z) to the centerline within +-range of s.
  clearance(x, z, s, range = 120) {
    let best = Infinity;
    const i0 = Math.max(this.minIndex, Math.floor((s - range) / ROAD.DS));
    const i1 = Math.min(this.count - 1, Math.floor((s + range) / ROAD.DS));
    for (let i = i0; i <= i1; i += 3) {
      const a = i & MASK;
      const dx = this.x[a] - x;
      const dz = this.z[a] - z;
      const d = dx * dx + dz * dz;
      if (d < best) best = d;
    }
    return Math.sqrt(best);
  }
}

const _tmpFrame = {};
const _fwd = new THREE.Vector3();
const _right = new THREE.Vector3();
const _up = new THREE.Vector3();
const _back = new THREE.Vector3();
const _mat = new THREE.Matrix4();

// ---------------------------------------------------------------------------
// Chunk meshes

const ROW_STEP = 2;
const ROWS = ROAD.CHUNK_LEN / ROW_STEP + 1;

const C_ASPHALT = new THREE.Color(0x46484f);
const C_ASPHALT2 = new THREE.Color(0x4d4f57);
const C_SHOULDER = new THREE.Color(0x9b8f78);
const C_VERGE = new THREE.Color(0x77c24f);
const C_BANK = new THREE.Color(0x63b044);
const C_WHITE = new THREE.Color(0xf4f4ee);
const C_YELLOW = new THREE.Color(0xf6c531);
const C_RAIL = new THREE.Color(0xc8ced8);
const C_RAIL_TOP = new THREE.Color(0xe9edf2);

// Band layout: [dInner, dOuter, colour, yInner, yOuter]; mirrored for the left side
// except the asphalt which spans the centre. Embankment outer edge is dynamic.
const BANDS = [
  { a: -ROAD.HALF_WIDTH, b: ROAD.HALF_WIDTH, c: C_ASPHALT, road: true },
  { a: ROAD.HALF_WIDTH, b: ROAD.SHOULDER, c: C_SHOULDER, ya: 0, yb: -0.05 },
  { a: -ROAD.HALF_WIDTH, b: -ROAD.SHOULDER, c: C_SHOULDER, ya: 0, yb: -0.05 },
  { a: ROAD.SHOULDER, b: ROAD.VERGE, c: C_VERGE, ya: -0.05, yb: -0.12 },
  { a: -ROAD.SHOULDER, b: -ROAD.VERGE, c: C_VERGE, ya: -0.05, yb: -0.12 },
  { a: ROAD.VERGE, b: 0, c: C_BANK, bank: 1 },
  { a: -ROAD.VERGE, b: 0, c: C_BANK, bank: -1 },
];

const MAX_MARK_QUADS = 96;
const POSTS_PER_CHUNK = Math.ceil(ROAD.CHUNK_LEN / 4) * 2;

class Chunk {
  constructor(slot, groundMat, markMat, railMat) {
    this.slot = slot;
    this.index = -1;

    // ground (asphalt, shoulders, verges, embankments)
    const nv = BANDS.length * ROWS * 2;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(nv * 3), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(nv * 3), 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(nv * 3), 3));
    const idx = [];
    for (let bnd = 0; bnd < BANDS.length; bnd++) {
      const base = bnd * ROWS * 2;
      const flip = BANDS[bnd].a < 0 && !BANDS[bnd].road;
      for (let r = 0; r < ROWS - 1; r++) {
        const i0 = base + r * 2;
        // vertex order per row: inner, outer. Wind so faces point up.
        if (flip) idx.push(i0, i0 + 2, i0 + 1, i0 + 1, i0 + 2, i0 + 3);
        else idx.push(i0, i0 + 1, i0 + 2, i0 + 1, i0 + 3, i0 + 2);
      }
    }
    g.setIndex(idx);
    this.ground = new THREE.Mesh(g, groundMat);
    this.ground.matrixAutoUpdate = false;

    // markings: independent quads
    const m = new THREE.BufferGeometry();
    m.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX_MARK_QUADS * 4 * 3), 3));
    m.setAttribute('color', new THREE.BufferAttribute(new Float32Array(MAX_MARK_QUADS * 4 * 3), 3));
    const mi = [];
    for (let q = 0; q < MAX_MARK_QUADS; q++) {
      const o = q * 4;
      mi.push(o, o + 1, o + 2, o + 1, o + 3, o + 2);
    }
    m.setIndex(mi);
    this.marks = new THREE.Mesh(m, markMat);
    this.marks.matrixAutoUpdate = false;
    this.marks.renderOrder = 1;

    // guardrails: per side a front face + a top face
    const rv = 2 * 2 * ROWS * 2;
    const rg = new THREE.BufferGeometry();
    rg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(rv * 3), 3));
    rg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(rv * 3), 3));
    const ri = [];
    for (let strip = 0; strip < 4; strip++) {
      const base = strip * ROWS * 2;
      for (let r = 0; r < ROWS - 1; r++) {
        const i0 = base + r * 2;
        ri.push(i0, i0 + 2, i0 + 1, i0 + 1, i0 + 2, i0 + 3);
      }
    }
    rg.setIndex(ri);
    const rc = rg.attributes.color.array;
    for (let strip = 0; strip < 4; strip++) {
      const col = strip % 2 === 0 ? C_RAIL : C_RAIL_TOP;
      for (let v = 0; v < ROWS * 2; v++) col.toArray(rc, (strip * ROWS * 2 + v) * 3);
    }
    this.rail = new THREE.Mesh(rg, railMat);
    this.rail.matrixAutoUpdate = false;

    this.meshes = [this.ground, this.marks, this.rail];
  }
}

const _f = {};
const _q = new THREE.Quaternion();
const _v = new THREE.Vector3();
const _s1 = new THREE.Vector3(1, 1, 1);
const _m4 = new THREE.Matrix4();
const _zero = new THREE.Matrix4().makeScale(0, 0, 0);
const _col = new THREE.Color();

export class Road {
  constructor(scene) {
    this.scene = scene;
    this.path = new RoadPath();
    const groundMat = new THREE.MeshLambertMaterial({ vertexColors: true });
    const markMat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    const railMat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
    this.slots = ROAD.CHUNKS_AHEAD + ROAD.CHUNKS_BEHIND + 2;
    this.pool = [];
    this.free = [];
    this.active = new Map();
    for (let i = 0; i < this.slots; i++) {
      const c = new Chunk(i, groundMat, markMat, railMat);
      for (const m of c.meshes) {
        m.visible = false;
        scene.add(m);
      }
      this.pool.push(c);
      this.free.push(c);
    }
    // guardrail posts, instanced across all chunk slots
    const postGeo = new THREE.BoxGeometry(0.16, 0.85, 0.16);
    postGeo.translate(0, 0.42, 0);
    this.posts = new THREE.InstancedMesh(
      postGeo,
      new THREE.MeshLambertMaterial({ color: 0x8d949e }),
      this.slots * POSTS_PER_CHUNK
    );
    this.posts.frustumCulled = false;
    for (let i = 0; i < this.posts.count; i++) this.posts.setMatrixAt(i, _zero);
    scene.add(this.posts);
    this.onBuild = null; // (slot, chunkIndex) => void
    this.onRelease = null; // (slot) => void
  }

  reset(seed) {
    for (const c of this.active.values()) this._release(c);
    this.active.clear();
    this.path.reset(seed);
  }

  update(s, maxBuilds = 2) {
    const L = ROAD.CHUNK_LEN;
    let built = 0;
    const first = Math.max(0, Math.floor(s / L) - ROAD.CHUNKS_BEHIND);
    const last = Math.floor(s / L) + ROAD.CHUNKS_AHEAD;
    this.path.ensure((last + 1) * L + 4);
    for (const [idx, c] of this.active) {
      if (idx < first || idx > last) {
        this._release(c);
        this.active.delete(idx);
      }
    }
    for (let idx = first; idx <= last; idx++) {
      if (!this.active.has(idx)) {
        if (built >= maxBuilds) break;
        built++;
        const c = this.free.pop();
        if (!c) break;
        this._build(c, idx);
        this.active.set(idx, c);
      }
    }
    this.path.trim(first * L - 4);
  }

  _release(c) {
    for (const m of c.meshes) m.visible = false;
    const base = c.slot * POSTS_PER_CHUNK;
    for (let i = 0; i < POSTS_PER_CHUNK; i++) this.posts.setMatrixAt(base + i, _zero);
    this.posts.instanceMatrix.needsUpdate = true;
    if (this.onRelease) this.onRelease(c.slot);
    c.index = -1;
    this.free.push(c);
  }

  _build(c, idx) {
    const path = this.path;
    const L = ROAD.CHUNK_LEN;
    const s0 = idx * L;
    c.index = idx;
    const o = path.frame(s0, {});
    const ox = o.x, oy = o.y, oz = o.z;

    // ground bands
    const pos = c.ground.geometry.attributes.position.array;
    const col = c.ground.geometry.attributes.color.array;
    for (let r = 0; r < ROWS; r++) {
      const s = s0 + r * ROW_STEP;
      const f = path.frame(s, _f);
      const cx = f.x - ox, cy = f.y - oy, cz = f.z - oz;
      const bankH = f.y - ROAD.GROUND_Y + 0.4;
      let bankW = 3 + bankH * 2.2;
      for (let bnd = 0; bnd < BANDS.length; bnd++) {
        const B = BANDS[bnd];
        let da = B.a, db = B.b, ya = 0, yb = 0;
        if (B.road) {
          ya = yb = 0;
        } else if (B.bank) {
          let w = bankW;
          // keep the embankment from folding over itself on the inside of tight bends
          if (f.k * B.bank > 0.0001) w = Math.min(w, 0.8 / Math.abs(f.k) - ROAD.VERGE);
          w = Math.max(w, 1);
          db = B.bank * (ROAD.VERGE + w);
          ya = -0.12;
          yb = ROAD.GROUND_Y - f.y - 0.4;
        } else {
          ya = B.ya;
          yb = B.yb;
        }
        const vi = (bnd * ROWS + r) * 2;
        pos[vi * 3] = cx + f.rx * da;
        pos[vi * 3 + 1] = cy + ya;
        pos[vi * 3 + 2] = cz + f.rz * da;
        pos[vi * 3 + 3] = cx + f.rx * db;
        pos[vi * 3 + 4] = cy + yb;
        pos[vi * 3 + 5] = cz + f.rz * db;
        let c0 = B.c;
        if (B.road) c0 = ((s / 6) | 0) % 2 ? C_ASPHALT : C_ASPHALT2;
        const tint = 0.94 + 0.12 * Math.abs(Math.sin(s * 0.37 + bnd * 1.7));
        _col.copy(c0).multiplyScalar(B.road ? 1 : tint);
        _col.toArray(col, vi * 3);
        _col.toArray(col, vi * 3 + 3);
      }
    }
    const gg = c.ground.geometry;
    gg.attributes.position.needsUpdate = true;
    gg.attributes.color.needsUpdate = true;
    gg.computeVertexNormals();
    gg.computeBoundingSphere();

    // markings
    const mp = c.marks.geometry.attributes.position.array;
    const mc = c.marks.geometry.attributes.color.array;
    let q = 0;
    const quad = (sa, sb, d, w, color) => {
      if (q >= MAX_MARK_QUADS) return;
      const fa = path.frame(sa, _fa);
      const fb = path.frame(sb, _fb);
      const v = q * 4;
      const put = (k, F, dd) => {
        mp[(v + k) * 3] = F.x + F.rx * dd - ox;
        mp[(v + k) * 3 + 1] = F.y - oy + 0.02;
        mp[(v + k) * 3 + 2] = F.z + F.rz * dd - oz;
        color.toArray(mc, (v + k) * 3);
      };
      put(0, fa, d - w);
      put(1, fa, d + w);
      put(2, fb, d - w);
      put(3, fb, d + w);
      q++;
    };
    // dashed white lane dividers
    const DASH = 3, PERIOD = 9;
    let start = Math.floor(s0 / PERIOD) * PERIOD;
    for (let s = start; s < s0 + L; s += PERIOD) {
      const a = Math.max(s, s0);
      const b = Math.min(s + DASH, s0 + L);
      if (b <= a) continue;
      for (let lane = 1; lane < ROAD.LANES; lane++) {
        const d = -ROAD.HALF_WIDTH + lane * ROAD.LANE_W;
        quad(a, b, d, 0.09, C_WHITE);
      }
    }
    // solid yellow edge lines
    for (let r = 0; r < ROWS - 1; r++) {
      const a = s0 + r * ROW_STEP;
      quad(a, a + ROW_STEP, ROAD.HALF_WIDTH - 0.3, 0.1, C_YELLOW);
      quad(a, a + ROW_STEP, -ROAD.HALF_WIDTH + 0.3, 0.1, C_YELLOW);
    }
    for (let k = q * 4 * 3; k < mp.length; k++) mp[k] = 0;
    c.marks.geometry.setDrawRange(0, q * 6);
    c.marks.geometry.attributes.position.needsUpdate = true;
    c.marks.geometry.attributes.color.needsUpdate = true;
    c.marks.geometry.computeBoundingSphere();

    // guardrails
    const rp = c.rail.geometry.attributes.position.array;
    for (let r = 0; r < ROWS; r++) {
      const s = s0 + r * ROW_STEP;
      const f = path.frame(s, _f);
      const cx = f.x - ox, cy = f.y - oy, cz = f.z - oz;
      for (let side = 0; side < 2; side++) {
        const sg = side === 0 ? 1 : -1;
        const d = sg * ROAD.RAIL;
        const dOut = sg * (ROAD.RAIL + 0.14);
        // front face
        let vi = ((side * 2) * ROWS + r) * 2;
        rp[vi * 3] = cx + f.rx * d; rp[vi * 3 + 1] = cy + 0.42; rp[vi * 3 + 2] = cz + f.rz * d;
        rp[vi * 3 + 3] = cx + f.rx * d; rp[vi * 3 + 4] = cy + 0.78; rp[vi * 3 + 5] = cz + f.rz * d;
        // top face
        vi = ((side * 2 + 1) * ROWS + r) * 2;
        rp[vi * 3] = cx + f.rx * d; rp[vi * 3 + 1] = cy + 0.78; rp[vi * 3 + 2] = cz + f.rz * d;
        rp[vi * 3 + 3] = cx + f.rx * dOut; rp[vi * 3 + 4] = cy + 0.78; rp[vi * 3 + 5] = cz + f.rz * dOut;
      }
    }
    c.rail.geometry.attributes.position.needsUpdate = true;
    c.rail.geometry.computeVertexNormals();
    c.rail.geometry.computeBoundingSphere();

    // posts
    const base = c.slot * POSTS_PER_CHUNK;
    let pi = 0;
    for (let s = s0; s < s0 + L && pi < POSTS_PER_CHUNK; s += 4) {
      for (const sg of [1, -1]) {
        path.point(s, sg * (ROAD.RAIL + 0.1), 0, _v);
        path.basis(s, _q, true);
        _m4.compose(_v, _q, _s1);
        this.posts.setMatrixAt(base + pi++, _m4);
      }
    }
    for (; pi < POSTS_PER_CHUNK; pi++) this.posts.setMatrixAt(base + pi, _zero);
    this.posts.instanceMatrix.needsUpdate = true;

    for (const m of c.meshes) {
      m.position.set(ox, oy, oz);
      m.updateMatrix();
      m.visible = true;
    }
    if (this.onBuild) this.onBuild(c.slot, idx);
  }
}

const _fa = {};
const _fb = {};
