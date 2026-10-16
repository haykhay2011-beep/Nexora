// World layout: zones, hand-placed landmarks and game constants.
// North is -Z, east is +X. Sea surface is y = 0.

export const WORLD_SEED = 20460;
export const WORLD_HALF = 800; // world spans -800..800 on X and Z
export const CHUNK_SIZE = 64;

export const ZONES = [
  {
    id: 'reef', name: 'Sunlit Reef', x: 0, z: 560, r: 210, depth: 14, amp: 2.2, style: 'dunes',
    fog: [0x3cb4c4, 0x2a8fa8], sand: 0xe9d7a6, rock: 0xb79c7a, music: 'reef',
    subtitle: 'Warm shallows and coral gardens',
  },
  {
    id: 'kelp', name: 'Kelp Forest', x: -30, z: 290, r: 175, depth: 30, amp: 4.5, style: 'rolling',
    fog: [0x2e9a8a, 0x1d6e68], sand: 0xa7a07a, rock: 0x6e7660, music: 'kelp',
    subtitle: 'Tall green towers swaying in the current',
  },
  {
    id: 'city', name: 'Outer City', x: 0, z: 30, r: 195, depth: 52, amp: 1.2, style: 'flat',
    fog: [0x1f6f8f, 0x134d6a], sand: 0x8e9aa0, rock: 0x7a8288, music: 'city',
    subtitle: 'The drowned streets of Atlantis',
  },
  {
    id: 'temple', name: 'Temple District', x: 340, z: -170, r: 170, depth: 74, amp: 2.0, style: 'terrace',
    fog: [0x18506e, 0x0e3450], sand: 0x7c8692, rock: 0x5d6673, music: 'temple',
    subtitle: 'Where the priests kept the old signs',
  },
  {
    id: 'vents', name: 'Thermal Vents', x: -340, z: -170, r: 170, depth: 96, amp: 9, style: 'ridged',
    fog: [0x3a2a2a, 0x22161a], sand: 0x4a3a36, rock: 0x2c2426, music: 'vents',
    subtitle: 'Scalding water and strange glowing life',
  },
  {
    id: 'palace', name: 'Central Palace', x: 0, z: -250, r: 95, depth: 84, amp: 0.8, style: 'flat',
    fog: [0x14406a, 0x0a2848], sand: 0x8a96a8, rock: 0x6c7890, music: 'palace',
    subtitle: 'The heart of Atlantis',
  },
  {
    id: 'abyss', name: 'The Abyss', x: 0, z: -580, r: 215, depth: 158, amp: 16, style: 'canyon',
    fog: [0x02080f, 0x010306], sand: 0x1c2430, rock: 0x10161e, music: 'abyss',
    subtitle: 'Lightless depths',
  },
];

export const ZONE_BY_ID = Object.fromEntries(ZONES.map((z) => [z.id, z]));

// Flattened building pads. y is the floor height (negative = below surface).
export const PADS = [
  { id: 'base', x: 0, z: 560, r: 16, y: -14, blend: 10 },
  { id: 'grotto', x: -95, z: 470, r: 12, y: -18, blend: 10 },
  { id: 'wreck', x: 130, z: 640, r: 14, y: -16, blend: 10 },
  { id: 'guardians', x: -90, z: 250, r: 20, y: -31, blend: 12 },
  { id: 'echo', x: 95, z: 330, r: 10, y: -29, blend: 8 },
  { id: 'market', x: 70, z: -10, r: 18, y: -52, blend: 8 },
  { id: 'dolphinCourt', x: -85, z: 60, r: 13, y: -52, blend: 8 },
  { id: 'temple', x: 360, z: -200, r: 26, y: -74, blend: 12 },
  { id: 'labyrinth', x: -370, z: -205, r: 34, y: -96, blend: 14 },
  { id: 'sanctum', x: 0, z: -625, r: 24, y: -160, blend: 16 },
  { id: 'palace', x: 0, z: -250, r: 62, y: -82, blend: 20 },
];

// Named places for map discovery.
export const LANDMARKS = [
  { id: 'base', name: 'Home Base', x: 0, z: 560, r: 30, icon: 'base' },
  { id: 'grotto', name: 'Clam Grotto', x: -95, z: 470, r: 26, icon: 'poi' },
  { id: 'coralArch', name: 'Great Coral Arch', x: 70, z: 505, r: 24, icon: 'poi' },
  { id: 'wreck', name: 'Wreck of the Gull', x: 130, z: 640, r: 26, icon: 'poi' },
  { id: 'guardians', name: 'Guardian Circle', x: -90, z: 250, r: 30, icon: 'poi' },
  { id: 'echo', name: 'Echo Grotto', x: 95, z: 330, r: 22, icon: 'poi' },
  { id: 'fallenHead', name: 'Fallen Giant', x: 15, z: 225, r: 22, icon: 'poi' },
  { id: 'cityGate', name: 'City Gate', x: 0, z: 150, r: 24, icon: 'poi' },
  { id: 'market', name: 'Market Square', x: 70, z: -10, r: 26, icon: 'poi' },
  { id: 'dolphinCourt', name: 'Netted Courtyard', x: -85, z: 60, r: 22, icon: 'poi' },
  { id: 'fountain', name: 'Fountain Plaza', x: 0, z: 30, r: 22, icon: 'poi' },
  { id: 'temple', name: 'Temple of Tides', x: 360, z: -200, r: 40, icon: 'poi' },
  { id: 'labyrinth', name: 'Ember Labyrinth', x: -370, z: -205, r: 40, icon: 'poi' },
  { id: 'sanctum', name: 'Lightless Sanctum', x: 0, z: -625, r: 36, icon: 'poi' },
  { id: 'palace', name: 'Central Palace', x: 0, z: -250, r: 90, icon: 'palace' },
];

// Bubble vents that refill oxygen. y is filled in from terrain.
export const AIR_VENTS = [
  [-70, 505], [55, 600],
  [-60, 285], [55, 255], [15, 365], [-120, 210],
  [35, 70], [-55, -25], [110, 30], [-20, 120],
  [320, -140], [405, -235], [285, -205], [250, -90],
  [-295, -150], [-385, -125], [-320, -250], [-230, -110],
  [-50, -505], [55, -575], [-30, -660], [120, -470], [-140, -470],
  [140, -300], [-140, -300],
];

export const UPGRADES = {
  tank: {
    name: 'Oxygen Tank', icon: '🫧',
    desc: 'A larger tank lets you stay down longer.',
    base: 100,
    levels: [
      { cost: 15, value: 150, label: 'Tank Mk II' },
      { cost: 25, value: 210, label: 'Tank Mk III' },
      { cost: 40, value: 280, label: 'Tank Mk IV' },
    ],
  },
  fins: {
    name: 'Fins', icon: '🦶',
    desc: 'Swim faster and accelerate harder.',
    base: 1,
    levels: [
      { cost: 15, value: 1.2, label: 'Racing Fins' },
      { cost: 30, value: 1.4, label: 'Dolphin Fins' },
    ],
  },
  pressure: {
    name: 'Pressure Suit', icon: '🛡️',
    desc: 'Survive the crushing pressure of deeper water.',
    base: 45,
    levels: [
      { cost: 20, value: 110, label: 'Pressure Suit (110 m)' },
      { cost: 35, value: 300, label: 'Abyssal Suit (no limit)' },
    ],
  },
  light: {
    name: 'Flashlight', icon: '🔦',
    desc: 'A powerful beam that can pierce the Abyss.',
    base: 0,
    levels: [{ cost: 30, value: 1, label: 'Abyssal Lamp' }],
  },
  heat: {
    name: 'Heat Suit', icon: '🔥',
    desc: 'Insulation for the scalding Thermal Vents.',
    base: 0,
    levels: [{ cost: 30, value: 1, label: 'Heat Suit' }],
  },
  sonar: {
    name: 'Sonar Pulse', icon: '📡',
    desc: 'Press Q to send a pulse that reveals nearby items and paths.',
    base: 0,
    levels: [{ cost: 20, value: 1, label: 'Sonar Pulse' }],
  },
};

export const UPGRADE_ORDER = ['pressure', 'heat', 'light', 'tank', 'fins', 'sonar'];

export function upgradeValue(id, level) {
  const u = UPGRADES[id];
  if (!level) return u.base;
  return u.levels[Math.min(level, u.levels.length) - 1].value;
}

export const SHARD_IDS = ['reef', 'kelp', 'city', 'temple', 'vents', 'abyss', 'song'];
export const SHARD_NAMES = {
  reef: 'Shard of the Shallows',
  kelp: 'Shard of the Forest',
  city: 'Shard of the Market',
  temple: 'Shard of the Temple',
  vents: 'Shard of Fire',
  abyss: 'Shard of the Dark',
  song: 'Shard of Song',
};
export const SHARD_COLORS = {
  reef: 0x7ff3ff, kelp: 0x8dff9a, city: 0xffe38a, temple: 0xc59bff,
  vents: 0xff8a5c, abyss: 0x6aa8ff, song: 0xff9be0,
};

export const BASE_SPAWN = { x: 0, y: -9, z: 548, yaw: 0 };
