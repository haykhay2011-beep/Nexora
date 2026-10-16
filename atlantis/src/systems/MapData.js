import { WORLD_HALF, ZONES } from '../world/config.js';
import { heightAt, zoneIndexAt } from '../world/Terrain.js';

const GRID = 128;
const IMG = 256;
const CELL = (WORLD_HALF * 2) / GRID;

// Fog-of-war exploration map plus a pre-rendered sea floor image.
export class MapData {
  constructor(game) {
    this.game = game;
    this.revealed = new Uint8Array(GRID * GRID);
    this.lastCell = -1;
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.canvas.height = IMG;
    this.ctx = this.canvas.getContext('2d');
    this.image = this.ctx.createImageData(IMG, IMG);
    this.row = 0;
    this.ready = false;
  }

  get grid() { return GRID; }

  prepare() {
    // Draw the first rows now, the rest progressively during the title screen.
    this.prepareStep(24);
  }

  prepareStep(rows = 6) {
    if (this.ready) return;
    const data = this.image.data;
    const colors = ZONES.map((z) => [(z.sand >> 16) & 255, (z.sand >> 8) & 255, z.sand & 255]);
    for (let r = 0; r < rows && this.row < IMG; r++, this.row++) {
      const j = this.row;
      const z = -WORLD_HALF + (j + 0.5) * (WORLD_HALF * 2 / IMG);
      for (let i = 0; i < IMG; i++) {
        const x = -WORLD_HALF + (i + 0.5) * (WORLD_HALF * 2 / IMG);
        const h = heightAt(x, z);
        const hx = heightAt(x + 4, z);
        const shade = Math.max(0.55, Math.min(1.25, 1 + (hx - h) * 0.12));
        const depthF = Math.max(0.25, 1 - (-h) / 200);
        const c = colors[zoneIndexAt(x, z)];
        const k = (j * IMG + i) * 4;
        data[k] = c[0] * depthF * shade * 0.75 + 10;
        data[k + 1] = c[1] * depthF * shade * 0.8 + 25;
        data[k + 2] = c[2] * depthF * shade * 0.8 + 45;
        data[k + 3] = 255;
      }
    }
    if (this.row >= IMG) {
      this.ctx.putImageData(this.image, 0, 0);
      this.ready = true;
    }
  }

  ensureReady() {
    while (!this.ready) this.prepareStep(32);
  }

  cellIndex(x, z) {
    const i = Math.floor((x + WORLD_HALF) / CELL), j = Math.floor((z + WORLD_HALF) / CELL);
    if (i < 0 || j < 0 || i >= GRID || j >= GRID) return -1;
    return j * GRID + i;
  }

  update(pos) {
    const c = this.cellIndex(pos.x, pos.z);
    if (c === this.lastCell) return;
    this.lastCell = c;
    this.reveal(pos.x, pos.z, 55);
  }

  reveal(x, z, r) {
    const ci = Math.floor((x + WORLD_HALF) / CELL), cj = Math.floor((z + WORLD_HALF) / CELL);
    const n = Math.ceil(r / CELL);
    for (let j = cj - n; j <= cj + n; j++) {
      for (let i = ci - n; i <= ci + n; i++) {
        if (i < 0 || j < 0 || i >= GRID || j >= GRID) continue;
        const cx = -WORLD_HALF + (i + 0.5) * CELL, cz = -WORLD_HALF + (j + 0.5) * CELL;
        if (Math.hypot(cx - x, cz - z) <= r) this.revealed[j * GRID + i] = 1;
      }
    }
  }

  isRevealed(i, j) {
    return this.revealed[j * GRID + i] === 1;
  }

  revealedFraction() {
    let n = 0;
    for (let i = 0; i < this.revealed.length; i++) n += this.revealed[i];
    return n / this.revealed.length;
  }

  serialize() {
    const bytes = new Uint8Array(this.revealed.length / 8);
    for (let i = 0; i < this.revealed.length; i++) if (this.revealed[i]) bytes[i >> 3] |= 1 << (i & 7);
    let s = '';
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s);
  }

  load(data) {
    this.revealed.fill(0);
    this.lastCell = -1;
    if (!data) return;
    try {
      const s = atob(data);
      for (let i = 0; i < this.revealed.length; i++) {
        this.revealed[i] = (s.charCodeAt(i >> 3) >> (i & 7)) & 1;
      }
    } catch (e) {
      console.warn('Bad map data', e);
    }
  }
}
