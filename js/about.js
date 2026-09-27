/*
 * About page: renders the rules tables from the game's own data (locations.js, core.js)
 * so the numbers here always match the game.
 */
(function () {
  'use strict';

  var Core = window.ArmCore;
  var LOCATIONS = window.ARM_LOCATIONS;
  var $ = function (id) { return document.getElementById(id); };
  var fmt = function (n) { return Number(n).toLocaleString('en-US'); };
  var esc = function (s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var stars = function (n) { return '★★★★'.slice(0, n); };
  var REGIONS = ['Yerevan', 'Aragatsotn', 'Ararat', 'Armavir', 'Gegharkunik', 'Kotayk',
    'Lori', 'Shirak', 'Syunik', 'Tavush', 'Vayots Dzor'];

  // Headline facts
  var regionCount = REGIONS.filter(function (r) { return LOCATIONS.some(function (l) { return l.region === r; }); }).length;
  $('about-facts').innerHTML = [
    [LOCATIONS.length, 'places'],
    [regionCount, 'regions'],
    [Core.ROUNDS, 'rounds per game'],
    [fmt(Core.ROUNDS * Core.MAX_POINTS), 'points max']
  ].map(function (f) { return '<div><dt>' + f[1] + '</dt><dd>' + f[0] + '</dd></div>'; }).join('');

  // Scoring examples
  $('score-examples').innerHTML = [0, 1, 10, 25, 50, 100, 200, 300, 400].map(function (km) {
    var p = Core.scoreForDistance(km);
    var label = km === 0 ? 'Right on it' : km === 400 ? '400 km or more' : Core.formatDistance(km);
    return '<tr><td>' + label + '</td><td class="num">' + fmt(p) + '</td><td>' + Core.emojiFor(p) + '</td></tr>';
  }).join('');

  $('rank-rows').innerHTML = Core.RANKS.map(function (r) {
    return '<tr><td>' + r.emoji + ' ' + esc(r.title) + '</td><td class="num">' + (r.min ? fmt(r.min) + '+' : 'any') + '</td></tr>';
  }).join('');

  // Difficulty modes
  var MODE_ORDER = ['easy', 'medium', 'hard', 'expert', 'mixed', 'daily'];
  $('mode-rows').innerHTML = MODE_ORDER.map(function (m) {
    var cfg = Core.MODES[m];
    var pool = LOCATIONS.filter(function (l) { return cfg.pool.indexOf(l.difficulty) !== -1; }).length;
    var from = cfg.pool.length === 4 ? 'All ratings' : cfg.pool.map(stars).join(' and ');
    var v = cfg.view;
    var zoomWord = v.zoom >= 18 ? 'Close-up' : v.zoom >= 16 ? 'Street blocks' : 'Neighbourhood';
    return '<tr><td>' + cfg.label + '</td><td>' + from + '</td><td class="num">' + pool + '</td><td>' +
      zoomWord + ', pan up to ' + Core.formatDistance(v.radiusKm) + '</td></tr>';
  }).join('');

  // Places per region
  $('places-intro').textContent = 'The game has ' + LOCATIONS.length + ' places across Yerevan and all ten provinces (marzer): ' +
    'monasteries and fortresses, cities and villages, lakes and waterfalls. Here is how they are spread out. ' +
    'The names stay off this page so the game stays a guessing game.';
  var totals = [0, 0, 0, 0];
  $('region-rows').innerHTML = REGIONS.map(function (r) {
    var inRegion = LOCATIONS.filter(function (l) { return l.region === r; });
    var cells = [1, 2, 3, 4].map(function (d) {
      var n = inRegion.filter(function (l) { return l.difficulty === d; }).length;
      totals[d - 1] += n;
      return '<td class="num">' + (n || '–') + '</td>';
    }).join('');
    return '<tr><td>' + r + '</td>' + cells + '<td class="num"><strong>' + inRegion.length + '</strong></td></tr>';
  }).join('') + '<tr class="total-row"><td>Total</td>' + totals.map(function (n) { return '<td class="num">' + n + '</td>'; }).join('') +
    '<td class="num"><strong>' + LOCATIONS.length + '</strong></td></tr>';

  var cats = {};
  LOCATIONS.forEach(function (l) { cats[l.category] = (cats[l.category] || 0) + 1; });
  $('category-chips').innerHTML = Object.keys(cats).sort(function (a, b) { return cats[b] - cats[a]; }).map(function (c) {
    return '<li>' + esc(c.charAt(0).toUpperCase() + c.slice(1)) + ' <span>' + cats[c] + '</span></li>';
  }).join('');

  // Achievements, marked if this browser has unlocked them
  var unlocked = {};
  try { unlocked = JSON.parse(localStorage.getItem('armg.achievements')) || {}; } catch (e) { /* storage unavailable */ }
  $('achievement-list').innerHTML = Core.ACHIEVEMENTS.map(function (a) {
    var got = unlocked[a.id];
    return '<li class="' + (got ? '' : 'locked') + '"><span class="b-icon" aria-hidden="true">' + a.icon + '</span><div><strong>' +
      esc(a.title) + (got ? ' · unlocked' : '<span class="sr-only"> (locked)</span>') + '</strong><small>' + esc(a.desc) + '</small></div></li>';
  }).join('');

  // Theme toggle, shared with the game
  $('theme-btn').addEventListener('click', function () {
    var t = document.documentElement.getAttribute('data-theme');
    var dark = t ? t === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    var next = dark ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('armg.theme', next); } catch (e) { /* storage unavailable */ }
  });
})();
