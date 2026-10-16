import { describe, it, expect } from 'vitest';
import { loadEarthSync } from './helpers';
import { planWorld } from '../src/gen/plan';

describe('quick', () => {
  it('plans a few worlds', () => {
    const earth = loadEarthSync();
    const places: [string, number, number, number][] = [
      ['Sahara -3000', 23, 10, -3000], ['Tokyo 2024', 35.68, 139.69, 2024], ['Amazon 1500', -3.4, -62.2, 1500],
      ['Arctic -20000', 72, -40, -20000], ['Montana -70M', 47, -109, -70000000], ['Giza -2560', 29.98, 31.13, -2560], ['Rome 100', 41.89, 12.49, 100],
    ];
    for (const [n, lat, lon, y] of places) {
      const t = performance.now();
      const p = planWorld(earth, { lat, lon, year: y });
      console.log(n, '|', p.place.name, '|', p.eraId, p.regionId, p.subzone, '|', p.biome, Math.round(p.climate.temp), Math.round(p.climate.rain), '| tier', p.settlement?.tier, p.settlement?.plots.length, 'npcs', p.npcs.length, 'animals', p.animals.map(a=>a.species+'x'+a.count).join(','), '| lm', p.landmarks.map(l=>l.id+':'+l.state).join(','), '| anomalies', p.anomalies.map(a=>a.anomalyId).join(','), '|', Math.round(performance.now()-t),'ms');
      expect(p.key).toBeTruthy();
    }
  });
});
