// Central tuning values. Distances in metres, speeds in m/s, times in seconds.
export const ROAD = {
  laneWidth: 3.6,
  lanes: 3,
  shoulder: 2.2,
  sampleSpacing: 2,        // uniform arc-length spacing of road samples
  samplesPerChunk: 40,     // => 80 m chunks
  ringSize: 1024,          // road samples kept in the ring buffer (~2 km)
  controlSpacing: 42,      // spline control point spacing
  aheadDistance: 520,      // how far ahead chunks are built
  behindDistance: 90,
  terrainExtent: 95,       // lateral reach of the terrain ribbon
};
ROAD.halfWidth = (ROAD.laneWidth * ROAD.lanes) / 2;          // 5.4
ROAD.edge = ROAD.halfWidth + ROAD.shoulder;                  // 7.6 (drivable limit)
ROAD.railOffset = ROAD.edge + 0.5;                           // guardrail line
export const laneX = (lane) => (lane - (ROAD.lanes - 1) / 2) * ROAD.laneWidth;

export const PLAYER = {
  halfWidth: 0.98,
  halfLength: 2.15,
  height: 1.2,
  baseTopSpeed: 38,        // ~137 km/h at the start
  maxTopSpeed: 66,         // ~238 km/h later in a run
  topSpeedRamp: 2600,      // metres to reach max top speed
  cruiseAccel: 5.5,
  launchAccel: 14.5,       // full-charge launch acceleration
  brakeDecel: 16,
  minSpeed: 9,
  crawlSpeed: 6,
  steerSpeed: 11.5,        // lateral m/s at full lock
  steerResponse: 7,
  driftFactor: 0.0042,     // centrifugal push on curves
  hopVelocity: 8.8,
  gravity: 24,
  hopCooldown: 0.65,
  boostDuration: 2.6,
  boostSpeedMul: 1.45,
  boostAccel: 22,
  batteryCapacity: 100,
  drainPerMeter: 0.027,    // % per metre at reference speed (scaled by speed)
  regenRate: 7,            // % per second while braking hard
  flatTimeout: 6,          // seconds on a flat battery before the run ends
};

export const SCORE = {
  coin: 10,
  closeCall: 60,
  closeCallGap: 1.15,      // lateral clearance (m) that counts as a close call
  comboTime: 4.5,
  maxMultiplier: 8,
};

// difficulty 0..1 over the first ~4 km of a run
export const difficultyAt = (s) => Math.min(1, Math.max(0, s / 4200));

export const UPGRADES = [
  { id: 'battery', name: 'Battery', desc: '+18% charge capacity per level', max: 5 },
  { id: 'motor', name: 'Motor', desc: 'Harder acceleration and higher top speed', max: 5 },
  { id: 'tires', name: 'Tyres', desc: 'Sharper steering, less drift on curves', max: 5 },
  { id: 'brakes', name: 'Brakes', desc: 'Stronger brakes and better regen', max: 5 },
  { id: 'aero', name: 'Aero', desc: 'Lower drain at speed, longer Ludicrous boost', max: 5 },
  { id: 'life', name: 'Extra life', desc: 'Survive one more crash per run', max: 3 },
];
export const upgradeCost = (id, level) => {
  if (id === 'life') return [250, 600, 1200][level] ?? Infinity;
  return [60, 130, 240, 400, 640][level] ?? Infinity;
};

export const PAINTS = [
  { hex: '#d7263d', name: 'Signal Red', cost: 0 },
  { hex: '#f4f6f8', name: 'Pearl White', cost: 40 },
  { hex: '#1b1f27', name: 'Obsidian', cost: 40 },
  { hex: '#1f6feb', name: 'Deep Blue', cost: 60 },
  { hex: '#9aa5b1', name: 'Silver', cost: 60 },
  { hex: '#ffb703', name: 'Solar Yellow', cost: 80 },
  { hex: '#2ec4b6', name: 'Lagoon', cost: 80 },
  { hex: '#8338ec', name: 'Ultraviolet', cost: 100 },
];
export const CUSTOM_PAINT_COST = 150;
