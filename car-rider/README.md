# Car Rider

A 3D endless driving game for the browser, built with [Three.js](https://threejs.org) and [Vite](https://vitejs.dev).
Drive down a long, winding, squiggly road, dodge obstacles, hit ramps for spin tricks and collect coins and power-ups.

Everything is original: all models are built from Three.js primitives in a low-poly style and every sound is synthesised
with the Web Audio API. There are no external assets, images or audio files.

## Install

Requires Node.js 18+.

```bash
cd car-rider
npm install
```

## Run

```bash
npm run dev        # dev server with hot reload (http://localhost:5173)
npm run build      # production build into dist/
npm run preview    # serve the production build locally
```

Add `?seed=1234` to the URL to replay a specific road for the first run of a session (the seed is also shown on the
game-over screen). Without it each run gets a fresh random seed.

## Single-file version

`car-rider.html` is the whole game in one self-contained file. Open it directly in a browser, no server needed.
Regenerate it with `npm run build:single`.

## Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Steer | `←` / `→` or `A` / `D` | Hold (or tap) the left / right half of the screen |
| Hop (ground only) | `Space` | Swipe up |
| Spin in the air | `←` / `→` or `A` / `D` while airborne | Hold left / right half while airborne |
| Pause / resume | `Esc` or `P` | Pause button (top right) |
| Start / restart | `Space` or `Enter` | Tap |
| Garage | Garage button, then `←` / `→` to browse | Tap a card |

The speed readout (bottom left) switches between km/h and mph when clicked. The speaker button mutes all sound.

## How to play

- The car drives itself; you steer. The road bends constantly and the bends push you towards the outside, so keep
  correcting. Curves get tighter and more frequent the longer you survive, and speed slowly climbs.
- **Shoulder** (the tan strip): slows you down. **Guardrail**: scraping it is fine, hitting it head-on is a crash.
- **Obstacles**: cones, barrels, roadblocks and slow cars end the run. Potholes slow you and bounce the car. Oil slicks make
  steering slippery for a moment. Hopping clears cones and barrels. There is always a passable path.
- **Ramps** appear on straighter stretches. In the air, steer to spin. Every full rotation is a trick; landing roughly
  straight scores trick points and raises the **multiplier** (x2, x3 …). Landing sideways is a crash. The multiplier resets
  after 5 seconds without a new trick or pickup, so keep collecting.
- **Coins** give a small bonus, **nitro canisters** give a short speed boost with exhaust flames, and **mystery boxes**
  grant a random power-up: *shield* (absorbs one crash), *coin magnet*, or *grip mode* (oil is harmless). Active power-ups
  and their timers are shown in the HUD.
- Score = distance + coins + tricks, all multiplied by the current multiplier. Your best score is saved.

## Vehicles

Unlock vehicles by reaching a score in a single run, then pick one in the Garage.

| Vehicle | Unlock | Character |
| --- | --- | --- |
| Compact | start | Balanced all-rounder |
| Pickup Truck | 800 | Slower, sturdy, ignores potholes |
| Sports Car | 2,500 | Fastest and sharpest steering, but twitchy and easily upset by oil |
| Motorcycle | 5,000 | Very nimble, tiny hitbox, spins fastest in the air |
| Monster Truck | 9,000 | Crushes cones and barrels, huge jumps, slow turning |

Unlocks, the selected vehicle, best score, units and mute are stored in `localStorage` (all access is wrapped in
`try/catch`, so the game still works when storage is blocked).

## Project layout

```
car-rider/
  index.html            page + all DOM overlays (HUD, menus)
  src/
    main.js             entry point
    game.js             game loop, state machine, scoring, power-ups, camera
    config.js           tuning constants (physics, road, scoring, power-ups)
    road.js             procedural centerline (Catmull-Rom) + pooled road chunk meshes
    scenery.js          instanced trees, rocks, bushes, fences, houses
    environment.js      sky, fog, lights, ground, mountains, clouds
    vehicle.js          road-relative vehicle physics, crash/tumble, effects
    vehicleModels.js    the five vehicles: stats + low-poly models
    obstacles.js        obstacles, hazards, ramps + the layout director
    collectibles.js     coins, nitro, mystery boxes
    particles.js        pooled particles and skid marks
    input.js            keyboard + touch
    audio.js            Web Audio synthesis (engine, screech, jump, coin, nitro, crash…)
    ui.js               HUD, screens, garage
    storage.js          localStorage save data
    rng.js              seeded PRNG (mulberry32)
    models.js           helpers for building merged, vertex-coloured low-poly meshes
```

### Technical notes

- **Road**: a seeded bend generator emits control points (S-bends that tighten with distance); a Catmull-Rom spline is
  resampled at uniform arc length into a ring buffer. The player lives in road coordinates `(s, d)`: distance along the
  centerline and offset from it. Road chunks (asphalt, shoulders, markings, rails, embankments) come from a fixed pool of
  meshes whose vertex buffers are rewritten in place as the player advances, so memory stays flat however long you drive.
- **Scenery and props** use `InstancedMesh`es with a fixed instance range per road chunk; obstacles, collectibles and
  particles are pooled, so nothing is allocated during play.
- **Fairness**: obstacles are generated in rows with a guaranteed safe lane that moves at most one lane per row and rows
  are spaced by speed. Slow cars open a "convoy window" where solid rows are restricted so they can never seal the road.
- **Performance**: low-poly vertex-coloured geometry, a handful of draw calls, blob shadows, capped pixel ratio and an
  adaptive resolution scaler that lowers the render resolution if the frame rate drops.
