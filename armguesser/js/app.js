/*
 * armguesser — UI, maps and game flow.
 * Depends on Leaflet (global L), ARM_LOCATIONS (locations.js) and ArmCore (core.js).
 */
(function () {
  'use strict';

  var Core = window.ArmCore;
  var LOCATIONS = window.ARM_LOCATIONS;
  var ROUND_SECONDS = 90;

  // Map extents: a little padding around Armenia for the guess map.
  var ARMENIA_CENTER = [40.15, 45.0];
  var ARMENIA_BOUNDS = [[38.6, 43.2], [41.5, 46.9]];

  var TILES = {
    satellite: {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      attribution: 'Imagery &copy; Esri, Maxar, Earthstar Geographics'
    },
    light: {
      url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
    },
    dark: {
      url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
    }
  };

  /* ------------------------------------------------------------ storage */
  // localStorage can throw (private mode, blocked cookies); never let that break the game.
  var store = {
    get: function (key, fallback) {
      try {
        var v = localStorage.getItem('armg.' + key);
        return v == null ? fallback : JSON.parse(v);
      } catch (e) { return fallback; }
    },
    set: function (key, value) {
      try { localStorage.setItem('armg.' + key, JSON.stringify(value)); } catch (e) { /* ignore */ }
    }
  };

  /* ------------------------------------------------------------ helpers */
  var $ = function (id) { return document.getElementById(id); };
  var fmt = function (n) { return Number(n).toLocaleString('en-US'); };

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function toast(msg) {
    var el = $('toast');
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { el.hidden = true; }, 2600);
  }

  function isDarkTheme() {
    var t = document.documentElement.getAttribute('data-theme');
    if (t) return t === 'dark';
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  function yesterdayKey(key) {
    var p = key.split('-').map(Number);
    return Core.dateKey(new Date(p[0], p[1] - 1, p[2] - 1));
  }

  function pinIcon(cls) {
    return L.divIcon({ className: 'pin ' + cls, html: '<span></span>', iconSize: [26, 26], iconAnchor: [13, 30] });
  }

  /* -------------------------------------------------------------- sound */
  var Sound = {
    ctx: null,
    muted: store.get('muted', false),
    tone: function (freq, dur, type, delay) {
      if (this.muted) return;
      try {
        this.ctx = this.ctx || new (window.AudioContext || window.webkitAudioContext)();
        var t0 = this.ctx.currentTime + (delay || 0);
        var osc = this.ctx.createOscillator();
        var gain = this.ctx.createGain();
        osc.type = type || 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.exponentialRampToValueAtTime(0.18, t0 + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        osc.connect(gain).connect(this.ctx.destination);
        osc.start(t0);
        osc.stop(t0 + dur + 0.02);
      } catch (e) { /* audio unsupported */ }
    },
    pin: function () { this.tone(660, 0.08, 'triangle'); },
    result: function (points) {
      if (points >= 4500) { this.tone(523, 0.12); this.tone(659, 0.12, 'sine', 0.1); this.tone(784, 0.25, 'sine', 0.2); }
      else if (points >= 2000) { this.tone(523, 0.12); this.tone(659, 0.2, 'sine', 0.1); }
      else { this.tone(300, 0.25, 'sawtooth'); }
    },
    finish: function () { [523, 659, 784, 1047].forEach(function (f, i) { Sound.tone(f, 0.18, 'triangle', i * 0.12); }); },
    tick: function () { this.tone(880, 0.05, 'square'); }
  };

  /* -------------------------------------------------------------- state */
  var state = {
    mode: 'medium',
    daily: null,          // date key when playing the daily challenge
    locations: [],
    rounds: [],           // [{loc, guess, distance, points}]
    index: 0,
    pending: null,        // L.LatLng of the unsubmitted guess
    locked: false,
    timerId: null,
    timeLeft: ROUND_SECONDS,
    saved: false
  };

  var viewMap, guessMap, guessTiles;
  var guessLayer;          // markers & line on the guess map
  var pendingMarker = null;
  var tileErrors = 0;

  /* ---------------------------------------------------------------- maps */
  function initMaps() {
    if (viewMap) return;

    viewMap = L.map('view-map', {
      zoomControl: true,
      attributionControl: true,
      maxZoom: 18,
      zoomSnap: 1
    });
    L.tileLayer(TILES.satellite.url, { attribution: TILES.satellite.attribution, maxZoom: 18 })
      .on('tileerror', onViewTileError)
      .addTo(viewMap);

    guessMap = L.map('guess-map', {
      center: ARMENIA_CENTER,
      zoom: 7,
      minZoom: 7,
      maxZoom: 16,
      maxBounds: ARMENIA_BOUNDS,
      maxBoundsViscosity: 0.8,
      keyboard: true
    });
    setGuessTiles();
    guessLayer = L.layerGroup().addTo(guessMap);
    guessMap.on('click', function (e) { placeGuess(e.latlng); });
  }

  function setGuessTiles() {
    if (!guessMap) return;
    var t = isDarkTheme() ? TILES.dark : TILES.light;
    if (guessTiles) guessMap.removeLayer(guessTiles);
    guessTiles = L.tileLayer(t.url, { attribution: t.attribution, subdomains: 'abcd', maxZoom: 19 }).addTo(guessMap);
  }

  function onViewTileError() {
    tileErrors++;
    // Imagery fallback: if tiles won't load, give a text description instead.
    if (tileErrors === 4 && state.locations[state.index]) {
      var loc = state.locations[state.index];
      showViewHint('Imagery unavailable — clue: a ' + loc.category + ' in ' + loc.region);
    }
  }

  function showViewHint(text) {
    var el = $('view-hint');
    el.textContent = text;
    el.hidden = !text;
  }

  function boundsAround(loc, km) {
    var dLat = km / 111;
    var dLng = km / (111 * Math.cos(loc.lat * Math.PI / 180));
    return L.latLngBounds([loc.lat - dLat, loc.lng - dLng], [loc.lat + dLat, loc.lng + dLng]);
  }

  function showLocationInView(loc) {
    var cfg = Core.MODES[state.mode].view;
    viewMap.invalidateSize();
    viewMap.setMaxBounds(null);
    viewMap.setMinZoom(cfg.minZoom);
    viewMap.setView([loc.lat, loc.lng], cfg.zoom, { animate: false });
    viewMap.setMaxBounds(boundsAround(loc, cfg.radiusKm));
  }

  function setGuessMapLocked(locked) {
    var handlers = ['dragging', 'touchZoom', 'doubleClickZoom', 'scrollWheelZoom', 'boxZoom', 'keyboard'];
    handlers.forEach(function (h) {
      if (guessMap[h]) guessMap[h][locked ? 'disable' : 'enable']();
    });
    guessMap.getContainer().querySelector('.leaflet-control-zoom').style.display = locked ? 'none' : '';
    document.querySelector('.pane-guess').classList.toggle('locked', locked);
  }

  /* ------------------------------------------------------------- screens */
  function showScreen(name) {
    ['home', 'game', 'results'].forEach(function (s) { $('screen-' + s).hidden = s !== name; });
    var badge = $('mode-badge');
    if (name === 'home') {
      badge.hidden = true;
    } else {
      badge.hidden = false;
      badge.dataset.mode = state.mode;
      badge.textContent = state.daily ? 'Daily · ' + state.daily : Core.MODES[state.mode].label;
    }
    window.scrollTo(0, 0);
  }

  function renderHome() {
    showScreen('home');
    stopTimer();
    var daily = store.get('daily', {});
    var today = Core.dateKey();
    var todayScore = daily.scores && daily.scores[today];
    if (todayScore != null) {
      $('daily-status').textContent = 'Done today: ' + fmt(todayScore) + ' pts. New places tomorrow!';
      $('daily-btn').textContent = 'Replay (practice)';
    } else {
      $('daily-status').textContent = 'The same five places for everyone today.';
      $('daily-btn').textContent = 'Play today’s';
    }
    renderStreak();
    var stats = store.get('stats', {});
    $('home-foot').textContent = LOCATIONS.length + ' locations across all 11 regions' +
      (stats.gamesPlayed ? ' · ' + stats.gamesPlayed + ' games played · best ' + fmt(stats.bestScore || 0) : '');
    $('timer-toggle').checked = store.get('timed', false);
  }

  function renderStreak() {
    var daily = store.get('daily', {});
    var today = Core.dateKey();
    var alive = daily.last === today || daily.last === yesterdayKey(today);
    var chip = $('streak-chip');
    if (alive && daily.streak > 0) {
      chip.hidden = false;
      chip.textContent = '🔥 ' + daily.streak;
      chip.title = 'Daily challenge streak: ' + daily.streak + ' day' + (daily.streak === 1 ? '' : 's');
    } else {
      chip.hidden = true;
    }
  }

  /* ----------------------------------------------------------- game flow */
  function startGame(mode) {
    state.mode = mode;
    state.daily = mode === 'daily' ? Core.dateKey() : null;
    state.rounds = [];
    state.index = 0;
    state.saved = false;
    state.locations = Core.pickLocations(LOCATIONS, mode, {
      recent: store.get('recent', []),
      date: state.daily
    });

    showScreen('game');
    initMaps();
    renderDots();
    $('total-score').textContent = '0';
    $('round-score').textContent = '—';
    $('timer-stat').hidden = !store.get('timed', false);
    startRound();
  }

  function startRound() {
    var loc = state.locations[state.index];
    state.pending = null;
    state.locked = false;
    tileErrors = 0;

    $('result-sheet').hidden = true;
    $('round-indicator').textContent = (state.index + 1) + ' / ' + state.locations.length;
    $('guess-btn').disabled = true;
    $('guess-btn').textContent = 'Place a pin on the map';

    guessLayer.clearLayers();
    pendingMarker = null;
    guessMap.invalidateSize();
    setGuessMapLocked(false);
    guessMap.setView(ARMENIA_CENTER, 7, { animate: false });

    showLocationInView(loc);
    // Easy mode gets a category hint; everything else plays blind.
    showViewHint(state.mode === 'easy' ? 'Hint: ' + loc.category : '');

    renderDots();
    startTimer();
  }

  function placeGuess(latlng) {
    if (state.locked) return;
    state.pending = latlng;
    if (pendingMarker) {
      pendingMarker.setLatLng(latlng);
    } else {
      pendingMarker = L.marker(latlng, { icon: pinIcon('pin-guess'), keyboard: false }).addTo(guessLayer);
    }
    $('guess-btn').disabled = false;
    $('guess-btn').textContent = 'Guess!';
    Sound.pin();
  }

  function submitGuess(timedOut) {
    if (state.locked) return;
    if (!state.pending && !timedOut) return;
    state.locked = true;
    stopTimer();

    var loc = state.locations[state.index];
    var answer = L.latLng(loc.lat, loc.lng);
    var guess = state.pending;
    var distance = guess ? Core.haversineKm({ lat: guess.lat, lng: guess.lng }, loc) : null;
    var points = guess ? Core.scoreForDistance(distance) : 0;

    state.rounds.push({ loc: loc, guess: guess ? { lat: guess.lat, lng: guess.lng } : null, distance: distance, points: points });

    // Reveal on the guess map: blue = guess, green = answer, dashed line between.
    guessLayer.clearLayers();
    pendingMarker = null;
    L.marker(answer, { icon: pinIcon('pin-answer'), title: loc.name, keyboard: false }).addTo(guessLayer);
    setGuessMapLocked(true);

    if (guess) {
      L.marker(guess, { icon: pinIcon('pin-guess-final'), title: 'Your guess', keyboard: false }).addTo(guessLayer);
      L.polyline([guess, answer], { color: '#D90429', weight: 3, dashArray: '8 8' })
        .bindTooltip(Core.formatDistance(distance), { permanent: true, direction: 'center', className: 'distance-label' })
        .addTo(guessLayer);
    }

    var total = state.rounds.reduce(function (s, r) { return s + r.points; }, 0);
    $('round-score').textContent = fmt(points);
    $('total-score').textContent = fmt(total);
    renderDots();
    // Show the sheet first so the map can be fitted around whatever it still covers.
    showRoundResult(loc, distance, points, timedOut && !guess);
    if (guess) {
      guessMap.fitBounds(L.latLngBounds([guess, answer]), Object.assign({ maxZoom: 13 }, revealPadding()));
    } else {
      guessMap.setView(answer, 9);
    }
    Sound.result(points);
  }

  /** fitBounds padding that keeps both pins clear of the result sheet if it overlaps the guess map. */
  function revealPadding() {
    var tl = [40, 40], br = [40, 40];
    var m = guessMap.getContainer().getBoundingClientRect();
    var sh = $('result-sheet').getBoundingClientRect();
    var overlapX = Math.min(m.right, sh.right) - Math.max(m.left, sh.left);
    var overlapY = Math.min(m.bottom, sh.bottom) - Math.max(m.top, sh.top);
    if (overlapX > 0 && overlapY > 0 && overlapY < m.height - 120) {
      if (sh.top > m.top) br[1] += overlapY; else tl[1] += overlapY;
    }
    return { paddingTopLeft: tl, paddingBottomRight: br };
  }

  function showRoundResult(loc, distance, points, timedOut) {
    $('result-name').textContent = loc.name;
    $('result-hy').textContent = loc.hy + ' · ' + loc.translit;
    $('result-distance').textContent = timedOut
      ? '⏰ Time’s up — no guess placed.'
      : 'Your guess was ' + Core.formatDistance(distance) + ' away.';
    $('result-fact').textContent = '💡 ' + loc.fact;

    var rows = [
      ['Region', loc.region],
      ['Type', loc.category.charAt(0).toUpperCase() + loc.category.slice(1)],
      ['Difficulty', '★★★★'.slice(0, loc.difficulty) + '☆☆☆☆'.slice(0, 4 - loc.difficulty)],
      ['Coordinates', loc.lat.toFixed(4) + ', ' + loc.lng.toFixed(4)]
    ];
    if (loc.population) rows.splice(2, 0, ['Population', '≈ ' + fmt(loc.population)]);
    $('result-dl').innerHTML = rows.map(function (r) {
      return '<dt>' + escapeHtml(r[0]) + '</dt><dd>' + escapeHtml(r[1]) + '</dd>';
    }).join('');

    var last = state.index === state.locations.length - 1;
    $('next-btn').textContent = last ? 'See results →' : 'Next round →';

    var sheet = $('result-sheet');
    sheet.hidden = false;
    sheet.querySelector('details').open = false;
    animateCount($('result-points'), points);
    var bar = $('result-bar');
    bar.style.width = '0';
    requestAnimationFrame(function () { requestAnimationFrame(function () { bar.style.width = (points / Core.MAX_POINTS * 100) + '%'; }); });
    $('next-btn').focus({ preventScroll: true });
  }

  function animateCount(el, target) {
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || target === 0) { el.textContent = fmt(target); return; }
    var start = performance.now();
    var dur = 700;
    (function frame(now) {
      var t = Math.min(1, (now - start) / dur);
      el.textContent = fmt(Math.round(target * (1 - Math.pow(1 - t, 3))));
      if (t < 1) requestAnimationFrame(frame);
    })(start);
  }

  function nextRound() {
    if (!state.locked) return;
    if (state.index < state.locations.length - 1) {
      state.index++;
      startRound();
    } else {
      finishGame();
    }
  }

  function renderDots() {
    var html = '';
    for (var i = 0; i < state.locations.length; i++) {
      var r = state.rounds[i];
      var cls = '';
      if (r) cls = r.points >= 4500 ? 'g' : r.points >= 3500 ? 'y' : r.points >= 2000 ? 'o' : 'r';
      else if (i === state.index) cls = 'current';
      html += '<span class="' + cls + '"></span>';
    }
    $('round-dots').innerHTML = html;
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
      if (state.timeLeft <= 10 && state.timeLeft > 0) Sound.tick();
      if (state.timeLeft <= 0) submitGuess(true);
    }, 1000);
  }

  function stopTimer() {
    if (state.timerId) clearInterval(state.timerId);
    state.timerId = null;
  }

  function renderTimer() {
    var el = $('timer');
    el.textContent = state.timeLeft;
    el.classList.toggle('low', state.timeLeft <= 10);
  }

  /* ------------------------------------------------------------- results */
  function finishGame() {
    var stats = Core.computeStats(state.rounds);
    var today = Core.dateKey();

    // Persist cross-game progress.
    var progress = store.get('stats', { gamesPlayed: 0, bestScore: 0, modesCompleted: [] });
    progress.gamesPlayed = (progress.gamesPlayed || 0) + 1;
    progress.bestScore = Math.max(progress.bestScore || 0, stats.total);
    progress.modesCompleted = progress.modesCompleted || [];
    if (progress.modesCompleted.indexOf(state.mode) === -1) progress.modesCompleted.push(state.mode);
    store.set('stats', progress);

    var recent = store.get('recent', []);
    state.locations.forEach(function (l) { if (recent.indexOf(l.id) === -1) recent.push(l.id); });
    store.set('recent', recent.slice(-30));

    var firstDailyToday = false;
    var daily = store.get('daily', { streak: 0, scores: {} });
    daily.scores = daily.scores || {};
    if (state.daily && daily.scores[state.daily] == null) {
      firstDailyToday = true;
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
    var fresh = earned.filter(function (id) { return !unlocked[id]; });
    fresh.forEach(function (id) { unlocked[id] = today; });
    store.set('achievements', unlocked);

    renderResults(stats, fresh, firstDailyToday);
    Sound.finish();
  }

  function renderResults(stats, freshBadges, firstDailyToday) {
    showScreen('results');
    var rank = Core.rankFor(stats.total);
    $('final-kicker').textContent = state.daily
      ? 'Daily challenge · ' + state.daily + (firstDailyToday ? '' : ' (practice)')
      : Core.MODES[state.mode].label + ' · game over';
    $('final-score').textContent = fmt(stats.total);
    $('final-title').querySelector('small').textContent = ' / ' + fmt(stats.max);
    $('final-rank').textContent = rank.emoji + ' ' + rank.title;
    $('final-emoji').textContent = state.rounds.map(function (r) { return Core.emojiFor(r.points); }).join('');

    $('st-accuracy').textContent = stats.accuracy + '%';
    $('st-avg').textContent = Core.formatDistance(stats.averageDistance);
    $('st-best').textContent = 'R' + (stats.bestRound + 1) + ' · ' + fmt(state.rounds[stats.bestRound].points);
    $('st-worst').textContent = 'R' + (stats.worstRound + 1) + ' · ' + fmt(state.rounds[stats.worstRound].points);

    $('rounds-body').innerHTML = state.rounds.map(function (r, i) {
      var cls = i === stats.bestRound ? 'best' : i === stats.worstRound ? 'worst' : '';
      return '<tr class="' + cls + '"><td>' + (i + 1) + '</td><td>' + escapeHtml(r.loc.name) +
        '</td><td>' + escapeHtml(r.loc.region) + '</td><td class="num">' + Core.formatDistance(r.distance) +
        '</td><td class="num">' + fmt(r.points) + '</td></tr>';
    }).join('');

    var box = $('new-badges');
    if (freshBadges.length) {
      box.hidden = false;
      $('new-badges-list').innerHTML = freshBadges.map(function (id) {
        var a = Core.ACHIEVEMENTS.filter(function (x) { return x.id === id; })[0];
        return '<li title="' + escapeHtml(a.desc) + '">' + a.icon + ' ' + escapeHtml(a.title) + '</li>';
      }).join('');
    } else {
      box.hidden = true;
    }

    var form = $('save-form');
    form.hidden = false;
    form.querySelector('button').disabled = false;
    $('player-name').value = store.get('playerName', '');
    $('final-title').setAttribute('tabindex', '-1');
    $('final-title').focus({ preventScroll: true });
  }

  function saveScore(e) {
    e.preventDefault();
    if (state.saved) return;
    var name = $('player-name').value.trim().slice(0, 16);
    if (!name) return;
    var total = state.rounds.reduce(function (s, r) { return s + r.points; }, 0);
    var board = store.get('leaderboard', []);
    board.push({ name: name, score: total, mode: state.mode, date: Core.dateKey() });
    // Keep the top 10 per mode.
    var kept = [];
    Object.keys(Core.MODES).forEach(function (m) {
      kept = kept.concat(board.filter(function (x) { return x.mode === m; })
        .sort(function (a, b) { return b.score - a.score; }).slice(0, 10));
    });
    store.set('leaderboard', kept);
    store.set('playerName', name);
    state.saved = true;
    $('save-form').querySelector('button').disabled = true;
    toast('Saved to the ' + Core.MODES[state.mode].label + ' leaderboard');
  }

  function shareScore() {
    var total = state.rounds.reduce(function (s, r) { return s + r.points; }, 0);
    var url = /^https?:/.test(location.href) ? location.href.split('#')[0] : '';
    var text = Core.shareText({ mode: state.mode, date: state.daily, rounds: state.rounds, total: total, url: url });
    var coarse = window.matchMedia('(pointer: coarse)').matches;
    if (navigator.share && coarse) {
      navigator.share({ text: text }).catch(function () { /* cancelled */ });
      return;
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        function () { toast('Score copied to clipboard 📋'); },
        function () { window.prompt('Copy your score:', text); }
      );
    } else {
      window.prompt('Copy your score:', text);
    }
  }

  /* ------------------------------------------------------------- dialogs */
  function openLeaderboard(mode) {
    var modes = Object.keys(Core.MODES);
    mode = mode || state.mode || 'medium';
    $('lb-tabs').innerHTML = modes.map(function (m) {
      return '<button type="button" role="tab" data-mode="' + m + '" aria-selected="' + (m === mode) + '">' +
        Core.MODES[m].label + '</button>';
    }).join('');
    var rows = store.get('leaderboard', []).filter(function (x) { return x.mode === mode; })
      .sort(function (a, b) { return b.score - a.score; });
    $('lb-list').innerHTML = rows.length
      ? rows.map(function (r) {
          return '<li>' + escapeHtml(r.name) + '<span class="date">' + escapeHtml(r.date) + '</span><span>' + fmt(r.score) + '</span></li>';
        }).join('')
      : '<li class="muted" style="list-style:none;margin-left:-1.6rem">No scores yet — go set one!</li>';
    var dlg = $('leaderboard-dialog');
    if (!dlg.open) dlg.showModal();
  }

  function openAchievements() {
    var unlocked = store.get('achievements', {});
    $('ach-list').innerHTML = Core.ACHIEVEMENTS.map(function (a) {
      var got = unlocked[a.id];
      return '<li class="' + (got ? '' : 'locked') + '"><span class="b-icon" aria-hidden="true">' + a.icon + '</span><div><strong>' +
        escapeHtml(a.title) + (got ? '' : ' <span class="sr-only">(locked)</span>') + '</strong><small>' + escapeHtml(a.desc) +
        (got ? ' · unlocked ' + escapeHtml(got) : '') + '</small></div></li>';
    }).join('');
    $('achievements-dialog').showModal();
  }

  /* ------------------------------------------------------------ settings */
  function toggleTheme() {
    var next = isDarkTheme() ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    // Stored as a raw string (not JSON) because the pre-paint script in index.html reads it directly.
    try { localStorage.setItem('armg.theme', next); } catch (e) { /* ignore */ }
    setGuessTiles();
  }

  function renderSoundBtn() {
    var btn = $('sound-btn');
    btn.textContent = Sound.muted ? '🔇' : '🔊';
    btn.setAttribute('aria-pressed', String(!Sound.muted));
    btn.setAttribute('aria-label', Sound.muted ? 'Sound off' : 'Sound on');
  }

  /* -------------------------------------------------------------- wiring */
  function bind() {
    document.querySelectorAll('.mode-card').forEach(function (btn) {
      btn.addEventListener('click', function () { startGame(btn.dataset.mode); });
    });
    $('daily-btn').addEventListener('click', function () { startGame('daily'); });
    $('guess-btn').addEventListener('click', function () { submitGuess(false); });
    $('next-btn').addEventListener('click', nextRound);
    $('recenter-btn').addEventListener('click', function () {
      var loc = state.locations[state.index];
      if (loc) viewMap.setView([loc.lat, loc.lng], Core.MODES[state.mode].view.zoom);
    });
    $('pin-center-btn').addEventListener('click', function () { placeGuess(guessMap.getCenter()); });
    $('again-btn').addEventListener('click', function () { startGame(state.mode); });
    $('home-btn').addEventListener('click', renderHome);
    $('logo-btn').addEventListener('click', function () {
      if (!$('screen-game').hidden && state.rounds.length && !confirm('Leave this game? Your progress will be lost.')) return;
      renderHome();
    });
    $('save-form').addEventListener('submit', saveScore);
    $('share-btn').addEventListener('click', shareScore);
    $('theme-btn').addEventListener('click', toggleTheme);
    $('sound-btn').addEventListener('click', function () {
      Sound.muted = !Sound.muted;
      store.set('muted', Sound.muted);
      renderSoundBtn();
    });
    $('help-btn').addEventListener('click', function () { $('help-dialog').showModal(); });
    $('help-dialog').addEventListener('close', function () { store.set('tutorialSeen', true); });
    $('leaderboard-btn').addEventListener('click', function () { openLeaderboard(); });
    $('lb-tabs').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-mode]');
      if (b) openLeaderboard(b.dataset.mode);
    });
    $('achievements-btn').addEventListener('click', openAchievements);
    $('timer-toggle').addEventListener('change', function (e) { store.set('timed', e.target.checked); });

    // Keyboard shortcuts during a game.
    document.addEventListener('keydown', function (e) {
      if ($('screen-game').hidden || document.querySelector('dialog[open]')) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      var tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;
      var onButton = tag === 'button' || tag === 'summary';

      if (!state.locked) {
        if (e.key === 'g' || e.key === 'G') { placeGuess(guessMap.getCenter()); e.preventDefault(); }
        else if ((e.key === ' ' || e.key === 'Enter') && !onButton && state.pending) { submitGuess(false); e.preventDefault(); }
      } else if (e.key === 'n' || e.key === 'N') {
        nextRound(); e.preventDefault();
      }
    });

    // Keep Leaflet sized correctly when the layout changes (rotation, resize).
    window.addEventListener('resize', function () {
      if (viewMap) viewMap.invalidateSize();
      if (guessMap) guessMap.invalidateSize();
    });
    if (window.matchMedia) {
      var mq = window.matchMedia('(prefers-color-scheme: dark)');
      (mq.addEventListener ? mq.addEventListener.bind(mq, 'change') : mq.addListener.bind(mq))(setGuessTiles);
    }
  }

  function init() {
    if (!window.L) {
      document.getElementById('main').innerHTML =
        '<p style="padding:2rem;text-align:center">The map library failed to load. Check your connection and reload.</p>';
      return;
    }
    renderSoundBtn();
    bind();
    renderHome();
    if (!store.get('tutorialSeen', false)) $('help-dialog').showModal();
  }

  init();
})();
