import * as THREE from 'three';
import { T } from '../world/Batcher.js';
import { BASE_GEO as G, COLORS, column } from '../world/Props.js';
import { glyphMaterial } from '../world/Materials.js';

// Market Square: stones slide across polished tiles until something stops them; plates catch them.
// All three plates covered opens the vault.
const LAYOUT = [
  '#..P...',
  '.B...#.',
  '....B..',
  '..#...P',
  'P......',
  '...#.B.',
  '.#.....',
];
const CELL = 3;
const N = LAYOUT.length;

export class PlatePuzzle {
  constructor(ctx, { x, z, y, shardId }) {
    this.id = 'marketPlates';
    this.game = ctx.game;
    this.solved = false;
    this.cx = x; this.cz = z; this.y = y;
    const { B, C } = ctx;
    this.walls = new Set();
    this.plates = new Set();
    const starts = [];
    const sq = N * CELL;
    // polished floor
    B.add(G.box, 'shiny', T(x, y + 0.1, z, 0, sq + 0.6, 0.3, sq + 0.6), 0xdcd6c8, 0.03);
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const ch = LAYOUT[r][c];
        const [wx, wz] = this.cellPos(c, r);
        if ((r + c) % 2 === 0) B.add(G.box, 'shiny', T(wx, y + 0.27, wz, 0, CELL - 0.1, 0.05, CELL - 0.1), 0xc9c2b2, 0.03);
        if (ch === '#') {
          this.walls.add(`${c},${r}`);
          B.add(G.cyl8, 'stone', T(wx, y + 1.2, wz, 0, 2.4, 2.4, 2.4), COLORS.stoneOld, 0.06);
          B.add(G.cone5, 'stone', T(wx, y + 2.6, wz, c, 2.2, 0.8, 2.2), COLORS.stoneOld, 0.08);
          C.cylinder(wx, wz, 1.25, y - 1, y + 3);
        } else if (ch === 'P') {
          this.plates.add(`${c},${r}`);
          B.add(G.box, 'shiny', T(wx, y + 0.3, wz, 0, 2.7, 0.12, 2.7), COLORS.gold, 0.03);
          B.add(G.box, 'glow', T(wx, y + 0.37, wz, 0, 1.6, 0.04, 1.6), COLORS.glyph, 0.03);
        } else if (ch === 'B') starts.push([c, r]);
      }
    }
    // low wall around the square
    for (const s of [-1, 1]) {
      B.add(G.box, 'stone', T(x + s * (sq / 2 + 0.6), y + 0.6, z, 0, 1, 1.2, sq + 2.2), COLORS.stone, 0.05);
      B.add(G.box, 'stone', T(x, y + 0.6, z + s * (sq / 2 + 0.6), 0, sq + 2.2, 1.2, 1), COLORS.stone, 0.05);
      C.box(x + s * (sq / 2 + 0.6), y + 0.6, z, 0.5, 0.6, sq / 2 + 1.1);
      C.box(x, y + 0.6, z + s * (sq / 2 + 0.6), sq / 2 + 1.1, 0.6, 0.5);
    }
    for (const [ox, oz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      column(ctx, x + ox * (sq / 2 + 1.5), y, z + oz * (sq / 2 + 1.5), 8, { glyph: true });
    }

    // stone blocks
    const blockGeo = new THREE.BoxGeometry(2.5, 2.5, 2.5);
    const blockMat = new THREE.MeshLambertMaterial({ color: 0xb8ae98, flatShading: true });
    const topMat = glyphMaterial('trident', { bg: '#8a8270', color: '#ffe38a' });
    this.blocks = starts.map(([c, r], i) => {
      const mesh = new THREE.Mesh(blockGeo, blockMat);
      const top = new THREE.Mesh(G.plane, topMat);
      top.rotation.x = -Math.PI / 2;
      top.position.y = 1.26;
      top.scale.setScalar(1.8);
      mesh.add(top);
      ctx.scene.add(mesh);
      const [wx, wz] = this.cellPos(c, r);
      const col = C.box(wx, y + 1.55, wz, 1.25, 1.25, 1.25, 0, true);
      const b = { i, c, r, sc: c, sr: r, mesh, col, pos: new THREE.Vector3(wx, y + 1.55, wz), moving: false };
      mesh.position.copy(b.pos);
      this.game.interact.add({
        pos: b.pos, radius: 3.6,
        prompt: () => (this.onPlate(b) ? 'The plate holds this stone fast' : 'Push stone'),
        enabled: () => !this.solved && !b.moving,
        onUse: () => this.push(b),
      });
      return b;
    });

    // vault north of the square
    const vz = z - sq / 2 - 7;
    this.buildVault(ctx, x, y, vz);
    this.shard = ctx.items.addShard(shardId, x, y + 2, vz - 1, { hidden: false });

    // reset lever
    const lx = x + sq / 2 + 3, lz = z - sq / 2 - 1;
    B.add(G.box, 'stone', T(lx, y + 0.6, lz, 0, 1.2, 1.2, 1.2), COLORS.stoneDark, 0.05);
    this.lever = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.8, 6), new THREE.MeshPhongMaterial({ color: COLORS.gold, flatShading: true }));
    this.lever.position.set(lx, y + 1.9, lz);
    this.lever.rotation.z = 0.5;
    ctx.scene.add(this.lever);
    C.box(lx, y + 0.6, lz, 0.6, 0.6, 0.6);
    this.game.interact.add({
      pos: new THREE.Vector3(lx, y + 1.8, lz), radius: 3,
      prompt: 'Pull the reset lever',
      enabled: () => !this.solved,
      onUse: () => this.reset(),
    });
    this.game.puzzles.register(this);
  }

  cellPos(c, r) {
    return [this.cx + (c - (N - 1) / 2) * CELL, this.cz + (r - (N - 1) / 2) * CELL];
  }

  buildVault(ctx, x, y, vz) {
    const { B, C } = ctx;
    const w = 9, d = 8, h = 6;
    B.add(G.box, 'stone', T(x, y + h / 2, vz - d / 2, 0, w, h, 0.8), COLORS.stone, 0.05);
    C.box(x, y + h / 2, vz - d / 2, w / 2, h / 2, 0.4);
    for (const s of [-1, 1]) {
      B.add(G.box, 'stone', T(x + s * w / 2, y + h / 2, vz, 0, 0.8, h, d), COLORS.stone, 0.05);
      C.box(x + s * w / 2, y + h / 2, vz, 0.4, h / 2, d / 2);
      B.add(G.box, 'stone', T(x + s * 3, y + h / 2, vz + d / 2, 0, 3, h, 0.8), COLORS.stone, 0.05);
      C.box(x + s * 3, y + h / 2, vz + d / 2, 1.5, h / 2, 0.4);
    }
    B.add(G.box, 'stone', T(x, y + h + 0.3, vz, 0, w + 1, 0.6, d + 1), COLORS.stoneDark, 0.05);
    C.box(x, y + h + 0.3, vz, w / 2 + 0.5, 0.3, d / 2 + 0.5);
    B.add(G.box, 'stone', T(x, y + h - 0.6, vz + d / 2, 0, 3, 1.2, 0.8), COLORS.stone, 0.05);
    B.add(G.box, 'shiny', T(x, y + h + 0.7, vz, 0, w + 1.2, 0.25, d + 1.2), COLORS.gold, 0.04);
    for (const s of [-1, 1]) B.add(G.cone6, 'shiny', T(x + s * 4, y + h + 1.4, vz + d / 2, 0, 0.6, 1.2, 0.6), COLORS.gold, 0.04);
    // gate
    this.gate = new THREE.Mesh(new THREE.BoxGeometry(3, h - 1.2, 0.5), new THREE.MeshPhongMaterial({ color: 0xb08a3a, flatShading: true, shininess: 60 }));
    this.gate.position.set(x, y + (h - 1.2) / 2, vz + d / 2);
    ctx.scene.add(this.gate);
    this.gateBaseY = this.gate.position.y;
    this.gateT = 0;
    this.gateCol = C.box(x, this.gateBaseY, vz + d / 2, 1.5, (h - 1.2) / 2, 0.4, 0, true);
    ctx.world.addLight({ pos: new THREE.Vector3(x, y + 3, vz), color: 0xffe38a, intensity: 18, distance: 14, active: () => this.solved });
  }

  occupied(c, r, except) {
    if (c < 0 || r < 0 || c >= N || r >= N) return true;
    if (this.walls.has(`${c},${r}`)) return true;
    return this.blocks.some((b) => b !== except && b.c === c && b.r === r);
  }

  onPlate(b) {
    return this.plates.has(`${b.c},${b.r}`);
  }

  push(b) {
    if (this.onPlate(b)) {
      this.game.ui.toast('The plate holds this stone fast.', 'info', 'Use the reset lever if you need to start over.');
      return;
    }
    const p = this.game.player.pos;
    const dx = b.pos.x - p.x, dz = b.pos.z - p.z;
    let dc = 0, dr = 0;
    if (Math.abs(dx) > Math.abs(dz)) dc = Math.sign(dx); else dr = Math.sign(dz);
    let c = b.c, r = b.r;
    while (!this.occupied(c + dc, r + dr, b)) {
      c += dc; r += dr;
      if (this.plates.has(`${c},${r}`)) break;
    }
    if (c === b.c && r === b.r) {
      this.game.audio.play('thud');
      return;
    }
    b.c = c; b.r = r;
    b.moving = true;
    this.game.audio.play('slide');
    this.check();
  }

  check() {
    if (this.blocks.every((b) => this.onPlate(b))) {
      setTimeout(() => this.game.puzzles.solve(this, 'Every plate is weighed. The vault gate rises!'), 1200);
    }
  }

  reset() {
    this.lever.rotation.z = -this.lever.rotation.z;
    this.game.audio.play('stone');
    for (const b of this.blocks) { b.c = b.sc; b.r = b.sr; b.moving = true; }
  }

  onSolved(silent) {
    this.solved = true;
    if (silent) {
      const platesArr = [...this.plates].map((k) => k.split(',').map(Number));
      this.blocks.forEach((b, i) => { [b.c, b.r] = platesArr[i]; b.moving = true; });
      this.gateT = 1;
    }
    this.gateCol.enabled = false;
  }

  update(dt) {
    for (const b of this.blocks) {
      const [tx, tz] = this.cellPos(b.c, b.r);
      const dx = tx - b.pos.x, dz = tz - b.pos.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.01) {
        const step = Math.min(d, dt * 7);
        b.pos.x += (dx / d) * step;
        b.pos.z += (dz / d) * step;
      } else if (b.moving) {
        b.pos.x = tx; b.pos.z = tz;
        b.moving = false;
        if (this.onPlate(b)) this.game.audio.play('thud');
      }
      b.mesh.position.copy(b.pos);
      b.col.cx = b.pos.x; b.col.cz = b.pos.z;
    }
    if (this.solved && this.gateT < 1) this.gateT = Math.min(1, this.gateT + dt * 0.3);
    this.gate.position.y = this.gateBaseY + this.gateT * 4.5;
  }
}
