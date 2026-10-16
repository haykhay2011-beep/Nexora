// A loaded, playable world: terrain streaming, structures, water, sky, weather, people, animals, anomalies.
import * as THREE from 'three';
import type { WorldPlan } from '../gen/planTypes';
import { TerrainSampler } from '../gen/terrain';
import type { StructureResult, Interest } from '../gen/structures';
import type { WaterRect } from '../gen/landmarks';
import { ChunkManager } from './ChunkManager';
import { StructureLayer } from './StructureLayer';
import { Water, waterColor } from './Water';
import { Sky } from './Sky';
import { Weather } from './Weather';
import { Physics } from './Physics';
import type { WorkerPool } from './WorkerPool';
import { NPCManager } from '../entities/NPCs';
import { AnimalManager } from '../entities/Animals';
import { AnomalyManager, PickupManager } from '../game/Anomalies';
import { era as getEra } from '../data';
import type { Quality } from './Renderer';

export class World {
  readonly plan: WorldPlan;
  readonly ts: TerrainSampler;
  readonly phys: Physics;
  readonly chunks: ChunkManager;
  structures: StructureLayer | null = null;
  water: Water | null = null;
  readonly sky: Sky;
  readonly weather: Weather;
  readonly npcs: NPCManager;
  animals!: AnimalManager;
  anomalies!: AnomalyManager;
  readonly pickups: PickupManager;
  interest: Interest[] = [];
  doors: StructureResult['doors'] = [];
  waterRects: WaterRect[] = [];
  mists: THREE.Points | null = null;
  private fog: THREE.Fog;
  readonly root = new THREE.Group();
  structuresReady = false;

  constructor(private scene: THREE.Scene, private pool: WorkerPool, plan: WorldPlan, private quality: Quality, viewDistance: number) {
    this.plan = plan;
    this.ts = new TerrainSampler(plan.terrain);
    this.phys = new Physics(this.ts);
    this.chunks = new ChunkManager(pool, plan, this.ts);
    this.chunks.viewDistance = viewDistance;
    this.chunks.floraDistance = Math.min(viewDistance, 300 + quality.flora * 200);
    this.chunks.densityScale = quality.flora;
    this.chunks.shadowsNear = quality.shadows;
    this.root.add(this.chunks.root);
    const e = getEra(plan.eraId);
    this.sky = new Sky(plan.palette, plan.seed, { moon: plan.moon, extraMoons: e.sky.extraMoons, ring: e.sky.ring, stations: e.sky.stations, cloudiness: plan.weather.rainChance + plan.weather.fog * 0.5 });
    this.sky.setShadowSize(quality.shadowMap, quality.shadowExtent);
    this.sky.sun.castShadow = quality.shadows;
    scene.add(this.sky.root, this.sky.world);
    this.weather = new Weather(plan);
    this.root.add(this.weather.root);
    this.fog = new THREE.Fog(plan.palette.fog, 80, viewDistance * 1.3);
    scene.fog = this.fog;
    this.npcs = new NPCManager(scene, this.phys, plan.seed);
    this.pickups = new PickupManager(scene, this.phys);
    scene.add(this.root);
  }

  waterLevel = (x: number, z: number): number => {
    if (this.plan.moon) return -9999;
    for (const w of this.waterRects) {
      const c = Math.cos(w.rot), s = Math.sin(w.rot);
      const dx = x - w.x, dz = z - w.z;
      const u = dx * c + dz * s, v = -dx * s + dz * c;
      if (Math.abs(u) < w.w / 2 && Math.abs(v) < w.d / 2 && this.ts.height(x, z) < w.y) return w.y;
    }
    return 0;
  };

  /** Request structures; resolves when they are installed. */
  async loadStructures(): Promise<void> {
    const res = await this.pool.structures(this.plan.key);
    this.structures = new StructureLayer(res, this.quality.shadows);
    this.root.add(this.structures.root);
    this.phys.add(res.colliders);
    this.interest = res.interest;
    this.doors = res.doors;
    this.waterRects = res.waters;
    if (!this.plan.moon) {
      this.water = new Water(waterColor(this.plan.biome, this.plan.climate.temp, this.plan.eraId), res.waters);
      this.root.add(this.water.root);
    }
    if (res.mists.length) {
      const n = res.mists.length * 60;
      const pos = new Float32Array(n * 3);
      res.mists.forEach((m, i) => { for (let j = 0; j < 60; j++) pos.set([m.x + (Math.random() - 0.5) * m.r * 2, m.y + Math.random() * m.r, m.z + (Math.random() - 0.5) * m.r], (i * 60 + j) * 3); });
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      this.mists = new THREE.Points(g, new THREE.PointsMaterial({ color: '#ffffff', size: 18, transparent: true, opacity: 0.18, depthWrite: false }));
      this.root.add(this.mists);
    }
    this.animals = new AnimalManager(this.scene, this.phys, this.plan.animals, this.plan.seed, this.waterLevel);
    this.anomalies = new AnomalyManager(this.scene, this.phys, this.animals, this.npcs, this.plan.seed);
    for (const n of this.plan.npcs) this.npcs.add(n);
    this.structuresReady = true;
  }

  setFog(color: THREE.Color, near: number, far: number) {
    this.fog.color.copy(color);
    this.fog.near = near;
    this.fog.far = far;
  }

  update(dt: number, player: THREE.Vector3) {
    this.chunks.update(player.x, player.z);
    this.water?.update(player.x, player.z);
  }

  destroy() {
    this.chunks.destroy();
    this.structures?.destroy();
    this.water?.destroy();
    this.sky.destroy();
    this.weather.destroy();
    this.npcs.destroy();
    this.animals?.destroy();
    this.anomalies?.destroy();
    this.pickups.destroy();
    this.mists?.geometry.dispose();
    this.root.removeFromParent();
    this.scene.fog = null;
  }
}
