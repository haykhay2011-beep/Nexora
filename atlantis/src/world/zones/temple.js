import * as THREE from 'three';
import { T } from '../Batcher.js';
import { BASE_GEO as G, M, column, statue, stairs, rock, house, COLORS } from '../Props.js';
import { scatterPearls, scatterClams, randomInZone, onPad } from './common.js';
import { heightAt } from '../Terrain.js';
import { getMaterials } from '../Materials.js';
import { GlyphDoor, shrineTabletTexture } from '../../puzzles/GlyphDoor.js';

const CODE = ['spiral', 'sun', 'trident', 'moon'];
const SHRINES = [[285, -105], [425, -100], [265, -245], [435, -275]];

export function buildTemple(ctx) {
  const { rng, items, game } = ctx;
  buildGreatTemple(ctx, 360, -200);
  SHRINES.forEach(([x, z], i) => buildShrine(ctx, x, z, i));

  // Avenue of guardians from the city side
  for (let k = 0; k < 7; k++) {
    const x = 215 + k * 14;
    for (const s of [-1, 1]) {
      const z = -192 + s * 9;
      statue(ctx, x, heightAt(x, z) - 0.2, z, s > 0 ? Math.PI : 0, 0.9, { trident: k % 2 === 0, emblem: true, headless: rng.chance(0.2) });
    }
  }
  // obelisks
  for (const [x, z] of [[300, -150], [420, -150], [300, -250], [420, -250], [250, -170], [460, -200]]) {
    const y = heightAt(x, z);
    ctx.B.add(G.box, 'stone', T(x, y + 6, z, 0.2, 1.8, 12, 1.8), 0x5d6673, 0.04);
    ctx.B.add(G.cone5, 'shiny', T(x, y + 12.8, z, 0.2 + Math.PI / 4, 2.4, 1.6, 2.4), COLORS.gold, 0.03);
    ctx.B.add(G.box, 'glow', T(x, y + 8, z, 0.2, 1.85, 4, 0.2), COLORS.glyph, 0.04);
    ctx.C.box(x, y + 6, z, 0.9, 6, 0.9, 0.2);
  }
  // ruined lesser temples
  for (const [x, z, ry] of [[250, -60, 0.3], [440, -320, 1.2], [230, -290, -0.4], [480, -140, 0.8]]) {
    lesserTemple(ctx, x, z, ry);
  }
  items.addRelic('coinMoon', 250, heightAt(250, -60) + 1.2, -60);
  for (let i = 0; i < 70; i++) {
    const p = randomInZone(ctx, 'temple', { padMargin: 4 });
    if (p) rock(ctx, p[0], heightAt(p[0], p[1]) - 0.5, p[1], rng.float(0.8, 3), rng.pick([0x5d6673, 0x6c7684]));
  }
  for (let i = 0; i < 30; i++) {
    const p = randomInZone(ctx, 'temple', { padMargin: 4 });
    if (!p) continue;
    column(ctx, p[0], heightAt(p[0], p[1]) - 0.3, p[1], rng.float(5, 9), { broken: true, glyph: true, color: 0xd8d2c2 });
  }
  scatterPearls(ctx, 'temple', 26, { padMargin: 3 });
  scatterClams(ctx, 'temple', 4, 7, { padMargin: 4 });

  // eels in the temple walls and rocks
  for (const [x, z, dx, dz] of [[340, -170, 1, 0], [395, -230, 0, 1], [300, -120, -1, 0], [420, -170, 0, -1]]) {
    game.creatures.spawnLater('eel', x, heightAt(x, z) + 1, z, { dir: [dx, dz] });
  }
  game.creatures.spawnLater('shark', 330, -60, -260, { path: [[330, -260], [440, -230], [420, -120], [300, -110], [250, -220]] });
}

function buildGreatTemple(ctx, x, z) {
  const { B, C, items, world, game } = ctx;
  const y = -74;
  // stepped platform (temple axis along X, entrance on the west side)
  const tiers = [[38, 28, 1.2], [34, 24, 1.2], [30, 20, 1.2]];
  let ty = y;
  for (const [w, d, h] of tiers) {
    B.add(G.box, 'stone', T(x, ty + h / 2, z, 0, w, h, d), COLORS.stone, 0.03);
    C.box(x, ty + h / 2, z, w / 2, h / 2, d / 2);
    ty += h;
  }
  const top = ty; // y + 3.6
  stairs(ctx, x - 20.5, y, z, 8, 3, 1.2, 1.3, -Math.PI / 2);
  // gold trim on top tier
  B.add(G.box, 'shiny', T(x, top + 0.05, z, 0, 30.2, 0.12, 20.2), COLORS.gold, 0.02);
  // peristyle
  const colH = 10;
  for (let cx = -13; cx <= 13; cx += 4.33) {
    for (const s of [-1, 1]) column(ctx, x + cx, top, z + s * 8.5, colH, { glyph: true, radius: 0.75 });
  }
  for (let cz = -4.25; cz <= 4.25; cz += 4.25) {
    for (const s of [-1, 1]) {
      if (s < 0 && cz === 0) continue; // keep the door clear
      column(ctx, x + s * 13, top, z + cz, colH, { glyph: true, radius: 0.75 });
    }
  }
  // roof and pediments
  const roofY = top + colH + 1.1;
  B.add(G.box, 'stone', T(x, roofY, z, 0, 31, 1.2, 21), COLORS.stone, 0.03);
  B.add(G.box, 'shiny', T(x, roofY - 0.7, z, 0, 31.4, 0.3, 21.4), COLORS.gold, 0.02);
  B.add(G.box, 'glow', T(x, roofY - 0.2, z, 0, 31.2, 0.25, 21.2), COLORS.glyph, 0.03);
  C.box(x, roofY, z, 15.5, 0.6, 10.5);
  // pitched roof as a triangular prism (a 3-sided cylinder on its side)
  B.add(new THREE.CylinderGeometry(1, 1, 1, 3), 'stone', T(x, roofY + 2.2, z, 0, 31, 3.6, 12, 0, Math.PI / 2), 0xd8d2c2, 0.03);
  for (const s of [-1, 1]) B.add(G.cone5, 'shiny', T(x + s * 15.2, roofY + 4.8, z, 0, 0.8, 1.6, 0.8), COLORS.gold, 0.03);

  // cella (inner chamber) with the glyph door on the west wall
  const cw = 16, cd = 11, ch = colH;
  const wallC = 0xe2dccb;
  B.add(G.box, 'stone', T(x + cw / 2, top + ch / 2, z, 0, 0.8, ch, cd), wallC, 0.03);
  C.box(x + cw / 2, top + ch / 2, z, 0.4, ch / 2, cd / 2);
  for (const s of [-1, 1]) {
    B.add(G.box, 'stone', T(x, top + ch / 2, z + s * cd / 2, 0, cw, ch, 0.8), wallC, 0.03);
    C.box(x, top + ch / 2, z + s * cd / 2, cw / 2, ch / 2, 0.4);
    // front wall pieces either side of the door
    B.add(G.box, 'stone', T(x - cw / 2, top + ch / 2, z + s * 3.6, 0, 0.8, ch, 3.8), wallC, 0.03);
    C.box(x - cw / 2, top + ch / 2, z + s * 3.6, 0.4, ch / 2, 1.9);
  }
  B.add(G.box, 'stone', T(x - cw / 2, top + 6 + (ch - 6) / 2, z, 0, 0.8, ch - 6, 3.6), wallC, 0.03);
  C.box(x - cw / 2, top + 6 + (ch - 6) / 2, z, 0.4, (ch - 6) / 2, 1.8);
  B.add(G.box, 'glow', T(x - cw / 2 - 0.42, top + 7, z, 0, 0.05, 0.4, 3.4), COLORS.glyph, 0.03);

  // door
  const door = new GlyphDoor(ctx, {
    id: 'templeDoor', x: x - cw / 2 - 0.1, y: top, z, ry: -Math.PI / 2, width: 3.6, height: 6, code: CODE,
  });
  // interior
  B.add(G.box, 'stone', T(x + 4, top + 0.7, z, 0, 2.4, 1.4, 2.4), COLORS.stoneDark, 0.04);
  B.add(G.box, 'shiny', T(x + 4, top + 1.45, z, 0, 2.6, 0.12, 2.6), COLORS.gold, 0.03);
  C.box(x + 4, top + 0.7, z, 1.2, 0.7, 1.2);
  items.addShard('temple', x + 4, top + 2.8, z);
  items.addRelic('statQueen', x + 6, top + 1, z + 3.5);
  items.addPage('page9', x + 6, top + 1, z - 3.5);
  const air = new THREE.Mesh(new THREE.PlaneGeometry(cw - 1, cd - 1), getMaterials().airPocket);
  air.rotation.x = Math.PI / 2;
  air.position.set(x, top + ch - 1.6, z);
  ctx.scene.add(air);
  world.addAirPocket(x, top + ch - 0.6, z, 3.6);
  world.addAirPocket(x + 4.5, top + ch - 0.6, z, 3.2);
  world.addAirPocket(x - 4.5, top + ch - 0.6, z, 3.2);
  world.addLight({ pos: new THREE.Vector3(x + 2, top + 5, z), color: 0xc59bff, intensity: 18, distance: 16, active: () => door.solved });
  items.addPage('page7', x - 26, null, z + 8);
  // flanking statues at the stairs
  for (const s of [-1, 1]) statue(ctx, x - 24, y, z + s * 7, -Math.PI / 2, 1.4, { trident: true, emblem: true });
}

function buildShrine(ctx, x, z, i) {
  const { B, C, items, scene } = ctx;
  const y = heightAt(x, z);
  B.add(G.cyl12, 'stone', T(x, y + 0.4, z, 0, 11, 0.8, 11), COLORS.stone, 0.03);
  C.cylinder(x, z, 5.5, y - 2, y + 0.8);
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    column(ctx, x + Math.cos(a) * 4.2, y + 0.8, z + Math.sin(a) * 4.2, 5.5, { radius: 0.45, glyph: true });
  }
  B.add(G.cyl12, 'stone', T(x, y + 7, z, 0, 10.6, 0.6, 10.6), COLORS.stone, 0.03);
  B.add(G.hemi, 'stone', T(x, y + 7.3, z, 0, 4.6, 3, 4.6), 0xd8d2c2, 0.03);
  B.add(G.cone6, 'shiny', T(x, y + 10.7, z, 0, 0.6, 1.4, 0.6), COLORS.gold, 0.03);
  C.cylinder(x, z, 5.3, y + 6.7, y + 10.5);
  // tablet on a pedestal, facing the great temple
  const face = Math.atan2(360 - x, -200 - z);
  B.add(G.box, 'stone', T(x, y + 1.6, z, face, 2.6, 1.6, 0.8), COLORS.stoneDark, 0.03);
  C.box(x, y + 1.6, z, 1.3, 0.8, 0.4, face);
  const tab = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.0), new THREE.MeshBasicMaterial({ map: shrineTabletTexture(CODE[i], i) }));
  tab.position.set(x + Math.sin(face) * 0.42, y + 1.9, z + Math.cos(face) * 0.42);
  tab.rotation.y = face;
  tab.rotation.x = 0;
  scene.add(tab);
  items.addCarving(`c_shrine${i + 1}`, x, y + 1.9, z, face, 2.4, 1, false);
  ctx.world.addLight({ pos: new THREE.Vector3(x, y + 4, z), color: 0x7ff3ff, intensity: 8, distance: 12 });
  if (i === 2) items.addRelic('maskTide', x - 2, y + 1.5, z + 2);
}

function lesserTemple(ctx, x, z, ry) {
  const { B, C, rng } = ctx;
  const y = heightAt(x, z);
  const base = T(x, y, z, ry);
  B.add(G.box, 'stone', M(base, 0, 0.6, 0, 0, 14, 1.2, 10), COLORS.stoneOld, 0.04);
  C.box(x, y + 0.6, z, 7, 0.6, 5, ry);
  const cos = Math.cos(ry), sin = Math.sin(ry);
  for (let i = -2; i <= 2; i++) {
    for (const s of [-1, 1]) {
      const lx = i * 3.2, lz = s * 4;
      column(ctx, x + lx * cos + lz * sin, y + 1.2, z - lx * sin + lz * cos, 7, { broken: rng.chance(0.5), glyph: true, radius: 0.55 });
    }
  }
  if (rng.chance(0.5)) {
    B.add(G.box, 'stone', M(base, -2, 1.6, 0, 0.3, 8, 0.8, 5, 0, 0.3), COLORS.stoneOld, 0.05);
  }
}
