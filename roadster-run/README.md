# Roadster Run

An endless 3D driving game for the browser. You drive a low, wide, two-seat electric
sports car with a glass roof down a winding procedural highway. Dodge traffic and road
works, skim past cars for close calls, keep the battery alive, and spend your coins in
the garage.

Built with **Three.js** (ES modules) and **Vite**. Every model is made from Three.js
primitives and every sound is synthesised with the Web Audio API. There are no image,
model or audio files, and no logos, badges or trademarked artwork.

## Install, run, build

Requires Node.js 18 or newer.

```bash
npm install
```

```bash
npm run dev
```

Opens a dev server at http://localhost:5173 (also reachable from a phone on the same
network, using the "Network" URL Vite prints).

```bash
npm run build
```

Production build into `dist/`. Serve it with any static file server, or preview it:

```bash
npm run preview
```

### Single-file build

```bash
npm run build:single
```

Writes `dist-single/index.html`, a single self-contained HTML file with all JavaScript
and CSS inlined. You can double-click it to play straight from disk or host it anywhere.
A pre-built copy is committed at `dist-single/index.html`.

## Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Steer | `←` `→` or `A` `D` | Hold the left or right half of the screen |
| Brake (regen) | `↓` or `B` (hold; tap again quickly to brake harder) | **BRAKE** button |
| Launch | Hold `Space` at the start line, release to go | Hold the screen, release to go |
| Hop | `Space` | Swipe up |
| Ludicrous boost | `Shift`, `W` or `↑` when the meter is full | **BOOST** button |
| Pause | `Esc` or `P` | ❚❚ button |
| Start / retry | `Enter` on the menu or game-over screen | Buttons |

## How it plays

- **Launch mode**: hold Space to charge the launch, then release. A full charge gives
  an instant-torque launch, and the 0–100 km/h time shows on screen.
- **Speed** climbs over the run. Curves tighten and traffic thickens the further you go.
- **Battery**: drains faster at high speed and during boost, and recovers while braking
  (regen). Drive over the green **chargers** for +45%. On a flat battery the car slows to
  a crawl, and the run ends if you can't recharge within 6 seconds.
- **Ludicrous boost**: a short burst of acceleration with a screen-edge blur and an FOV
  kick. Fill the meter with close calls and coins, or grab a red bolt pickup.
- **Power-ups**: Ludicrous (instant boost), Magnet (pulls in coins), Shield (absorbs one
  hit). The HUD shows their timers.
- **Hazards**: traffic that signals and changes lanes, cone lane closures (hitting a cone
  costs speed and your combo), and barrels and roadblocks (crash). Hop over low obstacles.
  Traffic never walls off all three lanes.
- **Crash**: the car spins out and smokes. An Extra life lets you continue; otherwise the
  run ends.
- **Score** = distance + coins + close calls, multiplied by the combo multiplier (up to
  x8). Each close call raises the multiplier. It drops back to x1 if the combo timer runs
  out, or if you scrape a guardrail or hit a cone. The best score is saved per destination.

### Garage
Spend coins on **Battery**, **Motor**, **Tyres**, **Brakes**, **Aero** and **Extra life**
upgrades, buy preset paint colours, or pick any colour with the colour picker.

### Destinations
Californian Coast (free), Nevada Desert, Alpine Pass, Tokyo Skyline and Icelandic Lava
Fields. Each has its own sky, fog, ground colours, vegetation and a landmark on the horizon.
Unlock them with coins.

Progress (coins, upgrades, paints, unlocked destinations, best scores, units and mute) is
saved in `localStorage`. Every read and write is wrapped in try/catch, so the game still
runs when storage is blocked; nothing is saved in that case.

## Project structure

```
src/
  main.js                 entry point
  style.css               UI and HUD styles
  game/Game.js            game loop, state machine, scoring, events
  game/config.js          all tuning values, upgrades and paints
  core/rng.js             seeded PRNG, value noise, math helpers
  core/pool.js            object pool (no allocation during play)
  core/geometry.js        merges primitives into vertex-coloured meshes
  world/roadPath.js       seeded Catmull-Rom spline, uniform arc-length ring buffer
  world/road.js           chunked road, terrain, guardrails, scenery (pooled chunks)
  world/environment.js    sky gradient, lights, fog, mountains, water, landmark
  world/props.js          low-poly scenery and landmark builders
  world/destinations.js   destination definitions
  vehicle/carModel.js     the roadster model
  vehicle/vehicle.js      car physics, battery, launch, boost, hop, crash
  traffic/models.js       traffic vehicles and obstacles
  traffic/traffic.js      traffic AI, lane changes, anti-blocking rules, collisions
  traffic/pickups.js      coins (instanced), chargers, power-ups
  fx/particles.js         pooled smoke/dust/spark particles and skid marks
  fx/cameraRig.js         chase camera, FOV kick, screen shake
  input/input.js          keyboard and touch input
  audio/audio.js          Web Audio synthesiser (motor whine, regen hum, effects)
  storage/storage.js      localStorage save data
  ui/ui.js, ui/garage.js  screens, HUD, garage and destination picker
```

## Performance notes

- Road chunks, traffic, obstacles, coins, pickups, particles and skid marks all come from
  fixed-size pools, so memory stays flat. A 46 km soak test held the JS heap at about 10 MB
  and GPU geometries at 100.
- Coins are a single `InstancedMesh`. Scenery uses one instanced mesh per prop type per
  chunk, and each road chunk rewrites preallocated buffers instead of creating new ones.
- No real-time shadows (cars use blob shadows), flat-shaded Lambert materials, and fog
  hides chunk loading.
- Resolution adapts: the pixel ratio drops when frames run slow and comes back when
  there is headroom. The simulation runs in fixed sub-steps, so collisions stay solid at
  high speed.
