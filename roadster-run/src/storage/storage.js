// Persistent save data in localStorage. Every read and write is wrapped in
// try/catch so private mode, blocked storage or quota errors never break the game.
const KEY = 'roadster-run.save.v1';

const DEFAULTS = () => ({
  coins: 0,
  upgrades: { battery: 0, motor: 0, tires: 0, brakes: 0, aero: 0, life: 0 },
  paints: ['#d7263d'],
  paint: '#d7263d',
  destination: 'coast',
  unlocked: ['coast'],
  best: {},
  units: 'kmh',
  muted: false,
  quality: 'auto',
  runs: 0,
});

export class Storage {
  constructor() {
    this.data = DEFAULTS();
    try {
      const raw = window.localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          const d = DEFAULTS();
          this.data = { ...d, ...parsed, upgrades: { ...d.upgrades, ...(parsed.upgrades || {}) }, best: { ...(parsed.best || {}) } };
          if (!Array.isArray(this.data.paints) || !this.data.paints.length) this.data.paints = d.paints;
          if (!Array.isArray(this.data.unlocked) || !this.data.unlocked.includes('coast')) this.data.unlocked = ['coast', ...(this.data.unlocked || [])];
          if (!Number.isFinite(this.data.coins)) this.data.coins = 0;
        }
      }
    } catch (e) {
      console.warn('Save data could not be read; starting fresh.', e);
      this.data = DEFAULTS();
    }
  }

  save() {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(this.data));
      return true;
    } catch (e) {
      console.warn('Save data could not be written.', e);
      return false;
    }
  }

  get(k) { return this.data[k]; }
  set(k, v) { this.data[k] = v; this.save(); }

  bestFor(dest) { return this.data.best[dest] || 0; }
  submitScore(dest, score) {
    const prev = this.bestFor(dest);
    if (score > prev) { this.data.best[dest] = score; this.save(); return true; }
    return false;
  }

  reset() {
    this.data = DEFAULTS();
    try { window.localStorage.removeItem(KEY); } catch { /* ignore */ }
    this.save();
  }
}
