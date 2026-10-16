// Template-based dialogue lines for any era and region.
import { DIALOGUE, CROP_BY_ID, ANIMAL_BY_ID, ITEM_BY_ID, ANOMALY_BY_ID, ERA_BY_ID } from '../data';
import { Rng } from '../core/rng';
import { formatYear } from '../core/timeScale';
import type { WorldPlan, NpcSpawn } from '../gen/planTypes';

export interface DialogueCtx {
  plan: WorldPlan;
  npc: NpcSpawn;
  hour: number;
  weather: string;
  anomaly: { id: string; dir: string; dist: string } | null;
  landmark: string | null;
}

const DIRS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
export function compassDir(dx: number, dz: number): string {
  const a = Math.atan2(dx, -dz); // 0 = north
  return DIRS[((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8];
}
export function distWords(m: number): string {
  if (m < 60) return 'just a few steps';
  if (m < 200) return 'a short walk';
  if (m < 600) return 'a few hundred paces';
  return 'quite a long walk';
}

function fill(t: string, ctx: DialogueCtx, rng: Rng): string | null {
  const p = ctx.plan;
  const slots: Record<string, string | undefined> = {
    place: p.place.short,
    settlement: p.settlement?.noun ?? 'land',
    year: formatYear(p.year),
    era: ERA_BY_ID.get(p.eraId)?.name,
    weather: ctx.weather === 'clear' ? undefined : ctx.weather === 'rain' || ctx.weather === 'monsoon' ? 'rain' : ctx.weather === 'snow' ? 'snow' : ctx.weather === 'sandstorm' ? 'blowing sand' : ctx.weather,
    crop: p.crops.length ? CROP_BY_ID.get(rng.pick(p.crops))?.name.toLowerCase() : undefined,
    animal: (() => { const a = p.animals.filter((x) => !x.domestic); return a.length ? ANIMAL_BY_ID.get(rng.pick(a).species)?.name.toLowerCase() : undefined; })(),
    good: p.goods.length ? ITEM_BY_ID.get(rng.pick(p.goods))?.name.toLowerCase() : undefined,
    landmark: ctx.landmark ?? undefined,
    dir: ctx.anomaly?.dir,
    dist: ctx.anomaly?.dist,
    anomaly: ctx.anomaly ? 'strange ' + (ANOMALY_BY_ID.get(ctx.anomaly.id)?.name.toLowerCase() ?? 'thing') : undefined,
    name: ctx.npc.name,
    job: ctx.npc.jobName.toLowerCase(),
    currency: p.currency.name,
    region: p.place.country ?? p.place.short,
  };
  let missing = false;
  const out = t.replace(/\{(\w+)\}/g, (_m, k: string) => {
    const v = slots[k];
    if (!v) { missing = true; return ''; }
    return v;
  });
  return missing ? null : out;
}

function pickLine(list: string[] | undefined, ctx: DialogueCtx, rng: Rng): string | null {
  if (!list?.length) return null;
  for (let i = 0; i < 6; i++) {
    const l = fill(rng.pick(list), ctx, rng);
    if (l) return l;
  }
  return null;
}

export function greeting(ctx: DialogueCtx, rng: Rng): string {
  if (ctx.hour < 5 || ctx.hour > 21) return rng.pick(DIALOGUE.night);
  return pickLine(DIALOGUE.greetings[ctx.plan.eraId], ctx, rng) ?? pickLine(DIALOGUE.greetings.default, ctx, rng)!;
}

export function smalltalk(ctx: DialogueCtx, rng: Rng): string {
  const own = rng.chance(0.55) ? pickLine(DIALOGUE.smalltalk[ctx.plan.eraId], ctx, rng) : null;
  return own ?? pickLine(DIALOGUE.smalltalk.default, ctx, rng) ?? 'What a day it has been!';
}

export function placeFact(ctx: DialogueCtx, rng: Rng): string {
  const facts = [...ctx.plan.facts.slice(0, 8), ctx.npc.fact].filter(Boolean);
  const f = rng.pick(facts);
  const t = rng.pick(DIALOGUE.facts);
  return t.replace('{fact}', f).replace('{fact_lower}', f.charAt(0).toLowerCase() + f.slice(1));
}

export function anomalyHint(ctx: DialogueCtx, rng: Rng): string {
  if (!ctx.anomaly) return rng.pick(["Strange things? Not around here, as far as I know.", "Nothing unusual lately. It's been peaceful.", "I haven't seen anything out of place. Maybe try somewhere else?"]);
  return pickLine(DIALOGUE.hints, ctx, rng) ?? `Something strange is to the ${ctx.anomaly.dir}.`;
}

export function farewell(rng: Rng): string { return rng.pick(DIALOGUE.farewells); }
export function traderLine(eraId: string, rng: Rng): string { return rng.pick(DIALOGUE.trader[eraId] ?? DIALOGUE.trader.default); }
export function thanks(rng: Rng): string { return rng.pick(DIALOGUE.thanks); }
export function translatorLine(rng: Rng): string { return rng.pick(DIALOGUE.translator); }

export function requestText(type: string, slots: Record<string, string | number>, rng: Rng): string {
  const list = DIALOGUE.requests[type] ?? [];
  let t = rng.pick(list);
  for (const [k, v] of Object.entries(slots)) t = t.split('{' + k + '}').join(String(v));
  return t;
}

/** Glyph scramble used by the translator effect. */
export function scramble(text: string, t: number, rng: Rng): string {
  const glyphs = Array.from('ᚠᚢᚦᚨᚱᚲᛟᛞΣΔΩЖЯ文字ⴰⴱⴳ');
  let out = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === ' ' || i / text.length < t) out += ch;
    else out += glyphs[Math.floor(rng.next() * glyphs.length)] ?? '*';
  }
  return out;
}
