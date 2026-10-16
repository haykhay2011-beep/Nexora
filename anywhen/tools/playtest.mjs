// Headless playtest: loads the game, starts a new game, travels to several places and screenshots each.
// Usage: node tools/playtest.mjs [outDir] [url]
import { chromium } from 'playwright-core';

const out = process.argv[2] ?? 'playtest-shots';
const url = process.argv[3] ?? 'http://localhost:5173/';
const exe = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const places = JSON.parse(process.env.PLACES ?? 'null') ?? [
  ['giza', 29.9792, 31.1342, -2560, false],
  ['sahara', 23.4, 25.6, -3000, false],
  ['tokyo', 35.68, 139.69, 2024, false],
  ['amazon', -3.4, -62.2, 1500, false],
  ['arctic', 71, 130, -20000, false],
  ['montana', 47.0, -92.5, -70000000, false],
  ['moon', 0.67, 23.47, 1969, true],
];

const browser = await chromium.launch({ executablePath: exe, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message));
await page.goto(url);
await page.waitForFunction(() => !!window.anywhen, null, { timeout: 60000 });
await page.waitForTimeout(1500);
await page.screenshot({ path: `${out}/00-title.png` });
for (const [name, lat, lon, year, moon] of places) {
  const t0 = Date.now();
  await page.evaluate(async ([lat, lon, year, moon]) => {
    const g = window.anywhen;
    g.state.energy = 9999;
    for (const e of ['dinosaurs', 'mammals', 'iceage', 'stoneage', 'farfuture']) if (!g.state.unlocks.eras.includes(e)) g.state.unlocks.eras.push(e);
    g.state.unlocks.moon = true;
    g.title.show(false); g.titleGlobe.stop();
    await g.jumpTo({ lat, lon, year, moon, name: '' }, true);
  }, [lat, lon, year, moon]);
  await page.waitForTimeout(Number(process.env.WAIT ?? 2500));
  await page.evaluate(() => { const g = window.anywhen; g.cards.hide(); g.fx.swirl = g.fx.swirlTarget; g.fx.fade = g.fx.fadeTarget; });
  const fps = await page.evaluate(() => new Promise((res) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else res(n / 2); }; requestAnimationFrame(f); }));
  console.log('fps', fps);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/${name}.png` });
  const info = await page.evaluate(() => {
    const g = window.anywhen; const w = g.world; const r = g.r.stats;
    return { place: w?.plan.place.name, era: w?.plan.eraId, biome: w?.plan.biome, chunks: w?.chunks.loadedCount, npcs: w?.npcs.npcs.length, animals: w?.animals.animals.length, anomalies: w?.anomalies.list.length, calls: r.calls, tris: r.triangles, player: g.player?.pos.toArray().map((v) => Math.round(v)) };
  });
  console.log(name, Date.now() - t0, 'ms', JSON.stringify(info));
}
console.log('ERRORS:', errors.length);
for (const e of errors.slice(0, 40)) console.log(e);
await browser.close();
