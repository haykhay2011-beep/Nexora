// Paints the time-dependent Earth texture for the globe (land, biomes, ice, deep-time continents, city lights).
import type { EarthData } from '../geo/earth';
import { pastToPresent, driftFactor, glacialFactor, seaLevelAt, iceCover, shelfExposed } from '../geo/paleo';
import { eraForYear } from '../core/timeScale';
import { CITIES } from '../data';
import { cityTier } from '../geo/places';
import { TIER_ORDER } from '../data/types';
import { hash2 } from '../core/rng';

const lerp3 = (a: number[], b: number[], t: number) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const C = {
  deep: [22, 52, 98], shelf: [40, 104, 150], ice: [236, 242, 248], tundra: [140, 146, 120], taiga: [62, 92, 60], forest: [78, 122, 58],
  grass: [138, 160, 80], desert: [218, 186, 122], savanna: [178, 166, 90], rain: [44, 104, 44], rock: [138, 132, 120], cret: [70, 120, 60],
};

export function paintGlobe(earth: EarthData, year: number, W: number, H: number): { day: HTMLCanvasElement; lights: HTMLCanvasElement } {
  const era = eraForYear(year);
  const drift = driftFactor(year);
  const glacial = glacialFactor(year);
  const sea = seaLevelAt(year, era.seaLevel);
  const day = document.createElement('canvas');
  day.width = W; day.height = H;
  const ctx = day.getContext('2d')!;
  const img = ctx.createImageData(W, H);
  const d = img.data;
  const EW = earth.W, EH = earth.H;
  const cell = (lat: number, lon: number) => {
    lon = ((((lon + 180) % 360) + 360) % 360) - 180;
    const x = Math.min(EW - 1, Math.max(0, Math.floor((lon + 180) / 0.25)));
    const y = Math.min(EH - 1, Math.max(0, Math.floor((90 - lat) / 0.25)));
    return y * EW + x;
  };
  const greenSahara = year > -11000 && year < -3500;
  for (let py = 0; py < H; py++) {
    const lat = 90 - ((py + 0.5) / H) * 180;
    for (let px = 0; px < W; px++) {
      const lon = -180 + ((px + 0.5) / W) * 360;
      let slat = lat, slon = lon, ok = true;
      if (drift > 0) {
        const src = pastToPresent(earth, lat, lon, year);
        if (src) { slat = src.lat; slon = src.lon; } else ok = false;
      }
      const i = cell(slat, slon);
      let land = ok ? earth.land[i] / 255 : 0;
      const elev = earth.elev[i] * 32;
      if (sea > 5) land *= Math.min(1, Math.max(0, (elev - sea + 60) / 160));
      else if (sea < -35 && land < 0.5 && earth.dist[i] < 10 && shelfExposed(slat, slon, sea)) land = 0.9;
      let col: number[];
      const o = (py * W + px) * 4;
      if (land < 0.5) {
        const near = earth.land[i] < 128 ? Math.min(1, earth.dist[i] / 6) : 0;
        col = lerp3(C.shelf, C.deep, ok ? near : 1);
        if (Math.abs(lat) > 72 - glacial * 10 && year > -34_000_000 && era.climateOffset < 4) col = lerp3(col, C.ice, 0.6);
      } else {
        const a = Math.abs(lat);
        let t = 27 - a * a * 0.0085 * (a > 30 ? 1.05 : 1) - elev * 0.0065 + era.climateOffset - glacial * 7 * (a > 35 ? 1.4 : 0.6);
        if (iceCover(slat, slon, year, elev) > 0.6) t = -20;
        const feat = earth.feat[i] & 15;
        const desertBelt = (a > 16 && a < 32) || feat === 2;
        if (era.floraKit === 'cretaceous') col = t > 0 ? C.cret : C.tundra;
        else if (t < -8) col = C.ice;
        else if (t < -1) col = C.tundra;
        else if (t < 5) col = C.taiga;
        else if (feat === 2 && !(greenSahara && slat > 12 && slat < 31 && slon > -18 && slon < 40)) col = C.desert;
        else if (desertBelt && feat !== 6 && earth.dist[i] > 6 && !(greenSahara && slon > -18 && slon < 40)) col = lerp3(C.desert, C.savanna, 0.35);
        else if (a < 10 && (feat === 6 || earth.dist[i] < 30)) col = C.rain;
        else if (a < 22) col = C.savanna;
        else if (t < 13) col = C.forest;
        else col = lerp3(C.grass, C.forest, 0.5);
        if (elev > 2600) col = lerp3(col, C.rock, Math.min(1, (elev - 2600) / 1800));
        if (elev > 4300 || (t < 0 && elev > 2000)) col = lerp3(col, C.ice, 0.7);
        const shadeF = 0.9 + Math.min(0.25, elev / 9000) + (hash2(px, py, 7) - 0.5) * 0.05;
        col = [col[0] * shadeF, col[1] * shadeF, col[2] * shadeF];
      }
      d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2]; d[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  // city lights
  const lights = document.createElement('canvas');
  lights.width = W; lights.height = H;
  const lc = lights.getContext('2d')!;
  lc.fillStyle = '#000';
  lc.fillRect(0, 0, W, H);
  const intensity = era.lights;
  if (intensity > 0.15 && drift === 0) {
    lc.globalCompositeOperation = 'lighter';
    for (const c of CITIES) {
      const tier = cityTier(c, year);
      const ti = TIER_ORDER.indexOf(tier);
      if (ti < 3) continue;
      const x = ((c.lon + 180) / 360) * W, y = ((90 - c.lat) / 180) * H;
      const r = (ti - 2) * (W / 1024) * 2.4 * (0.5 + intensity);
      const g = lc.createRadialGradient(x, y, 0, x, y, r * 2.2);
      g.addColorStop(0, `rgba(255,220,150,${0.9 * intensity})`);
      g.addColorStop(1, 'rgba(255,200,120,0)');
      lc.fillStyle = g;
      lc.fillRect(x - r * 2.2, y - r * 2.2, r * 4.4, r * 4.4);
    }
    if (intensity > 0.8) {
      // scattered towns across populated land in the modern era and later
      const id = lc.getImageData(0, 0, W, H);
      for (let py = 0; py < H; py++) {
        const lat = 90 - ((py + 0.5) / H) * 180;
        if (Math.abs(lat) > 62) continue;
        for (let px = 0; px < W; px++) {
          if (hash2(px, py, 99) > 0.035) continue;
          const lon = -180 + ((px + 0.5) / W) * 360;
          const i = cell(lat, lon);
          if (earth.land[i] < 160 || (earth.feat[i] & 15) === 2 || earth.elev[i] * 32 > 3000) continue;
          const o = (py * W + px) * 4;
          id.data[o] = Math.min(255, id.data[o] + 150); id.data[o + 1] = Math.min(255, id.data[o + 1] + 120); id.data[o + 2] = Math.min(255, id.data[o + 2] + 70);
        }
      }
      lc.putImageData(id, 0, 0);
    }
  }
  return { day, lights };
}
