// Game orchestration: scene setup, state machine (menu / garage / playing /
// paused / crashing / over), the main loop, scoring, power-ups and the camera.
import * as THREE from 'three';
import { PHYS, POWER, SCORE } from './config.js';
import { Sound } from './audio.js';
import { Collectibles } from './collectibles.js';
import { Environment } from './environment.js';
import { Input } from './input.js';
import { Obstacles } from './obstacles.js';
import { Particles, SkidMarks } from './particles.js';
import { Road } from './road.js';
import { Scenery } from './scenery.js';
import { randomSeed } from './rng.js';
import { persist, save } from './storage.js';
import { UI } from './ui.js';
import { Vehicle } from './vehicle.js';
import { VEHICLES, getVehicle } from './vehicleModels.js';

const START_S = 26; // the road begins a little behind the start line so the camera has room
const CRASH_TIME = 2.0;
const POWER_MAX = { nitro: 6, shield: POWER.SHIELD, magnet: POWER.MAGNET, grip: POWER.GRIP };

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.mobile = window.matchMedia('(pointer: coarse)').matches;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !this.mobile, powerPreference: 'high-performance' });
    this.maxRatio = Math.min(window.devicePixelRatio || 1, this.mobile ? 1.6 : 2);
    this.ratio = this.maxRatio;
    this.renderer.setPixelRatio(this.ratio);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, 1, 0.3, 1200);
    this.env = new Environment(this.scene);
    this.road = new Road(this.scene);
    this.path = this.road.path;
    this.path.reset(1); // the vehicle samples the road on construction
    this.scenery = new Scenery(this.scene, this.road);
    this.fx = new Particles(this.scene);
    this.skids = new SkidMarks(this.scene);
    this.collectibles = new Collectibles(this.scene, this.road, this.fx);
    this.obstacles = new Obstacles(this.scene, this.road, this.collectibles, this.fx);
    this.vehicle = new Vehicle(this.scene, this.road, this.fx, this.skids);
    this.sound = new Sound();
    this.input = new Input(canvas);

    this.ui = new UI({
      start: () => this.startRun(),
      openGarage: () => this.openGarage(),
      closeGarage: () => this.closeGarage(),
      resume: () => this.resume(),
      pause: () => this.pause(),
      restart: () => this.startRun(),
      menu: () => this.toMenu(),
      toggleMute: () => {
        this.sound.unlock();
        this.sound.setMuted(!this.sound.muted);
        this.ui.setMuteIcon(this.sound.muted);
      },
      toggleUnits: () => {
        save.units = save.units === 'mph' ? 'kmh' : 'mph';
        persist();
        this.ui.setUnits(save.units);
      },
      setSpeed: (pct) => {
        save.speedMul = pct / 100;
        persist();
        this.ui.setSpeedSetting(pct);
      },
      selectVehicle: (id, locked) => this.selectVehicle(id, locked),
      click: () => this.sound.click(),
    });
    this.ui.setMuteIcon(this.sound.muted);
    this.ui.setUnits(save.units);
    this.ui.setSpeedSetting(Math.round(this.speedMul() * 100));
    this.ui.setBest(save.best);
    if (this.mobile) this.ui.setTouchMode(true);

    this.vehicle.hooks.emit = (name, data) => this.onVehicleEvent(name, data);
    this.vehicle.hooks.beforeCrash = (reason) => this.absorbCrash(reason);
    this.vehicle.setDef(getVehicle(save.selected));

    this.state = 'menu';
    this.time = 0;
    this.shake = 0;
    this.seed = 1;
    this.run = this.newRun();
    this.cam = { d: 0, h: 4, ld: 0, lh: 1, fov: 62, roll: 0, orbit: 0 };
    this._tmpA = new THREE.Vector3();
    this._tmpB = new THREE.Vector3();
    this.fpsAcc = 0;
    this.fpsN = 0;
    this.lowTimer = 0;

    this.input.onPause = () => this.onPauseKey();
    this.input.onMenuKey = (k) => this.onMenuKey(k);
    const unlock = () => this.sound.unlock();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    window.addEventListener('resize', () => this.resize());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'playing') this.pause();
    });
    window.addEventListener('blur', () => {
      if (this.state === 'playing') this.pause();
    });
    window.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch') this.ui.setTouchMode(true);
    });
    this.resize();

    this.loadAttract();
    this.ui.show('start');
    this.last = performance.now();
    this.frame = this.frame.bind(this);
    requestAnimationFrame(this.frame);
  }

  newRun() {
    return {
      score: 0, dist: 0, t: 0, mult: 1, multT: 0, coins: 0, tricks: 0,
      power: { nitro: 0, shield: 0, magnet: 0, grip: 0 },
      crashTimer: 0, startS: START_S,
    };
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.baseFov = w / h < 0.8 ? 74 : 62;
    this.camera.updateProjectionMatrix();
  }

  // ---------------------------------------------------------------- setup
  resetWorld(seed) {
    this.seed = seed;
    this.scenery.setSeed(seed);
    this.road.reset(seed);
    this.road.update(START_S, Infinity);
    this.obstacles.reset(seed, START_S);
    this.collectibles.reset();
    this.fx.clear();
    this.skids.clear();
    this.vehicle.reset(START_S, 0);
    this.snapCamera();
  }

  loadAttract() {
    this.resetWorld(randomSeed());
    this.vehicle.speed = 15;
    this.state = 'menu';
    this.input.setEnabled(false);
    this.ui.setHudVisible(false);
  }

  snapCamera() {
    const v = this.vehicle;
    this.cam.d = v.d;
    this.cam.h = 3.8;
    this.cam.ld = v.d;
    this.cam.lh = 1.3;
    this.cam.roll = 0;
    this.cam.orbit = 0;
    this.camSnap = true;
  }

  // ------------------------------------------------------------ state flow
  startRun() {
    this.sound.unlock();
    this.sound.click();
    const params = new URLSearchParams(location.search);
    const fixed = parseInt(params.get('seed'), 10);
    const seed = Number.isFinite(fixed) && !this.seedUsed ? fixed >>> 0 : randomSeed();
    this.seedUsed = Number.isFinite(fixed);
    this.resetWorld(seed);
    this.run = this.newRun();
    this.vehicle.speed = PHYS.START_SPEED * 0.8 * this.vehicle.def.speedMul * this.speedMul();
    this.obstacles.trafficScale = Math.min(1, this.speedMul());
    this.shake = 0;
    this.state = 'playing';
    this.input.setEnabled(true);
    this.input.consumeHop();
    this.ui.show(null);
    this.ui.setHudVisible(true);
    this.ui.updateHUD(this.hudData());
    if (this.ui.current === null && (this.input.isTouch || document.body.classList.contains('touch'))) this.ui.showTouchHint();
  }

  toMenu() {
    this.loadAttract();
    this.ui.setBest(save.best);
    this.ui.show('start');
    this.sound.silence();
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.input.setEnabled(false);
    this.sound.silence();
    this.ui.show('pause');
  }

  resume() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this.input.setEnabled(true);
    this.ui.show(null);
    this.last = performance.now();
  }

  onPauseKey() {
    if (this.state === 'playing') this.pause();
    else if (this.state === 'paused') this.resume();
    else if (this.state === 'garage') this.closeGarage();
  }

  onMenuKey(k) {
    if (this.state === 'menu' && (k === 'Space' || k === 'Enter')) this.startRun();
    else if (this.state === 'over' && (k === 'Space' || k === 'Enter')) this.startRun();
    else if (this.state === 'garage') {
      const i = VEHICLES.findIndex((v) => v.id === save.selected);
      if (k === 'ArrowRight' || k === 'KeyD') this.browseGarage(i + 1);
      else if (k === 'ArrowLeft' || k === 'KeyA') this.browseGarage(i - 1);
      else if (k === 'Enter' || k === 'Space') this.closeGarage();
    }
  }

  openGarage() {
    this.sound.unlock();
    this.garageFrom = this.state === 'over' ? 'over' : 'menu';
    if (this.state === 'over') {
      this.loadAttract();
    }
    this.state = 'garage';
    this.ui.show('garage');
    this.ui.renderGarage(save, VEHICLES.findIndex((v) => v.id === save.selected));
    this.vehicle.speed = 0;
  }

  closeGarage() {
    this.state = 'menu';
    this.vehicle.speed = 12;
    this.ui.show('start');
    this.ui.setBest(save.best);
  }

  browseGarage(i) {
    const n = VEHICLES.length;
    i = (i + n) % n;
    const v = VEHICLES[i];
    if (!save.unlocked.includes(v.id)) {
      // move focus only: show the locked card but keep the selection
      this.ui.renderGarage(save, i);
      return;
    }
    this.selectVehicle(v.id, false);
  }

  selectVehicle(id, locked) {
    if (locked) {
      this.sound.pothole();
      return;
    }
    save.selected = id;
    persist();
    this.vehicle.setDef(getVehicle(id));
    this.ui.renderGarage(save, VEHICLES.findIndex((v) => v.id === id));
    this.sound.powerup();
  }

  // ---------------------------------------------------------------- loop
  frame(now) {
    requestAnimationFrame(this.frame);
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (!(dt > 0)) dt = 1 / 60;
    this.adaptQuality(dt);
    dt = Math.min(dt, 1 / 24);
    this.time += dt;

    switch (this.state) {
      case 'playing':
        this.updatePlaying(dt);
        break;
      case 'crashing':
        this.updateCrashing(dt);
        break;
      case 'menu':
      case 'garage':
      case 'over':
        this.updateAttract(dt);
        break;
      default:
        break; // paused: frozen
    }
    this.updateCamera(this.state === 'paused' ? 0 : dt);
    this.env.update(dt, this.camera);
    this.renderer.render(this.scene, this.camera);
  }

  // Lower the render resolution if the device cannot hold ~50 fps.
  adaptQuality(rawDt) {
    if (this.state === 'paused') return;
    this.fpsAcc += rawDt;
    this.fpsN++;
    if (this.fpsAcc > 2) {
      const avg = this.fpsAcc / this.fpsN;
      if (avg > 1 / 48 && this.ratio > 0.7) {
        this.ratio = Math.max(0.7, this.ratio - 0.15);
        this.renderer.setPixelRatio(this.ratio);
        this.resize();
      } else if (avg < 1 / 62 && this.ratio < this.maxRatio) {
        this.ratio = Math.min(this.maxRatio, this.ratio + 0.1);
        this.renderer.setPixelRatio(this.ratio);
        this.resize();
      }
      this.fpsAcc = 0;
      this.fpsN = 0;
    }
  }

  groundAt = (s, d) => this.obstacles.groundAt(s, d);

  speedMul() {
    const m = Number(save.speedMul);
    return m >= 0.6 && m <= 1.5 ? m : 1;
  }

  targetSpeed(t) {
    return (PHYS.START_SPEED + PHYS.SPEED_GAIN * (1 - Math.exp(-t / PHYS.SPEED_TAU))) * this.speedMul();
  }

  // Autopilot used behind the menus.
  updateAttract(dt) {
    const v = this.vehicle;
    const k = this.path.curvature(v.s);
    const speed = this.state === 'garage' ? 0 : 15;
    const want = -v.d * 0.9 + k * v.speed * v.speed * PHYS.DRIFT * v.def.drift;
    const sinYaw = clamp(want / Math.max(v.speed, 4), -0.4, 0.4);
    const steer = clamp(Math.asin(sinYaw) / v.def.yawMax, -1, 1);
    v.step(dt, steer, false, { targetSpeed: speed, nitro: 0, groundAt: () => 0 });
    if (this.state === 'garage') v.speed = Math.max(0, v.speed - 25 * dt);
    this.finishFrame(dt);
    this.road.update(v.s);
    if (v.s > 4000) this.loadAttractKeepState();
  }

  loadAttractKeepState() {
    const st = this.state;
    this.loadAttract();
    this.state = st;
    this.vehicle.speed = st === 'garage' ? 0 : 15;
  }

  updatePlaying(dt) {
    const run = this.run;
    const v = this.vehicle;
    const inp = this.input.read(dt);
    run.t += dt;

    // power-up timers
    for (const k of Object.keys(run.power)) if (run.power[k] > 0) run.power[k] = Math.max(0, run.power[k] - dt);
    if (run.multT > 0) {
      run.multT -= dt;
      if (run.multT <= 0) run.mult = 1;
    }

    const prevS = v.s;
    v.step(dt, inp.steer, inp.hop, {
      targetSpeed: this.targetSpeed(run.t),
      nitro: run.power.nitro,
      groundAt: this.groundAt,
    });

    // world generation & upkeep
    this.road.update(v.s);
    this.obstacles.generate(v.s, run.t, this.targetSpeed(run.t) * v.def.speedMul);
    this.obstacles.update(dt, v.s);

    if (v.alive) {
      this.handleContacts();
      const got = this.collectibles.update(dt, v, run.power.magnet > 0, v.s);
      for (const g of got) this.collect(g);
      // distance score
      const ds = Math.max(0, v.s - prevS);
      run.dist += ds;
      run.score += ds * 0.5 * run.mult;
    } else {
      this.collectibles.update(dt, v, false, v.s);
    }

    this.finishFrame(dt);
    this.ui.updateHUD(this.hudData());
  }

  updateCrashing(dt) {
    const run = this.run;
    const v = this.vehicle;
    run.crashTimer += dt;
    v.step(dt, 0, false, { targetSpeed: 0, nitro: 0, groundAt: this.groundAt });
    this.road.update(v.s);
    this.obstacles.update(dt, v.s);
    this.finishFrame(dt);
    if (run.crashTimer > CRASH_TIME) this.gameOver();
  }

  // visuals, particles, audio shared by every state
  finishFrame(dt) {
    const v = this.vehicle;
    const run = this.run;
    const nitro = this.state === 'playing' && run.power.nitro > 0;
    v.updateVisual(dt);
    v.setShield(this.state === 'playing' && run.power.shield > 0, run.power.shield < 3);
    v.emitEffects(dt, nitro);
    this.fx.update(dt);
    const running = this.state === 'playing' || this.state === 'menu' || this.state === 'garage';
    const playing = this.state === 'playing';
    this.sound.setEngine(v.speed, running && v.alive, playing ? v.skid : 0, nitro);
    if (this.state === 'crashing' || this.state === 'over') this.sound.setEngine(0, false, 0, false);
    this.shake *= Math.exp(-4.5 * dt);
  }

  hudData() {
    const run = this.run;
    return {
      score: run.score,
      dist: run.dist,
      speed: this.vehicle.speed,
      mult: run.mult,
      multFrac: clamp(run.multT / SCORE.MULT_TIME, 0, 1),
      powers: run.power,
      maxPowers: POWER_MAX,
    };
  }

  // ---------------------------------------------------------- gameplay bits
  handleContacts() {
    const v = this.vehicle;
    const run = this.run;
    const hits = this.obstacles.collide(v);
    for (const o of hits) {
      if (!v.alive) break;
      if (o.hazard) {
        o.hit = true;
        if (o.type === 'pothole') {
          if (v.def.sturdy) {
            v.susp.v = -3;
            this.sound.bounce();
            this.fx.burst(o.mesh.position.x, o.mesh.position.y + 0.2, o.mesh.position.z, 0x6b6b70, 4, 2.5, 0.2);
          } else {
            v.speed *= 0.72;
            v.susp.v = -9;
            if (v.grounded) {
              v.vy = 3.2;
              v.grounded = false;
              v.rampVy = 0;
            }
            this.shake = Math.max(this.shake, 0.4);
            this.sound.pothole();
            this.fx.burst(o.mesh.position.x, o.mesh.position.y + 0.2, o.mesh.position.z, 0x7a7a80, 8, 3.5, 0.3);
          }
        } else if (o.type === 'oil') {
          if (run.power.grip > 0) {
            this.ui.toast('Grip!', '#5bd16b');
          } else {
            v.slip = 1.6;
            this.sound.splat();
            this.ui.toast('Slippery!', '#b9a4ff');
          }
        }
        continue;
      }
      // solid obstacle
      if (v.def.crusher && o.crush) {
        this.obstacles.smash(o, v.speed);
        run.score += SCORE.CRUSH * run.mult;
        this.sound.crush();
        this.shake = Math.max(this.shake, 0.15);
        this.fx.burst(o.mesh.position.x, o.mesh.position.y + 0.4, o.mesh.position.z, 0xff7a1a, 6, 4, 0.25);
        continue;
      }
      if (v.invuln > 0) {
        this.obstacles.smash(o, v.speed);
        continue;
      }
      if (run.power.shield > 0) {
        this.breakShield();
        this.obstacles.smash(o, v.speed);
        v.invuln = 1.3;
        v.speed *= 0.9;
        continue;
      }
      v.crash('obstacle');
    }
  }

  breakShield() {
    const v = this.vehicle;
    this.run.power.shield = 0;
    this.sound.shieldBreak();
    this.shake = Math.max(this.shake, 0.5);
    this.ui.toast('Shield broke!', '#66e0ff');
    const p = v.obj.root.position;
    this.fx.burst(p.x, p.y + 1, p.z, 0x66e0ff, 18, 7, 0.3);
  }

  // Called by the vehicle before a rail / landing crash. Returns true if absorbed.
  absorbCrash(reason) {
    if (this.state !== 'playing') return false;
    if (this.run.power.shield > 0) {
      this.breakShield();
      return true;
    }
    return false;
  }

  onVehicleEvent(name, data) {
    const v = this.vehicle;
    switch (name) {
      case 'hop':
        this.input.consumeHop();
        this.sound.jump();
        break;
      case 'launch':
        this.sound.jump();
        this.shake = Math.max(this.shake, 0.15);
        break;
      case 'land': {
        if (this.state !== 'playing') break;
        const { impact, tricks } = data;
        this.sound.land(impact / 12);
        if (impact > 5) {
          const p = v.obj.root.position;
          for (let i = 0; i < Math.min(10, impact); i++) this.fx.dust(p.x + (Math.random() - 0.5) * 2, p.y, p.z + (Math.random() - 0.5) * 2, { x: 0, z: 0 });
        }
        if (impact > 11) this.shake = Math.max(this.shake, clamp((impact - 8) / 14, 0.25, 0.8));
        if (tricks > 0) this.awardTricks(tricks);
        break;
      }
      case 'crash':
        this.onCrash(data.reason);
        break;
      case 'bounce':
        this.sound.bounce();
        this.shake = Math.max(this.shake, 0.2);
        break;
      default:
        break;
    }
  }

  awardTricks(n) {
    const run = this.run;
    run.tricks += n;
    run.mult = Math.min(SCORE.MULT_MAX, run.mult + n);
    run.multT = SCORE.MULT_TIME;
    const pts = SCORE.TRICK * n * run.mult;
    run.score += pts;
    this.sound.trick(n);
    const p = this.vehicle.obj.root.position;
    this.fx.burst(p.x, p.y + 1.5, p.z, 0xffd23f, 16, 6, 0.28);
    this.ui.toast(`${n > 1 ? n + 'x ' : ''}TRICK! +${pts.toLocaleString('en-US')}`, '#ffd23f');
    if (run.mult > 1) this.ui.toast(`Multiplier x${run.mult}`, '#8affc1');
  }

  collect(g) {
    const run = this.run;
    if (run.multT > 0) run.multT = SCORE.MULT_TIME; // keep the combo alive
    switch (g.type) {
      case 'coin':
        run.coins++;
        run.score += SCORE.COIN * run.mult;
        this.sound.coin(Math.min(7, (run.coins % 8)));
        this.fx.burst(g.x, g.y, g.z, 0xffd23f, 4, 3, 0.2);
        break;
      case 'nitro':
        run.power.nitro = Math.min(POWER_MAX.nitro, run.power.nitro + POWER.NITRO);
        this.sound.nitro();
        this.ui.toast('NITRO!', '#ff8a1f');
        this.shake = Math.max(this.shake, 0.2);
        break;
      case 'box': {
        const pick = ['shield', 'magnet', 'grip'][Math.floor(Math.random() * 3)];
        run.power[pick] = POWER_MAX[pick];
        this.sound.powerup();
        const names = { shield: ['SHIELD!', '#66e0ff'], magnet: ['COIN MAGNET!', '#ff5a8a'], grip: ['GRIP MODE!', '#5bd16b'] };
        this.ui.toast(...names[pick]);
        this.fx.burst(g.x, g.y, g.z, 0xb77bff, 14, 6, 0.3);
        break;
      }
      default:
        break;
    }
  }

  onCrash() {
    const v = this.vehicle;
    this.state = 'crashing';
    this.run.crashTimer = 0;
    this.run.mult = 1;
    this.run.multT = 0;
    this.input.setEnabled(false);
    this.sound.crash();
    this.shake = 1.2;
    const p = v.obj.root.position;
    this.fx.burst(p.x, p.y + 1, p.z, 0xffb347, 18, 9, 0.3);
    for (let i = 0; i < 14; i++) this.fx.smoke(p.x + (Math.random() - 0.5) * 2, p.y + 0.8, p.z + (Math.random() - 0.5) * 2, 0.9, i % 3 ? 0x8a8a94 : 0x55555e);
    this.ui.clearPowers();
  }

  gameOver() {
    if (this.state === 'over') return;
    const run = this.run;
    const score = Math.floor(run.score);
    const prevBest = save.best;
    const newBest = score > prevBest;
    if (newBest) save.best = score;
    const unlocked = [];
    for (const v of VEHICLES) {
      if (score >= v.unlock && !save.unlocked.includes(v.id)) {
        save.unlocked.push(v.id);
        unlocked.push(v.name);
      }
    }
    persist();
    this.state = 'over';
    this.ui.setHudVisible(false);
    this.ui.setBest(save.best);
    this.ui.showGameOver({
      score, best: save.best, newBest, unlocked, dist: run.dist, tricks: run.tricks, coins: run.coins, seed: this.seed,
    });
    if (newBest || unlocked.length) this.sound.unlockFanfare();
  }

  // ---------------------------------------------------------------- camera
  updateCamera(dt) {
    const cam = this.camera;
    const c = this.cam;
    const v = this.vehicle;
    const path = this.path;
    const snap = this.camSnap;
    this.camSnap = false;

    if (this.state === 'garage') {
      // orbit around the parked vehicle
      c.orbit += dt * 0.45;
      const root = v.obj.root.position;
      const r = 8.2 + v.def.hl * 0.9 + (v.obj.height > 2.5 ? 2 : 0);
      const target = this._tmpA.set(root.x + Math.cos(c.orbit) * r, root.y + 2.4 + v.obj.height * 0.3, root.z + Math.sin(c.orbit) * r);
      cam.position.lerp(target, snap ? 1 : 1 - Math.exp(-5 * dt));
      this._tmpB.set(root.x, root.y + v.obj.height * 0.4 - 1.5, root.z);
      cam.lookAt(this._tmpB);
      cam.fov += (50 - cam.fov) * (1 - Math.exp(-4 * dt));
      cam.updateProjectionMatrix();
      return;
    }

    const bigVehicle = v.obj.height > 2.5 ? 1.2 : 0;
    const back = 9.5 + v.def.hl * 0.9;
    const k = (r) => (snap ? 1 : 1 - Math.exp(-r * dt));
    c.d += (v.d * 0.78 - c.d) * k(6);
    c.h += (3.9 + bigVehicle + v.h * 0.65 - c.h) * k(7);
    c.ld += (v.d * 0.55 - c.ld) * k(8);
    c.lh += (1.3 + v.h * 0.5 + bigVehicle * 0.4 - c.lh) * k(8);
    path.point(v.s - back, c.d, c.h, this._tmpA);
    path.point(v.s + 15, c.ld, c.lh, this._tmpB);
    cam.position.copy(this._tmpA);
    if (this.shake > 0.01) {
      const s = this.shake * 0.45;
      cam.position.x += (Math.random() - 0.5) * s;
      cam.position.y += (Math.random() - 0.5) * s;
      cam.position.z += (Math.random() - 0.5) * s;
    }
    cam.up.set(0, 1, 0);
    cam.lookAt(this._tmpB);
    const kc = path.curvature(v.s);
    const rollT = clamp(-kc * v.speed * 0.45 - v.steerV * 0.012, -0.07, 0.07);
    c.roll += (rollT - c.roll) * k(4);
    cam.rotateZ(c.roll);
    const nitro = this.state === 'playing' && this.run.power.nitro > 0;
    const fovT = this.baseFov + clamp((v.speed - 18) * 0.32, 0, 9) + (nitro ? 9 : 0);
    c.fov += (fovT - c.fov) * k(3);
    if (Math.abs(cam.fov - c.fov) > 0.05) {
      cam.fov = c.fov;
      cam.updateProjectionMatrix();
    }
  }
}

