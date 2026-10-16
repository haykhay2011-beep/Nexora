// Main story: 12 Major Rifts run as data-driven quest chains.
import { RIFTS, ITEM_BY_ID, ANOMALY_BY_ID, LANDMARK_BY_ID } from '../data';
import type { RiftDef, RiftStep } from '../data/types';
import type { GameState } from './state';
import type { WorldPlan } from '../gen/planTypes';
import { distanceKm } from '../geo/places';
import { formatYear } from '../core/timeScale';

export type StoryEvent =
  | { type: 'arrive'; plan: WorldPlan }
  | { type: 'talk'; npc: string }
  | { type: 'capture'; anomaly: string }
  | { type: 'return'; anomaly: string; plan: WorldPlan }
  | { type: 'photo'; subjects: string[] }
  | { type: 'visit'; landmark: string }
  | { type: 'puzzle'; npc: string }
  | { type: 'deliver'; npc: string }
  | { type: 'inventory' };

export interface StoryHooks {
  toast(text: string): void;
  riftComplete(rift: RiftDef): void;
  stepChanged(): void;
  unlock(what: string): void;
}

export class Story {
  constructor(private s: GameState, private hooks: StoryHooks) {}

  get rift(): RiftDef | null { return this.s.story.ended ? null : RIFTS[this.s.story.rift] ?? null; }
  get step(): RiftStep | null { const r = this.rift; return r ? r.steps[this.s.story.step] ?? null : null; }

  /** Steps that move the story somewhere: travel, the Moon, or a return to a specific place. */
  static isLocation(st: RiftStep): boolean {
    return st.type === 'travel' || st.type === 'moon' || (st.type === 'return' && st.lat !== undefined);
  }

  /** The location step that sets where the current step takes place. */
  locationStep(stepIdx = this.s.story.step): RiftStep | null {
    const r = this.rift;
    if (!r) return null;
    for (let i = stepIdx; i >= 0; i--) { const st = r.steps[i]; if (Story.isLocation(st)) return st; }
    return null;
  }

  static matches(st: RiftStep | null, plan: WorldPlan): boolean {
    if (!st) return false;
    if (st.type === 'moon') return plan.moon;
    if (plan.moon) return false;
    if (st.lat === undefined || st.lon === undefined) return true;
    const km = distanceKm(plan.presentLat, plan.presentLon, st.lat, st.lon);
    if (km > (st.radiusKm ?? 30)) return false;
    if (st.yearMin !== undefined && plan.year < st.yearMin) return false;
    if (st.yearMax !== undefined && plan.year > st.yearMax) return false;
    if (st.era !== undefined && plan.eraId !== st.era) return false;
    return true;
  }

  /** Is the current step's action available in this world? */
  activeHere(plan: WorldPlan): boolean {
    const st = this.step;
    if (!st) return false;
    if (st.type === 'travel' || st.type === 'moon') return false;
    if (st.type === 'return') return true;
    return Story.matches(this.locationStep(), plan);
  }

  objective(): { title: string; text: string; hint?: string } | null {
    const r = this.rift, st = this.step;
    if (!r || !st) return null;
    let text = st.text;
    if (st.type === 'find' || st.type === 'deliver') text += ` (${Math.min(st.count ?? 1, this.s.inventory[st.item ?? ''] ?? 0)}/${st.count ?? 1})`;
    return { title: `Rift ${r.index}: ${r.title}`, text, hint: st.hint };
  }

  /** NPCs that should be present in this world for the story. */
  npcsHere(plan: WorldPlan): RiftDef['npcs'] {
    const r = this.rift;
    if (!r) return [];
    const loc = this.locationStep();
    const out: RiftDef['npcs'] = [];
    for (let i = this.s.story.step; i < r.steps.length; i++) {
      const st = r.steps[i];
      if (i > this.s.story.step && Story.isLocation(st)) break;
      if (st.npc && Story.matches(loc, plan) && !out.some((n) => n.id === st.npc)) {
        const n = r.npcs.find((x) => x.id === st.npc);
        if (n) out.push(n);
      }
    }
    return out;
  }

  /** Story pickups that should spawn here: [id, item][] */
  pickupsHere(plan: WorldPlan): { id: string; item: string }[] {
    const r = this.rift, st = this.step;
    if (!r || !st || st.type !== 'find' || !this.activeHere(plan)) return [];
    const out: { id: string; item: string }[] = [];
    const have = this.s.inventory[st.item!] ?? 0;
    const need = (st.count ?? 1) - have;
    for (let i = 0; i < (st.count ?? 1); i++) {
      const id = `story:${r.id}:${this.s.story.step}:${i}`;
      if (this.s.pickups.includes(id)) continue;
      if (out.length >= need) break;
      out.push({ id, item: st.item! });
    }
    return out;
  }

  /** Story anomaly to spawn here (capture steps). */
  anomalyHere(plan: WorldPlan): { instanceId: string; anomalyId: string } | null {
    const r = this.rift, st = this.step;
    if (!r || !st || st.type !== 'capture' || !this.activeHere(plan)) return null;
    const instanceId = `story:${r.id}:${this.s.story.step}:${st.anomaly}`;
    if (this.s.captured.includes(instanceId)) return null;
    return { instanceId, anomalyId: st.anomaly! };
  }

  npcLines(npcId: string): string[] {
    const r = this.rift, st = this.step;
    if (!r) return [];
    const n = r.npcs.find((x) => x.id === npcId);
    if (!n) return [];
    if (st && st.npc === npcId && st.lines) return st.lines;
    if (st && st.type === 'talk' && st.npc === npcId) return n.lines;
    // otherwise a reminder of the current objective
    return [st ? `Remember: ${st.text}` : 'Thank you again, Time Walker.'];
  }

  canDeliver(npcId: string): boolean {
    const st = this.step;
    return !!st && st.type === 'deliver' && st.npc === npcId && (this.s.inventory[st.item!] ?? 0) >= (st.count ?? 1);
  }
  wantsPuzzle(npcId: string): boolean { const st = this.step; return !!st && st.type === 'puzzle' && st.npc === npcId; }

  notify(ev: StoryEvent): boolean {
    const st = this.step;
    if (!st) return false;
    let done = false;
    switch (st.type) {
      case 'travel': if (ev.type === 'arrive' && Story.matches(st, ev.plan)) done = true; break;
      case 'moon': if (ev.type === 'arrive' && ev.plan.moon) done = true; break;
      case 'talk': if (ev.type === 'talk' && ev.npc === st.npc) done = true; break;
      case 'find': if ((ev.type === 'inventory' || ev.type === 'arrive') && (this.s.inventory[st.item!] ?? 0) >= (st.count ?? 1)) done = true; break;
      case 'capture': if (ev.type === 'capture' && ev.anomaly === st.anomaly) done = true; break;
      case 'return':
        if (ev.type === 'return' && ev.anomaly === st.anomaly && (st.lat === undefined || Story.matches({ ...st, type: 'travel' }, ev.plan))) done = true;
        break;
      case 'photograph': if (ev.type === 'photo' && ev.subjects.includes(st.landmark!)) done = true; break;
      case 'visit': if (ev.type === 'visit' && ev.landmark === st.landmark) done = true; break;
      case 'puzzle': if (ev.type === 'puzzle' && ev.npc === st.npc) done = true; break;
      case 'deliver':
        if (ev.type === 'deliver' && ev.npc === st.npc && this.canDeliver(ev.npc)) {
          this.s.inventory[st.item!] -= st.count ?? 1;
          if (this.s.inventory[st.item!] <= 0) delete this.s.inventory[st.item!];
          done = true;
        }
        break;
    }
    if (done) this.advance();
    return done;
  }

  /** Can the current return step be completed in this world (era + location)? */
  returnAllowedHere(anomalyId: string, plan: WorldPlan): boolean {
    const st = this.step;
    if (!st || st.type !== 'return' || st.anomaly !== anomalyId) return true;
    if (st.lat !== undefined && !Story.matches({ ...st, type: 'travel' }, plan)) return false;
    return true;
  }

  private advance() {
    const r = this.rift!;
    this.s.story.step++;
    if (this.s.story.step >= r.steps.length) {
      this.s.story.done.push(r.id);
      this.s.energy = Math.min(this.s.maxEnergy + r.reward.maxEnergy, this.s.energy + r.reward.energy);
      this.s.maxEnergy += r.reward.maxEnergy;
      for (const u of r.unlocks) {
        if (u === 'moon') this.s.unlocks.moon = true;
        else if (u === 'ending') this.s.story.ended = true;
        else if (!this.s.unlocks.eras.includes(u as never)) this.s.unlocks.eras.push(u as never);
        this.hooks.unlock(u);
      }
      // mounts unlock as the story progresses
      if (r.index === 1 && !this.s.unlocks.mounts.includes('horse')) this.s.unlocks.mounts.push('horse');
      if (r.index === 3 && !this.s.unlocks.mounts.includes('camel')) this.s.unlocks.mounts.push('camel');
      if (r.index === 9 && !this.s.unlocks.mounts.includes('glider')) this.s.unlocks.mounts.push('glider');
      this.s.story.rift++;
      this.s.story.step = 0;
      if (this.s.story.rift >= RIFTS.length) this.s.story.ended = true;
      this.hooks.riftComplete(r);
    } else {
      const st = this.step!;
      this.hooks.toast('New objective: ' + st.text);
    }
    this.hooks.stepChanged();
  }

  /** Short description of where to go next, for the time travel screen. */
  destinationHint(): { lat: number; lon: number; year: number; moon: boolean; label: string } | null {
    const st = this.step;
    const r = this.rift;
    if (!st || !r) return null;
    if (st.type === 'moon') return { lat: 0.67, lon: 23.47, year: r.year, moon: true, label: 'The Moon' };
    if (st.type === 'travel' && st.lat !== undefined) {
      const year = st.yearMin !== undefined && st.yearMax !== undefined ? (r.year >= st.yearMin && r.year <= st.yearMax ? r.year : Math.round((st.yearMin + st.yearMax) / 2)) : r.year;
      return { lat: st.lat, lon: st.lon!, year, moon: false, label: `${r.place}, ${formatYear(year)}` };
    }
    if (st.type === 'return') {
      const a = ANOMALY_BY_ID.get(st.anomaly!);
      if (st.lat !== undefined) return { lat: st.lat, lon: st.lon!, year: r.year, moon: false, label: `${r.place}, ${formatYear(r.year)}` };
      return a ? { lat: NaN, lon: NaN, year: NaN, moon: false, label: a.homeHint } : null;
    }
    const loc = this.locationStep();
    if (loc?.type === 'moon') return { lat: 0.67, lon: 23.47, year: r.year, moon: true, label: 'The Moon' };
    if (loc && loc.lat !== undefined) return { lat: loc.lat, lon: loc.lon!, year: r.year, moon: false, label: `${r.place}, ${formatYear(r.year)}` };
    return null;
  }

  describeItem(id: string) { return ITEM_BY_ID.get(id)?.name ?? id; }
  describeLandmark(id: string) { return LANDMARK_BY_ID.get(id)?.name ?? id; }
}
