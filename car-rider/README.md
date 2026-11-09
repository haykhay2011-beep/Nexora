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
| Brake | Hold `↓` or `B` (each extra tap brakes harder) | Hold the BRAKE button (bottom right) |
| Spin in the air | `←` / `→` or `A` / `D` while airborne | Hold left / right half while airborne |
| Pause / resume | `Esc` or `P` | Pause button (top right) |
| Start / restart | `Space` or `Enter` | Tap |
| Garage | Garage button, then `←` / `→` to browse | Tap a card |

**Car speed** (60%–150%) is a slider on the start and pause screens; it scales your speed and the traffic's, and is saved. The **Traffic** slider (Off to 40x, default 12x; 20x and up is rush hour) sets how busy the road is; traffic eases in over the first ~40 seconds of a run.

**No Hesi mode** (checkbox on the start and pause screens) strips the road down to traffic only, sets traffic to 15x and speed to 130%, and pays out **close calls**: squeeze past a car within about a metre without braking for bonus points and multiplier.

The speed readout (bottom left) switches between km/h and mph when clicked. The speaker button mutes all sound.

## How to play

- The car drives itself; you steer. The road bends constantly and the bends push you towards the outside, so keep
  correcting. Curves get tighter and more frequent the longer you survive, and speed slowly climbs.
- **Shoulder** (the tan strip): slows you down. **Guardrail**: scraping it is fine, hitting it head-on is a crash.
- **Traffic**: cars change lanes on their own, signalling across smoothly when there is room. Armenian road regulars (Lada Niva, boxy Lada sedans, Volga, old Mercedes, and white Gazelle marshrutka minibuses) cruise the lanes at their own speeds, so you weave through them. Hitting one ends the run, and traffic never lines up three abreast.
- **Obstacles**: cones, barrels and roadblocks end the run, and so does hitting a car. Potholes slow you and bounce the car. Oil slicks make
  steering slippery for a moment. Hopping clears cones and barrels. There is always a passable path.
- **Ramps** appear on straighter stretches. In the air, steer to spin. Every full rotation is a trick; landing roughly
  straight scores trick points and raises the **multiplier** (x2, x3 …). Landing sideways is a crash. The multiplier resets
  after 5 seconds without a new trick or pickup, so keep collecting.
- **Coins** give a small bonus, **nitro canisters** give a short speed boost with exhaust flames, and **mystery boxes**
  grant a random power-up: *shield* (absorbs one crash), *coin magnet*, or *grip mode* (oil is harmless). Active power-ups
  and their timers are shown in the HUD.
- Score = distance + coins + tricks, all multiplied by the current multiplier. Your best score is saved.

## Vehicles, coins and upgrades

Collect coins while you drive; each coin is worth 5 in your wallet, and every run also pays a score bonus. Spend them in the Garage:

- **Cars**: buy any of 12 vehicles, from the Lada Niva you start with to the Supercar.

| Vehicle | Price | Character |
| --- | --- | --- |
| Lada Niva | start | Balanced all-rounder |
| Lada 2107 | 400 | Classic Zhiguli, a bit slow |
| Pickup Truck | 600 | Slower, sturdy, ignores potholes |
| Volga GAZ-24 | 900 | Big, heavy, steady |
| Marshrutka | 1,200 | Huge Gazelle minibus, nearly unbreakable |
| Mercedes W124 | 1,500 | Stable and quick |
| Motorcycle | 1,800 | Very nimble, tiny hitbox, spins fastest in the air |
| Sports Car | 2,500 | Fast with razor steering, twitchy |
| Rally Hatch | 3,600 | Grippy, hardly notices oil |
| Muscle Car | 4,200 | All engine, a handful in bends |
| Monster Truck | 5,000 | Crushes cones and barrels, huge jumps |
| Supercar | 9,000 | Ridiculous pace and reflexes |

- **Upgrades** (per vehicle): Engine (top speed, acceleration), Exhaust (longer, stronger nitro and hotter flames), Tires (steering, grip, oil), Brakes (stopping power) and Extra life (each level lets you survive one more crash per run, up to 3).
- **Paint**: any colour for each vehicle.

Wallet, owned cars, upgrades, paint and settings are stored in `localStorage` (all access is wrapped in `try/catch`, so the game still works when storage is blocked).

## Destinations

Pick any of **195 countries** (193 UN members plus the Holy See and Palestine) from the Destination button. Each one has its own biome (temperate, Mediterranean, desert, savanna, tropical, alpine, boreal, arctic, steppe or island: sky, haze, ground and vegetation) and many have a landmark on the horizon: Mount Ararat for Armenia, a snow-capped volcano for Japan, pyramids for Egypt, alps for Switzerland, a skyline for the UAE, Uluru for Australia and so on. Your best score is tracked per destination.

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
    vehicleModels.js    the twelve vehicles: stats + low-poly models
    armenianCars.js     Niva, Lada, Volga, Mercedes and marshrutka models used by traffic
    upgrades.js         garage upgrades and how they change handling
    countries.js        195 destinations, biomes and landmarks
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
