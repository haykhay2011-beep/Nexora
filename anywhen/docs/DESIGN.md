# Anywhen — Design Document

Anywhen is a browser-based, third-person, open-world time travel game. The player is a young
**Time Walker** carrying the **Chronometer**. The timeline has shattered and *anomalies*
(objects and creatures from the wrong era) are scattered through history. The player picks any
point on Earth and any year from 72 million years ago to 3000 CE, explores a generated world on
foot, returns anomalies home, and repairs 12 Major Rifts.

## 1. Pillars

1. **Anywhere, anywhen.** Every (latitude, longitude, year) gives a playable, deterministic world.
2. **Data-driven.** Eras, regions, landmarks, animals, anomalies, dialogue and the story live in JSON
   in `src/data/`. Code reads the data. New content needs no code changes.
3. **Discovery over conflict.** No combat. Danger means being chased or knocked down, never harm.
4. **Respectful history.** Broad, well-established facts. When unsure, stay general. Tragedies are
   never gameplay.
5. **Runs well.** The target is 60 fps on a mid-range laptop at medium settings. All generation
   runs in Web Workers.

## 2. Architecture

```
            ┌──────────── main thread ────────────────────────────────────────┐
 UI (DOM) ──┤ Game (state machine: title → travel → loading → play → paused)  │
            │  ├─ Renderer + PostFX (grading, vignette, time-swirl)           │
            │  ├─ World runtime: ChunkManager, StructureLayer, Water, Sky,    │
            │  │                 Weather, NPCManager, AnimalManager, Props    │
            │  ├─ Player (controller, camera, mounts, outfit)                 │
            │  ├─ Gameplay: Anomalies, Energy, Story, Quests, Journal, Trade  │
            │  ├─ Audio (Web Audio synthesis)                                 │
            │  └─ Save (IndexedDB)                                            │
            └───────────────▲─────────────────────────────────────────────────┘
                            │ postMessage (transferable typed arrays)
            ┌───────────────┴──────── worker pool (gen.worker.ts) ────────────┐
            │ EarthData (earth.dat) → planWorld() → WorldPlan (JSON)          │
            │ buildChunk(plan, cx, cz, lod) → terrain mesh + flora instances  │
            │ buildStructures(plan) → building archetypes + instances +       │
            │                         landmark meshes + colliders             │
            └─────────────────────────────────────────────────────────────────┘
```

* **Determinism.** Every random choice comes from `Rng` streams seeded by
  `hash(round(lat,2), round(lon,2), eraBucket)` plus a purpose tag (`"flora"`, `"npc"` and so on).
  Generation code never calls `Math.random()`.
* **Pure generator.** `src/gen/**` does not import from the DOM or the renderer. Only geometry
  construction uses `three`'s math and BufferGeometry helpers, and those work in workers and Node.
  This keeps the generator unit-testable in Node.
* **Same sampler everywhere.** `TerrainSampler` is built only from the `WorldPlan`, so the worker
  (meshing) and the main thread (collision, NPC placement) compute identical heights.

## 3. Module list

| Path | Responsibility |
|------|----------------|
| `src/core/rng.ts` | 32-bit hashing, seeded PRNG streams |
| `src/core/noise.ts` | 2D simplex noise, fBm, ridged noise, domain warp |
| `src/core/timeScale.ts` | non-linear slider ↔ year mapping, year parsing/formatting, eras |
| `src/core/events.ts` | tiny typed event bus |
| `src/geo/earth.ts` | loads/decodes `earth.dat`, bilinear sampling of land/elev/rivers/names |
| `src/geo/paleo.ts` | plate drift (deep time), sea level, ice sheets, exposed shelves |
| `src/geo/climate.ts` | temperature, rainfall, seasonality, biome classification |
| `src/geo/places.ts` | human-readable place names ("Nile Valley, Egypt"), city lookup |
| `src/gen/profiles.ts` | loads era/region JSON, resolves region polygon, merges profile |
| `src/gen/plan.ts` | `planWorld(lat, lon, year)` → `WorldPlan` (settlements, roads, farms, ports, ruins, landmarks, spawns) |
| `src/gen/terrain.ts` | `TerrainSampler` height/water/colour functions from a plan |
| `src/gen/chunk.ts` | terrain chunk meshing (LOD + skirts), flora scatter |
| `src/gen/structures.ts` | building archetypes per style, instancing transforms, colliders |
| `src/gen/landmarks/*.ts` | parametric landmark builders (pyramid, colonnade, amphitheater …) |
| `src/gen/meshkit.ts` | low-poly geometry toolkit (merge primitives with vertex colours) |
| `src/workers/gen.worker.ts` | worker entry: plan / chunk / structures jobs |
| `src/engine/*` | renderer, post-processing, sky, water, weather, chunk streaming, input |
| `src/entities/*` | player, humanoid instancing, animals, mounts |
| `src/game/*` | anomalies, energy, story, quests, journal, inventory, trade, dialogue, photo |
| `src/ui/*` | title, HUD, globe/time-travel, journal, inventory, map, settings, dialogue, cards |
| `src/audio/*` | ambient beds, generative music, SFX |
| `src/save/*` | IndexedDB persistence with fallbacks |

## 4. Data file formats (src/data)

### eras.json
```jsonc
{ "id": "classical", "name": "Classical Antiquity", "start": -800, "end": 500, "bucketYears": 50,
  "tech": 3, "humans": true, "settlementScale": 1.0, "maxTier": "city", "energyTier": 1,
  "palette": { "tint": "#ffe2a8", "saturation": 1.1, "contrast": 1.05, "fog": "#e8d6b0", "skyTop": "#4a86d4",
               "skyHorizon": "#f3dcae", "sun": "#fff4e0", "ambient": "#b8b0a0", "ground": "#6a7a4a" },
  "climateOffset": 0, "seaLevel": 0, "floraKit": "holocene",
  "styles": ["stone_columned", "mudbrick_flat"], "roads": "stone", "layout": "grid",
  "vehicles": ["cart"], "boats": ["galley"], "mounts": ["horse", "boat"],
  "currency": { "name": "silver coins", "short": "ⓢ", "rate": 1 },
  "clothing": { "styles": ["tunic"], "colors": ["#e9dcc0"], "accents": ["#b5523b"], "headwear": ["none"] },
  "domestic": ["sheep", "goat", "horse"], "ambience": ["crowd", "hammer"],
  "music": { "instrument": "lyre", "scale": "dorian", "tempo": 84 },
  "inventions": [{ "id": "dome", "name": "Concrete dome", "fact": "…" }], "goods": ["olive oil", "amphora"],
  "people": { … }, "sky": { … }, "lights": { … }, "description": "…" }
```
The full type is `EraProfile` in `src/data/types.ts`.

### regions.json
Each region has a coarse lon/lat polygon, a human-arrival year, optional sub-zones (islands
settled later), and per-era overrides (`eras.<eraId>`) for architecture style, materials,
crops, plants, animals, clothing, currency, place-type nouns and goods. Missing keys fall back
to the era defaults.

### landmarks.json
```jsonc
{ "id": "giza", "name": "Pyramids of Giza", "lat": 29.9792, "lon": 31.1342, "region": "mena",
  "builder": "pyramidGroup", "params": { … },
  "stages": [ { "from": -2600, "state": "construction" }, { "from": -2560, "state": "complete" },
              { "from": 1300, "state": "weathered", "note": "…" } ],
  "fact": "…", "terrain": { "type": "flatten", "radius": 400 } }
```
`state` is one of `construction | complete | weathered | ruined | restored`. Before the first stage
the landmark is absent. `builder` names a function in `src/gen/landmarks/index.ts`. Natural
wonders use `terrain` modifiers (`canyon`, `peak`, `falls`, `monolith`, `reef`, `flatten`)
that the TerrainSampler applies.

### animals.json, anomalies.json, rifts.json, dialogue.json, items.json, cities.json
* **animals**: archetype (`quadruped`, `theropod`, `sauropod`, `bird`, `fish`, `hopper`, `drone`),
  body parameters, colours, behaviour (`grazer`, `herd`, `wander`, `predator`, `flyer`, `swimmer`),
  the eras and biomes where it lives, and a fact.
* **anomalies**: model key, home era (plus an optional region), challenge type
  (`catch | chase | puzzle | sneak`), and a fact.
* **rifts**: 12 hand-written quest chains. Each step is one of the typed objectives `travel | talk |
  find | capture | return | photograph | visit | puzzle | deliver | moon`.
* **dialogue**: per-era and per-region template lines with `{slots}`.
* **cities**: historical names by year range and size tiers, used for place naming and
  settlement scale.

## 5. Geography and generation

1. **Earth grid** (`public/data/earth.dat`, 0.25°): land coverage, lake coverage, estimated
   elevation, physical feature class, major-river angle/offset, distance to coast, tectonic plate,
   plus 0.5° name grids (country, admin-1, physical region, marine area). It is baked from Natural
   Earth by `tools/bake-earth.mjs`.
2. **Paleo transform.** For years earlier than 1 Ma, each plate is rotated by a time-scaled Euler
   rotation (simplified Late-Cretaceous offsets) and sea level rises. In glacial periods the sea
   falls, shelves in `shelves.json` become land, and ice-sheet polygons cover the north.
3. **Climate.** Temperature comes from latitude, elevation lapse rate, continentality and the era
   offset. Rainfall comes from latitude belts, coast distance, desert/rainforest feature overrides and
   a monsoon flag. The biome follows from a Whittaker-style table.
4. **Plan.** The plan picks a settlement tier from population pressure (region human arrival, era
   scale, biome habitability, river/coast boost, proximity to a known city), lays out roads (grid,
   radial or organic by style), plots, farms, a port and ruins of earlier eras, places landmarks
   within 4 km, and sets spawn tables for NPCs, animals and anomalies.
5. **Terrain.** Relief amplitude follows the elevation and feature class (ridged noise for
   mountains, dunes for deserts). A coastline comes from interpolated land coverage plus a domain
   warp. Rivers are carved along the baked angle. Settlement plateaus and landmark modifiers are
   applied last.
6. **Area.** Each world is 6 × 6 km, streamed as 128 m chunks with 3 LOD levels and skirts. A
   12 km low-resolution horizon mesh fills the distance, and its vertex shader hides it under the
   near chunks.

## 6. Rendering

* Flat-shaded Lambert materials with vertex colours (the low-poly look), and a hemisphere light
  plus a sun/moon directional light whose shadow camera follows the player.
* Instancing: flora per chunk (`InstancedMesh` per archetype, LOD swaps geometry), buildings per
  settlement (archetype variants × instances), NPCs and animals (one `InstancedMesh` per body
  archetype, limb animation in the vertex shader using a per-vertex `part` attribute).
* Post pass: era colour grading (tint, saturation, contrast), vignette, and the time-travel swirl.
* Frustum culling per chunk mesh. Distance culling for small flora and NPCs.

## 7. Gameplay systems

* **Chrono energy.** The jump cost grows with log₁₀ of the year gap plus a small cost for distance.
  Energy regenerates slowly up to 50 % so the player is never stuck. Returning anomalies gives
  large refills and raises the maximum.
* **Era unlocks.** The game starts with 3500 BCE to 2200 CE. Rifts unlock the Moon, the Ice and
  Stone Ages, the Age of Mammals and Dinosaurs, and the Far Future.
* **Anomalies.** 1–3 per world, deterministic per world key. The radar points to the nearest one.
  Each has a challenge: *catch* (it hops away), *chase* (fast, tires out), *puzzle* (ring
  alignment), or *sneak* (a watcher's view cone). Captured anomalies go into the Chrono Vault and
  are returned in their home era for rewards.
* **Story.** 12 Major Rifts run as one chain, each with 3–6 typed steps, story NPCs and pickups
  spawned when their step is active. Fixing all 12 opens the ending at the Archive of Anywhen
  in 2999.
* **Side quests.** NPC requests generated from templates: deliver, find, help-build, photograph,
  gather.
* **Journal.** Places, landmarks, animals, people, inventions, anomalies, photos, rifts.
* **Trade.** Each era/region has a currency name and exchange rate. Items have a base value.

## 8. Controls

WASD move · Mouse look · Shift run · Space jump/climb · C crouch · E interact · F mount/dismount ·
Q Chronometer pulse · P camera mode · T time travel · J journal · M map · Tab inventory · Esc pause.

## 9. Save format (IndexedDB `anywhen` / store `saves`, key `slot0`)

`{ version, player:{lat,lon,year,pos,rot}, energy, maxEnergy, unlocked:{…}, inventory, money,
vault, fixedAnomalies[], journal{…}, photos[], quests, story:{rift, step, flags}, favorites[],
visited[], settings }`

## 10. Build order (all milestones delivered together)

1. Scaffold, core libs, Earth bake.
2. Data files.
3. Generator (plan, terrain, chunks, structures, landmarks) + workers + tests.
4. Engine (renderer, streaming, sky, water, weather, post) + player/camera/mounts.
5. NPCs, animals, dialogue, trade, anomalies, energy, story, quests, journal, photo.
6. UI, globe, audio, save/load, settings.
7. Playtest in headless Chromium across 5+ places/times, plus a performance and bug pass.
