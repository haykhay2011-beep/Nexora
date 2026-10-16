// Simplified paleogeography: plate drift in deep time, glacial sea level, ice sheets, exposed shelves.
import { PALEO } from '../data';
import type { EarthData, EarthSample } from './earth';

const D2R = Math.PI / 180;
type V3 = [number, number, number];

export function toVec(lat: number, lon: number): V3 {
  const la = lat * D2R, lo = lon * D2R;
  return [Math.cos(la) * Math.cos(lo), Math.sin(la), -Math.cos(la) * Math.sin(lo)];
}
export function fromVec(v: V3): [number, number] {
  const len = Math.hypot(v[0], v[1], v[2]) || 1;
  const lat = Math.asin(Math.max(-1, Math.min(1, v[1] / len))) / D2R;
  const lon = Math.atan2(-v[2], v[0]) / D2R;
  return [lat, lon];
}
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

function rotate(v: V3, axis: V3, ang: number): V3 {
  const c = Math.cos(ang), s = Math.sin(ang);
  const k = axis;
  const kv = cross(k, v);
  const kd = dot(k, v);
  return [
    v[0] * c + kv[0] * s + k[0] * kd * (1 - c),
    v[1] * c + kv[1] * s + k[1] * kd * (1 - c),
    v[2] * c + kv[2] * s + k[2] * kd * (1 - c),
  ];
}

interface PlateRot { axis: V3; angle: number }
const plateRots = new Map<number, PlateRot>();
for (const [id, p] of Object.entries(PALEO.plates)) {
  const a = toVec(p.centroid[1], p.centroid[0]);
  const b = toVec(p.centroid[1] + p.shift66[0], p.centroid[0] + p.shift66[1]);
  let axis = cross(a, b);
  const len = Math.hypot(...axis);
  const angle = Math.acos(Math.max(-1, Math.min(1, dot(a, b))));
  if (len < 1e-9) axis = [0, 1, 0];
  else axis = [axis[0] / len, axis[1] / len, axis[2] / len];
  plateRots.set(Number(id), { axis, angle });
}

/** 0 for the last million years, ~1 at 66 Ma, up to ~1.09 at 72 Ma. */
export function driftFactor(year: number): number {
  if (year > -1_000_000) return 0;
  return Math.min(1.1, -year / 66_000_000);
}

export function glacialFactor(year: number): number {
  if (year < -2_580_000) return 0;
  for (const g of PALEO.glacial) if (year >= g.from && year < g.to) return g.factor;
  return 0;
}

/** Sea level in metres relative to today. */
export function seaLevelAt(year: number, eraSeaLevel: number): number {
  if (year < -2_580_000) return eraSeaLevel;
  const g = glacialFactor(year);
  if (year < 1900) return -125 * g;
  return eraSeaLevel;
}

/** Map a present-day position to its paleo position at `year` for a given plate. */
export function presentToPast(lat: number, lon: number, plate: number, year: number): [number, number] {
  const f = driftFactor(year);
  const r = plateRots.get(plate);
  if (!f || !r || r.angle === 0) return [lat, lon];
  return fromVec(rotate(toVec(lat, lon), r.axis, r.angle * f));
}

/**
 * For a position on the *displayed* (paleo) globe, find the present-day location of the ground there.
 * Returns null when no plate covers this spot (open ocean in the past).
 */
export function pastToPresent(earth: EarthData, lat: number, lon: number, year: number): { lat: number; lon: number; plate: number } | null {
  const f = driftFactor(year);
  if (!f) return { lat, lon, plate: earth.plateAt(lat, lon) };
  let best: { lat: number; lon: number; plate: number; land: number } | null = null;
  for (const [id, r] of plateRots) {
    if (id === 9) continue;
    const [plat, plon] = fromVec(rotate(toVec(lat, lon), r.axis, -r.angle * f));
    if (earth.plateAt(plat, plon) !== id) continue;
    const land = earth.landAt(plat, plon);
    if (!best || land > best.land) best = { lat: plat, lon: plon, plate: id, land };
  }
  return best;
}

function inPoly(lon: number, lat: number, poly: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
export { inPoly };

/** Ice sheet cover 0..1 at a present-day location for a year. */
export function iceCover(lat: number, lon: number, year: number, elev: number): number {
  const g = glacialFactor(year);
  let c = 0;
  if (g > 0) {
    for (const s of PALEO.iceSheets) {
      if (inPoly(lon, lat, s.polygon)) {
        // smaller extent when the glacial factor is weaker: shrink toward the poles
        const strength = s.name === 'Greenland' ? 1 : g;
        const edge = Math.abs(lat) > 62 ? 1 : strength;
        c = Math.max(c, edge >= 0.55 ? 1 : edge * 1.3);
      }
    }
    if (elev > 2600 - 1400 * g) c = Math.max(c, 0.9);
  }
  if (year > -34_000_000 && lat < -63) c = Math.max(c, 1); // Antarctic ice sheet since ~34 Ma
  if (year > -2_580_000 && lat > 60 && lon > -73 && lon < -12 && inPoly(lon, lat, PALEO.iceSheets[2].polygon) && elev > 300) c = Math.max(c, 1);
  return c;
}

/** Whether a shallow shelf is exposed as dry land at this sea level. */
export function shelfExposed(lat: number, lon: number, seaLevel: number): boolean {
  if (seaLevel > -35) return false;
  for (const s of PALEO.shelves) {
    if (-seaLevel < s.depth) continue;
    if (inPoly(lon, lat, s.polygon) || (s.polygon2 && inPoly(lon, lat, s.polygon2))) return true;
  }
  return false;
}

export interface PaleoSample extends EarthSample {
  presentLat: number;
  presentLon: number;
  ice: number;
  seaLevel: number;
}

/** Land/elevation at a displayed (paleo) location for a year, including sea-level and shelf changes. */
export function paleoSample(earth: EarthData, lat: number, lon: number, year: number, eraSeaLevel: number): PaleoSample {
  const seaLevel = seaLevelAt(year, eraSeaLevel);
  const src = pastToPresent(earth, lat, lon, year);
  if (!src) {
    const s = earth.sample(lat, lon);
    return { ...s, land: 0, lake: 0, elev: 0, riverSize: 0, riverAngle: -1, coastDist: -40, presentLat: lat, presentLon: lon, ice: 0, seaLevel };
  }
  const s = earth.sample(src.lat, src.lon);
  let land = s.land;
  if (seaLevel > 5) {
    // flood lowlands: land below the new sea level disappears
    const keep = Math.min(1, Math.max(0, (s.elev - seaLevel + 60) / 160));
    land *= keep;
  } else if (seaLevel < -35 && land < 0.6 && s.coastDist > -12 && shelfExposed(src.lat, src.lon, seaLevel)) {
    land = Math.max(land, 0.85);
  }
  return { ...s, land, presentLat: src.lat, presentLon: src.lon, ice: iceCover(src.lat, src.lon, year, s.elev), seaLevel };
}
