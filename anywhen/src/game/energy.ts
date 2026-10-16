// Chrono energy costs and era unlocking.
import { eraForYear } from '../core/timeScale';
import { distanceKm } from '../geo/places';
import type { GameState } from './state';
import type { EraId } from '../data/types';

export function jumpCost(from: { lat: number; lon: number; year: number; moon: boolean }, to: { lat: number; lon: number; year: number; moon: boolean }): number {
  const dy = Math.abs(to.year - from.year);
  const time = 6.2 * Math.log10(1 + dy);
  const km = from.moon || to.moon ? 384000 : distanceKm(from.lat, from.lon, to.lat, to.lon);
  const space = Math.min(9, km / 2200) + (to.moon !== from.moon ? 12 : 0);
  return Math.round(3 + time + space);
}

const UNLOCK_BY_RETURNS: [number, EraId[]][] = [[4, ['stoneage', 'iceage']], [10, ['mammals', 'dinosaurs']], [16, ['farfuture']]];

export function eraUnlocked(s: GameState, year: number): boolean {
  return s.unlocks.eras.includes(eraForYear(year).id);
}

/** Apply unlocks earned by returned anomalies. Returns newly unlocked era ids. */
export function checkUnlocks(s: GameState): string[] {
  const out: string[] = [];
  for (const [n, eras] of UNLOCK_BY_RETURNS) if (s.returned.length >= n) for (const e of eras) if (!s.unlocks.eras.includes(e)) { s.unlocks.eras.push(e); out.push(e); }
  if (s.returned.length >= 6 && !s.unlocks.moon) { s.unlocks.moon = true; out.push('moon'); }
  return out;
}

export function nextUnlockHint(s: GameState): string | null {
  for (const [n, eras] of UNLOCK_BY_RETURNS) if (eras.some((e) => !s.unlocks.eras.includes(e))) return `Return ${n - s.returned.length} more anomal${n - s.returned.length === 1 ? 'y' : 'ies'} (or repair Rifts) to unlock ${eras.join(' & ').replace('iceage', 'the Ice Age').replace('stoneage', 'the Stone Age').replace('mammals', 'the Age of Mammals').replace('dinosaurs', 'the Age of Dinosaurs').replace('farfuture', 'the Far Future')}.`;
  return null;
}

export function regen(s: GameState, dt: number) {
  const cap = s.maxEnergy * 0.5;
  if (s.energy < cap) s.energy = Math.min(cap, s.energy + dt / 3.5);
}
