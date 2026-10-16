// DOM-based UI: HUD, start / garage / pause / game-over screens, toasts.
import { VEHICLES } from './vehicleModels.js';

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
      over: $('screen-over'),
    };
    this.current = null;
    this.hud = $('hud');
    this.el = {
      score: $('hud-score'), dist: $('hud-dist'), speed: $('hud-speed'), unit: $('hud-unit'),
      mult: $('hud-mult'), multWrap: $('hud-mult-wrap'), multRing: $('hud-mult-ring'),
      powers: $('hud-powers'), toasts: $('toasts'), pause: $('btn-pause'), mute: $('btn-mute'),
    };
    this.last = {};
    this.powerEls = {};
    this.units = 'kmh';

    $('btn-start').onclick = () => h.start();
    $('btn-garage').onclick = () => h.openGarage();
    $('btn-garage-back').onclick = () => h.closeGarage();
    $('btn-resume').onclick = () => h.resume();
    $('btn-pause-restart').onclick = () => h.restart();
    $('btn-pause-menu').onclick = () => h.menu();
    $('btn-restart').onclick = () => h.restart();
    $('btn-over-garage').onclick = () => h.openGarage();
    $('btn-over-menu').onclick = () => h.menu();
    this.el.pause.onclick = () => h.pause();
    this.el.mute.onclick = () => h.toggleMute();
    $('hud-speed-wrap').onclick = () => h.toggleUnits();
    // tapping the start screen background starts the game
    this.screens.start.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
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

  // ------------------------------------------------------------ garage
  renderGarage(save, selectedIndexFocus) {
    const wrap = $('garage-cards');
    wrap.innerHTML = '';
    VEHICLES.forEach((v, i) => {
      const locked = !save.unlocked.includes(v.id);
      const card = document.createElement('button');
      card.className = 'card' + (locked ? ' locked' : '') + (save.selected === v.id ? ' sel' : '');
      card.dataset.index = i;
      const bars = Object.entries({ Speed: v.ratings.speed, Handling: v.ratings.handling, Tough: v.ratings.tough, Air: v.ratings.air })
        .map(([k, n]) => `<div class="stat"><label>${k}</label><i><b style="width:${n * 20}%"></b></i></div>`)
        .join('');
      card.innerHTML = `
        <div class="inner"><h3>${v.name}</h3><p>${v.blurb}</p>${bars}</div>
        ${save.selected === v.id ? '<span class="tag">SELECTED</span>' : ''}
        ${locked ? `<div class="lockbadge"><span><div>🔒</div>Unlock at<br>${fmt(v.unlock)} pts</span></div>` : ''}`;
      card.onclick = () => this.h.selectVehicle(v.id, locked);
      wrap.appendChild(card);
      if (selectedIndexFocus === i) setTimeout(() => card.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' }), 30);
    });
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
