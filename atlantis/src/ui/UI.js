import * as THREE from 'three';
import { JOURNAL, JOURNAL_ORDER, RELICS, RELIC_ORDER } from '../items/content.js';
import { SHARD_IDS, SHARD_NAMES, SHARD_COLORS, UPGRADES, UPGRADE_ORDER, LANDMARKS, ZONES, WORLD_HALF, upgradeValue } from '../world/config.js';
import { hasSave, saveInfo, deleteSave } from '../save/Save.js';
import { formatTime, clamp } from '../core/math.js';
import { BASE_POS } from '../world/Base.js';

const hex = (n) => '#' + n.toString(16).padStart(6, '0');
const RELIC_ICON = { mask: '🎭', coin: '🪙', dolphin: '🐬', statue: '🗿', amphora: '🏺', crown: '👑' };
const MARKER_ICON = { pearl: '●', clam: '◒', page: '📜', relic: '✦', shard: '◆', air: '○', path: '✧', puzzle: '◈' };
const v3 = new THREE.Vector3();

function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}

export class UI {
  constructor(game) {
    this.game = game;
    this.root = document.getElementById('ui');
    this.toasts = [];
    this.sonarMarkers = [];
    this.sonarTTL = 0;
    this.compassMarkers = [];
    this.build();
    this.bindMenuKeys();
  }

  build() {
    const r = this.root;
    r.innerHTML = `
      <div id="hud" class="hidden">
        <div class="vignette"></div>
        <div class="hurt"></div>
        <div class="crosshair"></div>
        <div class="compass"><div class="compass-strip"></div><div class="compass-markers"></div><div class="compass-needle"></div></div>
        <div class="zone-banner"><div class="zb-name"></div><div class="zb-sub"></div></div>
        <div class="warning"><div class="w-text"></div><div class="w-sub"></div></div>
        <div class="toasts"></div>
        <div class="top-right">
          <div class="shards"></div>
          <div class="pearls"><span class="pearl-icon"></span><span class="pearl-count">0</span></div>
        </div>
        <div class="gauges">
          <div class="depth"><span class="label">DEPTH</span><span class="depth-val">0 m</span><div class="depth-bar"><div class="depth-fill"></div><div class="depth-limit"></div></div><span class="depth-max"></span></div>
          <div class="o2"><span class="label">O₂</span><div class="o2-bar"><div class="o2-fill"></div></div><span class="o2-val">100%</span><span class="o2-refill">REFILLING</span></div>
        </div>
        <div class="prompt"></div>
        <div class="status-icons"><span class="si-light" title="Flashlight (F)">🔦</span><span class="si-sonar" title="Sonar (Q)">📡</span><span class="si-dolphin" title="Dolphin companion">🐬</span></div>
        <div class="keys-hint">E interact · F light · M map · Tab journal · Q sonar · Esc pause</div>
        <div class="save-ind">Saved</div>
        <div class="sonar-layer"></div>
        <div class="celebrate"><div class="cel-gem"></div><div class="cel-title"></div><div class="cel-sub"></div></div>
      </div>
      <div id="title" class="screen hidden">
        <div class="title-inner">
          <div class="logo"><div class="logo-main">ATLANTIS</div><div class="logo-sub">— THE GAME —</div></div>
          <div class="menu">
            <button data-act="new">New Game</button>
            <button data-act="continue">Continue</button>
            <button data-act="settings">Settings</button>
            <button data-act="controls">Controls</button>
          </div>
          <div class="save-info"></div>
          <div class="title-foot">Dive alone. Find the seven shards. Bring the lost city back to life.</div>
        </div>
      </div>
      <div id="loading" class="screen"><div class="logo"><div class="logo-main">ATLANTIS</div><div class="logo-sub">— THE GAME —</div></div><div class="load-text">Loading...</div></div>
      <div id="pause" class="screen panel-screen hidden">
        <div class="panel small">
          <h2>Paused</h2>
          <div class="menu">
            <button data-act="resume">Resume</button>
            <button data-act="settings">Settings</button>
            <button data-act="controls">Controls</button>
            <button data-act="save">Save Game</button>
            <button data-act="quit">Save &amp; Quit to Title</button>
          </div>
          <div class="pause-stats"></div>
        </div>
      </div>
      <div id="settings" class="screen panel-screen hidden">
        <div class="panel small">
          <h2>Settings</h2>
          <label>Mouse sensitivity <input type="range" min="0.2" max="3" step="0.05" data-set="sensitivity"><span class="val"></span></label>
          <label>Invert mouse Y <input type="checkbox" data-set="invertY"></label>
          <label>Master volume <input type="range" min="0" max="1" step="0.05" data-set="master"><span class="val"></span></label>
          <label>Music volume <input type="range" min="0" max="1" step="0.05" data-set="music"><span class="val"></span></label>
          <label>Effects volume <input type="range" min="0" max="1" step="0.05" data-set="sfx"><span class="val"></span></label>
          <label>Graphics quality
            <select data-set="quality"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select>
          </label>
          <p class="note">Quality changes view distance, particle counts and resolution. Anti-aliasing updates after a page reload.</p>
          <div class="danger-zone"><button data-act="delete-save" class="small-btn">Delete saved game</button></div>
          <div class="menu"><button data-act="back">Back</button></div>
        </div>
      </div>
      <div id="controls" class="screen panel-screen hidden">
        <div class="panel small">
          <h2>Controls</h2>
          <table class="controls-table">
            <tr><td>Mouse</td><td>Look around (click the game to capture the mouse)</td></tr>
            <tr><td>W A S D</td><td>Swim</td></tr>
            <tr><td>Space</td><td>Swim up</td></tr>
            <tr><td>C or Ctrl</td><td>Swim down (C is safer: Ctrl+W can close the tab)</td></tr>
            <tr><td>Shift</td><td>Swim fast (uses more oxygen)</td></tr>
            <tr><td>E</td><td>Interact: pick up, read, push, turn, activate</td></tr>
            <tr><td>F</td><td>Flashlight</td></tr>
            <tr><td>Q</td><td>Sonar pulse (after upgrade)</td></tr>
            <tr><td>M</td><td>Map</td></tr>
            <tr><td>Tab</td><td>Inventory and journal</td></tr>
            <tr><td>Esc</td><td>Pause</td></tr>
          </table>
          <div class="menu"><button data-act="back">Back</button></div>
        </div>
      </div>
      <div id="map" class="screen panel-screen hidden">
        <div class="panel wide map-panel">
          <div class="map-head"><h2>Map</h2><span class="map-explored"></span><span class="close-hint">M / Esc to close</span></div>
          <div class="map-wrap"><canvas class="map-canvas" width="720" height="720"></canvas></div>
          <div class="map-legend"><span><i class="lg base"></i>Base</span><span><i class="lg you"></i>You</span><span><i class="lg poi"></i>Discovered place</span><span><i class="lg air"></i>Air vent</span><span><i class="lg shard"></i>Shard recovered here</span></div>
        </div>
      </div>
      <div id="inventory" class="screen panel-screen hidden">
        <div class="panel wide">
          <div class="tabs"><button data-tab="inv" class="active">Inventory</button><button data-tab="journal">Journal</button><span class="close-hint">Tab / Esc to close</span></div>
          <div class="tab tab-inv"></div>
          <div class="tab tab-journal hidden"><div class="j-list"></div><div class="j-text"></div></div>
        </div>
      </div>
      <div id="shop" class="screen panel-screen hidden">
        <div class="panel wide">
          <div class="map-head"><h2>Upgrade Console</h2><span class="shop-pearls"></span><span class="close-hint">Esc to close</span></div>
          <div class="shop-grid"></div>
        </div>
      </div>
      <div id="reader" class="screen panel-screen hidden">
        <div class="panel reader-panel">
          <div class="reader-tag"></div>
          <h2 class="reader-title"></h2>
          <div class="reader-text"></div>
          <div class="close-hint">E / Esc to close</div>
        </div>
      </div>
      <div id="blackout" class="hidden"><div class="bo-text"></div></div>
      <div id="click-resume" class="hidden">Click to resume</div>
      <div id="cutscene" class="hidden"><div class="bar top"></div><div class="bar bottom"></div><div class="caption"></div><div class="skip">Hold E to skip</div></div>
      <div id="ending" class="screen panel-screen hidden">
        <div class="panel small ending-panel">
          <div class="logo"><div class="logo-main small">ATLANTIS</div><div class="logo-sub">LIVES AGAIN</div></div>
          <div class="ending-stats"></div>
          <div class="menu"><button data-act="explore">Keep Exploring</button><button data-act="title">Return to Title</button></div>
        </div>
      </div>
    `;
    const q = (s) => r.querySelector(s);
    this.hud = q('#hud');
    this.els = {
      compassStrip: q('.compass-strip'), compassMarkers: q('.compass-markers'),
      zbName: q('.zb-name'), zbSub: q('.zb-sub'), zoneBanner: q('.zone-banner'),
      warning: q('.warning'), wText: q('.w-text'), wSub: q('.w-sub'),
      toasts: q('.toasts'), shards: q('.shards'), pearlCount: q('.pearl-count'), pearls: q('.pearls'),
      depthVal: q('.depth-val'), depthFill: q('.depth-fill'), depthLimit: q('.depth-limit'), depthMax: q('.depth-max'),
      o2Fill: q('.o2-fill'), o2Val: q('.o2-val'), o2Refill: q('.o2-refill'), o2: q('.o2'),
      prompt: q('.prompt'), hurt: q('.hurt'), vignette: q('.vignette'),
      siLight: q('.si-light'), siSonar: q('.si-sonar'), siDolphin: q('.si-dolphin'),
      saveInd: q('.save-ind'), sonarLayer: q('.sonar-layer'),
      celebrate: q('.celebrate'), celGem: q('.cel-gem'), celTitle: q('.cel-title'), celSub: q('.cel-sub'),
    };
    this.screens = {
      title: q('#title'), loading: q('#loading'), pause: q('#pause'), settings: q('#settings'), controls: q('#controls'),
      map: q('#map'), inventory: q('#inventory'), shop: q('#shop'), reader: q('#reader'), ending: q('#ending'),
    };
    this.blackoutEl = q('#blackout');
    this.clickResume = q('#click-resume');
    this.cutsceneEl = q('#cutscene');

    // compass ticks
    const strip = this.els.compassStrip;
    const labels = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' };
    for (let rep = -1; rep <= 1; rep++) {
      for (let d = 0; d < 360; d += 15) {
        const t = el('span', labels[d] ? 'tick major' : 'tick', labels[d] || '');
        t.style.left = `${(d + rep * 360) * 2}px`;
        strip.appendChild(t);
      }
    }
    // shard slots
    for (const id of SHARD_IDS) {
      const s = el('div', 'shard-slot');
      s.style.setProperty('--c', hex(SHARD_COLORS[id]));
      s.title = SHARD_NAMES[id];
      s.dataset.id = id;
      this.els.shards.appendChild(s);
    }

    // button wiring
    r.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      this.game.audio.play('click');
      this.onAction(b.dataset.act, b);
    });
    this.clickResume.addEventListener('click', () => this.game.input.lock());
    // settings inputs
    for (const inp of r.querySelectorAll('[data-set]')) {
      inp.addEventListener('input', () => this.readSettings());
    }
    // inventory tabs
    for (const t of r.querySelectorAll('[data-tab]')) {
      t.addEventListener('click', () => this.showTab(t.dataset.tab));
    }
  }

  bindMenuKeys() {
    window.addEventListener('keydown', (e) => {
      const g = this.game;
      if (g.mode === 'menu' && g.menuName === 'reader' && e.code === 'KeyE' && !e.repeat) {
        this.closeAllMenus();
        g.closeMenu();
        g.input.pressed.delete('KeyE'); // don't re-trigger the interactable this frame
      }
      if (g.mode === 'title' || g.mode === 'paused') {
        if (e.code === 'Escape' && this.subScreen) {
          this.closeSub();
        }
      }
    });
  }

  onAction(act, btn) {
    const g = this.game;
    switch (act) {
      case 'new':
        if (hasSave() && !confirm('Start a new game? Your saved progress will be replaced when the game next saves.')) return;
        g.startNew();
        break;
      case 'continue':
        if (hasSave()) g.continueGame();
        break;
      case 'settings': this.openSub('settings'); break;
      case 'controls': this.openSub('controls'); break;
      case 'back': this.closeSub(); break;
      case 'resume': g.resume(); break;
      case 'save': g.save(false); break;
      case 'quit':
        g.save(true);
        g.mode = 'title';
        window.location.reload();
        break;
      case 'delete-save':
        if (confirm('Delete your saved game? This cannot be undone.')) {
          deleteSave();
          this.refreshTitle();
          this.toast('Saved game deleted.', 'info');
        }
        break;
      case 'buy': this.buy(btn.dataset.id); break;
      case 'explore':
        this.screens.ending.classList.add('hidden');
        g.ending.keepExploring();
        break;
      case 'title':
        g.save(true);
        g.mode = 'title';
        window.location.reload();
        break;
      default: break;
    }
  }

  // ---- Title / pause / settings ----
  setLoading(text) {
    this.screens.loading.querySelector('.load-text').textContent = text;
  }

  showTitle() {
    this.screens.loading.classList.add('hidden');
    this.screens.title.classList.remove('hidden');
    this.refreshTitle();
  }

  refreshTitle() {
    const info = saveInfo();
    const cont = this.screens.title.querySelector('[data-act="continue"]');
    cont.disabled = !info;
    this.screens.title.querySelector('.save-info').textContent = info
      ? `Saved game: ${info.shards}/7 shards · ${formatTime(info.playTime)} played`
      : '';
  }

  hideTitle() {
    this.screens.title.classList.add('hidden');
  }

  showHUD(on) {
    this.hud.classList.toggle('hidden', !on);
  }

  showPause(on) {
    this.screens.pause.classList.toggle('hidden', !on);
    if (!on) this.closeSub();
    if (on) {
      const s = this.game.state;
      this.screens.pause.querySelector('.pause-stats').innerHTML =
        `Shards ${s.shards.size}/7 · Pearls ${s.pearls} · Relics ${s.relics.size}/${RELIC_ORDER.length} · Time ${formatTime(s.playTime)}`;
    }
  }

  openSub(name) {
    this.subScreen = name;
    this.screens[name].classList.remove('hidden');
    if (name === 'settings') this.writeSettings();
  }

  closeSub() {
    if (!this.subScreen) return;
    this.screens[this.subScreen].classList.add('hidden');
    this.subScreen = null;
  }

  writeSettings() {
    const s = this.game.settings;
    for (const inp of this.screens.settings.querySelectorAll('[data-set]')) {
      const k = inp.dataset.set;
      if (inp.type === 'checkbox') inp.checked = !!s[k];
      else inp.value = s[k];
      const v = inp.parentElement.querySelector('.val');
      if (v) v.textContent = k === 'sensitivity' ? Number(s[k]).toFixed(2) : `${Math.round(s[k] * 100)}%`;
    }
  }

  readSettings() {
    const out = {};
    for (const inp of this.screens.settings.querySelectorAll('[data-set]')) {
      const k = inp.dataset.set;
      if (inp.type === 'checkbox') out[k] = inp.checked;
      else if (inp.tagName === 'SELECT') out[k] = inp.value;
      else out[k] = parseFloat(inp.value);
    }
    this.game.applySettings(out);
    this.writeSettings();
  }

  showClickToResume(on) {
    this.clickResume.classList.toggle('hidden', !on || this.game.mode !== 'playing');
  }

  closeAllMenus() {
    for (const k of ['map', 'inventory', 'shop', 'reader']) this.screens[k].classList.add('hidden');
  }

  // ---- HUD ----
  updateHUD(dt, atm) {
    const g = this.game;
    if (g.mode === 'title') return;
    const p = g.player;
    const s = g.state;
    const surv = g.survival;
    // oxygen
    const frac = clamp(surv.oxygen / surv.max, 0, 1);
    this.els.o2Fill.style.width = `${frac * 100}%`;
    this.els.o2Fill.style.background = frac > 0.5 ? 'linear-gradient(90deg,#2fd6c8,#7ff3ff)' : frac > 0.25 ? 'linear-gradient(90deg,#e0b33a,#ffe08a)' : 'linear-gradient(90deg,#e0453a,#ff8a7a)';
    const secs = Math.ceil(surv.oxygen / (p.sprinting ? 2.3 : 1));
    this.els.o2Val.textContent = `${Math.round(frac * 100)}% · ${secs}s`;
    this.els.o2Refill.style.opacity = surv.refilling ? 1 : 0;
    this.els.o2.classList.toggle('low', frac < 0.25);
    this.els.vignette.style.opacity = 0.55 + (frac < 0.25 ? (0.25 - frac) * 1.6 : 0);
    // depth
    const depth = Math.max(0, -p.pos.y);
    const maxD = surv.maxDepth;
    this.els.depthVal.textContent = `${depth.toFixed(0)} m`;
    const scale = 200;
    this.els.depthFill.style.width = `${clamp(depth / scale, 0, 1) * 100}%`;
    this.els.depthLimit.style.left = `${clamp(maxD / scale, 0, 1) * 100}%`;
    this.els.depthLimit.style.display = maxD >= 300 ? 'none' : 'block';
    this.els.depthMax.textContent = maxD >= 300 ? 'no limit' : `max ${maxD} m`;
    this.els.depthVal.classList.toggle('danger', depth > maxD);
    // compass
    const heading = ((-p.yaw * 180) / Math.PI) % 360;
    const hd = (heading + 360) % 360;
    this.els.compassStrip.style.transform = `translateX(${-hd * 2 + 180}px)`;
    this.updateCompassMarkers(hd);
    // shards / pearls
    for (const slot of this.els.shards.children) slot.classList.toggle('have', s.shards.has(slot.dataset.id));
    this.els.pearlCount.textContent = s.pearls;
    // status icons
    this.els.siLight.classList.toggle('on', p.flashlightOn);
    this.els.siSonar.style.display = s.upgrades.sonar > 0 ? '' : 'none';
    this.els.siSonar.classList.toggle('on', g.sonar.cooldown <= 0);
    this.els.siDolphin.style.display = s.flags.companion ? '' : 'none';
    // toasts
    for (const t of this.toasts) {
      t.life -= dt;
      if (t.life < 0.6) t.el.classList.add('out');
      if (t.life <= 0) t.el.remove();
    }
    this.toasts = this.toasts.filter((t) => t.life > 0);
    this.updateSonarMarkers(dt);
  }

  updateCompassMarkers(heading) {
    const g = this.game;
    const p = g.player.pos;
    const marks = [{ x: BASE_POS.x, z: BASE_POS.z, icon: '⌂', cls: 'base' }];
    if (g.companionHint) marks.push({ x: g.companionHint.x, z: g.companionHint.z, icon: '🐬', cls: 'dolphin' });
    if (g.state.shards.size >= 7 && !g.state.ended) marks.push({ x: 0, z: -250, icon: '◆', cls: 'palace' });
    let html = '';
    for (const m of marks) {
      const dx = m.x - p.x, dz = m.z - p.z;
      if (Math.hypot(dx, dz) < 8) continue;
      const bearing = ((Math.atan2(dx, -dz) * 180) / Math.PI + 360) % 360;
      let diff = ((bearing - heading + 540) % 360) - 180;
      if (Math.abs(diff) > 90) continue;
      html += `<span class="cm ${m.cls}" style="left:${180 + diff * 2}px">${m.icon}</span>`;
    }
    if (html !== this._lastCompass) {
      this.els.compassMarkers.innerHTML = html;
      this._lastCompass = html;
    }
  }

  setPrompt(text) {
    if (text === this._prompt) return;
    this._prompt = text;
    this.els.prompt.innerHTML = text ? `<span class="key">E</span>${text}` : '';
    this.els.prompt.style.opacity = text ? 1 : 0;
  }

  setWarning(w) {
    const key = w ? w.text : '';
    if (key === this._warn) return;
    this._warn = key;
    this.els.warning.classList.toggle('show', !!w);
    if (w) {
      this.els.wText.textContent = w.text;
      this.els.wSub.textContent = w.sub || '';
      this.els.warning.dataset.level = w.level;
    }
  }

  toast(text, kind = 'info', sub = '') {
    const t = el('div', `toast ${kind}`, `<div class="t-main"></div>${sub ? '<div class="t-sub"></div>' : ''}`);
    t.querySelector('.t-main').textContent = text;
    if (sub) t.querySelector('.t-sub').textContent = sub;
    this.els.toasts.appendChild(t);
    this.toasts.push({ el: t, life: sub ? 6.5 : 4 });
    while (this.toasts.length > 5) {
      const old = this.toasts.shift();
      old.el.remove();
    }
  }

  pearlPing() {
    this.els.pearls.classList.remove('ping');
    void this.els.pearls.offsetWidth;
    this.els.pearls.classList.add('ping');
  }

  showZoneBanner(zone) {
    this.els.zbName.textContent = zone.name;
    this.els.zbSub.textContent = zone.subtitle || '';
    const b = this.els.zoneBanner;
    b.classList.remove('show');
    void b.offsetWidth;
    b.classList.add('show');
  }

  hurt(source) {
    const h = this.els.hurt;
    h.dataset.src = source;
    h.classList.remove('flash');
    void h.offsetWidth;
    h.classList.add('flash');
  }

  saveIndicator(ok) {
    const s = this.els.saveInd;
    s.textContent = ok ? 'Progress saved' : 'Could not save (storage unavailable)';
    s.classList.remove('show');
    void s.offsetWidth;
    s.classList.add('show');
  }

  shardCelebration(shardId, n) {
    const c = this.els.celebrate;
    this.els.celGem.style.setProperty('--c', hex(SHARD_COLORS[shardId]));
    this.els.celTitle.textContent = SHARD_NAMES[shardId];
    this.els.celSub.textContent = `${n} / 7`;
    c.classList.remove('show');
    void c.offsetWidth;
    c.classList.add('show');
  }

  blackout(midpoint) {
    const b = this.blackoutEl;
    b.querySelector('.bo-text').textContent = 'Everything goes dark...';
    b.classList.remove('hidden');
    b.classList.add('fade-in');
    setTimeout(() => {
      midpoint();
      b.querySelector('.bo-text').textContent = '';
      b.classList.remove('fade-in');
      b.classList.add('fade-out');
      setTimeout(() => { b.classList.add('hidden'); b.classList.remove('fade-out'); }, 1600);
    }, 2600);
  }

  // ---- Sonar markers ----
  setSonarMarkers(list, ttl) {
    this.els.sonarLayer.innerHTML = '';
    this.sonarMarkers = list.slice(0, 80).map((t) => {
      const m = el('div', `sonar-mark ${t.type}`, MARKER_ICON[t.type] || '•');
      if (t.label) m.title = t.label;
      this.els.sonarLayer.appendChild(m);
      return { el: m, pos: t.pos };
    });
    this.sonarTTL = ttl;
  }

  updateSonarMarkers(dt) {
    if (this.sonarTTL <= 0) return;
    this.sonarTTL -= dt;
    const cam = this.game.camera;
    const w = window.innerWidth, h = window.innerHeight;
    const alpha = clamp(this.sonarTTL / 2, 0, 1);
    for (const m of this.sonarMarkers) {
      v3.copy(m.pos).project(cam);
      const visible = v3.z < 1 && v3.z > -1 && Math.abs(v3.x) < 1.1 && Math.abs(v3.y) < 1.1;
      m.el.style.display = visible ? 'block' : 'none';
      if (visible) {
        m.el.style.transform = `translate(${(v3.x * 0.5 + 0.5) * w}px, ${(-v3.y * 0.5 + 0.5) * h}px) translate(-50%,-50%)`;
        m.el.style.opacity = alpha;
      }
    }
    if (this.sonarTTL <= 0) this.els.sonarLayer.innerHTML = '';
  }

  // ---- Reader ----
  showReader(journalId, isNew) {
    const entry = JOURNAL[journalId];
    if (!entry) return;
    if (!this.game.openMenu('reader')) return;
    const r = this.screens.reader;
    r.dataset.kind = entry.kind;
    r.querySelector('.reader-tag').textContent = (isNew ? 'New journal entry · ' : '') + { page: "Keeper's Journal", carving: 'Carving', log: 'Expedition Log' }[entry.kind];
    r.querySelector('.reader-title').textContent = entry.title;
    r.querySelector('.reader-text').textContent = entry.text;
    r.classList.remove('hidden');
  }

  // ---- Shop ----
  openShop() {
    if (!this.game.openMenu('shop')) return;
    this.renderShop();
    this.screens.shop.classList.remove('hidden');
  }

  renderShop() {
    const s = this.game.state;
    this.screens.shop.querySelector('.shop-pearls').innerHTML = `<span class="pearl-icon"></span> ${s.pearls} pearls`;
    const grid = this.screens.shop.querySelector('.shop-grid');
    grid.innerHTML = '';
    for (const id of UPGRADE_ORDER) {
      const u = UPGRADES[id];
      const lvl = s.upgrades[id] || 0;
      const maxed = lvl >= u.levels.length;
      const next = maxed ? null : u.levels[lvl];
      const card = el('div', `shop-card ${maxed ? 'maxed' : ''}`);
      const pips = u.levels.map((_, i) => `<i class="${i < lvl ? 'on' : ''}"></i>`).join('');
      card.innerHTML = `
        <div class="sc-icon">${u.icon}</div>
        <div class="sc-name">${u.name}</div>
        <div class="sc-pips">${pips}</div>
        <div class="sc-desc">${u.desc}</div>
        <div class="sc-next">${maxed ? 'Fully upgraded' : `Next: ${next.label}`}</div>
        ${maxed ? '' : `<button data-act="buy" data-id="${id}" ${s.pearls < next.cost ? 'disabled' : ''}><span class="pearl-icon"></span> ${next.cost}</button>`}
      `;
      grid.appendChild(card);
    }
  }

  buy(id) {
    const g = this.game;
    const s = g.state;
    const u = UPGRADES[id];
    const lvl = s.upgrades[id] || 0;
    if (lvl >= u.levels.length) return;
    const cost = u.levels[lvl].cost;
    if (s.pearls < cost) return;
    s.pearls -= cost;
    s.upgrades[id] = lvl + 1;
    g.audio.play('buy');
    if (id === 'tank') g.survival.oxygen = g.survival.max;
    if (id === 'light') g.player.applyFlashlight();
    this.toast(`Installed: ${u.levels[lvl].label}`, 'buy', id === 'sonar' ? 'Press Q to send a sonar pulse.' : id === 'light' ? 'Press F to switch on your new lamp.' : '');
    g.save(true);
    this.renderShop();
  }

  // ---- Map ----
  openMap() {
    if (!this.game.openMenu('map')) return;
    this.game.map.ensureReady();
    this.drawMap();
    this.screens.map.classList.remove('hidden');
  }

  drawMap() {
    const g = this.game;
    const md = g.map;
    const cv = this.screens.map.querySelector('.map-canvas');
    const ctx = cv.getContext('2d');
    const S = cv.width;
    const toPx = (x) => ((x + WORLD_HALF) / (WORLD_HALF * 2)) * S;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(md.canvas, 0, 0, S, S);
    // fog of war
    const N = md.grid, cs = S / N;
    ctx.fillStyle = '#04121c';
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        if (!md.isRevealed(i, j)) ctx.fillRect(i * cs - 0.5, j * cs - 0.5, cs + 1, cs + 1);
      }
    }
    // soft edge pass: darken grid lines slightly for a parchment-ish look
    ctx.strokeStyle = 'rgba(127,243,255,0.06)';
    ctx.lineWidth = 1;
    for (let k = 0; k <= 16; k++) {
      ctx.beginPath(); ctx.moveTo(k * S / 16, 0); ctx.lineTo(k * S / 16, S); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, k * S / 16); ctx.lineTo(S, k * S / 16); ctx.stroke();
    }
    const revealedAt = (x, z) => {
      const c = md.cellIndex(x, z);
      return c >= 0 && md.revealed[c] === 1;
    };
    // zone names
    ctx.textAlign = 'center';
    ctx.font = '600 15px Georgia, serif';
    for (const z of ZONES) {
      if (!g.state.discovered.has(`zone:${z.id}`)) continue;
      ctx.fillStyle = 'rgba(220,250,255,0.55)';
      ctx.fillText(z.name.toUpperCase(), toPx(z.x), toPx(z.z) - z.r * S / (WORLD_HALF * 2) * 0.55);
    }
    // air vents
    for (const v of g.world.airVents) {
      if (!revealedAt(v.x, v.z)) continue;
      ctx.strokeStyle = '#bff8ff';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(toPx(v.x), toPx(v.z), 3.5, 0, Math.PI * 2); ctx.stroke();
    }
    // landmarks
    ctx.font = '12px system-ui, sans-serif';
    for (const lm of LANDMARKS) {
      if (!g.state.discovered.has(lm.id)) continue;
      const x = toPx(lm.x), y = toPx(lm.z);
      ctx.fillStyle = lm.icon === 'base' ? '#ffd166' : lm.icon === 'palace' ? '#c59bff' : '#7ff3ff';
      ctx.beginPath();
      if (lm.icon === 'base') ctx.rect(x - 6, y - 6, 12, 12);
      else { ctx.moveTo(x, y - 7); ctx.lineTo(x + 6, y); ctx.lineTo(x, y + 7); ctx.lineTo(x - 6, y); ctx.closePath(); }
      ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      const w = ctx.measureText(lm.name).width;
      ctx.fillRect(x - w / 2 - 4, y + 9, w + 8, 16);
      ctx.fillStyle = '#e8fbff';
      ctx.fillText(lm.name, x, y + 21);
    }
    // recovered shards
    for (const sh of g.items.shards) {
      if (!sh.taken) continue;
      const x = toPx(sh.model.position.x), y = toPx(sh.model.position.z);
      ctx.fillStyle = hex(SHARD_COLORS[sh.shardId]);
      ctx.beginPath(); ctx.moveTo(x, y - 6); ctx.lineTo(x + 3.5, y); ctx.lineTo(x, y + 6); ctx.lineTo(x - 3.5, y); ctx.closePath(); ctx.fill();
    }
    // player arrow
    const p = g.player;
    const px = toPx(p.pos.x), py = toPx(p.pos.z);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(-p.yaw);
    ctx.fillStyle = '#ff5e57';
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, -11); ctx.lineTo(7, 8); ctx.lineTo(0, 4); ctx.lineTo(-7, 8); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.restore();
    // compass rose
    ctx.fillStyle = 'rgba(232,251,255,0.8)';
    ctx.font = 'bold 14px Georgia, serif';
    ctx.fillText('N', S - 30, 30);
    ctx.beginPath(); ctx.moveTo(S - 30, 36); ctx.lineTo(S - 25, 52); ctx.lineTo(S - 35, 52); ctx.closePath(); ctx.fill();
    this.screens.map.querySelector('.map-explored').textContent = `${Math.round(md.revealedFraction() * 100)}% explored · Depth shown by shade`;
  }

  // ---- Inventory / journal ----
  openInventory() {
    if (!this.game.openMenu('inventory')) return;
    this.renderInventory();
    this.renderJournal();
    this.screens.inventory.classList.remove('hidden');
  }

  showTab(tab) {
    const inv = this.screens.inventory;
    for (const b of inv.querySelectorAll('[data-tab]')) b.classList.toggle('active', b.dataset.tab === tab);
    inv.querySelector('.tab-inv').classList.toggle('hidden', tab !== 'inv');
    inv.querySelector('.tab-journal').classList.toggle('hidden', tab !== 'journal');
  }

  renderInventory() {
    const s = this.game.state;
    const box = this.screens.inventory.querySelector('.tab-inv');
    const shards = SHARD_IDS.map((id) => `<div class="inv-shard ${s.shards.has(id) ? 'have' : ''}" style="--c:${hex(SHARD_COLORS[id])}"><div class="gem"></div><span>${s.shards.has(id) ? SHARD_NAMES[id] : '???'}</span></div>`).join('');
    const relics = RELIC_ORDER.map((id) => {
      const have = s.relics.has(id);
      const d = RELICS[id];
      return `<div class="inv-relic ${have ? 'have' : ''}" title="${have ? d.desc.replace(/"/g, '&quot;') : 'Not found yet'}"><div class="ri">${have ? RELIC_ICON[d.shape] : '?'}</div><span>${have ? d.name : 'Unknown relic'}</span></div>`;
    }).join('');
    const ups = UPGRADE_ORDER.map((id) => {
      const u = UPGRADES[id];
      const lvl = s.upgrades[id] || 0;
      return `<div class="inv-up ${lvl ? 'have' : ''}">${u.icon} ${u.name} <b>${lvl ? u.levels[lvl - 1].label : '—'}</b></div>`;
    }).join('');
    box.innerHTML = `
      <h3>Crystal Shards <small>${s.shards.size} / 7</small></h3><div class="inv-shards">${shards}</div>
      <div class="inv-row"><div><h3>Pearls</h3><div class="big-pearls"><span class="pearl-icon"></span> ${s.pearls}</div></div>
      <div><h3>Gear</h3><div class="inv-ups">${ups}</div><div class="inv-depth">Max safe depth: ${upgradeValue('pressure', s.upgrades.pressure) >= 300 ? 'no limit' : upgradeValue('pressure', s.upgrades.pressure) + ' m'} · Tank: ${upgradeValue('tank', s.upgrades.tank)} O₂</div></div></div>
      <h3>Relics <small>${s.relics.size} / ${RELIC_ORDER.length} — found relics are displayed at your base</small></h3><div class="inv-relics">${relics}</div>
    `;
  }

  renderJournal(selected) {
    const s = this.game.state;
    const list = this.screens.inventory.querySelector('.j-list');
    const text = this.screens.inventory.querySelector('.j-text');
    const found = JOURNAL_ORDER.filter((id) => s.journal.has(id));
    const count = (k) => JOURNAL_ORDER.filter((id) => JOURNAL[id].kind === k);
    const header = `<div class="j-counts">Logs ${count('log').filter((i) => s.journal.has(i)).length}/${count('log').length} · Keeper's pages ${count('page').filter((i) => s.journal.has(i)).length}/${count('page').length} · Carvings ${count('carving').filter((i) => s.journal.has(i)).length}/${count('carving').length}</div>`;
    list.innerHTML = header + (found.length ? found.map((id) => `<button class="j-item ${JOURNAL[id].kind} ${id === selected ? 'sel' : ''}" data-j="${id}">${JOURNAL[id].title}</button>`).join('') : '<p class="note">Nothing yet. Read the expedition log at the base.</p>');
    const sel = selected || found[found.length - 1];
    if (sel) {
      text.innerHTML = '<h2></h2><div class="jt"></div>';
      text.querySelector('h2').textContent = JOURNAL[sel].title;
      text.querySelector('.jt').textContent = JOURNAL[sel].text;
    } else text.innerHTML = '';
    for (const b of list.querySelectorAll('[data-j]')) b.addEventListener('click', () => this.renderJournal(b.dataset.j));
  }

  // ---- Cutscene ----
  letterbox(on) {
    this.cutsceneEl.classList.toggle('hidden', !on);
    this.showHUD(!on);
  }

  caption(text) {
    const c = this.cutsceneEl.querySelector('.caption');
    c.classList.remove('show');
    void c.offsetWidth;
    c.textContent = text || '';
    if (text) c.classList.add('show');
  }

  showEnding(stats) {
    const e = this.screens.ending;
    e.querySelector('.ending-stats').innerHTML = stats;
    e.classList.remove('hidden');
  }
}
