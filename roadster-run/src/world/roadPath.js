import { ROAD, difficultyAt } from '../game/config.js';
import { createRng } from '../core/rng.js';

// Endless road centreline: seeded control points joined by a Catmull-Rom spline,
// resampled at a uniform arc-length spacing into a ring buffer. Every query is
// O(1): index = floor(s / spacing).
export class RoadPath {
  constructor() {
    const n = ROAD.ringSize;
    this.px = new Float64Array(n); this.py = new Float64Array(n); this.pz = new Float64Array(n);
    this.tx = new Float32Array(n); this.ty = new Float32Array(n); this.tz = new Float32Array(n);
    this.hd = new Float32Array(n); this.k = new Float32Array(n);
    this.ctrl = [];
  }

  reset(seed, dest) {
    this.rng = createRng(seed);
    this.dest = dest;
    this.ctrlIndex = 0;
    this.heading = 0;
    this.turn = 0;
    this.turnTarget = 0;
    this.turnHold = 0;
    this.cx = 0; this.cz = 0;
    this.hillPhase = [this.rng.range(0, 6.28), this.rng.range(0, 6.28), this.rng.range(0, 6.28)];
    this.ctrl.length = 0;
    // a couple of points behind the start so the spline is defined at s = 0
    for (let i = 0; i < 4; i++) this.ctrl.push(this._nextControl());
    this.segIndex = 1; // current Catmull-Rom segment (between ctrl[1] and ctrl[2])
    this.emitted = 0;
    this.finalized = 0;
    this.accum = 0;
    this.prevX = this.ctrl[1].x; this.prevY = this.ctrl[1].y; this.prevZ = this.ctrl[1].z;
    this._emitPoint(this.prevX, this.prevY, this.prevZ, 0); // sample 0
    this.ensure(ROAD.aheadDistance + 200);
  }

  _nextControl() {
    const i = this.ctrlIndex++;
    const sp = ROAD.controlSpacing;
    const sApprox = (i - 1) * sp;
    const d = difficultyAt(sApprox);
    const r = this.rng;
    if (i > 7) {
      if (--this.turnHold <= 0) {
        // pick a new bend: tighter and more frequent as difficulty rises
        const maxTurn = 0.07 + 0.25 * d;
        const straight = r.chance(0.3 - 0.18 * d);
        this.turnTarget = straight ? 0 : r.range(0.35, 1) * maxTurn * (r.chance(0.5) ? 1 : -1);
        this.turnHold = r.int(2, 5);
      }
      // keep the road heading broadly "north" so it never loops back on itself
      if (this.heading > 0.85 && this.turnTarget > 0) this.turnTarget = -Math.abs(this.turnTarget);
      if (this.heading < -0.85 && this.turnTarget < 0) this.turnTarget = Math.abs(this.turnTarget);
      this.turn += (this.turnTarget - this.turn) * 0.55;
      this.heading += this.turn;
    }
    this.cx += Math.sin(this.heading) * sp;
    this.cz -= Math.cos(this.heading) * sp;
    const dest = this.dest;
    const amp = dest.terrain.hillAmp * (0.55 + 0.45 * d) * (i > 6 ? 1 : 0.2);
    const ph = this.hillPhase;
    const y = dest.terrain.baseY + amp * (0.6 * Math.sin(i * 0.23 + ph[0]) + 0.3 * Math.sin(i * 0.09 + ph[1]) + 0.1 * Math.sin(i * 0.61 + ph[2]));
    return { x: this.cx, y, z: this.cz - 0 };
  }

  _emitPoint(x, y, z) {
    const n = ROAD.ringSize;
    const j = this.emitted % n;
    this.px[j] = x; this.py[j] = y; this.pz[j] = z;
    this.emitted++;
    // finalise tangents/curvature for samples that now have neighbours
    while (this.finalized < this.emitted - 2) this._finalize(this.finalized++);
  }

  _finalize(i) {
    const n = ROAD.ringSize;
    const a = (Math.max(0, i - 1)) % n, b = (i + 1) % n, j = i % n;
    let dx = this.px[b] - this.px[a], dy = this.py[b] - this.py[a], dz = this.pz[b] - this.pz[a];
    const len = Math.hypot(dx, dy, dz) || 1;
    dx /= len; dy /= len; dz /= len;
    this.tx[j] = dx; this.ty[j] = dy; this.tz[j] = dz;
    this.hd[j] = Math.atan2(dx, -dz);
    if (i >= 1) {
      let dh = this.hd[j] - this.hd[a];
      if (dh > Math.PI) dh -= 2 * Math.PI; else if (dh < -Math.PI) dh += 2 * Math.PI;
      this.k[j] = dh / ROAD.sampleSpacing;
    } else this.k[j] = 0;
  }

  // Generate road samples until sample data is valid up to distance s.
  ensure(s) {
    const ds = ROAD.sampleSpacing;
    const sub = 36;
    while ((this.finalized - 2) * ds < s) {
      while (this.ctrl.length < this.segIndex + 3) this.ctrl.push(this._nextControl());
      const p0 = this.ctrl[this.segIndex - 1], p1 = this.ctrl[this.segIndex];
      const p2 = this.ctrl[this.segIndex + 1], p3 = this.ctrl[this.segIndex + 2];
      for (let k = 1; k <= sub; k++) {
        const t = k / sub, t2 = t * t, t3 = t2 * t;
        const cr = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
        const x = cr(p0.x, p1.x, p2.x, p3.x), y = cr(p0.y, p1.y, p2.y, p3.y), z = cr(p0.z, p1.z, p2.z, p3.z);
        const seg = Math.hypot(x - this.prevX, y - this.prevY, z - this.prevZ);
        let next = this.emitted * ds;
        while (next <= this.accum + seg) {
          const f = (next - this.accum) / seg;
          this._emitPoint(this.prevX + (x - this.prevX) * f, this.prevY + (y - this.prevY) * f, this.prevZ + (z - this.prevZ) * f);
          next = this.emitted * ds;
        }
        this.accum += seg;
        this.prevX = x; this.prevY = y; this.prevZ = z;
      }
      this.segIndex++;
      // drop old control points to keep the array small
      if (this.segIndex > 8) { this.ctrl.splice(0, 4); this.segIndex -= 4; }
    }
  }

  // Interpolated frame at distance s. Writes into `o` (reused, no allocation).
  sample(s, o) {
    const ds = ROAD.sampleSpacing, n = ROAD.ringSize;
    let f = s / ds;
    if (f < 0) f = 0;
    const max = this.finalized - 2;
    if (f > max) f = max;
    const i = Math.floor(f), t = f - i;
    const a = i % n, b = (i + 1) % n;
    o.x = this.px[a] + (this.px[b] - this.px[a]) * t;
    o.y = this.py[a] + (this.py[b] - this.py[a]) * t;
    o.z = this.pz[a] + (this.pz[b] - this.pz[a]) * t;
    let tx = this.tx[a] + (this.tx[b] - this.tx[a]) * t;
    let ty = this.ty[a] + (this.ty[b] - this.ty[a]) * t;
    let tz = this.tz[a] + (this.tz[b] - this.tz[a]) * t;
    const l = Math.hypot(tx, ty, tz) || 1;
    o.tx = tx / l; o.ty = ty / l; o.tz = tz / l;
    const h = Math.hypot(o.tx, o.tz) || 1;
    o.rx = -o.tz / h; o.rz = o.tx / h; // horizontal right vector
    o.k = this.k[a] + (this.k[b] - this.k[a]) * t;
    o.heading = Math.atan2(o.tx, -o.tz);
    o.pitch = Math.asin(Math.max(-1, Math.min(1, o.ty)));
    return o;
  }

  // world position of a point at (s, lateral x, height h above the road)
  point(s, x, h, out, tmp) {
    this.sample(s, tmp);
    out.set(tmp.x + tmp.rx * x, tmp.y + h, tmp.z + tmp.rz * x);
    return out;
  }
}

export const newFrame = () => ({ x: 0, y: 0, z: 0, tx: 0, ty: 0, tz: -1, rx: 1, rz: 0, k: 0, heading: 0, pitch: 0 });
