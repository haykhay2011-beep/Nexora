// In-game HUD: place/year, compass, anomaly radar, energy, prompts, objectives, toasts, subtitles.
import { h, UI_ROOT } from './dom';

export interface HudData {
  place: string; when: string; meta: string;
  energy: number; maxEnergy: number; money: string; clock: string;
  yaw: number; // camera yaw (radians, 0 = looking north)
  markers: { bearing: number; icon: string }[];
  radar: { angle: number; dist: number } | null; // angle relative to view
  radarLabel: string;
  prompt: string | null;
  objective: { title: string; text: string; hint?: string } | null;
  side: string[];
  vault: number;
}

export class HUD {
  readonly el: HTMLElement;
  private where: HTMLElement;
  private place: HTMLElement;
  private when: HTMLElement;
  private meta: HTMLElement;
  private strip: HTMLElement;
  private compassMarkers: HTMLElement;
  private arrow: HTMLElement;
  private radar: HTMLElement;
  private radarLabel: HTMLElement;
  private energyBar: HTMLElement;
  private energyText: HTMLElement;
  private money: HTMLElement;
  private clock: HTMLElement;
  private prompt: HTMLElement;
  private obj: HTMLElement;
  private toasts: HTMLElement;
  private subtitle: HTMLElement;
  private hint: HTMLElement;
  private boundary: HTMLElement;
  private subTimer = 0;
  subtitles = true;

  constructor() {
    this.place = h('div', { class: 'place' });
    this.when = h('div', { class: 'when' });
    this.meta = h('div', { class: 'meta' });
    this.where = h('div', { class: 'where panel' }, this.place, this.when, this.meta);
    this.strip = h('div', { class: 'strip' });
    const labels = ['N', '·', 'NE', '·', 'E', '·', 'SE', '·', 'S', '·', 'SW', '·', 'W', '·', 'NW', '·'];
    for (let r = 0; r < 3; r++) for (const l of labels) this.strip.append(h('span', { class: 'tick' }, l));
    this.compassMarkers = h('div');
    const compass = h('div', { class: 'compass panel' }, this.strip, this.compassMarkers, h('div', { class: 'mid' }));
    this.arrow = h('div', { class: 'arrow' });
    this.radarLabel = h('div', { class: 'label' }, '');
    this.radar = h('div', { class: 'radar', title: 'Chronometer radar: points to the nearest anomaly' }, h('div', { class: 'sweep' }), this.arrow, h('div', { class: 'dot' }), this.radarLabel);
    this.energyBar = h('div');
    this.energyText = h('span');
    this.money = h('span');
    this.clock = h('span');
    const status = h('div', { class: 'status panel' },
      h('div', { class: 'row' }, h('span', {}, '⏳ Chrono energy'), this.energyText),
      h('div', { class: 'energy' }, this.energyBar),
      h('div', { class: 'row' }, this.money, this.clock));
    this.prompt = h('div', { class: 'prompt panel hidden' });
    this.obj = h('div', { class: 'objective panel hidden' });
    this.toasts = h('div', { class: 'toasts' });
    this.subtitle = h('div', { class: 'subtitle hidden' });
    this.hint = h('div', { class: 'hint' }, 'WASD move · Shift run · Space jump · E interact · T time travel · J journal · M map · Tab inventory · P camera · Esc pause');
    this.boundary = h('div', { class: 'vignette-boundary' });
    this.el = h('div', { class: 'hud passthrough hidden' }, this.boundary, this.where, compass, this.radar, status, this.prompt, this.obj, this.toasts, this.subtitle, this.hint);
    UI_ROOT().append(this.el);
  }

  show(on: boolean) { this.el.classList.toggle('hidden', !on); }
  showHint(on: boolean) { this.hint.classList.toggle('hidden', !on); }

  update(d: HudData) {
    if (this.place.textContent !== d.place) this.place.textContent = d.place;
    if (this.when.textContent !== d.when) this.when.textContent = d.when;
    if (this.meta.textContent !== d.meta) this.meta.textContent = d.meta;
    const pct = Math.max(0, Math.min(100, (d.energy / d.maxEnergy) * 100));
    this.energyBar.style.width = pct + '%';
    this.energyText.textContent = `${Math.floor(d.energy)} / ${d.maxEnergy}`;
    this.money.textContent = d.money;
    this.clock.textContent = d.clock + (d.vault ? `  ·  🔒 ${d.vault}` : '');
    // compass: strip of 16 ticks × 30px = 480px per full turn
    const deg = ((d.yaw * 180) / Math.PI) % 360;
    const off = -((deg + 360) % 360) / 360 * 480 - 480 + 180 - 15;
    this.strip.style.transform = `translateX(${off}px)`;
    this.compassMarkers.replaceChildren(...d.markers.map((m) => {
      let rel = ((((m.bearing - d.yaw) * 180) / Math.PI + 540) % 360) - 180;
      rel = Math.max(-170, Math.min(170, rel));
      return h('span', { class: 'marker', style: { left: `${180 + (rel / 360) * 480 - 7}px` } }, m.icon);
    }));
    if (d.radar) {
      this.arrow.style.display = '';
      this.arrow.style.transform = `rotate(${d.radar.angle}rad)`;
      this.radarLabel.textContent = d.radarLabel;
      this.radar.style.borderColor = d.radar.dist < 30 ? 'rgba(255,210,122,0.9)' : 'rgba(54,224,255,0.5)';
    } else {
      this.arrow.style.display = 'none';
      this.radarLabel.textContent = d.radarLabel;
    }
    if (d.prompt) { this.prompt.innerHTML = d.prompt; this.prompt.classList.remove('hidden'); } else this.prompt.classList.add('hidden');
    if (d.objective || d.side.length) {
      this.obj.classList.remove('hidden');
      const parts: (HTMLElement | string)[] = [];
      if (d.objective) parts.push(h('div', { class: 't' }, d.objective.title), h('div', {}, d.objective.text), d.objective.hint ? h('div', { class: 'muted', style: { marginTop: '4px', fontSize: '12px' } }, d.objective.hint) : '');
      if (d.side.length) parts.push(h('div', { class: 'q' }, ...d.side.map((s) => h('div', {}, '• ' + s))));
      this.obj.replaceChildren(...parts);
    } else this.obj.classList.add('hidden');
  }

  toast(text: string, kind: '' | 'good' | 'warn' = '', ms = 3800) {
    const t = h('div', { class: `toast panel ${kind}` }, text);
    this.toasts.append(t);
    while (this.toasts.children.length > 4) this.toasts.firstChild?.remove();
    setTimeout(() => t.remove(), ms);
  }

  caption(text: string) {
    if (!this.subtitles) return;
    this.subtitle.textContent = text;
    this.subtitle.classList.remove('hidden');
    clearTimeout(this.subTimer);
    this.subTimer = window.setTimeout(() => this.subtitle.classList.add('hidden'), 2600);
  }

  boundaryGlow() {
    this.boundary.style.opacity = '1';
    setTimeout(() => (this.boundary.style.opacity = '0'), 1500);
  }
}
