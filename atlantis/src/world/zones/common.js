import * as THREE from 'three';
import { T } from '../Batcher.js';
import { BASE_GEO } from '../Props.js';
import { PADS, ZONE_BY_ID } from '../config.js';
import { zoneAt, heightAt } from '../Terrain.js';

// True if (x,z) lies on (or near) a building pad.
export function onPad(x, z, margin = 2) {
  for (const p of PADS) {
    const d = Math.hypot(x - p.x, z - p.z);
    if (d < p.r + margin) return true;
  }
  return false;
}

// Random point inside a zone (dominant zone check), away from pads and listed spots.
export function randomInZone(ctx, zoneId, { maxR, minR = 0, padMargin = 2, avoid = [], tries = 30 } = {}) {
  const zn = ZONE_BY_ID[zoneId];
  const R = maxR ?? zn.r * 1.05;
  for (let t = 0; t < tries; t++) {
    const a = ctx.rng.float(0, Math.PI * 2);
    const d = Math.sqrt(ctx.rng.float((minR / R) ** 2, 1)) * R;
    const x = zn.x + Math.cos(a) * d, z = zn.z + Math.sin(a) * d;
    if (zoneAt(x, z).id !== zoneId) continue;
    if (padMargin >= 0 && onPad(x, z, padMargin)) continue;
    let ok = true;
    for (const [ax, az, ar] of avoid) if (Math.hypot(x - ax, z - az) < ar) { ok = false; break; }
    if (!ok) continue;
    return [x, z];
  }
  return null;
}

export function scatterPearls(ctx, zoneId, count, opts = {}) {
  let placed = 0;
  for (let i = 0; i < count * 3 && placed < count; i++) {
    const p = randomInZone(ctx, zoneId, opts);
    if (!p) continue;
    const [x, z] = p;
    const y = heightAt(x, z) + 0.5 + (ctx.rng.chance(0.25) ? ctx.rng.float(1, 4) : 0);
    if (ctx.C.overlaps(x, y, z, 0.5)) continue;
    // little clusters of 1-3
    const n = ctx.rng.int(1, 3);
    for (let k = 0; k < n && placed < count; k++) {
      const ox = x + ctx.rng.float(-1.5, 1.5), oz = z + ctx.rng.float(-1.5, 1.5);
      ctx.items.addPearl(ox, Math.max(y, heightAt(ox, oz) + 0.5), oz);
      placed++;
    }
  }
}

export function scatterClams(ctx, zoneId, count, pearls = 5, opts = {}) {
  let placed = 0;
  for (let i = 0; i < count * 4 && placed < count; i++) {
    const p = randomInZone(ctx, zoneId, opts);
    if (!p) continue;
    const [x, z] = p;
    if (ctx.C.overlaps(x, heightAt(x, z) + 0.5, z, 1.2)) continue;
    ctx.items.addClam(x, null, z, ctx.rng.float(0, 6.28), pearls);
    placed++;
  }
}

export const ground = heightAt;

// A marker buoy left by an earlier diver: reading it shows a hint.

export function addSign(ctx, x, z, title, text) {
  const y = heightAt(x, z);
  ctx.B.add(BASE_GEO.cyl6, 'stone', T(x, y + 1.5, z, 0, 0.18, 3, 0.18), 0x555f66, 0.03);
  ctx.B.add(BASE_GEO.sphere, 'shiny', T(x, y + 3.4, z, 0, 0.6), 0xffb02e, 0.03);
  ctx.B.add(BASE_GEO.box, 'emissive', T(x, y + 4.1, z, 0, 0.3, 0.3, 0.3), 0xff5533, 0.02);
  ctx.B.add(BASE_GEO.box, 'stone', T(x, y + 0.3, z, 0.3, 1, 0.6, 1), 0x3a3f44, 0.05);
  ctx.C.cylinder(x, z, 0.6, y, y + 4);
  ctx.game.interact.add({
    pos: new THREE.Vector3(x, y + 3, z), radius: 4,
    prompt: `Read marker: ${title}`,
    onUse: () => ctx.game.ui.toast(title, 'warn', text),
  });
}

// Glowing waystones along hidden paths. Sonar highlights them.
export function waystones(ctx, points, spacing = 9) {
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, z0] = points[i], [x1, z1] = points[i + 1];
    const len = Math.hypot(x1 - x0, z1 - z0);
    const n = Math.max(1, Math.floor(len / spacing));
    for (let k = 0; k < n; k++) {
      const t = k / n;
      const x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t;
      const y = heightAt(x, z);
      ctx.B.add(BASE_GEO.ico0, 'stone', T(x, y + 0.3, z, ctx.rng.float(0, 6), 0.7, 0.5, 0.7), 0x8a9a8a, 0.1);
      ctx.B.add(BASE_GEO.octa, 'glow', T(x, y + 0.85, z, ctx.rng.float(0, 6), 0.22, 0.32, 0.22), 0x8dff9a, 0.05);
      ctx.game.sonar.addTarget(new THREE.Vector3(x, y + 1, z), 'path', 'Waystone');
    }
  }
}

// Distance from point to a polyline (for keeping paths clear of kelp).
export function distToPath(x, z, pts) {
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
    const dx = bx - ax, dz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
    const d = Math.hypot(x - (ax + dx * t), z - (az + dz * t));
    if (d < best) best = d;
  }
  return best;
}
