# Anywhen

A 3D open-world time-travel game for the browser. You are a young **Time Walker**. With the
Chronometer on your wrist you can go to any place on Earth in any year, from 72 million years ago
to 3000 CE, and to the Moon. Something has shattered the timeline. Objects and creatures from the
wrong time (**anomalies**) are turning up all through history. Catch them, send them home, and
repair the twelve **Major Rifts**.

Every world is generated from real geography (public-domain Natural Earth data), the era, and
the region's climate and culture, so the same place and time always looks the same. The
game is family-friendly: there is no combat. Predators only chase you or knock you over, and
historical tragedies are never gameplay.

Built with [three.js](https://threejs.org), TypeScript and Vite. There are no paid or external
art assets: every model, texture, sound and piece of music is generated in code.

---

## Install, run, build

Requirements: Node.js 18+ (20+ recommended) and a browser with WebGL2 (any recent Chrome, Edge,
Firefox or Safari).

```bash
cd anywhen
npm install
npm run dev        # dev server at http://localhost:5173
npm run build      # type-check + production build into dist/
npm run preview    # serve the production build
npm test           # unit tests (determinism, every era × region, landmarks, data integrity)
npm run typecheck  # TypeScript only
```

`dist/` is a static site, and all paths are relative (`base: './'`), so it can be hosted from any
folder or static host.

### Headless playtests (optional)

These need the dev server running, plus a Chromium binary (set `CHROMIUM_PATH` if it is not at the
default Playwright location):

```bash
node tools/playtest.mjs shots/          # travels to Giza, Sahara 3000 BCE, Tokyo 2024, Amazon 1500,
                                        # Arctic 20,000 years ago, Montana 70 Mya and the Moon, and screenshots each
node tools/flowtest.mjs shots/          # new game → talk, capture, journal, inventory, map, travel, pause, photo, return
node tools/rifttest.mjs shots/          # plays all 12 Major Rifts and the ending (RIFTS=giza,apollo to pick some)
```

`PLACES='[["name",lat,lon,year,moon]]'` overrides the playtest destinations.

### Rebuilding the Earth data (optional)

`public/data/earth.dat` and `src/data/geonames.json` are already committed. To regenerate them
from Natural Earth (the source files are downloaded into `tools/.cache/`):

```bash
npm run bake
```

---

## Controls

| Key | Action |
| --- | --- |
| **W A S D** | Move |
| **Mouse** | Look |
| **Shift** | Run (on a glider: speed boost) |
| **Space** | Jump, climb ledges, swim up (on a glider: rise) |
| **C** | Crouch / sneak (on a glider: dive) |
| **E** | Interact: talk, trade, pick up, capture |
| **R** | Return an anomaly when you are in its home time |
| **F** | Mount or dismount a horse, camel or boat |
| **G** | Hover-glider (once unlocked) |
| **Q** | Chronometer pulse: shows the direction of nearby anomalies and items |
| **P** | Camera mode (click or Space takes a photo) |
| **T** | Time travel (the Chronometer) |
| **J** | Chrono Journal |
| **M** | Local map |
| **Tab** | Inventory and Chrono Vault |
| **Esc** | Pause, or close the current screen |
| **1–9** | Choose a dialogue option |

### Time travel screen

* Spin the globe, then click to pick a place. Gold dots are landmarks that exist in the chosen year.
* The timeline slider is non-linear: recent history gets more room than deep time.
* Type a year, for example `1500`, `3000 BCE`, `20,000 years ago` or `66 mya`.
* Use **Random place & time**, the landmark list, or your favourites.
* The globe changes with time: ice sheets in the Ice Age, city lights in modern times, and
  drifted continents in deep time.
* Jumps cost chrono energy, which grows with distance in time. Energy regenerates slowly and is
  refilled by returning anomalies. Deep time, the far future and the Moon unlock as you progress.

---

## Adding content

All content is data-driven JSON in `src/data/`. TypeScript types for every file live in
`src/data/types.ts`. After any change, run `npm test`: the data tests check references
(styles, flora, animals, items, landmark builders) and generate every era × region combination.

### A new era: `eras.json`

```jsonc
{
  "id": "renaissance", "name": "Renaissance", "start": 1400, "end": 1600, "bucketYears": 25,
  "tech": 5, "humans": true, "settlementScale": 1.2, "maxTier": "city",
  "palette": { "tint": "#fff0d8", "saturation": 1.05, "contrast": 1.03, "fog": "#e4dccb",
               "skyTop": "#4a82cc", "skyHorizon": "#f0e2c8", "sun": "#fff4e0", "ambient": "#b8b0a0", "ground": "#6a7a4a" },
  "climateOffset": -0.3, "seaLevel": 0, "floraKit": "holocene",
  "styles": ["timber_frame"], "roads": "cobble", "layout": "organic",
  "vehicles": ["cart"], "boats": ["sailship"], "mounts": ["horse", "boat"],
  "currency": { "name": "florins", "short": "fl", "rate": 1 },
  "clothing": { "styles": ["tunic"], "colors": ["#7a3a2a"], "accents": ["#e8c860"], "headwear": ["cap"] },
  "domestic": ["horse", "sheep"], "ambience": ["crowd", "bells"], "music": { "scale": "dorian", "tempo": 88, "instrument": "lute" },
  "inventions": [{ "id": "press", "name": "Printing press", "fact": "…" }],
  "goods": ["cloth", "paper"], "description": "…"
}
```

Eras must cover the timeline without gaps (`start`/`end` in years, negative = BCE). Copy an
existing neighbouring era for the full set of keys (`people`, `sky`, `lights`, `energyTier`).

### A new region or sub-zone: `regions.json`

A region has coarse lat/lon `polygons`, a `humanArrival` year (wilderness before it), skin and hair
palettes, `defaults`, and per-era overrides under `eras.<eraId>`: building styles, crops,
domestic animals, clothing, currency, place nouns and goods. A `subzone` can narrow any of these
for an area (for example a Mediterranean `biomeMap`, or islands settled later). Anything missing
falls back to the era defaults.

### A new landmark: `landmarks.json`

```jsonc
{
  "id": "my_tower", "name": "My Tower", "lat": 0, "lon": 0, "region": "europe",
  "kind": "built",                       // or "natural" (shown in every era it exists)
  "builder": "lattice_tower",            // a function in src/gen/landmarks/*.ts
  "params": { "h": 120, "base": 40, "color": "#8a6a4a", "clear": 80 },
  "stages": [
    { "from": 1880, "state": "construction", "note": "…" },
    { "from": 1885, "state": "complete" },
    { "from": 2100, "state": "weathered" }
  ],
  "fact": "…", "facts": ["…"],
  "terrain": { "type": "flatten", "radius": 150 }
}
```

* `state` is one of `construction | complete | weathered | ruined | restored`. Before the
  first stage the landmark does not exist.
* `terrain` modifiers are `flatten | peak | canyon | falls | monolith | reef | island | pit | lake | crater`.
* To add a new shape, write a `Builder` (`(kit, ctx) => void`) in `src/gen/landmarks/` using the
  MeshKit primitives (`box`, `cyl`, `cone`, `beam`, `lathe`, `extrude`, `gable`, `pyramid`…), then
  export it.

### Other data

| File | What it holds |
| --- | --- |
| `cities.json` | Real cities with founding year, size tiers over time, and historical names (Londinium → London) |
| `styles.json` | Building styles: shape, materials, colours, roofs, windows |
| `flora.json` / `crops.json` | Plant species per biome and era kit, and farm crops |
| `animals.json` | Body plan, colours, behaviour, eras, biomes and an optional region list or exclusions |
| `anomalies.json` | Model, home era (and region), challenge (`catch, chase, puzzle, sneak`), energy and fact |
| `rifts.json` | The 12 Major Rifts as typed steps: `travel, talk, find, capture, return, photograph, visit, puzzle, deliver, moon` |
| `dialogue.json` | Template lines with `{slots}` by era, region and job |
| `items.json` | Items, trade goods and quest objects |
| `paleo.json` | Plate rotations and ice-sheet outlines for deep time |

See [`docs/DESIGN.md`](docs/DESIGN.md) for the architecture, the generator pipeline and the
save format.

---

## Notes on accuracy

* Dates more than 10,000 years back are shown as "years ago", and deep time as "million years
  ago". Continents drift with a simplified plate model, so they are recognisable but not
  survey-accurate.
* Peoples and cultures are portrayed respectfully, with era-appropriate clothing, architecture,
  crops and trade goods. Generated detail (names, buildings, routines) is plausible, not a record
  of real individuals.
* Everything after the present day is **imagined**, and the game says so in its facts and journal.
* The Moon is the real Moon (Apollo 11 site included), with low gravity.

## Credits

* **Geography**: [Natural Earth](https://www.naturalearthdata.com/) (public domain): land, lakes,
  rivers, relief, countries, regions and marine areas.
* **Engine**: [three.js](https://github.com/mrdoob/three.js) (MIT).
* **Tooling**: [Vite](https://vitejs.dev) (MIT), [TypeScript](https://www.typescriptlang.org) (Apache-2.0),
  [Vitest](https://vitest.dev) (MIT), [Playwright](https://playwright.dev) (Apache-2.0).
* **Art and audio**: all procedural, generated in code at runtime (low-poly models, Web Audio
  ambience, music and sound effects). There are no third-party asset files.
* **Historical facts**: written for this project from general reference knowledge.
