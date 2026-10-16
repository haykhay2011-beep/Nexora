// Headless gameplay-flow test: new game, talk, capture, menus and the time-travel screen.
// Usage: node tools/flowtest.mjs [outDir] [url]
import { chromium } from 'playwright-core';

const out = process.argv[2] ?? 'playtest-shots';
const url = process.argv[3] ?? 'http://localhost:5173/';
const exe = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch({ executablePath: exe, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message));
const shot = (n) => page.screenshot({ path: `${out}/flow-${n}.png` });
const key = async (k, wait = 400) => { await page.keyboard.press(k); await page.waitForTimeout(wait); };
const visible = (sel) => page.evaluate((s) => [...document.querySelectorAll(s)].some((e) => !e.closest('.hidden') && e.getBoundingClientRect().width > 0), sel);
const step = (name, ok) => console.log(ok ? 'PASS' : 'FAIL', name);

await page.goto(url);
await page.waitForFunction(() => !!window.anywhen, null, { timeout: 60000 });
await page.waitForTimeout(1000);
await page.getByText('New Game').click();
await page.waitForTimeout(600);
await page.getByRole('button', { name: 'Begin' }).click();
await page.waitForFunction(() => window.anywhen.world && window.anywhen.mode === 'play', null, { timeout: 120000 }).catch(() => {});
await page.waitForTimeout(2500);
// dismiss story cards
for (let i = 0; i < 4; i++) { const b = page.locator('.card:not(.hidden) .actions button, .story:not(.hidden) .actions button').first(); if (await b.count()) await b.click().catch(() => {}); await page.waitForTimeout(300); }
await page.evaluate(() => { const g = window.anywhen; g.fx.swirl = g.fx.swirlTarget; g.fx.fade = g.fx.fadeTarget; });
await shot('1-arrive');
const info = await page.evaluate(() => ({ mode: window.anywhen.mode, place: window.anywhen.world?.plan.place.name, year: window.anywhen.state.year }));
step('new game arrives ' + JSON.stringify(info), info.mode === 'play' && !!info.place);

// talk to the nearest NPC
const npc = await page.evaluate(() => {
  const g = window.anywhen, p = g.player, list = g.world.npcs.npcs.filter((n) => !n.watcher);
  list.sort((a, b) => a.pos.distanceTo(p.pos) - b.pos.distanceTo(p.pos));
  const n = list[0]; if (!n) return null;
  p.pos.set(n.pos.x + 1.5, n.pos.y, n.pos.z); p.vel?.set(0, 0, 0);
  return n.spawn.name;
});
await page.waitForTimeout(600);
await key('KeyE', 800);
const talking = await page.evaluate(() => window.anywhen.dialogue.open);
await shot('2-talk');
step(`talk to ${npc}`, talking);
await key('Digit1', 600);
await key('Escape', 400);
await page.evaluate(() => { const g = window.anywhen; g.dialogue?.hide?.(); });

// capture the nearest anomaly
const an = await page.evaluate(() => {
  const g = window.anywhen, p = g.player, a = g.world.anomalies.nearest(p.pos);
  if (!a) return null;
  p.pos.set(a.pos.x + 1.2, a.pos.y, a.pos.z);
  return { name: a.def.name, challenge: a.spawn.challenge, vault: g.state.vault.length };
});
await page.waitForTimeout(800);
await key('KeyE', 1200);
if (an?.challenge === 'puzzle') { await shot('3-puzzle'); await page.evaluate(() => window.anywhen.puzzle?.finish?.(true)); await page.waitForTimeout(800); }
const vault = await page.evaluate(() => window.anywhen.state.vault.length);
await shot('3-capture');
step(`capture ${JSON.stringify(an)} → vault ${vault}`, !!an && vault > an.vault);

for (const [k, sel, n] of [['KeyJ', '.journal', 'journal'], ['Tab', '.inventory', 'inventory'], ['KeyM', '.map', 'map']]) {
  await key(k, 700);
  const ok = await page.evaluate(() => !!document.querySelector('.modal:not(.hidden), .screen:not(.hidden)'));
  await shot('4-' + n);
  step(n + ' opens', ok);
  await key(k, 400);
}
await key('KeyT', 1500);
const travel = await page.evaluate(() => window.anywhen.mode);
await shot('5-travel');
step('travel screen opens (mode=' + travel + ')', travel === 'travel');
await key('Escape', 800);
await key('Escape', 600);
await shot('6-pause');
step('pause menu', await page.evaluate(() => window.anywhen.mode));
await key('Escape', 400);
// photo mode
await key('KeyP', 600);
await key('Space', 1200);
await page.waitForFunction(() => window.anywhen.state.photos.length > 0, null, { timeout: 20000 }).catch(() => {});
const photos = await page.evaluate(() => window.anywhen.state.photos.length);
await shot('7-photo');
step('photo taken (' + photos + ')', photos > 0);
await key('KeyP', 600);
// return the captured anomaly in its home era
const home = await page.evaluate(async () => {
  const g = window.anywhen, v = g.state.vault[0]; if (!v) return null;
  g.state.energy = 9999;
  await g.jumpTo({ lat: 35.68, lon: 139.69, year: 2045, moon: false, name: '' }, true);
  return v.anomalyId;
});
await page.waitForTimeout(3000);
await page.evaluate(() => { const g = window.anywhen; g.cards.hide(); });
const before = await page.evaluate(() => window.anywhen.state.vault.length);
await key('KeyR', 300);
await page.waitForFunction((b) => window.anywhen.state.vault.length < b, before, { timeout: 30000 }).catch(() => {});
const after = await page.evaluate(() => ({ vault: window.anywhen.state.vault.length, returned: window.anywhen.state.returned.length }));
await shot('8-return');
step(`return ${home} in 2045: vault ${before} → ${JSON.stringify(after)}`, after.vault < before);
console.log('ERRORS:', errors.length);
for (const e of errors.slice(0, 40)) console.log(e);
await browser.close();
