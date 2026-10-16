import * as THREE from 'three';

const tmp = new THREE.Vector3();

// Finds the best interactable in front of the player and runs it on E.
export class Interaction {
  constructor(game) {
    this.game = game;
    this.list = [];
    this.current = null;
  }

  add(def) {
    const it = {
      pos: def.pos,
      radius: def.radius ?? 3,
      prompt: def.prompt,
      onUse: def.onUse,
      enabled: def.enabled || (() => true),
      priority: def.priority || 0,
      key: def.key || 'E',
    };
    this.list.push(it);
    return it;
  }

  remove(it) {
    const i = this.list.indexOf(it);
    if (i >= 0) this.list.splice(i, 1);
  }

  update(input) {
    const p = this.game.player;
    const eye = this.game.camera.position;
    const fwd = p.forward;
    let best = null, bestScore = -Infinity;
    for (const it of this.list) {
      const dx = it.pos.x - eye.x, dy = it.pos.y - eye.y, dz = it.pos.z - eye.z;
      if (Math.abs(dx) > it.radius + 1 || Math.abs(dz) > it.radius + 1) continue;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d > it.radius) continue;
      if (!it.enabled()) continue;
      tmp.set(dx, dy, dz).divideScalar(d || 1);
      const facing = tmp.dot(fwd);
      if (facing < 0.35 && d > 1.6) continue;
      const score = facing * 2 - d * 0.5 + it.priority;
      if (score > bestScore) { bestScore = score; best = it; }
    }
    this.current = best;
    const prompt = best ? (typeof best.prompt === 'function' ? best.prompt() : best.prompt) : null;
    this.game.ui.setPrompt(prompt);
    if (best && input.pressed.has('KeyE')) {
      best.onUse();
    }
  }
}
