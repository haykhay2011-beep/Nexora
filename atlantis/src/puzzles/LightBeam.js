import * as THREE from 'three';
import { T } from '../world/Batcher.js';
import { BASE_GEO as G, COLORS, column } from '../world/Props.js';

// Lightless Sanctum: wake the beacon, then turn crystals so the beam reaches the carved eye.
// One crystal has fallen from its stand and must be carried back.
const N = 7;
const CELL = 4;
const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // N E S W
const DIR_NAMES = ['north', 'east', 'south', 'west'];

export class LightBeam {
  constructor(ctx, { x, z, y, shardId }) {
    this.id = 'sanctumBeam';
    this.game = ctx.game;
    this.cx = x; this.cz = z; this.y = y;
    this.solved = false;
    this.active = false;
    this.carrying = false;
    const { B, C } = ctx;
    const sq = N * CELL;

    this.emitter = { c: 0, r: 6, dir: 1 };
    this.target = { c: 3, r: 0 };
    this.pillars = new Set(['2,3', '5,2', '1,2', '4,1']);
    this.prisms = [
      { c: 2, r: 6, dir: 0, fixed: true },
      { c: 5, r: 6, dir: 2, fixed: true },
      { c: 5, r: 4, dir: 3, fixed: true, empty: true },
      { c: 3, r: 4, dir: 1, fixed: true },
      { c: 1, r: 1, dir: 2, fixed: true },
    ];
    this.loose = { c: 0, r: 1 };

    // floor
    B.add(G.box, 'stone', T(x, y + 0.2, z, 0, sq + 2, 0.4, sq + 2), 0x2a3440, 0.05);
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      const [wx, wz] = this.cellPos(c, r);
      B.add(G.box, 'stone', T(wx, y + 0.42, wz, 0, CELL - 0.2, 0.05, CELL - 0.2), (r + c) % 2 ? 0x3a4656 : 0x323c4a, 0.04);
      B.add(G.box, 'glow', T(wx, y + 0.45, wz, 0, 0.25, 0.02, 0.25), COLORS.glyph, 0.04);
    }
    // border walls with gaps
    for (const s of [-1, 1]) {
      for (const part of [-1, 1]) {
        const off = part * (sq / 4 + 1.5);
        B.add(G.box, 'stone', T(x + off, y + 1.5, z + s * (sq / 2 + 1), 0, sq / 2 - 3, 3, 0.8), 0x3a4656, 0.05);
        C.box(x + off, y + 1.5, z + s * (sq / 2 + 1), sq / 4 - 1.5, 1.5, 0.4);
        B.add(G.box, 'stone', T(x + s * (sq / 2 + 1), y + 1.5, z + off, 0, 0.8, 3, sq / 2 - 3), 0x3a4656, 0.05);
        C.box(x + s * (sq / 2 + 1), y + 1.5, z + off, 0.4, 1.5, sq / 4 - 1.5);
      }
    }
    for (const [ox, oz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      column(ctx, x + ox * (sq / 2 + 1), y, z + oz * (sq / 2 + 1), 9, { glyph: true, color: 0xa8b4c4 });
    }
    // pillars that block light
    for (const k of this.pillars) {
      const [c, r] = k.split(',').map(Number);
      const [wx, wz] = this.cellPos(c, r);
      column(ctx, wx, y + 0.4, wz, 6, { radius: 0.9, glyph: true, color: 0xa8b4c4, broken: false });
    }
    // emitter (beacon)
    const [ex, ez] = this.cellPos(this.emitter.c, this.emitter.r);
    B.add(G.cyl8, 'stone', T(ex, y + 1, ez, 0, 1.6, 2, 1.6), 0x5a6676, 0.05);
    B.add(G.box, 'shiny', T(ex + 0.5, y + 2.1, ez, 0, 1.2, 0.5, 0.5), COLORS.gold, 0.03);
    C.cylinder(ex, ez, 0.8, y, y + 2.2);
    this.beaconOrb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.45, 1), new THREE.MeshBasicMaterial({ color: 0x334455 }));
    this.beaconOrb.position.set(ex, y + 2.6, ez);
    ctx.scene.add(this.beaconOrb);
    this.game.interact.add({
      pos: this.beaconOrb.position, radius: 3.4,
      prompt: 'Wake the beacon',
      enabled: () => !this.active,
      onUse: () => { this.active = true; this.game.audio.play('beacon'); this.trace(); },
    });

    // prism stands
    const prismGeo = new THREE.OctahedronGeometry(0.55, 0);
    prismGeo.scale(0.8, 1.4, 0.8);
    this.prismMat = new THREE.MeshBasicMaterial({ color: 0x9ad8ff });
    for (const p of this.prisms) {
      const [wx, wz] = this.cellPos(p.c, p.r);
      B.add(G.cyl6, 'stone', T(wx, y + 0.9, wz, 0, 1.1, 1, 1.1), 0x5a6676, 0.05);
      C.cylinder(wx, wz, 0.55, y, y + 1.4);
      const g = new THREE.Group();
      g.position.set(wx, y + 2.1, wz);
      const crystal = new THREE.Mesh(prismGeo, this.prismMat);
      g.add(crystal);
      const pointer = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.6, 4), new THREE.MeshBasicMaterial({ color: 0xffe38a }));
      pointer.rotation.x = Math.PI / 2;
      pointer.position.z = 0.75;
      g.add(pointer);
      g.visible = !p.empty;
      ctx.scene.add(g);
      p.group = g;
      p.angle = this.dirAngle(p.dir);
      g.rotation.y = p.angle;
      this.game.interact.add({
        pos: new THREE.Vector3(wx, y + 2, wz), radius: 3.2,
        prompt: () => (p.empty ? (this.carrying ? 'Place the crystal' : 'An empty crystal stand') : `Turn crystal (points ${DIR_NAMES[p.dir]})`),
        enabled: () => !this.solved,
        onUse: () => this.usePrism(p),
      });
    }
    // fallen crystal lying on the floor
    const [lx, lz] = this.cellPos(this.loose.c, this.loose.r);
    this.looseMesh = new THREE.Mesh(prismGeo, this.prismMat);
    this.looseMesh.position.set(lx, y + 0.8, lz);
    this.looseMesh.rotation.z = 1.2;
    ctx.scene.add(this.looseMesh);
    this.game.interact.add({
      pos: this.looseMesh.position, radius: 3,
      prompt: 'Pick up the fallen crystal',
      enabled: () => this.looseMesh.visible && !this.carrying,
      onUse: () => { this.carrying = true; this.looseMesh.visible = false; this.held.visible = true; this.game.audio.play('pickup'); },
    });
    this.held = new THREE.Mesh(prismGeo, this.prismMat);
    this.held.scale.setScalar(0.35);
    this.held.position.set(0.35, -0.3, -0.8);
    this.held.visible = false;
    this.game.camera.add(this.held);

    // target eye and vault on the north side
    const [tx, tz] = this.cellPos(this.target.c, this.target.r);
    this.eyeMat = new THREE.MeshBasicMaterial({ color: 0x223040 });
    B.add(G.box, 'stone', T(tx, y + 1.5, tz - 1, 0, 3, 3, 1), 0x5a6676, 0.05);
    C.box(tx, y + 1.5, tz - 1, 1.5, 1.5, 0.5);
    this.eye = new THREE.Mesh(new THREE.SphereGeometry(0.7, 12, 8), this.eyeMat);
    this.eye.scale.set(1.3, 0.8, 0.4);
    this.eye.position.set(tx, y + 2.1, tz - 0.45);
    ctx.scene.add(this.eye);
    const vz = z - sq / 2 - 6;
    this.buildVault(ctx, x, y, vz);
    this.shard = ctx.items.addShard(shardId, x, y + 2.2, vz);

    // beam meshes
    this.beamMat = new THREE.MeshBasicMaterial({ color: 0xbfefff, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
    this.glowMat = new THREE.MeshBasicMaterial({ color: 0x6aa8ff, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false });
    this.beams = [];
    const bgeo = new THREE.CylinderGeometry(0.09, 0.09, 1, 6);
    bgeo.rotateX(Math.PI / 2);
    const ggeo = new THREE.CylinderGeometry(0.35, 0.35, 1, 8);
    ggeo.rotateX(Math.PI / 2);
    for (let i = 0; i < 12; i++) {
      const m = new THREE.Mesh(bgeo, this.beamMat);
      const gl = new THREE.Mesh(ggeo, this.glowMat);
      m.add(gl);
      m.visible = false;
      ctx.scene.add(m);
      this.beams.push(m);
    }
    this.beamEnd = new THREE.Vector3();
    this.beamLight = ctx.world.addLight({ pos: this.beamEnd, color: 0x9ad8ff, intensity: 25, distance: 18, active: () => this.active });
    this.game.puzzles.register(this);
  }

  cellPos(c, r) {
    return [this.cx + (c - (N - 1) / 2) * CELL, this.cz + (r - (N - 1) / 2) * CELL];
  }

  dirAngle(d) {
    return Math.atan2(DIRS[d][0], DIRS[d][1]);
  }

  buildVault(ctx, x, y, vz) {
    const { B, C } = ctx;
    const w = 8, d = 7, h = 6;
    B.add(G.box, 'stone', T(x, y + h / 2, vz - d / 2, 0, w, h, 0.8), 0x3a4656, 0.05);
    C.box(x, y + h / 2, vz - d / 2, w / 2, h / 2, 0.4);
    for (const s of [-1, 1]) {
      B.add(G.box, 'stone', T(x + s * w / 2, y + h / 2, vz, 0, 0.8, h, d), 0x3a4656, 0.05);
      C.box(x + s * w / 2, y + h / 2, vz, 0.4, h / 2, d / 2);
      B.add(G.box, 'stone', T(x + s * 2.75, y + h / 2, vz + d / 2, 0, 2.5, h, 0.8), 0x3a4656, 0.05);
      C.box(x + s * 2.75, y + h / 2, vz + d / 2, 1.25, h / 2, 0.4);
    }
    B.add(G.box, 'stone', T(x, y + h + 0.3, vz, 0, w + 1, 0.6, d + 1), 0x2a3440, 0.05);
    C.box(x, y + h + 0.3, vz, w / 2 + 0.5, 0.3, d / 2 + 0.5);
    B.add(G.box, 'glow', T(x, y + h - 0.5, vz + d / 2 + 0.42, 0, 5, 0.3, 0.04), COLORS.glyph, 0.04);
    this.gate = new THREE.Mesh(new THREE.BoxGeometry(3, h - 1, 0.5), new THREE.MeshPhongMaterial({ color: 0x8a96a8, flatShading: true }));
    this.gate.position.set(x, y + (h - 1) / 2, vz + d / 2);
    ctx.scene.add(this.gate);
    this.gateBase = this.gate.position.y;
    this.gateT = 0;
    this.gateCol = C.box(x, this.gateBase, vz + d / 2, 1.5, (h - 1) / 2, 0.4, 0, true);
    ctx.world.addLight({ pos: new THREE.Vector3(x, y + 3, vz), color: 0x6aa8ff, intensity: 14, distance: 12, active: () => this.solved });
  }

  usePrism(p) {
    if (p.empty) {
      if (!this.carrying) {
        this.game.ui.toast('The stand is empty.', 'info', 'A crystal must have fallen somewhere nearby.');
        return;
      }
      p.empty = false;
      p.group.visible = true;
      this.carrying = false;
      this.held.visible = false;
      this.game.audio.play('place');
    } else {
      p.dir = (p.dir + 1) % 4;
      this.game.audio.play('crystal');
    }
    this.trace();
  }

  // Follow the beam across the grid.
  trace() {
    if (!this.active) return;
    let c = this.emitter.c, r = this.emitter.r, dir = this.emitter.dir;
    const pts = [this.cellPos(c, r)];
    let hit = false;
    const seen = new Set();
    for (let steps = 0; steps < 60; steps++) {
      c += DIRS[dir][0]; r += DIRS[dir][1];
      if (c < 0 || r < 0 || c >= N || r >= N) {
        const [wx, wz] = this.cellPos(c, r);
        pts.push([wx, wz]);
        break;
      }
      if (this.pillars.has(`${c},${r}`)) {
        const [wx, wz] = this.cellPos(c, r);
        pts.push([wx - DIRS[dir][0] * 1.1, wz - DIRS[dir][1] * 1.1]);
        break;
      }
      if (c === this.target.c && r === this.target.r) {
        pts.push(this.cellPos(c, r));
        hit = dir === 0;
        break;
      }
      const prism = this.prisms.find((p) => p.c === c && p.r === r && !p.empty);
      if (prism) {
        const key = `${c},${r},${dir}`;
        if (seen.has(key)) break;
        seen.add(key);
        pts.push(this.cellPos(c, r));
        dir = prism.dir;
      }
    }
    this.path = pts;
    this.drawBeam();
    if (hit && !this.solved) {
      setTimeout(() => this.game.puzzles.solve(this, 'The carved eye blazes with light. The vault opens!'), 800);
    }
  }

  drawBeam() {
    const by = this.y + 2.2;
    const pts = this.path || [];
    this.beams.forEach((m, i) => {
      if (i >= pts.length - 1) { m.visible = false; return; }
      const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
      const len = Math.hypot(bx - ax, bz - az);
      m.visible = len > 0.01;
      m.position.set((ax + bx) / 2, by, (az + bz) / 2);
      m.scale.set(1, 1, len);
      m.rotation.set(0, Math.atan2(bx - ax, bz - az), 0);
    });
    if (pts.length) {
      const last = pts[pts.length - 1];
      this.beamEnd.set(last[0], by, last[1]);
    }
  }

  onSolved(silent) {
    this.solved = true;
    this.active = true;
    if (silent) {
      // restore the solved arrangement
      const sol = { '2,6': 1, '5,6': 0, '5,4': 3, '3,4': 0 };
      for (const p of this.prisms) {
        const k = `${p.c},${p.r}`;
        if (sol[k] !== undefined) p.dir = sol[k];
        p.empty = false;
        p.group.visible = true;
      }
      this.looseMesh.visible = false;
      this.gateT = 1;
      this.trace();
    }
    this.eyeMat.color.setHex(0xbfefff);
    this.gateCol.enabled = false;
  }

  update(dt) {
    for (const p of this.prisms) {
      const target = this.dirAngle(p.dir);
      let d = target - p.angle;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      p.angle += d * Math.min(1, dt * 6);
      p.group.rotation.y = p.angle;
    }
    const t = this.game.time;
    this.beaconOrb.material.color.setHex(this.active ? 0xbfefff : 0x334455);
    this.beaconOrb.scale.setScalar(this.active ? 1 + Math.sin(t * 4) * 0.08 : 1);
    this.prismMat.color.setHSL(0.56, 0.8, this.active ? 0.75 : 0.45);
    if (this.active) this.beamMat.opacity = 0.75 + Math.sin(t * 7) * 0.1;
    if (this.solved && this.gateT < 1) this.gateT = Math.min(1, this.gateT + dt * 0.3);
    this.gate.position.y = this.gateBase + this.gateT * 5.5;
    if (!this.looseMesh.visible) return;
    this.looseMesh.rotation.y += dt * 0.5;
  }
}
