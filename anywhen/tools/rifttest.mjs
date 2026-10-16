// Headless story test: plays every Major Rift end to end by teleporting the player and pressing keys.
// Usage: node tools/rifttest.mjs [outDir] [url]
import { chromium } from 'playwright-core';

const out = process.argv[2] ?? 'playtest-shots';
const url = process.argv[3] ?? 'http://localhost:5173/';
const exe = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch({ executablePath: exe, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message));
const story = () => page.evaluate(() => ({ ...window.anywhen.state.story, text: window.anywhen.story.step?.text ?? null }));
const until = (fn, arg, t = 30000) => page.waitForFunction(fn, arg, { timeout: t, polling: 250 }).catch(() => false);
const clearCards = () => page.evaluate(() => { const b = document.querySelector('.cards .actions button, .story:not(.hidden) .actions button'); if (b && b.offsetParent) b.click(); window.anywhen.cards.hide?.(); });
const jump = async (lat, lon, year, moon = false) => {
  await page.evaluate(async ([lat, lon, year, moon]) => {
    const g = window.anywhen, P = await import('/src/geo/paleo.ts');
    if (!moon) [lat, lon] = P.presentToPast(lat, lon, g.earth.plateAt(lat, lon), year);
    g.state.energy = Math.max(g.state.energy, 500);
    await g.jumpTo({ lat, lon, year, moon, name: '' }, true);
  }, [lat, lon, year, moon]);
  await until(() => window.anywhen.mode === 'play' && window.anywhen.world, null, 120000);
  await page.waitForTimeout(1500);
  for (let i = 0; i < 3; i++) { await clearCards(); await page.waitForTimeout(200); }
};
const talkTo = async (storyId) => {
  const ok = await page.evaluate((id) => {
    const g = window.anywhen, n = [...g.world.npcs.npcs].find((x) => x.storyId === id);
    if (!n) return false; g.player.pos.set(n.pos.x + 1.4, n.pos.y, n.pos.z); return true;
  }, storyId);
  if (!ok) return false;
  await page.waitForTimeout(800);
  await page.keyboard.press('KeyE');
  await until(() => window.anywhen.dialogue.open, null, 15000);
  for (let i = 0; i < 12; i++) {
    if (!(await page.evaluate(() => window.anywhen.dialogue.open))) break;
    await page.keyboard.press('Digit1');
    await page.waitForTimeout(900);
  }
  return true;
};
const capture = async (id) => {
  const ok = await page.evaluate((id) => {
    const g = window.anywhen, a = g.world.anomalies.list.find((x) => x.def.id === id);
    if (!a) return false; g.player.pos.set(a.pos.x + 1, a.pos.y, a.pos.z); return true;
  }, id);
  if (!ok) return false;
  await page.waitForTimeout(800);
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(1200);
  if (await page.evaluate(() => window.anywhen.puzzle.open)) await page.evaluate(() => window.anywhen.puzzle.finish(true));
  return until((id) => window.anywhen.state.vault.some((v) => v.anomalyId === id), id, 20000);
};
const ret = async (id) => {
  await page.keyboard.press('KeyR');
  return until((id) => !window.anywhen.state.vault.some((v) => v.anomalyId === id), id, 20000);
};
const log = (ok, label) => console.log(ok ? 'PASS' : 'FAIL', label);
const ERAS = JSON.parse(await (await import('node:fs/promises')).readFile(new URL('../src/data/eras.json', import.meta.url), 'utf8'));
const RIFTS = JSON.parse(await (await import('node:fs/promises')).readFile(new URL('../src/data/rifts.json', import.meta.url), 'utf8'));
const ERA_YEAR = { modern: 2020 }; // some anomalies need a late year (smartphones after 2007)
const eraMid = (id) => { if (ERA_YEAR[id]) return ERA_YEAR[id]; const e = ERAS.find((x) => x.id === id); return Math.round(e.start + (Math.min(e.end, 3000) - e.start) * 0.75); };
const mid = (st, d) => (st.yearMin !== undefined ? Math.round((st.yearMin + (st.yearMax ?? st.yearMin)) / 2) : d);
const here = async () => { await until(() => window.anywhen.mode === 'play' && window.anywhen.world, null, 120000); return page.evaluate(() => { const p = window.anywhen.world.plan; return { lat: p.presentLat, lon: p.presentLon, year: p.year, moon: p.moon }; }); };

const act = async (st, loc) => {
  const h = await here();
  switch (st.type) {
    case 'travel': await jump(st.lat ?? h.lat, st.lon ?? h.lon, mid(st, h.year)); return true;
    case 'moon': await jump(0.67, 23.47, 2024, true); return true;
    case 'talk': case 'puzzle': case 'deliver': {
      const ok = await talkTo(st.npc);
      if (await page.evaluate(() => window.anywhen.puzzle.open)) { await page.evaluate(() => window.anywhen.puzzle.finish(true)); await page.waitForTimeout(800); }
      return ok;
    }
    case 'capture': return capture(st.anomaly);
    case 'find': {
      for (let n = 0; n < (st.count ?? 1); n++) {
        const ok = await page.evaluate((item) => { const g = window.anywhen, pk = g.world.pickups.list.find((x) => x.item === item); if (!pk) return false; g.player.pos.set(pk.pos.x + 0.3, pk.pos.y, pk.pos.z); return true; }, st.item);
        if (!ok) return false;
        await page.waitForTimeout(700); await page.keyboard.press('KeyE');
        await until(([item, c]) => (window.anywhen.state.inventory[item] ?? 0) >= c, [st.item, n + 1], 15000);
      }
      return true;
    }
    case 'visit': case 'photograph': {
      const ok = await page.evaluate((id) => { const g = window.anywhen, l = g.world.plan.landmarks.find((x) => x.id === id); if (!l) return false; const a = Math.atan2(g.player.pos.x - l.x, g.player.pos.z - l.z); g.player.pos.set(l.x + Math.sin(a) * (l.clear * 0.8 + 30), g.player.pos.y + 5, l.z + Math.cos(a) * (l.clear * 0.8 + 30)); return true; }, st.landmark);
      if (!ok) return false;
      await page.waitForTimeout(1500);
      if (st.type === 'photograph') {
        await page.keyboard.press('KeyP'); await page.waitForTimeout(800);
        await page.evaluate((id) => { const g = window.anywhen, l = g.world.plan.landmarks.find((x) => x.id === id), c = g.photoCam; const dx = l.x - c.pos.x, dz = l.z - c.pos.z; c.yaw = Math.atan2(-dx, -dz); c.pitch = 0.15; }, st.landmark);
        await page.waitForTimeout(800); await page.keyboard.press('Space'); await page.waitForTimeout(1500); await page.keyboard.press('KeyP');
      }
      return true;
    }
    case 'return': {
      const can = await page.evaluate((id) => { const g = window.anywhen, v = g.state.vault.find((x) => x.anomalyId === id); return v ? g.canReturn(id) : 'missing'; }, st.anomaly);
      if (can === 'missing') return false;
      if (can) await jump(st.lat ?? loc?.lat ?? h.lat, st.lon ?? loc?.lon ?? h.lon, st.era ? eraMid(st.era) : h.year);
      return ret(st.anomaly);
    }
  }
  return false;
};

await page.goto(url);
await page.waitForFunction(() => !!window.anywhen, null, { timeout: 60000 });
await page.getByText('New Game').click();
await page.waitForTimeout(500);
await page.getByRole('button', { name: 'Begin' }).click();
await until(() => window.anywhen.mode === 'play' && window.anywhen.world, null, 120000);
await page.waitForTimeout(1500);
for (let i = 0; i < 3; i++) { await clearCards(); await page.waitForTimeout(200); }
await page.evaluate(() => { const s = window.anywhen.state; for (const e of ['dinosaurs', 'mammals', 'iceage', 'stoneage', 'farfuture']) if (!s.unlocks.eras.includes(e)) s.unlocks.eras.push(e); s.unlocks.moon = true; });
const only = process.env.RIFTS ? process.env.RIFTS.split(',') : null;
let fails = 0;
for (let ri = 0; ri < RIFTS.length; ri++) {
  const rift = RIFTS[ri];
  await page.evaluate((ri) => { const s = window.anywhen.state.story; if (s.rift < ri) { s.rift = ri; s.step = 0; } }, ri);
  if (only && !only.includes(rift.id)) continue;
  let loc = null;
  for (let guard = 0; guard < 20; guard++) {
    const s = await page.evaluate(() => window.anywhen.state.story);
    if (s.rift !== ri || s.ended) break;
    const st = rift.steps[s.step];
    if (st.type === 'travel' || (st.type === 'return' && st.lat !== undefined)) loc = { lat: st.lat, lon: st.lon };
    const ok = await act(st, loc);
    const after = await until(([r, k]) => { const s = window.anywhen.state.story; return s.rift !== r || s.step !== k || s.ended; }, [ri, s.step], 12000);
    log(ok && after, `${rift.id} step ${s.step} ${st.type} ${st.npc ?? st.anomaly ?? st.item ?? st.landmark ?? ''}`);
    if (!(ok && after)) { fails++; await page.screenshot({ path: `${out}/rift-${rift.id}-${s.step}.png` }); await page.evaluate(() => { const g = window.anywhen; g.dialogue.hide?.(); g.talking = null; g.story.advance(); }); }
  }
  console.log('—', rift.id, 'done:', await page.evaluate((id) => window.anywhen.state.story.done.includes(id), rift.id));
}
await page.waitForTimeout(2000);
await page.screenshot({ path: `${out}/rift-end.png` });
console.log('story', JSON.stringify(await page.evaluate(() => window.anywhen.state.story)), 'fails', fails);
console.log('ERRORS:', errors.length);
for (const e of errors.slice(0, 40)) console.log(e);
await browser.close();
