import { describe, expect, test } from 'vitest';
import { Story } from '../src/game/Story';
import { newGame } from '../src/game/state';
import { RIFTS } from '../src/data';
import type { WorldPlan } from '../src/gen/planTypes';

const hooks = { toast() {}, riftComplete() {}, stepChanged() {}, unlock() {} };
const plan = (p: Partial<WorldPlan>) => ({ moon: false, presentLat: 0, presentLon: 0, year: 2000, eraId: 'modern', ...p }) as WorldPlan;
const giza = plan({ presentLat: 29.98, presentLon: 31.13, year: -2560, eraId: 'earlyciv' });
const moon = plan({ moon: true, regionId: 'moon' } as Partial<WorldPlan>);

describe('story locations', () => {
  test('a later return to a set place moves the NPCs that follow it', () => {
    const s = newGame();
    const story = new Story(s, hooks);
    const steps = RIFTS[0].steps;
    s.story.step = steps.findIndex((st) => st.type === 'capture' && st.anomaly === 'pyramid_stone');
    expect(story.npcsHere(moon).map((n) => n.id)).toEqual([]);
    s.story.step = steps.findIndex((st) => st.type === 'return' && st.anomaly === 'pyramid_stone');
    expect(story.npcsHere(giza).map((n) => n.id)).toContain('merit');
    expect(story.npcsHere(moon)).toEqual([]);
  });

  test('a located return step checks the era as well as the place', () => {
    const st = RIFTS[0].steps.find((x) => x.type === 'return' && x.lat !== undefined)!;
    expect(Story.matches(st, giza)).toBe(true);
    expect(Story.matches(st, plan({ presentLat: 29.98, presentLon: 31.13, year: 2000, eraId: 'modern' }))).toBe(false);
  });

  test('a find step needs its own pickups, not an item carried over from an earlier rift', () => {
    const s = newGame();
    const story = new Story(s, hooks);
    const ri = RIFTS.findIndex((r) => r.id === 'archive');
    const step = RIFTS[ri].steps.findIndex((st) => st.type === 'find');
    const item = RIFTS[ri].steps[step].item!;
    s.story.rift = ri; s.story.step = step;
    const count = RIFTS[ri].steps[step].count ?? 1;
    s.inventory[item] = count; // already carrying enough of the same item from earlier play
    const archive = plan({ presentLat: RIFTS[ri].steps[0].lat, presentLon: RIFTS[ri].steps[0].lon, year: 2995, eraId: 'farfuture' });
    const pk = story.pickupsHere(archive);
    expect(pk.length).toBe(count);
    story.notify({ type: 'inventory' });
    expect(s.story.step).toBe(step);
    for (const p of pk) { s.pickups.push(p.id); s.inventory[item]++; story.notify({ type: 'inventory' }); }
    expect(s.story.step).toBe(step + 1);
  });

  test('every rift step that needs an NPC names one the rift defines', () => {
    for (const r of RIFTS) for (const st of r.steps) if (st.npc) expect(r.npcs.some((n) => n.id === st.npc), `${r.id}:${st.npc}`).toBe(true);
  });
});
