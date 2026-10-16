import * as THREE from 'three';
import { Input } from './Input.js';
import { Colliders } from '../world/Colliders.js';
import { Atmosphere } from '../world/Atmosphere.js';
import { World } from '../world/World.js';
import { shared } from '../world/Materials.js';
import { zoneAt } from '../world/Terrain.js';
import { BASE_POS } from '../world/Base.js';
import { Player } from '../player/Player.js';
import { Items } from '../items/Items.js';
import { Interaction } from '../systems/Interaction.js';
import { Survival } from '../systems/Survival.js';
import { Sonar } from '../systems/Sonar.js';
import { MapData } from '../systems/MapData.js';
import { Ending } from '../systems/Ending.js';
import { Puzzles } from '../puzzles/Puzzles.js';
import { Creatures } from '../creatures/Creatures.js';
import { UI } from '../ui/UI.js';
import { AudioEngine } from '../audio/Audio.js';
import { freshState, readSave, writeSave, serialize, loadSettings, storeSettings } from '../save/Save.js';
import { SHARD_IDS, SHARD_NAMES, LANDMARKS } from '../world/config.js';

const PIXEL_RATIO = { low: 0.75, medium: 1, high: 1.5 };

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.settings = loadSettings();
    this.state = freshState();
    this.mode = 'loading';
    this.lastT = performance.now();
    this.time = 0;
    this.fpsSamples = [];

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: this.settings.quality !== 'low', powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(72, 1, 0.1, 220);
    this.scene.add(this.camera);
    this.applyPixelRatio();
    window.addEventListener('resize', () => this.resize());

    this.input = new Input(canvas);
    this.audio = new AudioEngine(this);
    this.ui = new UI(this);
    this.colliders = new Colliders();
    this.atmosphere = new Atmosphere(this.scene, this.camera, this.settings.quality);
    this.interact = new Interaction(this);
    this.puzzles = new Puzzles(this);
    this.items = new Items(this);
    this.creatures = new Creatures(this);
    this.world = new World(this);
    this.player = new Player(this);
    this.survival = new Survival(this);
    this.sonar = new Sonar(this);
    this.map = new MapData(this);
    this.ending = new Ending(this);
    this.resize();
  }

  async init(onProgress) {
    onProgress?.('Raising the ruins...');
    await nextFrame();
    this.world.build();
    onProgress?.('Waking the fish...');
    await nextFrame();
    this.items.finalize();
    this.creatures.finalize();
    this.player.teleport(BASE_POS.x, BASE_POS.y + 3, BASE_POS.z + 3, 0);
    this.world.terrain.prime(BASE_POS.x, BASE_POS.z);
    onProgress?.('Charting the sea floor...');
    await nextFrame();
    this.map.prepare();
    this.renderer.compile(this.scene, this.camera);

    this.input.onLockChange = (locked) => this.onLockChange(locked);
    this.input.onLockError = () => this.ui.showClickToResume(true);
    this.input.onKey = (code) => this.onKey(code);
    this.canvas.addEventListener('click', () => {
      if (this.mode === 'playing' && !this.input.locked) this.input.lock();
    });
    window.addEventListener('beforeunload', (e) => {
      if (this.mode === 'playing' || this.mode === 'paused' || this.mode === 'menu') {
        this.save(true);
        e.preventDefault();
        e.returnValue = '';
      }
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.mode === 'playing') this.pause();
    });

    this.mode = 'title';
    this.ui.showTitle();
    this.loop();
  }

  // ---------- Game flow ----------
  startNew() {
    this.state = freshState();
    this.beginPlay();
    this.player.teleport(BASE_POS.x, BASE_POS.y + 3, BASE_POS.z + 3, 0);
    this.ui.toast('Find the 7 crystal shards and bring Atlantis back to life.', 'info', 'Read the expedition log on the desk (E) to begin.');
    this.ui.showZoneBanner(zoneAt(this.player.pos.x, this.player.pos.z));
  }

  continueGame() {
    const s = readSave();
    if (!s) return this.startNew();
    this.state = s;
    this.beginPlay();
    if (s.pos) this.player.teleport(s.pos[0], s.pos[1], s.pos[2], s.yaw);
    else this.player.teleport(BASE_POS.x, BASE_POS.y + 3, BASE_POS.z + 3, 0);
    this.ui.toast('Welcome back, diver.', 'info');
    this.ui.showZoneBanner(zoneAt(this.player.pos.x, this.player.pos.z));
  }

  beginPlay() {
    this.audio.resume();
    this.items.applyState();
    this.puzzles.applyState();
    this.map.load(this.state.map);
    this.creatures.applyState();
    this.base.refreshDisplay();
    this.survival.reset(this.state.oxygen);
    this.player.applyFlashlight();
    this.ending.applyState();
    shared.uGlyphGlow.value = this.glyphGlowTarget();
    this.mode = 'playing';
    this.ui.hideTitle();
    this.ui.showHUD(true);
    this.input.lock();
    this.lastZone = null;
  }

  glyphGlowTarget() {
    return 0.5 + this.state.shards.size * 0.12 + (this.state.ended ? 1.2 : 0);
  }

  onLockChange(locked) {
    if (locked) {
      this.ui.showClickToResume(false);
      return;
    }
    if (this.mode === 'playing') this.pause();
  }

  pause() {
    if (this.mode !== 'playing') return;
    this.mode = 'paused';
    this.input.unlock();
    this.ui.showPause(true);
    this.audio.duck(true);
  }

  resume() {
    if (this.mode !== 'paused' && this.mode !== 'menu') return;
    this.mode = 'playing';
    this.ui.showPause(false);
    this.ui.closeAllMenus();
    this.audio.duck(false);
    this.input.lock();
  }

  // Overlay screens (map, inventory, shop, reader) pause the world.
  openMenu(name) {
    if (this.mode !== 'playing' && this.mode !== 'menu') return false;
    this.mode = 'menu';
    this.menuName = name;
    this.input.unlock();
    return true;
  }

  closeMenu() {
    if (this.mode !== 'menu') return;
    this.mode = 'playing';
    this.menuName = null;
    this.input.lock();
  }

  onKey(code) {
    if (this.mode === 'playing') {
      if (code === 'KeyF') {
        this.player.setFlashlight(!this.player.flashlightOn);
        this.audio.play('click');
      } else if (code === 'KeyM') this.ui.openMap();
      else if (code === 'Tab') this.ui.openInventory();
      else if (code === 'KeyQ') this.sonar.pulse();
    } else if (this.mode === 'menu') {
      if (code === 'Escape' || (code === 'KeyM' && this.menuName === 'map') || (code === 'Tab' && this.menuName === 'inventory')) {
        this.ui.closeAllMenus();
        this.closeMenu();
      }
    } else if (this.mode === 'paused') {
      // Esc while paused (after pointer unlock) resumes
      if (code === 'Escape') this.resume();
    }
  }

  applySettings(s) {
    const qualityChanged = s.quality !== this.settings.quality;
    this.settings = { ...this.settings, ...s };
    storeSettings(this.settings);
    this.audio.applyVolumes();
    if (qualityChanged) {
      this.atmosphere.setQuality(this.settings.quality);
      this.world.terrain.setQuality(this.settings.quality);
      this.creatures.setQuality(this.settings.quality);
      this.applyPixelRatio();
    }
  }

  applyPixelRatio() {
    const pr = Math.min(window.devicePixelRatio || 1, 2) * (PIXEL_RATIO[this.settings.quality] || 1);
    this.pixelRatio = Math.min(pr, 2);
    this.renderer.setPixelRatio(this.pixelRatio);
    if (this.atmosphere) this.atmosphere.setPixelRatio(this.pixelRatio * (window.innerHeight / 900));
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.applyPixelRatio();
  }

  // ---------- Events ----------
  onShardCollected(shardId) {
    const n = this.state.shards.size;
    this.audio.play('chime');
    this.atmosphere.flash = 1;
    this.ui.shardCelebration(shardId, n);
    this.ui.toast(`${SHARD_NAMES[shardId]} recovered!`, 'shard', n < SHARD_IDS.length ? `${n} of 7 shards. Atlantis stirs...` : 'All seven shards! Return them to the heart of the Central Palace.');
    this.save(false);
  }

  onReturnToBase() {
    if (this.mode !== 'playing') return;
    this.save(false);
    this.ui.toast('Back at base. Oxygen refilled, progress saved.', 'save');
  }

  save(silent = true) {
    if (this.mode === 'title' || this.mode === 'loading') return;
    this.state.oxygen = this.survival.oxygen;
    this.state.map = this.map.serialize();
    const ok = writeSave(serialize(this.state, this.player, this.state.map));
    if (!silent) this.ui.saveIndicator(ok);
  }

  blackout() {
    if (this.mode !== 'playing') return;
    this.mode = 'blackout';
    this.audio.play('blackout');
    this.ui.blackout(() => {
      this.player.teleport(BASE_POS.x, BASE_POS.y + 3, BASE_POS.z + 3, 0);
      this.survival.reset();
      this.creatures.onRespawn();
      this.mode = 'playing';
      this.save(true);
      this.ui.toast('You blacked out and drifted back to base.', 'warn', 'Everything you found is safe. Watch your oxygen!');
    });
  }

  // ---------- Loop ----------
  loop = () => {
    requestAnimationFrame(this.loop);
    const now = performance.now();
    let dt = (now - this.lastT) / 1000;
    this.lastT = now;
    if (dt > 0.1) dt = 0.1;
    this.time += dt;
    shared.uTime.value = this.time;
    this.frame(dt);
    this.input.endFrame();
  };

  frame(dt) {
    const p = this.player;
    if (this.mode === 'title') {
      // slow orbit around the base for the title background
      const a = this.time * 0.05;
      this.camera.position.set(BASE_POS.x + Math.cos(a) * 26, BASE_POS.y + 7, BASE_POS.z + Math.sin(a) * 26);
      this.camera.lookAt(BASE_POS.x, BASE_POS.y + 3, BASE_POS.z);
      this.world.update(dt, this.camera.position);
      this.creatures.update(dt, this.camera.position, false);
      this.atmosphere.update(dt, this.camera.position, false);
      this.items.update(dt, new THREE.Vector3(0, 9999, 0));
      this.base.spin(dt);
      this.map.prepareStep();
      this.renderer.render(this.scene, this.camera);
      return;
    }
    if (this.mode === 'cutscene') {
      this.ending.update(dt);
      this.world.update(dt, this.camera.position);
      this.creatures.update(dt, this.camera.position, false);
      this.atmosphere.update(dt, this.camera.position, false);
      this.puzzles.update(dt);
      this.items.update(dt, new THREE.Vector3(0, 9999, 0));
      this.renderer.render(this.scene, this.camera);
      return;
    }
    const simulate = this.mode === 'playing' || this.mode === 'blackout';
    if (simulate) {
      this.state.playTime += dt;
      if (this.mode === 'playing') {
        p.frozen = false;
        p.update(dt, this.input, this.settings);
      } else {
        p.frozen = true;
        p.update(dt, { down: () => false, consumeMouse: () => ({ x: 0, y: 0 }) }, this.settings);
      }
      this.base.update(dt);
      this.survival.update(dt);
      this.puzzles.update(dt);
      this.items.update(dt, p.pos);
      this.creatures.update(dt, p.pos, true);
      this.sonar.update(dt);
      this.map.update(p.pos);
      if (this.mode === 'playing') this.interact.update(this.input);
      this.checkZone();
      this.audio.update(dt);
    }
    this.base.spin(dt);
    const glow = this.glyphGlowTarget();
    shared.uGlyphGlow.value += (glow - shared.uGlyphGlow.value) * Math.min(1, dt * 0.8);
    this.world.update(dt, p.pos);
    const atm = this.atmosphere.update(dt, p.pos, p.flashlightOn);
    this.ui.updateHUD(dt, atm);
    this.renderer.render(this.scene, this.camera);
  }

  checkZone() {
    const z = zoneAt(this.player.pos.x, this.player.pos.z);
    if (z !== this.lastZone) {
      if (this.lastZone) this.ui.showZoneBanner(z);
      this.lastZone = z;
      this.audio.setZone(z.id);
      this.state.discovered.add(`zone:${z.id}`);
    }
    for (const lm of LANDMARKS) {
      if (this.state.discovered.has(lm.id)) continue;
      if (Math.hypot(this.player.pos.x - lm.x, this.player.pos.z - lm.z) < lm.r) {
        this.state.discovered.add(lm.id);
        if (lm.id !== 'base') this.ui.toast(`Discovered: ${lm.name}`, 'discover');
        this.audio.play('discover');
      }
    }
  }
}

function nextFrame() {
  return new Promise((r) => requestAnimationFrame(() => r()));
}
