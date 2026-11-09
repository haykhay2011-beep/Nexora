// DOM user interface: screens, HUD and popups. Text nodes are only written when
// their value changes, and popups come from a small reusable pool.
const $ = (id) => document.getElementById(id);

export class UI {
  constructor() {
    this.screens = {
      start: $('screen-start'), garage: $('screen-garage'), dests: $('screen-dests'),
      pause: $('screen-pause'), over: $('screen-over'),
    };
    this.hud = $('hud');
    this.touchUi = $('touch-ui');
    this.el = {
      score: $('hud-score'), mult: $('hud-mult'), combo: $('hud-combo'), dist: $('hud-dist'),
      coins: $('hud-coins'), lives: $('hud-lives'), speed: $('hud-speed'), unit: $('hud-unit'),
      batt: $('hud-batt'), battPct: $('hud-batt-pct'), regen: $('hud-regen'), boost: $('hud-boost'),
      powers: $('hud-powers'), center: $('hud-center'), launch: $('launch-panel'), launchFill: $('launch-fill'),
      launchHint: $('launch-hint'), zero: $('zero-timer'), zeroTime: $('zero-time'), flat: $('flat-warning'), flatCount: $('flat-count'),
      boostBtn: $('touch-boost'), boostFx: $('fx-boost'), flash: $('fx-flash'), touchHint: $('touch-hint'),
    };
    this._cache = new Map();
    this.popups = [];
    for (let i = 0; i < 8; i++) {
      const d = document.createElement('div');
      d.className = 'popup hidden';
      d.addEventListener('animationend', () => d.classList.add('hidden'));
      this.el.center.appendChild(d);
      this.popups.push(d);
    }
    this.popupIdx = 0;
    this.powerEls = {};
    for (const [id, icon, label] of [['boost', '🚀', 'LUDICROUS'], ['magnet', '🧲', 'MAGNET'], ['shield', '🛡️', 'SHIELD']]) {
      const d = document.createElement('div');
      d.className = 'power hidden';
      d.innerHTML = `<i>${icon}</i><span>${label}</span><div class="pbar"><div></div></div>`;
      this.el.powers.appendChild(d);
      this.powerEls[id] = { el: d, bar: d.querySelector('.pbar div') };
    }
  }

  // write text/style only when changed
  _set(key, el, value, prop = 'textContent') {
    if (this._cache.get(key) === value) return;
    this._cache.set(key, value);
    if (prop === 'width') el.style.width = value;
    else el[prop] = value;
  }

  show(name) {
    for (const [k, s] of Object.entries(this.screens)) s.classList.toggle('hidden', k !== name);
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  }

  setHudVisible(v, touch) {
    this.hud.classList.toggle('hidden', !v);
    this.touchUi.classList.toggle('hidden', !(v && touch));
  }

  popup(text, cls = '') {
    const d = this.popups[this.popupIdx];
    this.popupIdx = (this.popupIdx + 1) % this.popups.length;
    d.className = 'popup ' + cls;
    d.textContent = text;
    // restart animation
    void d.offsetWidth;
    this.el.center.appendChild(d);
  }

  flash() {
    const f = this.el.flash;
    f.classList.remove('go'); void f.offsetWidth; f.classList.add('go');
  }

  setBoostFx(on) { this.el.boostFx.classList.toggle('on', on); }

  updateHud(h) {
    const e = this.el;
    this._set('score', e.score, Math.floor(h.score).toLocaleString());
    this._set('mult', e.mult, 'x' + h.mult);
    this._set('combo', e.combo, Math.round(h.comboPct * 100) + '%', 'width');
    this._set('dist', e.dist, h.distance >= 1000 ? (h.distance / 1000).toFixed(2) + ' km' : Math.floor(h.distance) + ' m');
    this._set('coins', e.coins, String(h.coins));
    this._set('lives', e.lives, h.lives > 0 ? '♥'.repeat(h.lives) : '');
    const mph = h.units === 'mph';
    this._set('speed', e.speed, String(Math.round(h.speed * (mph ? 2.23694 : 3.6))));
    this._set('unit', e.unit, mph ? 'mph' : 'km/h');
    const pct = Math.max(0, Math.min(1, h.battery));
    this._set('batt', e.batt, (pct * 100).toFixed(1) + '%', 'width');
    this._set('battPct', e.battPct, Math.ceil(pct * 100) + '%');
    this._set('battCls', e.batt, pct < 0.12 ? 'crit' : pct < 0.3 ? 'low' : '', 'className');
    this._set('regen', e.regen, h.regen ? 'regen on' : 'regen', 'className');
    this._set('boost', e.boost, Math.round(h.boostMeter * 100) + '%', 'width');
    this._set('boostReady', e.boost, h.boostMeter >= 1 ? 'ready' : '', 'className');
    this._set('boostBtn', e.boostBtn, 'touch-btn boost' + (h.boostMeter >= 1 || h.boostTime > 0 ? ' ready' : ''), 'className');
    for (const [id, max] of [['boost', h.boostMax], ['magnet', 8], ['shield', 10]]) {
      const t = id === 'boost' ? h.boostTime : id === 'magnet' ? h.magnetTime : h.shieldTime;
      const p = this.powerEls[id];
      this._set('pw-' + id, p.el, t > 0 ? 'power' : 'power hidden', 'className');
      if (t > 0) p.bar.style.width = Math.max(0, (t / max) * 100) + '%';
    }
    this._set('flat', e.flat, h.flatTime > 0 ? '' : 'hidden', 'className');
    if (h.flatTime > 0) this._set('flatCount', e.flatCount, String(Math.max(0, Math.ceil(h.flatLeft))));
  }

  setLaunch(visible, charge, touch) {
    this.el.launch.classList.toggle('hidden', !visible);
    if (!visible) return;
    this._set('launchFill', this.el.launchFill, Math.round(charge * 100) + '%', 'width');
    this._set('launchHint', this.el.launchHint, touch ? 'Hold the screen, release to launch' : 'Hold <kbd>SPACE</kbd>, release to launch', 'innerHTML');
  }

  setZeroTimer(state, t = 0) {
    const z = this.el.zero;
    if (state === 'hide') { z.classList.add('hidden'); return; }
    z.classList.remove('hidden');
    z.classList.toggle('done', state === 'done');
    this.el.zeroTime.textContent = t.toFixed(2);
  }
}
