import * as THREE from 'three';
import { PLAYER, SCORE, ROAD } from './config.js';
import { RoadPath } from '../world/roadPath.js';
import { Road } from '../world/road.js';
import { Environment } from '../world/environment.js';
import { destinationById } from '../world/destinations.js';
import { Vehicle } from '../vehicle/vehicle.js';
import { Traffic } from '../traffic/traffic.js';
import { Pickups } from '../traffic/pickups.js';
import { Particles, SkidMarks } from '../fx/particles.js';
import { CameraRig } from '../fx/cameraRig.js';
import { Input } from '../input/input.js';
import { Audio } from '../audio/audio.js';
import { Storage } from '../storage/storage.js';
import { UI } from '../ui/ui.js';
import { Garage } from '../ui/garage.js';

const STEP = 1 / 60;
const MENU_SEED = 20251;
const $ = (id) => document.getElementById(id);

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.storage = new Storage();
    this.audio = new Audio();
    this.audio.setMuted(!!this.storage.get('muted'));
    this.ui = new UI();
    this.input = new Input(canvas);
    this.isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    document.body.classList.toggle('touch', this.isTouch);

    const mobile = this.isTouch && Math.min(screen.width, screen.height) < 900;
    this.maxPixelRatio = Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2);
    this.pixelRatio = this.maxPixelRatio;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: this.maxPixelRatio < 2, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(64, 1, 0.3, 3200);

    this.path = new RoadPath();
    this.env = new Environment(this.scene);
    this.road = new Road(this.scene, this.path);
    this.player = new Vehicle(this.scene, this.path);
    this.traffic = new Traffic(this.scene, this.path);
    this.pickups = new Pickups(this.scene, this.path, this.traffic);
    this.particles = new Particles(this.scene, 600);
    this.skids = new SkidMarks(this.scene, 360);
    this.rig = new CameraRig(this.camera, this.path);
    this.garage = new Garage(this.storage, this.audio, (c) => this.onGarageChange(c));

    this.state = 'menu';
    this.prevState = null;
    this.colors = {
      smoke: new THREE.Color('#5d6066'), dark: new THREE.Color('#2b2d31'), dust: new THREE.Color('#c9b48f'),
      spark: new THREE.Color('#ffd166'), boost: new THREE.Color('#9be7ff'), white: new THREE.Color('#ffffff'), charge: new THREE.Color('#7dffcf'),
    };
    this._v = new THREE.Vector3(); this._v2 = new THREE.Vector3();
    this.wheelL = new THREE.Vector3(-0.89, 0.02, 1.32);
    this.wheelR = new THREE.Vector3(0.89, 0.02, 1.32);
    this.frameStats = { acc: 0, n: 0, slow: 0, fast: 0 };

    this.applyCar();
    this.loadDestination(this.storage.get('destination'));
    this.bindUi();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.state === 'running') this.pause(); });
    this.enterMenu();
    $('loading').classList.add('hidden');
    this.last = performance.now();
    this.accum = 0;
    requestAnimationFrame((t) => this.tick(t));
  }

  // ---------------------------------------------------------------- setup
  applyCar() {
    this.player.applyUpgrades(this.storage.get('upgrades'));
    this.player.setPaint(this.storage.get('paint'));
  }

  loadDestination(id) {
    this.dest = destinationById(id);
    this.env.setDestination(this.dest);
  }

  buildWorld(seed) {
    this.seed = seed;
    this.path.reset(seed, this.dest);
    this.road.setDestination(this.dest, seed);
    this.road.reset();
    this.player.reset(30);
    this.traffic.reset(seed);
    this.pickups.reset(seed);
    this.particles.clear();
    this.skids.clear();
    this.road.update(this.player.s, true);
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // keep the horizontal view reasonable on tall phone screens
    this.rig.baseFov = w < h ? 78 : 64;
    this.camera.updateProjectionMatrix();
    this.particles.setViewport(h * this.pixelRatio);
  }

  bindUi() {
    const click = (id, fn, sound = 'click') => $(id).addEventListener('click', () => { this.audio.unlock(); this.audio.play(sound); fn(); });
    click('btn-drive', () => this.startRun());
    click('btn-garage', () => this.openGarage());
    click('btn-dests', () => { this.ui.show('dests'); this.garage.renderDestinations(); });
    click('btn-garage-back', () => this.backToMenu(), 'back');
    click('btn-dests-back', () => this.backToMenu(), 'back');
    click('btn-resume', () => this.resume());
    click('btn-restart', () => this.startRun());
    click('btn-quit', () => this.enterMenu(), 'back');
    click('btn-retry', () => this.startRun());
    click('btn-over-garage', () => this.openGarage());
    click('btn-over-menu', () => this.enterMenu(), 'back');
    click('btn-pause', () => this.pause());
    for (const id of ['btn-units', 'btn-units-p']) click(id, () => { this.storage.set('units', this.storage.get('units') === 'kmh' ? 'mph' : 'kmh'); this.refreshToggles(); });
    for (const id of ['btn-mute', 'btn-mute-p', 'btn-mute-hud']) click(id, () => this.toggleMute());
    // touch buttons
    const brake = $('touch-brake');
    const press = (e, down) => { e.preventDefault(); e.stopPropagation(); this.input.setBrakeTouch(down); brake.classList.toggle('active', down); };
    brake.addEventListener('touchstart', (e) => press(e, true), { passive: false });
    brake.addEventListener('touchend', (e) => press(e, false), { passive: false });
    brake.addEventListener('touchcancel', (e) => press(e, false), { passive: false });
    brake.addEventListener('mousedown', (e) => press(e, true));
    brake.addEventListener('mouseup', (e) => press(e, false));
    brake.addEventListener('mouseleave', () => { this.input.setBrakeTouch(false); brake.classList.remove('active'); });
    const boost = $('touch-boost');
    const boostPress = (e) => { e.preventDefault(); e.stopPropagation(); this.input.pressBoost(); };
    boost.addEventListener('touchstart', boostPress, { passive: false });
    boost.addEventListener('mousedown', boostPress);
    // keyboard shortcuts on menus
    window.addEventListener('keydown', (e) => {
      if (e.code !== 'Enter' || e.repeat) return;
      if (this.state === 'menu' && !this.ui.screens.start.classList.contains('hidden')) { this.audio.unlock(); this.startRun(); }
      else if (this.state === 'over') { this.audio.unlock(); this.startRun(); }
      else if (this.state === 'paused') this.resume();
    });
    // first gesture anywhere unlocks audio
    const unlock = () => this.audio.unlock();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    this.refreshToggles();
  }

  refreshToggles() {
    const units = this.storage.get('units') === 'mph' ? 'mph' : 'km/h';
    const muted = this.storage.get('muted');
    for (const id of ['btn-units', 'btn-units-p']) $(id).textContent = `Units: ${units}`;
    for (const id of ['btn-mute', 'btn-mute-p']) $(id).textContent = `Sound: ${muted ? 'off' : 'on'}`;
    $('btn-mute-hud').textContent = muted ? '🔇' : '🔊';
  }

  toggleMute() {
    const m = !this.storage.get('muted');
    this.storage.set('muted', m);
    this.audio.setMuted(m);
    this.refreshToggles();
  }

  onGarageChange(c) {
    if (c.upgrades) this.applyCar();
    if (c.paint) this.player.setPaint(c.paint);
    if (c.previewPaint) this.player.setPaint(c.previewPaint);
    if (c.destination) {
      this.loadDestination(c.destination);
      this.buildWorld(MENU_SEED);
    }
  }

  refreshStart() {
    const d = this.storage.data;
    $('start-dest').textContent = this.dest.name;
    $('start-best').textContent = this.storage.bestFor(this.dest.id).toLocaleString();
    $('start-coins').textContent = d.coins.toLocaleString();
  }

  // ---------------------------------------------------------------- states
  enterMenu() {
    this.state = 'menu';
    this.ui.setHudVisible(false);
    this.ui.setBoostFx(false);
    this.ui.setLaunch(false);
    this.ui.setZeroTimer('hide');
    this.player.setPaint(this.storage.get('paint'));
    this.buildWorld(MENU_SEED);
    this.refreshStart();
    this.ui.show('start');
  }

  backToMenu() {
    this.player.setPaint(this.storage.get('paint'));
    this.refreshStart();
    this.ui.show('start');
  }

  openGarage() {
    if (this.state !== 'menu') this.enterMenu();
    this.ui.show('garage');
    this.garage.renderGarage();
  }

  startRun() {
    this.applyCar();
    this.buildWorld((Math.random() * 1e9) | 0);
    this.state = 'prelaunch';
    this.run = { score: 0, mult: 1, combo: 0, coins: 0, closeCalls: 0, lastDist: 0, coinStreak: 0, coinStreakT: 0 };
    this.input.clearEdges();
    this.input.launchHeld = false;
    this.ui.show(null);
    this.ui.setHudVisible(true, this.isTouch);
    $('touch-hint').style.opacity = 1;
    this.ui.setZeroTimer('hide');
    this.rig.snap(this.player);
  }

  pause() {
    if (this.state !== 'running' && this.state !== 'prelaunch') return;
    this.prevState = this.state;
    this.state = 'paused';
    this.ui.show('pause');
    this.audio.drive({ active: false });
    this.ui.setBoostFx(false);
  }

  resume() {
    if (this.state !== 'paused') return;
    this.state = this.prevState || 'running';
    this.ui.show(null);
    this.input.clearEdges();
    this.last = performance.now();
  }

  gameOver(reason) {
    this.state = 'over';
    const r = this.run;
    const score = Math.floor(r.score);
    const d = this.storage.data;
    d.coins += r.coins;
    d.runs = (d.runs || 0) + 1;
    this.storage.save();
    const isBest = score > 0 && this.storage.submitScore(this.dest.id, score);
    $('over-title').textContent = reason;
    $('over-score').textContent = score.toLocaleString();
    $('over-dist').textContent = this.player.distance >= 1000 ? (this.player.distance / 1000).toFixed(2) + ' km' : Math.floor(this.player.distance) + ' m';
    $('over-coins').textContent = '+' + r.coins;
    $('over-close').textContent = r.closeCalls;
    $('over-best').textContent = this.storage.bestFor(this.dest.id).toLocaleString();
    $('new-best').classList.toggle('hidden', !isBest);
    this.ui.setHudVisible(false);
    this.ui.setBoostFx(false);
    this.ui.setZeroTimer('hide');
    this.audio.drive({ active: false });
    this.audio.play(isBest ? 'best' : 'gameover');
    setTimeout(() => { if (this.state === 'over') this.ui.show('over'); }, 250);
  }

  // ---------------------------------------------------------------- loop
  tick(now) {
    requestAnimationFrame((t) => this.tick(t));
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > 0.1) dt = 0.1;
    if (dt <= 0) return;
    this.adaptQuality(dt);

    if (this.input.takePause()) {
      if (this.state === 'running' || this.state === 'prelaunch') this.pause();
      else if (this.state === 'paused') this.resume();
    }

    const st = this.state;
    if (st === 'menu') {
      this.input.update(dt);
      this.player.place(dt);
      this.rig.updateMenu(dt, this.player);
      this.road.update(this.player.s);
    } else if (st === 'prelaunch') {
      this.input.update(dt);
      if (this.input.takeBoost()) this.player.launch(0.6);
      else this.player.updatePrelaunch(dt, this.input);
      this.ui.setLaunch(!this.player.launched, this.player.launchCharge, this.isTouch);
      if (this.player.launched) { this.input.clearEdges(); this.state = 'running'; }
      this.handlePlayerEvents();
      this.rig.update(dt, this.player, false);
    } else if (st === 'running' || st === 'crashing') {
      // fixed-size sub-steps keep collisions solid at high speed and low fps
      const n = Math.min(6, Math.ceil(dt / STEP));
      const h = dt / n;
      for (let i = 0; i < n && (this.state === 'running' || this.state === 'crashing'); i++) this.step(h);
      if (this.state === 'running' || this.state === 'crashing') this.rig.update(dt, this.player, this.player.boostTime > 0);
    } else if (st === 'over') {
      if (this.player.crashed) this.player.update(dt, this.input, this.player.distance);
      this.traffic.update(dt, this.player, this.player.distance);
      this.rig.update(dt, this.player, false);
    }

    this.particles.update(dt);
    this.env.update(this.camera, this.player.frame.y);
    if (this.state === 'running' || this.state === 'crashing' || this.state === 'prelaunch') this.updateHud();
    this.audio.drive({
      speed: this.player.speed,
      braking: this.player.braking,
      skid: this.state === 'running' ? this.player.skid : 0,
      boost: this.player.boostTime > 0,
      active: this.state === 'running' || this.state === 'crashing' || this.state === 'prelaunch',
      flat: this.player.battery <= 0,
    });
    this.renderer.render(this.scene, this.camera);
  }

  step(h) {
    const p = this.player, r = this.run;
    const input = this.input;
    input.update(h);
    if (this.state === 'running') {
      if (input.takeBoost() && p.boostMeter >= 1 && p.boostTime <= 0) { p.boostMeter = 0; p.startBoost(); }
    }
    const before = p.distance;
    p.update(h, input, p.distance);
    const zone = this.traffic.update(h, p, p.distance);
    this.road.update(p.s);
    this.handlePlayerEvents();
    if (this.state === 'running') {
      // score: distance x multiplier
      r.score += (p.distance - before) * r.mult;
      r.combo -= h;
      if (r.combo <= 0 && r.mult > 1) { r.mult = 1; r.combo = 0; }
      r.coinStreakT -= h;
      if (r.coinStreakT <= 0) r.coinStreak = 0;
      for (const e of this.pickups.update(h, p, p.distance, zone)) this.onPickup(e);
      for (const e of this.traffic.collide(p)) this.onTrafficEvent(e);
      if (p.flatTime > PLAYER.flatTimeout) { this.gameOver('Out of charge'); return; }
      this.emitDriveFx(h);
    } else if (this.state === 'crashing') {
      this.pickups.update(h, p, p.distance, null);
      this.crashTimer -= h;
      // smoke from the stricken car
      const m = p.mesh.position;
      if (Math.random() < 0.7) this.particles.emit(m.x + (Math.random() - 0.5), m.y + 0.8, m.z + (Math.random() - 0.5), (Math.random() - 0.5), 2 + Math.random() * 2, (Math.random() - 0.5), Math.random() < 0.5 ? this.colors.smoke : this.colors.dark, 0.8, 1.4, { grow: 1.6, alpha: 0.4 });
      if (this.crashTimer <= 0) {
        if (p.lives > 0) {
          p.lives--;
          this.traffic.clearAround(p.s, 140);
          p.revive();
          this.state = 'running';
          this.ui.popup('Extra life!', 'good big');
          this.input.clearEdges();
        } else this.gameOver('Crashed!');
      }
    }
  }

  handlePlayerEvents() {
    const p = this.player;
    for (const e of p.events) {
      switch (e.type) {
        case 'launch':
          this.audio.play('launch');
          this.ui.flash();
          this.rig.shake(0.25);
          this.ui.setLaunch(false);
          this.ui.setZeroTimer('run', 0);
          this.ui.popup(e.charge > 0.95 ? 'PERFECT LAUNCH' : 'GO!', 'big');
          this.dustBurst(14);
          setTimeout(() => { $('touch-hint').style.opacity = 0; }, 2500);
          break;
        case 'zeroToHundred': {
          const t = e.time;
          this.ui.setZeroTimer('done', t);
          setTimeout(() => this.ui.setZeroTimer('hide'), 2200);
          break;
        }
        case 'boost': this.audio.play('boost'); this.rig.shake(0.2); this.ui.popup('LUDICROUS!', 'close big'); break;
        case 'flat': this.audio.play('warn'); this.ui.popup('Battery flat!', 'bad big'); break;
        case 'rail':
          this.audio.play('rail');
          this.rig.shake(0.18);
          this.sparks(e.side);
          if (this.run && this.run.mult > 1) { this.run.mult = 1; this.run.combo = 0; }
          break;
        case 'hop': this.audio.play('hop'); break;
        case 'land': this.audio.play('land'); this.dustBurst(6); break;
        default: break;
      }
    }
    p.events.length = 0;
    if (p.launchTimer >= 0 && this.state !== 'prelaunch') this.ui.setZeroTimer('run', p.launchTimer);
  }

  addCombo(amount) {
    const r = this.run;
    r.mult = Math.min(SCORE.maxMultiplier, r.mult + amount);
    r.combo = SCORE.comboTime;
    const m = this.ui.el.mult.parentElement;
    m.classList.remove('pop'); void m.offsetWidth; m.classList.add('pop');
  }

  onPickup(e) {
    const p = this.player, r = this.run;
    switch (e.type) {
      case 'coin':
        r.coins++;
        r.coinStreak++;
        r.coinStreakT = 0.8;
        r.score += SCORE.coin * r.mult;
        if (r.mult > 1) r.combo = Math.min(SCORE.comboTime, r.combo + 0.5);
        p.boostMeter = Math.min(1, p.boostMeter + 0.025);
        this.audio.play('coin', r.coinStreak % 8);
        break;
      case 'charger':
        p.battery = Math.min(p.stats.capacity, p.battery + p.stats.capacity * 0.45);
        this.audio.play('charge');
        this.ui.popup('+45% ⚡', 'good');
        this.burst(this.colors.charge, 20);
        break;
      case 'ludicrous':
        p.startBoost();
        this.audio.play('power');
        break;
      case 'magnet':
        p.magnetTime = 8;
        this.audio.play('power');
        this.ui.popup('Coin magnet!', 'good');
        break;
      case 'shield':
        p.shieldTime = 10;
        this.audio.play('shield');
        this.ui.popup('Shield!', 'good');
        break;
      default: break;
    }
  }

  onTrafficEvent(e) {
    const p = this.player, r = this.run;
    if (this.state !== 'running') return;
    switch (e.type) {
      case 'closeCall': {
        r.closeCalls++;
        this.addCombo(1);
        const tight = Math.max(0, SCORE.closeCallGap - e.gap);
        const pts = Math.round(SCORE.closeCall * (1 + tight) * r.mult);
        r.score += pts;
        p.boostMeter = Math.min(1, p.boostMeter + 0.22);
        this.audio.play('closeCall', r.mult);
        this.ui.popup(`Close call! +${pts}`, 'close');
        break;
      }
      case 'cone':
        this.audio.play('cone');
        p.speed *= 0.9;
        this.rig.shake(0.12);
        if (r.mult > 1) { r.mult = 1; r.combo = 0; }
        break;
      case 'smash':
        this.audio.play('crash');
        this.rig.shake(0.3);
        if (p.invuln <= 0) { p.shieldTime = 0; p.invuln = 1; this.ui.popup('Shield used', 'bad'); }
        break;
      case 'crash':
        if (p.shieldTime > 0) {
          p.shieldTime = 0;
          p.invuln = 1.5;
          p.speed *= 0.7;
          this.audio.play('crash');
          this.rig.shake(0.35);
          this.ui.popup('Shield saved you!', 'good');
          if (!e.isCar) this.traffic.knock(e.target, p);
          return;
        }
        p.crash(e.dir);
        if (!e.isCar) this.traffic.knock(e.target, p);
        else e.target.speed *= 0.5;
        this.state = 'crashing';
        this.crashTimer = 1.7;
        this.audio.play('crash');
        this.rig.shake(0.9);
        this.ui.flash();
        this.ui.setBoostFx(false);
        this.burst(this.colors.spark, 26, true);
        for (let i = 0; i < 14; i++) this.smokePuff(0.9);
        break;
      default: break;
    }
  }

  // ---------------------------------------------------------------- fx helpers
  wheelWorld(local, out) {
    this.player.mesh.updateMatrixWorld();
    return out.copy(local).applyMatrix4(this.player.mesh.matrixWorld);
  }

  emitDriveFx(h) {
    const p = this.player, f = p.frame;
    const skid = p.skid;
    const wl = this.wheelWorld(this.wheelL, this._v), wr = this.wheelWorld(this.wheelR, this._v2);
    const on = skid > 0.28 && p.grounded;
    this.skids.add(0, wl.x, f.y + 0.03, wl.z, f.rx, f.rz, on ? skid : 0);
    this.skids.add(1, wr.x, f.y + 0.03, wr.z, f.rx, f.rz, on ? skid : 0);
    if (on && Math.random() < skid * 0.9) {
      const w = Math.random() < 0.5 ? wl : wr;
      const col = Math.abs(p.x) > ROAD.halfWidth ? this.colors.dust : this.colors.white;
      this.particles.emit(w.x, w.y + 0.2, w.z, (Math.random() - 0.5) * 2, 0.8 + Math.random(), (Math.random() - 0.5) * 2, col, 0.8, 0.9, { grow: 2.4, alpha: 0.45 });
    }
    // shoulder dust when driving off the asphalt
    if (Math.abs(p.x) > ROAD.halfWidth + 0.4 && p.grounded && Math.random() < 0.5) {
      const w = p.x > 0 ? wr : wl;
      this.particles.emit(w.x, w.y + 0.2, w.z, 0, 0.6, 0, this.colors.dust, 0.7, 0.8, { grow: 2, alpha: 0.4 });
    }
    // boost exhaust shimmer
    if (p.boostTime > 0 && Math.random() < 0.6) {
      const m = p.mesh.position;
      const side = Math.random() < 0.5 ? -0.6 : 0.6;
      this.particles.emit(m.x - f.tx * 2.2 + f.rx * side, m.y + 0.35, m.z - f.tz * 2.2 + f.rz * side, 0, 0.2, 0, this.colors.boost, 0.16, 0.25, { grow: -0.3, alpha: 0.7 });
    }
    this.ui.setBoostFx(p.boostTime > 0);
  }

  dustBurst(n) {
    const wl = this.wheelWorld(this.wheelL, this._v);
    const wr = this.wheelWorld(this.wheelR, this._v2);
    for (let i = 0; i < n; i++) {
      const w = i % 2 ? wl : wr;
      this.particles.emit(w.x, w.y + 0.15, w.z, (Math.random() - 0.5) * 3, Math.random() * 1.5, (Math.random() - 0.5) * 3, this.colors.white, 0.9, 1.0, { grow: 2.5, alpha: 0.45 });
    }
  }

  sparks(side) {
    const p = this.player, f = p.frame, m = p.mesh.position;
    for (let i = 0; i < 10; i++) {
      this.particles.emit(m.x + f.rx * side, m.y + 0.5, m.z + f.rz * side, f.tx * p.speed * 0.3 + (Math.random() - 0.5) * 3, 2 + Math.random() * 3, f.tz * p.speed * 0.3 + (Math.random() - 0.5) * 3, this.colors.spark, 0.25, 0.4, { grow: -0.3, alpha: 1, gravity: 9, drag: 0.5 });
    }
  }

  burst(color, n, gravity = false) {
    const m = this.player.mesh.position;
    for (let i = 0; i < n; i++) {
      this.particles.emit(m.x, m.y + 0.8, m.z, (Math.random() - 0.5) * 9, Math.random() * 6, (Math.random() - 0.5) * 9, color, 0.35, 0.6, { grow: -0.2, alpha: 1, gravity: gravity ? 12 : 0, drag: 1 });
    }
  }

  smokePuff(size) {
    const m = this.player.mesh.position;
    this.particles.emit(m.x + (Math.random() - 0.5) * 2, m.y + 0.5, m.z + (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 3, 1 + Math.random() * 2, (Math.random() - 0.5) * 3, Math.random() < 0.5 ? this.colors.smoke : this.colors.dark, size, 1.6, { grow: 1.8, alpha: 0.45 });
  }

  updateHud() {
    const p = this.player, r = this.run;
    this.ui.updateHud({
      score: r.score, mult: r.mult, comboPct: r.mult > 1 ? r.combo / SCORE.comboTime : 0,
      distance: p.distance, coins: r.coins, lives: p.lives, speed: p.speed, units: this.storage.get('units'),
      battery: p.batteryPct, regen: p.braking && p.speed > PLAYER.minSpeed + 0.5, boostMeter: p.boostMeter,
      boostTime: Math.max(0, p.boostTime), boostMax: p.stats.boostDuration, magnetTime: Math.max(0, p.magnetTime), shieldTime: Math.max(0, p.shieldTime),
      flatTime: p.flatTime, flatLeft: PLAYER.flatTimeout - p.flatTime,
    });
  }

  // dynamic resolution: drop pixel ratio when frames are slow, restore when fast
  adaptQuality(dt) {
    const s = this.frameStats;
    s.acc += dt; s.n++;
    if (s.acc < 2) return;
    const avg = s.acc / s.n;
    s.acc = 0; s.n = 0;
    let pr = this.pixelRatio;
    if (avg > 1 / 48 && pr > 0.75) pr = Math.max(0.75, pr - 0.25);
    else if (avg < 1 / 58 && pr < this.maxPixelRatio) pr = Math.min(this.maxPixelRatio, pr + 0.25);
    if (pr !== this.pixelRatio) {
      this.pixelRatio = pr;
      this.renderer.setPixelRatio(pr);
      this.resize();
    }
  }
}
