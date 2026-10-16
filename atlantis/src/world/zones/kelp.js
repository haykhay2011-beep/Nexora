import { T } from '../Batcher.js';
import { BASE_GEO as G, rock, column, statue, COLORS } from '../Props.js';
import { randomInZone, scatterPearls, scatterClams, onPad, addSign, waystones, distToPath } from './common.js';
import { heightAt } from '../Terrain.js';
import { placeCoral } from './reef.js';
import { StatuePuzzle } from '../../puzzles/StatuePuzzle.js';
import { SongDoor } from '../../puzzles/SongDoor.js';

const PATH_GUARDIANS = [[-10, 385], [-35, 345], [-62, 305], [-80, 282], [-86, 272]];
const PATH_ECHO = [[15, 372], [45, 360], [70, 342], [84, 334]];
const MAIN_ROAD = [[0, 420], [0, 330], [5, 250], [0, 165]];

export function buildKelp(ctx) {
  const { rng, items, game, flora } = ctx;

  // Kelp forest, leaving hidden paths clear.
  let placed = 0;
  for (let i = 0; i < 5200 && placed < 2300; i++) {
    const p = randomInZone(ctx, 'kelp', { padMargin: 4, maxR: 190 });
    if (!p) continue;
    const [x, z] = p;
    if (distToPath(x, z, PATH_GUARDIANS) < 4 || distToPath(x, z, PATH_ECHO) < 4) continue;
    if (distToPath(x, z, MAIN_ROAD) < 6 && rng.chance(0.7)) continue;
    if (Math.hypot(x - 15, z - 225) < 14) continue; // fallen giant clearing
    const y = heightAt(x, z) - 0.3;
    const tint = rng.pick([0xffffff, 0xe8ffd0, 0xfff0c0, 0xd0ffd8]);
    flora.kelp.add(x, y, z, rng.float(0, 6.28), rng.float(0.9, 1.4), rng.float(0.5, 1.15), tint);
    placed++;
  }
  // kelp at the reef's northern edge too
  for (let i = 0; i < 200; i++) {
    const x = rng.float(-150, 150), z = rng.float(400, 450);
    if (distToPath(x, z, MAIN_ROAD) < 6) continue;
    flora.kelp.add(x, heightAt(x, z) - 0.3, z, rng.float(0, 6.28), rng.float(0.8, 1.2), rng.float(0.3, 0.6), 0xffffff);
  }
  for (let i = 0; i < 90; i++) {
    const p = randomInZone(ctx, 'kelp', { padMargin: 4 });
    if (p) rock(ctx, p[0], heightAt(p[0], p[1]) - 0.5, p[1], rng.float(0.8, 3.5), rng.pick([0x6e7660, 0x5d6450, 0x7e8670]));
  }
  for (let i = 0; i < 60; i++) {
    const p = randomInZone(ctx, 'kelp', { padMargin: 3 });
    if (p) placeCoral(ctx, p[0], p[1], 0.8);
  }
  for (let i = 0; i < 50; i++) {
    const p = randomInZone(ctx, 'kelp', { padMargin: 1 });
    if (!p) continue;
    for (let k = 0; k < 20; k++) {
      const x = p[0] + rng.float(-6, 6), z = p[1] + rng.float(-6, 6);
      if (onPad(x, z, 0)) continue;
      flora.grass.add(x, heightAt(x, z) - 0.1, z, rng.float(0, 6.28), rng.float(0.8, 1.3), rng.float(0.8, 1.8), 0xd8ffb0);
    }
  }

  // Waystones along the hidden paths
  waystones(ctx, PATH_GUARDIANS, 8);
  waystones(ctx, PATH_ECHO, 8);

  buildFallenGiant(ctx, 15, 225);

  // Broken statues along the main road
  for (const [x, z, ry] of [[-14, 300, 0.4], [16, 280, -0.6], [-12, 205, 1.2]]) {
    statue(ctx, x, heightAt(x, z) - 0.3, z, ry, 1, { headless: rng.chance(0.5), armless: true });
  }
  for (const [x, z] of [[8, 330], [-8, 345], [10, 190], [-10, 245]]) {
    column(ctx, x, heightAt(x, z) - 0.3, z, 7, { broken: true });
  }

  // Guardian Circle (statue alignment) -> Shard of the Forest
  new StatuePuzzle(ctx, {
    id: 'guardians', x: -90, z: 250, shardId: 'kelp',
    statues: [
      { name: 'TIDES', emblem: 'trident', ox: -10, oz: 0, glyphs: ['sun', 'moon', 'star', 'eye'], correct: 1, start: 0, trident: true },
      { name: 'FLAME', emblem: 'flame', ox: 5, oz: -8.7, glyphs: ['wave', 'spiral', 'eye', 'moon'], correct: 2, start: 1 },
      { name: 'STONE', emblem: 'star', ox: 5, oz: 8.7, glyphs: ['wave', 'sun', 'moon', 'flame'], correct: 0, start: 2 },
    ],
  });
  items.addCarving('c_guardians', -73, heightAt(-73, 270) + 1.4, 270, Math.atan2(-35 + 73, 345 - 270));
  ctx.B.add(G.box, 'stone', T(-73, heightAt(-73, 270) + 0.5, 270, Math.atan2(-35 + 73, 345 - 270), 2.6, 1.2, 0.5), COLORS.stoneOld, 0.05);
  items.addPage('page5', -60, null, 300);

  // Echo Grotto (dolphin song door) -> Shard of Song
  new SongDoor(ctx, { x: 95, z: 330 });

  // Items
  items.addPage('page2', 22, null, 236);
  items.addRelic('statGuardian', 4, heightAt(4, 222) + 0.8, 222);
  scatterPearls(ctx, 'kelp', 28, { padMargin: 3 });
  scatterClams(ctx, 'kelp', 4, 5, { padMargin: 4 });
  items.addPearlTrail(PATH_GUARDIANS, 6);

  addSign(ctx, 8, 172, 'Marker left by Mara Quill', 'Deep water ahead: the city lies below 45 m. You need a Pressure Suit (base console) to reach the streets.');

  // Hazards and residents
  game.creatures.spawnLater('shark', 60, -18, 250, { path: [[60, 250], [120, 290], [100, 360], [40, 330]] });
  for (const [x, z] of [[-40, 330], [30, 300], [-100, 300], [-20, 220]]) {
    game.creatures.spawnLater('jelly', x, heightAt(x, z) + rng.float(5, 12), z, {});
  }
}

// A colossal statue lying in the kelp, broken into pieces.
function buildFallenGiant(ctx, x, z) {
  const { B, C } = ctx;
  const y = heightAt(x, z);
  const stone = COLORS.stoneOld;
  // head on its side
  B.add(G.ico1, 'stone', T(x - 6, y + 3, z + 2, 0.4, 3.6, 4.2, 3.8, 0, Math.PI / 2.4), stone, 0.06);
  B.add(G.cyl8, 'shiny', T(x - 6, y + 3.4, z + 2, 0.4, 7.4, 1, 7.4, 0, Math.PI / 2.4), COLORS.gold, 0.04);
  C.sphere(x - 6, y + 3, z + 2, 3.8);
  // torso
  B.add(G.cyl8, 'stone', T(x + 3, y + 2.4, z - 1, 1.1, 6, 11, 4.5, 0, Math.PI / 2), stone, 0.05);
  C.box(x + 3, y + 2.4, z - 1, 5.5, 2.4, 2.8, 1.1 - Math.PI / 2);
  // hand reaching up from the sand
  B.add(G.box, 'stone', T(x + 9, y + 2, z + 7, 0.3, 1.6, 4, 1.4, 0.2, 0.1), stone, 0.05);
  for (let f = 0; f < 4; f++) B.add(G.box, 'stone', T(x + 8.4 + f * 0.4, y + 4.4, z + 7.3, 0.3, 0.3, 1.2, 0.35, 0.3, 0), stone, 0.05);
  C.cylinder(x + 9, z + 7, 1.1, y, y + 5);
  // glyph band on the base block
  B.add(G.box, 'stone', T(x + 12, y + 1.5, z - 7, 0.3, 4, 3, 4), stone, 0.05);
  B.add(G.box, 'glow', T(x + 12, y + 2.2, z - 7, 0.3, 4.05, 0.3, 4.05), COLORS.glyph, 0.04);
  C.box(x + 12, y + 1.5, z - 7, 2, 1.5, 2, 0.3);
}
