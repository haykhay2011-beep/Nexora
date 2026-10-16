#!/usr/bin/env node
// Bakes the bundled Earth grid used by Anywhen from public-domain Natural Earth data.
//
//   node tools/bake-earth.mjs            (downloads sources into tools/.cache if missing)
//
// Output:
//   public/data/earth.dat   gzip-compressed binary grid (see src/geo/earthFormat.ts)
//   src/data/geonames.json  name tables referenced by the grid
//
// Natural Earth (https://www.naturalearthdata.com) is in the public domain.
// Elevation is *estimated* from mountain-range / plateau polygons with a
// small table of typical crest heights below — it is a stylised game model,
// not a survey-grade elevation dataset.

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = path.join(ROOT, 'tools', '.cache');
const NE_BASE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/';
const SOURCES = [
  'ne_50m_land',
  'ne_50m_lakes',
  'ne_50m_admin_0_countries',
  'ne_50m_admin_1_states_provinces',
  'ne_50m_geography_regions_polys',
  'ne_10m_geography_marine_polys',
  'ne_50m_rivers_lake_centerlines',
];

const W = 1440; // 0.25 degree main grid
const H = 720;
const NW = 720; // 0.5 degree name grid
const NH = 360;
const SS = 4; // supersampling for coverage

async function ensureSources() {
  fs.mkdirSync(CACHE, { recursive: true });
  for (const s of SOURCES) {
    const file = path.join(CACHE, s + '.geojson');
    if (fs.existsSync(file)) continue;
    console.log('downloading', s);
    const res = await fetch(NE_BASE + s + '.geojson');
    if (!res.ok) throw new Error('download failed ' + s + ' ' + res.status);
    fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  }
}

const load = (s) => JSON.parse(fs.readFileSync(path.join(CACHE, s + '.geojson'), 'utf8'));

function polygonsOf(geom) {
  if (!geom) return [];
  if (geom.type === 'Polygon') return [geom.coordinates];
  if (geom.type === 'MultiPolygon') return geom.coordinates;
  return [];
}

function polyArea(poly) {
  let a = 0;
  const r = poly[0];
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j][0] + r[i][0]) * (r[j][1] - r[i][1]);
  return Math.abs(a / 2);
}

// Scanline fill of one polygon (outer ring + holes, even-odd) into a grid of size gw x gh
// whose cells cover lon -180..180, lat 90..-90. cb(x, y) for each covered cell center.
function fillPolygon(poly, gw, gh, cb) {
  let minY = Infinity, maxY = -Infinity;
  const edges = [];
  for (const ring of poly) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const ax = ((ring[j][0] + 180) / 360) * gw, ay = ((90 - ring[j][1]) / 180) * gh;
      const bx = ((ring[i][0] + 180) / 360) * gw, by = ((90 - ring[i][1]) / 180) * gh;
      if (ay === by) continue;
      edges.push(ax, ay, bx, by);
      minY = Math.min(minY, ay, by);
      maxY = Math.max(maxY, ay, by);
    }
  }
  const y0 = Math.max(0, Math.floor(minY - 0.5)), y1 = Math.min(gh - 1, Math.ceil(maxY));
  const xs = [];
  for (let y = y0; y <= y1; y++) {
    const cy = y + 0.5;
    xs.length = 0;
    for (let e = 0; e < edges.length; e += 4) {
      const ay = edges[e + 1], by = edges[e + 3];
      if ((ay <= cy && by > cy) || (by <= cy && ay > cy)) {
        const t = (cy - ay) / (by - ay);
        xs.push(edges[e] + t * (edges[e + 2] - edges[e]));
      }
    }
    if (xs.length < 2) continue;
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const xa = Math.max(0, Math.ceil(xs[k] - 0.5)), xb = Math.min(gw - 1, Math.floor(xs[k + 1] - 0.5));
      for (let x = xa; x <= xb; x++) cb(x, y);
    }
  }
}

function coverage(features) {
  const sw = W * SS, sh = H * SS;
  const mask = new Uint8Array(sw * sh);
  for (const f of features) for (const p of polygonsOf(f.geometry)) fillPolygon(p, sw, sh, (x, y) => (mask[y * sw + x] = 1));
  const out = new Uint8Array(W * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let c = 0;
      for (let dy = 0; dy < SS; dy++) for (let dx = 0; dx < SS; dx++) c += mask[(y * SS + dy) * sw + x * SS + dx];
      out[y * W + x] = Math.round((c / (SS * SS)) * 255);
    }
  return out;
}

// Id raster: features drawn largest first so smaller features win.
function idRaster(features, gw, gh, idOf, empty) {
  const ArrayT = empty > 255 ? Uint16Array : Uint8Array;
  const out = new ArrayT(gw * gh).fill(empty);
  const items = [];
  features.forEach((f, i) => {
    const id = idOf(f, i);
    if (id === null || id === undefined) return;
    for (const p of polygonsOf(f.geometry)) items.push({ p, id, a: polyArea(p) });
  });
  items.sort((a, b) => b.a - a.a);
  for (const it of items) fillPolygon(it.p, gw, gh, (x, y) => (out[y * gw + x] = it.id));
  return out;
}

// Two-pass chamfer distance (in cells) from cells where src(i) is false, with longitude wrap.
function distanceTransform(isInside, gw, gh, cap = 255) {
  const INF = 1e9;
  const d = new Float32Array(gw * gh);
  for (let i = 0; i < d.length; i++) d[i] = isInside(i) ? INF : 0;
  const a = 1, b = Math.SQRT2;
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 0; y < gh; y++)
      for (let xi = 0; xi < gw * 2; xi++) {
        const x = xi % gw, i = y * gw + x;
        if (d[i] === 0) continue;
        const xl = (x - 1 + gw) % gw;
        let v = d[i];
        v = Math.min(v, d[y * gw + xl] + a);
        if (y > 0) {
          v = Math.min(v, d[(y - 1) * gw + x] + a, d[(y - 1) * gw + xl] + b, d[(y - 1) * gw + ((x + 1) % gw)] + b);
        }
        d[i] = v;
      }
    for (let y = gh - 1; y >= 0; y--)
      for (let xi = gw * 2 - 1; xi >= 0; xi--) {
        const x = xi % gw, i = y * gw + x;
        if (d[i] === 0) continue;
        const xr = (x + 1) % gw;
        let v = d[i];
        v = Math.min(v, d[y * gw + xr] + a);
        if (y < gh - 1) {
          v = Math.min(v, d[(y + 1) * gw + x] + a, d[(y + 1) * gw + xr] + b, d[(y + 1) * gw + ((x - 1 + gw) % gw)] + b);
        }
        d[i] = v;
      }
  }
  for (let i = 0; i < d.length; i++) d[i] = Math.min(cap, d[i]);
  return d;
}

// Typical crest heights (m) used to estimate elevation inside named ranges/plateaus.
const RANGE_HEIGHTS = [
  ['HIMALAYA', 6200], ['KARAKORAM', 6200], ['PAMIR', 5000], ['HINDU KUSH', 4600], ['KUNLUN', 5200],
  ['TIAN SHAN', 4200], ['ALTUN', 4200], ['QUILIAN', 4200], ['ANDES', 4600], ['CORD', 4300], ['ROCKY', 3200],
  ['SIERRA NEVADA', 3000], ['CASCADE', 2400], ['COAST MOUNTAINS', 2300], ['ALASKA RANGE', 3800],
  ['CHUGACH', 2800], ['ALPS', 3000], ['SOUTHERN ALPS', 2500], ['CAUCASUS', 3600], ['PYRENEES', 2500],
  ['ATLAS', 2600], ['ZAGROS', 3000], ['ELBURZ', 3500], ['ETHIOPIAN', 2800], ['DRAKENSBERG', 2600],
  ['NEW GUINEA', 3600], ['GREAT DIVIDING', 1200], ['APPALACHIAN', 1100], ['URAL', 1100], ['CARPATHIAN', 1700],
  ['APPENNINI', 1600], ['KJØLEN', 1500], ['SIERRA MADRE', 2600], ['TRANSANTARCTIC', 3600], ['TIBESTI', 2500],
  ['AHAGGAR', 2300], ['ALTAY', 3200], ['MACKENZIE', 2200], ['BROOKS', 2000], ['HEJAZ', 1900], ['ASIR', 2400],
  ['SAYAN', 2600], ['WESTERN GHATS', 1300], ['EASTERN GHATS', 900], ['ANNAMITIQUE', 1600], ['GUIANA', 1500],
  ['TORNGAT', 1300], ['VERKHOYANSK', 1800], ['CHERSKIY', 2200], ['STANOVOY', 1900],
];
const PLATEAU_HEIGHTS = [
  ['TIBET', 4700], ['ALTIPLANO', 3800], ['Polar Plateau', 2900], ['Dome', 3200], ['American Highland', 2600],
  ['Talos', 2300], ['Hollick', 1800], ['Rockefeller', 1000], ['MONGOLIAN', 1500], ['COLORADO', 1900],
  ['ALTI-PLANICIE MEXICANA', 1900], ['IBÉRICA', 700], ['DECCAN', 600], ['ETHIOPIAN', 2300], ['YUNGUI', 1900],
  ['Loess', 1300], ['BRAZILIAN', 900], ['COLUMBIA', 700], ['YUKON', 1100], ['KATANGA', 1300], ['Bié', 1500],
  ['Huíla', 1600], ['Adamawa', 1100], ['Qaidam', 2800], ['Tarim', 1100], ['GREAT BASIN', 1500],
];
const heightFor = (table, name, dflt) => {
  const up = name.toUpperCase();
  for (const [k, h] of table) if (up.includes(k.toUpperCase())) return h;
  return dflt;
};

const FEATURE_CLASS = {
  'Range/mtn': 1, Desert: 2, Plateau: 3, Tundra: 4, Wetlands: 5, Delta: 5, Basin: 6, Plain: 7,
  Lowland: 7, Valley: 8, Gorge: 9, Foothills: 10,
};
const NAMEABLE = new Set([
  'Range/mtn', 'Desert', 'Plateau', 'Tundra', 'Wetlands', 'Delta', 'Basin', 'Plain', 'Lowland', 'Valley',
  'Gorge', 'Foothills', 'Island', 'Island group', 'Peninsula', 'Pen/cape', 'Isthmus', 'Coast', 'Geoarea',
]);

const KEEP_UPPER = new Set(['USA', 'UK', 'DR', 'II']);
function niceName(s) {
  if (!s) return '';
  s = s.replace(/\bMTS\.?/gi, 'Mountains').replace(/\bRA\.?(?=\s|$)/gi, 'Range').replace(/\bCORD\./gi, 'Cordillera')
    .replace(/\bPLAT\./gi, 'Plateau').replace(/\bIs\.$/, 'Islands');
  if (s !== s.toUpperCase()) return s.trim();
  return s.toLowerCase().split(/(\s+|-)/).map((w) => {
    if (KEEP_UPPER.has(w.toUpperCase())) return w.toUpperCase();
    if (['of', 'the', 'de', 'del', 'do', 'da', 'and', 'la', 'du', 'des'].includes(w)) return w;
    return w.charAt(0).toUpperCase() + w.slice(1);
  }).join('').replace(/^./, (c) => c.toUpperCase()).trim();
}

const INDIA = new Set(['IND', 'PAK', 'NPL', 'BGD', 'LKA', 'BTN']);
const ARABIA = new Set(['SAU', 'YEM', 'OMN', 'ARE', 'QAT', 'KWT', 'BHR', 'JOR']);
function plateOf(p) {
  const a3 = p.ADM0_A3 || p.ISO_A3;
  if (INDIA.has(a3)) return 5;
  if (ARABIA.has(a3)) return 6;
  if (a3 === 'NZL' || a3 === 'PNG') return 7;
  switch (p.CONTINENT) {
    case 'North America': return 1;
    case 'South America': return 2;
    case 'Europe': case 'Asia': return 3;
    case 'Africa': return 4;
    case 'Oceania': return p.SUBREGION === 'Australia and New Zealand' ? 7 : 9;
    case 'Antarctica': return 8;
    default: return 9;
  }
}

async function main() {
  await ensureSources();
  console.time('bake');
  const land = load('ne_50m_land');
  const lakes = load('ne_50m_lakes');
  const countries = load('ne_50m_admin_0_countries');
  const admin1 = load('ne_50m_admin_1_states_provinces');
  const regions = load('ne_50m_geography_regions_polys');
  const marine = load('ne_10m_geography_marine_polys');
  const rivers = load('ne_50m_rivers_lake_centerlines');

  console.log('land coverage');
  const landCov = coverage(land.features);
  console.log('lake coverage');
  const lakeCov = coverage(lakes.features.filter((f) => (f.properties.scalerank ?? 0) <= 6));

  console.log('countries');
  const countryList = countries.features.map((f) => ({
    name: f.properties.NAME_LONG && f.properties.NAME_LONG.length < 28 ? f.properties.NAME_LONG : f.properties.NAME,
    continent: f.properties.CONTINENT,
  }));
  const countryFine = idRaster(countries.features, W, H, (f, i) => i, 255);
  const plate = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) if (countryFine[i] !== 255) plate[i] = plateOf(countries.features[countryFine[i]].properties);
  // fill plate ids of land cells without a country hit from neighbours
  for (let it = 0; it < 8; it++) {
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (plate[i] || landCov[i] < 40) continue;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const yy = y + dy;
          if (yy < 0 || yy >= H) continue;
          const j = yy * W + ((x + dx + W) % W);
          if (plate[j]) { plate[i] = plate[j]; break; }
        }
      }
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (!plate[i] && landCov[i] >= 40) plate[i] = y > H * 0.8 ? 8 : 9;
    const lon = -180 + (x + 0.5) * 0.25, lat = 90 - (y + 0.5) * 0.25;
    // overseas territories follow the ground they sit on, not their country
    if (plate[i] === 3 && lon < -25) plate[i] = lat < 13 ? 2 : 1;
    if (plate[i] === 1 && (lon < -150 || lon > 150) && lat < 30) plate[i] = 9;
  }

  console.log('admin1');
  const admin1List = admin1.features.map((f) => ({ name: f.properties.name, country: f.properties.admin }));
  const admin1Raster = idRaster(admin1.features, NW, NH, (f, i) => i, 65535);
  const countryRaster = idRaster(countries.features, NW, NH, (f, i) => i, 255);

  console.log('regions');
  const regionFeats = regions.features.filter((f) => NAMEABLE.has(f.properties.FEATURECLA));
  const regionList = regionFeats.map((f) => ({ name: niceName(f.properties.NAME_EN || f.properties.NAME), cls: f.properties.FEATURECLA }));
  const regionRaster = idRaster(regionFeats, NW, NH, (f, i) => i, 65535);

  console.log('marine');
  const marineFeats = marine.features.filter((f) => f.properties.name && f.properties.featurecla !== 'river');
  const marineList = marineFeats.map((f) => niceName(f.properties.name));
  const marineRaster = idRaster(marineFeats, NW, NH, (f, i) => i, 65535);

  console.log('features + elevation');
  const physFeats = regions.features.filter((f) => FEATURE_CLASS[f.properties.FEATURECLA]);
  const feat = idRaster(physFeats, W, H, (f) => FEATURE_CLASS[f.properties.FEATURECLA], 0);

  const isLand = (i) => landCov[i] >= 128;
  const coastDistLand = distanceTransform((i) => isLand(i), W, H);
  const coastDistSea = distanceTransform((i) => !isLand(i), W, H);

  const elev = new Float32Array(W * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (landCov[i] < 20) continue;
      const lat = 90 - (y + 0.5) * 0.25;
      const d = coastDistLand[i] * 27; // ~km
      let e = 40 + 420 * (1 - Math.exp(-d / 700));
      if (lat < -62) e = 600 + 2200 * (1 - Math.exp(-d / 350)); // Antarctic ice sheet
      if (lat > 59 && x > W * 0.33 && x < W * 0.45 && plate[i] === 1) e = Math.max(e, 300 + 2200 * (1 - Math.exp(-d / 250))); // Greenland
      elev[i] = e;
    }

  const applyPolys = (feats, table, dflt, isPlateau) => {
    for (const f of feats) {
      const name = f.properties.NAME_EN || f.properties.NAME;
      const peak = heightFor(table, name, dflt);
      for (const p of polygonsOf(f.geometry)) {
        // local mask over the polygon bbox (+margin)
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        for (const [lon, lat] of p[0]) {
          minX = Math.min(minX, lon); maxX = Math.max(maxX, lon); minY = Math.min(minY, lat); maxY = Math.max(maxY, lat);
        }
        const x0 = Math.max(0, Math.floor(((minX + 180) / 360) * W) - 2), x1 = Math.min(W - 1, Math.ceil(((maxX + 180) / 360) * W) + 2);
        const y0 = Math.max(0, Math.floor(((90 - maxY) / 180) * H) - 2), y1 = Math.min(H - 1, Math.ceil(((90 - minY) / 180) * H) + 2);
        const lw = x1 - x0 + 1, lh = y1 - y0 + 1;
        const m = new Uint8Array(lw * lh);
        let any = false;
        fillPolygon(p, W, H, (x, y) => { if (x >= x0 && x <= x1 && y >= y0 && y <= y1) { m[(y - y0) * lw + (x - x0)] = 1; any = true; } });
        if (!any) continue;
        const dist = new Float32Array(lw * lh);
        // simple BFS-ish chamfer without wrap
        for (let i = 0; i < m.length; i++) dist[i] = m[i] ? 1e9 : 0;
        for (let pass = 0; pass < 2; pass++) {
          for (let y = 0; y < lh; y++) for (let x = 0; x < lw; x++) {
            const i = y * lw + x; if (!dist[i]) continue;
            let v = dist[i];
            if (x > 0) v = Math.min(v, dist[i - 1] + 1);
            if (y > 0) v = Math.min(v, dist[i - lw] + 1);
            if (x > 0 && y > 0) v = Math.min(v, dist[i - lw - 1] + 1.414);
            if (x < lw - 1 && y > 0) v = Math.min(v, dist[i - lw + 1] + 1.414);
            dist[i] = v;
          }
          for (let y = lh - 1; y >= 0; y--) for (let x = lw - 1; x >= 0; x--) {
            const i = y * lw + x; if (!dist[i]) continue;
            let v = dist[i];
            if (x < lw - 1) v = Math.min(v, dist[i + 1] + 1);
            if (y < lh - 1) v = Math.min(v, dist[i + lw] + 1);
            if (x < lw - 1 && y < lh - 1) v = Math.min(v, dist[i + lw + 1] + 1.414);
            if (x > 0 && y < lh - 1) v = Math.min(v, dist[i + lw - 1] + 1.414);
            dist[i] = v;
          }
        }
        let maxD = 0;
        for (let i = 0; i < dist.length; i++) if (dist[i] < 1e8) maxD = Math.max(maxD, dist[i]);
        for (let y = 0; y < lh; y++) for (let x = 0; x < lw; x++) {
          const li = y * lw + x; if (!m[li]) continue;
          const gi = (y + y0) * W + (x + x0);
          if (landCov[gi] < 20) continue;
          const t = isPlateau ? Math.min(1, dist[li] / 2.5) : Math.pow(Math.min(1, dist[li] / Math.max(1.5, maxD)), 0.6);
          const base = elev[gi];
          elev[gi] = Math.max(base, base + (peak - base) * t);
        }
      }
    }
  };
  applyPolys(regions.features.filter((f) => f.properties.FEATURECLA === 'Plateau'), PLATEAU_HEIGHTS, 900, true);
  applyPolys(regions.features.filter((f) => f.properties.FEATURECLA === 'Range/mtn'), RANGE_HEIGHTS, 1500, false);
  // gentle blur on land
  for (let pass = 0; pass < 2; pass++) {
    const copy = elev.slice();
    for (let y = 1; y < H - 1; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x; if (landCov[i] < 20) continue;
      let s = 0, n = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const j = (y + dy) * W + ((x + dx + W) % W);
        if (landCov[j] < 20) continue;
        const w = dx === 0 && dy === 0 ? 4 : 1; s += copy[j] * w; n += w;
      }
      elev[i] = s / n;
    }
  }

  console.log('rivers');
  const riverAngle = new Uint8Array(W * H);
  const riverOff = new Int8Array(W * H);
  const riverBest = new Float32Array(W * H).fill(9);
  const riverSize = new Uint8Array(W * H);
  for (const f of rivers.features) {
    const sr = f.properties.scalerank ?? 9;
    if (sr > 7 || f.properties.featurecla === 'Lake Centerline') continue;
    const size = sr <= 2 ? 3 : sr <= 5 ? 2 : 1;
    const lines = f.geometry.type === 'LineString' ? [f.geometry.coordinates] : f.geometry.type === 'MultiLineString' ? f.geometry.coordinates : [];
    for (const line of lines) for (let k = 0; k + 1 < line.length; k++) {
      const [lon0, lat0] = line[k], [lon1, lat1] = line[k + 1];
      const steps = Math.max(1, Math.ceil(Math.hypot(lon1 - lon0, lat1 - lat0) / 0.05));
      // direction in local metric (x east, y north)
      const midLat = ((lat0 + lat1) / 2) * Math.PI / 180;
      const dxm = (lon1 - lon0) * Math.cos(midLat), dym = lat1 - lat0;
      const len = Math.hypot(dxm, dym) || 1;
      let ang = Math.atan2(dym, dxm) * 180 / Math.PI; if (ang < 0) ang += 180; if (ang >= 180) ang -= 180;
      // unit direction matching the normalised (0..180) angle so the offset sign is consistent
      const dirx = Math.cos(ang * Math.PI / 180), diry = Math.sin(ang * Math.PI / 180);
      for (let s = 0; s <= steps; s++) {
        const lon = lon0 + ((lon1 - lon0) * s) / steps, lat = lat0 + ((lat1 - lat0) * s) / steps;
        const x = Math.floor(((lon + 180) / 360) * W), y = Math.floor(((90 - lat) / 180) * H);
        if (x < 0 || x >= W || y < 0 || y >= H) continue;
        const i = y * W + x;
        // perpendicular offset of the line from the cell centre, in cell units (-1..1)
        const clon = -180 + (x + 0.5) * 0.25, clat = 90 - (y + 0.5) * 0.25;
        const px = (clon - lon) * Math.cos(midLat), py = clat - lat;
        const perp = (px * -diry + py * dirx) / 0.25; // signed, cell units
        if (Math.abs(perp) < Math.abs(riverBest[i]) || size > riverSize[i]) {
          riverBest[i] = perp;
          riverAngle[i] = 1 + Math.round(ang) % 180;
          riverOff[i] = Math.max(-127, Math.min(127, Math.round(-perp * 127)));
          riverSize[i] = Math.max(riverSize[i], size);
        }
      }
    }
  }

  console.log('writing');
  const layersMain = [
    landCov,
    lakeCov,
    Uint8Array.from(elev, (e) => Math.max(0, Math.min(255, Math.round(e / 32)))),
    Uint8Array.from(feat, (c, i) => (c & 15) | (riverSize[i] << 4)),
    riverAngle,
    new Uint8Array(riverOff.buffer),
    Uint8Array.from({ length: W * H }, (_, i) => (isLand(i) ? Math.round(coastDistLand[i]) : Math.round(coastDistSea[i]))),
    plate,
  ];
  const u16 = (a) => new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
  const layersNames = [countryRaster, u16(admin1Raster), u16(regionRaster), u16(marineRaster)];
  const header = Buffer.alloc(16);
  header.write('ANYW', 0, 'ascii');
  header.writeUInt16LE(1, 4);
  header.writeUInt16LE(W, 6);
  header.writeUInt16LE(H, 8);
  header.writeUInt16LE(NW, 10);
  header.writeUInt16LE(NH, 12);
  header.writeUInt16LE(layersMain.length, 14);
  const raw = Buffer.concat([header, ...layersMain.map((l) => Buffer.from(l.buffer, l.byteOffset, l.byteLength)), ...layersNames.map((l) => Buffer.from(l.buffer, l.byteOffset, l.byteLength))]);
  const gz = zlib.gzipSync(raw, { level: 9 });
  fs.mkdirSync(path.join(ROOT, 'public', 'data'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'public', 'data', 'earth.dat'), gz);
  fs.mkdirSync(path.join(ROOT, 'src', 'data'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'src', 'data', 'geonames.json'), JSON.stringify({ countries: countryList, admin1: admin1List, regions: regionList, marine: marineList }));
  console.log('raw', raw.length, 'gz', gz.length);
  console.timeEnd('bake');
}

main().catch((e) => { console.error(e); process.exit(1); });
