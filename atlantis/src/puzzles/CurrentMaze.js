import * as THREE from 'three';
import { T } from '../world/Batcher.js';
import { BASE_GEO as G, COLORS, column } from '../world/Props.js';
import { shared, getMaterials } from '../world/Materials.js';

// Ember Labyrinth: a roofed maze of strong water currents. You cannot swim against them;
// ride the right ones to reach the forge chamber.
const LAYOUT = [
  '#########',
  '#GG<<<<<#',
  '#GG####^#',
  '##v#...^#',
  '#.v#.#.^#',
  '#.v#^#.^#',
  '#.v<^#>^#',
  '#...^.###',
  '####E####',
];
const DIRS = { '>': [1, 0], '<': [-1, 0], '^': [0, -1], v: [0, 1] };
const CELL = 5;
const H = 4.6;
const FORCE = 27;

export class CurrentMaze {
  constructor(ctx, { x, z, y, shardId }) {
    this.id = 'emberMaze';
    this.game = ctx.game;
    this.mx = x; this.mz = z; this.y = y;
    this.solved = false;
    const { B, C } = ctx;
    const n = LAYOUT.length;
    const half = (n * CELL) / 2;
    this.n = n;
    const wallColor = 0x3a2c2a, lava = 0xff6a2a;
    // floor
    B.add(G.box, 'stone', T(x, y + 0.15, z, 0, n * CELL, 0.3, n * CELL), 0x2c2224, 0.06);
    const flowCells = [];
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        const ch = LAYOUT[r][c];
        const [wx, wz] = this.cellPos(c, r);
        if (ch === '#') {
          B.add(G.box, 'stone', T(wx, y + H / 2, wz, 0, CELL, H, CELL), wallColor, 0.08);
          C.box(wx, y + H / 2, wz, CELL / 2, H / 2, CELL / 2);
          // glowing cracks on inner faces
          if (Math.random() < 0.35) B.add(G.box, 'emissive', T(wx, y + 1 + Math.random() * 2, wz, Math.random() * 3, CELL + 0.04, 0.08, 0.3), lava, 0.2);
        } else if (DIRS[ch]) {
          flowCells.push({ c, r, d: DIRS[ch], wx, wz });
          // arrow on the floor
          const ang = Math.atan2(DIRS[ch][0], DIRS[ch][1]);
          B.add(G.cone5, 'emissive', T(wx, y + 0.35, wz, ang, 1.2, 1.6, 0.25, Math.PI / 2), 0xffb070, 0.05);
        }
      }
    }
    // roof
    B.add(G.box, 'stone', T(x, y + H + 0.6, z, 0, n * CELL + 1, 1.2, n * CELL + 1), 0x2c2224, 0.06);
    C.box(x, y + H + 0.6, z, half + 0.5, 0.6, half + 0.5);
    for (let k = 0; k < 12; k++) {
      B.add(G.cone5, 'stone', T(x + (Math.random() - 0.5) * n * CELL * 0.9, y + H + 2, z + (Math.random() - 0.5) * n * CELL * 0.9, Math.random() * 6, 3, 3 + Math.random() * 3, 3), 0x2a2022, 0.1);
    }
    // entrance facade
    const [ex, ez] = this.cellPos(4, 8);
    for (const s of [-1, 1]) column(ctx, ex + s * 3.6, y, ez + 3, 7, { glyph: true, color: 0x8a7a70 });
    B.add(G.box, 'stone', T(ex, y + 7.2, ez + 3, 0, 9, 1, 1.6), 0x5a4a44, 0.05);
    B.add(G.box, 'emissive', T(ex, y + 7.2, ez + 3.82, 0, 6, 0.25, 0.05), lava, 0.05);

    this.flowCells = flowCells;
    this.buildFlowParticles(ctx, flowCells);

    // hot jets inside corridors (timed bursts)
    this.jets = [[6, 4], [7, 4], [2, 5], [5, 1]].map(([c, r], i) => {
      const [wx, wz] = this.cellPos(c, r);
      const mesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.6, 1.4, H, 8, 1, true),
        new THREE.MeshBasicMaterial({ color: 0xff8a40, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
      );
      mesh.position.set(wx, y + H / 2, wz);
      ctx.scene.add(mesh);
      B.add(G.cyl8, 'emissive', T(wx, y + 0.32, wz, 0, 1.4, 0.1, 1.4), 0xff5a20, 0.05);
      return { x: wx, z: wz, mesh, phase: i * 1.3 };
    });

    // air pockets: middle room and goal room
    const [ax, az] = this.cellPos(5, 3);
    const [gx, gz] = this.cellPos(1.5, 1.5);
    for (const [px, pz, w] of [[ax, az, 4], [gx, gz, 9]]) {
      const air = new THREE.Mesh(new THREE.PlaneGeometry(w, w), getMaterials().airPocket);
      air.rotation.x = Math.PI / 2;
      air.position.set(px, y + H - 0.8, pz);
      ctx.scene.add(air);
      ctx.world.addAirPocket(px, y + H - 0.2, pz, 2.4);
    }
    // goal
    B.add(G.box, 'stone', T(gx, y + 0.7, gz, 0, 2.2, 1.2, 2.2), 0x5a4a44, 0.05);
    B.add(G.box, 'emissive', T(gx, y + 1.32, gz, 0, 2.3, 0.08, 2.3), lava, 0.05);
    C.box(gx, y + 0.7, gz, 1.1, 0.6, 1.1);
    this.shard = ctx.items.addShard(shardId, gx, y + 2.6, gz);
    ctx.items.addRelic('crown', gx + 2.6, y + 0.8, gz + 2.2);
    ctx.world.addLight({ pos: new THREE.Vector3(gx, y + 3, gz), color: 0xff8a5c, intensity: 16, distance: 14 });
    ctx.world.addLight({ pos: new THREE.Vector3(ex, y + 3, ez), color: 0xff6a2a, intensity: 14, distance: 16 });
    ctx.items.addCarving('c_forge', ex + 5.5, y + 1.6, ez + 3.5, 0, 2.2, 1.6);
    ctx.items.addPage('page8', ex - 5, y + 1, ez + 6);
    this.game.puzzles.register(this);
  }

  cellPos(c, r) {
    return [this.mx + (c - (this.n - 1) / 2) * CELL, this.mz + (r - (this.n - 1) / 2) * CELL];
  }

  cellAt(x, z) {
    const c = Math.round((x - this.mx) / CELL + (this.n - 1) / 2);
    const r = Math.round((z - this.mz) / CELL + (this.n - 1) / 2);
    if (c < 0 || r < 0 || c >= this.n || r >= this.n) return null;
    return { c, r, ch: LAYOUT[r][c] };
  }

  buildFlowParticles(ctx, cells) {
    const per = 26;
    const count = cells.length * per;
    const base = new Float32Array(count * 3);
    const dir = new Float32Array(count * 3);
    const rnd = new Float32Array(count * 3);
    let k = 0;
    for (const cell of cells) {
      for (let i = 0; i < per; i++, k++) {
        base[k * 3] = cell.wx; base[k * 3 + 1] = this.y + 0.6; base[k * 3 + 2] = cell.wz;
        dir[k * 3] = cell.d[0]; dir[k * 3 + 1] = 0; dir[k * 3 + 2] = cell.d[1];
        rnd[k * 3] = Math.random(); rnd[k * 3 + 1] = Math.random(); rnd[k * 3 + 2] = Math.random();
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(base, 3));
    geo.setAttribute('aDir', new THREE.BufferAttribute(dir, 3));
    geo.setAttribute('aRnd', new THREE.BufferAttribute(rnd, 3));
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uTime: shared.uTime, uCell: { value: CELL }, uH: { value: H - 1.2 } },
      vertexShader: /* glsl */`
        uniform float uTime; uniform float uCell; uniform float uH;
        attribute vec3 aDir; attribute vec3 aRnd;
        varying float vA;
        void main() {
          float t = fract(uTime * 0.9 + aRnd.x);
          vec3 side = vec3(-aDir.z, 0.0, aDir.x);
          vec3 p = position + aDir * (t - 0.5) * uCell + side * (aRnd.y - 0.5) * uCell * 0.8;
          p.y += aRnd.z * uH;
          vA = sin(t * 3.14159);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = 90.0 / max(-mv.z, 0.5);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */`
        varying float vA;
        void main() {
          vec2 c = gl_PointCoord - 0.5;
          float a = smoothstep(0.5, 0.0, length(c)) * vA * 0.7;
          gl_FragColor = vec4(vec3(1.0, 0.75, 0.45) * a, a);
        }`,
    });
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    ctx.scene.add(pts);
    this.particles = pts;
  }

  onSolved() {
    this.solved = true;
  }

  update(dt) {
    const g = this.game;
    const p = g.player.pos;
    const near = Math.abs(p.x - this.mx) < 30 && Math.abs(p.z - this.mz) < 30;
    this.particles.visible = near || Math.hypot(p.x - this.mx, p.z - this.mz) < 90;
    const t = g.time;
    for (const j of this.jets) {
      const cyc = (t + j.phase) % 5;
      const active = cyc > 3.6;
      const warm = cyc > 2.8 && !active;
      j.mesh.material.opacity = active ? 0.55 : warm ? (cyc - 2.8) * 0.15 : 0;
      j.mesh.scale.set(1, active ? 1 : 0.4, 1);
      if (active && near && Math.hypot(p.x - j.x, p.z - j.z) < 2 && p.y < this.y + H) {
        g.survival.damage(12, 'heat', new THREE.Vector3(j.x, p.y, j.z));
      }
    }
    if (!near || p.y > this.y + H + 0.5) return;
    const cell = this.cellAt(p.x, p.z);
    if (!cell) return;
    const d = DIRS[cell.ch];
    if (d) {
      const [cx, cz] = this.cellPos(cell.c, cell.r);
      g.player.external.x += d[0] * FORCE + (d[0] === 0 ? (cx - p.x) * 3 : 0);
      g.player.external.z += d[1] * FORCE + (d[1] === 0 ? (cz - p.z) * 3 : 0);
      this.inCurrent = true;
    } else this.inCurrent = false;
  }
}
