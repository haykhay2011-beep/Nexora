// Human-readable place names for any location and year.
import { CITIES } from '../data';
import type { CityDef, SettlementTier } from '../data/types';
import { TIER_ORDER } from '../data/types';
import type { EarthData } from './earth';

export function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function cityTier(c: CityDef, year: number): SettlementTier {
  if (year < c.founded) return 'none';
  let t: SettlementTier = 'none';
  for (const [y, tier] of c.tiers) if (year >= y) t = tier;
  return t;
}

export function cityName(c: CityDef, year: number): string {
  if (c.names) for (const n of c.names) if (year >= n.from && year < n.to) return n.name;
  return c.name;
}

export interface NearCity { city: CityDef; km: number; tier: SettlementTier; name: string }

export function nearestCity(lat: number, lon: number, year: number, maxKm = 60): NearCity | null {
  let best: NearCity | null = null;
  for (const c of CITIES) {
    if (Math.abs(c.lat - lat) > 1.5) continue;
    const km = distanceKm(lat, lon, c.lat, c.lon);
    if (km > maxKm) continue;
    const tier = cityTier(c, year);
    if (tier === 'none') continue;
    // bigger cities "reach" further
    const reach = km / (1 + TIER_ORDER.indexOf(tier) * 0.35);
    if (!best || reach < best.km / (1 + TIER_ORDER.indexOf(best.tier) * 0.35)) best = { city: c, km, tier, name: cityName(c, year) };
  }
  return best;
}

export interface PlaceInfo {
  name: string; // "Nile Valley, Egypt"
  short: string;
  country: string | null;
  region: string | null;
  city: string | null;
  ocean: boolean;
}

const PHYSICAL_PREFIX: Record<string, string> = {
  'Range/mtn': '', Desert: '', Plateau: '', Basin: '', Plain: '', Lowland: '', Valley: '', Gorge: '', Delta: '', Wetlands: '', Tundra: '', Foothills: '',
};

export function describePlace(earth: EarthData, presentLat: number, presentLon: number, year: number, land: number, zoneName?: string): PlaceInfo {
  const s = earth.sample(presentLat, presentLon);
  const country = earth.countryName(s.country);
  const deep = year < -11700;
  if (land < 0.5) {
    const sea = earth.marineName(s.marine);
    const nm = sea ?? (Math.abs(presentLat) > 60 ? (presentLat > 0 ? 'Arctic Ocean' : 'Southern Ocean') : 'Open ocean');
    const near = country && Math.abs(s.coastDist) < 6 ? `, off ${country}` : '';
    return { name: deep ? `Ancient sea (${nm} today)` : nm + near, short: nm, country, region: null, city: null, ocean: true };
  }
  const reg = earth.regionName(s.region);
  const adm = earth.admin1Name(s.admin1);
  const near = year > -12000 ? nearestCity(presentLat, presentLon, year, 30) : null;
  let base: string;
  if (near && near.km < (near.tier === 'metropolis' ? 30 : near.tier === 'city' ? 18 : 10)) base = near.name;
  else if (zoneName && (s.riverSize >= 1 || !reg)) base = zoneName;
  else if (reg && PHYSICAL_PREFIX[reg.cls] !== undefined) base = reg.name;
  else if (reg && (reg.cls === 'Island' || reg.cls === 'Island group' || reg.cls === 'Peninsula' || reg.cls === 'Pen/cape' || reg.cls === 'Coast')) base = reg.name;
  else if (adm) base = adm;
  else base = reg?.name ?? country ?? 'Unknown lands';
  if (s.riverSize >= 2 && !near && reg?.cls !== 'Delta') {
    if (base === adm || base === country) base = `${base} river valley`;
  }
  let name = country && base !== country ? `${base}, ${country}` : base;
  if (deep) name = `near present-day ${name}`;
  return { name, short: base, country, region: reg?.name ?? null, city: near?.name ?? null, ocean: false };
}
