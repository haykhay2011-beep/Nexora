import * as THREE from 'three';
import { T } from '../Batcher.js';
import { BASE_GEO as G, rock, COLORS } from '../Props.js';
import { scatterPearls, scatterClams, randomInZone, addSign } from './common.js';
import { heightAt } from '../Terrain.js';
import { LightBeam } from '../../puzzles/LightBeam.js';

const BIO = [0x3af0ff, 0x6a8aff, 0xb06aff, 0x3affb0, 0xff6ad8];

export function buildAbyss(ctx) {
  const { rng, items, game, B, world } = ctx;

  // Dark rock spires and boulders
  for (let i = 0; i < 120; i++) {
    const p = randomInZone(ctx, 'abyss', { padMargin: 5 });
    if (!p) continue;
    const [x, z] = p;
    const y = heightAt(x, z);
    if (rng.chance(0.3)) {
      const h = rng.float(10, 30);
      B.add(G.cone5, 'stone', T(x, y + h / 2 - 1, z, rng.float(0, 6), rng.float(3, 6), h, rng.float(3, 6)), 0x141a24, 0.12);
      ctx.C.cylinder(x, z, 2, y - 2, y + h * 0.6);
      // glowing nodules up the spire
      for (let k = 0; k < 4; k++) B.add(G.ico0, 'emissive', T(x + rng.float(-1.5, 1.5), y + rng.float(1, h * 0.7), z + rng.float(-1.5, 1.5), 0, rng.float(0.15, 0.35)), rng.pick(BIO), 0.1);
    } else rock(ctx, x, y - 0.5, z, rng.float(1, 4), rng.pick([0x10161e, 0x182030, 0x1c2430]));
  }
  // Bioluminescent carpets, glowing stalks and coral
  for (let i = 0; i < 260; i++) {
    const p = randomInZone(ctx, 'abyss', { padMargin: 2 });
    if (!p) continue;
    const [x, z] = p;
    const y = heightAt(x, z) - 0.1;
    const col = rng.pick(BIO);
    const t = rng.next();
    if (t < 0.4) {
      for (let k = 0; k < 6; k++) B.add(G.ico0, 'emissive', T(x + rng.float(-1.2, 1.2), y + 0.1, z + rng.float(-1.2, 1.2), 0, rng.float(0.06, 0.16)), col, 0.15);
    } else if (t < 0.75) {
      const h = rng.float(0.8, 3);
      B.add(G.cyl6, 'stone', T(x, y + h / 2, z, 0, 0.12, h, 0.12), 0x2a3448, 0.1);
      B.add(G.sphere, 'emissive', T(x, y + h, z, 0, rng.float(0.15, 0.3)), col, 0.1);
    } else {
      for (let k = 0; k < 4; k++) {
        const a = rng.float(0, 6.28);
        B.add(G.cone5, 'emissive', T(x + Math.cos(a) * 0.3, y + 0.5, z + Math.sin(a) * 0.3, -a, 0.12, rng.float(0.8, 1.6), 0.12, 0, 0.3), col, 0.1);
      }
    }
  }
  // The bones of something enormous
  whaleFall(ctx, 70, -520);
  whaleFall(ctx, -90, -650);

  // The Lightless Sanctum (light beams) -> Shard of the Dark
  new LightBeam(ctx, { x: 0, z: -625, y: -160, shardId: 'abyss' });
  items.addCarving('c_sanctum', 9, -160 + 1.4, -625 + 18, 0, 2.2, 1.6);
  ctx.B.add(G.box, 'stone', T(9, -160 + 0.5, -625 + 17.8, 0, 2.6, 1.2, 0.5), 0x3a4656, 0.05);
  items.addPage('page10', -4, -160 + 1.2, -625 - 22);
  items.addRelic('starCompass', 60, heightAt(60, -520) + 1, -520);
  world.addLight({ pos: new THREE.Vector3(0, -150, -625), color: 0x3a6aff, intensity: 10, distance: 30 });

  addSign(ctx, 0, -355, 'Marker left by Mara Quill', 'The Abyss begins past the palace. Below 110 m you need an Abyssal Suit, and a lamp strong enough to cut the dark.');
  items.addPage('log_abyss', 90, null, -380);

  scatterPearls(ctx, 'abyss', 16, { padMargin: 4 });
  scatterClams(ctx, 'abyss', 3, 10, { padMargin: 5 });

  // Creatures of the deep
  for (let i = 0; i < 10; i++) {
    const p = randomInZone(ctx, 'abyss', { padMargin: 0 });
    if (p) game.creatures.spawnLater('jelly', p[0], heightAt(p[0], p[1]) + rng.float(8, 30), p[1], { glow: true });
  }
  for (let i = 0; i < 6; i++) {
    const p = randomInZone(ctx, 'abyss', { padMargin: 4 });
    if (p) game.creatures.spawnLater('angler', p[0], heightAt(p[0], p[1]) + rng.float(4, 12), p[1], {});
  }
  for (const [x, z, dx, dz] of [[-20, -600, 1, 0], [25, -650, -1, 0], [40, -560, 0, 1], [-60, -560, 1, 0]]) {
    game.creatures.spawnLater('eel', x, heightAt(x, z) + 1.5, z, { dir: [dx, dz], glow: true });
  }
}

function whaleFall(ctx, x, z) {
  const { B, C } = ctx;
  const y = heightAt(x, z);
  const bone = 0xd8d0c0;
  B.add(G.cyl8, 'stone', T(x, y + 0.8, z, 0.4, 1.2, 26, 1.2, 0, Math.PI / 2), bone, 0.05);
  for (let i = -5; i <= 5; i++) {
    const ox = i * 2.2 * Math.cos(0.4), oz = -i * 2.2 * Math.sin(0.4);
    const h = 7 - Math.abs(i) * 0.5;
    B.add(G.torusHalf, 'stone', T(x + ox, y + 0.6, z + oz, 0.4 + Math.PI / 2, h * 0.5, h, 0.4, 0, 0), bone, 0.05);
    C.cylinder(x + ox + Math.sin(0.4 + Math.PI / 2) * h * 0.5, z + oz + Math.cos(0.4 + Math.PI / 2) * h * 0.5, 0.3, y, y + h * 0.9);
    C.cylinder(x + ox - Math.sin(0.4 + Math.PI / 2) * h * 0.5, z + oz - Math.cos(0.4 + Math.PI / 2) * h * 0.5, 0.3, y, y + h * 0.9);
  }
  B.add(G.ico0, 'stone', T(x - 14 * Math.cos(0.4), y + 2, z + 14 * Math.sin(0.4), 0.4, 3.5, 2.5, 2.5), bone, 0.06);
  ctx.C.sphere(x - 14 * Math.cos(0.4), y + 2, z + 14 * Math.sin(0.4), 2.4);
}
