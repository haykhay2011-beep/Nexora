// Non-linear year slider, year parsing and formatting, era lookup.
import { ERAS } from '../data';
import type { EraProfile } from '../data/types';

export const MIN_YEAR = -72_000_000;
export const MAX_YEAR = 3000;

// [slider position, year]. Deep-time segments interpolate in log(years before 2000).
const KEYS: [number, number][] = [
  [0, -72_000_000], [0.035, -66_000_000], [0.08, -10_000_000], [0.11, -2_580_000], [0.17, -115_000],
  [0.245, -11_700], [0.31, -3500], [0.41, -800], [0.51, 500], [0.62, 1450], [0.71, 1750],
  [0.8, 1914], [0.885, 2030], [0.94, 2200], [1, 3000],
];
const LOG_LIMIT = -11_700;
const toLog = (y: number) => Math.log(2000 - y);
const fromLog = (v: number) => 2000 - Math.exp(v);

export function sliderToYear(s: number): number {
  s = Math.min(1, Math.max(0, s));
  for (let i = 0; i < KEYS.length - 1; i++) {
    const [s0, y0] = KEYS[i], [s1, y1] = KEYS[i + 1];
    if (s <= s1) {
      const t = (s - s0) / (s1 - s0);
      if (y1 <= LOG_LIMIT) return Math.round(fromLog(toLog(y0) + (toLog(y1) - toLog(y0)) * t));
      return Math.round(y0 + (y1 - y0) * t);
    }
  }
  return MAX_YEAR;
}

export function yearToSlider(y: number): number {
  y = clampYear(y);
  for (let i = 0; i < KEYS.length - 1; i++) {
    const [s0, y0] = KEYS[i], [s1, y1] = KEYS[i + 1];
    if (y <= y1) {
      const t = y1 <= LOG_LIMIT ? (toLog(y) - toLog(y0)) / (toLog(y1) - toLog(y0)) : (y - y0) / (y1 - y0);
      return s0 + (s1 - s0) * t;
    }
  }
  return 1;
}

export const clampYear = (y: number) => Math.round(Math.min(MAX_YEAR, Math.max(MIN_YEAR, y)));

/** Nicely rounded year for display after slider motion. */
export function snapYear(y: number): number {
  const a = Math.abs(y);
  let step = 1;
  if (a >= 10_000_000) step = 500_000;
  else if (a >= 1_000_000) step = 50_000;
  else if (a >= 100_000) step = 5000;
  else if (a >= 20_000) step = 500;
  else if (a >= 5000) step = 50;
  else if (y < 0) step = 10;
  return clampYear(Math.round(y / step) * step);
}

const fmtInt = (n: number) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');

export function formatYear(y: number): string {
  if (y <= -1_000_000) {
    const m = -y / 1_000_000;
    return `${m >= 10 ? m.toFixed(m % 1 === 0 ? 0 : 1) : m.toFixed(2).replace(/0$/, '')} million years ago`;
  }
  if (y <= -10_000) return `${fmtInt(-y)} years ago`;
  if (y < 0) return `${fmtInt(-y)} BCE`;
  if (y === 0) return '1 BCE';
  if (y < 1000) return `${y} CE`;
  return `${y}`;
}

/** Accepts "1500", "1500 CE", "-3000", "3000 BC", "3000 BCE", "20,000 years ago", "66 mya", "66 million years ago", "70 Ma". */
export function parseYear(input: string): number | null {
  let s = input.trim().toLowerCase().replace(/,/g, '').replace(/\s+/g, ' ');
  if (!s) return null;
  const num = parseFloat(s.replace(/^[^\d.-]+/, ''));
  if (isNaN(num)) return null;
  if (/(million|mya|\bma\b|my\b|m years)/.test(s)) return clampYear(-Math.abs(num) * 1_000_000);
  if (/(thousand|kya|\bka\b|k years)/.test(s)) return clampYear(-Math.abs(num) * 1000);
  if (/\d\s*k\b/.test(s) && /(ago|bp|bce|bc)/.test(s)) return clampYear(-Math.abs(num) * 1000);
  if (/(years ago|yrs ago|ago|bp)/.test(s)) return clampYear(-Math.abs(num));
  if (/(bce|bc|b\.c)/.test(s)) return clampYear(-Math.abs(num));
  if (/(ce|ad|a\.d)/.test(s)) return clampYear(Math.abs(num));
  return clampYear(num);
}

export function eraForYear(y: number): EraProfile {
  for (const e of ERAS) if (y >= e.start && y < e.end) return e;
  return y < ERAS[0].start ? ERAS[0] : ERAS[ERAS.length - 1];
}

export function eraBucket(y: number): number {
  const e = eraForYear(y);
  return Math.floor((y - e.start) / e.bucketYears);
}

/** Years between two dates on a log-ish scale, used for energy costs. */
export function timeDistance(a: number, b: number): number {
  return Math.abs(a - b);
}
