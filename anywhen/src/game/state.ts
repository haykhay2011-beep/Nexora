// Persistent game state (saved to IndexedDB).
import type { EraId } from '../data/types';

export interface Settings {
  sensitivity: number;
  invertY: boolean;
  master: number;
  music: number;
  sfx: number;
  ambient: number;
  quality: 'low' | 'medium' | 'high';
  viewDistance: number;
  subtitles: boolean;
  fov: number;
  dayLength: number; // real minutes per in-game day
}

export const DEFAULT_SETTINGS: Settings = {
  sensitivity: 1, invertY: false, master: 0.8, music: 0.55, sfx: 0.8, ambient: 0.7,
  quality: 'medium', viewDistance: 640, subtitles: true, fov: 65, dayLength: 24,
};

export interface VaultItem { instanceId: string; anomalyId: string; fromPlace: string; fromYear: number }
export interface SideQuest {
  id: string;
  worldKey: string;
  type: 'deliver' | 'find' | 'build' | 'photograph' | 'gather';
  giver: string; giverName: string;
  target?: string; targetName?: string;
  item?: string; count?: number;
  subject?: string; subjectName?: string;
  text: string;
  reward: number;
  done: boolean;
  place: string;
}
export interface JournalEntry { name: string; fact: string; at: number; extra?: string }
export interface Photo { id: string; data: string; caption: string; place: string; year: number; at: number; subjects: string[] }
export interface Favorite { name: string; lat: number; lon: number; year: number; moon: boolean }

export interface GameState {
  version: number;
  createdAt: number;
  playTime: number;
  player: { lat: number; lon: number; year: number; moon: boolean; x: number; z: number; heading: number };
  hour: number;
  energy: number;
  maxEnergy: number;
  money: number;
  inventory: Record<string, number>;
  vault: VaultItem[];
  captured: string[];
  returned: string[];
  unlocks: { eras: EraId[]; moon: boolean; mounts: string[] };
  story: { rift: number; step: number; done: string[]; ended: boolean; intro: boolean };
  sideQuests: SideQuest[];
  journal: {
    places: Record<string, JournalEntry>;
    landmarks: Record<string, JournalEntry>;
    animals: Record<string, JournalEntry>;
    people: Record<string, JournalEntry>;
    inventions: Record<string, JournalEntry>;
    anomalies: Record<string, JournalEntry>;
  };
  photos: Photo[];
  favorites: Favorite[];
  visited: string[];
  pickups: string[];
  translatorUsed: string[];
  settings: Settings;
}

export const START = { lat: 29.9792, lon: 31.1342, year: -2560 };

export function newGame(): GameState {
  return {
    version: 1,
    createdAt: Date.now(),
    playTime: 0,
    player: { lat: START.lat, lon: START.lon, year: START.year, moon: false, x: NaN, z: NaN, heading: 0 },
    hour: 9,
    energy: 100,
    maxEnergy: 100,
    money: 30,
    inventory: {},
    vault: [],
    captured: [],
    returned: [],
    unlocks: { eras: ['earlyciv', 'classical', 'medieval', 'exploration', 'industrial', 'modern', 'nearfuture'], moon: false, mounts: ['boat'] },
    story: { rift: 0, step: 0, done: [], ended: false, intro: false },
    sideQuests: [],
    journal: { places: {}, landmarks: {}, animals: {}, people: {}, inventions: {}, anomalies: {} },
    photos: [],
    favorites: [
      { name: 'Giza, Egypt', lat: 29.9792, lon: 31.1342, year: -2560, moon: false },
      { name: 'Rome, Italy', lat: 41.8902, lon: 12.4922, year: 100, moon: false },
      { name: 'Kyoto, Japan', lat: 35.0116, lon: 135.768, year: 1100, moon: false },
    ],
    visited: [],
    pickups: [],
    translatorUsed: [],
    settings: { ...DEFAULT_SETTINGS },
  };
}
