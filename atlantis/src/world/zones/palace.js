import * as THREE from 'three';
import { T } from '../Batcher.js';
import { BASE_GEO as G, column, statue, stairs, brazier, COLORS } from '../Props.js';
import { heightAt } from '../Terrain.js';
import { shared } from '../Materials.js';
import { SHARD_IDS, SHARD_COLORS } from '../config.js';
import { shardModel } from '../../items/Models.js';

export const PALACE = { x: 0, z: -250, y: -82, barrierR: 58 };

export function buildPalace(ctx) {
  const { B, C, rng, items, game, world } = ctx;
  const { x, z, y } = PALACE;

  // tiered circular platform
  const tiers = [[50, 1.2], [44, 1.2], [38, 1.2]];
  let ty = y;
  for (const [r, h] of tiers) {
    B.add(G.cyl12, 'stone', T(x, ty + h / 2, z, 0, r * 2, h, r * 2), COLORS.stone, 0.03);
    C.cylinder(x, z, r, ty - 3, ty + h);
    B.add(new THREE.TorusGeometry(r, 0.18, 4, 40), 'shiny', T(x, ty + h, z, 0, 1, 1, 1, Math.PI / 2), COLORS.gold, 0.02);
    ty += h;
  }
  const top = ty;
  stairs(ctx, x, y, z + 52, 12, 3, 1.2, 2, Math.PI);
  // ring of columns
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2;
    if (Math.abs(a - Math.PI / 2) < 0.12) continue; // keep the south entry clear
    column(ctx, x + Math.cos(a) * 34, top, z + Math.sin(a) * 34, 12, { glyph: true, radius: 0.8 });
  }
  // braziers lining the approach
  for (let k = 0; k < 4; k++) for (const s of [-1, 1]) brazier(ctx, x + s * 6, top, z + 20 + k * 4, 2.2);

  // the keep
  const W = 30, H = 15;
  const wallC = 0xece6d6;
  for (const s of [-1, 1]) {
    B.add(G.box, 'stone', T(x + s * W / 2, top + H / 2, z, 0, 1.2, H, W), wallC, 0.03);
    C.box(x + s * W / 2, top + H / 2, z, 0.6, H / 2, W / 2);
  }
  // north wall
  B.add(G.box, 'stone', T(x, top + H / 2, z - W / 2, 0, W, H, 1.2), wallC, 0.03);
  C.box(x, top + H / 2, z - W / 2, W / 2, H / 2, 0.6);
  // south wall with a grand doorway
  for (const s of [-1, 1]) {
    B.add(G.box, 'stone', T(x + s * 9.5, top + H / 2, z + W / 2, 0, 11, H, 1.2), wallC, 0.03);
    C.box(x + s * 9.5, top + H / 2, z + W / 2, 5.5, H / 2, 0.6);
  }
  B.add(G.box, 'stone', T(x, top + H - 2.5, z + W / 2, 0, 8.2, 5, 1.2), wallC, 0.03);
  C.box(x, top + H - 2.5, z + W / 2, 4.1, 2.5, 0.6);
  // glyph friezes
  for (const s of [-1, 1]) {
    B.add(G.box, 'glow', T(x + s * (W / 2 + 0.62), top + H - 2, z, 0, 0.05, 0.5, W - 2), COLORS.glyph, 0.03);
    B.add(G.box, 'glow', T(x, top + H - 2, z + s * (W / 2 + 0.62), 0, W - 2, 0.5, 0.05), COLORS.glyph, 0.03);
    B.add(G.box, 'cityLight', T(x + s * (W / 2 + 0.62), top + 6, z, 0, 0.06, 3, 4), COLORS.windowWarm, 0.05);
  }
  // dome and spire
  B.add(G.box, 'stone', T(x, top + H + 0.5, z, 0, W + 2, 1, W + 2), COLORS.stoneDark, 0.03);
  B.add(G.box, 'shiny', T(x, top + H + 1.1, z, 0, W + 2.2, 0.25, W + 2.2), COLORS.gold, 0.02);
  B.add(new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), 'stone', T(x, top + H + 1, z, 0, 13, 11, 13), 0xf2ecdc, 0.03);
  B.add(G.cyl8, 'shiny', T(x, top + H + 12.5, z, 0, 2, 3, 2), COLORS.gold, 0.02);
  B.add(G.cone6, 'shiny', T(x, top + H + 17, z, 0, 1.6, 6, 1.6), COLORS.gold, 0.02);
  C.box(x, top + H + 0.5, z, W / 2 + 1, 0.5, W / 2 + 1);
  // corner towers
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const tx = x + sx * (W / 2 + 1), tz = z + sz * (W / 2 + 1);
    B.add(G.cyl12, 'stone', T(tx, top + 11, tz, 0, 6, 22, 6), wallC, 0.03);
    B.add(G.cyl12, 'shiny', T(tx, top + 22.2, tz, 0, 6.6, 0.5, 6.6), COLORS.gold, 0.02);
    B.add(G.cone6, 'stone', T(tx, top + 25.5, tz, 0, 6.4, 6.5, 6.4), 0x3a6a8a, 0.04);
    B.add(G.box, 'cityLight', T(tx + sx * 3.02, top + 15, tz, 0, 0.1, 2, 1.2), COLORS.windowWarm, 0.05);
    B.add(G.box, 'glow', T(tx, top + 19, tz, 0, 6.1, 0.4, 6.1), COLORS.glyph, 0.03);
    C.cylinder(tx, tz, 3.2, top - 1, top + 29);
  }
  // statues at the entry
  for (const s of [-1, 1]) statue(ctx, x + s * 7.5, top, z + W / 2 + 4, 0, 1.6, { trident: true, emblem: true });

  // interior: the Heartstone cradle
  const hall = new THREE.Vector3(x, top, z);
  B.add(G.cyl12, 'stone', T(x, top + 0.8, z, 0, 8, 1.6, 8), COLORS.stoneDark, 0.03);
  B.add(G.cyl12, 'shiny', T(x, top + 1.65, z, 0, 8.4, 0.2, 8.4), COLORS.gold, 0.02);
  C.cylinder(x, z, 4, top - 1, top + 1.6);
  B.add(new THREE.TorusGeometry(3.4, 0.25, 6, 28), 'shiny', T(x, top + 6, z, 0, 1, 1, 1), COLORS.gold, 0.02);
  B.add(new THREE.TorusGeometry(3.4, 0.25, 6, 28), 'shiny', T(x, top + 6, z, Math.PI / 2, 1, 1, 1), COLORS.gold, 0.02);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    column(ctx, x + Math.cos(a) * 10, top, z + Math.sin(a) * 10, H, { glyph: true, radius: 0.9 });
  }
  items.addCarving('c_palace', x - 7, heightAt(x - 7, z + 68) + 1.6, z + 68, 0, 2.6, 1.6);
  B.add(G.box, 'stone', T(x - 7, heightAt(x - 7, z + 68) + 0.5, z + 67.8, 0, 3, 1.2, 0.5), COLORS.stoneOld, 0.03);

  new PalaceLock(ctx, hall, top);
}

// The seal stone outside the barrier, the barrier itself and the cradle that starts the ending.
class PalaceLock {
  constructor(ctx, hall, top) {
    this.id = 'palaceSeal';
    this.game = ctx.game;
    this.open = false;
    this.fade = 0;
    const { x, z, y, barrierR } = PALACE;
    this.center = new THREE.Vector3(x, y, z);

    // barrier dome
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
      uniforms: { uTime: shared.uTime, uFade: { value: 1 } },
      vertexShader: /* glsl */`
        varying vec3 vN; varying vec3 vV; varying vec3 vP;
        void main() {
          vP = position;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vN = normalize(normalMatrix * normal);
          vV = normalize(-mv.xyz);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */`
        uniform float uTime; uniform float uFade;
        varying vec3 vN; varying vec3 vV; varying vec3 vP;
        void main() {
          float fres = pow(1.0 - abs(dot(vN, vV)), 2.5);
          float bands = smoothstep(0.92, 1.0, sin(vP.y * 0.6 - uTime * 1.5) * 0.5 + 0.5);
          float hex = smoothstep(0.96, 1.0, sin(atan(vP.z, vP.x) * 24.0) * 0.5 + 0.5) * 0.4;
          float a = (0.06 + fres * 0.5 + bands * 0.25 + hex) * uFade;
          gl_FragColor = vec4(vec3(0.5, 0.95, 1.0) * a, a);
        }`,
    });
    this.barrierMat = mat;
    this.barrier = new THREE.Mesh(new THREE.SphereGeometry(barrierR, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2), mat);
    this.barrier.position.set(x, y - 2, z);
    ctx.scene.add(this.barrier);

    // seal stone with seven sockets, south of the barrier
    const sx = x, sz = z + barrierR + 8;
    const sy = heightAt(sx, sz);
    ctx.B.add(G.cyl8, 'stone', T(sx, sy + 1, sz, 0, 4, 2, 4), COLORS.stoneDark, 0.03);
    ctx.B.add(G.box, 'stone', T(sx, sy + 3.5, sz, 0, 5, 3.5, 1.2), COLORS.stone, 0.03);
    ctx.B.add(G.box, 'shiny', T(sx, sy + 5.35, sz, 0, 5.4, 0.25, 1.4), COLORS.gold, 0.02);
    ctx.C.box(sx, sy + 2.6, sz, 2.5, 2.6, 0.8);
    this.sockets = SHARD_IDS.map((id, i) => {
      const a = (i / 7) * Math.PI * 2;
      const m = shardModel(SHARD_COLORS[id]);
      m.scale.setScalar(0.45);
      m.position.set(sx + Math.cos(a) * 1.4, sy + 3.5 + Math.sin(a) * 1.2, sz + 0.75);
      m.visible = false;
      ctx.scene.add(m);
      const hole = new THREE.Mesh(new THREE.CircleGeometry(0.28, 10), new THREE.MeshBasicMaterial({ color: 0x0a1418 }));
      hole.position.set(m.position.x, m.position.y, sz + 0.62);
      ctx.scene.add(hole);
      return m;
    });
    this.game.interact.add({
      pos: new THREE.Vector3(sx, sy + 3.5, sz + 1.5), radius: 4.5, priority: 2,
      prompt: () => {
        const n = this.game.state.shards.size;
        return n >= 7 ? 'Set the seven shards into the seal' : `The seal has seven sockets (${n}/7 shards)`;
      },
      enabled: () => !this.open,
      onUse: () => this.trySeal(),
    });
    ctx.world.addLight({ pos: new THREE.Vector3(sx, sy + 5, sz + 3), color: 0x7ff3ff, intensity: 10, distance: 14 });

    // Heartstone (hidden until restored)
    const heart = new THREE.Group();
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(1.6, 0), new THREE.MeshBasicMaterial({ color: 0xbff8ff }));
    core.scale.set(1, 1.7, 1);
    heart.add(core);
    const shell = new THREE.Mesh(new THREE.OctahedronGeometry(2.3, 0), new THREE.MeshBasicMaterial({ color: 0x7ff3ff, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false }));
    shell.scale.set(1, 1.7, 1);
    heart.add(shell);
    heart.position.set(x, top + 6, z);
    heart.visible = false;
    ctx.scene.add(heart);
    this.heart = heart;
    // broken remains floating in the cradle
    this.remains = new THREE.Group();
    for (let i = 0; i < 9; i++) {
      const f = new THREE.Mesh(new THREE.TetrahedronGeometry(0.4 + Math.random() * 0.4, 0), new THREE.MeshLambertMaterial({ color: 0x2a3a48, flatShading: true }));
      f.position.set((Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3);
      this.remains.add(f);
    }
    this.remains.position.copy(heart.position);
    ctx.scene.add(this.remains);
    this.heartLight = ctx.world.addLight({ pos: heart.position, color: 0xbff8ff, intensity: 60, distance: 60, active: () => this.game.state.ended || this.game.mode === 'cutscene' });

    this.game.interact.add({
      pos: new THREE.Vector3(x, top + 3, z + 4.5), radius: 6, priority: 3,
      prompt: () => (this.game.state.ended ? 'The Heartstone sings' : 'Restore the Heartstone'),
      enabled: () => this.open && !this.game.state.ended,
      onUse: () => this.game.ending.start(this),
    });
    this.game.puzzles.register(this);
    this.game.palace = this;
  }

  trySeal() {
    const g = this.game;
    const n = g.state.shards.size;
    if (n < 7) {
      g.audio.play('stone');
      g.ui.toast(`The seal needs all seven shards (${n}/7).`, 'info', 'The barrier hums. It will not let you pass yet.');
      return;
    }
    g.puzzles.solve(this, 'The seven shards blaze in the seal. The barrier falls!');
    g.audio.play('beacon');
  }

  onSolved(silent) {
    this.open = true;
    for (const s of this.sockets) s.visible = true;
    if (silent) this.fade = 1;
  }

  update(dt) {
    if (this.open && this.fade < 1) this.fade = Math.min(1, this.fade + dt * 0.4);
    this.barrierMat.uniforms.uFade.value = 1 - this.fade;
    this.barrier.visible = this.fade < 1;
    for (const s of this.sockets) if (s.visible) s.rotation.y += dt;
    this.remains.rotation.y += dt * 0.2;
    this.remains.visible = !this.heart.visible;
    if (this.heart.visible) this.heart.rotation.y += dt * 0.4;
    // barrier collision
    if (!this.open && this.game.mode === 'playing') {
      const p = this.game.player.pos;
      const dx = p.x - PALACE.x, dy = p.y - (PALACE.y - 2), dz = p.z - PALACE.z;
      const d = Math.hypot(dx, Math.max(dy, 0), dz);
      const R = PALACE.barrierR + 0.8;
      if (d < R) {
        const k = R / Math.max(d, 0.01);
        p.x = PALACE.x + dx * k;
        p.z = PALACE.z + dz * k;
        if (dy > 0) p.y = PALACE.y - 2 + dy * k;
        if (!this.warned || this.game.time - this.warned > 6) {
          this.warned = this.game.time;
          this.game.audio.play('zap');
          this.game.ui.toast('A barrier of light blocks the way.', 'info', 'The seal stone south of the palace has seven sockets.');
        }
      }
    }
  }
}
