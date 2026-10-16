// Registry of puzzles. Each puzzle object: { id, onSolved(silent), update?(dt), reset?() }.
export class Puzzles {
  constructor(game) {
    this.game = game;
    this.list = [];
  }

  register(p) {
    this.list.push(p);
    return p;
  }

  isSolved(id) {
    return !!this.game.state.puzzles[id];
  }

  solve(p, message) {
    if (this.game.state.puzzles[p.id]) return;
    this.game.state.puzzles[p.id] = true;
    p.onSolved(false);
    this.game.audio.play('solve');
    if (message) this.game.ui.toast(message, 'solve');
  }

  applyState() {
    for (const p of this.list) {
      if (this.game.state.puzzles[p.id]) p.onSolved(true);
    }
  }

  update(dt) {
    for (const p of this.list) if (p.update) p.update(dt);
  }
}
