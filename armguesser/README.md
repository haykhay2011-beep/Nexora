# armguesser 🇦🇲

A GeoGuessr-style game set entirely in Armenia. Study a satellite view of a mystery
place, drop a pin on the map, and score up to 5,000 points per round over five rounds.

Plain HTML/CSS/JavaScript, no build step. Leaflet is loaded from cdnjs.

## Run it

Serve the folder over HTTP (opening `index.html` directly with `file://` also works, but
clipboard sharing needs `http(s)`):

```bash
cd armguesser
python3 -m http.server 8000   # then open http://localhost:8000
```

## Play online

The live game is at **https://haykhay2011-beep.github.io/Nexora/**.

`.github/workflows/armguesser-pages.yml` runs the tests and publishes this folder to the
`gh-pages` branch on every push that touches `armguesser/`. GitHub Pages serves that branch
(Settings → Pages → Source: *Deploy from a branch* → `gh-pages` / root).

The folder is plain static files, so any other static host (Netlify, Cloudflare Pages) works too.

## Gameplay

- **5 rounds**, max **25,000** points.
- Score per round: `5000 × (1 − distance_km / 400)`, clamped to 0–5000.
- **Modes:** Easy (famous landmarks, wide zoomable view, category hint), Medium,
  Hard, Expert (obscure villages, locked tight zoom), Mixed (everything), plus a
  **Daily Challenge**: the same five places for everyone on a given date, with a streak counter.
- After each guess: blue pin (you), green pin (answer), a dashed line with the distance, the
  Armenian name and transliteration, a fun fact and location details.
- Results screen: rank, accuracy, average distance, best/worst round, per-round table,
  emoji share card (🟩🟨🟧🟥), local leaderboard (top 10 per mode), and achievements.
- Optional 90-second round timer, light/dark theme, sound effects with a mute toggle,
  and a first-visit tutorial.

### Keyboard

| Key | Action |
| --- | --- |
| Arrow keys (map focused) | Pan the guess map |
| `G` | Drop a pin at the map centre |
| `Space` / `Enter` | Submit guess |
| `N` | Next round |

## Imagery

The view pane uses **Esri World Imagery** satellite tiles (free, no API key, no labels), so
players read terrain, rivers, lakes and road layouts rather than street signs. Difficulty
controls the starting zoom, the minimum zoom and how far players can pan. If tiles fail to
load, the game falls back to a text clue (category and region).

The guess map uses CARTO basemaps built on OpenStreetMap data (Voyager in light mode,
Dark Matter in dark mode).

To use street-level photos instead (Google Street View, Mapillary, or licensed photos),
replace `showLocationInView()` in `js/app.js`. Everything else reads coordinates from the
location database.

## Project layout

```
armguesser/
├── index.html          screens, dialogs, markup
├── css/styles.css      theme tokens (light/dark), layout, responsive rules
├── js/locations.js     100 locations across all 11 regions
├── js/core.js          pure logic: distance, scoring, selection, daily seed, stats, achievements
├── js/app.js           UI, Leaflet maps, game flow, storage, sound
└── tests/core.test.js  unit tests for core.js and the location data
```

## Location database

100 entries across all 11 regions (Yerevan plus the 10 provinces). Each entry has an id,
English name, Armenian script, transliteration, coordinates, region, category,
difficulty 1–4, a one-line fact and, for settlements, an approximate population. Current
difficulty split: 19 easy, 25 medium, 30 hard, 26 expert.

Coordinates were compiled without live lookup, so a few may be off by a few hundred metres.
Before a public launch, check each entry's view in Easy mode and adjust any that land
off-target.

To add a location, append an `L(...)` entry in `js/locations.js` and run the tests.

## Tests

```bash
node --test armguesser/tests/*.test.js
```

The tests cover data integrity (75+ entries, unique ids, all regions present, coordinates
inside Armenia), that every mode can fill a game, scoring and distance maths, daily-challenge
determinism, recent-location avoidance, stats, share text and achievements.

## Storage

Everything is stored in `localStorage` under `armg.*` keys: theme, mute, timer preference,
tutorial flag, leaderboard, achievements, stats, daily streak, and recently seen locations.
If storage is unavailable, the game still works; it just won't remember anything.
