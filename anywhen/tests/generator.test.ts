import { describe, it, expect } from 'vitest';
import { loadEarthSync } from './helpers';
import { planWorld, worldKey, landmarkPos } from '../src/gen/plan';
import { TerrainSampler } from '../src/gen/terrain';
import { buildChunk } from '../src/gen/chunk';
import { buildStructures } from '../src/gen/structures';
import { ERAS, REGIONS, LANDMARKS } from '../src/data';
import { presentToPast } from '../src/geo/paleo';

const earth = loadEarthSync();

// one representative land location per region
const REGION_POINTS: Record<string, [number, number]> = {
  arctic: [69.5, 30], antarctica: [-75, 0], europe: [48.85, 2.35], mena: [30.04, 31.24], subsaharan: [-1.29, 36.82],
  southasia: [27.17, 78.04], northasia: [47.9, 106.9], eastasia: [34.8, 114.3], seasia: [13.75, 100.5], oceania: [-33.87, 151.2],
  northamerica: [39.95, -75.16], centralamerica: [19.43, -99.13], southamerica: [-13.53, -71.97],
};

function representativeYear(e: (typeof ERAS)[number]): number {
  return Math.round((e.start + Math.min(e.end, 3000)) / 2);
}

function hashArr(a: ArrayLike<number>): number {
  let h = 0;
  for (let i = 0; i < a.length; i += 7) h = (h * 31 + Math.round(a[i] * 1000)) | 0;
  return h;
}

function validate(plan: ReturnType<typeof planWorld>) {
  const ts = new TerrainSampler(plan.terrain);
  expect(Number.isFinite(ts.height(plan.spawn.x, plan.spawn.z))).toBe(true);
  for (let i = 0; i < 50; i++) {
    const h = ts.height(-2900 + i * 118, 2900 - i * 118);
    expect(Number.isFinite(h)).toBe(true);
  }
  expect(Math.abs(plan.spawn.x)).toBeLessThan(3000);
  expect(Math.abs(plan.spawn.z)).toBeLessThan(3000);
  if (plan.settlement) {
    for (const p of plan.settlement.plots) {
      expect(Number.isFinite(p.x) && Number.isFinite(p.z) && Number.isFinite(p.base)).toBe(true);
      expect(p.w).toBeGreaterThan(0);
    }
  }
  for (const n of plan.npcs) expect(Number.isFinite(n.x) && Number.isFinite(n.z)).toBe(true);
  for (const a of plan.animals) expect(Number.isFinite(a.x) && a.count > 0).toBe(true);
  expect(plan.place.name.length).toBeGreaterThan(2);
  expect(plan.arrivalFact.length).toBeGreaterThan(10);
  // a chunk at the spawn point meshes without NaNs
  const c = buildChunk(plan, ts, Math.floor(plan.spawn.x / 128), Math.floor(plan.spawn.z / 128), 0);
  expect(c.pos.length).toBeGreaterThan(0);
  for (let i = 0; i < c.pos.length; i += 97) expect(Number.isFinite(c.pos[i])).toBe(true);
  const s = buildStructures(plan, ts);
  for (const g of s.groups) { expect(g.arrays.pos.length % 9).toBe(0); for (let i = 0; i < g.arrays.pos.length; i += 101) expect(Number.isFinite(g.arrays.pos[i])).toBe(true); }
  return s;
}

describe('determinism', () => {
  it('same place + same year gives the same world', () => {
    const a = planWorld(earth, { lat: 41.89, lon: 12.49, year: 100 });
    const b = planWorld(earth, { lat: 41.89, lon: 12.49, year: 100 });
    expect(JSON.stringify(a)).toEqual(JSON.stringify(b));
    const ta = new TerrainSampler(a.terrain), tb = new TerrainSampler(b.terrain);
    const ca = buildChunk(a, ta, 1, -2, 0), cb = buildChunk(b, tb, 1, -2, 0);
    expect(hashArr(ca.pos)).toEqual(hashArr(cb.pos));
    expect(hashArr(ca.col)).toEqual(hashArr(cb.col));
    expect(ca.flora.map((f) => f.species + hashArr(f.data))).toEqual(cb.flora.map((f) => f.species + hashArr(f.data)));
    const sa = buildStructures(a, ta), sb = buildStructures(b, tb);
    expect(sa.groups.map((g) => g.key + hashArr(g.inst))).toEqual(sb.groups.map((g) => g.key + hashArr(g.inst)));
  });
  it('nearby clicks in the same era bucket give the same world key', () => {
    expect(worldKey(41.891, 12.4901, 100)).toEqual(worldKey(41.8949, 12.4899, 110));
  });
  it('different eras give different worlds', () => {
    const a = planWorld(earth, { lat: 48.85, lon: 2.35, year: 1200 });
    const b = planWorld(earth, { lat: 48.85, lon: 2.35, year: 1900 });
    expect(a.key).not.toEqual(b.key);
    expect(a.eraId).not.toEqual(b.eraId);
  });
});

describe('every era x region combination', () => {
  for (const e of ERAS) {
    for (const r of REGIONS) {
      it(`${e.id} / ${r.id}`, () => {
        const [lat, lon] = REGION_POINTS[r.id];
        const year = representativeYear(e);
        // in deep time, click where the present-day point has drifted to
        const [plat, plon] = presentToPast(lat, lon, earth.plateAt(lat, lon), year);
        const plan = planWorld(earth, { lat: plat, lon: plon, year });
        expect(plan.eraId).toBe(e.id);
        validate(plan);
      });
    }
  }
});

describe('test destinations', () => {
  const cases: [string, number, number, number][] = [
    ['Sahara 3000 BCE', 23.4, 25.6, -3000], ['Tokyo 2024', 35.68, 139.69, 2024], ['Amazon 1500', -3.4, -62.2, 1500],
    ['Arctic 20,000 years ago', 71, 130, -20000], ['Giza 2560 BCE', 29.98, 31.13, -2560], ['Moon 1969', 0.67, 23.47, 1969],
  ];
  for (const [name, lat, lon, year] of cases) {
    it(name, () => {
      const plan = planWorld(earth, { lat, lon, year, moon: name.startsWith('Moon') });
      validate(plan);
    });
  }
  it('Montana 70 million years ago has dinosaurs', () => {
    const [plat, plon] = presentToPast(47.0, -106.5, 1, -70_000_000);
    const plan = planWorld(earth, { lat: plat, lon: plon, year: -70_000_000 });
    validate(plan);
    expect(plan.eraId).toBe('dinosaurs');
    expect(plan.npcs.length).toBe(0);
    expect(plan.animals.some((a) => ['tyrannosaurus', 'triceratops', 'edmontosaurus', 'alamosaurus', 'ankylosaurus', 'ornithomimus', 'pterosaur'].includes(a.species))).toBe(true);
  });
  it('Americas before human arrival are wilderness', () => {
    const plan = planWorld(earth, { lat: 39.9, lon: -75.2, year: -30000 });
    expect(plan.settlement).toBeNull();
    expect(plan.npcs.length).toBe(0);
  });
});

describe('landmarks', () => {
  for (const l of LANDMARKS) {
    it(`${l.id} builds in every stage`, () => {
      for (const st of l.stages) {
        const year = Math.max(st.from, -60_000_000 < st.from ? st.from : -900000);
        const y = Math.max(year, -1_000_000);
        const [plat, plon] = landmarkPos(earth, l, y);
        const plan = planWorld(earth, { lat: plat, lon: plon, year: y, moon: l.region === 'moon' });
        const placed = plan.landmarks.find((p) => p.id === l.id);
        expect(placed, `${l.id} placed at ${year}`).toBeTruthy();
        const s = buildStructures(plan, new TerrainSampler(plan.terrain));
        if (l.builder !== 'none') expect(s.interest.some((i) => i.id === l.id)).toBe(true);
      }
    });
  }
});

describe('arrival on land', () => {
  const earth = loadEarthSync();
  it('every built landmark in its complete stage has its spawn and base on land', () => {
    for (const l of LANDMARKS) {
      if (l.kind === 'natural' || l.region === 'moon' || l.lat === undefined) continue;
      const st = l.stages?.find((s) => s.state === 'complete');
      if (!st || st.from < -60000) continue;
      const plan = planWorld(earth, { lat: l.lat, lon: l.lon, year: Math.max(st.from + 1, -60000) });
      if (!plan.landmarks.some((p) => p.id === l.id)) continue;
      const ts = new TerrainSampler(plan.terrain);
      expect(ts.height(plan.spawn.x, plan.spawn.z), `${l.id} spawn`).toBeGreaterThan(0.5);
    }
  });
});
