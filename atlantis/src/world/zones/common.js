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
