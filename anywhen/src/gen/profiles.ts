// Region lookup and era + region (+ sub-zone) profile merging.
import { REGIONS, era as getEra } from '../data';
import type { EraId, EraProfile, RegionEraOverride, RegionProfile, SubZone, ClothingSpec, Currency, PeopleType, Layout, SettlementTier } from '../data/types';
import { inPoly } from '../geo/paleo';

export function regionAt(lat: number, lon: number): RegionProfile {
  for (const r of REGIONS) for (const p of r.polygons) if (inPoly(lon, lat, p)) return r;
  // fallback: nearest polygon vertex (mid-ocean)
  let best = REGIONS[0], bd = Infinity;
  for (const r of REGIONS) for (const p of r.polygons) for (const [x, y] of p) {
    const d = (x - lon) ** 2 + (y - lat) ** 2;
    if (d < bd) { bd = d; best = r; }
  }
  return best;
}

export function subzoneAt(region: RegionProfile, lat: number, lon: number): SubZone | null {
  for (const z of region.subzones ?? []) for (const p of z.polygons) if (inPoly(lon, lat, p)) return z;
  return null;
}

export interface WorldProfile {
  era: EraProfile;
  region: RegionProfile;
  subzone: SubZone | null;
  humanArrival: number;
  styles: string[];
  crops: string[];
  domestic: string[];
  plants: string[];
  clothing: ClothingSpec;
  currency: Currency;
  goods: string[];
  people: PeopleType[];
  layout: Layout;
  walls: boolean;
  boats: string[];
  mounts: string[];
  settlementScale: number;
  nouns: Partial<Record<SettlementTier, string>>;
  facts: string[];
}

function apply(p: WorldProfile, o: RegionEraOverride | undefined, biome: string) {
  if (!o) return;
  if (o.styles) p.styles = o.styles;
  if (o.biomeStyles && o.biomeStyles[biome]) p.styles = o.biomeStyles[biome];
  if (o.crops) p.crops = o.crops;
  if (o.domestic) p.domestic = o.domestic;
  if (o.plants) p.plants = [...new Set([...p.plants, ...o.plants])];
  if (o.clothing) p.clothing = { ...p.clothing, ...o.clothing };
  if (o.currency) p.currency = o.currency;
  if (o.goods) p.goods = o.goods;
  if (o.people) p.people = [...o.people, ...p.people].slice(0, 8);
  if (o.layout) p.layout = o.layout;
  if (o.walls !== undefined) p.walls = o.walls;
  if (o.boats) p.boats = o.boats;
  if (o.mounts) p.mounts = o.mounts;
  if (o.settlementScale !== undefined) p.settlementScale *= o.settlementScale;
  if (o.nouns) p.nouns = { ...p.nouns, ...o.nouns };
  if (o.facts) p.facts = [...o.facts, ...p.facts];
}

export function resolveProfile(eraId: EraId, region: RegionProfile, subzone: SubZone | null, biome: string): WorldProfile {
  const e = getEra(eraId);
  const p: WorldProfile = {
    era: e,
    region,
    subzone,
    humanArrival: subzone?.humanArrival ?? region.humanArrival,
    styles: e.styles,
    crops: [],
    domestic: e.domestic,
    plants: [],
    clothing: { ...e.clothing },
    currency: e.currency,
    goods: e.goods,
    people: e.people,
    layout: e.layout,
    walls: false,
    boats: e.boats,
    mounts: e.mounts,
    settlementScale: e.settlementScale,
    nouns: {},
    facts: [],
  };
  // modern-and-later clothing is global; earlier eras take regional clothing where defined
  const keepEraClothing = e.tech >= 8;
  const strip = (o?: RegionEraOverride): RegionEraOverride | undefined => (o && keepEraClothing ? { ...o, clothing: undefined } : o);
  apply(p, strip(region.defaults), biome);
  // era defaults win for these when the region has nothing era-specific
  if (e.tech >= 8) { p.styles = e.styles; p.goods = e.goods; p.currency = region.eras[eraId]?.currency ?? e.currency; }
  if (e.tech <= 1 && !region.eras[eraId]?.styles) p.styles = region.defaults.styles ?? e.styles;
  if (e.tech <= 2) { p.goods = e.goods; p.currency = e.currency; }
  apply(p, strip(region.eras[eraId]), biome);
  if (subzone) {
    const { name: _n, polygons: _p, humanArrival: _h, eras, ...top } = subzone;
    void _n; void _p; void _h;
    apply(p, strip(top), biome);
    apply(p, strip(eras?.[eraId]), biome);
  }
  if (e.tech <= 2) p.walls = false;
  if (e.tech >= 8) p.walls = false;
  return p;
}
