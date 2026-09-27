// Run with: node --test armguesser/tests/*.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const Core = require('../js/core.js');
const LOCATIONS = require('../js/locations.js');

const REGIONS = ['Aragatsotn', 'Ararat', 'Armavir', 'Gegharkunik', 'Kotayk', 'Lori',
  'Shirak', 'Syunik', 'Tavush', 'Vayots Dzor', 'Yerevan'];

test('location database is complete and well-formed', () => {
  assert.ok(LOCATIONS.length >= 75, `expected 75+ locations, got ${LOCATIONS.length}`);
  const ids = new Set();
  for (const l of LOCATIONS) {
    assert.ok(!ids.has(l.id), `duplicate id ${l.id}`);
    ids.add(l.id);
    for (const k of ['name', 'hy', 'translit', 'category', 'fact']) assert.ok(l[k], `${l.id} missing ${k}`);
    assert.ok(REGIONS.includes(l.region), `${l.id} has unknown region ${l.region}`);
    assert.ok([1, 2, 3, 4].includes(l.difficulty), `${l.id} bad difficulty`);
    // Inside Armenia's bounding box.
    assert.ok(l.lat > 38.8 && l.lat < 41.31, `${l.id} lat out of range`);
    assert.ok(l.lng > 43.4 && l.lng < 46.65, `${l.id} lng out of range`);
  }
  for (const r of REGIONS) assert.ok(LOCATIONS.some(l => l.region === r), `no locations in ${r}`);
});

test('every mode has enough locations for a full game', () => {
  for (const mode of Object.keys(Core.MODES)) {
    const picked = Core.pickLocations(LOCATIONS, mode, { date: '2026-09-27' });
    assert.equal(picked.length, Core.ROUNDS, mode);
    assert.equal(new Set(picked.map(l => l.id)).size, Core.ROUNDS, `${mode} repeats`);
    for (const l of picked) assert.ok(Core.MODES[mode].pool.includes(l.difficulty));
  }
});

test('haversine distance is accurate', () => {
  assert.equal(Core.haversineKm({ lat: 40, lng: 44 }, { lat: 40, lng: 44 }), 0);
  // Republic Square → Gyumri is ~ 90 km as the crow flies.
  const d = Core.haversineKm({ lat: 40.1777, lng: 44.5126 }, { lat: 40.7894, lng: 43.8475 });
  assert.ok(d > 85 && d < 92, `got ${d}`);
});

test('scoring follows 5000 × (1 − d/400) and clamps', () => {
  assert.equal(Core.scoreForDistance(0), 5000);
  assert.equal(Core.scoreForDistance(200), 2500);
  assert.equal(Core.scoreForDistance(100), 3750);
  assert.equal(Core.scoreForDistance(400), 0);
  assert.equal(Core.scoreForDistance(900), 0);
  assert.equal(Core.scoreForDistance(null), 0);
});

test('daily challenge is deterministic per date and differs across dates', () => {
  const a = Core.pickLocations(LOCATIONS, 'daily', { date: '2026-09-27' }).map(l => l.id);
  const b = Core.pickLocations(LOCATIONS.slice().reverse(), 'daily', { date: '2026-09-27' }).map(l => l.id);
  const c = Core.pickLocations(LOCATIONS, 'daily', { date: '2026-09-28' }).map(l => l.id);
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);
});

test('recently-seen locations are deprioritised', () => {
  const pool = LOCATIONS.filter(l => l.difficulty === 1);
  const recent = pool.slice(0, pool.length - 5).map(l => l.id);
  const picked = Core.pickLocations(LOCATIONS, 'easy', { recent });
  for (const l of picked) assert.ok(!recent.includes(l.id));
});

test('stats, ranks, share text and achievements', () => {
  const rounds = [
    { distance: 0.3, points: 4996 },
    { distance: 10, points: 4875 },
    { distance: 200, points: 2500 },
    { distance: null, points: 0 },
    { distance: 50, points: 4375 }
  ];
  const s = Core.computeStats(rounds);
  assert.equal(s.total, 16746);
  assert.equal(s.bestRound, 0);
  assert.equal(s.worstRound, 3);
  assert.equal(s.accuracy, 67);
  assert.ok(Math.abs(s.averageDistance - 65.075) < 1e-9);
  assert.equal(Core.rankFor(s.total).title, 'Seasoned Traveller');
  const text = Core.shareText({ mode: 'hard', rounds, total: s.total });
  assert.match(text, /🟩🟩🟧🟥🟨/);
  assert.match(text, /16,746 \/ 25,000/);
  const got = Core.evaluateAchievements({ mode: 'expert', rounds }, { gamesPlayed: 1, modesCompleted: [], dailyStreak: 0 });
  assert.deepEqual(got.sort(), ['bullseye', 'expert_eye', 'perfect', 'wanderer'].sort());
});
