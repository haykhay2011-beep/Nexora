import './style.css';
import { Game } from './core/Game.js';

const canvas = document.getElementById('game');

try {
  const game = new Game(canvas);
  window.__atlantis = game; // handy for debugging in the console
  game.init((text) => game.ui.setLoading(text)).catch((err) => showError(err));
} catch (err) {
  showError(err);
}

function showError(err) {
  console.error(err);
  const ui = document.getElementById('ui');
  const box = document.createElement('div');
  box.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:#021018;color:#e8fbff;font-family:system-ui;padding:30px;text-align:center;pointer-events:auto';
  box.innerHTML = '<div><h2>Atlantis could not start</h2><p>Your browser needs WebGL support to run the game.</p><pre style="opacity:.6;white-space:pre-wrap"></pre></div>';
  box.querySelector('pre').textContent = String(err && err.message ? err.message : err);
  ui.appendChild(box);
}
