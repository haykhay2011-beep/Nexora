import * as THREE from 'three';
import { T } from '../world/Batcher.js';
import { BASE_GEO as G, COLORS } from '../world/Props.js';
import { heightAt } from '../world/Terrain.js';

function dolphinCarving() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 320;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#7d7466';
  ctx.fillRect(0, 0, 256, 320);
  ctx.strokeStyle = '#5ff7e6';
  ctx.shadowColor = '#5ff7e6';
  ctx.shadowBlur = 10;
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  const dolphin = (x, y, s, flip) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(flip ? -s : s, s);
    ctx.beginPath();
    ctx.moveTo(-40, 10);
    ctx.quadraticCurveTo(-10, -25, 35, -5);
    ctx.lineTo(48, -2);
    ctx.lineTo(36, 4);
    ctx.quadraticCurveTo(0, 18, -40, 10);
    ctx.moveTo(-5, -14); ctx.lineTo(2, -30); ctx.lineTo(10, -12);
    ctx.moveTo(-40, 10); ctx.lineTo(-55, 0); ctx.moveTo(-40, 10); ctx.lineTo(-52, 22);
    ctx.stroke();
    ctx.restore();
  };
  dolphin(128, 90, 1.3, false);
  dolphin(128, 230, 1.3, true);
  ctx.beginPath();
  for (let i = 0; i < 3; i++) { ctx.arc(128, 160, 18 + i * 14, -0.6, 0.6); ctx.moveTo(128, 160); }
  ctx.stroke();
  ctx.strokeRect(10, 10, 236, 300);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// The Echo Grotto: a chamber sealed by a door that only opens to dolphin song.
export class SongDoor {
  constructor(ctx, { x, z }) {
    this.id = 'songDoor';
    this.game = ctx.game;
    this.solved = false;
    this.t = 0;
    const { B, C, rng } = ctx;
    const y = heightAt(x, z);
    const R = 6.5;
    const doorAngle = Math.PI; // door faces west (-x)
    const rockColor = 0x6e7660;
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const da = Math.abs(((a - doorAngle + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      if (da < 0.3) continue;
      const s = rng.float(3, 3.8);
      B.add(G.ico0, 'stone', T(x + Math.cos(a) * R, y + 2.5, z + Math.sin(a) * R, rng.float(0, 6), s, s * 1.5, s), rockColor, 0.1);
      C.sphere(x + Math.cos(a) * R, y + 2.5, z + Math.sin(a) * R, s * 0.85);
    }
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const rx = x + (i ? Math.cos(a) * 3.5 : 0), rz = z + (i ? Math.sin(a) * 3.5 : 0);
      B.add(G.ico0, 'stone', T(rx, y + 8.5, rz, rng.float(0, 6), 5.5, 2.4, 5.5), rockColor, 0.1);
      C.sphere(rx, y + 8.8, rz, 3.2);
    }
    // door frame
    const dx = x - R + 0.5, dz = z;
    for (const s of [-1, 1]) {
      B.add(G.box, 'stone', T(dx, y + 2.5, dz + s * 2.1, 0, 1.2, 5, 1), COLORS.stone, 0.05);
      C.box(dx, y + 2.5, dz + s * 2.1, 0.6, 2.5, 0.5);
    }
    B.add(G.box, 'stone', T(dx, y + 5.3, dz, 0, 1.4, 0.8, 5.4), COLORS.stone, 0.05);
    B.add(G.box, 'glow', T(dx - 0.72, y + 5.3, dz, 0, 0.04, 0.2, 4), COLORS.glyph, 0.05);
    // door slab (moves)
    this.slab = new THREE.Group();
    const slabMesh = new THREE.Mesh(new THREE.BoxGeometry(0.6, 4.6, 3.3), new THREE.MeshLambertMaterial({ color: 0x8a8070, flatShading: true }));
    this.slab.add(slabMesh);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 4.2), new THREE.MeshBasicMaterial({ map: dolphinCarving() }));
    face.position.x = -0.31;
    face.rotation.y = -Math.PI / 2;
    this.slab.add(face);
    this.slab.position.set(dx, y + 2.3, dz);
    ctx.scene.add(this.slab);
    this.baseY = y + 2.3;
    this.doorX = dx;
    this.collider = C.box(dx, y + 2.3, dz, 0.3, 2.3, 1.65, 0, true);

    this.shard = ctx.items.addShard('song', x + 1, y + 2, z, { hidden: false });
    ctx.items.addCarving('c_dolphins', dx - 1.6, y + 1.2, dz + 3.4, -Math.PI / 2, 1.6, 1.2);
    ctx.items.addRelic('statDolphin', x + 2.5, y + 0.8, z - 2.5);
    ctx.world.addLight({ pos: new THREE.Vector3(x, y + 3, z), color: 0xff9be0, intensity: 15, distance: 12, active: () => this.solved });

    this.game.interact.add({
      pos: new THREE.Vector3(dx - 1.2, y + 2.2, dz), radius: 4,
      prompt: () => (this.game.state.flags.companion ? 'Ask your dolphin to sing' : 'Push the carved door'),
      enabled: () => !this.solved,
      onUse: () => this.tryOpen(),
    });
    this.game.puzzles.register(this);
  }

  tryOpen() {
    const g = this.game;
    if (!g.state.flags.companion) {
      g.audio.play('stone');
      g.ui.toast('The door will not move.', 'info', 'Dolphins are carved all over it, singing. Maybe a dolphin could help...');
      return;
    }
    g.audio.play('dolphin');
    g.creatures.companionSing && g.creatures.companionSing(this.slab.position);
    setTimeout(() => g.puzzles.solve(this, 'Your dolphin sings, and the stone door cracks open!'), 1600);
  }

  onSolved(silent) {
    this.solved = true;
    this.collider.enabled = false;
    if (silent) this.t = 1;
  }

  update(dt) {
    if (this.solved && this.t < 1) {
      this.t = Math.min(1, this.t + dt * 0.35);
    }
    this.slab.position.x = this.doorX + (this.solved && this.t < 1 ? Math.sin(this.t * 90) * 0.04 : 0);
    this.slab.position.y = this.baseY - this.t * 4.8;
  }
}
