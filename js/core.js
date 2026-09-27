/*
 * armguesser core logic: pure functions with no DOM access, so they can be
 * unit-tested in Node (see tests/core.test.js).
 */
(function (root) {
  'use strict';

  var ROUNDS = 5;
  var MAX_POINTS = 5000;
  var MAX_DISTANCE_KM = 400; // roughly Armenia's longest extent

  // Which location difficulty ratings each game mode draws from.
  var MODES = {
    easy:   { label: 'Easy',   pool: [1],          view: { zoom: 15, minZoom: 13, radiusKm: 3 } },
    medium: { label: 'Medium', pool: [1, 2],       view: { zoom: 16, minZoom: 14, radiusKm: 2 } },
    hard:   { label: 'Hard',   pool: [3],          view: { zoom: 16, minZoom: 15, radiusKm: 1.2 } },
    expert: { label: 'Expert', pool: [4],          view: { zoom: 18, minZoom: 17, radiusKm: 0.4 } },
    mixed:  { label: 'Mixed',  pool: [1, 2, 3, 4], view: { zoom: 16, minZoom: 14, radiusKm: 2 } },
    daily:  { label: 'Daily',  pool: [1, 2, 3, 4], view: { zoom: 16, minZoom: 14, radiusKm: 2 } }
  };

  var RANKS = [
    { min: 23000, title: 'Hayastan Legend',    emoji: '🏆' },
    { min: 20000, title: 'Master Navigator',   emoji: '🧭' },
    { min: 15000, title: 'Seasoned Traveller', emoji: '🎒' },
    { min: 10000, title: 'Curious Tourist',    emoji: '📸' },
    { min: 5000,  title: 'Lost Tourist',       emoji: '🗺️' },
    { min: 0,     title: 'Just Landed',        emoji: '✈️' }
  ];

  /** Great-circle distance in km between two {lat, lng} points. */
  function haversineKm(a, b) {
    var R = 6371;
    var toRad = Math.PI / 180;
    var dLat = (b.lat - a.lat) * toRad;
    var dLng = (b.lng - a.lng) * toRad;
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(a.lat * toRad) * Math.cos(b.lat * toRad) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  }

  /** 5000 × (1 − d / 400), clamped to [0, 5000] and rounded. */
  function scoreForDistance(km) {
    if (km == null || !isFinite(km)) return 0;
    var raw = MAX_POINTS * (1 - km / MAX_DISTANCE_KM);
    return Math.max(0, Math.min(MAX_POINTS, Math.round(raw)));
  }

  function formatDistance(km) {
    if (km == null) return '—';
    if (km < 1) return Math.round(km * 1000) + ' m';
    if (km < 10) return km.toFixed(1) + ' km';
    return Math.round(km) + ' km';
  }

  function rankFor(total) {
    for (var i = 0; i < RANKS.length; i++) if (total >= RANKS[i].min) return RANKS[i];
    return RANKS[RANKS.length - 1];
  }

  /** Emoji square for a round, used in the share card. */
  function emojiFor(points) {
    if (points >= 4500) return '🟩';
    if (points >= 3500) return '🟨';
    if (points >= 2000) return '🟧';
    return '🟥';
  }

  /** Deterministic PRNG (mulberry32) so the daily challenge is identical for everyone. */
  function seededRandom(seed) {
    var t = seed >>> 0;
    return function () {
      t = (t + 0x6D2B79F5) >>> 0;
      var r = Math.imul(t ^ (t >>> 15), 1 | t);
      r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hashString(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  /** Local-date key like "2026-09-27". */
  function dateKey(d) {
    d = d || new Date();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + m + '-' + day;
  }

  function shuffle(arr, rand) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rand() * (i + 1));
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }

  /**
   * Pick `count` distinct locations for a mode. Recently-seen ids are pushed to
   * the back of the queue so repeat players see fresh places first. The daily
   * mode ignores `recent` and uses a date-seeded shuffle instead.
   */
  function pickLocations(all, mode, opts) {
    opts = opts || {};
    var count = opts.count || ROUNDS;
    var rand = opts.rand || Math.random;
    var cfg = MODES[mode] || MODES.medium;
    var pool = all.filter(function (l) { return cfg.pool.indexOf(l.difficulty) !== -1; });

    if (mode === 'daily') {
      var dayRand = seededRandom(hashString('armguesser:' + (opts.date || dateKey())));
      // Sort first so the result doesn't depend on array order in the data file.
      pool.sort(function (a, b) { return a.id < b.id ? -1 : 1; });
      return shuffle(pool, dayRand).slice(0, count);
    }

    var recent = opts.recent || [];
    var shuffled = shuffle(pool, rand);
    var fresh = shuffled.filter(function (l) { return recent.indexOf(l.id) === -1; });
    var stale = shuffled.filter(function (l) { return recent.indexOf(l.id) !== -1; });
    return fresh.concat(stale).slice(0, count);
  }

  /** Summary stats for a finished game. `rounds` = [{distance, points}]. */
  function computeStats(rounds) {
    var guessed = rounds.filter(function (r) { return r.distance != null; });
    var total = rounds.reduce(function (s, r) { return s + r.points; }, 0);
    var best = null, worst = null;
    rounds.forEach(function (r, i) {
      if (best === null || r.points > rounds[best].points) best = i;
      if (worst === null || r.points < rounds[worst].points) worst = i;
    });
    var avg = guessed.length
      ? guessed.reduce(function (s, r) { return s + r.distance; }, 0) / guessed.length
      : null;
    return {
      total: total,
      max: rounds.length * MAX_POINTS,
      accuracy: rounds.length ? Math.round((total / (rounds.length * MAX_POINTS)) * 100) : 0,
      averageDistance: avg,
      bestRound: best,
      worstRound: worst
    };
  }

  function shareText(opts) {
    var squares = opts.rounds.map(function (r) { return emojiFor(r.points); }).join('');
    var title = opts.mode === 'daily'
      ? 'armguesser Daily ' + opts.date
      : 'armguesser · ' + (MODES[opts.mode] || MODES.medium).label;
    var lines = [
      '🇦🇲 ' + title,
      squares + '  ' + opts.total.toLocaleString('en-US') + ' / ' + (opts.rounds.length * MAX_POINTS).toLocaleString('en-US'),
      rankFor(opts.total).emoji + ' ' + rankFor(opts.total).title
    ];
    if (opts.url) lines.push(opts.url);
    return lines.join('\n');
  }

  /**
   * Achievements unlocked by a finished game. `ctx` carries cross-game
   * progress: { gamesPlayed, dailyStreak, modesCompleted: [] }.
   */
  var ACHIEVEMENTS = [
    { id: 'bullseye',     icon: '🎯', title: 'Bullseye',          desc: 'Guess within 500 m of the target.' },
    { id: 'perfect',      icon: '💯', title: 'Perfect Round',     desc: 'Score 4,950+ points in a single round.' },
    { id: 'sharpshooter', icon: '🏹', title: 'Sharpshooter',      desc: 'Score 4,000+ in every round of a game.' },
    { id: 'highroller',   icon: '💎', title: 'High Roller',       desc: 'Finish a game with 20,000+ points.' },
    { id: 'wanderer',     icon: '🥾', title: 'Wrong Side of the Mountains', desc: 'Miss by more than 150 km.' },
    { id: 'expert_eye',   icon: '🦅', title: 'Eagle Eye',         desc: 'Score 15,000+ on Expert.' },
    { id: 'explorer',     icon: '🧭', title: 'Explorer',          desc: 'Finish a game on Easy, Medium, Hard and Expert.' },
    { id: 'devotee',      icon: '📅', title: 'Daily Devotee',     desc: 'Play the daily challenge 3 days in a row.' },
    { id: 'veteran',      icon: '🎖️', title: 'Veteran',           desc: 'Play 10 games.' }
  ];

  function evaluateAchievements(game, ctx) {
    var got = [];
    var rounds = game.rounds;
    var total = rounds.reduce(function (s, r) { return s + r.points; }, 0);
    if (rounds.some(function (r) { return r.distance != null && r.distance <= 0.5; })) got.push('bullseye');
    if (rounds.some(function (r) { return r.points >= 4950; })) got.push('perfect');
    if (rounds.length === ROUNDS && rounds.every(function (r) { return r.points >= 4000; })) got.push('sharpshooter');
    if (total >= 20000) got.push('highroller');
    if (rounds.some(function (r) { return r.distance != null && r.distance > 150; })) got.push('wanderer');
    if (game.mode === 'expert' && total >= 15000) got.push('expert_eye');
    var modes = ctx.modesCompleted || [];
    if (['easy', 'medium', 'hard', 'expert'].every(function (m) { return modes.indexOf(m) !== -1; })) got.push('explorer');
    if ((ctx.dailyStreak || 0) >= 3) got.push('devotee');
    if ((ctx.gamesPlayed || 0) >= 10) got.push('veteran');
    return got;
  }

  var api = {
    ROUNDS: ROUNDS,
    MAX_POINTS: MAX_POINTS,
    MAX_DISTANCE_KM: MAX_DISTANCE_KM,
    MODES: MODES,
    RANKS: RANKS,
    ACHIEVEMENTS: ACHIEVEMENTS,
    haversineKm: haversineKm,
    scoreForDistance: scoreForDistance,
    formatDistance: formatDistance,
    rankFor: rankFor,
    emojiFor: emojiFor,
    seededRandom: seededRandom,
    hashString: hashString,
    dateKey: dateKey,
    pickLocations: pickLocations,
    computeStats: computeStats,
    shareText: shareText,
    evaluateAchievements: evaluateAchievements
  };

  root.ArmCore = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
