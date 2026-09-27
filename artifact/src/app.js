/*
 * armguesser — artifact edition.
 * A self-contained variant of the game for claude.ai artifacts, where external map
 * tiles are blocked: the basemap is drawn from bundled vector data (window.ARM_GEO)
 * and each round names a place for the player to pin, instead of showing imagery.
 * Depends on Leaflet (L), ARM_LOCATIONS (locations.js) and ArmCore (core.js).
 */
(function () {
  'use strict';

  var Core = window.ArmCore;
  var LOCATIONS = window.ARM_LOCATIONS;
  var GEO = window.ARM_GEO;

  var ROUND_SECONDS = 90;
  var HINT_FACTOR = 0.75;
  var ARMENIA_BOUNDS = [[38.84, 43.44], [41.30, 46.63]];
  var MAX_BOUNDS = [[37.9, 42.2], [42.2, 47.9]];

  // What each mode draws on the map to help the player.
  var AIDS = {
    easy:   { regions: true,  labels: true,  note: 'Easy: region borders and names are on the map.' },
    medium: { regions: true,  labels: false, note: 'Medium: region borders are on the map, without names.' },
    hard:   { regions: false, labels: false, note: 'Hard: blank map. Lake Sevan is your landmark.' },
    expert: { regions: false, labels: false, note: 'Expert: blank map and obscure places.' },
    mixed:  { regions: true,  labels: false, note: 'Mixed: region borders are on the map, without names.' },
    daily:  { regions: true,  labels: false, note: 'Daily: region borders are on the map, without names.' }
  };
  var MODE_CARDS = [
    { mode: 'easy',   stars: '★☆☆☆', desc: 'Famous landmarks and big cities. Region names on the map.' },
    { mode: 'medium', stars: '★★☆☆', desc: 'Towns and notable sites in every region. Borders shown.' },
    { mode: 'hard',   stars: '★★★☆', desc: 'Smaller towns and lesser-known monasteries. Blank map.' },
    { mode: 'expert', stars: '★★★★', desc: 'Remote villages and obscure sites. Blank map.' },
    { mode: 'mixed',  stars: '◆◆◆◆', desc: 'Every place in the database. Borders shown.' }
  ];
  var COUNTRY_LABELS = [
    { name: 'Georgia', at: [41.55, 44.3] },
    { name: 'Azerbaijan', at: [40.95, 46.6] },
    { name: 'Türkiye', at: [40.2, 42.95] },
    { name: 'Iran', at: [38.55, 46.0] },
    { name: 'Nakhchivan (AZ)', at: [39.25, 45.3] }
  ];

  /* ------------------------------------------------------------- storage */
  var store = {
    get: function (key, fallback) {
      try {
        var v = localStorage.getItem('armg.' + key);
        return v == null ? fallback : JSON.parse(v);
      } catch (e) { return fallback; }
    },
    set: function (key, value) {
      try { localStorage.setItem('armg.' + key, JSON.stringify(value)); } catch (e) { /* storage unavailable */ }
    }
  };

  /* ------------------------------------------------------------- helpers */
  var $ = function (id) { return document.getElementById(id); };
  var fmt = function (n) { return Number(n).toLocaleString('en-US'); };
  var esc = function (s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var cap = function (s) { return s.charAt(0).toUpperCase() + s.slice(1); };
  var sum = function (rounds) { return rounds.reduce(function (s, r) { return s + r.points; }, 0); };

  function toast(msg) {
    var el = $('toast');
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toast.t);
    toast.t = setTimeout(function () { el.hidden = true; }, 2600);
  }

  function yesterdayKey(key) {
    var p = key.split('-').map(Number);
    return Core.dateKey(new Date(p[0], p[1] - 1, p[2] - 1));
  }

  // GeoJSON-style [lng, lat] nesting → Leaflet [lat, lng] nesting.
  function swap(c) { return typeof c[0] === 'number' ? [c[1], c[0]] : c.map(swap); }

  // Area-weighted centroid of the largest outer ring of a MultiPolygon.
  function centroid(multi) {
    var best = null, bestArea = 0;
    multi.forEach(function (poly) {
      var ring = poly[0], a = 0, cx = 0, cy = 0;
      for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        var f = ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
        a += f; cx += (ring[j][0] + ring[i][0]) * f; cy += (ring[j][1] + ring[i][1]) * f;
      }
      if (Math.abs(a) > bestArea) { bestArea = Math.abs(a); best = [cy / (3 * a), cx / (3 * a)]; }
    });
    return best;
  }

  /* --------------------------------------------------------------- sound */
  var ICON_ON = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9z" fill="currentColor"/><path d="M16 9a4 4 0 0 1 0 6M19 6a8 8 0 0 1 0 12"/></svg>';
  var ICON_OFF = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9z" fill="currentColor"/><path d="M17 9l5 6M22 9l-5 6"/></svg>';
  var Sound = {
    ctx: null,
    muted: store.get('muted', false),
    tone: function (freq, dur, type, delay) {
      if (this.muted) return;
      try {
        this.ctx = this.ctx || new (window.AudioContext || window.webkitAudioContext)();
        var t0 = this.ctx.currentTime + (delay || 0);
        var osc = this.ctx.createOscillator(), gain = this.ctx.createGain();
        osc.type = type || 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.exponentialRampToValueAtTime(0.16, t0 + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        osc.connect(gain).connect(this.ctx.destination);
        osc.start(t0);
        osc.stop(t0 + dur + 0.02);
      } catch (e) { /* no audio */ }
    },
    pin: function () { this.tone(660, 0.08, 'triangle'); },
    result: function (p) {
      if (p >= 4500) { this.tone(523, 0.12); this.tone(659, 0.12, 'sine', 0.1); this.tone(784, 0.25, 'sine', 0.2); }
      else if (p >= 2000) { this.tone(523, 0.12); this.tone(659, 0.2, 'sine', 0.1); }
      else this.tone(300, 0.25, 'sawtooth');
    },
    finish: function () { [523, 659, 784, 1047].forEach(function (f, i) { Sound.tone(f, 0.18, 'triangle', i * 0.12); }); },
    tick: function () { this.tone(880, 0.05, 'square'); }
  };

  /* --------------------------------------------------------------- state */
  var state = {
    screen: 'home',
    mode: 'medium',
    daily: null,
    locations: [],
    rounds: [],      // [{loc, guess, distance, points, hint}]
    index: 0,
    pending: null,   // L.LatLng of the unsubmitted pin
    hint: false,
    locked: false,
    timerId: null,
    timeLeft: ROUND_SECONDS,
    saved: false
  };
  var game = null;   // { map, regions, layer, pendingMarker }
  var trip = null;   // results map

  /* ---------------------------------------------------------------- maps */
  function label(map, at, text, cls) {
    L.marker(at, {
      interactive: false, keyboard: false,
      icon: L.divIcon({ className: 'map-label ' + cls, html: esc(text), iconSize: [140, 14], iconAnchor: [70, 7] })
    }).addTo(map);
  }

  function createMap(el, interactive) {
    var map = L.map(el, {
      zoomControl: interactive, zoomSnap: 0.25, zoomDelta: 0.5, maxZoom: 10,
      dragging: interactive, scrollWheelZoom: interactive, doubleClickZoom: interactive,
      touchZoom: interactive, boxZoom: false, keyboard: interactive,
      maxBounds: MAX_BOUNDS, maxBoundsViscosity: 0.8
    });
    map.attributionControl.setPrefix(false).addAttribution('Borders: Natural Earth');
    var opt = function (cls) { return { className: cls, interactive: false }; };
    GEO.neighbors.forEach(function (n) { L.polygon(swap(n.geom), opt('geo-neighbor')).addTo(map); });
    L.polygon(swap(GEO.armenia), opt('geo-land')).addTo(map);
    var regions = {};
    GEO.regions.forEach(function (r) { regions[r.name] = L.polygon(swap(r.geom), opt('geo-region')).addTo(map); });
    GEO.lakes.forEach(function (l) { L.polygon(swap(l), opt('geo-lake')).addTo(map); });
    COUNTRY_LABELS.forEach(function (c) { label(map, c.at, c.name, 'country'); });
    GEO.regions.forEach(function (r) { label(map, centroid(r.geom), r.name, 'region-name'); });
    map.fitBounds(ARMENIA_BOUNDS, { padding: [12, 12] });
    return { map: map, regions: regions, layer: L.layerGroup().addTo(map) };
  }

  function fitArmenia(m) {
    m.map.invalidateSize();
    m.map.setMinZoom(0);
    m.map.fitBounds(ARMENIA_BOUNDS, { padding: [12, 12], animate: false });
    m.map.setMinZoom(m.map.getZoom() - 0.5);
  }

  function pinIcon(cls) {
    return L.divIcon({ className: 'pin ' + cls, html: '<i></i>', iconSize: [26, 26], iconAnchor: [13, 30] });
  }

  function lightRegion(m, name, on) {
    var layer = m.regions[name];
    var el = layer && layer.getElement();
    if (el) el.classList.toggle('lit', on);
  }

  function setMapLocked(locked) {
    var map = game.map;
    ['dragging', 'touchZoom', 'doubleClickZoom', 'scrollWheelZoom', 'keyboard'].forEach(function (h) {
      if (map[h]) map[h][locked ? 'disable' : 'enable']();
    });
    var zc = map.getContainer().querySelector('.leaflet-control-zoom');
    if (zc) zc.hidden = locked;
    $('map-pane').classList.toggle('locked', locked);
  }

  /* ----------------------------------------------------------- hero map */
  function drawHero() {
    var svg = $('hero-map');
    var W = 460, S = 182, cos = Math.cos(40.1 * Math.PI / 180);
    var x = function (lng) { return (lng - 43.36) * cos * S; };
    var y = function (lat) { return (41.36 - lat) * S; };
    var path = function (multi) {
      return multi.map(function (poly) {
        return poly.map(function (ring) {
          return 'M' + ring.map(function (p) { return x(p[0]).toFixed(1) + ' ' + y(p[1]).toFixed(1); }).join('L') + 'Z';
        }).join('');
      }).join('');
    };
    var H = Math.ceil(y(38.78));
    // Example round: a guess near Ijevan for Dilijan.
    var answer = { lat: 40.7408, lng: 44.8636 }, guess = { lat: 40.80, lng: 45.00 };
    var km = Core.formatDistance(Core.haversineKm(guess, answer));
    var ax = x(answer.lng), ay = y(answer.lat), gx = x(guess.lng), gy = y(guess.lat);
    var mx = (ax + gx) / 2, my = (ay + gy) / 2 - 22;
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.innerHTML =
      '<path class="land" fill-rule="evenodd" d="' + path(GEO.armenia) + '"/>' +
      GEO.regions.map(function (r) { return '<path class="region" d="' + path(r.geom) + '"/>'; }).join('') +
      GEO.lakes.filter(function (l) {  // only lakes inside Armenia (Sevan), not Van or Urmia
        var c = centroid(l);
        return c[0] > ARMENIA_BOUNDS[0][0] && c[0] < ARMENIA_BOUNDS[1][0] && c[1] > ARMENIA_BOUNDS[0][1] && c[1] < ARMENIA_BOUNDS[1][1];
      }).map(function (l) { return '<path class="lake" d="' + path(l) + '"/>'; }).join('') +
      '<line class="trail" x1="' + gx + '" y1="' + gy + '" x2="' + ax + '" y2="' + ay + '"/>' +
      '<circle cx="' + gx + '" cy="' + gy + '" r="7" fill="#0033A0" stroke="#fff" stroke-width="2.5"/>' +
      '<circle cx="' + ax + '" cy="' + ay + '" r="7" fill="#15803D" stroke="#fff" stroke-width="2.5"/>' +
      '<rect class="km-bg" x="' + (mx - 26) + '" y="' + (my - 12) + '" width="52" height="22" rx="11"/>' +
      '<text class="km" x="' + mx + '" y="' + (my + 4) + '" text-anchor="middle">' + km + '</text>';
  }

  /* ------------------------------------------------------------- screens */
  function show(name) {
    state.screen = name;
    ['home', 'game', 'results', 'about'].forEach(function (s) { $('screen-' + s).hidden = s !== name; });
    var pill = $('mode-pill');
    pill.hidden = name === 'home';
    pill.textContent = name === 'about' ? 'About'
      : state.daily ? 'Daily · ' + state.daily : Core.MODES[state.mode].label;
  }

  function renderHome() {
    stopTimer();
    show('home');
    $('screen-home').scrollTop = 0;
    var today = Core.dateKey();
    var daily = store.get('daily', {});
    var done = daily.scores && daily.scores[today];
    $('daily-status').textContent = done != null
      ? 'Done today: ' + fmt(done) + ' points. New places tomorrow.'
      : 'The same five places for everyone today.';
    $('daily-btn').textContent = done != null ? 'Replay for practice' : 'Play today’s five';
    renderStreak();
    var stats = store.get('stats', {});
    $('home-foot').textContent = stats.gamesPlayed
      ? stats.gamesPlayed + ' game' + (stats.gamesPlayed === 1 ? '' : 's') + ' played in this browser · best ' + fmt(stats.bestScore || 0)
      : '';
    $('timer-toggle').checked = store.get('timed', false);
  }

  function renderModes() {
    $('db-count').textContent = LOCATIONS.length + ' places in all 11 regions';
    $('modes').innerHTML = MODE_CARDS.map(function (c) {
      var pool = Core.MODES[c.mode].pool;
      var n = LOCATIONS.filter(function (l) { return pool.indexOf(l.difficulty) !== -1; }).length;
      return '<button class="mode" type="button" data-mode="' + c.mode + '">' +
        '<span class="stars" aria-hidden="true">' + c.stars + '</span>' +
        '<span class="name">' + Core.MODES[c.mode].label + '</span>' +
        '<span class="desc">' + esc(c.desc) + '</span>' +
        '<span class="meta">' + n + ' places</span></button>';
    }).join('');
  }

  function renderStreak() {
    var daily = store.get('daily', {});
    var today = Core.dateKey();
    var alive = daily.streak > 0 && (daily.last === today || daily.last === yesterdayKey(today));
    $('streak').hidden = !alive;
    if (alive) $('streak').textContent = daily.streak + '-day streak';
  }

  /* ----------------------------------------------------------- game flow */
  function startGame(mode, restore) {
    state.mode = mode;
    state.daily = restore ? restore.daily : (mode === 'daily' ? Core.dateKey() : null);
    state.rounds = [];
    state.index = 0;
    state.saved = false;
    state.locations = restore
      ? restore.ids.map(function (id) { return LOCATIONS.filter(function (l) { return l.id === id; })[0]; }).filter(Boolean)
      : Core.pickLocations(LOCATIONS, mode, { recent: store.get('recent', []), date: state.daily });

    show('game');
    if (!game) {
      game = createMap($('guess-map'), true);
      game.map.on('click', function (e) { placePin(e.latlng); });
    }
    var aids = AIDS[mode] || AIDS.medium;
    var el = game.map.getContainer();
    el.classList.toggle('no-regions', !aids.regions);
    el.classList.toggle('no-region-labels', !aids.labels);
    $('aid-note').textContent = aids.note;
    $('st-timer-wrap').hidden = !store.get('timed', false);
    $('st-total').textContent = '0';
    $('st-last').textContent = '—';

    if (restore) {
      restore.rounds.forEach(function (r) {
        var loc = state.locations.filter(function (l) { return l.id === r.id; })[0];
        if (loc) state.rounds.push({ loc: loc, guess: r.guess, distance: r.distance, points: r.points, hint: r.hint });
      });
      state.index = Math.min(state.rounds.length, state.locations.length - 1);
      $('st-total').textContent = fmt(sum(state.rounds));
      if (state.rounds.length >= state.locations.length) { finishGame(true); return; }
    }
    startRound();
  }

  function startRound() {
    var loc = state.locations[state.index];
    state.pending = null;
    state.hint = false;
    state.locked = false;

    $('find-view').hidden = false;
    $('result-view').hidden = true;
    $('round-eyebrow').textContent = 'Round ' + (state.index + 1) + ' of ' + state.locations.length + ' · Find';
    $('target-name').textContent = loc.name;
    $('target-hy').textContent = loc.hy;
    $('target-tr').textContent = loc.translit;
    $('target-cat').textContent = loc.category;
    $('hint-chip').hidden = true;
    $('hint-btn').disabled = false;
    $('st-round').textContent = (state.index + 1) + ' / ' + state.locations.length;
    $('guess-btn').disabled = true;
    $('guess-btn').textContent = 'Drop a pin on the map';

    game.layer.clearLayers();
    game.pendingMarker = null;
    Object.keys(game.regions).forEach(function (n) { lightRegion(game, n, false); });
    setMapLocked(false);
    fitArmenia(game);
    renderDots();
    startTimer();
  }

  function placePin(latlng) {
    if (state.locked || state.screen !== 'game') return;
    state.pending = latlng;
    if (game.pendingMarker) game.pendingMarker.setLatLng(latlng);
    else game.pendingMarker = L.marker(latlng, { icon: pinIcon('pin-guess'), keyboard: false, interactive: false }).addTo(game.layer);
    $('guess-btn').disabled = false;
    $('guess-btn').textContent = 'Guess';
    Sound.pin();
  }

  function useHint() {
    if (state.locked || state.hint) return;
    var loc = state.locations[state.index];
    state.hint = true;
    lightRegion(game, loc.region, true);
    $('hint-chip').textContent = loc.region;
    $('hint-chip').hidden = false;
    $('hint-btn').disabled = true;
  }

  function submitGuess(timedOut) {
    if (state.locked || (!state.pending && !timedOut)) return;
    state.locked = true;
    stopTimer();

    var loc = state.locations[state.index];
    var answer = L.latLng(loc.lat, loc.lng);
    var guess = state.pending;
    var distance = guess ? Core.haversineKm({ lat: guess.lat, lng: guess.lng }, loc) : null;
    var points = guess ? Math.round(Core.scoreForDistance(distance) * (state.hint ? HINT_FACTOR : 1)) : 0;
    state.rounds.push({
      loc: loc, guess: guess ? { lat: guess.lat, lng: guess.lng } : null,
      distance: distance, points: points, hint: state.hint
    });

    // Reveal: blue = your pin, green = the answer, dashed line between, answer's region lit.
    game.layer.clearLayers();
    game.pendingMarker = null;
    lightRegion(game, loc.region, true);
    L.marker(answer, { icon: pinIcon('pin-answer'), keyboard: false, interactive: false }).addTo(game.layer);
    if (guess) {
      L.marker(guess, { icon: pinIcon('pin-mine'), keyboard: false, interactive: false }).addTo(game.layer);
      L.polyline([guess, answer], { className: 'trip-line', interactive: false })
        .bindTooltip(Core.formatDistance(distance), { permanent: true, direction: 'center', className: 'km-label' })
        .addTo(game.layer);
    }
    setMapLocked(true);

    $('st-last').textContent = fmt(points);
    $('st-total').textContent = fmt(sum(state.rounds));
    renderDots();
    showResult(loc, distance, points, !guess);

    // The card changes height on small screens, so re-measure the map before fitting.
    requestAnimationFrame(function () {
      game.map.invalidateSize();
      if (guess) game.map.fitBounds(L.latLngBounds([guess, answer]), { padding: [48, 48], maxZoom: 9 });
      else game.map.setView(answer, 9);
    });
    Sound.result(points);
  }

  function showResult(loc, distance, points, noGuess) {
    $('find-view').hidden = true;
    $('result-view').hidden = false;
    $('res-name').textContent = loc.name;
    $('res-dist').textContent = noGuess
      ? 'Time ran out before you dropped a pin.'
      : 'Your pin was ' + Core.formatDistance(distance) + ' away' + (state.hint ? ' (region hint used, −25%).' : '.');
    $('res-fact').textContent = loc.fact;
    var rows = [
      ['Armenian', loc.hy],
      ['Region', loc.region],
      ['Type', cap(loc.category)],
      ['Difficulty', '★★★★'.slice(0, loc.difficulty) + '☆☆☆☆'.slice(0, 4 - loc.difficulty)],
      ['Coordinates', loc.lat.toFixed(4) + '° N, ' + loc.lng.toFixed(4) + '° E']
    ];
    if (loc.population) rows.splice(3, 0, ['Population', '≈ ' + fmt(loc.population)]);
    $('res-dl').innerHTML = rows.map(function (r) {
      return '<dt>' + esc(r[0]) + '</dt><dd' + (r[0] === 'Armenian' ? ' class="hy" lang="hy"' : '') + '>' + esc(r[1]) + '</dd>';
    }).join('');
    $('result-view').querySelector('details').open = false;
    $('next-btn').textContent = state.index === state.locations.length - 1 ? 'See your results →' : 'Next round →';
    countUp($('res-points'), points);
    var bar = $('res-bar');
    bar.style.width = '0';
    requestAnimationFrame(function () { requestAnimationFrame(function () { bar.style.width = (points / Core.MAX_POINTS * 100) + '%'; }); });
    $('round-card').scrollTop = 0;
    $('next-btn').focus({ preventScroll: true });
  }

  function countUp(el, target) {
    if (target === 0 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) { el.textContent = fmt(target); return; }
    var t0 = performance.now();
    (function frame(now) {
      var t = Math.min(1, (now - t0) / 700);
      el.textContent = fmt(Math.round(target * (1 - Math.pow(1 - t, 3))));
      if (t < 1) requestAnimationFrame(frame);
    })(t0);
  }

  function nextRound() {
    if (!state.locked) return;
    if (state.index < state.locations.length - 1) { state.index++; startRound(); }
    else finishGame(false);
  }

  function renderDots() {
    var html = '';
    for (var i = 0; i < state.locations.length; i++) {
      var r = state.rounds[i], cls = '';
      if (r) cls = r.points >= 4500 ? 'g' : r.points >= 3500 ? 'y' : r.points >= 2000 ? 'o' : 'r';
      else if (i === state.index) cls = 'now';
      html += '<span class="' + cls + '"></span>';
    }
    $('dots').innerHTML = html;
  }

  /* --------------------------------------------------------------- timer */
  function startTimer() {
    stopTimer();
    if (!store.get('timed', false)) return;
    state.timeLeft = ROUND_SECONDS;
    renderTimer();
    state.timerId = setInterval(function () {
      state.timeLeft--;
      renderTimer();
      if (state.timeLeft > 0 && state.timeLeft <= 10) Sound.tick();
      if (state.timeLeft <= 0) submitGuess(true);
    }, 1000);
  }
  function stopTimer() { clearInterval(state.timerId); state.timerId = null; }
  function renderTimer() {
    $('st-timer').textContent = state.timeLeft;
    $('st-timer').classList.toggle('low', state.timeLeft <= 10);
  }

  /* ------------------------------------------------------------- results */
  function finishGame(restored) {
    stopTimer();
    var stats = Core.computeStats(state.rounds);
    var fresh = [];
    var firstDaily = false;

    if (!restored) {
      var today = Core.dateKey();
      var progress = store.get('stats', { gamesPlayed: 0, bestScore: 0, modesCompleted: [] });
      progress.gamesPlayed = (progress.gamesPlayed || 0) + 1;
      progress.bestScore = Math.max(progress.bestScore || 0, stats.total);
      progress.modesCompleted = progress.modesCompleted || [];
      if (progress.modesCompleted.indexOf(state.mode) === -1) progress.modesCompleted.push(state.mode);
      store.set('stats', progress);

      var recent = store.get('recent', []);
      state.locations.forEach(function (l) { if (recent.indexOf(l.id) === -1) recent.push(l.id); });
      store.set('recent', recent.slice(-30));

      var daily = store.get('daily', { streak: 0, scores: {} });
      daily.scores = daily.scores || {};
      if (state.daily && daily.scores[state.daily] == null) {
        firstDaily = true;
        daily.streak = daily.last === yesterdayKey(state.daily) ? (daily.streak || 0) + 1 : 1;
        daily.last = state.daily;
        daily.scores[state.daily] = stats.total;
        store.set('daily', daily);
      }

      var unlocked = store.get('achievements', {});
      var earned = Core.evaluateAchievements({ mode: state.mode, rounds: state.rounds }, {
        gamesPlayed: progress.gamesPlayed,
        modesCompleted: progress.modesCompleted,
        dailyStreak: daily.last === today || daily.last === yesterdayKey(today) ? daily.streak : 0
      });
      fresh = earned.filter(function (id) { return !unlocked[id]; });
      fresh.forEach(function (id) { unlocked[id] = today; });
      store.set('achievements', unlocked);
      Sound.finish();
    }
    renderResults(stats, fresh, firstDaily);
  }

  function renderResults(stats, freshBadges, firstDaily) {
    show('results');
    $('screen-results').scrollTop = 0;
    var rank = Core.rankFor(stats.total);
    $('final-kicker').textContent = state.daily
      ? 'Daily challenge · ' + state.daily + (firstDaily ? '' : ' · practice')
      : Core.MODES[state.mode].label + ' · final score';
    $('final-score').innerHTML = fmt(stats.total) + '<small> / ' + fmt(stats.max) + '</small>';
    $('final-rank').textContent = rank.title;
    $('final-squares').textContent = state.rounds.map(function (r) { return Core.emojiFor(r.points); }).join('');
    $('s-acc').textContent = stats.accuracy + '%';
    $('s-avg').textContent = Core.formatDistance(stats.averageDistance);
    $('s-best').textContent = 'Round ' + (stats.bestRound + 1) + ' · ' + fmt(state.rounds[stats.bestRound].points);
    $('s-worst').textContent = 'Round ' + (stats.worstRound + 1) + ' · ' + fmt(state.rounds[stats.worstRound].points);

    $('rounds-body').innerHTML = state.rounds.map(function (r, i) {
      var tags = (i === stats.bestRound ? '<span class="tag tag-best">best</span>' : '') +
        (i === stats.worstRound && stats.worstRound !== stats.bestRound ? '<span class="tag tag-worst">worst</span>' : '') +
        (r.hint ? '<span class="tag tag-hint">hint</span>' : '');
      return '<tr><td>' + (i + 1) + '</td><td>' + esc(r.loc.name) + tags + '</td><td>' + esc(r.loc.region) +
        '</td><td class="num">' + Core.formatDistance(r.distance) + '</td><td class="num">' + fmt(r.points) + '</td></tr>';
    }).join('');

    $('badges-new').hidden = !freshBadges.length;
    $('badges-new-list').innerHTML = freshBadges.map(function (id) {
      var a = Core.ACHIEVEMENTS.filter(function (x) { return x.id === id; })[0];
      return '<li title="' + esc(a.desc) + '">' + a.icon + ' ' + esc(a.title) + '</li>';
    }).join('');

    $('save-btn').disabled = false;
    $('player-name').value = store.get('playerName', '');
    drawTrip();
    $('final-score').focus({ preventScroll: true });
  }

  function drawTrip() {
    if (!trip) trip = createMap($('trip-map'), true);
    trip.map.getContainer().classList.add('no-region-labels');
    trip.layer.clearLayers();
    var pts = [];
    state.rounds.forEach(function (r, i) {
      var a = L.latLng(r.loc.lat, r.loc.lng);
      pts.push(a);
      if (r.guess) {
        pts.push(L.latLng(r.guess.lat, r.guess.lng));
        L.polyline([r.guess, a], { className: 'trip-line', interactive: false }).addTo(trip.layer);
        L.marker(r.guess, { icon: L.divIcon({ className: '', html: '<div class="dot-pin"></div>', iconSize: [14, 14], iconAnchor: [7, 7] }), keyboard: false, interactive: false }).addTo(trip.layer);
      }
      L.marker(a, {
        title: r.loc.name, keyboard: false,
        icon: L.divIcon({ className: '', html: '<div class="num-pin">' + (i + 1) + '</div>', iconSize: [24, 24], iconAnchor: [12, 12] })
      }).bindTooltip(esc(r.loc.name)).addTo(trip.layer);
    });
    requestAnimationFrame(function () {
      trip.map.invalidateSize();
      trip.map.setMinZoom(0);
      trip.map.fitBounds(L.latLngBounds(pts).pad(0.15), { maxZoom: 9, animate: false });
    });
  }

  function saveScore(e) {
    e.preventDefault();
    if (state.saved) return;
    var name = $('player-name').value.trim().slice(0, 16);
    if (!name) return;
    var board = store.get('leaderboard', []);
    board.push({ name: name, score: sum(state.rounds), mode: state.mode, date: Core.dateKey() });
    var kept = [];
    Object.keys(Core.MODES).forEach(function (m) {
      kept = kept.concat(board.filter(function (x) { return x.mode === m; })
        .sort(function (a, b) { return b.score - a.score; }).slice(0, 10));
    });
    store.set('leaderboard', kept);
    store.set('playerName', name);
    state.saved = true;
    $('save-btn').disabled = true;
    toast('Saved to the ' + Core.MODES[state.mode].label + ' leaderboard');
  }

  function shareScore() {
    var text = Core.shareText({ mode: state.mode, date: state.daily, rounds: state.rounds, total: sum(state.rounds) });
    var fallback = function () {
      $('share-text').value = text;
      $('share-dialog').showModal();
      $('share-text').select();
    };
    try {
      navigator.clipboard.writeText(text).then(function () { toast('Score card copied'); }, fallback);
    } catch (err) { fallback(); }
  }

  /* --------------------------------------------------------------- about */
  // Every number on the About screen comes from the game data, so it can't drift from the rules.
  function renderAbout() {
    stopTimer();
    show('about');
    $('screen-about').scrollTop = 0;
    var REGIONS = ['Yerevan', 'Aragatsotn', 'Ararat', 'Armavir', 'Gegharkunik', 'Kotayk',
      'Lori', 'Shirak', 'Syunik', 'Tavush', 'Vayots Dzor'];
    var stars = function (n) { return '★★★★'.slice(0, n); };

    $('a-facts').innerHTML = [
      [LOCATIONS.length, 'places'], [REGIONS.length, 'regions'],
      [Core.ROUNDS, 'rounds per game'], [fmt(Core.ROUNDS * Core.MAX_POINTS), 'points max']
    ].map(function (f) { return '<div><dt>' + f[1] + '</dt><dd>' + f[0] + '</dd></div>'; }).join('');

    $('a-scores').innerHTML = [0, 1, 10, 25, 50, 100, 200, 300, 400].map(function (km) {
      var p = Core.scoreForDistance(km);
      var label = km === 0 ? 'Right on it' : km === 400 ? '400 km or more' : Core.formatDistance(km);
      return '<tr><td>' + label + '</td><td class="num">' + fmt(p) + '</td><td class="num">' +
        fmt(Math.round(p * HINT_FACTOR)) + '</td><td>' + Core.emojiFor(p) + '</td></tr>';
    }).join('');

    $('a-ranks').innerHTML = Core.RANKS.map(function (r) {
      return '<tr><td>' + esc(r.title) + '</td><td class="num">' + (r.min ? fmt(r.min) + '+' : 'Any score') + '</td></tr>';
    }).join('');

    var MAP_TEXT = { easy: 'Region borders and names', medium: 'Region borders', hard: 'Blank', expert: 'Blank', mixed: 'Region borders', daily: 'Region borders' };
    $('a-modes').innerHTML = ['easy', 'medium', 'hard', 'expert', 'mixed', 'daily'].map(function (m) {
      var cfg = Core.MODES[m];
      var pool = LOCATIONS.filter(function (l) { return cfg.pool.indexOf(l.difficulty) !== -1; }).length;
      var from = cfg.pool.length === 4 ? 'All ratings' : cfg.pool.map(stars).join(' and ');
      return '<tr><td>' + cfg.label + '</td><td>' + from + '</td><td class="num">' + pool + '</td><td>' + MAP_TEXT[m] + '</td></tr>';
    }).join('');

    $('a-places-intro').textContent = 'There are ' + LOCATIONS.length + ' places across Yerevan and all ten provinces (marzer). ' +
      'Here is how they are spread out. Their names stay off this page so the game stays a guessing game.';
    var totals = [0, 0, 0, 0];
    $('a-regions').innerHTML = REGIONS.map(function (r) {
      var inRegion = LOCATIONS.filter(function (l) { return l.region === r; });
      return '<tr><td>' + r + '</td>' + [1, 2, 3, 4].map(function (d) {
        var n = inRegion.filter(function (l) { return l.difficulty === d; }).length;
        totals[d - 1] += n;
        return '<td class="num">' + (n || '–') + '</td>';
      }).join('') + '<td class="num"><b>' + inRegion.length + '</b></td></tr>';
    }).join('') + '<tr class="total-row"><td>Total</td>' +
      totals.map(function (n) { return '<td class="num">' + n + '</td>'; }).join('') + '<td class="num">' + LOCATIONS.length + '</td></tr>';

    var cats = {};
    LOCATIONS.forEach(function (l) { cats[l.category] = (cats[l.category] || 0) + 1; });
    $('a-cats').innerHTML = Object.keys(cats).sort(function (a, b) { return cats[b] - cats[a]; }).map(function (c) {
      return '<li>' + esc(cap(c)) + '<span>' + cats[c] + '</span></li>';
    }).join('');

    var unlocked = store.get('achievements', {});
    $('a-ach').innerHTML = Core.ACHIEVEMENTS.map(function (a) {
      var got = unlocked[a.id];
      return '<li class="' + (got ? '' : 'locked') + '"><span class="ic" aria-hidden="true">' + a.icon + '</span><div><strong>' +
        esc(a.title) + (got ? ' · unlocked' : '') + '</strong>' + (got ? '' : '<span class="sr-only"> (locked)</span>') +
        '<small>' + esc(a.desc) + '</small></div></li>';
    }).join('');
    $('about-title').focus({ preventScroll: true });
  }

  /* ------------------------------------------------------------- dialogs */
  function openBoard(mode) {
    mode = mode || (state.screen === 'home' ? 'medium' : state.mode);
    $('board-tabs').innerHTML = Object.keys(Core.MODES).map(function (m) {
      return '<button type="button" role="tab" data-mode="' + m + '" aria-selected="' + (m === mode) + '">' + Core.MODES[m].label + '</button>';
    }).join('');
    var rows = store.get('leaderboard', []).filter(function (x) { return x.mode === mode; })
      .sort(function (a, b) { return b.score - a.score; });
    $('board-list').innerHTML = rows.length
      ? rows.map(function (r) { return '<li>' + esc(r.name) + '<span class="d">' + esc(r.date) + '</span><span class="s">' + fmt(r.score) + '</span></li>'; }).join('')
      : '<li class="muted" style="list-style:none;margin-left:-1.6rem">No scores yet. Finish a game and save yours.</li>';
    if (!$('board-dialog').open) $('board-dialog').showModal();
  }

  function openAchievements() {
    var unlocked = store.get('achievements', {});
    $('ach-list').innerHTML = Core.ACHIEVEMENTS.map(function (a) {
      var got = unlocked[a.id];
      return '<li class="' + (got ? '' : 'locked') + '"><span class="ic" aria-hidden="true">' + a.icon + '</span><div><strong>' +
        esc(a.title) + '</strong>' + (got ? '' : '<span class="sr-only"> (locked)</span>') +
        '<small>' + esc(a.desc) + (got ? ' Unlocked ' + esc(got) + '.' : '') + '</small></div></li>';
    }).join('');
    $('ach-dialog').showModal();
  }

  function renderSound() {
    var b = $('sound-btn');
    b.innerHTML = Sound.muted ? ICON_OFF : ICON_ON;
    b.setAttribute('aria-pressed', String(!Sound.muted));
    b.setAttribute('aria-label', Sound.muted ? 'Sound off' : 'Sound on');
  }

  function goHome() {
    var mid = state.screen === 'game' && (state.rounds.length > 0 || state.pending);
    if (mid) $('leave-dialog').showModal();
    else renderHome();
  }

  /* -------------------------------------------------------------- wiring */
  function bind() {
    $('modes').addEventListener('click', function (e) {
      var b = e.target.closest('[data-mode]');
      if (b) startGame(b.dataset.mode);
    });
    $('daily-btn').addEventListener('click', function () { startGame('daily'); });
    $('guess-btn').addEventListener('click', function () { submitGuess(false); });
    $('hint-btn').addEventListener('click', useHint);
    $('next-btn').addEventListener('click', nextRound);
    $('pin-center-btn').addEventListener('click', function () { placePin(game.map.getCenter()); });
    $('again-btn').addEventListener('click', function () { startGame(state.mode === 'daily' ? 'daily' : state.mode); });
    $('home-btn').addEventListener('click', renderHome);
    $('logo-btn').addEventListener('click', goHome);
    $('leave-confirm').addEventListener('click', function () { $('leave-dialog').close(); renderHome(); });
    $('save-form').addEventListener('submit', saveScore);
    $('share-btn').addEventListener('click', shareScore);
    $('help-btn').addEventListener('click', function () { $('help-dialog').showModal(); });
    $('board-btn').addEventListener('click', function () { openBoard(); });
    $('board-tabs').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-mode]');
      if (b) openBoard(b.dataset.mode);
    });
    $('ach-btn').addEventListener('click', openAchievements);
    $('about-btn').addEventListener('click', renderAbout);
    $('about-play').addEventListener('click', renderHome);
    $('help-about').addEventListener('click', function () { $('help-dialog').close(); goHome(); if (state.screen === 'home') renderAbout(); });
    $('timer-toggle').addEventListener('change', function (e) { store.set('timed', e.target.checked); });
    $('sound-btn').addEventListener('click', function () {
      Sound.muted = !Sound.muted;
      store.set('muted', Sound.muted);
      renderSound();
    });
    document.querySelectorAll('[data-close]').forEach(function (b) {
      b.addEventListener('click', function () { b.closest('dialog').close(); });
    });

    document.addEventListener('keydown', function (e) {
      if (state.screen !== 'game' || document.querySelector('dialog[open]')) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      var tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;
      var onControl = tag === 'button' || tag === 'summary';
      var k = e.key.toLowerCase();
      if (!state.locked) {
        if (k === 'g') { placePin(game.map.getCenter()); e.preventDefault(); }
        else if (k === 'h') { useHint(); e.preventDefault(); }
        else if ((k === ' ' || k === 'enter') && !onControl && state.pending) { submitGuess(false); e.preventDefault(); }
      } else if (k === 'n') { nextRound(); e.preventDefault(); }
    });

    window.addEventListener('resize', function () {
      if (game) game.map.invalidateSize();
      if (trip) trip.map.invalidateSize();
    });
  }

  // Keep an in-progress game when a new version of the page is delivered to an open view.
  function snapshot() {
    if (state.screen === 'home' || state.screen === 'about') return {};
    return {
      screen: state.screen, mode: state.mode, daily: state.daily,
      ids: state.locations.map(function (l) { return l.id; }),
      rounds: state.rounds.map(function (r) {
        return { id: r.loc.id, guess: r.guess, distance: r.distance, points: r.points, hint: r.hint };
      })
    };
  }

  function start(data) {
    if (!window.L) {
      $('screen-home').innerHTML = '<div class="wrap"><p>The map library didn’t load. Check your connection and reload the page.</p></div>';
      return;
    }
    drawHero();
    renderModes();
    renderSound();
    bind();
    renderHome();
    if (data && data.ids && data.ids.length) startGame(data.mode, data);
  }

  try { if (window.claude && window.claude.hot && window.claude.hot.snapshot) window.claude.hot.snapshot(snapshot); } catch (e) { /* not available */ }
  if (window.claude && window.claude.hot && window.claude.hot.ready) window.claude.hot.ready(start);
  else start((window.claude && window.claude.hot && window.claude.hot.data) || {});
})();
