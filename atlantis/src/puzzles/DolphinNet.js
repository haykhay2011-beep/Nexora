import * as THREE from 'three';
import { T } from '../world/Batcher.js';
import { BASE_GEO as G, COLORS } from '../world/Props.js';
import { heightAt } from '../world/Terrain.js';

// Netted Courtyard: a dolphin trapped under an old net. Cut the three ropes to free it.
export class DolphinNet {
  constructor(ctx, { x, z }) {
    this.id = 'dolphinNet';
    this.game = ctx.game;
    this.solved = false;
    this.cut = [false, false, false];
    this.fade = 0;
    const { B, C } = ctx;
    const y = heightAt(x, z);
    this.center = new THREE.Vector3(x, y + 3, z);
    const S = 16, h = 4.5;
    // walls with a gap on the south side
    const wall = (wx, wz, w, d) => {
      B.add(G.box, 'stone', T(wx, y + h / 2, wz, 0, w, h, d), COLORS.stoneOld, 0.06);
      C.box(wx, y + h / 2, wz, w / 2, h / 2, d / 2);
    };
    wall(x, z - S / 2, S, 0.8);
    wall(x - S / 2, z, 0.8, S);
    wall(x + S / 2, z, 0.8, S);
    wall(x - S / 4 - 2, z + S / 2, S / 2 - 4, 0.8);
    wall(x + S / 4 + 2, z + S / 2, S / 2 - 4, 0.8);
    // posts holding the net
    const posts = [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => [x + sx * (S / 2 - 0.6), z + sz * (S / 2 - 0.6)]);
    for (const [px, pz] of posts) {
      B.add(G.cyl6, 'stone', T(px, y + h + 1.2, pz, 0, 0.5, 2.4, 0.5), COLORS.woodDark, 0.05);
    }
    // the net: a grid of lines spanning the courtyard, also blocking the gap
    const pts = [];
    const top = y + h + 2;
    const n = 10;
    for (let i = 0; i <= n; i++) {
      const t = -S / 2 + (i / n) * S;
      pts.push(x + t, top - Math.sin((i / n) * Math.PI) * 1.2, z - S / 2, x + t, top - Math.sin((i / n) * Math.PI) * 1.2, z + S / 2);
      pts.push(x - S / 2, top - Math.sin((i / n) * Math.PI) * 1.2, z + t, x + S / 2, top - Math.sin((i / n) * Math.PI) * 1.2, z + t);
    }
    for (let i = 0; i <= 6; i++) {
      const t = -2 + (i / 6) * 4;
      pts.push(x + t, y, z + S / 2, x + t, top, z + S / 2);
    }
    for (let i = 0; i <= 5; i++) {
      const yy = y + (i / 5) * (h + 2);
      pts.push(x - 2.5, yy, z + S / 2, x + 2.5, yy, z + S / 2);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    this.netMat = new THREE.LineBasicMaterial({ color: COLORS.rope, transparent: true, opacity: 0.85 });
    this.net = new THREE.LineSegments(geo, this.netMat);
    ctx.scene.add(this.net);
    this.netCol = C.box(x, y + (h + 2) / 2, z + S / 2, 2.5, (h + 2) / 2, 0.3, 0, true);

    // three rope knots tied to posts outside the gap and at corners
    const knots = [[x - 3.2, z + S / 2 + 0.8], [x + 3.2, z + S / 2 + 0.8], [x + S / 2 + 0.9, z - S / 2 + 2]];
    this.knotMeshes = knots.map(([kx, kz], i) => {
      const ky = heightAt(kx, kz);
      B.add(G.cyl6, 'stone', T(kx, ky + 1.5, kz, 0, 0.45, 3, 0.45), COLORS.woodDark, 0.05);
      const knot = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.14, 5, 10), new THREE.MeshLambertMaterial({ color: COLORS.rope, emissive: 0x332a10 }));
      knot.position.set(kx, ky + 2.3, kz);
      ctx.scene.add(knot);
      this.game.interact.add({
        pos: knot.position, radius: 3,
        prompt: 'Cut the net rope',
        enabled: () => !this.cut[i] && !this.solved,
        onUse: () => this.cutRope(i),
      });
      return knot;
    });
    this.game.puzzles.register(this);
  }

  cutRope(i) {
    this.cut[i] = true;
    this.knotMeshes[i].visible = false;
    this.game.audio.play('rope');
    const left = this.cut.filter((c) => !c).length;
    if (left > 0) this.game.ui.toast(`The rope snaps. ${left} more to go.`, 'info');
    else setTimeout(() => this.game.puzzles.solve(this, 'The net falls away. The dolphin is free!'), 600);
  }

  onSolved(silent) {
    this.solved = true;
    this.cut = [true, true, true];
    for (const k of this.knotMeshes) k.visible = false;
    this.netCol.enabled = false;
    if (silent) this.fade = 1;
    this.game.state.flags.companion = true;
    this.game.creatures.freeDolphin(silent);
  }

  update(dt) {
    if (this.solved && this.fade < 1) this.fade = Math.min(1, this.fade + dt * 0.5);
    this.net.position.y = -this.fade * 5;
    this.netMat.opacity = 0.85 * (1 - this.fade);
    this.net.visible = this.fade < 1;
  }
}
