import * as THREE from 'three';

const RANGE = 85;

// Sonar pulse (Q): an expanding ring that reveals nearby items, air vents and hidden paths.
export class Sonar {
  constructor(game) {
    this.game = game;
    this.cooldown = 0;
    this.t = -1;
    this.boost = 0; // waystones glow while > 0
    const mat = new THREE.MeshBasicMaterial({
      color: 0x7ff3ff, transparent: true, opacity: 0.3, side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending, depthWrite: false, wireframe: true,
    });
    this.ring = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 2), mat);
    this.ring.visible = false;
    game.scene.add(this.ring);
    this.extraTargets = []; // { pos, type, label }
  }

  addTarget(pos, type, label) {
    this.extraTargets.push({ pos, type, label });
  }

  pulse() {
    const g = this.game;
    if (!(g.state.upgrades.sonar > 0)) {
      g.ui.toast('You don\'t have a sonar yet.', 'info', 'Buy the Sonar Pulse upgrade at the base console.');
      return;
    }
    if (this.cooldown > 0) return;
    this.cooldown = 6;
    this.t = 0;
    this.boost = 1;
    this.ring.position.copy(g.player.pos);
    this.ring.visible = true;
    g.audio.play('sonar');
    const p = g.player.pos;
    const found = [];
    for (const it of g.items.uncollected()) {
      if (it.type === 'shard' && !it.revealed) continue;
      if (it.pos.distanceTo(p) < RANGE) found.push({ pos: it.pos, type: it.type });
    }
    for (const t of this.extraTargets) {
      if (t.pos.distanceTo(p) < RANGE && (!t.enabled || t.enabled())) found.push(t);
    }
    for (const v of g.world.airVents) {
      const vp = new THREE.Vector3(v.x, v.y + 2, v.z);
      if (vp.distanceTo(p) < RANGE) found.push({ pos: vp, type: 'air' });
    }
    g.ui.setSonarMarkers(found, 8);
  }

  update(dt) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.boost = Math.max(0, this.boost - dt / 8);
    if (this.t >= 0) {
      this.t += dt;
      const r = this.t * 45;
      this.ring.scale.setScalar(r);
      this.ring.material.opacity = 0.35 * (1 - r / RANGE);
      if (r > RANGE) { this.t = -1; this.ring.visible = false; }
    }
  }
}
