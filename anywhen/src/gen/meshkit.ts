// Low-poly geometry toolkit: merges transformed primitives into flat arrays with vertex colours.
// Works in workers and Node (only three's math + geometry classes, no DOM).
import {
  BoxGeometry, BufferGeometry, ConeGeometry, CylinderGeometry, Float32BufferAttribute, Matrix3, Matrix4,
  Euler, Quaternion, Vector3, SphereGeometry, IcosahedronGeometry, DodecahedronGeometry, TorusGeometry, Shape, ExtrudeGeometry, LatheGeometry, Vector2,
} from 'three';

export type Col = string | [number, number, number];

const colCache = new Map<string, [number, number, number]>();
export function rgb(c: Col): [number, number, number] {
  if (typeof c !== 'string') return c;
  let v = colCache.get(c);
  if (!v) {
    const n = parseInt(c.replace('#', ''), 16);
    v = [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
    colCache.set(c, v);
  }
  return v;
}
export function shade(c: Col, f: number): [number, number, number] {
  const [r, g, b] = rgb(c);
  return [Math.min(1, r * f), Math.min(1, g * f), Math.min(1, b * f)];
}
export function mixCol(a: Col, b: Col, t: number): [number, number, number] {
  const x = rgb(a), y = rgb(b);
  return [x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t];
}

export type ColF = Col | ((nx: number, ny: number, nz: number, faceIdx: number) => Col);

export interface Xf { x?: number; y?: number; z?: number; rx?: number; ry?: number; rz?: number; sx?: number; sy?: number; sz?: number }

const geoCache = new Map<string, BufferGeometry>();
function cached(key: string, make: () => BufferGeometry): BufferGeometry {
  let g = geoCache.get(key);
  if (!g) {
    g = make();
    if (g.index) g = g.toNonIndexed();
    if (!g.getAttribute('normal')) g.computeVertexNormals();
    geoCache.set(key, g);
  }
  return g;
}

export interface MeshArrays { pos: Float32Array; nor: Float32Array; col: Float32Array; glow: Float32Array | null; part: Float32Array | null; slot: Float32Array | null }

const _m = new Matrix4();
const _n = new Matrix3();
const _v = new Vector3();
const _q = new Quaternion();
const _e = new Euler();
const _s = new Vector3();
const _p = new Vector3();

export class MeshKit {
  pos: number[] = [];
  nor: number[] = [];
  col: number[] = [];
  glow: number[] = [];
  part: number[] = [];
  slot: number[] = [];
  useGlow = false;
  useParts = false;
  curGlow = 0;
  curPart = 0;
  curSlot = 0;
  private stack: Matrix4[] = [new Matrix4()];

  get vertexCount() { return this.pos.length / 3; }

  push(xf: Xf): this {
    const m = new Matrix4().copy(this.stack[this.stack.length - 1]).multiply(xfMatrix(xf, new Matrix4()));
    this.stack.push(m);
    return this;
  }
  pop(): this { if (this.stack.length > 1) this.stack.pop(); return this; }

  /** Append a geometry with a transform and uniform colour (or a per-face colour function). */
  add(geo: BufferGeometry, color: ColF, xf: Xf = {}): this {
    const m = _m.copy(this.stack[this.stack.length - 1]).multiply(xfMatrix(xf, new Matrix4()));
    _n.getNormalMatrix(m);
    const P = geo.getAttribute('position'), N = geo.getAttribute('normal');
    const fixed = typeof color === 'function' ? null : rgb(color);
    const fn = typeof color === 'function' ? color : null;
    for (let i = 0; i < P.count; i++) {
      _v.set(P.getX(i), P.getY(i), P.getZ(i)).applyMatrix4(m);
      this.pos.push(_v.x, _v.y, _v.z);
      _v.set(N.getX(i), N.getY(i), N.getZ(i)).applyMatrix3(_n).normalize();
      this.nor.push(_v.x, _v.y, _v.z);
      let c = fixed;
      if (fn) c = rgb(fn(_v.x, _v.y, _v.z, Math.floor(i / 3)));
      this.col.push(c![0], c![1], c![2]);
      this.glow.push(this.curGlow);
      this.part.push(this.curPart);
      this.slot.push(this.curSlot);
    }
    if (this.curGlow) this.useGlow = true;
    return this;
  }

  /** Box with its base at y (bottom-anchored). */
  box(w: number, h: number, d: number, color: ColF, x = 0, y = 0, z = 0, ry = 0, extra: Xf = {}): this {
    const g = cached('box', () => new BoxGeometry(1, 1, 1));
    return this.add(g, color, { x, y: y + h / 2, z, ry, sx: w, sy: h, sz: d, ...extra });
  }
  /** Centre-anchored box. */
  boxC(w: number, h: number, d: number, color: ColF, xf: Xf = {}): this {
    const g = cached('box', () => new BoxGeometry(1, 1, 1));
    return this.add(g, color, { ...xf, sx: w * (xf.sx ?? 1), sy: h * (xf.sy ?? 1), sz: d * (xf.sz ?? 1) });
  }
  cyl(rTop: number, rBot: number, h: number, seg: number, color: ColF, x = 0, y = 0, z = 0, extra: Xf = {}): this {
    const ratio = rBot === 0 ? 0 : rTop / rBot;
    const key = `cyl${seg}:${ratio.toFixed(3)}:${rBot === 0 ? 1 : 0}`;
    const g = cached(key, () => (rBot === 0 ? new CylinderGeometry(1, 0, 1, seg, 1) : new CylinderGeometry(ratio, 1, 1, seg, 1)));
    const s = rBot === 0 ? rTop : rBot;
    return this.add(g, color, { x, y: y + h / 2, z, sx: s, sy: h, sz: s, ...extra });
  }
  cone(r: number, h: number, seg: number, color: ColF, x = 0, y = 0, z = 0, extra: Xf = {}): this {
    const g = cached('cone' + seg, () => new ConeGeometry(1, 1, seg, 1));
    return this.add(g, color, { x, y: y + h / 2, z, sx: r, sy: h, sz: r, ...extra });
  }
  sphere(r: number, ws: number, hs: number, color: ColF, x = 0, y = 0, z = 0, extra: Xf = {}): this {
    const g = cached(`sph${ws}:${hs}`, () => new SphereGeometry(1, ws, hs));
    return this.add(g, color, { x, y, z, sx: r, sy: r, sz: r, ...extra });
  }
  dome(r: number, ws: number, hs: number, color: ColF, x = 0, y = 0, z = 0, extra: Xf = {}): this {
    const g = cached(`dome${ws}:${hs}`, () => new SphereGeometry(1, ws, hs, 0, Math.PI * 2, 0, Math.PI / 2));
    return this.add(g, color, { x, y, z, sx: r, sy: r, sz: r, ...extra });
  }
  blob(r: number, color: Col | ((nx: number, ny: number, nz: number, f: number) => Col), x = 0, y = 0, z = 0, extra: Xf = {}, detail = 0): this {
    const g = cached('ico' + detail, () => new IcosahedronGeometry(1, detail));
    return this.add(g, color, { x, y, z, sx: r, sy: r, sz: r, ...extra });
  }
  rock(r: number, color: Col | ((nx: number, ny: number, nz: number, f: number) => Col), x = 0, y = 0, z = 0, extra: Xf = {}): this {
    const g = cached('dodec', () => new DodecahedronGeometry(1, 0));
    return this.add(g, color, { x, y, z, sx: r, sy: r, sz: r, ...extra });
  }
  torus(r: number, tube: number, rs: number, ts: number, color: Col, xf: Xf = {}): this {
    const k = `tor${rs}:${ts}:${(tube / r).toFixed(3)}`;
    const g = cached(k, () => new TorusGeometry(1, tube / r, rs, ts));
    return this.add(g, color, { ...xf, sx: r * (xf.sx ?? 1), sy: r * (xf.sy ?? 1), sz: r * (xf.sz ?? 1) });
  }
  lathe(points: [number, number][], seg: number, color: Col, xf: Xf = {}): this {
    const g = new LatheGeometry(points.map(([a, b]) => new Vector2(a, b)), seg);
    const ng = g.toNonIndexed();
    ng.computeVertexNormals();
    this.add(ng, color, xf);
    g.dispose(); ng.dispose();
    return this;
  }
  /** Extruded 2D outline (x,y) with depth along z, centred on z. */
  extrude(outline: [number, number][], depth: number, color: Col, xf: Xf = {}, holes: [number, number][][] = []): this {
    const sh = new Shape(outline.map(([a, b]) => new Vector2(a, b)));
    for (const h of holes) sh.holes.push(new Shape(h.map(([a, b]) => new Vector2(a, b))));
    const g = new ExtrudeGeometry(sh, { depth, bevelEnabled: false });
    g.translate(0, 0, -depth / 2);
    const ng = g.index ? g.toNonIndexed() : g;
    ng.computeVertexNormals();
    this.add(ng, color, xf);
    g.dispose();
    return this;
  }
  /** Gable roof prism: width w (x), height h, length d (z), base at y. */
  gable(w: number, h: number, d: number, color: Col, x = 0, y = 0, z = 0, ry = 0, overhang = 0.3): this {
    const W = w / 2 + overhang;
    this.tri4([-W, 0, -d / 2 - overhang], [W, 0, -d / 2 - overhang], [0, h, -d / 2 - overhang], color, x, y, z, ry, d + overhang * 2);
    return this;
  }
  private tri4(a: number[], b: number[], c: number[], color: Col, x: number, y: number, z: number, ry: number, len: number) {
    const g = new BufferGeometry();
    const A = a, B = b, C = c;
    const A2 = [a[0], a[1], a[2] + len], B2 = [b[0], b[1], b[2] + len], C2 = [c[0], c[1], c[2] + len];
    const v = [
      ...A, ...C, ...B, ...A2, ...B2, ...C2,
      ...A, ...A2, ...C2, ...A, ...C2, ...C,
      ...B, ...C, ...C2, ...B, ...C2, ...B2,
      ...A, ...B, ...B2, ...A, ...B2, ...A2,
    ];
    g.setAttribute('position', new Float32BufferAttribute(v, 3));
    g.computeVertexNormals();
    this.add(g, color, { x, y, z, ry });
    g.dispose();
  }
  /** Four-sided pyramid (hip roof when top is a point). */
  pyramid(w: number, d: number, h: number, color: Col, x = 0, y = 0, z = 0, ry = 0, topW = 0, topD = 0): this {
    const g = new BufferGeometry();
    const W = w / 2, D = d / 2, tw = topW / 2, td = topD / 2;
    const b = [[-W, 0, -D], [W, 0, -D], [W, 0, D], [-W, 0, D]];
    const t = [[-tw, h, -td], [tw, h, -td], [tw, h, td], [-tw, h, td]];
    const v: number[] = [];
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      v.push(...b[i], ...t[j], ...b[j], ...b[i], ...t[i], ...t[j]);
    }
    if (topW > 0 || topD > 0) v.push(...t[0], ...t[2], ...t[1], ...t[0], ...t[3], ...t[2]);
    v.push(...b[0], ...b[1], ...b[2], ...b[0], ...b[2], ...b[3]);
    g.setAttribute('position', new Float32BufferAttribute(v, 3));
    g.computeVertexNormals();
    this.add(g, color, { x, y, z, ry });
    g.dispose();
    return this;
  }
  /** Raw triangle list (local coords). */
  tris(verts: number[], color: Col | ((nx: number, ny: number, nz: number, f: number) => Col), xf: Xf = {}): this {
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(verts, 3));
    g.computeVertexNormals();
    this.add(g, color, xf);
    g.dispose();
    return this;
  }

  merge(other: MeshKit, xf: Xf = {}): this {
    const m = _m.copy(this.stack[this.stack.length - 1]).multiply(xfMatrix(xf, new Matrix4()));
    _n.getNormalMatrix(m);
    for (let i = 0; i < other.pos.length; i += 3) {
      _v.set(other.pos[i], other.pos[i + 1], other.pos[i + 2]).applyMatrix4(m);
      this.pos.push(_v.x, _v.y, _v.z);
      _v.set(other.nor[i], other.nor[i + 1], other.nor[i + 2]).applyMatrix3(_n).normalize();
      this.nor.push(_v.x, _v.y, _v.z);
    }
    this.col.push(...other.col);
    this.glow.push(...other.glow);
    this.part.push(...other.part);
    this.slot.push(...other.slot);
    this.useGlow ||= other.useGlow;
    return this;
  }

  toArrays(): MeshArrays {
    return {
      pos: new Float32Array(this.pos),
      nor: new Float32Array(this.nor),
      col: new Float32Array(this.col),
      glow: this.useGlow ? new Float32Array(this.glow) : null,
      part: this.useParts ? new Float32Array(this.part) : null,
      slot: this.useParts ? new Float32Array(this.slot) : null,
    };
  }

  toGeometry(): BufferGeometry {
    return arraysToGeometry(this.toArrays());
  }
}

export function arraysToGeometry(a: MeshArrays): BufferGeometry {
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(a.pos, 3));
  g.setAttribute('normal', new Float32BufferAttribute(a.nor, 3));
  g.setAttribute('color', new Float32BufferAttribute(a.col, 3));
  g.setAttribute('aGlow', new Float32BufferAttribute(a.glow ?? new Float32Array(a.pos.length / 3), 1));
  if (a.part) g.setAttribute('aPart', new Float32BufferAttribute(a.part, 1));
  if (a.slot) g.setAttribute('aSlot', new Float32BufferAttribute(a.slot, 1));
  g.computeBoundingSphere();
  g.computeBoundingBox();
  return g;
}

export function xfMatrix(xf: Xf, out: Matrix4): Matrix4 {
  _p.set(xf.x ?? 0, xf.y ?? 0, xf.z ?? 0);
  _e.set(xf.rx ?? 0, xf.ry ?? 0, xf.rz ?? 0, 'YXZ');
  _q.setFromEuler(_e);
  _s.set(xf.sx ?? 1, xf.sy ?? 1, xf.sz ?? 1);
  return out.compose(_p, _q, _s);
}
