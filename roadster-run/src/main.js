import './style.css';
import { Game } from './game/Game.js';

function boot() {
  const canvas = document.getElementById('game');
  try {
    window.__game = new Game(canvas);
  } catch (err) {
    console.error(err);
    const l = document.getElementById('loading');
    l.classList.remove('hidden');
    l.textContent = 'Sorry, this browser could not start WebGL. ' + (err && err.message ? err.message : '');
  }
}
boot();
