# Atlantis: The Game

A 3D open-world underwater exploration game that runs in the browser. You are a lone diver who has found the sunken ruins of Atlantis. The city's power came from the Heartstone, a great crystal in the central palace. It shattered long ago and the city sank into darkness. Find the seven crystal shards, bring them home, and light Atlantis again.

Everything you see and hear is generated in code: the models are built from Three.js primitives in a stylized low-poly look, the textures are drawn on canvases, and all sound and music come from the Web Audio API. There are no external assets.

## Install, run, build

You need [Node.js](https://nodejs.org/) 20.19 or newer.

```bash
cd atlantis
npm install
npm run dev        # starts the dev server, open the printed URL (usually http://localhost:5173)
npm run build      # production build into atlantis/dist
npm run preview    # serve the production build locally
```

The build uses relative paths, so you can host the `dist` folder on any static web host.

Use a desktop browser with WebGL (Chrome, Edge, Firefox or Safari). Click the game to capture the mouse.

## Controls

| Key | Action |
| --- | --- |
| Mouse | Look around |
| W A S D | Swim |
| Space | Swim up |
| C or Ctrl | Swim down (C is safer, because Ctrl+W closes the tab in most browsers) |
| Shift | Swim fast (uses oxygen about twice as fast) |
| E | Interact: pick up, read, push, turn, activate |
| F | Flashlight on/off |
| Q | Sonar pulse (after you buy the upgrade) |
| M | Map |
| Tab | Inventory and journal |
| Esc | Pause (and close menus) |

If the browser refuses to capture the mouse right after you press Esc, click the game again.

## Spoiler-free guide

**The basics**
- Your oxygen drains all the time, and faster when you sprint. Refill it in bubble columns rising from the sea floor, in air pockets trapped under the roofs of some ruins, at the surface, or at your base. If it runs out you black out and wake at the base. You keep everything you've found.
- The base bell (where you start) is your home. Swimming under the dome refills your air and saves your game. The console there sells upgrades for pearls. The relics you find go on display around the dome.
- Pearls lie on the sea floor. Clams hold more, so open every clam you see.
- Journal pages and wall carvings tell the story, and they also hold the clues to every puzzle. If you're stuck, open your journal (Tab).

**Where to go**
- Start by reading the expedition log on the desk at the base. The first shard is close by. Follow the trail of pearls and the pale glow.
- Each zone is deeper than the last. A red line on the depth gauge marks your safe limit. Locked areas tell you which upgrade they need: crushing pressure means a Pressure Suit, scalding water means a Heat Suit, and darkness that swallows your light means a stronger flashlight.
- Every zone hides one shard. One shard is kept by friends who sing, so help anything you find trapped.
- The Central Palace is sealed until you hold all seven shards.

**Hazards**
- Jellyfish sting, so give them room. Electric eels hide in holes in walls. Strong currents push you around, and the hottest vents will scald you.
- Sharks patrol some areas. They chase you if you get close, but they lose interest. Sprint away, or head back to base.
- Nothing in the sea can be killed, and nothing needs to be.

**Tips**
- Turn on your flashlight (F) once the water gets dark.
- The map (M) fills in as you explore and marks the places you've discovered and the air vents you've seen.
- The sonar pulse (Q) briefly shows nearby pearls, items, air and hidden waystones.
- The first shard takes about 10 minutes to find. The whole game takes about 1 to 2 hours.

## Settings

The settings menu has mouse sensitivity, invert Y, master/music/effects volume and graphics quality (low/medium/high). Quality changes view distance, terrain chunk radius, particle counts, fish counts and render resolution. Settings and saves are stored in `localStorage`.

## Saving

The game autosaves when you return to the base, when you collect a shard, when you buy an upgrade, and when you close the page during play. You can also save from the pause menu. A save holds your position, upgrades, collected items, solved puzzles, journal and map progress. Use **Continue** on the title screen to resume. You can delete a save in Settings.

## Code layout

```
atlantis/
  index.html, vite.config.js
  src/
    main.js               entry point
    core/                 Game (loop, modes, events), Input (pointer lock), math (seeded RNG, simplex noise)
    world/                Terrain (seeded noise + chunk loading with LOD), Atmosphere (fog, light rays,
                          caustics, particles, bubbles), Materials, Batcher (static mesh merging by cell),
                          Colliders, Props (low-poly building blocks), Flora (instanced kelp/seagrass),
                          Hazards (currents, hot vents), Base, config (zones, landmarks, upgrades)
    world/zones/          one builder per zone: reef, kelp, city, temple, vents, abyss, palace
    player/               swimming physics, camera, flashlight, breathing bubbles
    systems/              Survival (oxygen, limits, damage), Interaction, Sonar, MapData, Ending
    items/                pearls, clams, pages, carvings, relics, shards + story content
    puzzles/              statue alignment, sliding stones on plates, glyph door, current maze,
                          light beams, the dolphin's net, the song door
    creatures/            fish schools, turtles, rays, dolphins, octopuses, sharks, jellyfish,
                          eels, anglerfish and the dolphin companion
    ui/                   HUD, title, pause, settings, map, inventory/journal, shop, reader, cutscene
    audio/                procedural ambience, breathing, per-zone music and sound effects
    save/                 localStorage save/load (every access wrapped in try/catch)
```

## Performance

The world is about 1.6 km across. To keep a steady frame rate:

- Terrain is built in 64 m chunks around the player with three levels of detail, and chunks are unloaded as you move away.
- Static scenery is merged into one mesh per 64 m cell and material, and cells beyond the fog are hidden.
- Kelp, seagrass, fish and pearls are instanced.
- Fog limits the view distance, and creatures far from the player stop updating.
- Only three local point lights exist. They move to the nearest light sources each frame, so shaders never recompile.

If the frame rate drops, set graphics quality to Low in Settings.
