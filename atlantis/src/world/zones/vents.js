import * as THREE from 'three';
import { T } from '../Batcher.js';
import { BASE_GEO as G, rock, column, COLORS } from '../Props.js';
import { scatterPearls, scatterClams, randomInZone } from './common.js';
import { heightAt } from '../Terrain.js';
import { CurrentMaze } from '../../puzzles/CurrentMaze.js';

export function buildVents(ctx) {
  const { rng, items, game, B, world, flora } = ctx;
  const hz = world.hazards;

  // Vent chimneys with scalding plumes
  const chimneys = [];
  for (let i = 0; i < 26; i++) {
    const p = randomInZone(ctx, 'vents', { padMargin: 8, avoid: chimneys.map(([x, z]) => [x, z, 18]) });
    if (!p) continue;
    const [x, z] = p;
    const y = heightAt(x, z) - 0.5;
    const h = rng.float(5, 11);
    chimneys.push([x, z]);
    B.add(G.cone6, 'stone', T(x, y + h / 2, z, rng.float(0, 6), rng.float(3, 4.5), h, rng.float(3, 4.5)), 0x2a2224, 0.12);
    for (let k = 0; k < 3; k++) B.add(G.cyl8, 'stone', T(x, y + h * (0.2 + k * 0.25), z, rng.float(0, 6), 3.6 - k * 0.8, 0.6, 3.6 - k * 0.8), 0x3a2e2c, 0.12);
    B.add(G.cyl8, 'emissive', T(x, y + h, z, 0, 1.1, 0.15, 1.1), 0xff7a2a, 0.1);
    ctx.C.cylinder(x, z, 1.6, y - 1, y + h);
    hz.addChimney(x, y, z, h);
    // tube worms and glowing life around the base
    for (let k = 0; k < 6; k++) {
      const a = rng.float(0, 6.28), d = rng.float(3, 7);
      const wx = x + Math.cos(a) * d, wz = z + Math.sin(a) * d;
      flora.worms.add(wx, heightAt(wx, wz) - 0.1, wz, rng.float(0, 6), rng.float(0.8, 1.4), rng.float(0.8, 1.6), 0xffffff);
    }
    world.addLight({ pos: new THREE.Vector3(x, y + h + 1, z), color: 0xff6a2a, intensity: 10, distance: 16 });
  }

  // Lava cracks
  for (let i = 0; i < 90; i++) {
    const p = randomInZone(ctx, 'vents', { padMargin: 2 });
    if (!p) continue;
    const [x, z] = p;
    const len = rng.float(4, 14), ry = rng.float(0, 6.28);
    const y = Math.min(heightAt(x, z), heightAt(x + Math.sin(ry) * len / 2, z + Math.cos(ry) * len / 2), heightAt(x - Math.sin(ry) * len / 2, z - Math.cos(ry) * len / 2));
    B.add(G.box, 'emissive', T(x, y + 0.05, z, ry, rng.float(0.2, 0.5), 0.4, len), rng.pick([0xff5a1a, 0xff8a2a, 0xffb040]), 0.15);
  }

  // Glowing vent life: lantern caps and luminous anemones
  for (let i = 0; i < 160; i++) {
    const p = randomInZone(ctx, 'vents', { padMargin: 3 });
    if (!p) continue;
    const [x, z] = p;
    const y = heightAt(x, z) - 0.1;
    if (rng.chance(0.5)) {
      const h = rng.float(0.5, 1.6);
      B.add(G.cyl6, 'stone', T(x, y + h / 2, z, 0, 0.15, h, 0.15), 0xd8d0c0, 0.1);
      B.add(G.hemi, 'emissive', T(x, y + h, z, 0, rng.float(0.35, 0.7), 0.3, rng.float(0.35, 0.7)), rng.pick([0x7af0ff, 0xa0ff8a, 0xff9be0, 0xffd27a]), 0.15);
    } else {
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * 6.28;
        B.add(G.cone5, 'emissive', T(x + Math.cos(a) * 0.2, y + 0.4, z + Math.sin(a) * 0.2, -a, 0.12, rng.float(0.6, 1.2), 0.12, 0, 0.4), rng.pick([0x6af0ff, 0xc59bff]), 0.1);
      }
    }
  }
  for (let i = 0; i < 90; i++) {
    const p = randomInZone(ctx, 'vents', { padMargin: 5 });
    if (p) rock(ctx, p[0], heightAt(p[0], p[1]) - 0.5, p[1], rng.float(1, 4.5), rng.pick([0x2c2426, 0x3a2e2c, 0x241c1e]));
  }
  // a few ruined forge columns
  for (let i = 0; i < 14; i++) {
    const p = randomInZone(ctx, 'vents', { padMargin: 5 });
    if (p) column(ctx, p[0], heightAt(p[0], p[1]) - 0.4, p[1], rng.float(5, 8), { broken: true, color: 0x8a7a70 });
  }

  // Hot currents crossing the approaches
  hz.addCurrent({ x: -255, z: -125, angle: Math.PI * 0.5, length: 50, width: 12, y0: -110, y1: -70, force: 13, hot: true });
  hz.addCurrent({ x: -330, z: -110, angle: Math.PI, length: 40, width: 10, y0: -110, y1: -75, force: 12, hot: true });
  hz.addCurrent({ x: -300, z: -240, angle: -Math.PI * 0.3, length: 45, width: 10, y0: -115, y1: -80, force: 13, hot: true });

  // The Ember Labyrinth (current maze) -> Shard of Fire
  new CurrentMaze(ctx, { x: -370, z: -205, y: -96, shardId: 'vents' });

  scatterPearls(ctx, 'vents', 20, { padMargin: 4 });
  scatterClams(ctx, 'vents', 3, 8, { padMargin: 5 });
  for (const [x, z] of [[-300, -170], [-380, -140], [-260, -200]]) {
    game.creatures.spawnLater('jelly', x, heightAt(x, z) + rng.float(8, 16), z, { glow: true });
  }
}
