import * as THREE from 'three';
import { T } from '../Batcher.js';
import { BASE_GEO as G, M, house, column, arch, statue, road, brazier, rock, COLORS } from '../Props.js';
import { scatterPearls, scatterClams, onPad, addSign, randomInZone } from './common.js';
import { heightAt, zoneAt } from '../Terrain.js';
import { getMaterials } from '../Materials.js';
import { PlatePuzzle } from '../../puzzles/PlatePuzzle.js';
import { DolphinNet } from '../../puzzles/DolphinNet.js';

const CX = 0, CZ = 30;
const AVENUES = [-120, -80, -40, 0, 40, 80, 120];
const STREETS = [-110, -70, -30, 10, 50, 90, 130];

function inCity(x, z, margin = 0) {
  return Math.hypot(x - CX, z - CZ) < 175 - margin && zoneAt(x, z).id === 'city';
}

const RESERVED = [[70, -10, 30], [-85, 60, 18], [0, 30, 18], [-30, -40, 12], [40, 90, 9], [-55, -70, 9], [0, 150, 14]];
function reserved(x, z, pad = 0) {
  return RESERVED.some(([rx, rz, rr]) => Math.hypot(x - rx, z - rz) < rr + pad);
}

export function buildCity(ctx) {
  const { rng, items, game, B, C } = ctx;

  // Roads
  for (const ax of AVENUES) {
    const pts = [];
    for (let z = -150; z <= 170; z += 10) if (inCity(ax, z)) pts.push(z);
    if (pts.length > 1) road(ctx, ax, pts[0], ax, pts[pts.length - 1], ax === 0 ? 7 : 4.5);
  }
  for (const sz of STREETS) {
    const pts = [];
    for (let x = -170; x <= 170; x += 10) if (inCity(x, sz)) pts.push(x);
    if (pts.length > 1) road(ctx, pts[0], sz, pts[pts.length - 1], sz, 4.5);
  }

  // Houses in the blocks between roads
  for (let i = 0; i < AVENUES.length - 1; i++) {
    for (let j = 0; j < STREETS.length - 1; j++) {
      const x0 = AVENUES[i] + 5, x1 = AVENUES[i + 1] - 5;
      const z0 = STREETS[j] + 5, z1 = STREETS[j + 1] - 5;
      const slots = [
        [x0 + 7, z0 + 7, Math.PI], [x1 - 7, z0 + 7, Math.PI], [x0 + 7, z1 - 7, 0], [x1 - 7, z1 - 7, 0],
        [(x0 + x1) / 2, z0 + 7, Math.PI], [(x0 + x1) / 2, z1 - 7, 0],
      ];
      for (const [hx, hz, ry] of slots) {
        if (!inCity(hx, hz, 8) || reserved(hx, hz, 8) || rng.chance(0.25)) continue;
        const w = rng.float(6, 10), d = rng.float(6, 9), h = rng.float(4, 7.5);
        house(ctx, hx + rng.float(-1, 1), heightAt(hx, hz) - 0.2, hz + rng.float(-1, 1), w, d, h, ry + (rng.chance(0.15) ? rng.float(-0.3, 0.3) : 0));
      }
    }
  }

  // Colonnade along the grand avenue
  for (let z = -120; z <= 140; z += 14) {
    if (Math.abs(z - 30) < 20) continue;
    for (const s of [-1, 1]) {
      const x = s * 6;
      if (!inCity(x, z)) continue;
      column(ctx, x, heightAt(x, z) - 0.2, z, 8, { broken: rng.chance(0.4), glyph: true });
    }
  }
  // braziers along the avenue (lit at the ending)
  for (let z = -110; z <= 130; z += 28) {
    for (const s of [-1, 1]) brazier(ctx, s * 9, heightAt(s * 9, z), z);
  }

  // City gate and wall
  buildGate(ctx, 0, 150);

  // Fountain plaza
  buildFountain(ctx, 0, 30);

  // Hall of the mural (roofed, with an air pocket)
  buildMuralHall(ctx, -30, -40);

  // Domed houses with trapped air
  airHouse(ctx, 40, 90, 'coinTrident');
  airHouse(ctx, -55, -70, 'maskGold');

  // Market square puzzle
  new PlatePuzzle(ctx, { x: 70, z: -10, y: -52, shardId: 'city' });
  items.addCarving('c_market', 70 + 14, -52 + 1.3, -10 + 13.5, -Math.PI / 4);
  ctx.B.add(G.box, 'stone', T(84, -52 + 0.4, 3.5, -Math.PI / 4, 2.6, 0.8, 0.6), COLORS.stoneOld, 0.05);
  items.addPage('page6', 45, null, 5);
  // market stalls
  for (const [sx, sz] of [[44, -24], [44, 2], [96, -24], [96, 4]]) {
    for (const [ox, oz] of [[-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5]]) B.add(G.cyl6, 'stone', T(sx + ox, -52 + 1.3, sz + oz, 0, 0.25, 2.6, 0.25), COLORS.wood, 0.05);
    B.add(G.box, 'stone', T(sx, -52 + 2.7, sz, rng.float(-0.1, 0.1), 4, 0.15, 4, 0, 0.1), rng.pick([0x9a3a2a, 0x2a5a8a, 0x8a7a2a]), 0.08);
    B.add(G.box, 'stone', T(sx, -52 + 0.6, sz, 0, 3, 1.2, 1.2), COLORS.wood, 0.06);
    C.box(sx, -52 + 0.6, sz, 1.5, 0.6, 0.6);
    for (let k = 0; k < 3; k++) {
      const ax = sx + rng.float(-1.5, 1.5), az = sz + rng.float(1.2, 2.2);
      B.add(G.cyl8, 'stone', T(ax, -52 + 0.5, az, 0, 0.6, 1, 0.6), 0xc8643a, 0.08);
      B.add(G.cyl6, 'stone', T(ax, -52 + 1.15, az, 0, 0.3, 0.3, 0.3), 0xc8643a, 0.08);
    }
  }

  // Dolphin in the netted courtyard (side quest)
  new DolphinNet(ctx, { x: -85, z: 60 });

  // Story items
  items.addPage('page3', 6, null, 18);
  items.addPage('log_heat', -150, null, -40);
  addSign(ctx, -175, -70, 'Marker left by Mara Quill', 'The water to the west is scalding. Turn back unless you wear a Heat Suit.');
  addSign(ctx, 150, -70, 'Marker left by Mara Quill', 'The temples lie east, below 70 m. A Pressure Suit is enough down there, but watch the walls: eels.');
  addSign(ctx, 0, -125, 'Marker left by Mara Quill', 'The palace is sealed inside a dome of light. The way to the deep trench goes around it, east or west.');
  scatterPearls(ctx, 'city', 32, { padMargin: 3 });
  scatterClams(ctx, 'city', 5, 6, { padMargin: 4 });

  // rubble
  for (let i = 0; i < 70; i++) {
    const p = randomInZone(ctx, 'city', { padMargin: 4 });
    if (!p || reserved(p[0], p[1], 3)) continue;
    const y = heightAt(p[0], p[1]);
    B.add(G.box, 'stone', T(p[0], y + 0.3, p[1], rng.float(0, 6), rng.float(0.6, 2), rng.float(0.4, 1), rng.float(0.6, 1.6), rng.float(-0.3, 0.3)), rng.pick([COLORS.stone, COLORS.stoneOld]), 0.08);
  }
  for (let i = 0; i < 30; i++) {
    const p = randomInZone(ctx, 'city', { padMargin: 4 });
    if (p && !reserved(p[0], p[1], 3)) rock(ctx, p[0], heightAt(p[0], p[1]) - 0.4, p[1], rng.float(0.8, 2.2), 0x7a8288);
  }
  for (let i = 0; i < 40; i++) {
    const p = randomInZone(ctx, 'city', { padMargin: 2 });
    if (!p) continue;
    for (let k = 0; k < 12; k++) {
      const x = p[0] + rng.float(-4, 4), z = p[1] + rng.float(-4, 4);
      if (!onPad(x, z, 0)) ctx.flora.grass.add(x, heightAt(x, z) - 0.1, z, rng.float(0, 6), rng.float(0.6, 1), rng.float(0.5, 1.2), 0xa0c890);
    }
  }

  // residents and hazards
  game.creatures.spawnLater('shark', 100, -40, 80, { path: [[100, 80], [130, 0], [90, -80], [40, -40], [60, 60]] });
  game.creatures.spawnLater('shark', -100, -42, -60, { path: [[-100, -60], [-140, 20], [-110, 110], [-60, 30]] });
  for (const [x, z] of [[24, 70], [-40, 100], [50, -60], [-100, -20], [90, 110], [-20, -90]]) {
    game.creatures.spawnLater('octopus', x, heightAt(x, z), z, {});
  }
  for (const [x, z] of [[20, 120], [-60, 10], [110, -60]]) {
    game.creatures.spawnLater('jelly', x, heightAt(x, z) + rng.float(6, 14), z, {});
  }
}

function buildGate(ctx, x, z) {
  const { B, C, rng } = ctx;
  const y = heightAt(x, z);
  arch(ctx, x, y, z, 10, 10, 0);
  for (const s of [-1, 1]) {
    B.add(G.box, 'shiny', T(x + s * 5, y + 10.6, z, 0, 1.4, 0.4, 1.4), COLORS.gold, 0.03);
    statue(ctx, x + s * 9, y, z + 3, s * 0.3, 1.3, { trident: true, emblem: true });
    // city wall, broken in places
    for (let k = 1; k <= 9; k++) {
      const wx = x + s * (6 + k * 6);
      if (k === 4 || k === 7) continue;
      const wy = heightAt(wx, z);
      const h = rng.chance(0.3) ? rng.float(2, 4) : rng.float(6, 8);
      B.add(G.box, 'stone', T(wx, wy + h / 2, z, 0, 6.2, h, 2.2), COLORS.stoneOld, 0.06);
      B.add(G.box, 'glow', T(wx, wy + h * 0.7, z + 1.12, 0, 4, 0.2, 0.05), COLORS.glyph, 0.05);
      C.box(wx, wy + h / 2, z, 3.1, h / 2, 1.1);
    }
  }
}

function buildFountain(ctx, x, z) {
  const { B, C, items, world } = ctx;
  const y = heightAt(x, z);
  B.add(G.cyl12, 'stone', T(x, y + 0.2, z, 0, 26, 0.4, 26), 0xd4cdbc, 0.04);
  B.add(new THREE.TorusGeometry(6, 0.6, 5, 20), 'stone', T(x, y + 0.8, z, 0, 1, 1, 1, Math.PI / 2), COLORS.stone, 0.04);
  B.add(G.cyl12, 'glow', T(x, y + 0.45, z, 0, 11, 0.1, 11), 0x3fb8c8, 0.05);
  B.add(G.cyl8, 'stone', T(x, y + 1.5, z, 0, 2.4, 3, 2.4), COLORS.stone, 0.04);
  B.add(G.cyl8, 'shiny', T(x, y + 3.1, z, 0, 4, 0.4, 4), COLORS.gold, 0.03);
  statue(ctx, x, y + 3.2, z, 0, 1.1, { noPedestal: true, trident: true, emblem: true, noCollide: true });
  C.cylinder(x, z, 1.4, y, y + 9);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    brazier(ctx, x + Math.cos(a) * 11, y, z + Math.sin(a) * 11, 2);
  }
  world.addLight({ pos: new THREE.Vector3(x, y + 6, z), color: 0x7ff3ff, intensity: 14, distance: 22 });
}

function buildMuralHall(ctx, x, z) {
  const { B, C, items, world } = ctx;
  const y = heightAt(x, z);
  const w = 14, d = 10, h = 7;
  // walls with a door on the south side
  B.add(G.box, 'stone', T(x, y + h / 2, z - d / 2, 0, w, h, 0.8), COLORS.stone, 0.05);
  C.box(x, y + h / 2, z - d / 2, w / 2, h / 2, 0.4);
  for (const s of [-1, 1]) {
    B.add(G.box, 'stone', T(x + s * w / 2, y + h / 2, z, 0, 0.8, h, d), COLORS.stone, 0.05);
    C.box(x + s * w / 2, y + h / 2, z, 0.4, h / 2, d / 2);
    B.add(G.box, 'stone', T(x + s * 4.5, y + h / 2, z + d / 2, 0, 5, h, 0.8), COLORS.stone, 0.05);
    C.box(x + s * 4.5, y + h / 2, z + d / 2, 2.5, h / 2, 0.4);
    column(ctx, x + s * 2.6, y, z + d / 2 + 2, h, { glyph: true });
  }
  B.add(G.box, 'stone', T(x, y + h - 0.7, z + d / 2, 0, 4, 1.4, 0.8), COLORS.stone, 0.05);
  B.add(G.box, 'stone', T(x, y + h + 0.3, z, 0, w + 1.2, 0.6, d + 1.2), COLORS.stoneDark, 0.05);
  C.box(x, y + h + 0.3, z, w / 2 + 0.6, 0.3, d / 2 + 0.6);
  // pediment
  B.add(G.cone6, 'stone', T(x, y + h + 1.6, z, Math.PI / 6, w * 0.75, 2.2, d * 0.8), COLORS.stone, 0.05);
  // air pocket under the roof
  const air = new THREE.Mesh(new THREE.PlaneGeometry(w - 1, d - 1), getMaterials().airPocket);
  air.rotation.x = Math.PI / 2;
  air.position.set(x, y + h - 1.6, z);
  ctx.scene.add(air);
  world.addAirPocket(x, y + h - 0.6, z, 3.4);
  world.addAirPocket(x - 3.5, y + h - 0.6, z, 2.6);
  world.addAirPocket(x + 3.5, y + h - 0.6, z, 2.6);
  // the mural (long carving on the back wall)
  items.addCarving('c_mural', x, y + 3, z - d / 2 + 0.6, 0, 9, 3.5);
  items.addPage('page4', x + 4, y + 1.2, z - 1);
  items.addRelic('amphora', x - 5, y + 0.8, z + 2);
  world.addLight({ pos: new THREE.Vector3(x, y + 4, z), color: 0xbff8ff, intensity: 10, distance: 14 });
  ctx.game.sonar.addTarget(new THREE.Vector3(x, y + h - 1, z), 'air', 'Air pocket');
}

function airHouse(ctx, x, z, relicId) {
  const { B, C, items, world } = ctx;
  const y = heightAt(x, z);
  const w = 9, d = 9, h = 6;
  house(ctx, x, y - 0.1, z, w, d, h, 0, { broken: false, roof: true, dome: true, color: COLORS.stone });
  const air = new THREE.Mesh(new THREE.PlaneGeometry(w - 1.2, d - 1.2), getMaterials().airPocket);
  air.rotation.x = Math.PI / 2;
  air.position.set(x, y + h - 1.4, z);
  ctx.scene.add(air);
  world.addAirPocket(x, y + h - 0.5, z, 3.2);
  items.addRelic(relicId, x, y + 1, z - 1.5);
  ctx.game.sonar.addTarget(new THREE.Vector3(x, y + h - 1, z), 'air', 'Air pocket');
}
