import * as THREE from 'three';
import { builderCtx, T } from '../world/Batcher.js';
import { statue, stele, column, BASE_GEO as G, COLORS } from '../world/Props.js';
import { glyphMaterial } from '../world/Materials.js';
import { heightAt } from '../world/Terrain.js';

const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // N E S W
const DIR_NAMES = ['north', 'east', 'south', 'west'];
const dirAngle = (d) => Math.atan2(DIRS[d][0], DIRS[d][1]);

function nameTexture(text, emblemColor = '#6ff7e8') {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#2a3a42';
  ctx.fillRect(0, 0, 256, 64);
  ctx.strokeStyle = 'rgba(233,194,90,0.8)';
  ctx.lineWidth = 4;
  ctx.strokeRect(4, 4, 248, 56);
  ctx.fillStyle = emblemColor;
  ctx.shadowColor = emblemColor;
  ctx.shadowBlur = 10;
  ctx.font = 'bold 34px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 34);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Guardian Circle: rotate three statues so each looks at the stele bearing its sign.
export class StatuePuzzle {
  constructor(ctx, { id, x, z, shardId, statues }) {
    this.id = id;
    this.ctx = ctx;
    this.game = ctx.game;
    this.solved = false;
    const y = heightAt(x, z);
    this.center = new THREE.Vector3(x, y, z);
    this.statues = [];

    // altar with lid
    ctx.B.add(G.cyl8, 'stone', T(x, y + 0.6, z, 0, 3.2, 1.2, 3.2), COLORS.stoneDark, 0.05);
    ctx.B.add(G.cyl8, 'shiny', T(x, y + 1.25, z, 0, 3.3, 0.12, 3.3), COLORS.gold, 0.04);
    ctx.C.cylinder(x, z, 1.6, y - 1, y + 1.2);
    const lidB = builderCtx(ctx.rng);
    lidB.B.add(G.cyl8, 'stone', T(0, 0.2, 0, 0, 2.6, 0.4, 2.6), COLORS.stone, 0.05);
    lidB.B.add(G.cyl8, 'glow', T(0, 0.42, 0, 0, 1.4, 0.05, 1.4), COLORS.glyph, 0.05);
    this.lid = lidB.builder.build();
    this.lid.position.set(x, y + 1.25, z);
    ctx.scene.add(this.lid);
    this.lidT = 0;
    this.shard = ctx.items.addShard(shardId, x, y + 3, z, { hidden: true });

    // decorative ring of columns
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + 0.13;
      const cx = x + Math.cos(a) * 20, cz = z + Math.sin(a) * 20;
      column(ctx, cx, heightAt(cx, cz) - 0.2, cz, 7, { broken: i % 3 !== 0, glyph: true });
    }

    for (const def of statues) {
      const sx = x + def.ox, sz = z + def.oz;
      const sy = heightAt(sx, sz);
      // statue model as a movable group
      const bc = builderCtx(ctx.rng);
      statue(bc, 0, 0, 0, 0, 0.9, { trident: def.trident ?? false, emblem: false, noCollide: true });
      const group = bc.builder.build();
      group.position.set(sx, sy, sz);
      // emblem on chest
      const emblem = new THREE.Mesh(G.plane, glyphMaterial(def.emblem, { bg: null, color: '#ffe38a' }));
      emblem.position.set(0, (1.2 + 3.0) * 0.9, 0.38 * 0.9 + 0.02);
      emblem.scale.setScalar(0.7);
      group.add(emblem);
      // gaze beam
      const beam = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 0.06, 4.2),
        new THREE.MeshBasicMaterial({ color: 0x7ff3ff, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false })
      );
      beam.position.set(0, 4.1 * 0.9, 2.3);
      group.add(beam);
      // name plaque on pedestal front
      const plaque = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.45), new THREE.MeshBasicMaterial({ map: nameTexture(def.name) }));
      plaque.position.set(0, 0.6 * 0.9, 1.0);
      group.add(plaque);
      ctx.scene.add(group);
      ctx.C.cylinder(sx, sz, 1.2, sy - 1, sy + 4.5);

      // four stelae around the statue
      def.glyphs.forEach((glyph, d) => {
        const ex = sx + DIRS[d][0] * 5.5, ez = sz + DIRS[d][1] * 5.5;
        const ey = heightAt(ex, ez) - 0.2;
        const face = Math.atan2(sx - ex, sz - ez);
        stele(ctx, ex, ey, ez, face, 2.8);
        const gp = new THREE.Mesh(G.plane, glyphMaterial(glyph));
        gp.position.set(ex + Math.sin(face) * 0.27, ey + 1.9, ez + Math.cos(face) * 0.27);
        gp.rotation.y = face;
        gp.scale.setScalar(1.1);
        ctx.scene.add(gp);
      });

      const st = { def, group, dir: def.start, angle: dirAngle(def.start), target: def.correct };
      group.rotation.y = st.angle;
      this.statues.push(st);
      this.game.interact.add({
        pos: new THREE.Vector3(sx, sy + 2.5, sz), radius: 4,
        prompt: () => `Turn the Guardian of ${def.name[0] + def.name.slice(1).toLowerCase()} (facing ${DIR_NAMES[st.dir]})`,
        enabled: () => !this.solved,
        onUse: () => this.turn(st),
      });
    }
    this.game.puzzles.register(this);
  }

  turn(st) {
    st.dir = (st.dir + 1) % 4;
    this.game.audio.play('stone');
    if (this.statues.every((s) => s.dir === s.target)) {
      setTimeout(() => this.game.puzzles.solve(this, 'The guardians see their signs. The altar opens!'), 900);
    }
  }

  onSolved(silent) {
    this.solved = true;
    for (const s of this.statues) s.dir = s.target;
    this.shard.reveal();
    if (silent) this.lidT = 1;
  }

  update(dt) {
    for (const s of this.statues) {
      const target = dirAngle(s.dir);
      let d = target - s.angle;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      s.angle += d * Math.min(1, dt * 4);
      s.group.rotation.y = s.angle;
    }
    if (this.solved && this.lidT < 1) this.lidT = Math.min(1, this.lidT + dt * 0.4);
    this.lid.position.x = this.center.x + this.lidT * 2.4;
    this.lid.position.y = this.center.y + 1.25 - this.lidT * 0.9;
    this.lid.rotation.z = -this.lidT * 0.4;
  }
}
