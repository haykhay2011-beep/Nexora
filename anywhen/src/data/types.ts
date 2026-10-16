// Shared shapes for the JSON data files in src/data. Code only reads these; new content is
// added by editing the JSON (see README "Adding content").

export type EraId =
  | 'dinosaurs' | 'mammals' | 'iceage' | 'stoneage' | 'earlyciv' | 'classical' | 'medieval'
  | 'exploration' | 'industrial' | 'modern' | 'nearfuture' | 'farfuture';

export type SettlementTier = 'none' | 'camp' | 'hamlet' | 'village' | 'town' | 'city' | 'metropolis';
export const TIER_ORDER: SettlementTier[] = ['none', 'camp', 'hamlet', 'village', 'town', 'city', 'metropolis'];

export type RoadType = 'none' | 'trail' | 'dirt' | 'stone' | 'cobble' | 'asphalt' | 'glow';
export type Layout = 'organic' | 'grid' | 'radial' | 'linear' | 'ring';

export interface Palette {
  tint: string; saturation: number; contrast: number; fog: string;
  skyTop: string; skyHorizon: string; sun: string; ambient: string; ground: string;
}

export interface ClothingSpec {
  /** body silhouette: robe = long skirt cone, tunic = knee length, trousers, wrap, coat, suit, future */
  styles: string[];
  colors: string[];
  accents: string[];
  headwear: string[]; // none | cap | wide_hat | hood | wrap | fur_hood | visor | headband | brimmed
  /** chance of a cloak/cape layer */
  layer?: number;
}

export interface Invention { id: string; name: string; fact: string }
export interface PeopleType { id: string; name: string; work: WorkKind; fact: string }
export type WorkKind = 'farm' | 'market' | 'craft' | 'dock' | 'scholar' | 'build' | 'herd' | 'idle' | 'gather' | 'cook';

export interface EraProfile {
  id: EraId;
  name: string;
  start: number; // inclusive year (negative = BCE / years before)
  end: number;   // exclusive
  bucketYears: number;
  tech: number; // 0..10
  humans: boolean;
  settlementScale: number;
  maxTier: SettlementTier;
  palette: Palette;
  climateOffset: number; // global mean temperature offset, °C
  seaLevel: number; // metres relative to present
  floraKit: 'cretaceous' | 'cenozoic' | 'pleistocene' | 'holocene' | 'future';
  styles: string[];
  roads: RoadType;
  layout: Layout;
  vehicles: string[];
  boats: string[];
  mounts: string[];
  currency: Currency;
  clothing: ClothingSpec;
  domestic: string[];
  ambience: string[];
  music: { instrument: string; scale: string; tempo: number; pad: string };
  inventions: Invention[];
  goods: string[];
  people: PeopleType[];
  sky: { extraMoons: number; stations: boolean; ring: boolean; contrails: boolean };
  lights: number; // 0..1 how much artificial light settlements have at night
  energyTier: number; // used for unlock gating
  description: string;
}

export interface Currency { name: string; short: string; rate: number }

export interface RegionEraOverride {
  styles?: string[];
  biomeStyles?: Record<string, string[]>;
  crops?: string[];
  domestic?: string[];
  plants?: string[];
  clothing?: Partial<ClothingSpec>;
  currency?: Currency;
  goods?: string[];
  people?: PeopleType[];
  layout?: Layout;
  walls?: boolean;
  boats?: string[];
  mounts?: string[];
  settlementScale?: number;
  nouns?: Partial<Record<SettlementTier, string>>;
  facts?: string[];
}

export interface SubZone extends RegionEraOverride {
  name: string;
  polygons: [number, number][][];
  humanArrival?: number;
  eras?: Partial<Record<EraId, RegionEraOverride>>;
}

export interface RegionProfile {
  id: string;
  name: string;
  polygons: [number, number][][]; // [lon, lat]
  humanArrival: number;
  skin: number[]; // weights for the 8 skin tones in humans.ts
  hair: number[]; // weights for hair colours
  subzones?: SubZone[];
  defaults: RegionEraOverride;
  eras: Partial<Record<EraId, RegionEraOverride>>;
}

export interface BuildingStyle {
  id: string;
  shape: 'box' | 'round' | 'long' | 'tower' | 'tent' | 'dome' | 'skyscraper' | 'factory' | 'spire' | 'stilt' | 'courtyard' | 'terrace';
  roof: 'flat' | 'gable' | 'hip' | 'curved' | 'dome' | 'cone' | 'none' | 'vault' | 'sawtooth' | 'pyramid' | 'thatch_cone' | 'garden';
  walls: string[];
  roofs: string[];
  trim: string;
  floors: [number, number];
  width: [number, number];
  depth: [number, number];
  features: string[];
  window: string;
  lit: number; // 0..1 window glow at night
  material: string;
}

export interface CropDef { id: string; name: string; shape: 'grain' | 'paddy' | 'tall' | 'vine' | 'orchard' | 'root' | 'bush' | 'palm' | 'cotton'; color: string; soil: string; fact: string }

export type AnimalArchetype = 'quadruped' | 'theropod' | 'sauropod' | 'bird' | 'fish' | 'hopper' | 'drone' | 'pterosaur' | 'penguin';
export type Behaviour = 'grazer' | 'herd' | 'wander' | 'predator' | 'flyer' | 'swimmer' | 'skittish' | 'follower';

export interface AnimalDef {
  id: string;
  name: string;
  archetype: AnimalArchetype;
  scale: number; // body length in metres (roughly)
  body: { l: number; h: number; w: number; leg: number; legT: number; neck: number; neckUp: number; head: number; tail: number };
  features: string[];
  colors: string[]; // body, belly/legs, accent
  behaviour: Behaviour;
  speed: [number, number]; // walk, run m/s
  eras: EraId[];
  regions: string[] | '*';
  biomes: string[] | '*';
  plates?: number[]; // deep-time placement by plate id
  domestic?: boolean;
  group: [number, number];
  sound: string;
  fact: string;
}

export type ChallengeType = 'catch' | 'chase' | 'puzzle' | 'sneak';

export interface AnomalyDef {
  id: string;
  name: string;
  model: string;
  homeEra: EraId;
  homeRegion?: string;
  homeHint: string;
  challenge: ChallengeType;
  creature?: boolean;
  story?: boolean;
  energy: number;
  fact: string;
}

export interface LandmarkStage { from: number; state: 'construction' | 'complete' | 'weathered' | 'ruined' | 'restored'; note?: string }
export interface TerrainMod { type: 'flatten' | 'canyon' | 'peak' | 'falls' | 'monolith' | 'reef' | 'island' | 'gorge' | 'lake'; radius: number; height?: number; depth?: number; angle?: number; width?: number }

export interface LandmarkDef {
  id: string;
  name: string;
  lat: number;
  lon: number;
  region: string;
  kind: 'built' | 'natural' | 'imagined';
  builder: string;
  params: Record<string, number | string | boolean | number[] | string[]>;
  stages: LandmarkStage[];
  terrain?: TerrainMod;
  offset?: [number, number]; // metres from world centre after snapping
  fact: string;
  facts?: string[];
}

export interface CityDef {
  name: string;
  lat: number;
  lon: number;
  country: string;
  founded: number;
  names?: { name: string; from: number; to: number }[];
  /** [year, tier] pairs, ascending. Tier applies from that year on. */
  tiers: [number, SettlementTier][];
}

export interface ItemDef {
  id: string;
  name: string;
  icon: string;
  value: number;
  kind: 'good' | 'food' | 'material' | 'quest' | 'tool' | 'souvenir';
  eras?: EraId[];
  fact?: string;
}

export type StepType = 'travel' | 'talk' | 'find' | 'capture' | 'return' | 'photograph' | 'visit' | 'puzzle' | 'deliver' | 'moon';

export interface RiftStep {
  type: StepType;
  text: string;
  hint?: string;
  lat?: number; lon?: number; radiusKm?: number; yearMin?: number; yearMax?: number;
  npc?: string;
  item?: string;
  count?: number;
  anomaly?: string;
  landmark?: string;
  lines?: string[];
  era?: EraId;
}

export interface RiftDef {
  id: string;
  index: number;
  title: string;
  place: string;
  year: number;
  lat: number;
  lon: number;
  intro: string;
  npcs: { id: string; name: string; role: string; outfit?: string; lines: string[] }[];
  steps: RiftStep[];
  outro: string;
  mirra: string;
  unlocks: string[];
  reward: { energy: number; maxEnergy: number };
  fact: string;
}
