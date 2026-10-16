// Time travel screen: globe + non-linear timeline + typed year + favourites + random + landmarks + Moon.
import { h, UI_ROOT } from './dom';
import { Globe } from './Globe';
import type { EarthData } from '../geo/earth';
import { ERAS, LANDMARKS, era as getEra } from '../data';
import { sliderToYear, yearToSlider, formatYear, parseYear, eraForYear, snapYear } from '../core/timeScale';
import { describePlace } from '../geo/places';
import { pastToPresent, driftFactor } from '../geo/paleo';
import { landmarkPos, snapLandmark } from '../gen/plan';
import type { Favorite, GameState } from '../game/state';
import { jumpCost } from '../game/energy';
import { Rng } from '../core/rng';

const ERA_COLORS: Record<string, string> = {
  dinosaurs: '#8ac46a', mammals: '#b8c46a', iceage: '#a8d0e8', stoneage: '#c8b48a', earlyciv: '#e8c87a', classical: '#ffd27a',
  medieval: '#9ac89a', exploration: '#e8a87a', industrial: '#c8a88a', modern: '#8ab8e8', nearfuture: '#7ae8e0', farfuture: '#c8a0ff',
};

export interface TravelTarget { lat: number; lon: number; year: number; moon: boolean; name: string }

export class TimeTravelScreen {
  readonly el: HTMLElement;
  globe: Globe;
  private sel: { lat: number; lon: number; moon: boolean } = { lat: 0, lon: 0, moon: false };
  private year = 2000;
  private nameEl: HTMLElement;
  private subEl: HTMLElement;
  private yearEl: HTMLElement;
  private eraEl: HTMLElement;
  private descEl: HTMLElement;
  private costEl: HTMLElement;
  private goBtn: HTMLButtonElement;
  private slider: HTMLInputElement;
  private yearInput: HTMLInputElement;
  private favsEl: HTMLElement;
  private lmSelect: HTMLSelectElement;
  private moonBtn: HTMLButtonElement;
  private objBtn: HTMLButtonElement;
  private bands: HTMLElement;
  private warn: HTMLElement;
  onTravel: ((t: TravelTarget) => void) | null = null;
  onClose: (() => void) | null = null;
  private state!: GameState;
  private current!: { lat: number; lon: number; year: number; moon: boolean };
  private objective: { lat: number; lon: number; year: number; moon: boolean; label: string } | null = null;

  constructor(private earth: EarthData) {
    this.globe = new Globe(earth);
    this.globe.onPick = (lat, lon) => { this.sel = { lat, lon, moon: this.sel.moon }; this.refresh(); };
    this.nameEl = h('div', { class: 'name' });
    this.subEl = h('div', { class: 'sub' });
    this.yearEl = h('div', { class: 'yearbox' });
    this.eraEl = h('div', { class: 'eraname' });
    this.descEl = h('div', { class: 'desc' });
    this.costEl = h('div', { class: 'cost' });
    this.warn = h('div', { class: 'desc', style: { color: 'var(--bad)' } });
    this.goBtn = h('button', { class: 'btn primary', onclick: () => this.travel() }, '⏳ Travel');
    this.yearInput = h('input', { type: 'text', placeholder: 'Type a year: 1500, 3000 BCE, 66 mya…', style: { flex: '1' }, onkeydown: (e: KeyboardEvent) => { if (e.key === 'Enter') this.applyTyped(); e.stopPropagation(); } }) as HTMLInputElement;
    this.slider = h('input', { type: 'range', min: '0', max: '1000', step: '1', oninput: () => { this.year = snapYear(sliderToYear(Number(this.slider.value) / 1000)); this.refresh(false); } }) as HTMLInputElement;
    this.bands = h('div', { class: 'bands' });
    const ticks = h('div', { class: 'ticks' });
    for (const y of [-66_000_000, -2_580_000, -11_700, -3500, 0, 1000, 1500, 1900, 2030, 3000]) ticks.append(h('span', { style: { left: `${yearToSlider(y) * 100}%` } }, shortYear(y)));
    this.favsEl = h('div', { class: 'favs' });
    this.lmSelect = h('select', { style: { flex: '1' }, onchange: () => this.pickLandmark() }) as HTMLSelectElement;
    this.moonBtn = h('button', { class: 'btn small', onclick: () => this.toggleMoon() }, '🌕 Moon');
    this.objBtn = h('button', { class: 'btn small gold', onclick: () => this.gotoObjective() }, '★ Objective');
    const side = h('div', { class: 'side panel' },
      h('div', { class: 'row2' }, h('h2', { style: { flex: '1' } }, 'Chronometer'), this.objBtn),
      h('div', { class: 'pick' }, this.nameEl, this.subEl),
      h('div', {}, this.yearEl, this.eraEl),
      this.descEl,
      this.costEl,
      this.warn,
      h('div', { class: 'row2' }, this.goBtn, h('button', { class: 'btn small', onclick: () => this.random() }, '🎲 Random place & time'), this.moonBtn),
      h('div', { class: 'section-title' }, 'Typed year'),
      h('div', { class: 'row2' }, this.yearInput, h('button', { class: 'btn small', onclick: () => this.applyTyped() }, 'Set')),
      h('div', { class: 'section-title' }, 'Landmarks'),
      h('div', { class: 'row2' }, this.lmSelect),
      h('div', { class: 'row2' }, h('div', { class: 'section-title', style: { flex: '1' } }, 'Favourite places'), h('button', { class: 'btn small', onclick: () => this.addFav() }, '☆ Save this')),
      this.favsEl,
    );
    const bottom = h('div', { class: 'bottom panel' }, h('div', { class: 'row2' }, h('span', { class: 'muted', style: { fontSize: '12px' } }, 'Timeline — drag to choose when. Recent history gets more room.')), h('div', { class: 'timeline' }, this.bands, this.slider, ticks));
    const close = h('button', { class: 'btn small close', onclick: () => this.onClose?.() }, '✕ Back to the world');
    const legend = h('div', { class: 'legend' }, 'Click the globe to choose where. Drag to spin, scroll to zoom. Gold dots are famous landmarks that exist in the chosen year.');
    this.el = h('div', { class: 'travel hidden' }, this.globe.canvas, side, bottom, close, legend);
    UI_ROOT().append(this.el);
  }

  open(state: GameState, current: { lat: number; lon: number; year: number; moon: boolean }, objective: TimeTravelScreen['objective']) {
    this.state = state;
    this.current = current;
    this.objective = objective;
    this.sel = { lat: current.lat, lon: current.lon, moon: current.moon };
    this.year = current.year;
    this.el.classList.remove('hidden');
    this.globe.setMoon(current.moon);
    this.globe.setMarker(current.lat, current.lon);
    this.globe.rotLat = current.lat;
    this.globe.rotLon = current.lon;
    this.globe.targetDist = 2.6;
    this.globe.start();
    this.buildBands();
    this.buildLandmarks();
    this.buildFavs();
    this.objBtn.classList.toggle('hidden', !objective || isNaN(objective.lat));
    this.moonBtn.disabled = !state.unlocks.moon;
    this.moonBtn.title = state.unlocks.moon ? 'Travel to the Moon' : 'Locked — repair the first Rift';
    this.refresh();
  }

  close() { this.el.classList.add('hidden'); this.globe.stop(); }
  get isOpen() { return !this.el.classList.contains('hidden'); }

  private buildBands() {
    this.bands.replaceChildren(...ERAS.map((e) => {
      const a = yearToSlider(e.start), b = yearToSlider(Math.min(3000, e.end));
      const locked = !this.state.unlocks.eras.includes(e.id);
      return h('div', { class: locked ? 'locked' : '', title: `${e.name}${locked ? ' (locked)' : ''}`, style: { width: `${(b - a) * 100}%`, background: ERA_COLORS[e.id] } }, (b - a) > 0.05 ? e.name : '');
    }));
  }

  private buildLandmarks() {
    const opts = [h('option', { value: '' }, 'Jump to a landmark…')];
    const list = [...LANDMARKS].filter((l) => l.region !== 'moon').sort((a, b) => a.name.localeCompare(b.name));
    for (const l of list) opts.push(h('option', { value: l.id }, `${l.name}${l.kind === 'natural' ? ' 🌿' : l.kind === 'imagined' ? ' ✨' : ''}`));
    this.lmSelect.replaceChildren(...opts);
  }

  private buildFavs() {
    this.favsEl.replaceChildren(...this.state.favorites.map((f, i) => h('div', { class: 'fav', onclick: () => this.applyFav(f) },
      h('span', {}, `${f.moon ? '🌕 ' : ''}${f.name} · ${formatYear(f.year)}`),
      h('button', { class: 'btn small', onclick: (e: Event) => { e.stopPropagation(); this.state.favorites.splice(i, 1); this.buildFavs(); } }, '✕'))));
  }

  private applyFav(f: Favorite) {
    this.sel = { lat: f.lat, lon: f.lon, moon: f.moon };
    this.year = f.year;
    this.globe.setMoon(f.moon);
    if (!f.moon) { this.globe.setMarker(f.lat, f.lon); this.globe.flyTo(f.lat, f.lon); }
    this.refresh();
  }

  private addFav() {
    this.state.favorites.unshift({ name: this.nameEl.textContent ?? 'Somewhere', lat: this.sel.lat, lon: this.sel.lon, year: this.year, moon: this.sel.moon });
    this.state.favorites = this.state.favorites.slice(0, 20);
    this.buildFavs();
  }

  private pickLandmark() {
    const l = LANDMARKS.find((x) => x.id === this.lmSelect.value);
    if (!l) return;
    // choose a year when it looks its best (complete), else its first stage
    const st = l.stages.find((s) => s.state === 'complete') ?? l.stages[l.stages.length - 1];
    let y = Math.max(st.from + 5, l.kind === 'natural' ? 2000 : st.from + 5);
    if (l.kind === 'natural') y = 1900 + Math.round(Math.random() * 120);
    if (!this.state.unlocks.eras.includes(eraForYear(y).id)) y = Math.max(-3400, Math.min(2190, y));
    this.year = Math.min(3000, y);
    const [lat, lon] = landmarkPos(this.earth, l, this.year);
    this.sel = { lat, lon, moon: false };
    this.globe.setMoon(false);
    this.globe.setMarker(lat, lon);
    this.globe.flyTo(lat, lon, 2.0);
    this.refresh();
  }

  private toggleMoon() {
    this.sel.moon = !this.sel.moon;
    if (this.sel.moon) { this.sel.lat = 0.67; this.sel.lon = 23.47; }
    this.globe.setMoon(this.sel.moon);
    this.refresh();
  }

  private gotoObjective() {
    const o = this.objective;
    if (!o || isNaN(o.lat)) return;
    this.sel = { lat: o.lat, lon: o.lon, moon: o.moon };
    this.year = o.year;
    this.globe.setMoon(o.moon);
    if (!o.moon) { this.globe.setMarker(o.lat, o.lon); this.globe.flyTo(o.lat, o.lon, 2.0); }
    this.refresh();
  }

  private applyTyped() {
    const y = parseYear(this.yearInput.value);
    if (y === null) { this.warn.textContent = "Couldn't read that year. Try 1500, 3000 BCE or 70 million years ago."; return; }
    this.year = y;
    this.refresh();
  }

  private random() {
    const rng = new Rng((Date.now() & 0xffffff) ^ 0x51);
    const unlocked = ERAS.filter((e) => this.state.unlocks.eras.includes(e.id));
    for (let i = 0; i < 200; i++) {
      const lat = rng.range(-60, 72), lon = rng.range(-180, 180);
      const e = rng.pick(unlocked);
      const year = Math.round(rng.range(e.start, Math.min(e.end, 3000)));
      const src = driftFactor(year) ? pastToPresent(this.earth, lat, lon, year) : { lat, lon, plate: 0 };
      if (!src || this.earth.landAt(src.lat, src.lon) < 0.6) continue;
      this.sel = { lat, lon, moon: false };
      this.year = snapYear(year);
      this.globe.setMoon(false);
      this.globe.setMarker(lat, lon);
      this.globe.flyTo(lat, lon, 2.4);
      break;
    }
    this.refresh();
  }

  private refresh(updateSlider = true) {
    const y = this.year;
    if (updateSlider) this.slider.value = String(Math.round(yearToSlider(y) * 1000));
    this.globe.setYear(this.sel.moon ? 2000 : y);
    const e = eraForYear(y);
    this.el.style.setProperty('--era', ERA_COLORS[e.id]);
    this.yearEl.textContent = formatYear(y);
    this.eraEl.textContent = e.name;
    this.descEl.textContent = e.description;
    // landmark pins for this year
    if (!this.sel.moon) this.globe.setPins(LANDMARKS.filter((l) => l.region !== 'moon' && l.stages[0].from <= y).map((l) => landmarkPos(this.earth, l, y)));
    else this.globe.setPins([]);
    // place
    if (this.sel.moon) { this.nameEl.textContent = 'Sea of Tranquility, the Moon'; this.subEl.textContent = 'Low gravity · no air · black sky'; }
    else {
      const snapped = snapLandmark(this.sel.lat, this.sel.lon, y, false, this.earth);
      const src = driftFactor(y) ? pastToPresent(this.earth, this.sel.lat, this.sel.lon, y) : { lat: this.sel.lat, lon: this.sel.lon, plate: 0 };
      const land = src ? this.earth.landAt(src.lat, src.lon) : 0;
      const p = describePlace(this.earth, src?.lat ?? this.sel.lat, src?.lon ?? this.sel.lon, y, land);
      this.nameEl.textContent = snapped ? `${snapped.name}` : p.name;
      this.subEl.textContent = `${Math.abs(this.sel.lat).toFixed(2)}°${this.sel.lat >= 0 ? 'N' : 'S'} ${Math.abs(this.sel.lon).toFixed(2)}°${this.sel.lon >= 0 ? 'E' : 'W'}` + (snapped ? ` · ${p.name}` : '') + (driftFactor(y) ? ' · continents have drifted since then' : '');
    }
    // cost + locks
    const cost = jumpCost(this.current, { lat: this.sel.lat, lon: this.sel.lon, year: y, moon: this.sel.moon });
    const locked = !this.state.unlocks.eras.includes(e.id);
    const tooPoor = cost > this.state.energy;
    this.costEl.replaceChildren(h('span', {}, `Energy cost: ${cost}`), h('span', { class: tooPoor ? 'bad' : '' }, `You have ${Math.floor(this.state.energy)}`));
    this.warn.textContent = locked ? `🔒 ${e.name} is locked. Repair Major Rifts or return anomalies to reach it.` : tooPoor ? 'Not enough chrono energy. It slowly recharges, and returning anomalies gives more.' : '';
    this.goBtn.disabled = locked || tooPoor;
    void getEra;
  }

  private travel() {
    this.onTravel?.({ lat: this.sel.lat, lon: this.sel.lon, year: this.year, moon: this.sel.moon, name: this.nameEl.textContent ?? '' });
  }

  get selection() { return { ...this.sel, year: this.year }; }
}

function shortYear(y: number): string {
  if (y <= -1_000_000) return `${Math.round(-y / 1_000_000)} Ma`;
  if (y <= -10_000) return `${Math.round(-y / 1000)}k ya`;
  if (y < 0) return `${-y} BCE`;
  if (y === 0) return '1 CE';
  return String(y);
}
