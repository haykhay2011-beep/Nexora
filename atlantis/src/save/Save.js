// Save / load progress to localStorage. Every access is guarded: storage can be missing or full.

const KEY = 'atlantis-the-game-save-v1';
const SETTINGS_KEY = 'atlantis-the-game-settings-v1';

export function freshState() {
  return {
    pearls: 0,
    oxygen: null,
    upgrades: { tank: 0, fins: 0, pressure: 0, light: 0, heat: 0, sonar: 0 },
    shards: new Set(),
    collected: new Set(),
    journal: new Set(),
    relics: new Set(),
    puzzles: {},
    discovered: new Set(),
    flags: {},
    map: null,
    pos: null,
    yaw: 0,
    playTime: 0,
    ended: false,
  };
}

export function serialize(state, player, mapData) {
  return JSON.stringify({
    v: 1,
    savedAt: Date.now(),
    pearls: state.pearls,
    upgrades: state.upgrades,
    shards: [...state.shards],
    collected: [...state.collected],
    journal: [...state.journal],
    relics: [...state.relics],
    puzzles: state.puzzles,
    discovered: [...state.discovered],
    flags: state.flags,
    map: mapData,
    pos: player ? [player.pos.x, player.pos.y, player.pos.z] : state.pos,
    yaw: player ? player.yaw : state.yaw,
    playTime: state.playTime,
    ended: state.ended,
  });
}

export function deserialize(json) {
  const d = JSON.parse(json);
  const s = freshState();
  s.pearls = d.pearls | 0;
  Object.assign(s.upgrades, d.upgrades || {});
  s.shards = new Set(d.shards || []);
  s.collected = new Set(d.collected || []);
  s.journal = new Set(d.journal || []);
  s.relics = new Set(d.relics || []);
  s.puzzles = d.puzzles || {};
  s.discovered = new Set(d.discovered || []);
  s.flags = d.flags || {};
  s.map = d.map || null;
  s.pos = Array.isArray(d.pos) ? d.pos : null;
  s.yaw = d.yaw || 0;
  s.playTime = d.playTime || 0;
  s.ended = !!d.ended;
  return s;
}

export function writeSave(json) {
  try {
    localStorage.setItem(KEY, json);
    return true;
  } catch (e) {
    console.warn('Save failed', e);
    return false;
  }
}

export function readSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return deserialize(raw);
  } catch (e) {
    console.warn('Could not read save', e);
    return null;
  }
}

export function hasSave() {
  try {
    return !!localStorage.getItem(KEY);
  } catch (e) {
    return false;
  }
}

export function saveInfo() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    return { shards: (d.shards || []).length, playTime: d.playTime || 0, savedAt: d.savedAt };
  } catch (e) {
    return null;
  }
}

export function deleteSave() {
  try {
    localStorage.removeItem(KEY);
  } catch (e) { /* ignore */ }
}

export const DEFAULT_SETTINGS = {
  sensitivity: 1,
  invertY: false,
  master: 0.8,
  music: 0.6,
  sfx: 0.8,
  quality: 'medium',
};

export function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch (e) {
    return { ...DEFAULT_SETTINGS };
  }
}

export function storeSettings(s) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch (e) { /* ignore */ }
}
