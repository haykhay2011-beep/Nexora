// planWorld(): the deterministic heart of world generation.
// Same (rounded lat, rounded lon, era bucket) => same world.
import { Rng, hash32 } from '../core/rng';
import { clamp } from '../core/noise';
import { eraForYear, eraBucket, clampYear } from '../core/timeScale';
import { ANIMALS, ANOMALIES, CROP_BY_ID, FLORA, LANDMARKS, SPECIES_BY_ID, ERAS, ANIMAL_BY_ID } from '../data';
import type { EraProfile, SettlementTier, LandmarkDef } from '../data/types';
import { TIER_ORDER } from '../data/types';
import type { EarthData } from '../geo/earth';
import { FEATURE, CELL_M, CELL_DEG } from '../geo/earth';
import { paleoSample, pastToPresent, presentToPast, driftFactor, glacialFactor } from '../geo/paleo';
import { computeClimate, seasonalTemp, seasonName, type BiomeId } from '../geo/climate';
import { describePlace, distanceKm, nearestCity, type PlaceInfo } from '../geo/places';
import { regionAt, subzoneAt, resolveProfile, type WorldProfile } from './profiles';
import { TerrainSampler, AREA_HALF, hexToRgb, type TerrainParams, type TMod, type Line, type GroundStyle } from './terrain';
import { layoutSettlement, TIER_RADIUS } from './settlement';
import { populate } from './people';
import type { WorldPlan, PlacedLandmark, AnimalSpawn, AnomalySpawn, Plot, Settlement } from './planTypes';

export const PLAN_VERSION = 3;
const M_PER_DEG = 111320;

export interface PlanRequest { lat: number; lon: number; year: number; moon?: boolean }

export function worldKey(lat: number, lon: number, year: number, moon = false): string {
  const e = eraForYear(year);
  return `${moon ? 'moon:' : ''}${lat.toFixed(2)},${lon.toFixed(2)},${e.id},${eraBucket(year)}`;
}

function landmarkStage(l: LandmarkDef, year: number) {
  let st: LandmarkDef['stages'][number] | null = null;
  for (const s of l.stages) if (year >= s.from) st = s;
  return st;
}

/** Landmark the travel target should snap to (within ~20 km), if any. */
/** Where a landmark sits on the (possibly drifted) globe in a given year. */
export function landmarkPos(earth: EarthData | null, l: LandmarkDef, year: number): [number, number] {
  if (!earth || l.region === 'moon' || driftFactor(year) === 0) return [l.lat, l.lon];
  return presentToPast(l.lat, l.lon, earth.plateAt(l.lat, l.lon), year);
}

export function snapLandmark(lat: number, lon: number, year: number, moon: boolean, earth: EarthData | null = null): (LandmarkDef & { arrive?: number }) | null {
  let best: (LandmarkDef & { arrive?: number }) | null = null, bd = moon ? 400 : 20;
  for (const l of LANDMARKS) {
    if ((l.region === 'moon') !== moon) continue;
    if (!landmarkStage(l, year)) continue;
    if (driftFactor(year) > 0 && !earth) continue;
    const [llat, llon] = landmarkPos(earth, l, year);
    const d = distanceKm(lat, lon, llat, llon);
    if (d < bd) { bd = d; best = l; }
  }
  return best;
}

const HABITABILITY: Record<string, number> = {
  ocean: 0, beach: 0.9, desert: 0.22, scrubland: 0.5, savanna: 0.8, grassland: 1, mediterranean: 1.15, temperate_forest: 1,
  rainforest: 0.55, tropical_dry: 0.9, taiga: 0.4, tundra: 0.25, ice: 0, alpine: 0.3, wetland: 0.6, steppe: 0.65, moon: 0,
};

const KIT_FOR_ERA = (e: EraProfile) => e.floraKit;

export function planWorld(earth: EarthData, req: PlanRequest): WorldPlan {
  const year = clampYear(req.year);
  const era = eraForYear(year);
  const moon = !!req.moon;
  let lat = req.lat, lon = ((((req.lon + 180) % 360) + 360) % 360) - 180;
  const snapped = snapLandmark(lat, lon, year, moon, earth);
  if (snapped) [lat, lon] = landmarkPos(earth, snapped, year);
  lat = Math.round(lat * 100) / 100;
  lon = Math.round(lon * 100) / 100;
  const key = worldKey(lat, lon, year, moon);
  const seed = hash32(key);
  const rng = new Rng(seed);
  if (moon) return planMoon(lat, lon, year, era, key, seed, rng);

  const cosLat = Math.cos((lat * Math.PI) / 180);
  const toLatLon = (x: number, z: number): [number, number] => [lat - z / M_PER_DEG, lon + x / (M_PER_DEG * Math.max(0.05, cosLat))];

  // ---- geography
  const s0 = paleoSample(earth, lat, lon, year, era.seaLevel);
  const present = pastToPresent(earth, lat, lon, year) ?? { lat, lon, plate: 0 };
  const n = 9, step = 1000;
  const water: number[] = [];
  let iceSum = 0;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const [la, lo] = toLatLon((i - (n - 1) / 2) * step, (j - (n - 1) / 2) * step);
    const s = paleoSample(earth, la, lo, year, era.seaLevel);
    const lakeW = s.land > 0.5 ? clamp(s.lake * 1.05, 0, 1) : 0;
    water.push(clamp(1 - s.land + lakeW, 0, 1));
    iceSum += s.ice;
  }
  const centreWater = water[Math.floor(n * n / 2)];
  const iceAvg = iceSum / (n * n);
  const oceanSide = (dLon: number) => {
    let w = 0;
    for (const k of [2, 4, 6, 8]) w += 1 - earth.landAt(present.lat, present.lon + dLon * k / Math.max(0.2, cosLat));
    return w / 4;
  };
  const region = regionAt(present.lat, present.lon);
  const subzone = subzoneAt(region, present.lat, present.lon);
  const glacial = glacialFactor(year);
  const climate = computeClimate({
    lat, elev: s0.elev, coastKm: Math.max(0, s0.coastDist) * (CELL_M / 1000), feature: s0.feature,
    oceanEast: oceanSide(1), oceanWest: oceanSide(-1), regionId: region.id, year,
    climateOffset: era.climateOffset, glacial, ice: s0.ice, lake: s0.lake, land: 1 - centreWater,
  });
  let biome: BiomeId = climate.biome;
  const bmap = (subzone as { biomeMap?: Record<string, BiomeId> } | null)?.biomeMap;
  if (bmap && bmap[biome] && era.floraKit !== 'cretaceous') biome = bmap[biome];
  if (biome === 'ocean') biome = climate.temp > 18 ? 'beach' : climate.temp < -5 ? 'ice' : 'beach';
  const day = rng.int(0, 364);
  const seasonT = seasonalTemp(climate, lat, day);
  const snowCover = biome === 'ice' ? 1 : clamp((-seasonT + 0.5) / 4, 0, 1) * (climate.rain > 150 ? 1 : 0.3);

  // ---- terrain parameters
  const elev = Math.max(0, s0.elev);
  let relief = 12 + elev * 0.03, ridged = 0, dunes = 0, plateau = 0, rough = 1;
  if (s0.feature === FEATURE.range || elev > 1700) {
    ridged = clamp((elev - 600) / 2600, 0.35, 1);
    relief = clamp(70 + elev * 0.07, 90, 430);
  } else if (s0.feature === FEATURE.plateau) { relief = 22 + elev * 0.012; plateau = climate.rain < 500 ? 0.55 : 0.2; }
  else if ([FEATURE.plain, FEATURE.basin, FEATURE.wetland].includes(s0.feature as 7)) relief = 5 + elev * 0.005;
  else if (s0.feature === FEATURE.foothills) relief = 50 + elev * 0.03;
  if (biome === 'desert' && (s0.feature === FEATURE.desert || rng.chance(0.4))) { dunes = rng.range(4, 9); relief = Math.min(relief, 14); }
  if (biome === 'ice') { relief = 8; ridged = 0; dunes = 0; rough = 0.4; }
  if (biome === 'wetland') relief = Math.min(relief, 5);
  relief *= rng.range(0.8, 1.2);
  let baseInland = 4 + relief * 0.12;

  const mods: TMod[] = [];
  const placed: PlacedLandmark[] = [];
  const clearZones: { x: number; z: number; r: number }[] = [];
  // landmarks within the area (built + natural)
  for (const l of LANDMARKS) {
    if (l.region === 'moon') continue;
    const st = landmarkStage(l, year);
    if (!st) continue;
    const [llat, llon] = landmarkPos(earth, l, year);
    const dk = distanceKm(lat, lon, llat, llon);
    if (dk > 3.2) continue;
    const x = (llon - lon) * M_PER_DEG * cosLat, z = -(llat - lat) * M_PER_DEG;
    const clear = Number(l.params.clear ?? 80);
    placed.push({ id: l.id, name: l.name, x, z, rot: Number(l.params.rot ?? 0), state: st.state, note: st.note ?? null, base: 0, clear });
    if (clear > 0) clearZones.push({ x, z, r: clear });
    if (l.terrain) {
      const t = l.terrain;
      mods.push({ type: t.type, x, z, radius: t.radius, height: t.height, depth: t.depth, width: t.width, angle: t.angle, flat: (t as { flat?: number }).flat, crater: (t as { crater?: boolean }).crater });
      if (t.type === 'canyon') { baseInland = (t.depth ?? 600) + 30; relief = 18; ridged = 0; plateau = 0.4; dunes = 0; }
      if (t.type === 'falls') { relief = Math.min(relief, 10); }
      if (t.type === 'peak' && (t.height ?? 0) > 1000) { relief = Math.max(relief, 60); ridged = Math.max(ridged, 0.5); }
    }
  }

  // rivers from the baked grid (present-day coordinates; not in deep time)
  let river: Line | null = null;
  if (!driftFactor(year)) {
    let best: { d: number; line: Line } | null = null;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const clat = Math.floor((90 - present.lat) / CELL_DEG + dy) , clon = Math.floor((present.lon + 180) / CELL_DEG + dx);
      const cellLat = 90 - (clat + 0.5) * CELL_DEG, cellLon = -180 + (clon + 0.5) * CELL_DEG;
      const rs = earth.sample(cellLat, cellLon);
      if (rs.riverAngle < 0 || rs.riverSize === 0 || rs.land < 0.4) continue;
      const a = (rs.riverAngle * Math.PI) / 180;
      const ccx = (cellLon - present.lon) * M_PER_DEG * cosLat, ccz = -(cellLat - present.lat) * M_PER_DEG;
      const off = rs.riverOffset * CELL_M;
      const px = ccx + off * -Math.sin(a), pz = ccz - off * Math.cos(a);
      const ddx = Math.cos(a), ddz = -Math.sin(a);
      const perp = Math.abs(-px * ddz + pz * ddx);
      // the river must actually pass through this cell near the closest point, not just on its extension
      const tt = -(px * ddx + pz * ddz);
      const cpx = px + ddx * tt, cpz = pz + ddz * tt;
      if (Math.hypot(cpx - ccx, cpz - ccz) > CELL_M * 0.75) continue;
      const width = rs.riverSize === 3 ? 140 : rs.riverSize === 2 ? 55 : 22;
      if (perp < 3800 && (!best || perp < best.d)) best = { d: perp, line: { px, pz, dx: ddx, dz: ddz, width, valley: 260 + width * 3 } };
    }
    if (best && biome !== 'ice') river = best.line;
  }
  const streams: Line[] = [];
  if (!river && climate.rain > 550 && biome !== 'desert' && biome !== 'ice' && rng.chance(0.55) && centreWater < 0.3) {
    const a = rng.range(0, Math.PI);
    const off = rng.range(400, 1600) * (rng.chance(0.5) ? 1 : -1);
    streams.push({ px: -Math.sin(a) * off, pz: Math.cos(a) * off, dx: Math.cos(a), dz: Math.sin(a), width: rng.range(5, 10), valley: 70 });
  }
  if (biome === 'desert' && river) { dunes *= 0.4; }

  const terrain: TerrainParams = {
    seed, grid: { n, step, water }, baseInland, relief, ridged, dunes, duneAngle: rng.range(0, Math.PI), plateau, rough,
    river, streams, mods, iceSheet: biome === 'ice', moon: false, craters: [],
  };
  const hasWaterAt = (x: number, z: number) => new TerrainSampler(terrain).height(x, z) < 0;
  // ocean arrival: raise a small islet
  if (centreWater > 0.6 && hasWaterAt(0, 0) && !placed.length) {
    mods.push({ type: 'island', x: 0, z: 0, radius: rng.range(70, 140), height: rng.range(3, 7), flat: 0 });
  }

  // landmark base heights + flatten pads for built landmarks
  let ts = new TerrainSampler(terrain);
  for (const pl of placed) {
    const def = LANDMARKS.find((l) => l.id === pl.id)!;
    pl.base = ts.height(pl.x, pl.z);
    if (def.kind !== 'natural' && (!def.terrain || def.terrain.type === 'flatten' || def.terrain.type === 'pit') && pl.clear > 0) {
      // a coastal landmark the coarse raster puts at sea (e.g. Cape Canaveral) gets a landmass to stand on
      if (pl.base < 0.5) { mods.push({ type: 'island', x: pl.x, z: pl.z, radius: Math.max(350, pl.clear * 2.5), height: 4, flat: 1 }); ts = new TerrainSampler(terrain); }
      const existing = mods.find((m) => m.type === 'flatten' && m.x === pl.x && m.z === pl.z);
      const target = Math.max(1.2, pl.base);
      if (existing) existing.target = target;
      else mods.push({ type: 'flatten', x: pl.x, z: pl.z, radius: Math.max(40, pl.clear * 0.9), target });
      for (const m of mods) if (m.type === 'pit' && m.x === pl.x && m.z === pl.z) m.target = target;
      pl.base = target;
      ts = new TerrainSampler(terrain);
    } else if (def.terrain?.type === 'peak' || def.terrain?.type === 'island') {
      pl.base = ts.height(pl.x, pl.z);
    }
  }

  // ---- profile & settlement
  const profile = resolveProfile(era.id, region, subzone, biome);
  const humans = era.humans && year >= profile.humanArrival && biome !== 'ice';
  const hasCoast = (() => {
    for (let i = 0; i < n * n; i++) if (water[i] > 0.5) return true;
    return !!river && river.width > 40;
  })();
  let settlement: Settlement | null = null;
  const outlying: Plot[] = [];
  let tier: SettlementTier = 'none';
  let cityTier = false;
  if (humans) {
    const hab = HABITABILITY[biome] ?? 0.5;
    const waterBoost = (river ? 0.9 : 0) + (hasCoast ? 0.45 : 0) + (streams.length ? 0.2 : 0);
    let score = profile.settlementScale * (hab + (biome === 'desert' && river ? 0.8 : 0)) * (0.7 + waterBoost) * rng.range(0.55, 1.35);
    if (climate.greenSahara && biome !== 'desert') score *= 1.2;
    const city = nearestCity(present.lat, present.lon, year, 40);
    const scoreTier = (sc: number): SettlementTier => {
      if (era.tech <= 1) return sc > 0.18 ? 'camp' : 'none';
      if (sc < 0.12) return 'none';
      if (sc < 0.3) return era.tech <= 2 ? 'camp' : 'hamlet';
      if (sc < 0.7) return 'village';
      if (sc < 1.25) return 'town';
      return era.tech >= 8 ? 'town' : 'village';
    };
    tier = scoreTier(score);
    if (city) {
      const ci = TIER_ORDER.indexOf(city.tier);
      const reach = city.tier === 'metropolis' ? 16 : city.tier === 'city' ? 7 : city.tier === 'town' ? 4 : 2.5;
      const drop = city.km < reach ? 0 : city.km < reach * 2.2 ? 1 : city.km < reach * 4 ? 2 : 3;
      const ct = TIER_ORDER[Math.max(0, ci - drop)];
      if (TIER_ORDER.indexOf(ct) > TIER_ORDER.indexOf(tier)) { tier = ct; cityTier = true; }
    }
    const maxI = TIER_ORDER.indexOf(era.maxTier);
    if (TIER_ORDER.indexOf(tier) > maxI) tier = era.maxTier;
    if (placed.some((p) => ['machu_picchu', 'great_zimbabwe', 'pueblo_bonito', 'mesa_verde'].includes(p.id) && p.state === 'complete')) tier = TIER_ORDER.indexOf(tier) > 3 ? tier : 'hamlet';
  }
  // urban landmarks (flat ground) sit inside their city instead of pushing it away
  const hardTerrain = placed.some((p) => { const d = LANDMARKS.find((l) => l.id === p.id); return !!d?.terrain && d.terrain.type !== 'flatten' && d.terrain.type !== 'pit'; });
  const urbanCentre = cityTier && TIER_ORDER.indexOf(tier) >= TIER_ORDER.indexOf('town') && !hardTerrain;
  if (tier !== 'none') {
    const radius = TIER_RADIUS[tier];
    // settlement centre: nearest good land a little away from the arrival point
    let bestC: { x: number; z: number; score: number } | null = null;
    const want = Math.min(radius * 0.9 + 120, 1500);
    const maxClear = clearZones.reduce((m, c) => Math.max(m, Math.hypot(c.x, c.z) + c.r), 0);
    for (let i = 0; i < 140; i++) {
      const a = rng.range(0, Math.PI * 2), rr = urbanCentre ? rng.range(20, radius * 0.5 + 200) : rng.range(want * 0.5, Math.max(want * 1.4, maxClear + radius * 0.8));
      const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
      if (Math.abs(x) > AREA_HALF - radius * 0.7 - 100 || Math.abs(z) > AREA_HALF - radius * 0.7 - 100) continue;
      const h = ts.height(x, z);
      if (h < 1.2) continue;
      if (urbanCentre) { if (rr > radius * 0.5 + 200 || clearZones.some((c) => Math.hypot(c.x - x, c.z - z) < c.r + 10)) continue; }
      else if (clearZones.some((c) => Math.hypot(c.x - x, c.z - z) < c.r + radius * 0.6)) continue;
      // land fraction inside the radius
      let land = 0;
      for (let k = 0; k < 8; k++) {
        const aa = (k / 8) * Math.PI * 2;
        if (ts.height(x + Math.cos(aa) * radius * 0.7, z + Math.sin(aa) * radius * 0.7) > 0.8) land++;
      }
      const sl = ts.slope(x, z, 8);
      const nearWater = ts.riverDist(x, z) < radius * 1.5 || hasCoast ? 0.3 : 0;
      const score = urbanCentre ? land / 8 + sl * 0.3 - rr / radius * 0.4 : land / 8 + sl * 0.5 + nearWater - Math.max(0, rr - Math.max(want, maxClear + radius * 0.7)) / want * 0.3 - Math.abs(rr - want) / want * 0.05;
      if (land >= 5 && (!bestC || score > bestC.score)) bestC = { x, z, score };
    }
    if (bestC) {
      const base = Math.max(1.4, ts.height(bestC.x, bestC.z));
      mods.push({ type: 'flatten', x: bestC.x, z: bestC.z, radius: radius * 1.15 + 20, target: base });
      ts = new TerrainSampler(terrain);
      const prevStyles = previousEraStyles(era, profile, region.id, subzone?.name ?? null, biome);
      settlement = layoutSettlement({
        tier, cx: bestC.x, cz: bestC.z, profile, era, ts, seed, avoid: clearZones, baseHeight: base, hasCoast, previousStyles: prevStyles,
      });
      if (settlement.plots.length === 0) settlement = null;
    }
  }
  // isolated farmsteads in the countryside
  if (humans && era.tech >= 2 && era.tech <= 8 && TIER_ORDER.indexOf(tier) >= 2 && TIER_ORDER.indexOf(tier) <= 4) {
    const styleIds = profile.styles;
    for (let i = 0; i < 18 && outlying.length < 5; i++) {
      const x = rng.range(-AREA_HALF + 300, AREA_HALF - 300), z = rng.range(-AREA_HALF + 300, AREA_HALF - 300);
      if (settlement && Math.hypot(x - settlement.x, z - settlement.z) < settlement.radius * 2.6) continue;
      if (clearZones.some((c) => Math.hypot(c.x - x, c.z - z) < c.r + 40)) continue;
      const h = ts.height(x, z);
      if (h < 1.5 || ts.slope(x, z, 5) < 0.95 || ts.riverDist(x, z) < 25) continue;
      outlying.push({ id: 1000 + i, x, z, rot: rng.range(0, Math.PI), w: rng.range(5, 8), d: rng.range(6, 9), floors: 1, style: rng.pick(styleIds), role: 'farmhouse', seed: rng.int(0, 1e9), base: h });
    }
  }

  // ---- spawn point
  let spawn = { x: 0, z: 0, facing: 0 };
  const lmFocus = snapped ? placed.find((p) => p.id === snapped.id) : placed[0];
  const tryAround = (cx: number, cz: number, dist: number, prefer: number) => {
    for (let k = 0; k < 36; k++) {
      const a = prefer + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.35;
      for (const dm of [1, 0.75, 1.3, 0.5, 1.6]) {
        const x = cx + Math.cos(a) * dist * dm, z = cz + Math.sin(a) * dist * dm;
        if (Math.abs(x) > AREA_HALF - 150 || Math.abs(z) > AREA_HALF - 150) continue;
        if (ts.height(x, z) > 0.6 && ts.slope(x, z, 2) > 0.8 && !clearZones.some((c) => Math.hypot(c.x - x, c.z - z) < Math.min(c.r * 0.6, 60))) return { x, z, facing: Math.atan2(cx - x, cz - z) };
      }
    }
    return null;
  };
  let urbanSpawn: { x: number; z: number; facing: number } | null = null;
  if (lmFocus && settlement && urbanCentre) {
    // arrive on a street near the landmark
    const pts: { x: number; z: number; d: number }[] = [];
    for (const r of settlement.roads) for (let t = 0; t <= 1; t += 0.05) {
      const x = r.ax + (r.bx - r.ax) * t, z = r.az + (r.bz - r.az) * t;
      const d = Math.hypot(x - lmFocus.x, z - lmFocus.z);
      if (d > lmFocus.clear + 25 && d < Math.max(260, lmFocus.clear + 160)) pts.push({ x, z, d });
    }
    pts.sort((a, b) => a.d - b.d);
    for (const p of pts) if (ts.height(p.x, p.z) > 0.6 && !settlement.plots.some((q) => Math.hypot(q.x - p.x, q.z - p.z) < Math.max(q.w, q.d) * 0.6 + 1.5)) { urbanSpawn = { x: p.x, z: p.z, facing: Math.atan2(lmFocus.x - p.x, lmFocus.z - p.z) }; break; }
  }
  if (urbanSpawn) spawn = urbanSpawn;
  else if (lmFocus) {
    const def = LANDMARKS.find((l) => l.id === lmFocus.id)!;
    spawn = tryAround(lmFocus.x, lmFocus.z, def.arrive ?? 250, Math.PI / 2) ?? tryAround(lmFocus.x, lmFocus.z, lmFocus.clear + 40, Math.PI / 2) ?? spawn;
  } else if (settlement) {
    spawn = tryAround(settlement.x, settlement.z, settlement.radius * 0.95 + 25, Math.atan2(-settlement.z, -settlement.x)) ?? spawn;
  } else {
    if (ts.height(0, 0) <= 0.6) {
      const s = tryAround(0, 0, 60, 0) ?? tryAround(0, 0, 400, 0);
      if (s) spawn = { ...s, facing: s.facing + Math.PI };
    }
  }

  // ---- flora
  const kit = KIT_FOR_ERA(era);
  const kitTable = FLORA.kits[kit] ?? FLORA.kits.holocene;
  let floraList = (kitTable[biome] ?? kitTable['*'] ?? []).slice() as [string, number][];
  floraList = floraList.filter(([id]) => {
    const sp = SPECIES_BY_ID.get(id);
    if (!sp) return false;
    if (sp.regions && kit !== 'cretaceous' && !sp.regions.includes(region.id)) return false;
    return true;
  });
  for (const pid of profile.plants) {
    const sp = SPECIES_BY_ID.get(pid);
    if (!sp || !sp.kits.includes(kit)) continue;
    if (sp.biomes !== '*' && !sp.biomes.includes(biome)) continue;
    if (!floraList.some(([id]) => id === pid)) floraList.push([pid, 0.7]);
  }
  if (!floraList.length) floraList = [['rock', 1]];
  const bdef = FLORA.biomes[biome] ?? FLORA.biomes.grassland;
  let floraDensity = bdef.density * (climate.greenSahara ? 1.6 : 1);
  if (kit === 'cretaceous') floraDensity = Math.max(0.5, floraDensity * 1.3);

  // ---- ground style
  const pal = era.palette;
  const ground = groundStyle(biome, bdef.ground, bdef.grass, climate, snowCover, seasonT, glacial, placed, era, day, lat);

  // ---- people
  const npcs = settlement ? populate(seed, settlement, profile, region) : [];

  // ---- animals
  const animals = planAnimals(rng.fork('animals'), era, region.id, biome, present.plate || s0.plate, profile, settlement, ts, clearZones, hasCoast, subzone?.name ?? null);

  // ---- anomalies
  const anomalies = planAnomalies(rng.fork('anomalies'), key, era, region.id, ts, spawn, lat, lon, !!humans, settlement, animals);

  // ---- place & facts
  const place: PlaceInfo = snapped
    ? { ...describePlace(earth, present.lat, present.lon, year, 1 - centreWater, subzone?.name), short: snapped.name }
    : describePlace(earth, present.lat, present.lon, year, 1 - centreWater, subzone?.name);
  if (snapped) place.name = `${snapped.name} — ${place.name.replace(/^near present-day /, '')}`;
  const facts: string[] = [];
  for (const p of placed) {
    const def = LANDMARKS.find((l) => l.id === p.id)!;
    facts.push(def.fact, ...(def.facts ?? []));
  }
  facts.push(...profile.facts, ...region.defaults.facts ?? []);
  if (climate.greenSahara) facts.unshift('About 9,000 to 5,000 years ago, monsoon rains turned much of the Sahara green, with lakes, grasslands and animals such as hippos and giraffes.');
  if (glacial > 0.6 && era.id !== 'dinosaurs') facts.push('During the coldest part of the last ice age, about 20,000 years ago, sea level was roughly 120 m lower than today.');
  for (const inv of era.inventions) facts.push(inv.fact);
  facts.push(era.description);
  const arrivalFact = facts[0] ?? era.description;

  const weather = {
    rainChance: clamp(climate.rain / 2200, 0.02, 0.6),
    snow: seasonT < 1,
    sandstorm: biome === 'desert' && climate.rain < 200,
    fog: clamp((climate.rain > 900 ? 0.25 : 0.05) + (hasCoast && climate.temp < 16 ? 0.25 : 0) + (biome === 'rainforest' ? 0.2 : 0), 0, 0.6),
    monsoon: climate.monsoon && ((lat >= 0 && day > 150 && day < 270) || (lat < 0 && (day < 80 || day > 330))),
    storminess: rng.range(0, 1),
  };

  return {
    version: PLAN_VERSION, key, seed, lat, lon, presentLat: present.lat, presentLon: present.lon, year, eraId: era.id,
    regionId: region.id, subzone: subzone?.name ?? null, moon: false, place, biome, biomeName: bdef.name,
    climate: {
      temp: climate.temp, summer: climate.summer, winter: climate.winter, rain: climate.rain, monsoon: climate.monsoon,
      greenSahara: climate.greenSahara, dayOfYear: day, season: seasonName(lat, day), seasonTemp: seasonT, snowCover, seaLevel: s0.seaLevel, ice: iceAvg,
    },
    terrain, ground, floraKit: kit, flora: floraList, floraDensity,
    settlement, outlying, landmarks: placed, npcs, animals, anomalies, spawn, palette: pal,
    humans: !!humans, currency: profile.currency, goods: profile.goods, crops: profile.crops.filter((c) => CROP_BY_ID.has(c)),
    boats: profile.boats, mounts: profile.mounts, domestic: profile.domestic,
    facts: [...new Set(facts)], arrivalFact, weather, peopleTypes: profile.people.map((p) => ({ id: p.id, name: p.name, fact: p.fact })),
    hasCoast,
  };
}

function groundStyle(biome: BiomeId, groundHex: string, grassHex: string, climate: ReturnType<typeof computeClimate>, snowCover: number, seasonT: number, glacial: number,
  placed: PlacedLandmark[], era: EraProfile, day: number, lat: number): GroundStyle {
  const ground = hexToRgb(groundHex);
  const grass = hexToRgb(grassHex);
  // dry season browns grass a little; Cretaceous ground is fern-green
  if (era.floraKit === 'cretaceous') { grass[0] *= 0.85; grass[1] *= 1.05; }
  if (seasonT > 24 && climate.rain < 900) { grass[0] = grass[0] * 0.8 + 0.15; grass[1] = grass[1] * 0.85 + 0.08; }
  const autumnPeak = lat >= 0 ? 290 : 105;
  const autumn = biome === 'temperate_forest' || biome === 'taiga' ? Math.max(0, 1 - Math.abs(day - autumnPeak) / 30) : 0;
  const strata = placed.some((p) => p.id === 'grand_canyon');
  const uluru = placed.some((p) => p.id === 'uluru');
  return {
    ground, grass,
    rock: uluru ? [0.72, 0.36, 0.22] : biome === 'desert' ? [0.72, 0.56, 0.4] : [0.52, 0.5, 0.47],
    sand: biome === 'ice' ? [0.9, 0.93, 0.96] : uluru ? [0.78, 0.45, 0.28] : [0.88, 0.8, 0.6],
    snow: [0.94, 0.96, 0.99],
    seabed: [0.62, 0.6, 0.48],
    dirt: [0.5, 0.4, 0.28],
    snowCover,
    snowLine: biome === 'ice' ? -100 : Math.max(60, climate.snowLine * (1 - glacial * 0.3)),
    strata,
    mud: biome === 'wetland' || biome === 'rainforest' ? 0.5 : 0,
    grassVariation: 1,
    autumn,
  };
}

function previousEraStyles(era: EraProfile, profile: WorldProfile, regionId: string, zone: string | null, biome: string): string[] | null {
  const idx = ERAS.findIndex((e) => e.id === era.id);
  if (idx <= 3 || era.tech < 4) return null;
  const prev = ERAS[idx - 1 - (idx > 5 ? 1 : 0)];
  if (!prev.humans) return null;
  const rp = resolveProfile(prev.id, profile.region, profile.subzone, biome);
  if (prev.start < rp.humanArrival) return null;
  void regionId; void zone;
  return rp.styles;
}

function planAnimals(rng: Rng, era: EraProfile, regionId: string, biome: BiomeId, plate: number, profile: WorldProfile, s: Settlement | null,
  ts: TerrainSampler, clear: { x: number; z: number; r: number }[], hasCoast: boolean, zone: string | null): AnimalSpawn[] {
  const out: AnimalSpawn[] = [];
  const deep = era.id === 'dinosaurs' || era.id === 'mammals';
  const wild = ANIMALS.filter((a) => {
    if (a.domestic) return false;
    if (!a.eras.includes(era.id)) return false;
    if (deep && a.plates && !a.plates.includes(plate)) return false;
    if (zone && (a as { excludeZones?: string[] }).excludeZones?.includes(zone)) return false;
    if (!deep || !a.plates) if (a.regions !== '*' && !a.regions.includes(regionId)) return false;
    if (a.biomes !== '*' && !a.biomes.includes(biome) && !(a.behaviour === 'swimmer' && hasCoast)) return false;
    if (biome === 'ice' && (a.biomes === '*' || !a.biomes.includes('ice')) && a.behaviour !== 'swimmer') return false;
    if (a.behaviour === 'swimmer' && !hasCoast) return false;
    return true;
  });
  const findSpot = (water: boolean, minD: number): [number, number] | null => {
    for (let i = 0; i < 40; i++) {
      const x = rng.range(-AREA_HALF + 200, AREA_HALF - 200), z = rng.range(-AREA_HALF + 200, AREA_HALF - 200);
      const h = ts.height(x, z);
      if (water ? h > -3 : h < 1) continue;
      if (s && Math.hypot(x - s.x, z - s.z) < s.radius + minD) continue;
      if (clear.some((c) => Math.hypot(c.x - x, c.z - z) < c.r)) continue;
      if (Math.hypot(x, z) < 120) continue;
      return [x, z];
    }
    return null;
  };
  const tierI = s ? ['none', 'camp', 'hamlet', 'village', 'town', 'city', 'metropolis'].indexOf(s.tier) : 0;
  const groups = deep ? rng.int(5, 8) : Math.max(1, rng.int(3, 6) - Math.max(0, tierI - 3) * 2);
  const cityLimit = tierI >= 5;
  const nonFlyers = wild.filter((a) => a.behaviour !== 'flyer' && a.behaviour !== 'swimmer' && (!cityLimit || (a.scale <= 1 && a.behaviour !== 'predator')));
  const flyers = wild.filter((a) => a.behaviour === 'flyer');
  const swimmers = wild.filter((a) => a.behaviour === 'swimmer');
  const pickWeighted = (list: typeof wild) => rng.weighted(list.map((a) => [a, a.behaviour === 'predator' ? 0.35 : a.scale > 6 ? 0.8 : 1] as const));
  let predators = 0;
  for (let g = 0; g < groups && nonFlyers.length; g++) {
    const a = pickWeighted(nonFlyers);
    if (a.behaviour === 'predator') { if (predators >= (deep ? 2 : 1)) continue; predators++; }
    const spot = findSpot(false, a.behaviour === 'predator' ? 500 : 150);
    if (!spot) continue;
    out.push({ species: a.id, x: spot[0], z: spot[1], count: rng.int(a.group[0], a.group[1]), radius: 20 + a.scale * 6, domestic: false, seed: rng.int(0, 1e9) });
  }
  for (let g = 0; g < Math.min(2, flyers.length); g++) {
    const a = rng.pick(flyers);
    const spot = findSpot(false, 0) ?? [rng.range(-800, 800), rng.range(-800, 800)];
    out.push({ species: a.id, x: spot[0], z: spot[1], count: rng.int(a.group[0], a.group[1]), radius: 60, domestic: false, seed: rng.int(0, 1e9) });
  }
  for (let g = 0; g < Math.min(2, swimmers.length); g++) {
    const a = rng.pick(swimmers);
    const spot = findSpot(true, 0);
    if (spot) out.push({ species: a.id, x: spot[0], z: spot[1], count: rng.int(a.group[0], a.group[1]), radius: 40, domestic: false, seed: rng.int(0, 1e9) });
  }
  // domestic animals near people
  if (s && profile.domestic.length) {
    const dom = profile.domestic.map((id) => ANIMAL_BY_ID.get(id)).filter((a): a is NonNullable<typeof a> => !!a && a.eras.includes(era.id));
    for (const a of dom) {
      if (!rng.chance(a.id === 'dog' || a.id === 'chicken' || a.id === 'cat' ? 0.9 : 0.75)) continue;
      let x = s.x, z = s.z;
      if (['cattle', 'sheep', 'goat', 'horse', 'llama', 'alpaca', 'yak', 'water_buffalo', 'camel', 'bactrian_camel', 'donkey', 'reindeer_herd'].includes(a.id)) {
        const f = s.farms.length ? rng.pick(s.farms) : null;
        if (!f && tierI >= 5) continue;
        if (f) { x = f.x + rng.range(-40, 40); z = f.z + rng.range(-40, 40); } else { const ang = rng.range(0, 6.28); x += Math.cos(ang) * s.radius * 1.4; z += Math.sin(ang) * s.radius * 1.4; }
      } else { x += rng.range(-s.radius, s.radius) * 0.6; z += rng.range(-s.radius, s.radius) * 0.6; }
      if (ts.height(x, z) < 0.8) continue;
      const cnt = a.id === 'dog' || a.id === 'cat' ? rng.int(1, 3) : rng.int(a.group[0], Math.min(a.group[1], 8));
      out.push({ species: a.id, x, z, count: cnt, radius: a.scale * 8 + 10, domestic: true, seed: rng.int(0, 1e9) });
    }
  }
  return out;
}

function planAnomalies(rng: Rng, key: string, era: EraProfile, regionId: string, ts: TerrainSampler, spawn: { x: number; z: number },
  lat: number, lon: number, humans: boolean, s: Settlement | null, animals: AnimalSpawn[]): AnomalySpawn[] {
  const out: AnomalySpawn[] = [];
  const pool = ANOMALIES.filter((a) => !a.story && a.homeEra !== era.id);
  const featured = ANOMALIES.filter((a) => a.featured?.some((f) => f.era === era.id && distanceKm(lat, lon, f.lat, f.lon) < f.radiusKm));
  const count = featured.length + 1 + (rng.chance(0.55) ? 1 : 0) + (rng.chance(0.2) ? 1 : 0);
  const chosen = [...featured];
  while (chosen.length < count && pool.length) {
    const a = rng.pick(pool);
    if (!chosen.includes(a)) chosen.push(a);
    else if (chosen.length >= pool.length) break;
  }
  chosen.forEach((a, i) => {
    let pos: [number, number] | null = null;
    for (let k = 0; k < 50 && !pos; k++) {
      const ang = rng.range(0, Math.PI * 2), r = rng.range(180, 1300);
      const x = spawn.x + Math.cos(ang) * r, z = spawn.z + Math.sin(ang) * r;
      if (Math.abs(x) > AREA_HALF - 200 || Math.abs(z) > AREA_HALF - 200) continue;
      if (ts.height(x, z) < 1 || ts.slope(x, z, 2) < 0.85) continue;
      if (s && s.plots.some((p) => Math.hypot(p.x - x, p.z - z) < Math.max(p.w, p.d))) continue;
      pos = [x, z];
    }
    if (!pos) return;
    const sp: AnomalySpawn = { instanceId: `${key}#${i}:${a.id}`, anomalyId: a.id, x: pos[0], z: pos[1], challenge: a.challenge, seed: rng.int(0, 1e9) };
    if (a.challenge === 'sneak') {
      const wa = rng.range(0, Math.PI * 2);
      const wild = animals.filter((x) => !x.domestic && ANIMAL_BY_ID.get(x.species)?.behaviour !== 'predator' && ANIMAL_BY_ID.get(x.species)?.behaviour !== 'flyer' && ANIMAL_BY_ID.get(x.species)?.behaviour !== 'swimmer');
      sp.watcher = humans ? { x: pos[0] + Math.cos(wa) * 9, z: pos[1] + Math.sin(wa) * 9, kind: 'npc' }
        : { x: pos[0] + Math.cos(wa) * 10, z: pos[1] + Math.sin(wa) * 10, kind: 'animal', species: wild.length ? rng.pick(wild).species : undefined };
    }
    out.push(sp);
  });
  void regionId;
  return out;
}

function planMoon(lat: number, lon: number, year: number, era: EraProfile, key: string, seed: number, rng: Rng): WorldPlan {
  const craters: { x: number; z: number; r: number; d: number }[] = [];
  for (let i = 0; i < 70; i++) {
    const r = Math.pow(rng.next(), 2.5) * 260 + 8;
    craters.push({ x: rng.range(-AREA_HALF, AREA_HALF), z: rng.range(-AREA_HALF, AREA_HALF), r, d: r * rng.range(0.12, 0.25) });
  }
  const placed: PlacedLandmark[] = [];
  const mods: TMod[] = [];
  for (const l of LANDMARKS) {
    if (l.region !== 'moon') continue;
    const st = landmarkStage(l, year);
    if (!st) continue;
    placed.push({ id: l.id, name: l.name, x: 0, z: 0, rot: 0, state: st.state, note: st.note ?? null, base: 10, clear: 30 });
    mods.push({ type: 'flatten', x: 0, z: 0, radius: 60, target: 10 });
  }
  for (const c of craters) if (Math.hypot(c.x, c.z) < c.r * 1.6 + 70) c.d = 0;
  const terrain: TerrainParams = {
    seed, grid: { n: 2, step: 1, water: [0, 0, 0, 0] }, baseInland: 10, relief: 0, ridged: 0, dunes: 0, duneAngle: 0, plateau: 0, rough: 1,
    river: null, streams: [], mods, iceSheet: false, moon: true, craters,
  };
  const ts = new TerrainSampler(terrain);
  let settlement: Settlement | null = null;
  if (year >= 2100) {
    const profile = resolveProfile(era.id, regionAt(0, 0), null, 'moon');
    profile.styles = ['eco_dome'];
    profile.crops = [];
    profile.walls = false;
    mods.push({ type: 'flatten', x: 380, z: -200, radius: 200, target: ts.height(380, -200) });
    const ts2 = new TerrainSampler(terrain);
    settlement = layoutSettlement({ tier: 'village', cx: 380, cz: -200, profile, era, ts: ts2, seed, avoid: [], baseHeight: ts2.height(380, -200), hasCoast: false, previousStyles: null });
  }
  const anomalies: AnomalySpawn[] = [];
  const spawnPoint = { x: 0, z: placed.length ? 90 : 0, facing: Math.PI };
  const facts = [
    'The Moon has no air, so there is no weather and no sound, and the sky is black even in daytime.',
    'Gravity on the Moon is about one-sixth of Earth\'s, so you can jump about six times higher.',
    'The same side of the Moon always faces Earth.',
  ];
  if (placed.length) facts.unshift(LANDMARKS.find((l) => l.id === placed[0].id)!.fact);
  const grey: [number, number, number] = [0.55, 0.55, 0.55];
  return {
    version: PLAN_VERSION, key, seed, lat, lon, presentLat: lat, presentLon: lon, year, eraId: era.id, regionId: 'moon', subzone: null, moon: true,
    place: { name: placed.length ? 'Sea of Tranquility, the Moon' : 'Sea of Tranquility, the Moon', short: 'The Moon', country: null, region: null, city: null, ocean: false },
    biome: 'moon', biomeName: 'Lunar surface',
    climate: { temp: -20, summer: 120, winter: -170, rain: 0, monsoon: false, greenSahara: false, dayOfYear: 0, season: 'lunar day', seasonTemp: 0, snowCover: 0, seaLevel: 0, ice: 0 },
    terrain, ground: { ground: grey, grass: [0.6, 0.6, 0.6], rock: [0.42, 0.42, 0.42], sand: grey, snow: grey, seabed: grey, dirt: grey, snowCover: 0, snowLine: 99999, strata: false, mud: 0, grassVariation: 0.4, autumn: 0 },
    floraKit: 'none', flora: [['boulder', 1], ['rock', 2]], floraDensity: 0.05,
    settlement, outlying: [], landmarks: placed, npcs: settlement ? populate(seed, settlement, resolveProfile(era.id, regionAt(0, 0), null, 'moon'), regionAt(0, 0)) : [],
    animals: [], anomalies, spawn: spawnPoint,
    palette: { tint: '#ffffff', saturation: 0.9, contrast: 1.1, fog: '#000000', skyTop: '#000000', skyHorizon: '#05060a', sun: '#ffffff', ambient: '#3a3a44', ground: '#777777' },
    humans: !!settlement, currency: era.currency, goods: era.goods, crops: [], boats: [], mounts: ['glider'], domestic: [],
    facts, arrivalFact: facts[0], weather: { rainChance: 0, snow: false, sandstorm: false, fog: 0, monsoon: false, storminess: 0 },
    peopleTypes: [], hasCoast: false,
  };
}
