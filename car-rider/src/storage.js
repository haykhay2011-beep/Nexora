// Persistent save data. Every access is wrapped so private mode / blocked
// storage simply falls back to in-memory defaults.
const KEY = 'carRider.save.v1';

const DEFAULTS = {
  best: 0,
  unlocked: ['compact'],
  selected: 'compact',
  muted: false,
  units: 'kmh',
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
