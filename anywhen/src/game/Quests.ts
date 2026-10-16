// Procedural side quests from townspeople: deliver, find, help build, photograph, gather.
import { Rng, hash32 } from '../core/rng';
import { ANIMAL_BY_ID, ITEM_BY_ID, LANDMARK_BY_ID, era as getEra } from '../data';
import type { WorldPlan, NpcSpawn } from '../gen/planTypes';
import type { GameState, SideQuest } from './state';
import { requestText } from './dialogue';

const BUILD_MATERIAL: Record<string, string> = {
  stoneage: 'reeds', earlyciv: 'clay', classical: 'stone_block', medieval: 'timber', exploration: 'timber', industrial: 'stone_block',
  modern: 'steel_beam', nearfuture: 'solar_tile', farfuture: 'bio_resin', iceage: 'reeds',
};
const GATHER_ITEM: Record<string, string> = {
  beach: 'shells', desert: 'herbs', tundra: 'berries', taiga: 'berries', temperate_forest: 'berries', rainforest: 'herbs',
  grassland: 'herbs', steppe: 'herbs', savanna: 'herbs', mediterranean: 'herbs', scrubland: 'herbs', tropical_dry: 'herbs', wetland: 'reeds',
};
const LOST = ['lost_toy', 'lost_tool', 'lost_ring'];

export function makeQuest(plan: WorldPlan, giver: NpcSpawn, others: NpcSpawn[], s: GameState): SideQuest | null {
  const rng = new Rng(hash32(plan.key, giver.id, s.sideQuests.length));
  const types: SideQuest['type'][] = ['find', 'gather', 'deliver', 'build', 'photograph'];
  const e = getEra(plan.eraId);
  const reward = Math.round(rng.range(8, 20));
  for (let attempt = 0; attempt < 6; attempt++) {
    const type = rng.pick(types);
    const id = `${plan.key}|${giver.id}|${s.sideQuests.length}`;
    const base = { id, worldKey: plan.key, type, giver: giver.id, giverName: giver.name, reward, done: false, place: plan.place.short };
    switch (type) {
      case 'find': {
        const item = rng.pick(LOST);
        const name = ITEM_BY_ID.get(item)!.name.replace('Lost ', '').toLowerCase();
        return { ...base, item, count: 1, text: requestText('find', { item: name }, rng) };
      }
      case 'gather': {
        const item = GATHER_ITEM[plan.biome] ?? 'berries';
        const count = rng.int(3, 5);
        return { ...base, item, count, text: requestText('gather', { item: ITEM_BY_ID.get(item)!.name.toLowerCase(), count }, rng) };
      }
      case 'deliver': {
        const cands = others.filter((o) => o.id !== giver.id && o.age !== 'child');
        if (!cands.length) continue;
        const t = rng.pick(cands);
        const item = rng.chance(0.5) ? 'letter' : 'parcel';
        return { ...base, item, count: 1, target: t.id, targetName: `${t.name} the ${t.jobName.toLowerCase()}`, text: requestText('deliver', { item: ITEM_BY_ID.get(item)!.name.toLowerCase(), target: `${t.name} the ${t.jobName.toLowerCase()}` }, rng) };
      }
      case 'build': {
        if (e.tech < 2 || !plan.settlement) continue;
        const item = BUILD_MATERIAL[plan.eraId] ?? 'timber';
        const count = rng.int(3, 5);
        const building = plan.settlement.plots.some((p) => p.role === 'construction') ? 'house' : rng.pick(['well', 'wall', 'storehouse', 'workshop']);
        return { ...base, item, count, text: requestText('build', { building, count, item: ITEM_BY_ID.get(item)!.name.toLowerCase() }, rng) };
      }
      case 'photograph': {
        if (plan.landmarks.length && rng.chance(0.6)) {
          const l = rng.pick(plan.landmarks);
          return { ...base, subject: l.id, subjectName: LANDMARK_BY_ID.get(l.id)?.name ?? l.name, text: requestText('photograph', { landmark: LANDMARK_BY_ID.get(l.id)?.name ?? l.name }, rng) };
        }
        const wild = plan.animals.filter((a) => ANIMAL_BY_ID.has(a.species));
        if (!wild.length) continue;
        const a = rng.pick(wild);
        return { ...base, subject: a.species, subjectName: ANIMAL_BY_ID.get(a.species)!.name, text: requestText('photograph', { animal: ANIMAL_BY_ID.get(a.species)!.name.toLowerCase() }, rng) };
      }
    }
  }
  return null;
}

export function questObjective(q: SideQuest, s: GameState): string {
  const have = q.item ? s.inventory[q.item] ?? 0 : 0;
  switch (q.type) {
    case 'find': return `Find the lost ${ITEM_BY_ID.get(q.item!)?.name.replace('Lost ', '').toLowerCase()} for ${q.giverName}${have ? ' — return it to them' : ''}`;
    case 'gather': return `Gather ${ITEM_BY_ID.get(q.item!)?.name.toLowerCase()} for ${q.giverName} (${Math.min(have, q.count!)}/${q.count})`;
    case 'deliver': return `Deliver the ${ITEM_BY_ID.get(q.item!)?.name.toLowerCase()} to ${q.targetName}`;
    case 'build': return `Bring ${ITEM_BY_ID.get(q.item!)?.name.toLowerCase()} to ${q.giverName} (${Math.min(have, q.count!)}/${q.count})`;
    case 'photograph': return `Photograph ${q.subjectName} for ${q.giverName} (press P)`;
  }
}

/** Pickups that should exist for this quest in its world. */
export function questPickups(q: SideQuest, s: GameState): { id: string; item: string }[] {
  if (q.done || q.type === 'deliver' || q.type === 'photograph') return [];
  const have = s.inventory[q.item!] ?? 0;
  const need = (q.count ?? 1) - have;
  const out: { id: string; item: string }[] = [];
  for (let i = 0; i < (q.count ?? 1) && out.length < need; i++) {
    const id = `q:${q.id}:${i}`;
    if (!s.pickups.includes(id)) out.push({ id, item: q.item! });
  }
  return out;
}
