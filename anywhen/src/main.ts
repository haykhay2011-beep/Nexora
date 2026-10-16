// Anywhen entry point.
import './style.css';
import { loadEarth } from './geo/earth';
import { Game } from './game/Game';

async function boot() {
  const canvas = document.getElementById('game') as HTMLCanvasElement;
  const ui = document.getElementById('ui')!;
  const status = document.createElement('div');
  status.className = 'loading';
  status.innerHTML = '<div class="years">Anywhen</div><div class="msg">Loading the Earth…</div>';
  ui.append(status);
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) throw new Error('WebGL 2 is not available in this browser.');
    const earth = await loadEarth(new URL('data/earth.dat', document.baseURI).href);
    status.remove();
    const game = new Game(canvas, earth);
    (window as unknown as { anywhen: Game }).anywhen = game;
    await game.init();
  } catch (e) {
    console.error(e);
    status.innerHTML = `<div class="years">Anywhen</div><div class="msg">Could not start: ${(e as Error).message}</div>`;
  }
}

boot();
