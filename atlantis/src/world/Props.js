import * as THREE from 'three';
import { T } from './Batcher.js';
import { heightAt } from './Terrain.js';

// Low-poly prop builders. Each takes a context { B: StaticBatcher, C: Colliders, rng } and
// adds merged geometry plus colliders.

export const COLORS = {
  stone: 0xe9e3d3,
  stoneDark: 0xb9b2a2,
  stoneOld: 0xc9c3b0,
  gold: 0xd9a838,
  glyph: 0x46f2df,
  bronze: 0x9c6b3a,
  wood: 0x6b4a2e,
  woodDark: 0x4a3220,
  metal: 0x8a99a6,
  rope: 0xb8a77a,
  windowWarm: 0xffc46b,
};

const G = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl6: new THREE.CylinderGeometry(0.5, 0.5, 1, 6),
  cyl8: new THREE.CylinderGeometry(0.5, 0.5, 1, 8),
  cyl12: new THREE.CylinderGeometry(0.5, 0.5, 1, 12),
  cone5: new THREE.ConeGeometry(0.5, 1, 5),
  cone6: new THREE.ConeGeometry(0.5, 1, 6),
  ico0: new THREE.IcosahedronGeometry(1, 0),
  ico1: new THREE.IcosahedronGeometry(1, 1),
  dodec: new THREE.DodecahedronGeometry(1, 0),
  octa: new THREE.OctahedronGeometry(1, 0),
  sphere: new THREE.SphereGeometry(1, 8, 6),
  hemi: new THREE.SphereGeometry(1, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2),
  torusHalf: new THREE.TorusGeometry(1, 0.18, 4, 8, Math.PI),
  plane: new THREE.PlaneGeometry(1, 1),
};
export { G as BASE_GEO };

// Child transform relative to a parent matrix.
export function M(parent, x, y, z, ry = 0, sx = 1, sy = sx, sz = sx, rx = 0, rz = 0) {
  return parent.clone().multiply(T(x, y, z, ry, sx, sy, sz, rx, rz));
}

// Deformed rock.
export function rock(ctx, x, y, z, s, color = 0x8a8478, opts = {}) {
  const r = ctx.rng;
  const geo = G.ico0;
  const sy = s * r.float(0.5, 0.95);
  const m = T(x, y + sy * 0.3, z, r.float(0, 6.28), s * r.float(0.8, 1.25), sy, s * r.float(0.8, 1.25), r.float(-0.2, 0.2), r.float(-0.2, 0.2));
  ctx.B.add(geo, 'stone', m, color, 0.12);
  if (opts.collide !== false && s > 0.8) ctx.C.sphere(x, y + sy * 0.15, z, s * 0.85);
}

export function rockOnGround(ctx, x, z, s, color, opts) {
  rock(ctx, x, heightAt(x, z) - s * 0.25, z, s, color, opts);
}

// ---- Coral ----
export function coralBranch(ctx, x, y, z, s, color) {
  const r = ctx.rng;
  const base = T(x, y, z, r.float(0, 6.28), s);
  const arms = r.int(3, 5);
  ctx.B.add(G.cyl6, 'stone', M(base, 0, 0.4, 0, 0, 0.22, 0.8, 0.22), color, 0.1);
  for (let i = 0; i < arms; i++) {
    const a = (i / arms) * Math.PI * 2 + r.float(-0.3, 0.3);
    const tilt = r.float(0.3, 0.8);
    const len = r.float(0.8, 1.5);
    const arm = M(base, Math.cos(a) * 0.15, 0.7, Math.sin(a) * 0.15, -a, 0.16, len, 0.16, 0, tilt);
    ctx.B.add(G.cyl6, 'stone', M(arm, 0, 0.5, 0), color, 0.12);
    ctx.B.add(G.ico0, 'stone', M(arm, 0, 1.0, 0, 0, 1.4, 0.25, 1.4), color, 0.15);
  }
}

export function coralBrain(ctx, x, y, z, s, color) {
  const r = ctx.rng;
  ctx.B.add(G.dodec, 'stone', T(x, y + s * 0.35, z, r.float(0, 6), s, s * 0.6, s), color, 0.14);
  if (s > 1.2) ctx.C.sphere(x, y + s * 0.2, z, s * 0.8);
}

export function coralFan(ctx, x, y, z, s, color) {
  const r = ctx.rng;
  const ry = r.float(0, 6.28);
  const base = T(x, y, z, ry, s);
  ctx.B.add(G.cyl6, 'stone', M(base, 0, 0.3, 0, 0, 0.12, 0.6, 0.12), color, 0.1);
  for (let i = 0; i < 5; i++) {
    const a = -0.9 + i * 0.45;
    ctx.B.add(G.box, 'stone', M(base, Math.sin(a) * 0.7, 0.6 + Math.cos(a) * 0.7, 0, 0, 0.5, 1.1, 0.06, 0, -a), color, 0.15);
  }
}

export function coralTube(ctx, x, y, z, s, color) {
  const r = ctx.rng;
  const n = r.int(3, 6);
  for (let i = 0; i < n; i++) {
    const h = r.float(0.6, 1.8) * s;
    const ox = r.float(-0.4, 0.4) * s, oz = r.float(-0.4, 0.4) * s;
    ctx.B.add(G.cyl6, 'stone', T(x + ox, y + h / 2, z + oz, 0, 0.25 * s, h, 0.25 * s), color, 0.1);
    ctx.B.add(G.cyl6, 'glow', T(x + ox, y + h + 0.02, z + oz, 0, 0.18 * s, 0.05, 0.18 * s), 0xffe6a0, 0.1);
  }
}

export function anemone(ctx, x, y, z, s, color, tip) {
  const r = ctx.rng;
  ctx.B.add(G.cyl8, 'stone', T(x, y + 0.2 * s, z, 0, 0.6 * s, 0.4 * s, 0.6 * s), color, 0.1);
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const m = T(x + Math.cos(a) * 0.18 * s, y + 0.4 * s, z + Math.sin(a) * 0.18 * s, -a, s * 0.08, s * r.float(0.5, 0.8), s * 0.08, 0, 0.5);
    ctx.B.add(G.cone5, 'stone', M(m, 0, 0.5, 0), tip || color, 0.15);
  }
}

// ---- Atlantean architecture ----
export function column(ctx, x, y, z, h, opts = {}) {
  const r = ctx.rng;
  const rad = opts.radius || 0.7;
  const broken = opts.broken ?? false;
  const shaftH = broken ? h * r.float(0.3, 0.75) : h;
  const color = opts.color || COLORS.stone;
  ctx.B.add(G.box, 'stone', T(x, y + 0.25, z, 0, rad * 2.8, 0.5, rad * 2.8), opts.baseColor || COLORS.stoneDark, 0.06);
  ctx.B.add(G.cyl8, 'stone', T(x, y + 0.5 + shaftH / 2, z, 0, rad * 2, shaftH, rad * 2), color, 0.05);
  ctx.B.add(G.cyl8, 'shiny', T(x, y + 0.9, z, 0, rad * 2.15, 0.22, rad * 2.15), COLORS.gold, 0.04);
  if (!broken) {
    ctx.B.add(G.cyl8, 'shiny', T(x, y + shaftH - 0.1, z, 0, rad * 2.2, 0.25, rad * 2.2), COLORS.gold, 0.04);
    ctx.B.add(G.box, 'stone', T(x, y + shaftH + 0.5, z, 0, rad * 3, 0.6, rad * 3), COLORS.stoneDark, 0.06);
    if (opts.glyph) ctx.B.add(G.cyl8, 'glow', T(x, y + shaftH * 0.6, z, 0, rad * 2.05, 0.15, rad * 2.05), COLORS.glyph, 0.05);
  } else {
    // jagged top + fallen chunk
    ctx.B.add(G.cone5, 'stone', T(x, y + 0.5 + shaftH + 0.2, z, r.float(0, 6), rad * 2, 0.6, rad * 2), color, 0.08);
    if (opts.fallen !== false && r.chance(0.6)) {
      const a = r.float(0, 6.28), d = r.float(2, 4);
      const fx = x + Math.cos(a) * d, fz = z + Math.sin(a) * d;
      const fy = heightAt(fx, fz);
      ctx.B.add(G.cyl8, 'stone', T(fx, fy + rad * 0.8, fz, a, rad * 2, r.float(1.5, 3), rad * 2, 0, Math.PI / 2), color, 0.06);
    }
  }
  ctx.C.cylinder(x, z, rad * 1.1, y - 2, y + (broken ? shaftH + 0.8 : shaftH + 0.8));
}

export function arch(ctx, x, y, z, w, h, ry = 0, opts = {}) {
  const base = T(x, y, z, ry);
  const half = w / 2;
  const color = opts.color || COLORS.stone;
  for (const s of [-1, 1]) {
    ctx.B.add(G.box, 'stone', M(base, s * half, h / 2, 0, 0, 1.2, h, 1.2), color, 0.05);
    ctx.B.add(G.box, 'shiny', M(base, s * half, h * 0.3, 0, 0, 1.3, 0.25, 1.3), COLORS.gold, 0.04);
    const wx = x + Math.cos(ry) * s * half, wz = z - Math.sin(ry) * s * half;
    ctx.C.box(wx, y + h / 2, wz, 0.6, h / 2, 0.6, ry);
  }
  // curved top
  ctx.B.add(G.torusHalf, 'stone', M(base, 0, h, 0, 0, half, half, 3.2), color, 0.05);
  ctx.B.add(G.box, 'stone', M(base, 0, h + half + 0.3, 0, 0, w + 1.4, 0.7, 1.4), COLORS.stoneDark, 0.05);
  if (opts.glyph !== false) ctx.B.add(G.box, 'glow', M(base, 0, h + half + 0.3, 0.72, 0, w * 0.5, 0.18, 0.04), COLORS.glyph, 0.05);
  const tx = x, tz = z;
  ctx.C.box(tx, y + h + half * 0.6 + 0.3, tz, half + 0.7, half * 0.5 + 0.35, 0.7, ry);
}

// House: four walls with a door gap and windows, optional roof. Returns nothing.
export function house(ctx, x, y, z, w, d, h, ry = 0, opts = {}) {
  const r = ctx.rng;
  const base = T(x, y, z, ry);
  const color = opts.color || (r.chance(0.5) ? COLORS.stone : COLORS.stoneOld);
  const broken = opts.broken ?? r.chance(0.5);
  const t = 0.5;
  const cos = Math.cos(ry), sin = Math.sin(ry);
  const toWorld = (lx, lz) => [x + lx * cos + lz * sin, z - lx * sin + lz * cos];
  const wallH = (i) => (broken ? h * r.float(0.45, 1) : h);
  // floor
  ctx.B.add(G.box, 'stone', M(base, 0, 0.1, 0, 0, w, 0.3, d), COLORS.stoneDark, 0.06);
  // back wall
  let wh = wallH();
  ctx.B.add(G.box, 'stone', M(base, 0, wh / 2, -d / 2, 0, w, wh, t), color, 0.06);
  let [cx, cz] = toWorld(0, -d / 2); ctx.C.box(cx, y + wh / 2, cz, w / 2, wh / 2, t / 2 + 0.05, ry);
  // side walls with window cutout look
  for (const s of [-1, 1]) {
    wh = wallH();
    ctx.B.add(G.box, 'stone', M(base, s * w / 2, wh / 2, 0, 0, t, wh, d), color, 0.06);
    if (wh > 2.6) ctx.B.add(G.box, 'cityLight', M(base, s * (w / 2 + 0.02 * s), Math.min(wh - 1, 2.2), 0, 0, t * 1.05, 0.8, 0.9), COLORS.windowWarm, 0.1);
    [cx, cz] = toWorld(s * w / 2, 0); ctx.C.box(cx, y + wh / 2, cz, t / 2 + 0.05, wh / 2, d / 2, ry);
  }
  // front wall with door
  const door = Math.min(2.2, w * 0.4);
  const seg = (w - door) / 2;
  for (const s of [-1, 1]) {
    wh = wallH();
    const lx = s * (door / 2 + seg / 2);
    ctx.B.add(G.box, 'stone', M(base, lx, wh / 2, d / 2, 0, seg, wh, t), color, 0.06);
    [cx, cz] = toWorld(lx, d / 2); ctx.C.box(cx, y + wh / 2, cz, seg / 2, wh / 2, t / 2 + 0.05, ry);
  }
  ctx.B.add(G.box, 'stone', M(base, 0, h - 0.35, d / 2, 0, door + 0.4, 0.7, t * 1.1), color, 0.06);
  ctx.B.add(G.box, 'shiny', M(base, 0, h - 0.75, d / 2 + 0.1, 0, door + 0.6, 0.15, 0.1), COLORS.gold, 0.04);
  if (!broken || opts.roof) {
    // flat roof with rim, sometimes dome
    ctx.B.add(G.box, 'stone', M(base, 0, h + 0.2, 0, 0, w + 0.6, 0.4, d + 0.6), COLORS.stoneDark, 0.05);
    ctx.C.box(x, y + h + 0.2, z, (w + 0.6) / 2, 0.25, (d + 0.6) / 2, ry);
    if (opts.dome || r.chance(0.3)) {
      ctx.B.add(G.hemi, 'stone', M(base, 0, h + 0.4, 0, 0, Math.min(w, d) * 0.42), color, 0.05);
      ctx.B.add(G.cone6, 'shiny', M(base, 0, h + 0.4 + Math.min(w, d) * 0.42 + 0.4, 0, 0, 0.3, 0.9, 0.3), COLORS.gold, 0.04);
    }
  } else {
    // rubble inside
    for (let i = 0; i < 3; i++) {
      const [rx, rz] = toWorld(r.float(-w / 3, w / 3), r.float(-d / 3, d / 3));
      ctx.B.add(G.box, 'stone', T(rx, y + 0.3, rz, r.float(0, 6), r.float(0.6, 1.4), r.float(0.4, 0.8), r.float(0.6, 1.2), r.float(-0.3, 0.3)), color, 0.08);
    }
  }
}

// Atlantean statue: robed figure, optional trident. Returns base matrix for extras.
export function statue(ctx, x, y, z, ry, s = 1, opts = {}) {
  const base = T(x, y, z, ry, s);
  const color = opts.color || COLORS.stone;
  if (!opts.noPedestal) {
    ctx.B.add(G.box, 'stone', M(base, 0, 0.6, 0, 0, 2.2, 1.2, 2.2), COLORS.stoneDark, 0.05);
    ctx.B.add(G.box, 'shiny', M(base, 0, 1.15, 0, 0, 2.3, 0.15, 2.3), COLORS.gold, 0.04);
  }
  const by = opts.noPedestal ? 0 : 1.2;
  ctx.B.add(G.cyl8, 'stone', M(base, 0, by + 1.3, 0, 0, 1.3, 2.6, 1.1), color, 0.05); // robe
  ctx.B.add(G.box, 'stone', M(base, 0, by + 3.0, 0, 0, 1.3, 1.1, 0.75), color, 0.05); // chest
  ctx.B.add(G.box, 'stone', M(base, 0, by + 3.45, 0, 0, 1.8, 0.35, 0.8), color, 0.05); // shoulders
  if (!opts.headless) {
    ctx.B.add(G.ico0, 'stone', M(base, 0, by + 4.05, 0, 0, 0.42, 0.5, 0.45), color, 0.04); // head
    ctx.B.add(G.cyl6, 'shiny', M(base, 0, by + 4.45, 0, 0, 0.8, 0.18, 0.8), COLORS.gold, 0.04); // circlet
  }
  // arms
  ctx.B.add(G.box, 'stone', M(base, -0.95, by + 2.7, 0, 0, 0.35, 1.4, 0.4, 0, -0.15), color, 0.05);
  if (!opts.armless) {
    ctx.B.add(G.box, 'stone', M(base, 0.95, by + 3.3, -0.1, 0, 0.35, 1.3, 0.4, 0, 0.5), color, 0.05);
    if (opts.trident !== false) {
      ctx.B.add(G.cyl6, 'shiny', M(base, 1.35, by + 3.2, -0.1, 0, 0.1, 4.4, 0.1), COLORS.gold, 0.03);
      ctx.B.add(G.box, 'shiny', M(base, 1.35, by + 5.3, -0.1, 0, 0.8, 0.12, 0.1), COLORS.gold, 0.03);
      for (const ox of [-0.38, 0, 0.38]) ctx.B.add(G.cone5, 'shiny', M(base, 1.35 + ox, by + 5.6, -0.1, 0, 0.14, 0.6, 0.14), COLORS.gold, 0.03);
    }
  }
  if (opts.emblem) ctx.B.add(G.box, 'glow', M(base, 0, by + 3.0, 0.39, 0, 0.5, 0.5, 0.04), COLORS.glyph, 0.05);
  if (!opts.noCollide) ctx.C.cylinder(x, z, 1.3 * s, y - 1, y + (by + 4.5) * s);
  return base;
}

export function stairs(ctx, x, y, z, w, steps, stepH, stepD, ry, color = COLORS.stone) {
  const base = T(x, y, z, ry);
  for (let i = 0; i < steps; i++) {
    ctx.B.add(G.box, 'stone', M(base, 0, stepH * (i + 0.5), -i * stepD, 0, w, stepH, stepD + 0.02), color, 0.04);
  }
}

// Glowing glyph tile in the world (batched, generic teal block)
export function glyphStrip(ctx, x, y, z, w, h, ry) {
  ctx.B.add(G.box, 'glow', T(x, y, z, ry, w, h, 0.06), COLORS.glyph, 0.05);
}

// Lamp post with a warm light that turns on at the ending.
export function brazier(ctx, x, y, z, h = 2.4) {
  ctx.B.add(G.cyl6, 'stone', T(x, y + h / 2, z, 0, 0.35, h, 0.35), COLORS.stoneDark, 0.05);
  ctx.B.add(G.cyl8, 'shiny', T(x, y + h, z, 0, 1.1, 0.4, 1.1), COLORS.gold, 0.04);
  ctx.B.add(G.ico0, 'cityLight', T(x, y + h + 0.45, z, 0, 0.45), COLORS.windowWarm, 0.05);
  ctx.C.cylinder(x, z, 0.4, y, y + h + 0.6);
}

// Paved road segment between two points.
export function road(ctx, x0, z0, x1, z1, width = 5) {
  const len = Math.hypot(x1 - x0, z1 - z0);
  const ry = Math.atan2(x1 - x0, z1 - z0);
  const n = Math.max(1, Math.round(len / 3));
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t;
    const y = heightAt(x, z);
    if (ctx.rng.chance(0.12)) continue; // missing slab
    ctx.B.add(G.box, 'stone', T(x, y + 0.05, z, ry + ctx.rng.float(-0.03, 0.03), width, 0.35, len / n - 0.15), ctx.rng.chance(0.5) ? 0xcfc8b6 : 0xbdb6a4, 0.08);
  }
}

// Glyph-carved standing stone (batched body, texture plane added as mesh by caller).
export function stele(ctx, x, y, z, ry, h = 3) {
  ctx.B.add(G.box, 'stone', T(x, y + h / 2, z, ry, 1.4, h, 0.5), COLORS.stoneOld, 0.05);
  ctx.B.add(G.box, 'shiny', T(x, y + h + 0.1, z, ry, 1.6, 0.2, 0.6), COLORS.gold, 0.04);
  ctx.C.box(x, y + h / 2, z, 0.7, h / 2, 0.25, ry);
}

// A textured glyph plane as an individual mesh.
export function glyphPlane(scene, material, x, y, z, ry, size = 1) {
  const m = new THREE.Mesh(G.plane, material);
  m.position.set(x, y, z);
  m.rotation.y = ry;
  m.scale.setScalar(size);
  scene.add(m);
  return m;
}
