import './style.css';
import { Game } from './game.js';

const canvas = document.getElementById('game');
try {
  const game = new Game(canvas);
  window.__game = game; // handy for debugging in the console
  requestAnimationFrame(() => game.ui.hideLoading());
} catch (err) {
  console.error(err);
  document.getElementById('loading').textContent = 'Sorry, Car Rider needs WebGL to run.';
}
