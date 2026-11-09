// DOM-based UI: HUD, start / garage / pause / game-over screens, toasts.
import { VEHICLES } from './vehicleModels.js';
import { UPGRADES, levelsOf, upgradeCost } from './upgrades.js';
import { BIOMES, CONTINENTS, COUNTRIES, flagOf, getCountry } from './countries.js';

const $ = (id) => document.getElementById(id);

const POWER_INFO = {
  nitro: { icon: '🔥', color: '#ff8a1f', label: 'Nitro' },
  shield: { icon: '🛡️', color: '#66e0ff', label: 'Shield' },
  magnet: { icon: '🧲', color: '#ff5a8a', label: 'Magnet' },
  grip: { icon: '🛞', color: '#5bd16b', label: 'Grip' },
};

const fmt = (n) => Math.floor(n).toLocaleString('en-US');

export class UI {
  constructor(h) {
    this.h = h; // handlers
    this.screens = {
      start: $('screen-start'),
      garage: $('screen-garage'),
      pause: $('screen-pause'),
      countries: $('screen-countries'),
      over: $('screen-over'),
    };
    this.current = null;
    this.hud = $('hud');
    this.el = {
      score: $('hud-score'), dist: $('hud-dist'), speed: $('hud-speed'), unit: $('hud-unit'),
      coins: $('hud-coins'), lives: $('hud-lives'),
      mult: $('hud-mult'), multWrap: $('hud-mult-wrap'), multRing: $('hud-mult-ring'),
      powers: $('hud-powers'), toasts: $('toasts'), pause: $('btn-pause'), mute: $('btn-mute'),
    };
    this.last = {};
    this.powerEls = {};
    this.units = 'kmh';

    $('btn-start').onclick = () => h.start();
    $('btn-garage').onclick = () => h.openGarage();
    $('btn-dest').onclick = () => h.openCountries();
    $('btn-countries-back').onclick = () => h.closeCountries();
    this.cFilter = '';
    this.cCont = 'All';
    $('country-search').addEventListener('input', (e) => {
      this.cFilter = e.target.value.trim().toLowerCase();
      this.renderCountries();
    });
    const chips = $('country-chips');
    for (const name of ['All', ...CONTINENTS]) {
      const c = document.createElement('button');
      c.className = 'chip' + (name === 'All' ? ' sel' : '');
      c.textContent = name;
      c.onclick = () => {
        this.cCont = name;
        for (const x of chips.children) x.classList.toggle('sel', x === c);
        this.renderCountries();
      };
      chips.appendChild(c);
    }
    $('btn-garage-back').onclick = () => h.closeGarage();
    $('btn-resume').onclick = () => h.resume();
    $('btn-pause-restart').onclick = () => h.restart();
    $('btn-pause-menu').onclick = () => h.menu();
    $('btn-restart').onclick = () => h.restart();
    $('btn-over-garage').onclick = () => h.openGarage();
    $('btn-over-menu').onclick = () => h.menu();
    this.el.pause.onclick = () => h.pause();
    // garage tabs
    this.garageTab = 'cars';
    for (const t of document.querySelectorAll('.tab')) t.onclick = () => this.setGarageTab(t.dataset.tab);
    // paint panel
    const swatches = $('swatches');
    for (const hex of ['#f1f1ec', '#1b1b1f', '#b7bcc2', '#e5483c', '#e8691f', '#ffc21a', '#8fd13f', '#3ec26b', '#2fb5a8', '#3ac7f0', '#3b82d6', '#24408e', '#7a4fd1', '#ff6fb5']) {
      const b = document.createElement('button');
      b.className = 'swatch';
      b.style.background = hex;
      b.title = hex;
      b.setAttribute('aria-label', 'Paint ' + hex);
      b.onclick = () => h.setPaint(hex);
      swatches.appendChild(b);
    }
    $('paint-custom').addEventListener('input', (e) => h.setPaint(e.target.value));
    $('paint-reset').onclick = () => h.resetPaint();
    // touch brake button
    const brake = $('btn-brake');
    const press = (on) => (e) => {
      e.preventDefault();
      brake.classList.toggle('down', on);
      h.brake(on);
    };
    brake.addEventListener('pointerdown', press(true));
    for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) brake.addEventListener(ev, press(false));
    for (const id of ['hesi-start', 'hesi-pause']) {
      const el = $(id);
      el.addEventListener('change', () => {
        h.setNoHesi(el.checked);
        el.blur();
      });
    }
    for (const id of ['traffic-start', 'traffic-pause']) {
      const el = $(id);
      el.addEventListener('input', () => h.setTraffic(Number(el.value)));
      el.addEventListener('change', () => el.blur());
    }
    for (const id of ['speed-start', 'speed-pause']) {
      const el = $(id);
      el.addEventListener('input', () => h.setSpeed(Number(el.value)));
      el.addEventListener('change', () => el.blur());
    }
    this.el.mute.onclick = () => h.toggleMute();
    $('hud-speed-wrap').onclick = () => h.toggleUnits();
    // tapping the start screen background starts the game
    this.screens.start.addEventListener('click', (e) => {
      if (e.target.closest('button, input, label')) return;
      h.start();
    });
    for (const b of document.querySelectorAll('button')) {
      b.addEventListener('click', () => {
        b.blur();
        h.click && h.click();
      });
    }
  }

  show(name) {
    this.current = name;
    for (const [k, el] of Object.entries(this.screens)) el.classList.toggle('show', k === name);
  }

  setHudVisible(v) {
    this.hud.classList.toggle('hidden', !v);
    this.el.pause.classList.toggle('hidden', !v);
    if (!v) this.clearPowers();
  }

  setMuteIcon(m) {
    this.el.mute.textContent = m ? '🔇' : '🔊';
  }

  setUnits(u) {
    this.units = u;
    this.el.unit.textContent = u === 'mph' ? 'mph' : 'km/h';
  }

  setNoHesi(on) {
    for (const id of ['hesi-start', 'hesi-pause']) $(id).checked = on;
  }

  setTrafficSetting(v) {
    const label = v === 0 ? 'Off' : v >= 20 ? 'Rush ' + v + 'x' : v + 'x';
    for (const id of ['traffic-start', 'traffic-pause']) $(id).value = v;
    for (const id of ['traffic-start-val', 'traffic-pause-val']) $(id).textContent = label;
  }

  setSpeedSetting(pct) {
    for (const id of ['speed-start', 'speed-pause']) $(id).value = pct;
    for (const id of ['speed-start-val', 'speed-pause-val']) $(id).textContent = pct + '%';
  }

  setPaintValue(hex) {
    $('paint-custom').value = hex;
  }

  setBest(best) {
    $('start-best').textContent = fmt(best);
  }

  showTouchHint() {
    const el = $('touch-hint');
    el.classList.remove('hidden');
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = '';
    setTimeout(() => el.classList.add('hidden'), 5200);
  }

  setTouchMode(t) {
    document.body.classList.toggle('touch', t);
  }

  // data: { score, dist, speed, mult, multFrac, powers: {nitro, shield, ...}, maxPowers }
  updateHUD(d) {
    const L = this.last;
    const score = Math.floor(d.score);
    if (L.score !== score) {
      this.el.score.textContent = fmt(score);
      L.score = score;
    }
    const coins = String(d.coins);
    if (L.coins !== coins) {
      this.el.coins.textContent = coins;
      L.coins = coins;
    }
    const hearts = '❤️'.repeat(d.lives || 0);
    if (L.lives !== hearts) {
      this.el.lives.textContent = hearts;
      L.lives = hearts;
    }
    const dist = d.dist >= 1000 ? (d.dist / 1000).toFixed(2) + ' km' : Math.floor(d.dist) + ' m';
    if (L.dist !== dist) {
      this.el.dist.textContent = dist;
      L.dist = dist;
    }
    const spd = Math.round(this.units === 'mph' ? d.speed * 2.23694 : d.speed * 3.6);
    if (L.speed !== spd) {
      this.el.speed.textContent = spd;
      L.speed = spd;
    }
    if (L.mult !== d.mult) {
      this.el.mult.textContent = 'x' + d.mult;
      this.el.multWrap.classList.toggle('active', d.mult > 1);
      if (L.mult !== undefined && d.mult > L.mult) {
        this.el.multWrap.classList.add('pop');
        setTimeout(() => this.el.multWrap.classList.remove('pop'), 180);
      }
      L.mult = d.mult;
    }
    const mf = d.mult > 1 ? d.multFrac : 0;
    if (L.mf !== mf.toFixed(2)) {
      this.el.multRing.style.setProperty('--f', mf.toFixed(3));
      L.mf = mf.toFixed(2);
    }
    for (const id of Object.keys(POWER_INFO)) {
      const t = d.powers[id] || 0;
      if (t > 0) this._power(id, t, d.maxPowers[id]);
      else if (this.powerEls[id]) this._removePower(id);
    }
  }

  _power(id, t, max) {
    let el = this.powerEls[id];
    if (!el) {
      const info = POWER_INFO[id];
      el = document.createElement('div');
      el.className = 'power';
      el.style.setProperty('--c', info.color);
      el.innerHTML = `<span>${info.icon}</span><small></small>`;
      el.title = info.label;
      this.el.powers.appendChild(el);
      this.powerEls[id] = el;
    }
    el.style.setProperty('--f', Math.min(1, t / max).toFixed(3));
    const s = el.lastChild;
    const txt = t.toFixed(1) + 's';
    if (s.textContent !== txt) s.textContent = txt;
    el.classList.toggle('low', t < 2);
  }

  _removePower(id) {
    this.powerEls[id].remove();
    delete this.powerEls[id];
  }

  clearPowers() {
    for (const id of Object.keys(this.powerEls)) this._removePower(id);
    this.last = {};
  }

  toast(text, color = '#fff') {
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = text;
    el.style.setProperty('--c', color);
    this.el.toasts.appendChild(el);
    while (this.el.toasts.children.length > 3) this.el.toasts.firstChild.remove();
    setTimeout(() => el.remove(), 1500);
  }

  // ------------------------------------------------------------ destinations
  setDestination(code) {
    const c = getCountry(code);
    this.countryCode = code;
    $('start-dest').textContent = `📍 ${flagOf(c.code)} ${c.name}`;
  }

  renderCountries(best) {
    if (best) this.countryBest = best;
    const grid = $('country-grid');
    const q = this.cFilter;
    const list = COUNTRIES.filter((c) => (this.cCont === 'All' || c.continent === this.cCont) && (!q || c.name.toLowerCase().includes(q) || c.code.toLowerCase() === q));
    grid.innerHTML = '';
    const head = document.createElement('div');
    head.className = 'count-line';
    head.textContent = `${list.length} destination${list.length === 1 ? '' : 's'}`;
    grid.appendChild(head);
    for (const c of list) {
      const b = document.createElement('button');
      b.className = 'country' + (c.code === this.countryCode ? ' sel' : '');
      const bs = (this.countryBest || {})[c.code];
      b.innerHTML = `<span class="flag">${flagOf(c.code)}</span><b></b><small><span class="code">${c.code}</span> · ${BIOMES[c.biome].name}${bs ? ' · best ' + fmt(bs) : ''}</small>`;
      b.querySelector('b').textContent = c.name;
      b.onclick = () => this.h.pickCountry(c.code);
      grid.appendChild(b);
    }
  }

  // ------------------------------------------------------------ garage
  setGarageTab(tab) {
    this.garageTab = tab;
    for (const t of document.querySelectorAll('.tab')) t.classList.toggle('sel', t.dataset.tab === tab);
    for (const name of ['cars', 'upgrades', 'paint']) $('tab-' + name).classList.toggle('hidden', name !== tab);
  }

  setWallet(n) {
    const txt = Math.floor(n).toLocaleString('en-US');
    $('wallet').textContent = txt;
    $('start-coins').textContent = txt;
  }

  garageMsg(text) {
    const el = $('garage-msg');
    el.textContent = text;
    clearTimeout(this._msgT);
    this._msgT = setTimeout(() => (el.textContent = ''), 2600);
  }

  renderGarage(save, selectedIndexFocus) {
    this.setWallet(save.coins);
    const wrap = $('garage-cards');
    wrap.innerHTML = '';
    VEHICLES.forEach((v, i) => {
      const owned = save.unlocked.includes(v.id);
      const card = document.createElement('div');
      card.className = 'card' + (owned ? '' : ' locked') + (save.selected === v.id ? ' sel' : '');
      card.tabIndex = 0;
      card.setAttribute('role', 'button');
      card.dataset.index = i;
      const bars = Object.entries({ Speed: v.ratings.speed, Handling: v.ratings.handling, Tough: v.ratings.tough, Air: v.ratings.air })
        .map(([k, n]) => `<div class="stat"><label>${k}</label><i><b style="width:${n * 20}%"></b></i></div>`)
        .join('');
      card.innerHTML = `
        <div class="inner"><h3>${v.name}</h3><p>${v.blurb}</p>${bars}</div>
        ${save.selected === v.id ? '<span class="tag">SELECTED</span>' : ''}
        ${owned ? '' : `<span class="price">🪙 ${fmt(v.price)}</span>`}`;
      if (!owned) {
        const buy = document.createElement('button');
        buy.className = 'btn buy' + (save.coins >= v.price ? ' primary' : '');
        buy.textContent = save.coins >= v.price ? `Buy · ${fmt(v.price)}` : `Need ${fmt(v.price - save.coins)} more`;
        buy.onclick = (e) => {
          e.stopPropagation();
          this.h.buyVehicle(v.id);
        };
        card.appendChild(buy);
      }
      const choose = () => this.h.selectVehicle(v.id, !owned);
      card.onclick = choose;
      card.onkeydown = (e) => {
        if (e.key === 'Enter') choose();
      };
      wrap.appendChild(card);
      if (selectedIndexFocus === i) setTimeout(() => card.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' }), 30);
    });
    this.renderUpgrades(save);
  }

  renderUpgrades(save) {
    const list = $('upgrade-list');
    list.innerHTML = '';
    const veh = VEHICLES.find((v) => v.id === save.selected) || VEHICLES[0];
    const lv = levelsOf(save, veh.id);
    const head = document.createElement('div');
    head.className = 'garage-msg';
    head.style.gridColumn = '1 / -1';
    head.textContent = `Tuning: ${veh.name}`;
    list.appendChild(head);
    for (const up of UPGRADES) {
      const level = lv[up.id];
      const maxed = level >= up.max;
      const cost = upgradeCost(up, level);
      const row = document.createElement('div');
      row.className = 'upg';
      const pips = Array.from({ length: up.max }, (_, i) => `<i class="${i < level ? 'on' : ''}"></i>`).join('');
      row.innerHTML = `<div class="ico">${up.icon}</div><div class="txt"><b>${up.name} · Lv ${level}/${up.max}</b><small>${up.desc}</small><div class="pips">${pips}</div></div>`;
      const btn = document.createElement('button');
      btn.className = 'btn' + (!maxed && save.coins >= cost ? ' primary' : '');
      btn.textContent = maxed ? 'MAX' : `🪙 ${fmt(cost)}`;
      btn.disabled = maxed || save.coins < cost;
      btn.onclick = () => this.h.buyUpgrade(up.id);
      row.appendChild(btn);
      list.appendChild(row);
    }
  }

  // ------------------------------------------------------------ game over
  showGameOver(info) {
    $('over-score').textContent = fmt(info.score);
    $('over-best').textContent = fmt(info.best);
    $('over-dist').textContent = info.dist >= 1000 ? (info.dist / 1000).toFixed(2) + ' km' : Math.floor(info.dist) + ' m';
    $('over-tricks').textContent = info.tricks;
    $('over-coins').textContent = info.coins;
    $('over-new').classList.toggle('hidden', !info.newBest);
    $('over-seed').textContent = 'Seed ' + info.seed;
    $('over-bank').textContent = `+${fmt(info.bank)} coins banked · wallet ${fmt(info.wallet)}`;
    const u = $('over-unlocks');
    u.innerHTML = '';
    for (const name of info.unlocked) {
      const d = document.createElement('div');
      d.className = 'unlock-line';
      d.textContent = `🎉 Unlocked: ${name}!`;
      u.appendChild(d);
    }
    this.show('over');
    setTimeout(() => $('btn-restart').focus({ preventScroll: true }), 50);
  }

  hideLoading() {
    $('loading').classList.add('done');
  }
}
