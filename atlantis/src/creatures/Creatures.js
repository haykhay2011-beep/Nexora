// Temporary stub, replaced in the creatures stage.
export class Creatures {
  constructor(game) { this.game = game; this.pending = []; }
  spawnLater(type, x, y, z, opts) { this.pending.push({ type, x, y, z, opts }); }
  finalize() {}
  applyState() {}
  onRespawn() {}
  setQuality() {}
  update() {}
}
