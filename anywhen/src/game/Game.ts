// Game orchestrator: state machine, time travel, the play loop, interactions and all UI wiring.
import * as THREE from 'three';
import { Renderer, QUALITY } from '../engine/Renderer';
import { Input } from '../engine/Input';
import { WorkerPool } from '../engine/WorkerPool';
import { World } from '../engine/World';
import { GLOBAL } from '../engine/materials';
import type { EarthData } from '../geo/earth';
import type { WorldPlan, NpcSpawn, Outfit } from '../gen/planTypes';
import { Player, type MountKind } from '../entities/Player';
import { audio } from '../audio/Audio';
import { HUD, type HudData } from '../ui/HUD';
import { TimeTravelScreen, type TravelTarget } from '../ui/TimeTravel';
import { Globe } from '../ui/Globe';
import { TitleScreen, DialogueBox, TradeScreen, InventoryScreen, JournalScreen, MapScreen, SettingsScreen, PauseMenu, PuzzleBox, Cards, type DialogueOption } from '../ui/screens';
import { newGame, type GameState, type SideQuest } from './state';
import { saveGame, loadGame, storeSettings, loadSettings } from '../save/save';
import { jumpCost, checkUnlocks, regen, nextUnlockHint } from './energy';
import { Story } from './Story';
import { makeQuest, questObjective, questPickups } from './Quests';
import * as Dlg from './dialogue';
import { Rng, hash32 } from '../core/rng';
import { formatYear, eraForYear } from '../core/timeScale';
import { ANIMAL_BY_ID, ANOMALY_BY_ID, ERA_BY_ID, ITEM_BY_ID, LANDMARK_BY_ID, REGION_BY_ID, RIFTS, era as getEra } from '../data';
import type { RiftDef } from '../data/types';
import { resolveProfile } from '../gen/profiles';
import { makeOutfit } from '../gen/people';
import type { ActiveAnomaly, Pickup } from './Anomalies';
import type { Npc } from '../entities/NPCs';
import { AREA_HALF } from '../gen/terrain';
import { distanceKm } from '../geo/places';

type Mode = 'title' | 'travel' | 'jumping' | 'play';

export class Game {
  readonly r: Renderer;
  readonly input: Input;
  readonly pool: WorkerPool;
  state: GameState = newGame();
  mode: Mode = 'title';
  world: World | null = null;
  player: Player | null = null;
  story: Story;
  private hud = new HUD();
  private travel: TimeTravelScreen;
  private title: TitleScreen;
  private titleGlobe: Globe;
  private dialogue = new DialogueBox();
  private trade = new TradeScreen();
  private inventory = new InventoryScreen();
  private journal = new JournalScreen();
  private map = new MapScreen();
  private settingsScreen = new SettingsScreen();
  private pause = new PauseMenu();
  private puzzle = new PuzzleBox();
  private cards = new Cards();
  private clock = new THREE.Clock();
  private hudTimer = 0;
  private saveTimer = 0;
  private pingTimer = 0;
  private talking: Npc | null = null;
  private storyNpcs = new Map<string, Npc>();
  private photoMode = false;
  private photoCam = { yaw: 0, pitch: 0, pos: new THREE.Vector3() };
  private visited = new Set<string>();
  private fx = { swirl: 0, fade: 0, swirlTarget: 0, fadeTarget: 0 };
  private lastPrompt: string | null = null;
  private interact: (() => void) | null = null;
  private returnable: string | null = null;
  private pulseT = 0;
  private settingsFromTitle = false;
  private queuedCards: (() => void)[] = [];

  constructor(canvas: HTMLCanvasElement, private earth: EarthData) {
    this.r = new Renderer(canvas);
    this.input = new Input(canvas);
    this.pool = new WorkerPool();
    this.state.settings = loadSettings();
    this.applySettings();
    this.story = this.makeStory();
    this.travel = new TimeTravelScreen(earth);
    this.titleGlobe = new Globe(earth);
    this.titleGlobe.autoSpin = 6;
    this.titleGlobe.targetDist = 2.9;
    this.titleGlobe.setYear(2000, true);
    this.title = new TitleScreen(this.titleGlobe.canvas);
    this.wireUI();
    canvas.addEventListener('click', () => { audio.start(); if (this.mode === 'play' && !this.anyModal()) this.input.lock(); });
    this.input.onUnlock = () => { if (this.mode === 'play' && !this.anyModal() && !this.photoMode) this.openPause(); };
    window.addEventListener('keydown', (e) => this.onKey(e));
  }

  private makeStory() {
    return new Story(this.state, {
      toast: (t) => this.hud.toast(t, 'good'),
      riftComplete: (r) => this.onRiftComplete(r),
      stepChanged: () => this.refreshStoryWorld(),
      unlock: (u) => {
        const label = u === 'moon' ? 'The Moon' : u === 'ending' ? '' : ERA_BY_ID.get(u as never)?.name;
        if (label) this.hud.toast(`🔓 Unlocked: ${label}`, 'good', 6000);
      },
    });
  }

  async init() {
    await this.pool.init(new URL('data/earth.dat', document.baseURI).href);
    const has = !!(await loadGame());
    this.showTitle(has);
    this.loop();
  }

  // ------------------------------------------------------------------ settings
  private applySettings() {
    const s = this.state.settings;
    this.input.sensitivity = s.sensitivity;
    this.input.invertY = s.invertY;
    audio.vol = { master: s.master, music: s.music, sfx: s.sfx, ambient: s.ambient };
    audio.applyVolumes();
    this.r.setQuality(QUALITY[s.quality] ?? QUALITY.medium);
    this.r.camera.fov = s.fov;
    this.r.camera.updateProjectionMatrix();
    this.hud.subtitles = s.subtitles;
    if (this.world) { this.world.chunks.viewDistance = s.viewDistance; }
    storeSettings(s);
  }

  // ------------------------------------------------------------------ UI wiring
  private wireUI() {
    this.title.onNew = () => { audio.start(); this.startNew(); };
    this.title.onContinue = () => { audio.start(); this.continueGame(); };
    this.title.onSettings = () => { this.settingsFromTitle = true; this.settingsScreen.show(this.state.settings); };
    this.settingsScreen.onChange = () => this.applySettings();
    this.settingsScreen.onClose = () => { this.settingsScreen.hide(); if (!this.settingsFromTitle && this.mode === 'play') this.pause.show(true); this.settingsFromTitle = false; };
    this.travel.onClose = () => { if (this.world) { this.travel.close(); this.mode = 'play'; this.hud.show(true); } };
    this.travel.onTravel = (t) => this.jumpTo(t);
    this.pause.onResume = () => this.closePause();
    this.pause.onSettings = () => { this.pause.show(false); this.settingsScreen.show(this.state.settings); };
    this.pause.onSave = async () => { this.syncPlayerState(); const ok = await saveGame(this.state); this.hud.toast(ok ? 'Game saved.' : 'Could not save (storage unavailable).', ok ? 'good' : 'warn'); };
    this.pause.onQuit = async () => { this.syncPlayerState(); await saveGame(this.state); this.pause.show(false); this.quitToTitle(); };
    this.pause.onTravel = () => { this.pause.show(false); this.openTravel(); };
    for (const s of [this.trade, this.inventory, this.journal, this.map]) s.onClose = () => { s.hide(); this.resumePlay(); };
    this.trade.onBuy = (item, price) => { if (this.state.money >= price) { this.state.money -= price; this.addItem(item, 1); audio.pickup(); } };
    this.trade.onSell = (item, price) => { if (this.removeItem(item, 1)) { this.state.money += price; audio.click(); } };
    this.inventory.onReturn = (id) => { this.returnAnomaly(id); this.inventory.hide(); this.resumePlay(); };
    audio.onCaption = (t) => this.hud.caption(t);
  }

  private anyModal(): boolean {
    return this.dialogue.open || this.trade.open || this.inventory.open || this.journal.open || this.map.open || this.settingsScreen.open || this.pause.open || this.puzzle.open || this.cards.storyOpen || this.travel.isOpen;
  }

  private onKey(e: KeyboardEvent) {
    const t = e.target as HTMLElement;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT')) return;
    if (this.mode === 'travel' && e.code === 'Escape' && this.world) { this.travel.onClose?.(); return; }
    if (this.mode !== 'play') return;
    if (e.code === 'Escape') {
      if (this.photoMode) { this.exitPhoto(); return; }
      if (this.dialogue.open) { this.endTalk(); return; }
      for (const s of [this.trade, this.inventory, this.journal, this.map]) if (s.open) { s.hide(); this.resumePlay(); return; }
      if (this.settingsScreen.open) { this.settingsScreen.onClose?.(); return; }
      if (this.pause.open) { this.closePause(); return; }
      if (!this.anyModal()) this.openPause();
      return;
    }
    if (this.dialogue.open && /^Digit[1-9]$/.test(e.code)) { this.dialogue.pressNumber(Number(e.code.slice(5))); return; }
    const toggle = (s: { open: boolean; hide: () => void }, openFn: () => void) => {
      if (s.open) { s.hide(); this.resumePlay(); }
      else if (!this.anyModal()) { this.input.unlock(); openFn(); audio.open(); }
    };
    switch (e.code) {
      case 'KeyJ': toggle(this.journal, () => this.journal.show(this.state)); break;
      case 'Tab': e.preventDefault(); toggle(this.inventory, () => this.openInventory()); break;
      case 'KeyM': toggle(this.map, () => this.openMap()); break;
      case 'KeyT': if (!this.anyModal() && !this.photoMode) this.openTravel(); break;
      case 'KeyP': if (this.photoMode) this.exitPhoto(); else if (!this.anyModal()) this.enterPhoto(); break;
    }
  }

  // ------------------------------------------------------------------ flow
  private showTitle(canContinue: boolean) {
    this.mode = 'title';
    this.hud.show(false);
    this.title.show(true, canContinue);
    this.titleGlobe.start();
  }

  private async startNew() {
    this.state = newGame();
    this.state.settings = loadSettings();
    this.story = this.makeStory();
    this.title.show(false);
    this.titleGlobe.stop();
    this.cards.story('The Chronometer awakens', 'Anywhen', [
      'You are a young Time Walker. On your wrist ticks the Chronometer, a device that can carry you to any place on Earth in any year.',
      'But something has shattered the timeline. Anomalies, objects and creatures from the wrong time, are appearing all through history.',
      'Find them, send them home, and repair the twelve Major Rifts. Your first stop: Giza, around 2560 BCE, where the Great Pyramid is nearly finished.',
    ], 'Controls: WASD move · mouse look · Shift run · Space jump/climb · E interact · T time travel · J journal · M map · Tab inventory · P camera · Esc pause', 'Begin', () => {
      this.state.story.intro = true;
      this.jumpTo({ lat: this.state.player.lat, lon: this.state.player.lon, year: this.state.player.year, moon: false, name: 'Giza' }, true);
    });
  }

  private async continueGame() {
    const s = await loadGame();
    if (!s) { this.startNew(); return; }
    this.state = s;
    this.applySettings();
    this.story = this.makeStory();
    this.title.show(false);
    this.titleGlobe.stop();
    this.jumpTo({ lat: s.player.lat, lon: s.player.lon, year: s.player.year, moon: s.player.moon, name: '' }, true, true);
  }

  private quitToTitle() {
    this.input.unlock();
    this.destroyWorld();
    this.hud.show(false);
    audio.stopAmbience();
    audio.stopMusic();
    this.showTitle(true);
  }

  private openTravel() {
    if (!this.world) return;
    this.input.unlock();
    this.mode = 'travel';
    this.hud.show(false);
    const p = this.world.plan;
    this.travel.open(this.state, { lat: p.lat, lon: p.lon, year: p.year, moon: p.moon }, this.story.destinationHint());
    audio.open();
  }

  private openPause() { this.input.unlock(); this.pause.show(true); }
  private closePause() { this.pause.show(false); this.resumePlay(); }
  private resumePlay() { if (this.mode === 'play' && !this.anyModal()) this.input.lock(); }

  // ------------------------------------------------------------------ time travel
  private jumping = false;
  async jumpTo(t: TravelTarget, free = false, restorePos = false) {
    if (this.jumping) return;
    const from = this.world ? { lat: this.world.plan.lat, lon: this.world.plan.lon, year: this.world.plan.year, moon: this.world.plan.moon } : { lat: t.lat, lon: t.lon, year: t.year, moon: t.moon };
    const cost = free ? 0 : jumpCost(from, t);
    if (!free && cost > this.state.energy) { this.hud.toast('Not enough chrono energy.', 'warn'); return; }
    this.jumping = true;
    this.state.energy -= cost;
    this.input.unlock();
    this.mode = 'jumping';
    this.travel.close();
    this.hud.show(false);
    this.endTalk();
    audio.start();
    audio.timeTravel();
    // swirl the old world away
    this.fx.swirlTarget = 1;
    this.r.uniforms.uFadeColor.value.set('#e8f6ff');
    this.fx.fadeTarget = 1;
    this.cards.showLoading(true, 'Folding time…');
    const t0 = performance.now();
    const fromYear = from.year, toYear = t.year;
    const spin = () => {
      if (this.mode !== 'jumping') return;
      const k = Math.min(1, (performance.now() - t0) / 2600);
      const e = 1 - Math.pow(1 - k, 3);
      const yy = Math.abs(fromYear - toYear) > 20000 ? -Math.exp(Math.log(2000 - fromYear) + (Math.log(2000 - toYear) - Math.log(2000 - fromYear)) * e) + 2000 : fromYear + (toYear - fromYear) * e;
      this.cards.setLoadingYear(t.moon ? '☾' : formatYear(Math.round(yy)));
      requestAnimationFrame(spin);
    };
    spin();
    try {
      const plan = await this.pool.plan({ lat: t.lat, lon: t.lon, year: t.year, moon: t.moon });
      await new Promise((r) => setTimeout(r, 500));
      this.destroyWorld();
      this.cards.setLoadingMsg('Weaving the world…');
      await this.buildWorld(plan, restorePos);
      const minT = 2700 - (performance.now() - t0);
      if (minT > 0) await new Promise((r) => setTimeout(r, minT));
      this.cards.showLoading(false);
      this.fx.swirlTarget = 0;
      this.fx.fadeTarget = 0;
      this.mode = 'play';
      this.hud.show(true);
      this.onArrive(plan);
      this.input.lock();
    } catch (err) {
      console.error(err);
      this.cards.setLoadingMsg('The jump failed. Try another place or time.');
      setTimeout(() => { this.cards.showLoading(false); this.fx.swirlTarget = 0; this.fx.fadeTarget = 0; if (this.world) { this.mode = 'play'; this.hud.show(true); } else this.showTitle(true); }, 2000);
    } finally {
      this.jumping = false;
    }
  }

  private destroyWorld() {
    this.storyNpcs.clear();
    this.talking = null;
    this.player?.destroy();
    this.player = null;
    this.world?.destroy();
    this.world = null;
  }

  private async buildWorld(plan: WorldPlan, restorePos: boolean) {
    const q = QUALITY[this.state.settings.quality] ?? QUALITY.medium;
    const w = new World(this.r.scene, this.pool, plan, q, this.state.settings.viewDistance);
    this.world = w;
    await this.pool.setPlan(plan);
    await w.loadStructures();
    const sp = plan.spawn;
    let x = sp.x, z = sp.z, heading = sp.facing;
    if (restorePos && Number.isFinite(this.state.player.x) && Math.abs(this.state.player.x) < AREA_HALF) { x = this.state.player.x; z = this.state.player.z; heading = this.state.player.heading; }
    const outfit = this.playerOutfit(plan);
    this.player = new Player(this.r.scene, this.r.camera, outfit);
    this.player.moon = plan.moon;
    this.player.gravity = plan.moon ? 22 / 5.5 : 22;
    this.player.waterLevel = w.waterLevel;
    this.player.onBoundary = () => { this.hud.toast("The Chronometer's field ends here. Press T to travel further.", 'warn'); this.hud.boundaryGlow(); };
    this.player.onSplash = () => audio.splash();
    this.player.onStep = (s) => audio.step(s);
    this.player.onLand = () => audio.thud();
    const g = w.phys.groundAt(x, z);
    this.player.place(x, g.y + 0.05, z, heading);
    w.chunks.update(x, z);
    // wait for the ground around the player
    const t0 = performance.now();
    while (!w.chunks.readyAround(x, z, 200) && performance.now() - t0 < 9000) {
      w.chunks.update(x, z);
      await new Promise((r) => setTimeout(r, 60));
    }
    this.player.update(0.016, this.input, w.phys);
    this.spawnStoryAndQuests();
    // animals/anomalies hooks
    w.animals.onKnock = (a) => { this.player?.knockDown(a.pos.x, a.pos.z); audio.thud(); this.hud.toast(`The ${a.def.name} knocked you over! Run, hide, or jump into water to escape.`, 'warn'); };
    w.animals.onRoar = (a) => { audio.animalCall(a.def.sound); this.hud.toast(`⚠ A ${a.def.name} is chasing you!`, 'warn'); };
    w.animals.onSeen = (a) => this.discoverAnimal(a.def.id);
    w.anomalies.onDetected = () => { this.hud.toast('You were spotted! The anomaly blinked away. Crouch (C) and stay out of sight.', 'warn'); audio.blink(); };
    w.anomalies.onNotice = (a) => this.hud.toast(`The Chronometer senses ${a.def.name.toLowerCase()} nearby — ${challengeText(a.spawn.challenge)}`);
  }

  private playerOutfit(plan: WorldPlan): Outfit {
    const region = REGION_BY_ID.get(plan.regionId) ?? REGION_BY_ID.get('europe')!;
    const zone = region.subzones?.find((z) => z.name === plan.subzone) ?? null;
    const prof = resolveProfile(plan.eraId, region, zone, plan.biome);
    if (plan.moon) prof.clothing = { styles: ['future'], colors: ['#f2f2f8'], accents: ['#36e0ff'], headwear: ['visor'] };
    const rng = new Rng(hash32('timewalker', plan.eraId, plan.regionId));
    const o = makeOutfit(rng, prof, region, 'adult');
    o.colors[0] = '#c99568';
    o.colors[2] = '#2ab8c8';
    o.colors[3] = '#3b2a20';
    o.hair = 0;
    o.scale = 1;
    if (o.body === 'robe') o.body = 'tunic';
    return o;
  }

  // ------------------------------------------------------------------ arrival
  private onArrive(plan: WorldPlan) {
    const e = getEra(plan.eraId);
    this.state.player = { lat: plan.lat, lon: plan.lon, year: plan.year, moon: plan.moon, x: NaN, z: NaN, heading: 0 };
    if (!this.state.visited.includes(plan.key)) this.state.visited.push(plan.key);
    this.state.journal.places[plan.key] = { name: plan.place.name, fact: plan.arrivalFact, at: Date.now(), extra: `${formatYear(plan.year)} · ${e.name} · ${plan.biomeName}` };
    this.cards.arrival(e.name, plan.place.name, formatYear(plan.year), plan.arrivalFact);
    document.documentElement.style.setProperty('--era', plan.palette.sun === '#ffffff' ? '#c8d8ff' : plan.palette.skyHorizon);
    // audio
    const amb = [...e.ambience];
    if (plan.settlement && ['city', 'metropolis', 'town'].includes(plan.settlement.tier)) amb.push(e.tech >= 8 ? 'traffic' : 'crowd');
    if (['rainforest', 'tropical_dry'].includes(plan.biome)) amb.push('jungle');
    audio.setAmbience(plan.moon ? [] : amb, { water: plan.hasCoast, wind: plan.biome === 'desert' || plan.biome === 'tundra' || plan.biome === 'ice' ? 0.8 : 0.3, night: false });
    audio.setMusic(e.music, plan.seed);
    // story
    this.story.notify({ type: 'arrive', plan });
    this.story.notify({ type: 'inventory' });
    // the very first arrival explains the basics
    if (this.state.visited.length === 1) setTimeout(() => this.hud.toast('Tip: follow the gold arrow on the radar (top right) to the nearest anomaly.', '', 7000), 8000);
    this.saveSoon();
  }

  private spawnStoryAndQuests() {
    const w = this.world!;
    const plan = w.plan;
    const rng = new Rng(hash32(plan.key, 'story', this.state.story.rift, this.state.story.step));
    // world anomalies not yet captured
    for (const a of plan.anomalies) if (!this.state.captured.includes(a.instanceId)) w.anomalies.add(a);
    this.refreshStoryWorld(rng);
    // side quest pickups in this world
    for (const q of this.state.sideQuests) if (q.worldKey === plan.key && !q.done) this.spawnQuestPickups(q);
  }

  /** (Re)spawn story NPCs, pickups and anomalies for the current step. */
  private refreshStoryWorld(rng = new Rng(Date.now() & 0xffff)) {
    const w = this.world;
    if (!w || !w.structuresReady) return;
    const plan = w.plan;
    const sp = plan.spawn;
    for (const n of this.story.npcsHere(plan)) {
      if (this.storyNpcs.has(n.id)) continue;
      const pos = this.findSpot(sp.x + Math.sin(sp.facing) * 14, sp.z + Math.cos(sp.facing) * 14, 6, rng);
      const spawn: NpcSpawn = {
        id: 'story-' + n.id, name: n.name, job: 'story', jobName: n.role, work: 'idle', fact: '', x: pos[0], z: pos[1], home: pos, workAt: pos, social: pos,
        outfit: n.outfit === 'hologram'
          ? { body: 'future', hat: 'none', colors: ['#a0e8ff', '#c8f0ff', '#7af0ff', '#e8f8ff', '#a0e8ff'], hair: 2, scale: 1, glow: true }
          : makeOutfit(new Rng(hash32(n.id)), resolveProfile(plan.eraId, REGION_BY_ID.get(plan.regionId)!, REGION_BY_ID.get(plan.regionId)!.subzones?.find((z) => z.name === plan.subzone) ?? null, plan.biome), REGION_BY_ID.get(plan.regionId)!, 'adult'),
        trader: false, questGiver: false, age: 'adult', seed: hash32(n.id), sleepsOutside: true,
      };
      const npc = w.npcs.add(spawn, { story: true, storyId: n.id });
      this.storyNpcs.set(n.id, npc);
    }
    for (const p of this.story.pickupsHere(plan)) {
      if (w.pickups.list.some((x) => x.id === p.id)) continue;
      const r2 = new Rng(hash32(p.id));
      const ang = r2.range(0, Math.PI * 2), d = r2.range(45, 230);
      const pos = this.findSpot(sp.x + Math.cos(ang) * d, sp.z + Math.sin(ang) * d, 30, r2);
      w.pickups.add(p.id, p.item, pos[0], pos[1], 'story');
    }
    const an = this.story.anomalyHere(plan);
    if (an && !w.anomalies.list.some((a) => a.spawn.instanceId === an.instanceId)) {
      const def = ANOMALY_BY_ID.get(an.anomalyId)!;
      const r2 = new Rng(hash32(an.instanceId));
      const ang = r2.range(0, Math.PI * 2), d = r2.range(50, 120);
      const pos = this.findSpot(sp.x + Math.cos(ang) * d, sp.z + Math.sin(ang) * d, 20, r2);
      const wa = r2.range(0, 6.28);
      w.anomalies.add({ instanceId: an.instanceId, anomalyId: an.anomalyId, x: pos[0], z: pos[1], challenge: def.challenge, seed: r2.int(0, 1e9),
        watcher: def.challenge === 'sneak' ? { x: pos[0] + Math.cos(wa) * 9, z: pos[1] + Math.sin(wa) * 9, kind: plan.humans ? 'npc' : 'animal', species: plan.animals.find((a) => !a.domestic)?.species } : undefined }, true);
    }
  }

  private findSpot(x: number, z: number, jitter: number, rng: Rng): [number, number] {
    const w = this.world!;
    for (let i = 0; i < 40; i++) {
      const tx = Math.max(-AREA_HALF + 150, Math.min(AREA_HALF - 150, x + rng.range(-jitter, jitter) * (1 + i * 0.3)));
      const tz = Math.max(-AREA_HALF + 150, Math.min(AREA_HALF - 150, z + rng.range(-jitter, jitter) * (1 + i * 0.3)));
      const g = w.phys.groundAt(tx, tz);
      if (g.y > w.waterLevel(tx, tz) + 0.4 && !w.phys.blocked(tx, tz, g.y, 0.8) && w.ts.slope(tx, tz, 1.5) > 0.8) return [tx, tz];
    }
    return [w.plan.spawn.x + 3, w.plan.spawn.z + 3];
  }

  // ------------------------------------------------------------------ main loop
  private loop = () => {
    requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, this.clock.getDelta());
    GLOBAL.uTime.value += dt;
    this.r.uniforms.uTime.value = GLOBAL.uTime.value;
    // post fx easing
    this.fx.swirl += (this.fx.swirlTarget - this.fx.swirl) * Math.min(1, dt * (this.fx.swirlTarget > this.fx.swirl ? 2.2 : 3));
    this.fx.fade += (this.fx.fadeTarget - this.fx.fade) * Math.min(1, dt * (this.fx.fadeTarget > this.fx.fade ? 1.6 : 2.4));
    this.r.uniforms.uSwirl.value = this.fx.swirl;
    this.r.uniforms.uFade.value = this.fx.fade;
    this.r.uniforms.uFlash.value = Math.max(0, this.r.uniforms.uFlash.value - dt * 3);
    if (this.mode === 'title' || !this.world || !this.player) {
      if (this.world && this.player) this.r.render();
      this.input.endFrame();
      return;
    }
    if (this.mode === 'play' || this.mode === 'jumping' || this.mode === 'travel') this.tick(dt);
    this.r.render();
    this.input.endFrame();
  };

  private tick(dt: number) {
    const w = this.world!, p = this.player!, s = this.state;
    const playing = this.mode === 'play' && !this.anyModal();
    s.playTime += dt;
    s.hour = (s.hour + (dt / (s.settings.dayLength * 60)) * 24) % 24;
    if (this.mode === 'play') regen(s, dt);
    this.input.enabled = playing && !this.photoMode;
    p.frozen = !playing || this.photoMode;
    p.photoMode = this.photoMode;
    p.update(dt, this.input, w.phys);
    if (this.photoMode) this.updatePhotoCam(dt);
    w.update(dt, p.pos);
    GLOBAL.uPlayer.value.copy(p.pos);
    const dark = w.weather.dark;
    const skyCol = w.sky.update(dt, w.plan.lat, w.plan.climate.dayOfYear, s.hour, this.r.camera, p.pos, dark);
    const sheltered = w.phys.ceilingAt(p.pos.x, p.pos.z, p.pos.y + 1) < Infinity;
    w.weather.update(dt, this.r.camera.position, sheltered);
    // fog follows sky + weather
    const fogFar = (w.plan.moon ? 6000 : this.state.settings.viewDistance * 1.25) * (1 - w.weather.fog * 0.75);
    w.setFog(skyCol.horizon, Math.max(20, fogFar * 0.12), Math.max(120, fogFar));
    this.r.gl.setClearColor(skyCol.horizon);
    // colour grading per era
    const pal = w.plan.palette;
    this.r.uniforms.uTint.value.set(pal.tint).lerp(new THREE.Color('#9ab0d0'), w.sky.state.night * 0.25);
    this.r.uniforms.uSat.value = pal.saturation * (1 - dark * 0.25);
    this.r.uniforms.uContrast.value = pal.contrast;
    this.r.uniforms.uVignette.value = this.photoMode ? 0.15 : 0.38;
    if (w.weather.lightning > 0.9) { this.r.uniforms.uFlash.value = 0.5; setTimeout(() => audio.roar(0.5), 600); }
    // simulation
    const crouch = p.crouching;
    const hidden = p.swimming || (p.pos.y - w.ts.height(p.pos.x, p.pos.z) > 2.6) || sheltered || (crouch && w.plan.floraDensity > 0.6);
    w.npcs.update(dt, s.hour, p.pos, this.talking);
    w.animals.update(dt, p.pos, hidden, crouch, p.mount !== 'none' && p.mount !== 'glider', w.sky.state.night);
    const reachable = w.anomalies.update(dt, p.pos, crouch, p.running);
    const pickup = w.pickups.update(p.pos);
    if (playing) this.handleInteractions(reachable, pickup);
    this.checkVisits();
    // radar ping
    const near = w.anomalies.nearest(p.pos);
    this.pingTimer -= dt;
    if (near && this.mode === 'play') {
      const d = near.pos.distanceTo(p.pos);
      const interval = Math.max(0.35, Math.min(3.5, d / 90));
      if (this.pingTimer <= 0) { if (d < 400) audio.ping(1 - Math.min(1, d / 400)); this.pingTimer = interval; }
    }
    this.pulseT = Math.max(0, this.pulseT - dt);
    this.hudTimer -= dt;
    if (this.hudTimer <= 0) { this.hudTimer = 0.1; this.updateHud(near); }
    this.saveTimer += dt;
    if (this.saveTimer > 75 && this.mode === 'play') { this.saveTimer = 0; this.syncPlayerState(); saveGame(this.state); }
  }

  // ------------------------------------------------------------------ interactions
  private handleInteractions(reachable: ActiveAnomaly | null, pickup: Pickup | null) {
    const w = this.world!, p = this.player!;
    let prompt: string | null = null;
    let action: (() => void) | null = null;
    const npc = w.npcs.nearest(p.pos, 3.2);
    if (pickup) {
      const it = ITEM_BY_ID.get(pickup.item);
      prompt = `<kbd>E</kbd> Pick up ${it?.icon ?? ''} ${it?.name ?? pickup.item}`;
      action = () => this.collect(pickup);
    } else if (reachable) {
      const verb = reachable.spawn.challenge === 'puzzle' ? 'Unlock the time bubble around' : 'Capture';
      prompt = `<kbd>E</kbd> ${verb} the ${reachable.def.name}`;
      action = () => (reachable.spawn.challenge === 'puzzle' ? this.startAnomalyPuzzle(reachable) : this.capture(reachable));
    } else if (npc && !npc.watcher) {
      prompt = `<kbd>E</kbd> Talk to ${npc.spawn.name} (${npc.spawn.jobName})`;
      action = () => this.talk(npc);
    }
    // returning anomalies in their home era
    this.returnable = null;
    for (const v of this.state.vault) if (!this.canReturn(v.anomalyId)) { this.returnable = v.instanceId; break; }
    if (!prompt && this.returnable) {
      const v = this.state.vault.find((x) => x.instanceId === this.returnable)!;
      prompt = `<kbd>R</kbd> Return the ${ANOMALY_BY_ID.get(v.anomalyId)!.name} to its home time`;
    }
    this.lastPrompt = prompt;
    this.interact = action;
    if (this.input.consume('KeyE') && action) action();
    if (this.input.consume('KeyR') && this.returnable) this.returnAnomaly(this.returnable);
    if (this.input.consume('KeyF')) this.toggleMount();
    if (this.input.consume('KeyG')) this.toggleMount('glider');
    if (this.input.consume('KeyQ')) this.pulse();
  }

  private pulse() {
    const w = this.world!, p = this.player!;
    if (this.pulseT > 0) return;
    this.pulseT = 4;
    audio.ping(1);
    this.r.uniforms.uFlash.value = 0.12;
    const a = w.anomalies.nearest(p.pos);
    const parts: string[] = [];
    if (a) {
      const dx = a.pos.x - p.pos.x, dz = a.pos.z - p.pos.z;
      parts.push(`${a.def.name}: ${Math.round(Math.hypot(dx, dz))} m to the ${Dlg.compassDir(dx, dz)}`);
    }
    const pk = w.pickups.list.slice().sort((x, y) => x.pos.distanceTo(p.pos) - y.pos.distanceTo(p.pos))[0];
    if (pk) { const dx = pk.pos.x - p.pos.x, dz = pk.pos.z - p.pos.z; parts.push(`${ITEM_BY_ID.get(pk.item)?.name}: ${Math.round(Math.hypot(dx, dz))} m ${Dlg.compassDir(dx, dz)}`); }
    this.hud.toast(parts.length ? '⟲ Pulse — ' + parts.join(' · ') : '⟲ Pulse — no anomalies in this place and time.', '', 6000);
  }

  private toggleMount(force?: MountKind) {
    const p = this.player!, w = this.world!, s = this.state;
    if (p.mount !== 'none') { p.dismount(); return; }
    const wl = w.waterLevel(p.pos.x, p.pos.z);
    const inWater = p.swimming || w.ts.height(p.pos.x + Math.sin(p.heading) * 3, p.pos.z + Math.cos(p.heading) * 3) < wl - 0.8;
    if (force === 'glider' || (w.plan.moon && s.unlocks.mounts.includes('glider'))) {
      if (s.unlocks.mounts.includes('glider')) { p.setMount('glider'); this.hud.toast('Hover-glider: hold Space to rise, C to dive, Shift for speed. F to land.'); }
      else this.hud.toast('The hover-glider unlocks later in your journey.', 'warn');
      return;
    }
    if (inWater && s.unlocks.mounts.includes('boat')) { p.setMount('boat', w.plan.boats[0] ?? 'dugout'); this.hud.toast(`You launch a ${(w.plan.boats[0] ?? 'dugout').replace('_', ' ')}. F to leave it near the shore.`); return; }
    const dom = w.plan.domestic;
    if (s.unlocks.mounts.includes('camel') && (dom.includes('camel') || dom.includes('bactrian_camel'))) { p.setMount('camel', dom.includes('camel') ? 'camel' : 'bactrian_camel'); this.hud.toast('You ride a camel. Shift to go faster.'); return; }
    if (s.unlocks.mounts.includes('horse') && dom.includes('horse')) { p.setMount('horse', 'horse'); this.hud.toast('You ride a horse. Shift to gallop.'); return; }
    if (s.unlocks.mounts.includes('glider')) { p.setMount('glider'); return; }
    this.hud.toast(inWater ? 'Nothing to ride here.' : 'No mount available in this place and time yet. Mounts unlock as you repair Rifts.', 'warn');
  }

  private collect(pk: Pickup) {
    const w = this.world!;
    this.state.pickups.push(pk.id);
    this.addItem(pk.item, 1);
    w.pickups.remove(pk);
    audio.pickup();
    this.hud.toast(`Picked up ${ITEM_BY_ID.get(pk.item)?.name}.`, 'good');
    this.story.notify({ type: 'inventory' });
  }

  addItem(id: string, n: number) { this.state.inventory[id] = (this.state.inventory[id] ?? 0) + n; }
  removeItem(id: string, n: number): boolean {
    const have = this.state.inventory[id] ?? 0;
    if (have < n) return false;
    this.state.inventory[id] = have - n;
    if (this.state.inventory[id] <= 0) delete this.state.inventory[id];
    return true;
  }

  // ------------------------------------------------------------------ anomalies
  private capture(a: ActiveAnomaly) {
    const w = this.world!;
    w.anomalies.remove(a);
    this.state.captured.push(a.spawn.instanceId);
    this.state.vault.push({ instanceId: a.spawn.instanceId, anomalyId: a.def.id, fromPlace: w.plan.place.short, fromYear: w.plan.year });
    this.state.journal.anomalies[a.def.id] = { name: a.def.name, fact: a.def.fact, at: Date.now(), extra: 'Captured · ' + a.def.homeHint };
    audio.capture();
    this.r.uniforms.uFlash.value = 0.35;
    this.hud.toast(`✨ Captured the ${a.def.name}! ${a.def.homeHint}`, 'good', 6500);
    this.story.notify({ type: 'capture', anomaly: a.def.id });
    this.saveSoon();
  }

  private startAnomalyPuzzle(a: ActiveAnomaly) {
    this.input.unlock();
    this.puzzle.start(`Unlock the time bubble: ${a.def.name}`, 3, a.spawn.seed, (ok) => {
      if (ok) this.capture(a);
      this.resumePlay();
    });
  }

  /** null if the anomaly can be returned here, otherwise the reason. */
  canReturn(anomalyId: string): string | null {
    const w = this.world;
    const def = ANOMALY_BY_ID.get(anomalyId);
    if (!w || !def) return 'Unknown';
    if (w.plan.moon) return 'Not on the Moon';
    if (w.plan.eraId !== def.homeEra) return `Belongs in the ${ERA_BY_ID.get(def.homeEra)?.name}`;
    if (def.homeRegion && def.homeRegion !== w.plan.regionId) return `Belongs in ${REGION_BY_ID.get(def.homeRegion)?.name}`;
    if (!this.story.returnAllowedHere(anomalyId, w.plan)) return 'It must go back to the exact place it came from';
    if (def.id === 'smartphone' && w.plan.year < 2007) return 'Smartphones belong after 2007';
    return null;
  }

  private returnAnomaly(instanceId: string) {
    const v = this.state.vault.find((x) => x.instanceId === instanceId);
    if (!v) return;
    const why = this.canReturn(v.anomalyId);
    if (why) { this.hud.toast(why, 'warn'); return; }
    const def = ANOMALY_BY_ID.get(v.anomalyId)!;
    this.state.vault = this.state.vault.filter((x) => x !== v);
    this.state.returned.push(instanceId);
    this.state.maxEnergy += 4;
    this.state.energy = Math.min(this.state.maxEnergy, this.state.energy + def.energy);
    this.state.journal.anomalies[def.id] = { name: def.name, fact: def.fact, at: Date.now(), extra: 'Returned home ✓' };
    audio.returned();
    this.r.uniforms.uFlash.value = 0.4;
    this.hud.toast(`↩ The ${def.name} is home again. +${def.energy} chrono energy. ${def.fact}`, 'good', 8000);
    for (const u of checkUnlocks(this.state)) this.hud.toast(`🔓 Unlocked: ${u === 'moon' ? 'The Moon' : ERA_BY_ID.get(u as never)?.name}`, 'good', 6000);
    this.story.notify({ type: 'return', anomaly: def.id, plan: this.world!.plan });
    this.saveSoon();
  }

  // ------------------------------------------------------------------ talking
  private talk(npc: Npc) {
    const w = this.world!;
    this.input.unlock();
    this.talking = npc;
    audio.click();
    if (npc.story && npc.storyId) { this.storyTalk(npc); return; }
    const sp = npc.spawn;
    const rng = new Rng(hash32(sp.id, Math.floor(this.state.playTime)));
    const firstHere = !this.state.translatorUsed.includes(w.plan.key);
    if (firstHere) { this.state.translatorUsed.push(w.plan.key); audio.translator(); }
    // people journal
    if (sp.job !== 'child' && !this.state.journal.people[`${sp.job}@${w.plan.eraId}@${w.plan.regionId}`]) {
      this.state.journal.people[`${sp.job}@${w.plan.eraId}@${w.plan.regionId}`] = { name: `${sp.jobName} (${ERA_BY_ID.get(w.plan.eraId)?.name}, ${REGION_BY_ID.get(w.plan.regionId)?.name})`, fact: sp.fact, at: Date.now() };
      this.hud.toast(`📖 Journal: ${sp.jobName}`, 'good');
    }
    if (['scholar', 'craft', 'build'].includes(sp.work)) this.discoverInvention(rng);
    const ctx = this.dialogueCtx(npc);
    this.dialogue.show(sp.name, sp.jobName, Dlg.greeting(ctx, rng), this.npcOptions(npc, rng), firstHere);
  }

  private dialogueCtx(npc: Npc): Dlg.DialogueCtx {
    const w = this.world!, p = this.player!;
    const a = w.anomalies.nearest(p.pos);
    return {
      plan: w.plan, npc: npc.spawn, hour: this.state.hour, weather: w.weather.kind,
      anomaly: a ? { id: a.def.id, dir: Dlg.compassDir(a.pos.x - npc.pos.x, a.pos.z - npc.pos.z), dist: Dlg.distWords(a.pos.distanceTo(npc.pos)) } : null,
      landmark: w.plan.landmarks[0]?.name ?? null,
    };
  }

  private npcOptions(npc: Npc, rng: Rng): DialogueOption[] {
    const w = this.world!, sp = npc.spawn;
    const say = (t: string) => { this.dialogue.setText(t); this.dialogue.setOptions(this.npcOptions(npc, rng)); };
    const opts: DialogueOption[] = [];
    // quests involving this npc
    const myQuest = this.state.sideQuests.find((q) => !q.done && q.worldKey === w.plan.key && q.giver === sp.id);
    const deliverTo = this.state.sideQuests.find((q) => !q.done && q.worldKey === w.plan.key && q.type === 'deliver' && q.target === sp.id);
    if (deliverTo && (this.state.inventory[deliverTo.item!] ?? 0) > 0) opts.push({ label: `Give the ${ITEM_BY_ID.get(deliverTo.item!)?.name.toLowerCase()} from ${deliverTo.giverName}`, primary: true, action: () => { this.removeItem(deliverTo.item!, 1); this.completeQuest(deliverTo); say(Dlg.thanks(rng)); } });
    if (myQuest && this.questReady(myQuest)) opts.push({ label: 'I have what you asked for', primary: true, action: () => { this.consumeQuest(myQuest); this.completeQuest(myQuest); say(Dlg.thanks(rng)); } });
    opts.push({ label: 'Tell me about this place', action: () => say(Dlg.placeFact(this.dialogueCtx(npc), rng)) });
    opts.push({ label: 'Seen anything strange?', action: () => say(Dlg.anomalyHint(this.dialogueCtx(npc), rng)) });
    opts.push({ label: 'How is life here?', action: () => say(Dlg.smalltalk(this.dialogueCtx(npc), rng)) });
    if (sp.trader) opts.push({ label: "Let's trade", action: () => { this.dialogue.hide(); this.talking = null; this.trade.show(this.state, w.plan, sp.name); } });
    if (sp.questGiver && !myQuest && !this.state.sideQuests.some((q) => q.giver === sp.id && q.worldKey === w.plan.key)) {
      opts.push({ label: 'Do you need any help?', action: () => {
        const q = makeQuest(w.plan, sp, w.plan.npcs, this.state);
        if (!q) { say("That's kind of you, but I'm fine for now."); return; }
        this.state.sideQuests.push(q);
        if (q.type === 'deliver') this.addItem(q.item!, 1);
        this.spawnQuestPickups(q);
        this.hud.toast('New task: ' + questObjective(q, this.state));
        say(q.text);
      } });
    }
    opts.push({ label: 'Goodbye', action: () => { this.dialogue.setText(Dlg.farewell(rng)); setTimeout(() => this.endTalk(), 700); } });
    return opts;
  }

  private storyTalk(npc: Npc) {
    const id = npc.storyId!;
    const rift = this.story.rift;
    const n = rift?.npcs.find((x) => x.id === id);
    const lines = this.story.npcLines(id);
    let i = 0;
    const next = () => {
      if (i < lines.length - 1) { i++; this.dialogue.setText(lines[i]); this.dialogue.setOptions(opts()); return; }
      this.story.notify({ type: 'talk', npc: id });
      this.dialogue.setOptions(opts(true));
    };
    const opts = (end = false): DialogueOption[] => {
      const o: DialogueOption[] = [];
      if (!end && i < lines.length - 1) o.push({ label: 'Continue', primary: true, action: next });
      else if (!end) o.push({ label: 'I understand', primary: true, action: next });
      if (this.story.canDeliver(id)) o.push({ label: 'Hand over what you found', primary: true, action: () => { this.story.notify({ type: 'deliver', npc: id }); this.dialogue.setText('Thank you! This is exactly what we needed.'); this.dialogue.setOptions([{ label: 'Goodbye', action: () => this.endTalk() }]); } });
      if (this.story.wantsPuzzle(id)) o.push({ label: 'Let me try to fix it', primary: true, action: () => { this.dialogue.hide(); this.puzzle.start(`${rift?.title}: ${this.story.step?.text ?? ''}`, rift && rift.index >= 10 ? 4 : 3, hash32(id), (ok) => { if (ok) { this.story.notify({ type: 'puzzle', npc: id }); this.hud.toast('It worked!', 'good'); } this.talking = null; this.resumePlay(); }); } });
      o.push({ label: 'Goodbye', action: () => this.endTalk() });
      return o;
    };
    this.dialogue.show(n?.name ?? 'Stranger', n?.role ?? '', lines[0] ?? '…', opts(), !this.state.translatorUsed.includes('story-' + id));
    if (!this.state.translatorUsed.includes('story-' + id)) this.state.translatorUsed.push('story-' + id);
  }

  private endTalk() {
    if (!this.dialogue.open && !this.talking) return;
    this.dialogue.hide();
    this.talking = null;
    this.resumePlay();
  }

  private discoverInvention(rng: Rng) {
    const e = getEra(this.world!.plan.eraId);
    const unknown = e.inventions.filter((i) => !this.state.journal.inventions[i.id + '@' + e.id]);
    if (!unknown.length) return;
    const inv = rng.pick(unknown);
    this.state.journal.inventions[inv.id + '@' + e.id] = { name: inv.name, fact: inv.fact, at: Date.now(), extra: e.name };
    this.hud.toast(`💡 Invention discovered: ${inv.name}`, 'good', 5000);
  }

  private discoverAnimal(id: string) {
    if (this.state.journal.animals[id]) return;
    const a = ANIMAL_BY_ID.get(id);
    if (!a) return;
    this.state.journal.animals[id] = { name: a.name, fact: a.fact, at: Date.now() };
    this.hud.toast(`🐾 Journal: ${a.name}`, 'good');
    audio.animalCall(a.sound);
  }

  // ------------------------------------------------------------------ side quests
  private spawnQuestPickups(q: SideQuest) {
    const w = this.world!;
    if (q.worldKey !== w.plan.key) return;
    const giver = w.npcs.npcs.find((n) => n.spawn.id === q.giver);
    const base = giver ? [giver.pos.x, giver.pos.z] : [w.plan.spawn.x, w.plan.spawn.z];
    for (const pk of questPickups(q, this.state)) {
      if (w.pickups.list.some((x) => x.id === pk.id)) continue;
      const r = new Rng(hash32(pk.id));
      const ang = r.range(0, Math.PI * 2), d = q.type === 'build' ? r.range(15, 50) : r.range(40, 140);
      const pos = this.findSpot(base[0] + Math.cos(ang) * d, base[1] + Math.sin(ang) * d, 12, r);
      w.pickups.add(pk.id, pk.item, pos[0], pos[1], 'quest');
    }
  }
  private questReady(q: SideQuest): boolean {
    if (q.type === 'photograph') return q.done;
    if (q.type === 'deliver') return false;
    return (this.state.inventory[q.item!] ?? 0) >= (q.count ?? 1);
  }
  private consumeQuest(q: SideQuest) { if (q.item && q.type !== 'photograph') this.removeItem(q.item, q.count ?? 1); }
  private completeQuest(q: SideQuest) {
    if (q.done && q.type !== 'photograph') return;
    q.done = true;
    this.state.money += q.reward;
    this.state.energy = Math.min(this.state.maxEnergy, this.state.energy + 5);
    audio.pickup();
    this.hud.toast(`Task complete! +${Math.round(q.reward * (this.world!.plan.currency.rate || 1))} ${this.world!.plan.currency.short} and +5 energy.`, 'good');
  }

  // ------------------------------------------------------------------ visits & photos
  private checkVisits() {
    const w = this.world!, p = this.player!;
    for (const l of w.plan.landmarks) {
      const d = Math.hypot(p.pos.x - l.x, p.pos.z - l.z);
      const def = LANDMARK_BY_ID.get(l.id);
      if (!def) continue;
      const r = Math.max(60, l.clear * 0.9 + 40) * (def.kind === 'natural' ? 3 : 1);
      if (d < r && !this.visited.has(w.plan.key + l.id)) {
        this.visited.add(w.plan.key + l.id);
        const key = l.id;
        const prev = this.state.journal.landmarks[key];
        const years = new Set((prev?.extra ?? '').split(', ').filter(Boolean));
        years.add(formatYear(w.plan.year) + ` (${l.state})`);
        this.state.journal.landmarks[key] = { name: def.name, fact: [def.fact, l.note].filter(Boolean).join(' '), at: Date.now(), extra: [...years].join(', ') };
        if (!prev) this.hud.toast(`🏛 Journal: ${def.name}`, 'good');
        this.story.notify({ type: 'visit', landmark: l.id });
      }
    }
  }

  private enterPhoto() {
    if (!this.player) return;
    this.photoMode = true;
    this.photoCam.pos.copy(this.r.camera.position);
    const dir = new THREE.Vector3();
    this.r.camera.getWorldDirection(dir);
    this.photoCam.yaw = Math.atan2(-dir.x, -dir.z);
    this.photoCam.pitch = Math.asin(dir.y);
    this.hud.show(false);
    this.photoOverlay = document.createElement('div');
    this.photoOverlay.innerHTML = `<div class="photo-frame"></div><div class="photo-help panel">📷 Camera mode — mouse to aim, WASD to move, scroll to zoom, click or Space to take a photo, P or Esc to exit</div>`;
    document.getElementById('ui')!.append(this.photoOverlay);
    this.input.lock();
  }
  private photoOverlay: HTMLElement | null = null;
  private exitPhoto() {
    this.photoMode = false;
    this.photoOverlay?.remove();
    this.photoOverlay = null;
    this.r.camera.fov = this.state.settings.fov;
    this.r.camera.updateProjectionMatrix();
    this.hud.show(true);
  }
  private updatePhotoCam(dt: number) {
    const inp = this.input, cam = this.r.camera, c = this.photoCam;
    c.yaw -= inp.mouseDX * 0.0022 * this.state.settings.sensitivity;
    c.pitch = Math.max(-1.4, Math.min(1.4, c.pitch - inp.mouseDY * 0.0022 * this.state.settings.sensitivity));
    const fwd = new THREE.Vector3(-Math.sin(c.yaw) * Math.cos(c.pitch), Math.sin(c.pitch), -Math.cos(c.yaw) * Math.cos(c.pitch));
    const right = new THREE.Vector3(Math.cos(c.yaw), 0, -Math.sin(c.yaw));
    const mv = new THREE.Vector3();
    if (inp.held('KeyW')) mv.add(fwd);
    if (inp.held('KeyS')) mv.sub(fwd);
    if (inp.held('KeyD')) mv.add(right);
    if (inp.held('KeyA')) mv.sub(right);
    c.pos.addScaledVector(mv, dt * 8);
    const p = this.player!.pos;
    const off = c.pos.clone().sub(p);
    if (off.length() > 40) c.pos.copy(p).add(off.setLength(40));
    const gh = this.world!.ts.height(c.pos.x, c.pos.z);
    if (c.pos.y < gh + 0.5) c.pos.y = gh + 0.5;
    cam.position.copy(c.pos);
    cam.lookAt(c.pos.clone().add(fwd));
    if (inp.wheel) { cam.fov = Math.max(20, Math.min(90, cam.fov + inp.wheel * 4)); cam.updateProjectionMatrix(); }
    if (inp.clicked || inp.wasPressed('Space')) this.takePhoto();
  }

  private takePhoto() {
    const w = this.world!, cam = this.r.camera;
    this.r.render();
    const data = this.r.snapshot(320);
    this.r.uniforms.uFlash.value = 0.8;
    audio.camera();
    cam.updateMatrixWorld();
    const frustum = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
    const subjects: string[] = [];
    const names: string[] = [];
    for (const it of w.interest) {
      if (it.kind !== 'landmark') continue;
      const c = new THREE.Vector3(it.x, it.y, it.z);
      if (c.distanceTo(cam.position) < 4000 && frustum.intersectsSphere(new THREE.Sphere(c, it.r * 0.6))) { subjects.push(it.id); names.push(it.name); }
    }
    for (const l of w.plan.landmarks) {
      const def = LANDMARK_BY_ID.get(l.id);
      if (def?.kind === 'natural' && !subjects.includes(l.id) && Math.hypot(cam.position.x - l.x, cam.position.z - l.z) < 6000) { subjects.push(l.id); names.push(def.name); }
    }
    for (const a of w.animals.animals) {
      if (a.pos.distanceTo(cam.position) < 70 && frustum.containsPoint(a.pos.clone().setY(a.pos.y + 0.5)) && !subjects.includes(a.species)) { subjects.push(a.species); names.push(a.def.name); this.discoverAnimal(a.species); }
    }
    for (const n of w.npcs.npcs) if (n.visible && n.pos.distanceTo(cam.position) < 25 && frustum.containsPoint(n.pos.clone().setY(n.pos.y + 1))) { names.push(n.spawn.jobName); break; }
    const caption = names.length ? names.slice(0, 3).join(', ') : w.plan.place.short;
    this.state.photos.push({ id: 'ph' + Date.now(), data, caption, place: w.plan.place.short, year: w.plan.year, at: Date.now(), subjects });
    if (this.state.photos.length > 40) this.state.photos.shift();
    this.hud.toast(`📷 Photo saved to your journal: ${caption}`, 'good');
    this.story.notify({ type: 'photo', subjects });
    for (const q of this.state.sideQuests) if (!q.done && q.type === 'photograph' && q.worldKey === w.plan.key && subjects.includes(q.subject!)) { this.completeQuest(q); this.hud.toast(`${q.giverName} will love this photo!`, 'good'); }
  }

  // ------------------------------------------------------------------ screens
  private openInventory() {
    const w = this.world!;
    const mounts = this.state.unlocks.mounts.map((m) => ({ boat: '⛵ Boat (in water)', horse: '🐎 Horse (where horses are kept)', camel: '🐪 Camel (where camels are kept)', glider: '🛸 Hover-glider (G)' } as Record<string, string>)[m] ?? m);
    this.inventory.show(this.state, w.plan, (id) => this.canReturn(id), mounts);
  }

  private openMap() {
    const w = this.world!, p = this.player!;
    const markers: { x: number; z: number; icon: string; label: string }[] = [];
    for (const n of this.storyNpcs.values()) markers.push({ x: n.pos.x, z: n.pos.z, icon: '⭐', label: n.spawn.name });
    for (const pk of w.pickups.list) markers.push({ x: pk.pos.x, z: pk.pos.z, icon: pk.tag === 'story' ? '✨' : '❔', label: ITEM_BY_ID.get(pk.item)?.name ?? '' });
    const a = w.anomalies.nearest(p.pos);
    if (a) markers.push({ x: a.pos.x + Math.sin(a.spawn.seed) * 60, z: a.pos.z + Math.cos(a.spawn.seed) * 60, icon: '🌀', label: 'Anomaly (approximate)' });
    for (const n of w.npcs.npcs) if (n.spawn.trader) markers.push({ x: n.pos.x, z: n.pos.z, icon: '💰', label: `Trader: ${n.spawn.name}` });
    this.map.show(w.plan, w.ts, { x: p.pos.x, z: p.pos.z, heading: p.heading }, markers);
  }

  private updateHud(near: ActiveAnomaly | null) {
    const w = this.world!, p = this.player!, s = this.state;
    const camDir = new THREE.Vector3();
    this.r.camera.getWorldDirection(camDir);
    const viewBearing = Math.atan2(camDir.x, -camDir.z);
    let radar: HudData['radar'] = null;
    let radarLabel = 'No anomalies here';
    if (near) {
      const dx = near.pos.x - p.pos.x, dz = near.pos.z - p.pos.z;
      const b = Math.atan2(dx, -dz);
      const d = Math.hypot(dx, dz);
      radar = { angle: b - viewBearing, dist: d };
      radarLabel = `${d < 1000 ? Math.round(d) + ' m' : (d / 1000).toFixed(1) + ' km'} · ${near.def.name}`;
    }
    const markers: HudData['markers'] = [];
    for (const n of this.storyNpcs.values()) markers.push({ bearing: Math.atan2(n.pos.x - p.pos.x, -(n.pos.z - p.pos.z)), icon: '⭐' });
    for (const pk of w.pickups.list.slice(0, 6)) markers.push({ bearing: Math.atan2(pk.pos.x - p.pos.x, -(pk.pos.z - p.pos.z)), icon: pk.tag === 'story' ? '✨' : '❔' });
    for (const l of w.plan.landmarks) markers.push({ bearing: Math.atan2(l.x - p.pos.x, -(l.z - p.pos.z)), icon: '🏛' });
    const e = getEra(w.plan.eraId);
    const hh = Math.floor(s.hour), mm = Math.floor((s.hour % 1) * 60);
    const rate = w.plan.currency.rate;
    const side = s.sideQuests.filter((q) => !q.done && q.worldKey === w.plan.key).slice(0, 3).map((q) => questObjective(q, s));
    let objective = this.story.objective();
    if (!objective && s.story.ended) objective = { title: 'Timeline restored', text: 'Explore anywhere, anywhen. Anomalies still drift through time.' };
    if (objective && (this.story.step?.type === 'travel' || this.story.step?.type === 'moon')) objective = { ...objective, hint: (objective.hint ?? '') + ' Press T to open the Chronometer and use ★ Objective.' };
    const unlockHint = nextUnlockHint(s);
    this.hud.update({
      place: w.plan.place.name,
      when: `${formatYear(w.plan.year)} · ${e.name}`,
      meta: `${w.plan.biomeName} · ${w.plan.climate.season} · ${w.weather.kind} · ${Math.round(w.plan.climate.seasonTemp)}°C`,
      energy: s.energy, maxEnergy: s.maxEnergy,
      money: rate ? `💰 ${Math.round(s.money * rate)} ${w.plan.currency.short}` : '💰 —',
      clock: `🕒 ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`,
      yaw: viewBearing, markers, radar, radarLabel,
      prompt: this.lastPrompt,
      objective,
      side: side.length ? side : unlockHint && !objective ? [unlockHint] : side,
      vault: s.vault.length,
    });
    void eraForYear;
  }

  // ------------------------------------------------------------------ story beats
  private onRiftComplete(r: RiftDef) {
    audio.fanfare();
    this.r.uniforms.uFlash.value = 0.6;
    const show = () => {
      this.input.unlock();
      this.cards.story(`Major Rift ${r.index} of 12 repaired`, r.title, [r.outro, r.fact], r.mirra, this.state.story.ended ? 'Continue' : 'Onward', () => {
        if (this.state.story.ended && r.index === 12) this.showEnding();
        else {
          const next = RIFTS[this.state.story.rift];
          if (next) this.cards.story(`Rift ${next.index}`, next.title, [next.intro, `Destination: ${next.place}, ${formatYear(next.year)}. Press T and use ★ Objective.`], null, "Let's go", () => this.resumePlay());
          else this.resumePlay();
        }
      });
    };
    setTimeout(show, 1200);
    this.saveSoon();
  }

  private showEnding() {
    this.cards.story('The timeline is whole', 'Anywhere, anywhen', [
      'Light runs back through every era: the pyramids at Giza, the scrolls of Alexandria, the clock of Kaifeng, the stars of the wayfinders, and the eggs of Hell Creek.',
      'Mirra keeps the Archive open as a library for everyone. The Chronometer is yours. Anomalies still drift through time now and then, and there is always more to discover.',
      `You visited ${this.state.visited.length} places and times, returned ${this.state.returned.length} anomalies, and filled your journal with ${Object.keys(this.state.journal.landmarks).length} landmarks and ${Object.keys(this.state.journal.animals).length} animals.`,
    ], 'Thank you for playing Anywhen.', 'Keep exploring', () => this.resumePlay());
  }

  private saveSoon() { setTimeout(() => { this.syncPlayerState(); saveGame(this.state); }, 300); }
  private syncPlayerState() {
    if (!this.world || !this.player) return;
    const w = this.world.plan;
    this.state.player = { lat: w.lat, lon: w.lon, year: w.year, moon: w.moon, x: this.player.pos.x, z: this.player.pos.z, heading: this.player.heading };
  }
}

function challengeText(c: string): string {
  switch (c) {
    case 'catch': return 'get close and press E to catch it.';
    case 'chase': return 'it is fast! Sprint (Shift) and grab it when it tires.';
    case 'puzzle': return 'it is sealed in a time bubble. Reach it and solve the rings.';
    case 'sneak': return 'someone is watching over it. Crouch (C) and sneak up unseen.';
  }
  return '';
}

export { distanceKm };
