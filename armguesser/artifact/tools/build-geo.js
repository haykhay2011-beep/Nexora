/*
 * Regenerates src/geo.json: the vector basemap used by the artifact edition.
 *
 *   cd armguesser/artifact/tools
 *   npm i --no-save world-atlas@2.0.2 sane-topojson@4.0.0 @geo-insight/data@0.3.0 topojson-client polygon-clipping
 *   node build-geo.js
 *
 * Sources (all derived from Natural Earth, public domain):
 *   - national borders: world-atlas countries-10m (ISC)
 *   - the 11 regions:   @geo-insight/data ADM1 for Armenia (MIT), clipped to the 10m border
 *   - lakes:            sane-topojson asia_50m (MIT)
 */
const fs = require('fs');
const path = require('path');
const topo = require('topojson-client');
const pc = require('polygon-clipping');

const nm = (p) => path.join(__dirname, 'node_modules', p);
const BBOX = [42.4, 38.2, 47.6, 41.9]; // minLng, minLat, maxLng, maxLat
const NEIGHBORS = { Georgia: 'Georgia', Azerbaijan: 'Azerbaijan', Turkey: 'Türkiye', Iran: 'Iran', Russia: 'Russia' };

const r3 = (n) => Math.round(n * 1000) / 1000; // ~100 m, plenty at these zooms
const round = (c) => (typeof c[0] === 'number' ? [r3(c[0]), r3(c[1])] : c.map(round));
const dedupe = (c) => {
  if (typeof c[0][0] !== 'number') return c.map(dedupe);
  return c.filter((p, i) => i === 0 || p[0] !== c[i - 1][0] || p[1] !== c[i - 1][1]);
};
const clean = (c) => dedupe(round(c));
const depth = (a) => (Array.isArray(a) ? 1 + depth(a[0]) : 0);
const asMulti = (c) => (depth(c) === 3 ? [c] : c);
const polysOf = (g) => (g.type === 'Polygon' ? [g.coordinates] : g.coordinates);
const box = [[[BBOX[0], BBOX[1]], [BBOX[2], BBOX[1]], [BBOX[2], BBOX[3]], [BBOX[0], BBOX[3]], [BBOX[0], BBOX[1]]]];

const out = { armenia: null, neighbors: [], regions: [], lakes: [] };

const world = JSON.parse(fs.readFileSync(nm('world-atlas/countries-10m.json')));
for (const f of topo.feature(world, world.objects.countries).features) {
  const name = f.properties.name;
  if (name !== 'Armenia' && !(name in NEIGHBORS)) continue;
  const clipped = pc.intersection(polysOf(f.geometry), box);
  if (!clipped.length) continue;
  if (name === 'Armenia') out.armenia = clean(clipped);
  else out.neighbors.push({ name: NEIGHBORS[name], geom: clean(clipped) });
}

const adm1 = JSON.parse(fs.readFileSync(nm('@geo-insight/data/dist/assets/adm1/051.json')));
for (const f of adm1.features) {
  out.regions.push({
    name: f.properties.name === 'Erevan' ? 'Yerevan' : f.properties.name,
    geom: clean(pc.intersection(polysOf(f.geometry), out.armenia))
  });
}

const asia = JSON.parse(fs.readFileSync(nm('sane-topojson/dist/asia_50m.json')));
for (const f of topo.feature(asia, asia.objects.lakes).features) {
  const inside = JSON.stringify(f.geometry.coordinates).match(/-?\d+\.?\d*,-?\d+\.?\d*/g)
    .some((pair) => { const [x, y] = pair.split(',').map(Number); return x > BBOX[0] && x < BBOX[2] && y > BBOX[1] && y < BBOX[3]; });
  if (inside) out.lakes.push(asMulti(clean(f.geometry.coordinates)));
}

fs.writeFileSync(path.join(__dirname, '..', 'src', 'geo.json'), JSON.stringify(out));
console.log('regions', out.regions.length, 'neighbors', out.neighbors.length, 'lakes', out.lakes.length);
