import { describe, it, expect } from 'vitest';
import { ERAS, REGIONS, STYLE_BY_ID, CROP_BY_ID, ANIMAL_BY_ID, ITEM_BY_ID, LANDMARKS, ANOMALIES, RIFTS, SPECIES_BY_ID, FLORA, ERA_BY_ID, ANOMALY_BY_ID, LANDMARK_BY_ID } from '../src/data';
import { BUILDERS } from '../src/gen/landmarks';
import { sliderToYear, yearToSlider, parseYear, formatYear, eraForYear } from '../src/core/timeScale';

describe('data references', () => {
  it('eras are contiguous', () => {
    for (let i = 1; i < ERAS.length; i++) expect(ERAS[i].start).toBe(ERAS[i - 1].end);
  });
  it('styles, crops, animals and goods referenced by eras and regions exist', () => {
    const check = (o: { styles?: string[]; crops?: string[]; domestic?: string[]; goods?: string[]; biomeStyles?: Record<string, string[]> } | undefined, where: string) => {
      if (!o) return;
      for (const s of o.styles ?? []) expect(STYLE_BY_ID.has(s), `${where} style ${s}`).toBe(true);
      for (const v of Object.values(o.biomeStyles ?? {})) for (const s of v) expect(STYLE_BY_ID.has(s), `${where} biome style ${s}`).toBe(true);
      for (const c of o.crops ?? []) expect(CROP_BY_ID.has(c), `${where} crop ${c}`).toBe(true);
      for (const a of o.domestic ?? []) expect(ANIMAL_BY_ID.has(a), `${where} animal ${a}`).toBe(true);
      for (const g of o.goods ?? []) expect(ITEM_BY_ID.has(g), `${where} good ${g}`).toBe(true);
    };
    for (const e of ERAS) check(e, e.id);
    for (const r of REGIONS) {
      check(r.defaults, r.id);
      for (const [k, v] of Object.entries(r.eras)) { expect(ERA_BY_ID.has(k as never)).toBe(true); check(v, `${r.id}.${k}`); }
      for (const z of r.subzones ?? []) { check(z, z.name); for (const v of Object.values(z.eras ?? {})) check(v, z.name); }
      for (const pl of r.defaults.plants ?? []) expect(SPECIES_BY_ID.has(pl), pl).toBe(true);
    }
  });
  it('flora kits reference real species', () => {
    for (const kit of Object.values(FLORA.kits)) for (const list of Object.values(kit)) for (const [id] of list) expect(SPECIES_BY_ID.has(id), id).toBe(true);
  });
  it('there are at least 40 landmarks with valid builders', () => {
    expect(LANDMARKS.length).toBeGreaterThanOrEqual(40);
    for (const l of LANDMARKS) {
      expect(l.builder === 'none' || !!BUILDERS[l.builder], l.builder).toBe(true);
      expect(l.stages.length).toBeGreaterThan(0);
      for (let i = 1; i < l.stages.length; i++) expect(l.stages[i].from).toBeGreaterThanOrEqual(l.stages[i - 1].from);
    }
    const regions = new Set(LANDMARKS.map((l) => l.region));
    for (const r of ['europe', 'mena', 'subsaharan', 'southasia', 'eastasia', 'seasia', 'oceania', 'northamerica', 'centralamerica', 'southamerica', 'arctic', 'antarctica']) expect(regions.has(r), r).toBe(true);
  });
  it('anomalies and rifts are consistent', () => {
    for (const a of ANOMALIES) expect(ERA_BY_ID.has(a.homeEra)).toBe(true);
    expect(RIFTS.length).toBe(12);
    for (const r of RIFTS) for (const s of r.steps) {
      if (s.anomaly) expect(ANOMALY_BY_ID.has(s.anomaly), s.anomaly).toBe(true);
      if (s.item) expect(ITEM_BY_ID.has(s.item), s.item).toBe(true);
      if (s.landmark) expect(LANDMARK_BY_ID.has(s.landmark), s.landmark).toBe(true);
      if (s.npc) expect(r.npcs.some((n) => n.id === s.npc), s.npc).toBe(true);
    }
  });
});

describe('time scale', () => {
  it('slider round-trips and is monotonic', () => {
    let prev = -Infinity;
    for (let s = 0; s <= 1.0001; s += 0.01) {
      const y = sliderToYear(s);
      expect(y).toBeGreaterThanOrEqual(prev);
      prev = y;
      if (Math.abs(y) > 100) expect(Math.abs(yearToSlider(y) - s)).toBeLessThan(0.01);
    }
    expect(sliderToYear(0)).toBe(-72_000_000);
    expect(sliderToYear(1)).toBe(3000);
  });
  it('parses typed years', () => {
    expect(parseYear('1500')).toBe(1500);
    expect(parseYear('3000 BCE')).toBe(-3000);
    expect(parseYear('500 BC')).toBe(-500);
    expect(parseYear('66 mya')).toBe(-66_000_000);
    expect(parseYear('70 million years ago')).toBe(-70_000_000);
    expect(parseYear('20,000 years ago')).toBe(-20000);
    expect(parseYear('2024 AD')).toBe(2024);
    expect(parseYear('nonsense')).toBeNull();
  });
  it('formats and classifies', () => {
    expect(formatYear(-2560)).toBe('2,560 BCE');
    expect(formatYear(-66_000_000)).toBe('66 million years ago');
    expect(eraForYear(-2560).id).toBe('earlyciv');
    expect(eraForYear(2024).id).toBe('modern');
    expect(eraForYear(-70_000_000).id).toBe('dinosaurs');
  });
});
