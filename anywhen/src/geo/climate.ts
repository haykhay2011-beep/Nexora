// Climate (temperature, rainfall, seasons) and biome classification.
import { FEATURE } from './earth';
import { clamp, lerp } from '../core/noise';

export type BiomeId =
  | 'ocean' | 'beach' | 'desert' | 'scrubland' | 'savanna' | 'grassland' | 'mediterranean' | 'temperate_forest'
  | 'rainforest' | 'tropical_dry' | 'taiga' | 'tundra' | 'ice' | 'alpine' | 'wetland' | 'steppe' | 'moon';

export interface ClimateInput {
  lat: number; // paleo latitude
  elev: number; // metres above sea level
  coastKm: number; // distance to coast (km, >= 0)
  feature: number;
  oceanEast: number; // 0..1 how much sea lies to the east
  oceanWest: number;
  regionId: string;
  year: number;
  climateOffset: number;
  glacial: number;
  ice: number;
  lake: number;
  land: number;
}

export interface Climate {
  temp: number; // annual mean °C at this elevation
  summer: number;
  winter: number;
  rain: number; // mm / year
  monsoon: boolean;
  biome: BiomeId;
  greenSahara: boolean;
  snowLine: number; // metres above local base where permanent snow starts
}

const TEMP_TABLE: [number, number][] = [[0, 27], [15, 26], [25, 23], [35, 17.5], [45, 12], [55, 5.5], [65, -2], [75, -12], [90, -22]];

function tempForLat(lat: number): number {
  const a = Math.abs(lat);
  for (let i = 0; i < TEMP_TABLE.length - 1; i++) {
    const [l0, t0] = TEMP_TABLE[i], [l1, t1] = TEMP_TABLE[i + 1];
    if (a <= l1) return lerp(t0, t1, (a - l0) / (l1 - l0));
  }
  return -22;
}

export function computeClimate(c: ClimateInput): Climate {
  const a = Math.abs(c.lat);
  const continentality = clamp(c.coastKm / 900, 0, 1);
  const polarAmp = 1 + clamp((a - 30) / 40, 0, 1) * 0.8;

  let temp = tempForLat(c.lat);
  temp -= Math.max(0, c.elev) * 0.0065;
  if (a > 35) temp -= 2.5 * continentality;
  if (a > 30 && a < 65 && c.coastKm < 150) temp += 1.5; // maritime
  temp += c.climateOffset * (c.climateOffset > 0 ? polarAmp * 0.8 : polarAmp);
  temp -= 6 * c.glacial * polarAmp * (c.climateOffset < 0 ? 0.3 : 1);
  if (c.ice > 0.6) temp = Math.min(temp, -12);

  const amp = (2 + a * 0.32 * (0.35 + 0.65 * continentality)) * (a < 12 ? 0.5 : 1);
  const summer = temp + amp / 2;
  const winter = temp - amp / 2;

  // ---- rainfall from latitude belts, coast position and features
  let rain: number;
  const eastCoast = c.oceanEast > 0.5 && c.oceanEast > c.oceanWest;
  const westCoast = c.oceanWest > 0.5 && c.oceanWest > c.oceanEast;
  if (a < 10) rain = 2100;
  else if (a < 18) rain = lerp(2000, 1000, (a - 10) / 8);
  else if (a < 34) {
    // subtropical highs: dry west coasts and interiors, wetter east coasts
    rain = eastCoast ? 1250 : westCoast ? 180 : 320;
  } else if (a < 60) rain = westCoast ? 1100 : eastCoast ? 950 : 600;
  else rain = 380;
  // interiors dry out
  rain *= lerp(1, a < 15 ? 0.85 : 0.45, continentality);

  let monsoon = false;
  if ((['southasia', 'seasia'].includes(c.regionId) && a < 30) || (c.regionId === 'eastasia' && c.lat > 18 && c.lat < 36) || (c.regionId === 'subsaharan' && c.lat > 4 && c.lat < 16)) {
    monsoon = true;
    rain = Math.max(rain, c.regionId === 'subsaharan' ? 700 : 1500);
  }
  if (c.regionId === 'northamerica' && c.lat > 25 && c.lat < 40 && !westCoast) rain = Math.max(rain, 900);
  if (c.regionId === 'southamerica' && c.lat < -15 && c.lat > -35 && !westCoast) rain = Math.max(rain, 1000);
  if (c.regionId === 'oceania' && c.lat < -26 && c.lat > -40 && eastCoast) rain = Math.max(rain, 1000);

  switch (c.feature) {
    case FEATURE.desert: rain = Math.min(rain, 140); break;
    case FEATURE.basin: rain = Math.max(rain, a < 12 ? 2300 : rain); break;
    case FEATURE.wetland: rain = Math.max(rain, 1100); break;
    case FEATURE.range: rain *= 1.25; break;
    case FEATURE.tundra: rain = Math.min(rain, 450); break;
  }

  // the "Green Sahara" (African Humid Period)
  let greenSahara = false;
  if (c.year > -11000 && c.year < -3500 && (c.regionId === 'mena' || c.regionId === 'subsaharan') && c.lat > 12 && c.lat < 31) {
    rain = Math.max(rain * 3, 450);
    greenSahara = true;
  }
  rain *= 1 - 0.3 * c.glacial;
  if (c.climateOffset > 3) rain *= 1.25;

  // ---- biome
  let biome: BiomeId;
  if (c.land < 0.5) biome = 'ocean';
  else if (c.ice > 0.6) biome = 'ice';
  else if (temp < -12) biome = 'ice';
  else if (temp < -4) biome = 'tundra';
  else if (c.elev > 2700 && temp < 4) biome = 'alpine';
  else if (temp < 3) biome = rain > 300 ? 'taiga' : 'tundra';
  else if (temp < 12) {
    if (rain > 520) biome = a > 48 && temp < 6 ? 'taiga' : 'temperate_forest';
    else if (rain > 280) biome = continentality > 0.4 ? 'steppe' : 'grassland';
    else biome = 'desert';
  } else if (temp < 20) {
    const med = a > 28 && a < 45 && westCoast && rain < 950 && rain > 250;
    if (med) biome = 'mediterranean';
    else if (rain > 900) biome = 'temperate_forest';
    else if (rain > 480) biome = 'grassland';
    else if (rain > 250) biome = continentality > 0.45 ? 'steppe' : 'scrubland';
    else biome = 'desert';
  } else {
    if (rain > 1700) biome = 'rainforest';
    else if (rain > 1050) biome = 'tropical_dry';
    else if (rain > 500) biome = 'savanna';
    else if (rain > 250) biome = 'scrubland';
    else biome = 'desert';
  }
  if (c.feature === FEATURE.wetland && biome !== 'ice' && biome !== 'ocean') biome = 'wetland';

  const snowLine = Math.max(0, (temp + 3) / 0.0065);
  return { temp, summer, winter, rain, monsoon, biome, greenSahara, snowLine };
}

/** Temperature on a given day of year (0..365), for snow cover and weather. */
export function seasonalTemp(cl: Climate, lat: number, day: number): number {
  // peak summer ~ day 200 in the north, ~ day 15 in the south
  const peak = lat >= 0 ? 200 : 17;
  const ph = Math.cos(((day - peak) / 365) * Math.PI * 2);
  return (cl.summer + cl.winter) / 2 + ((cl.summer - cl.winter) / 2) * ph;
}

export function seasonName(lat: number, day: number): string {
  const north = lat >= 0;
  const d = (day + 365) % 365;
  let s: number;
  if (d < 79 || d >= 355) s = 0; else if (d < 172) s = 1; else if (d < 266) s = 2; else s = 3;
  const names = north ? ['winter', 'spring', 'summer', 'autumn'] : ['summer', 'autumn', 'winter', 'spring'];
  if (Math.abs(lat) < 15) return d > 150 && d < 290 ? (lat >= 0 ? 'wet season' : 'dry season') : (lat >= 0 ? 'dry season' : 'wet season');
  return names[s];
}
