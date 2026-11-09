// Garage upgrades bought with coins, and how they change a vehicle's handling.
import { POWER } from './config.js';

export const UPGRADES = [
  { id: 'engine', name: 'Engine', icon: '⚙️', max: 5, base: 300, desc: '+4% top speed and quicker acceleration per level' },
  { id: 'exhaust', name: 'Exhaust', icon: '🔥', max: 5, base: 250, desc: 'Longer, stronger nitro and hotter flames per level' },
  { id: 'tires', name: 'Tires', icon: '🛞', max: 5, base: 200, desc: 'Sharper steering, less sliding, oil hurts less' },
  { id: 'brakes', name: 'Brakes', icon: '🛑', max: 5, base: 150, desc: 'Stronger stopping power on B' },
  { id: 'life', name: 'Extra life', icon: '❤️', max: 3, base: 600, desc: 'Each level is one extra crash you survive per run' },
];

export function upgradeCost(up, level) {
  return Math.round((up.base * (level + 1) * Math.pow(1.28, level)) / 10) * 10;
}

export function levelsOf(save, id) {
  const u = (save.upgrades && save.upgrades[id]) || {};
  const out = {};
  for (const up of UPGRADES) out[up.id] = Math.min(up.max, Math.max(0, Math.floor(Number(u[up.id]) || 0)));
  return out;
}

// Effective handling for a vehicle with the given upgrade levels.
export function vehicleStats(def, lv) {
  return {
    speedMul: def.speedMul * (1 + 0.04 * lv.engine),
    accel: def.accel * (1 + 0.1 * lv.engine),
    steerResp: def.steerResp * (1 + 0.06 * lv.tires),
    drift: def.drift * (1 - 0.04 * lv.tires),
    oil: def.oil * (1 - 0.1 * lv.tires),
    brakePower: 1 + 0.1 * lv.brakes,
    nitroBoost: POWER.NITRO_BOOST + 0.04 * lv.exhaust,
    nitroTime: 0.5 * lv.exhaust,
    flameTier: lv.exhaust >= 5 ? 2 : lv.exhaust >= 3 ? 1 : 0,
    lives: lv.life,
  };
}
