// NPC population: names, jobs, outfits, routines anchors.
import { Rng, hash32 } from '../core/rng';
import { DIALOGUE } from '../data';
import type { EraProfile, RegionProfile } from '../data/types';
import type { WorldProfile } from './profiles';
import type { NpcSpawn, Outfit, Settlement } from './planTypes';

export const SKIN_TONES = ['#f6dcc8', '#efc9a8', '#e0b08a', '#c99568', '#b07a50', '#8d5a3a', '#6b4430', '#4a2f22'];
export const HAIR_COLORS = ['#1c1714', '#3b2a20', '#6b4a2e', '#c8a060', '#a8502a'];
const GREY = '#c4c0ba';

const BODY_FROM_STYLE: Record<string, string> = {
  trousers: 'trousers', suit: 'coat', coat: 'coat', tunic: 'tunic', wrap: 'tunic', robe: 'robe', dress: 'robe', fur: 'fur', future: 'future',
};

export function makeOutfit(rng: Rng, profile: WorldProfile, region: RegionProfile, age: NpcSpawn['age']): Outfit {
  const cl = profile.clothing;
  const style = rng.pick(cl.styles);
  const body = BODY_FROM_STYLE[style] ?? 'tunic';
  const skin = SKIN_TONES[rng.weighted(region.skin.map((w, i) => [i, w] as const))];
  let hairColor = HAIR_COLORS[rng.weighted(region.hair.map((w, i) => [i, w] as const))];
  if (age === 'elder' && rng.chance(0.8)) hairColor = GREY;
  const primary = rng.pick(cl.colors);
  const accent = rng.pick(cl.accents.length ? cl.accents : cl.colors);
  const shoes = profile.era.tech >= 7 ? rng.pick(['#2a2420', '#3a3a3a', '#5a4030', '#e8e8e8']) : rng.pick(['#5a4030', '#6b4a2e', '#4a3826']);
  const hat = rng.pick(cl.headwear.length ? cl.headwear : ['none']);
  return {
    body,
    hat: age === 'child' && hat !== 'fur_hood' ? 'none' : hat,
    colors: [skin, primary, accent, hairColor, shoes],
    hair: rng.int(0, 3) === 3 && age !== 'child' ? 3 : rng.int(0, 2),
    scale: age === 'child' ? rng.range(0.62, 0.75) : rng.range(0.93, 1.07),
    glow: body === 'future',
  };
}

export function pickName(rng: Rng, era: EraProfile, region: RegionProfile): string {
  const key = era.id === 'farfuture' || era.id === 'nearfuture' ? (rng.chance(0.6) ? 'future' : region.id) : region.id;
  const list = DIALOGUE.names[key] ?? DIALOGUE.names.default;
  return rng.pick(list);
}

export function populate(seed: number, s: Settlement, profile: WorldProfile, region: RegionProfile): NpcSpawn[] {
  const rng = new Rng(hash32(seed, 'people'));
  const era = profile.era;
  const homes = s.plots.filter((p) => p.role === 'home' || p.role === 'farmhouse' || p.role === 'market');
  const tierCount: Record<string, number> = { camp: 7, hamlet: 9, village: 16, town: 28, city: 40, metropolis: 52 };
  const n = Math.min(tierCount[s.tier] ?? 8, Math.max(4, Math.round(s.plots.length * 1.4)));
  const people = profile.people.length ? profile.people : era.people;
  if (!people.length) return [];
  const out: NpcSpawn[] = [];
  const workSpot = (work: string): [number, number] => {
    const pr = s.plaza;
    const near = (x: number, z: number, r: number): [number, number] => [x + rng.range(-r, r), z + rng.range(-r, r)];
    switch (work) {
      case 'farm': case 'herd': {
        if (s.farms.length) { const f = rng.pick(s.farms); return near(f.x, f.z, Math.min(f.w, f.d) * 0.35); }
        return near(s.x, s.z, s.radius * 1.2);
      }
      case 'dock': return s.port ? near(s.port.x, s.port.z, 10) : near(pr.x, pr.z, pr.r);
      case 'market': case 'cook': return near(pr.x, pr.z, pr.r * 0.9);
      case 'build': {
        const c = s.plots.find((p) => p.role === 'construction');
        return c ? near(c.x, c.z, Math.max(c.w, c.d) * 0.7) : near(pr.x, pr.z, pr.r);
      }
      case 'scholar': {
        const c = s.plots.find((p) => p.role === 'civic');
        return c ? near(c.x, c.z, Math.max(c.w, c.d) * 0.8) : near(pr.x, pr.z, pr.r);
      }
      case 'craft': {
        const w = s.plots.filter((p) => p.role === 'workshop');
        if (w.length) { const p = rng.pick(w); return near(p.x, p.z, Math.max(p.w, p.d) * 0.7); }
        return near(pr.x, pr.z, pr.r * 1.5);
      }
      case 'gather': return near(s.x, s.z, s.radius * 2.5);
      default: return near(pr.x, pr.z, pr.r * 1.2);
    }
  };
  let traders = 0;
  for (let i = 0; i < n; i++) {
    const job = rng.pick(people);
    const age: NpcSpawn['age'] = rng.chance(0.14) ? 'child' : rng.chance(0.15) ? 'elder' : 'adult';
    const home = homes.length ? rng.pick(homes) : null;
    const homeAt: [number, number] = home ? [home.x + Math.cos(home.rot + Math.PI / 2) * (home.d / 2 + 1.5), home.z + Math.sin(home.rot + Math.PI / 2) * (home.d / 2 + 1.5)] : [s.x + rng.range(-10, 10), s.z + rng.range(-10, 10)];
    const work = age === 'child' ? 'idle' : job.work;
    const workAt = workSpot(work);
    const trader = age === 'adult' && (job.work === 'market' || (traders === 0 && i === n - 1)) && traders < 4 && era.currency.rate > 0;
    if (trader) traders++;
    const social: [number, number] = [s.plaza.x + rng.range(-s.plaza.r, s.plaza.r), s.plaza.z + rng.range(-s.plaza.r, s.plaza.r)];
    out.push({
      id: `npc${i}`,
      name: pickName(rng, era, region),
      job: age === 'child' ? 'child' : job.id,
      jobName: age === 'child' ? 'Child' : age === 'elder' && rng.chance(0.4) ? 'Elder' : job.name,
      work,
      fact: job.fact,
      x: workAt[0], z: workAt[1],
      home: homeAt,
      workAt,
      social,
      outfit: makeOutfit(rng, profile, region, age),
      trader,
      questGiver: !trader && age !== 'child' && rng.chance(0.38),
      age,
      seed: rng.int(0, 2 ** 30),
      sleepsOutside: s.tier === 'camp',
    });
  }
  return out;
}
