// Collision world: terrain heightfield + static colliders (OBBs, cylinders) in a spatial hash.
import type { Collider } from '../gen/landmarks';
import type { TerrainSampler } from '../gen/terrain';

const CELL = 32;

export interface SweepResult { x: number; z: number; ground: number; hitWall: boolean; ledge: number | null; onCollider: boolean }

export class Physics {
  private grid = new Map<number, Collider[]>();
  private all: Collider[] = [];
  constructor(public ts: TerrainSampler) {}

  private key(ix: number, iz: number) { return ((ix + 1000) << 11) ^ (iz + 1000); }

  add(cols: Collider[]) {
    for (const c of cols) {
      this.all.push(c);
      const r = c.k === 'box' ? Math.hypot(c.hw, c.hd) : c.r;
      const x0 = Math.floor((c.x - r) / CELL), x1 = Math.floor((c.x + r) / CELL);
      const z0 = Math.floor((c.z - r) / CELL), z1 = Math.floor((c.z + r) / CELL);
      for (let ix = x0; ix <= x1; ix++) for (let iz = z0; iz <= z1; iz++) {
        const k = this.key(ix, iz);
        let list = this.grid.get(k);
        if (!list) this.grid.set(k, (list = []));
        list.push(c);
      }
    }
  }

  get count() { return this.all.length; }

  near(x: number, z: number): Collider[] {
    return this.grid.get(this.key(Math.floor(x / CELL), Math.floor(z / CELL))) ?? [];
  }

  /** Signed penetration: returns push vector out of collider in XZ for a circle, or null. */
  private push(c: Collider, x: number, z: number, r: number): [number, number] | null {
    if (c.k === 'cyl') {
      const dx = x - c.x, dz = z - c.z;
      const d = Math.hypot(dx, dz);
      const m = c.r + r;
      if (d >= m) return null;
      if (d < 1e-4) return [m, 0];
      return [(dx / d) * (m - d), (dz / d) * (m - d)];
    }
    const cs = Math.cos(c.rot), sn = Math.sin(c.rot);
    const dx = x - c.x, dz = z - c.z;
    const u = dx * cs + dz * sn, v = -dx * sn + dz * cs;
    const cu = Math.max(-c.hw, Math.min(c.hw, u)), cv = Math.max(-c.hd, Math.min(c.hd, v));
    const ex = u - cu, ez = v - cv;
    const d = Math.hypot(ex, ez);
    if (d >= r) return null;
    let pu: number, pv: number;
    if (d > 1e-4) { pu = (ex / d) * (r - d); pv = (ez / d) * (r - d); }
    else {
      // centre inside the box: push out along the smallest axis
      const ou = c.hw - Math.abs(u) + r, ov = c.hd - Math.abs(v) + r;
      if (ou < ov) { pu = Math.sign(u || 1) * ou; pv = 0; } else { pu = 0; pv = Math.sign(v || 1) * ov; }
    }
    return [pu * cs - pv * sn, pu * sn + pv * cs];
  }

  private contains(c: Collider, x: number, z: number, pad = 0): boolean {
    if (c.k === 'cyl') return Math.hypot(x - c.x, z - c.z) < c.r + pad;
    const cs = Math.cos(c.rot), sn = Math.sin(c.rot);
    const dx = x - c.x, dz = z - c.z;
    const u = dx * cs + dz * sn, v = -dx * sn + dz * cs;
    return Math.abs(u) <= c.hw + pad && Math.abs(v) <= c.hd + pad;
  }

  /** Highest walkable surface at (x,z) that is at or below `maxY` (terrain or collider tops). */
  groundAt(x: number, z: number, maxY = Infinity): { y: number; collider: boolean } {
    let y = this.ts.height(x, z);
    let col = false;
    for (const c of this.near(x, z)) {
      if (c.y1 <= maxY + 0.01 && c.y1 > y && this.contains(c, x, z)) { y = c.y1; col = true; }
    }
    return { y, collider: col };
  }

  /**
   * Move a vertical capsule (radius r, feet at y, height h) from (x,z) to (nx,nz).
   * Colliders whose top is within stepUp of the feet are stepped onto; taller ones block.
   */
  move(x: number, z: number, nx: number, nz: number, y: number, r: number, h: number, stepUp: number): SweepResult {
    let hitWall = false;
    let ledge: number | null = null;
    for (let iter = 0; iter < 3; iter++) {
      let moved = false;
      const list = this.near(nx, nz);
      for (const c of list) {
        if (c.y1 <= y + stepUp || c.y0 >= y + h) continue; // can step on or walk under
        const p = this.push(c, nx, nz, r);
        if (p) {
          nx += p[0]; nz += p[1]; moved = true; hitWall = true;
          if (c.y1 - y < 3.2 && c.y1 - y > stepUp) ledge = ledge === null ? c.y1 : Math.min(ledge, c.y1);
        }
      }
      if (!moved) break;
    }
    const g = this.groundAt(nx, nz, y + stepUp);
    void x; void z;
    return { x: nx, z: nz, ground: g.y, hitWall, ledge, onCollider: g.collider };
  }

  /** Ceiling check: lowest collider bottom above the head. */
  ceilingAt(x: number, z: number, y: number): number {
    let c = Infinity;
    for (const col of this.near(x, z)) if (col.y0 > y && col.y0 < c && this.contains(col, x, z)) c = col.y0;
    return c;
  }

  /** Is a point inside any collider (for NPC/animal placement and line-of-sight)? */
  blocked(x: number, z: number, y: number, pad = 0.3): boolean {
    for (const c of this.near(x, z)) if (c.y0 < y + 1.5 && c.y1 > y + 0.3 && this.contains(c, x, z, pad)) return true;
    return false;
  }

  /** Simple line of sight test between two points at eye height. */
  lineOfSight(ax: number, ay: number, az: number, bx: number, by: number, bz: number): boolean {
    const d = Math.hypot(bx - ax, bz - az);
    const steps = Math.ceil(d / 2);
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const x = ax + (bx - ax) * t, z = az + (bz - az) * t, y = ay + (by - ay) * t;
      if (this.ts.height(x, z) > y) return false;
      for (const c of this.near(x, z)) if (c.y0 < y && c.y1 > y && this.contains(c, x, z)) return false;
    }
    return true;
  }
}
