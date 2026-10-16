import * as THREE from 'three';
import { T } from '../Batcher.js';
import { BASE_GEO as G, M, rock, coralBranch, coralBrain, coralFan, coralTube, anemone, column, COLORS } from '../Props.js';
import { randomInZone, scatterPearls, scatterClams, onPad } from './common.js';
import { heightAt } from '../Terrain.js';
import { Base } from '../Base.js';
import { clamModel } from '../../items/Models.js';

const CORAL = [0xff7a6b, 0xff9f43, 0xf368e0, 0xa29bfe, 0xffd166, 0x48dbfb, 0xff6b9d, 0x7bed9f, 0xff5e57];

export function placeCoral(ctx, x, z, scale = 1) {
  const r = ctx.rng;
  const y = heightAt(x, z) - 0.1;
  const color = r.pick(CORAL);
  const t = r.next();
  if (t < 0.32) coralBranch(ctx, x, y, z, r.float(0.7, 1.5) * scale, color);
  else if (t < 0.55) coralBrain(ctx, x, y, z, r.float(0.6, 1.6) * scale, color);
  else if (t < 0.72) coralFan(ctx, x, y, z, r.float(0.8, 1.6) * scale, color);
  else if (t < 0.86) coralTube(ctx, x, y, z, r.float(0.7, 1.3) * scale, color);
  else anemone(ctx, x, y, z, r.float(0.8, 1.5) * scale, color, r.pick(CORAL));
}

export function buildReef(ctx) {
  const { B, C, rng, items, game } = ctx;

  game.base = new Base(game, ctx);

  // Coral gardens: dense ring around the base, then everywhere.
  for (let i = 0; i < 160; i++) {
    const a = rng.float(0, Math.PI * 2), d = rng.float(17, 45);
    placeCoral(ctx, Math.cos(a) * d, 560 + Math.sin(a) * d);
  }
  for (let i = 0; i < 420; i++) {
    const p = randomInZone(ctx, 'reef', { padMargin: 3, avoid: [[-95, 470, 16], [70, 505, 10]] });
    if (p) placeCoral(ctx, p[0], p[1]);
  }
  for (let i = 0; i < 110; i++) {
    const p = randomInZone(ctx, 'reef', { padMargin: 4 });
    if (p) rock(ctx, p[0], heightAt(p[0], p[1]) - 0.4, p[1], rng.float(0.6, 3.2), rng.pick([0xb79c7a, 0xa38a6c, 0xc9b28c]));
  }
  // seagrass meadows
  for (let i = 0; i < 80; i++) {
    const p = randomInZone(ctx, 'reef', { padMargin: 1 });
    if (!p) continue;
    const n = rng.int(10, 30);
    for (let k = 0; k < n; k++) {
      const x = p[0] + rng.float(-5, 5), z = p[1] + rng.float(-5, 5);
      if (onPad(x, z, 0)) continue;
      ctx.flora.grass.add(x, heightAt(x, z) - 0.1, z, rng.float(0, 6.28), rng.float(0.7, 1.4), rng.float(0.7, 1.6), 0xffffff);
    }
  }

  buildGrotto(ctx);
  buildCoralArch(ctx);
  buildWreck(ctx);

  // A few ruins at the north edge hint at the city beyond.
  for (const [x, z] of [[-20, 410], [15, 395], [40, 420], [-50, 400]]) {
    column(ctx, x, heightAt(x, z) - 0.3, z, 6, { broken: true });
  }

  // Pearls: a trail from the base toward the grotto glow, plus scattered ones.
  items.addPearlTrail([[-4, 545], [-25, 530], [-48, 512], [-68, 494], [-80, 484]], 4.5);
  scatterPearls(ctx, 'reef', 26, { padMargin: 3 });
  scatterClams(ctx, 'reef', 4, 5, { padMargin: 4 });
  items.addRelic('maskCoral', 70, heightAt(70, 505) + 1.2, 505);
}

function bigRock(ctx, x, y, z, sx, sy, sz, ry, color) {
  ctx.B.add(G.ico0, 'stone', T(x, y, z, ry, sx, sy, sz, ctx.rng.float(-0.2, 0.2), ctx.rng.float(-0.2, 0.2)), color, 0.1);
  ctx.C.sphere(x, y, z, Math.min(sx, sy, sz) * 0.9);
}

// Clam Grotto: a rock cave with a giant clam holding the first shard.
function buildGrotto(ctx) {
  const { rng, items, game } = ctx;
  const cx = -95, cz = 470, fy = -18;
  const entrance = Math.atan2(560 - cz, 0 - cx);
  const R = 9;
  const rockColor = 0x9c8670;
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    let da = Math.abs(((a - entrance + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
    if (da < 0.42) continue;
    const s = rng.float(3.2, 4.2);
    bigRock(ctx, cx + Math.cos(a) * R, fy + 2.5, cz + Math.sin(a) * R, s, s * 1.6, s, rng.float(0, 6), rockColor);
  }
  // entrance frame rocks
  for (const s of [-1, 1]) {
    const a = entrance + s * 0.55;
    bigRock(ctx, cx + Math.cos(a) * (R + 1.5), fy + 3, cz + Math.sin(a) * (R + 1.5), 3, 5, 3, a, rockColor);
  }
  // roof
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const d = i === 0 ? 0 : 5;
    const rx = cx + (i === 0 ? 0 : Math.cos(a) * d), rz = cz + (i === 0 ? 0 : Math.sin(a) * d);
    ctx.B.add(G.ico0, 'stone', T(rx, fy + 10.5, rz, rng.float(0, 6), 6, 2.6, 6), rockColor, 0.1);
    ctx.C.sphere(rx, fy + 10.8, rz, 3.0);
  }
  // coral and glowing anemones on the inside and outside
  for (let i = 0; i < 14; i++) {
    const a = rng.float(0, Math.PI * 2), d = rng.float(3, 6.5);
    anemone(ctx, cx + Math.cos(a) * d, fy, cz + Math.sin(a) * d, rng.float(0.6, 1), 0x2a8a8a, 0x7ff3ff);
  }
  for (let i = 0; i < 6; i++) {
    const a = rng.float(0, Math.PI * 2), d = rng.float(3.5, 6.5);
    ctx.B.add(G.ico0, 'emissive', T(cx + Math.cos(a) * d, fy + 0.3, cz + Math.sin(a) * d, 0, 0.25), 0x7ff3ff, 0.1);
  }
  for (let i = 0; i < 30; i++) {
    const a = rng.float(0, Math.PI * 2), d = rng.float(12, 18);
    placeCoral(ctx, cx + Math.cos(a) * d, cz + Math.sin(a) * d);
  }

  // Carving on the back wall
  const back = entrance + Math.PI;
  const bx = cx + Math.cos(back) * 5.6, bz = cz + Math.sin(back) * 5.6;
  const face = Math.atan2(cx - bx, cz - bz);
  items.addCarving('c_clam', bx, fy + 2.2, bz, face);
  items.addPage('page1', cx + Math.cos(entrance) * 14, null, cz + Math.sin(entrance) * 14);

  // Giant clam with the first shard
  const clam = clamModel(2.3, 0x8a6aa8);
  clam.userData.pearl.visible = false;
  clam.position.set(cx, fy + 0.5, cz);
  clam.rotation.y = -entrance + Math.PI / 2;
  ctx.scene.add(clam);
  ctx.C.cylinder(cx, cz, 1.8, fy - 1, fy + 0.6);
  const shard = items.addShard('reef', cx, fy + 2.3, cz, { hidden: true });
  game.world.addLight({ pos: new THREE.Vector3(cx, fy + 4, cz), color: 0x7ff3ff, intensity: 22, distance: 16 });

  const puzzle = {
    id: 'reefClam',
    t: 0,
    solved: false,
    onSolved(silent) {
      this.solved = true;
      shard.reveal();
      if (silent) this.t = 1;
    },
    update(dt) {
      if (this.solved && this.t < 1) this.t = Math.min(1, this.t + dt * 0.6);
      clam.userData.hinge.rotation.x = -this.t * 1.1;
    },
  };
  game.puzzles.register(puzzle);
  game.interact.add({
    pos: new THREE.Vector3(cx, fy + 1.5, cz), radius: 4.5,
    prompt: 'Ask the giant shell to open',
    enabled: () => !puzzle.solved,
    onUse: () => game.puzzles.solve(puzzle, 'The giant clam slowly opens...'),
  });
  for (const [ox, oz] of [[4, 3], [-3, 5], [5, -4]]) {
    game.creatures.spawnLater('jelly', cx + Math.cos(entrance) * 14 + ox, fy + 4 + oz * 0.3, cz + Math.sin(entrance) * 14 + oz, {});
  }
}

function buildCoralArch(ctx) {
  const { rng } = ctx;
  const x = 70, z = 505, y = heightAt(x, z);
  const color = 0xb79c7a;
  for (const s of [-1, 1]) {
    for (let k = 0; k < 4; k++) {
      ctx.B.add(G.ico0, 'stone', T(x + s * 9 + rng.float(-0.5, 0.5), y + 2 + k * 3.2, z + rng.float(-0.5, 0.5), rng.float(0, 6), 3.2 - k * 0.3, 2.2, 3), color, 0.12);
    }
    ctx.C.cylinder(x + s * 9, z, 2.8, y - 2, y + 13);
  }
  for (let k = -3; k <= 3; k++) {
    const t = k / 3.5;
    const ax = x + t * 9, ay = y + 14 + Math.cos(t * Math.PI / 2) * 3;
    ctx.B.add(G.ico0, 'stone', T(ax, ay, z, rng.float(0, 6), 2.8, 2, 2.8), color, 0.12);
    ctx.C.sphere(ax, ay, z, 1.8);
    placeCoralAt(ctx, ax, ay + 1.6, z);
  }
  function placeCoralAt(c, px, py, pz) {
    const col = rng.pick(CORAL);
    if (rng.chance(0.5)) coralBranch(c, px, py, pz, rng.float(0.6, 1.1), col);
    else coralFan(c, px, py, pz, rng.float(0.6, 1.2), col);
  }
}

// An earlier explorer's sailboat lying on its side.
function buildWreck(ctx) {
  const { B, C, items } = ctx;
  const x = 130, z = 640, y = -16;
  const ry = 0.7, tilt = 0.35;
  const base = T(x, y + 1.6, z, ry, 1, 1, 1, 0, tilt);
  const wood = COLORS.wood, dark = COLORS.woodDark;
  B.add(G.box, 'stone', M(base, 0, -1.2, 0, 0, 3.4, 0.4, 13), dark, 0.1);
  for (const s of [-1, 1]) {
    B.add(G.box, 'stone', M(base, s * 1.8, 0, 0, 0, 0.3, 2.6, 13), wood, 0.12);
  }
  B.add(G.cone6, 'stone', M(base, 0, -0.1, 8.2, 0, 3.6, 3.5, 2.6, Math.PI / 2), wood, 0.1);
  B.add(G.box, 'stone', M(base, 0, 0, -6.6, 0, 3.8, 2.6, 0.3), wood, 0.1);
  B.add(G.cyl6, 'stone', M(base, 0, 3, 1, 0, 0.35, 6, 0.35), dark, 0.05);
  B.add(G.cyl6, 'stone', M(base, 3.5, -0.8, -2, 0.2, 0.3, 7, 0.3, 0, Math.PI / 2 - 0.1), dark, 0.05);
  B.add(G.box, 'stone', M(base, 0, -0.9, -2, 0, 1.2, 0.8, 1), 0x8a6a3a, 0.08);
  const cos = Math.cos(ry), sin = Math.sin(ry);
  for (const s of [-1, 1]) {
    C.box(x + s * 1.8 * cos, y + 1.6, z - s * 1.8 * sin, 0.25, 1.4, 6.5, ry);
  }
  C.box(x, y + 0.4, z, 1.7, 0.3, 6.5, ry);
  items.addRelic('coinSun', x + sin * 2, y + 1.2, z + cos * 2);
  items.addPage('log_quill', x - sin * 3, y + 1.0, z - cos * 3);
  items.addClam(x + 6, null, z - 4, 1, 6);
}
