// Title, dialogue, trade, journal, inventory, map, settings, pause, puzzle, cards and loading overlays.
import { h, UI_ROOT } from './dom';
import { ITEM_BY_ID, ANIMAL_BY_ID, LANDMARKS, ANOMALY_BY_ID, ANOMALIES, ANIMALS, ERAS, RIFTS, ERA_BY_ID } from '../data';
import type { GameState, Settings } from '../game/state';
import type { WorldPlan } from '../gen/planTypes';
import { formatYear } from '../core/timeScale';
import { Rng } from '../core/rng';
import type { TerrainSampler } from '../gen/terrain';
import { AREA_HALF } from '../gen/terrain';
import { scramble } from '../game/dialogue';

// ------------------------------------------------------------------ title
export class TitleScreen {
  readonly el: HTMLElement;
  private cont: HTMLButtonElement;
  onNew: (() => void) | null = null;
  onContinue: (() => void) | null = null;
  onSettings: (() => void) | null = null;
  constructor(globeCanvas: HTMLCanvasElement) {
    this.cont = h('button', { class: 'btn', onclick: () => this.onContinue?.() }, 'Continue') as HTMLButtonElement;
    this.el = h('div', { class: 'title' },
      globeCanvas,
      h('div', { class: 'emblem' }, h('span', { class: 'o-clock' })),
      h('div', { class: 'logo' }, 'Anywhen'),
      h('div', { class: 'tagline' }, 'Anywhere on Earth. Any time in history. One shattered timeline.'),
      h('div', { class: 'menu' },
        h('button', { class: 'btn primary', onclick: () => this.onNew?.() }, 'New Game'),
        this.cont,
        h('button', { class: 'btn', onclick: () => this.onSettings?.() }, 'Settings')),
      h('div', { class: 'credits' }, 'Made with Three.js · Map data: Natural Earth (public domain) · All art and sound are procedural'));
    UI_ROOT().append(this.el);
  }
  show(on: boolean, canContinue = false) { this.el.classList.toggle('hidden', !on); this.cont.disabled = !canContinue; }
}

// ------------------------------------------------------------------ dialogue
export interface DialogueOption { label: string; action: () => void; primary?: boolean }
export class DialogueBox {
  readonly el: HTMLElement;
  private name: HTMLElement;
  private role: HTMLElement;
  private tr: HTMLElement;
  private text: HTMLElement;
  private opts: HTMLElement;
  private anim = 0;
  constructor() {
    this.name = h('span', { class: 'name' });
    this.role = h('span', { class: 'role' });
    this.tr = h('span', { class: 'tr' });
    this.text = h('div', { class: 'text' });
    this.opts = h('div', { class: 'opts' });
    this.el = h('div', { class: 'dialogue panel hidden' }, h('div', { class: 'who' }, this.name, this.role, this.tr), this.text, this.opts);
    UI_ROOT().append(this.el);
  }
  get open() { return !this.el.classList.contains('hidden'); }
  show(name: string, role: string, text: string, options: DialogueOption[], translate = false) {
    this.el.classList.remove('hidden');
    this.name.textContent = name;
    this.role.textContent = role;
    this.setText(text, translate);
    this.setOptions(options);
  }
  setText(text: string, translate = false) {
    cancelAnimationFrame(this.anim);
    if (!translate) { this.text.textContent = text; this.tr.textContent = ''; return; }
    const rng = new Rng(text.length * 7);
    const start = performance.now();
    this.tr.textContent = '⟲ Chronometer translating…';
    const step = () => {
      const t = Math.min(1, (performance.now() - start) / 900);
      this.text.textContent = scramble(text, t, rng);
      if (t < 1) this.anim = requestAnimationFrame(step);
      else this.tr.textContent = '✓ translated';
    };
    step();
  }
  setOptions(options: DialogueOption[]) {
    this.opts.replaceChildren(...options.map((o, i) => h('button', { class: `btn small ${o.primary ? 'gold' : ''}`, onclick: () => o.action() }, `${i + 1}. ${o.label}`)));
  }
  pressNumber(n: number) { (this.opts.children[n - 1] as HTMLButtonElement | undefined)?.click(); }
  hide() { this.el.classList.add('hidden'); cancelAnimationFrame(this.anim); }
}

// ------------------------------------------------------------------ generic modal sheet
class Sheet {
  readonly el: HTMLElement;
  protected body: HTMLElement;
  protected head: HTMLElement;
  onClose: (() => void) | null = null;
  constructor(title: string, extraHead: HTMLElement[] = []) {
    this.body = h('div', { class: 'body' });
    this.head = h('header', {}, h('h2', {}, title), ...extraHead, h('button', { class: 'btn small', onclick: () => this.onClose?.() }, '✕ Close'));
    this.el = h('div', { class: 'modal hidden' }, h('div', { class: 'sheet panel' }, this.head, this.body));
    this.el.addEventListener('mousedown', (e) => { if (e.target === this.el) this.onClose?.(); });
    UI_ROOT().append(this.el);
  }
  get open() { return !this.el.classList.contains('hidden'); }
  hide() { this.el.classList.add('hidden'); }
  protected showSheet() { this.el.classList.remove('hidden'); }
}

// ------------------------------------------------------------------ trade
export class TradeScreen extends Sheet {
  onBuy: ((item: string, price: number) => void) | null = null;
  onSell: ((item: string, price: number) => void) | null = null;
  constructor() { super('Trade'); }
  show(state: GameState, plan: WorldPlan, traderName: string) {
    this.showSheet();
    this.render(state, plan, traderName);
  }
  render(state: GameState, plan: WorldPlan, traderName: string) {
    const rate = plan.currency.rate || 1;
    const fmt = (marks: number) => `${Math.max(1, Math.round(marks * rate))} ${plan.currency.short}`;
    const goods = [...new Set(plan.goods)].filter((g) => ITEM_BY_ID.has(g));
    const sellable = Object.entries(state.inventory).filter(([id, n]) => n > 0 && (ITEM_BY_ID.get(id)?.value ?? 0) > 0);
    this.body.replaceChildren(
      h('div', { class: 'progress' }, `${traderName} trades in ${plan.currency.name}. You have ${fmt(state.money)} (${Math.round(state.money)} chrono-marks; the Chronometer converts them for you).`),
      h('div', { class: 'section-title' }, 'Buy'),
      h('div', { class: 'items' }, ...goods.map((g) => {
        const it = ITEM_BY_ID.get(g)!;
        const price = it.value;
        return h('div', { class: 'item' }, h('span', { class: 'ic' }, it.icon), h('div', {}, it.name, h('div', { class: 'muted' }, fmt(price))),
          h('button', { class: 'btn small', style: { marginLeft: 'auto' }, disabled: state.money < price, onclick: () => { this.onBuy?.(g, price); this.render(state, plan, traderName); } }, 'Buy'));
      })),
      h('div', { class: 'section-title' }, 'Sell'),
      sellable.length ? h('div', { class: 'items' }, ...sellable.map(([id, n]) => {
        const it = ITEM_BY_ID.get(id)!;
        const price = Math.max(1, Math.round(it.value * 0.6));
        return h('div', { class: 'item' }, h('span', { class: 'ic' }, it.icon), h('div', {}, `${it.name} ×${n}`, h('div', { class: 'muted' }, fmt(price))),
          h('button', { class: 'btn small', style: { marginLeft: 'auto' }, onclick: () => { this.onSell?.(id, price); this.render(state, plan, traderName); } }, 'Sell'));
      })) : h('div', { class: 'muted' }, 'You have nothing to sell.'),
    );
  }
}

// ------------------------------------------------------------------ inventory
export class InventoryScreen extends Sheet {
  onReturn: ((instanceId: string) => void) | null = null;
  constructor() { super('Inventory & Chrono Vault'); }
  show(state: GameState, plan: WorldPlan, canReturn: (anomalyId: string) => string | null, mounts: string[]) {
    this.showSheet();
    const rate = plan.currency.rate || 1;
    const inv = Object.entries(state.inventory).filter(([, n]) => n > 0);
    this.body.replaceChildren(
      h('div', { class: 'progress' }, `Money: ${Math.round(state.money)} chrono-marks (${plan.currency.rate ? Math.round(state.money * rate) + ' ' + plan.currency.name + ' here' : 'no currency in this era'}) · Chrono energy ${Math.floor(state.energy)}/${state.maxEnergy} · Anomalies returned: ${state.returned.length}`),
      h('div', { class: 'section-title' }, 'Chrono Vault — anomalies waiting to go home'),
      state.vault.length ? h('div', { class: 'grid' }, ...state.vault.map((v) => {
        const def = ANOMALY_BY_ID.get(v.anomalyId)!;
        const why = canReturn(v.anomalyId);
        return h('div', { class: 'entry' }, h('div', { class: 'n' }, def.name), h('div', { class: 'f' }, def.homeHint), h('div', { class: 'f', style: { marginTop: '4px' } }, `Found: ${v.fromPlace}, ${formatYear(v.fromYear)}`),
          h('button', { class: `btn small ${why ? '' : 'gold'}`, style: { marginTop: '8px' }, disabled: !!why, title: why ?? 'Return it home', onclick: () => this.onReturn?.(v.instanceId) }, why ? 'Not its home time' : '↩ Return home'));
      })) : h('div', { class: 'muted' }, 'Your vault is empty. Follow the radar to find anomalies.'),
      h('div', { class: 'section-title' }, 'Items'),
      inv.length ? h('div', { class: 'items' }, ...inv.map(([id, n]) => { const it = ITEM_BY_ID.get(id); return h('div', { class: 'item', title: it?.fact ?? '' }, h('span', { class: 'ic' }, it?.icon ?? '?'), h('span', {}, it?.name ?? id), h('span', { class: 'c' }, '×' + n)); })) : h('div', { class: 'muted' }, 'No items yet.'),
      h('div', { class: 'section-title' }, 'Ways to travel (F to mount / dismount)'),
      h('div', { class: 'muted' }, mounts.length ? mounts.join(' · ') : 'Walking for now. Mounts unlock as you repair Rifts.'),
    );
  }
}

// ------------------------------------------------------------------ journal
type Tab = 'places' | 'landmarks' | 'animals' | 'people' | 'inventions' | 'anomalies' | 'photos' | 'rifts' | 'quests';
export class JournalScreen extends Sheet {
  private tab: Tab = 'rifts';
  private tabsEl: HTMLElement;
  private state: GameState | null = null;
  constructor() {
    const tabs = h('div', { class: 'tabs' });
    super('Chrono Journal', [tabs]);
    this.tabsEl = tabs;
  }
  show(state: GameState) { this.state = state; this.showSheet(); this.render(); }
  private render() {
    const s = this.state!;
    const tabs: [Tab, string, number][] = [
      ['rifts', 'Rifts', s.story.done.length], ['places', 'Places', Object.keys(s.journal.places).length], ['landmarks', 'Landmarks', Object.keys(s.journal.landmarks).length],
      ['animals', 'Animals', Object.keys(s.journal.animals).length], ['people', 'People', Object.keys(s.journal.people).length], ['inventions', 'Inventions', Object.keys(s.journal.inventions).length],
      ['anomalies', 'Anomalies', Object.keys(s.journal.anomalies).length], ['photos', 'Photos', s.photos.length], ['quests', 'Quests', s.sideQuests.filter((q) => !q.done).length],
    ];
    this.tabsEl.replaceChildren(...tabs.map(([id, label, n]) => h('button', { class: `tab ${this.tab === id ? 'on' : ''}`, onclick: () => { this.tab = id; this.render(); } }, `${label} ${n}`)));
    const entries = (rec: Record<string, { name: string; fact: string; extra?: string }>, all?: { id: string; name: string }[]) => {
      const known = Object.entries(rec);
      const locked = all ? all.filter((a) => !rec[a.id]) : [];
      return h('div', {},
        h('div', { class: 'progress' }, all ? `Discovered ${known.length} of ${all.length}` : `${known.length} entries`),
        h('div', { class: 'grid', style: { marginTop: '10px' } },
          ...known.map(([, e]) => h('div', { class: 'entry' }, h('div', { class: 'n' }, e.name), e.extra ? h('div', { class: 'muted', style: { fontSize: '12px' } }, e.extra) : '', h('div', { class: 'f' }, e.fact))),
          ...locked.slice(0, 40).map((a) => h('div', { class: 'entry locked' }, h('div', { class: 'n' }, '???'), h('div', { class: 'f' }, 'Not yet discovered')))));
    };
    let content: HTMLElement;
    switch (this.tab) {
      case 'places': content = entries(s.journal.places); break;
      case 'landmarks': content = entries(s.journal.landmarks, LANDMARKS.map((l) => ({ id: l.id, name: l.name }))); break;
      case 'animals': content = entries(s.journal.animals, ANIMALS.map((a) => ({ id: a.id, name: a.name }))); break;
      case 'people': content = entries(s.journal.people); break;
      case 'inventions': content = entries(s.journal.inventions, ERAS.flatMap((e) => e.inventions.map((i) => ({ id: i.id + '@' + e.id, name: i.name })))); break;
      case 'anomalies': content = entries(s.journal.anomalies, ANOMALIES.map((a) => ({ id: a.id, name: a.name }))); break;
      case 'photos': content = h('div', { class: 'grid' }, ...(s.photos.length ? s.photos.slice().reverse().map((p) => h('div', { class: 'entry' }, h('img', { src: p.data, alt: p.caption }), h('div', { class: 'n' }, p.caption), h('div', { class: 'f' }, `${p.place} · ${formatYear(p.year)}`))) : [h('div', { class: 'muted' }, 'Press P in the world to enter camera mode and take photos of landmarks, animals and people.')])); break;
      case 'quests': content = h('div', {}, ...s.sideQuests.slice().reverse().map((q) => h('div', { class: 'entry', style: { marginBottom: '8px', opacity: q.done ? 0.5 : 1 } }, h('div', { class: 'n' }, `${q.done ? '✓ ' : ''}${q.giverName} — ${q.place}`), h('div', { class: 'f' }, q.text)))); if (!s.sideQuests.length) content = h('div', { class: 'muted' }, 'Talk to townspeople to find people who need help.'); break;
      case 'rifts': default:
        content = h('div', { class: 'grid' }, ...RIFTS.map((r, i) => {
          const done = s.story.done.includes(r.id);
          const current = i === s.story.rift && !s.story.ended;
          return h('div', { class: `entry ${!done && !current ? 'locked' : ''}` }, h('div', { class: 'n' }, `${done ? '✓' : current ? '◆' : '○'} Rift ${r.index}: ${done || current ? r.title : '???'}`), h('div', { class: 'muted', style: { fontSize: '12px' } }, done || current ? `${r.place}, ${formatYear(r.year)}` : ''), h('div', { class: 'f' }, done ? r.fact : current ? r.intro : 'Not yet reached.'));
        }));
    }
    this.body.replaceChildren(content);
  }
}

// ------------------------------------------------------------------ map
export class MapScreen extends Sheet {
  private canvas: HTMLCanvasElement;
  private base: HTMLCanvasElement | null = null;
  private baseKey = '';
  private legend: HTMLElement;
  constructor() {
    super('Local map');
    this.canvas = h('canvas', { width: '640', height: '640' }) as HTMLCanvasElement;
    this.legend = h('div', { class: 'legend' });
    this.body.append(h('div', { class: 'mapwrap' }, this.canvas, this.legend));
  }
  show(plan: WorldPlan, ts: TerrainSampler, player: { x: number; z: number; heading: number }, markers: { x: number; z: number; icon: string; label: string }[]) {
    this.showSheet();
    const N = 640;
    if (this.baseKey !== plan.key) {
      this.baseKey = plan.key;
      const c = document.createElement('canvas');
      c.width = c.height = 160;
      const x = c.getContext('2d')!;
      const img = x.createImageData(160, 160);
      const col: [number, number, number] = [0, 0, 0];
      for (let j = 0; j < 160; j++) for (let i = 0; i < 160; i++) {
        const wx = -AREA_HALF + (i + 0.5) * (AREA_HALF * 2 / 160), wz = -AREA_HALF + (j + 0.5) * (AREA_HALF * 2 / 160);
        const hgt = ts.height(wx, wz);
        if (hgt < 0) { col[0] = 0.2; col[1] = 0.45; col[2] = 0.65; }
        else ts.color(wx, wz, hgt, 0.95, plan.ground, col);
        const shadeF = 0.85 + Math.min(0.3, hgt / 300);
        const o = (j * 160 + i) * 4;
        img.data[o] = col[0] * 255 * shadeF; img.data[o + 1] = col[1] * 255 * shadeF; img.data[o + 2] = col[2] * 255 * shadeF; img.data[o + 3] = 255;
      }
      x.putImageData(img, 0, 0);
      this.base = c;
    }
    const ctx = this.canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.base!, 0, 0, N, N);
    const toPx = (wx: number, wz: number): [number, number] => [((wx + AREA_HALF) / (AREA_HALF * 2)) * N, ((wz + AREA_HALF) / (AREA_HALF * 2)) * N];
    const s = plan.settlement;
    if (s) {
      ctx.strokeStyle = 'rgba(80,60,40,0.85)';
      for (const r of s.roads) { ctx.lineWidth = Math.max(1, r.w / 9); ctx.beginPath(); ctx.moveTo(...toPx(r.ax, r.az)); ctx.lineTo(...toPx(r.bx, r.bz)); ctx.stroke(); }
      ctx.fillStyle = 'rgba(160,80,60,0.9)';
      for (const p of s.plots) { const [x, y] = toPx(p.x, p.z); ctx.fillRect(x - 1.5, y - 1.5, 3, 3); }
      ctx.fillStyle = 'rgba(200,180,90,0.5)';
      for (const f of s.farms) { const [x, y] = toPx(f.x, f.z); ctx.fillRect(x - f.w / 20, y - f.d / 20, f.w / 10, f.d / 10); }
    }
    ctx.font = '18px sans-serif';
    ctx.textAlign = 'center';
    for (const l of plan.landmarks) { const [x, y] = toPx(l.x, l.z); ctx.fillText('🏛️', x, y + 6); }
    for (const m of markers) { const [x, y] = toPx(m.x, m.z); ctx.fillText(m.icon, x, y + 6); }
    const [px, py] = toPx(player.x, player.z);
    ctx.save(); ctx.translate(px, py); ctx.rotate(-player.heading + Math.PI);
    ctx.fillStyle = '#36e0ff'; ctx.strokeStyle = '#000'; ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(7, 8); ctx.lineTo(0, 4); ctx.lineTo(-7, 8); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 16px sans-serif'; ctx.fillText('N', N / 2, 20);
    this.legend.replaceChildren(
      h('div', {}, h('b', {}, plan.place.name)), h('div', {}, `${formatYear(plan.year)} · ${ERA_BY_ID.get(plan.eraId)?.name}`), h('div', {}, `${plan.biomeName}${s ? ` · ${s.noun} (${s.tier})` : ' · wilderness'}`),
      h('div', { style: { marginTop: '10px' } }, '🔷 You'), h('div', {}, '🏛️ Landmark'), ...markers.slice(0, 12).map((m) => h('div', {}, `${m.icon} ${m.label}`)),
      h('div', { style: { marginTop: '10px' } }, 'Area: 6 × 6 km. The Chronometer keeps you inside its field.'));
  }
}

// ------------------------------------------------------------------ settings
export class SettingsScreen extends Sheet {
  onChange: ((s: Settings) => void) | null = null;
  constructor() { super('Settings'); }
  show(s: Settings) {
    this.showSheet();
    const slider = (label: string, key: keyof Settings, min: number, max: number, step: number, fmt = (v: number) => v.toFixed(2)) => {
      const out = h('span', {}, fmt(s[key] as number));
      const inp = h('input', { type: 'range', min: String(min), max: String(max), step: String(step), value: String(s[key]), oninput: (e: Event) => { (s as unknown as Record<string, number>)[key] = Number((e.target as HTMLInputElement).value); out.textContent = fmt(s[key] as number); this.onChange?.(s); } });
      return h('label', {}, label, inp, out);
    };
    const check = (label: string, key: keyof Settings) => h('label', {}, label, h('input', { type: 'checkbox', checked: !!s[key], onchange: (e: Event) => { (s as unknown as Record<string, boolean>)[key] = (e.target as HTMLInputElement).checked; this.onChange?.(s); } }), h('span'));
    const quality = h('select', { onchange: (e: Event) => { s.quality = (e.target as HTMLSelectElement).value as Settings['quality']; this.onChange?.(s); } }, ...(['low', 'medium', 'high'] as const).map((q) => h('option', { value: q, selected: s.quality === q }, q[0].toUpperCase() + q.slice(1))));
    this.body.replaceChildren(h('div', { class: 'settings' },
      h('div', { class: 'section-title' }, 'Controls'),
      slider('Mouse sensitivity', 'sensitivity', 0.2, 3, 0.05),
      check('Invert mouse Y', 'invertY'),
      slider('Field of view', 'fov', 50, 90, 1, (v) => v.toFixed(0) + '°'),
      h('div', { class: 'section-title' }, 'Audio'),
      slider('Master volume', 'master', 0, 1, 0.01),
      slider('Music', 'music', 0, 1, 0.01),
      slider('Sound effects', 'sfx', 0, 1, 0.01),
      slider('Ambience', 'ambient', 0, 1, 0.01),
      check('Subtitles & sound captions', 'subtitles'),
      h('div', { class: 'section-title' }, 'Graphics'),
      h('label', {}, 'Graphics quality', quality, h('span')),
      slider('View distance', 'viewDistance', 300, 1100, 20, (v) => v.toFixed(0) + ' m'),
      slider('Day length', 'dayLength', 6, 60, 1, (v) => v.toFixed(0) + ' min'),
      h('div', { class: 'muted', style: { marginTop: '12px', fontSize: '13px' } }, 'Graphics quality and view distance apply fully after the next time jump.'),
    ));
  }
}

// ------------------------------------------------------------------ pause
export class PauseMenu {
  readonly el: HTMLElement;
  onResume: (() => void) | null = null;
  onSettings: (() => void) | null = null;
  onSave: (() => void) | null = null;
  onQuit: (() => void) | null = null;
  onTravel: (() => void) | null = null;
  constructor() {
    this.el = h('div', { class: 'modal hidden' }, h('div', { class: 'panel', style: { padding: '26px 30px', width: '320px', display: 'flex', flexDirection: 'column', gap: '10px', textAlign: 'center' } },
      h('h2', {}, 'Paused'),
      h('button', { class: 'btn primary', onclick: () => this.onResume?.() }, 'Resume'),
      h('button', { class: 'btn', onclick: () => this.onTravel?.() }, 'Time travel (T)'),
      h('button', { class: 'btn', onclick: () => this.onSave?.() }, 'Save game'),
      h('button', { class: 'btn', onclick: () => this.onSettings?.() }, 'Settings'),
      h('button', { class: 'btn', onclick: () => this.onQuit?.() }, 'Save & quit to title'),
      h('div', { class: 'muted', style: { fontSize: '12px', marginTop: '6px' } }, 'The game also saves automatically after every jump.')));
    UI_ROOT().append(this.el);
  }
  get open() { return !this.el.classList.contains('hidden'); }
  show(on: boolean) { this.el.classList.toggle('hidden', !on); }
}

// ------------------------------------------------------------------ puzzle: align the rings
export class PuzzleBox {
  readonly el: HTMLElement;
  private canvas: HTMLCanvasElement;
  private title: HTMLElement;
  private rings: number[] = [];
  private targets: number[] = [];
  private glyphs = ['☉', '☽', '★', '♁', '△', '◇', '✦', '❖'];
  private done: ((ok: boolean) => void) | null = null;
  private solved = false;
  constructor() {
    this.canvas = h('canvas', { width: '720', height: '720' }) as HTMLCanvasElement;
    this.title = h('h2', {}, 'Align the Chronometer rings');
    this.el = h('div', { class: 'modal hidden' }, h('div', { class: 'panel puzzle' }, this.title,
      h('div', { class: 'muted', style: { fontSize: '13px', marginBottom: '8px' } }, 'Click a ring to turn it (right-click turns it back). Line up every gold symbol with the arrow at the top.'),
      this.canvas, h('div', {}, h('button', { class: 'btn small', onclick: () => this.finish(false) }, 'Leave it for now'))));
    this.canvas.addEventListener('mousedown', (e) => this.click(e));
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    UI_ROOT().append(this.el);
  }
  get open() { return !this.el.classList.contains('hidden'); }
  start(title: string, rings: number, seed: number, done: (ok: boolean) => void) {
    const rng = new Rng(seed);
    this.title.textContent = title;
    this.rings = Array.from({ length: rings }, () => rng.int(1, 7));
    this.targets = Array.from({ length: rings }, () => rng.int(0, 7));
    this.done = done;
    this.solved = false;
    this.el.classList.remove('hidden');
    this.draw();
  }
  private click(e: MouseEvent) {
    if (this.solved) return;
    const r = this.canvas.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 720 - 360, y = ((e.clientY - r.top) / r.height) * 720 - 360;
    const d = Math.hypot(x, y);
    const n = this.rings.length;
    const idx = Math.floor((d - 60) / (280 / n));
    if (idx < 0 || idx >= n) return;
    const dir = e.button === 2 ? -1 : 1;
    // turning one ring nudges its neighbour too (the actual puzzle)
    this.rings[idx] = (this.rings[idx] + dir + 8) % 8;
    if (idx + 1 < n && (idx % 2 === 0)) this.rings[idx + 1] = (this.rings[idx + 1] + dir + 8) % 8;
    this.draw();
    if (this.rings.every((v, i) => (v + this.targets[i]) % 8 === 0)) { this.solved = true; setTimeout(() => this.finish(true), 700); }
  }
  private draw() {
    const c = this.canvas.getContext('2d')!;
    c.clearRect(0, 0, 720, 720);
    c.save(); c.translate(360, 360);
    const n = this.rings.length;
    for (let i = n - 1; i >= 0; i--) {
      const r0 = 60 + i * (280 / n), r1 = 60 + (i + 1) * (280 / n) - 6;
      c.beginPath(); c.arc(0, 0, r1, 0, Math.PI * 2); c.arc(0, 0, r0, 0, Math.PI * 2, true);
      c.fillStyle = this.solved ? `rgba(125,255,178,${0.25 + i * 0.08})` : `rgba(54,224,255,${0.12 + i * 0.07})`; c.fill();
      c.strokeStyle = 'rgba(255,255,255,0.3)'; c.stroke();
      for (let g = 0; g < 8; g++) {
        const a = ((g + this.rings[i]) / 8) * Math.PI * 2 - Math.PI / 2;
        const rr = (r0 + r1) / 2;
        const isKey = g === (8 - this.targets[i]) % 8;
        c.fillStyle = isKey ? '#ffd27a' : 'rgba(255,255,255,0.55)';
        c.font = `${isKey ? 30 : 22}px serif`;
        c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText(this.glyphs[(g + i) % 8], Math.cos(a) * rr, Math.sin(a) * rr);
      }
    }
    c.fillStyle = '#ffd27a'; c.beginPath(); c.moveTo(0, -352); c.lineTo(-14, -330); c.lineTo(14, -330); c.fill();
    c.beginPath(); c.arc(0, 0, 50, 0, Math.PI * 2); c.fillStyle = '#141b31'; c.fill(); c.font = '40px serif'; c.fillStyle = '#36e0ff'; c.fillText('⏳', 0, 2);
    c.restore();
  }
  private finish(ok: boolean) { this.el.classList.add('hidden'); const d = this.done; this.done = null; d?.(ok); }
}

// ------------------------------------------------------------------ cards & loading
export class Cards {
  readonly el: HTMLElement;
  private loading: HTMLElement;
  private years: HTMLElement;
  private msg: HTMLElement;
  private arrivalTimer = 0;
  constructor() {
    this.el = h('div', { class: 'card-overlay hidden' });
    this.years = h('div', { class: 'years' });
    this.msg = h('div', { class: 'msg' });
    this.loading = h('div', { class: 'loading hidden' }, this.years, this.msg);
    UI_ROOT().append(this.el, this.loading);
  }
  arrival(era: string, place: string, year: string, fact: string) {
    clearTimeout(this.arrivalTimer);
    this.el.replaceChildren(h('div', { class: 'arrival panel' }, h('div', { class: 'era' }, era), h('div', { class: 'place' }, place), h('div', { class: 'year' }, year), h('div', { class: 'fact' }, fact)));
    this.el.classList.remove('hidden');
    this.arrivalTimer = window.setTimeout(() => this.el.classList.add('hidden'), 7500);
  }
  story(kicker: string, title: string, paras: string[], mirra: string | null, button: string, onDone: () => void) {
    clearTimeout(this.arrivalTimer);
    const card = h('div', { class: 'story-card panel' }, h('div', { class: 'kicker' }, kicker), h('h2', {}, title), ...paras.map((p) => h('p', {}, p)), mirra ? h('div', { class: 'mirra' }, mirra) : '',
      h('div', { class: 'actions' }, h('button', { class: 'btn primary', onclick: () => { this.el.classList.add('hidden'); onDone(); } }, button)));
    this.el.replaceChildren(card);
    this.el.classList.remove('hidden');
  }
  get storyOpen() { return !this.el.classList.contains('hidden') && !!this.el.querySelector('.story-card'); }
  hide() { this.el.classList.add('hidden'); }
  showLoading(on: boolean, text = '') { this.loading.classList.toggle('hidden', !on); this.msg.textContent = text; }
  setLoadingYear(text: string) { this.years.textContent = text; }
  setLoadingMsg(text: string) { this.msg.textContent = text; }
}

export function animalName(id: string) { return ANIMAL_BY_ID.get(id)?.name ?? id; }
