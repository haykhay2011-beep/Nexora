// Shapes of the WorldPlan produced by planWorld(). Plain JSON (structured-clone safe).
import type { EraId, SettlementTier, ChallengeType, Palette, LandmarkStage } from '../data/types';
import type { BiomeId } from '../geo/climate';
import type { TerrainParams, GroundStyle } from './terrain';
import type { PlaceInfo } from '../geo/places';

export interface RoadSeg { ax: number; az: number; bx: number; bz: number; w: number; main: boolean }

export type PlotRole = 'home' | 'market' | 'workshop' | 'civic' | 'tower' | 'farmhouse' | 'ruin' | 'construction' | 'dock' | 'station';

export interface Plot {
  id: number;
  x: number; z: number; rot: number;
  w: number; d: number; floors: number;
  style: string;
  role: PlotRole;
  seed: number;
  ruinOf?: string; // style id of the era the ruin came from
  base: number; // ground height at plot centre
}

export interface Farm { x: number; z: number; w: number; d: number; rot: number; crop: string; base: number }

export interface Prop { kind: string; x: number; z: number; rot: number; s: number; v?: number }

export interface Settlement {
  tier: SettlementTier;
  noun: string;
  x: number; z: number;
  radius: number;
  baseHeight: number;
  layout: string;
  roads: RoadSeg[];
  plots: Plot[];
  farms: Farm[];
  props: Prop[];
  walls: { r: number; h: number; gates: number[] } | null;
  port: { x: number; z: number; rot: number } | null;
  plaza: { x: number; z: number; r: number };
}

export interface PlacedLandmark {
  id: string;
  name: string;
  x: number; z: number;
  rot: number;
  state: LandmarkStage['state'];
  note: string | null;
  base: number;
  clear: number;
}

export interface Outfit {
  body: string; // trousers | coat | tunic | robe | fur | future
  hat: string;
  colors: [string, string, string, string, string]; // skin, primary, accent, hair, shoes
  hair: number; // 0 short 1 long 2 bun 3 bald
  scale: number;
  glow: boolean;
}

export interface NpcSpawn {
  id: string;
  name: string;
  job: string;
  jobName: string;
  work: string;
  fact: string;
  x: number; z: number;
  home: [number, number];
  workAt: [number, number];
  social: [number, number];
  outfit: Outfit;
  trader: boolean;
  questGiver: boolean;
  age: 'child' | 'adult' | 'elder';
  seed: number;
  sleepsOutside: boolean;
}

export interface AnimalSpawn { species: string; x: number; z: number; count: number; radius: number; domestic: boolean; seed: number }

export interface AnomalySpawn {
  instanceId: string;
  anomalyId: string;
  x: number; z: number;
  challenge: ChallengeType;
  seed: number;
  watcher?: { x: number; z: number; kind: 'npc' | 'animal'; species?: string };
}

export interface ClimateInfo {
  temp: number; summer: number; winter: number; rain: number; monsoon: boolean; greenSahara: boolean;
  dayOfYear: number; season: string; seasonTemp: number; snowCover: number; seaLevel: number; ice: number;
}

export interface WorldPlan {
  version: number;
  key: string;
  seed: number;
  lat: number; lon: number;
  presentLat: number; presentLon: number;
  year: number;
  eraId: EraId;
  regionId: string;
  subzone: string | null;
  moon: boolean;
  place: PlaceInfo;
  biome: BiomeId;
  biomeName: string;
  climate: ClimateInfo;
  terrain: TerrainParams;
  ground: GroundStyle;
  floraKit: string;
  flora: [string, number][];
  floraDensity: number;
  settlement: Settlement | null;
  outlying: Plot[];
  landmarks: PlacedLandmark[];
  npcs: NpcSpawn[];
  animals: AnimalSpawn[];
  anomalies: AnomalySpawn[];
  spawn: { x: number; z: number; facing: number };
  palette: Palette;
  humans: boolean;
  currency: { name: string; short: string; rate: number };
  goods: string[];
  crops: string[];
  boats: string[];
  mounts: string[];
  domestic: string[];
  facts: string[];
  arrivalFact: string;
  weather: { rainChance: number; snow: boolean; sandstorm: boolean; fog: number; monsoon: boolean; storminess: number };
  peopleTypes: { id: string; name: string; fact: string }[];
  hasCoast: boolean;
}
