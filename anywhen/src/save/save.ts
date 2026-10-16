// IndexedDB persistence (with localStorage + memory fallbacks; every call is try/catch guarded).
import type { GameState, Settings } from '../game/state';
import { DEFAULT_SETTINGS, newGame } from '../game/state';

const DB = 'anywhen';
const STORE = 'saves';
const KEY = 'slot0';
let memory: GameState | null = null;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    try {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => { req.result.createObjectStore(STORE); };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    } catch (e) { reject(e); }
  });
}

export async function saveGame(s: GameState): Promise<boolean> {
  memory = JSON.parse(JSON.stringify(s));
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(JSON.parse(JSON.stringify(s)), KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    return true;
  } catch (e) {
    try { localStorage.setItem('anywhen-save', JSON.stringify({ ...s, photos: s.photos.slice(-6) })); return true; } catch { /* storage unavailable */ }
    console.warn('save failed', e);
    return false;
  }
}

export async function loadGame(): Promise<GameState | null> {
  try {
    const db = await openDb();
    const v = await new Promise<GameState | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const r = tx.objectStore(STORE).get(KEY);
      r.onsuccess = () => resolve(r.result as GameState | undefined);
      r.onerror = () => reject(r.error);
    });
    db.close();
    if (v) return migrate(v);
  } catch { /* fall through */ }
  try {
    const raw = localStorage.getItem('anywhen-save');
    if (raw) return migrate(JSON.parse(raw));
  } catch { /* ignore */ }
  return memory ? migrate(memory) : null;
}

export async function hasSave(): Promise<boolean> { return !!(await loadGame()); }

export async function deleteSave(): Promise<void> {
  memory = null;
  try { const db = await openDb(); const tx = db.transaction(STORE, 'readwrite'); tx.objectStore(STORE).delete(KEY); db.close(); } catch { /* ignore */ }
  try { localStorage.removeItem('anywhen-save'); } catch { /* ignore */ }
}

function migrate(s: GameState): GameState {
  const base = newGame();
  return { ...base, ...s, settings: { ...DEFAULT_SETTINGS, ...(s.settings ?? {}) }, journal: { ...base.journal, ...(s.journal ?? {}) }, unlocks: { ...base.unlocks, ...(s.unlocks ?? {}) }, story: { ...base.story, ...(s.story ?? {}) } };
}

export function loadSettings(): Settings {
  try { const raw = localStorage.getItem('anywhen-settings'); if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }; } catch { /* ignore */ }
  return { ...DEFAULT_SETTINGS };
}
export function storeSettings(s: Settings) { try { localStorage.setItem('anywhen-settings', JSON.stringify(s)); } catch { /* ignore */ } }
