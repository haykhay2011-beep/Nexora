// Simple collision world: Y-rotated boxes, vertical cylinders and spheres in a spatial hash.
// The player is a sphere and is pushed out of anything it overlaps.

const CELL = 16;

export class Colliders {
  constructor() {
    this.grid = new Map();
    this.dynamic = [];
    this.stamp = 0;
  }

  _insert(c) {
    const x0 = Math.floor((c.cx - c.bound) / CELL), x1 = Math.floor((c.cx + c.bound) / CELL);
    const z0 = Math.floor((c.cz - c.bound) / CELL), z1 = Math.floor((c.cz + c.bound) / CELL);
    for (let z = z0; z <= z1; z++) {
      for (let x = x0; x <= x1; x++) {
        const k = x * 73856 + z;
        let list = this.grid.get(k);
        if (!list) this.grid.set(k, (list = []));
        list.push(c);
      }
    }
    return c;
  }

  // Box centered at (cx,cy,cz) with half extents, rotated by ry around Y.
  box(cx, cy, cz, hx, hy, hz, ry = 0, dynamic = false) {
    const c = {
      type: 'box', cx, cy, cz, hx, hy, hz, ry, cos: Math.cos(ry), sin: Math.sin(ry),
      bound: Math.hypot(hx, hz), enabled: true, _s: 0,
    };
    if (dynamic) { this.dynamic.push(c); return c; }
    return this._insert(c);
  }

  setBoxRotation(c, ry) {
    c.ry = ry; c.cos = Math.cos(ry); c.sin = Math.sin(ry);
  }

  cylinder(cx, cz, r, y0, y1, dynamic = false) {
    const c = { type: 'cyl', cx, cz, r, y0, y1, cy: (y0 + y1) / 2, bound: r, enabled: true, _s: 0 };
    if (dynamic) { this.dynamic.push(c); return c; }
    return this._insert(c);
  }

  sphere(cx, cy, cz, r, dynamic = false) {
    const c = { type: 'sphere', cx, cy, cz, r, bound: r, enabled: true, _s: 0 };
    if (dynamic) { this.dynamic.push(c); return c; }
    return this._insert(c);
  }

  nearby(x, z, out = []) {
    out.length = 0;
    this.stamp++;
    const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        const list = this.grid.get((cx + dx) * 73856 + (cz + dz));
        if (!list) continue;
        for (const c of list) {
          if (c._s === this.stamp) continue;
          c._s = this.stamp;
          out.push(c);
        }
      }
    }
    for (const c of this.dynamic) out.push(c);
    return out;
  }

  // Returns push vector for a sphere at p with radius r against collider c, or null.
  _penetration(c, px, py, pz, r, out) {
    if (!c.enabled) return false;
    if (c.type === 'box') {
      const dx = px - c.cx, dy = py - c.cy, dz = pz - c.cz;
      // into local space
      const lx = dx * c.cos - dz * c.sin;
      const lz = dx * c.sin + dz * c.cos;
      const qx = Math.max(-c.hx, Math.min(c.hx, lx));
      const qy = Math.max(-c.hy, Math.min(c.hy, dy));
      const qz = Math.max(-c.hz, Math.min(c.hz, lz));
      let nx = lx - qx, ny = dy - qy, nz = lz - qz;
      const d2 = nx * nx + ny * ny + nz * nz;
      let push;
      if (d2 > 1e-8) {
        if (d2 >= r * r) return false;
        const d = Math.sqrt(d2);
        push = r - d; nx /= d; ny /= d; nz /= d;
      } else {
        // center inside box: push out along smallest axis
        const ox = c.hx - Math.abs(lx), oy = c.hy - Math.abs(dy), oz = c.hz - Math.abs(lz);
        nx = ny = nz = 0;
        if (ox < oy && ox < oz) { nx = Math.sign(lx) || 1; push = ox + r; }
        else if (oy < oz) { ny = Math.sign(dy) || 1; push = oy + r; }
        else { nz = Math.sign(lz) || 1; push = oz + r; }
      }
      // back to world
      out.x = (nx * c.cos + nz * c.sin) * push;
      out.y = ny * push;
      out.z = (-nx * c.sin + nz * c.cos) * push;
      return true;
    }
    if (c.type === 'cyl') {
      if (py + r < c.y0 || py - r > c.y1) return false;
      const dx = px - c.cx, dz = pz - c.cz;
      const d = Math.sqrt(dx * dx + dz * dz);
      const rr = c.r + r;
      if (d >= rr) return false;
      // decide between side push and cap push
      const side = rr - d;
      const top = c.y1 + r - py, bottom = py - (c.y0 - r);
      if (top < side && top < bottom) { out.x = 0; out.y = top; out.z = 0; return true; }
      if (bottom < side) { out.x = 0; out.y = -bottom; out.z = 0; return true; }
      const inv = d > 1e-6 ? 1 / d : 0;
      out.x = (d > 1e-6 ? dx * inv : 1) * side; out.y = 0; out.z = dz * inv * side;
      return true;
    }
    if (c.type === 'sphere') {
      const dx = px - c.cx, dy = py - c.cy, dz = pz - c.cz;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const rr = c.r + r;
      if (d >= rr) return false;
      const inv = d > 1e-6 ? 1 / d : 0;
      const push = rr - d;
      out.x = dx * inv * push; out.y = (d > 1e-6 ? dy * inv : 1) * push; out.z = dz * inv * push;
      return true;
    }
    return false;
  }

  // Push sphere out of colliders; damps velocity into surfaces. Returns true if touched anything.
  resolve(pos, r, vel) {
    const list = this.nearby(pos.x, pos.z, this._tmpList || (this._tmpList = []));
    const out = this._tmpOut || (this._tmpOut = { x: 0, y: 0, z: 0 });
    let hit = false;
    for (let iter = 0; iter < 2; iter++) {
      for (const c of list) {
        if (this._penetration(c, pos.x, pos.y, pos.z, r, out)) {
          hit = true;
          pos.x += out.x; pos.y += out.y; pos.z += out.z;
          if (vel) {
            const len = Math.hypot(out.x, out.y, out.z) || 1;
            const nx = out.x / len, ny = out.y / len, nz = out.z / len;
            const vn = vel.x * nx + vel.y * ny + vel.z * nz;
            if (vn < 0) { vel.x -= vn * nx; vel.y -= vn * ny; vel.z -= vn * nz; }
          }
        }
      }
    }
    return hit;
  }

  overlaps(x, y, z, r) {
    const list = this.nearby(x, z, this._tmpList2 || (this._tmpList2 = []));
    const out = { x: 0, y: 0, z: 0 };
    for (const c of list) if (this._penetration(c, x, y, z, r, out)) return true;
    return false;
  }
}
