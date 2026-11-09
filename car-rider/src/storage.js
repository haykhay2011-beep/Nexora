// Persistent save data. Every access is wrapped so private mode / blocked
// storage simply falls back to in-memory defaults.
const KEY = 'carRider.save.v1';

const DEFAULTS = {
  best: 0,
  unlocked: ['compact'],
  selected: 'compact',
  muted: false,
  units: 'kmh',
  speedMul: 1,
  traffic: 12,
  noHesi: false,
  colors: {},
  coins: 0,
  upgrades: {},
  country: 'AM',
  countryBest: {},
};

function read() {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const data = JSON.parse(raw);
    return {
      ...DEFAULTS,
      ...data,
      unlocked: Array.isArray(data.unlocked) ? data.unlocked : [...DEFAULTS.unlocked],
      colors: data.colors && typeof data.colors === 'object' ? data.colors : {},
      upgrades: data.upgrades && typeof data.upgrades === 'object' ? data.upgrades : {},
      countryBest: data.countryBest && typeof data.countryBest === 'object' ? data.countryBest : {},
      coins: Math.max(0, Math.floor(Number(data.coins) || 0)),
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export const save = read();

export function persist() {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(save));
  } catch {
    /* storage unavailable: keep playing with in-memory state */
  }
}
