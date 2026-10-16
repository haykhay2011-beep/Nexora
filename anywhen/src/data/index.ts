// Typed access to all JSON data files.
import erasJson from './eras.json';
import regionsJson from './regions.json';
import stylesJson from './styles.json';
import floraJson from './flora.json';
import cropsJson from './crops.json';
import itemsJson from './items.json';
import animalsJson from './animals.json';
import anomaliesJson from './anomalies.json';
import landmarksJson from './landmarks.json';
import citiesJson from './cities.json';
import riftsJson from './rifts.json';
import dialogueJson from './dialogue.json';
import paleoJson from './paleo.json';
import geonamesJson from './geonames.json';
import type {
  EraProfile, RegionProfile, BuildingStyle, CropDef, ItemDef, AnimalDef, AnomalyDef, LandmarkDef, CityDef, RiftDef, EraId,
} from './types';

export interface FloraSpecies {
  id: string; name: string; arch: string; colors: string[]; trunk: string; size: [number, number];
  biomes: string[] | '*'; kits: string[]; regions?: string[]; nearWater?: boolean; tropical?: boolean;
}
export interface BiomeDef { name: string; ground: string; grass: string; density: number; dunes?: boolean }
export interface FloraData {
  biomes: Record<string, BiomeDef>;
  species: FloraSpecies[];
  kits: Record<string, Record<string, [string, number][]>>;
}
export interface PaleoData {
  plates: Record<string, { name: string; centroid: [number, number]; shift66: [number, number] }>;
  shelves: { name: string; depth: number; polygon: [number, number][]; polygon2?: [number, number][] }[];
  iceSheets: { name: string; polygon: [number, number][] }[];
  glacial: { from: number; to: number; factor: number }[];
}
export interface DialogueData {
  names: Record<string, string[]>;
  greetings: Record<string, string[]>;
  smalltalk: Record<string, string[]>;
  facts: string[];
  hints: string[];
  farewells: string[];
  translator: string[];
  trader: Record<string, string[]>;
  requests: Record<string, string[]>;
  thanks: string[];
  night: string[];
}
export interface GeoNames {
  countries: { name: string; continent: string }[];
  admin1: { name: string; country: string }[];
  regions: { name: string; cls: string }[];
  marine: string[];
}

export const ERAS = erasJson as unknown as EraProfile[];
export const REGIONS = regionsJson as unknown as RegionProfile[];
export const STYLES = stylesJson as unknown as BuildingStyle[];
export const FLORA = floraJson as unknown as FloraData;
export const CROPS = cropsJson as unknown as CropDef[];
export const ITEMS = itemsJson as unknown as ItemDef[];
export const ANIMALS = animalsJson as unknown as AnimalDef[];
export const ANOMALIES = anomaliesJson as unknown as (AnomalyDef & { featured?: { lat: number; lon: number; radiusKm: number; era: EraId }[] })[];
export const LANDMARKS = landmarksJson as unknown as (LandmarkDef & { arrive?: number })[];
export const CITIES = citiesJson as unknown as CityDef[];
export const RIFTS = riftsJson as unknown as RiftDef[];
export const DIALOGUE = dialogueJson as unknown as DialogueData;
export const PALEO = paleoJson as unknown as PaleoData;
export const GEONAMES = geonamesJson as unknown as GeoNames;

const byId = <T extends { id: string }>(arr: T[]) => new Map(arr.map((x) => [x.id, x]));
export const ERA_BY_ID = byId(ERAS);
export const REGION_BY_ID = byId(REGIONS);
export const STYLE_BY_ID = byId(STYLES);
export const SPECIES_BY_ID = byId(FLORA.species);
export const CROP_BY_ID = byId(CROPS);
export const ITEM_BY_ID = byId(ITEMS);
export const ANIMAL_BY_ID = byId(ANIMALS);
export const ANOMALY_BY_ID = byId(ANOMALIES);
export const LANDMARK_BY_ID = byId(LANDMARKS);
export const RIFT_BY_ID = byId(RIFTS);

export function era(id: EraId | string): EraProfile {
  const e = ERA_BY_ID.get(id as EraId);
  if (!e) throw new Error('unknown era ' + id);
  return e;
}
