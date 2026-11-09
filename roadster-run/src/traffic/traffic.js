import * as THREE from 'three';
import { ROAD, PLAYER, SCORE, laneX, difficultyAt } from '../game/config.js';
import { Pool } from '../core/pool.js';
import { clamp, smoothstep, createRng } from '../core/rng.js';
import { trafficTypes, TRAFFIC_COLORS, obstacleTypes } from './models.js';
import { makeBlobShadow } from '../vehicle/carModel.js';

const LANES = ROAD.lanes;
const SIGNAL_TIME = 0.75;
const CHANGE_TIME = 1.9;

// Traffic cars with realistic lane changes, plus static obstacles.
// Invariant: at any stretch of road at least one lane stays passable.
export class Traffic {
  constructor(scene, path) {
    this.scene = scene;
    this.path = path;
    this.types = trafficTypes();
    this.obst = obstacleTypes();
    this.frame = { x: 0, y: 0, z: 0, tx: 0, ty: 0, tz: -1, rx: 1, rz: 0, k: 0, heading: 0, pitch: 0 };
    this._e = new THREE.Euler(0, 0, 0, 'YXZ');
    const sigMat = new THREE.MeshBasicMaterial({ color: '#ffb000' });
    const sigGeo = new THREE.BoxGeometry(0.2, 0.14, 0.06);
    const detailMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
    this.cars = new Pool(() => {
      const g = new THREE.Group();
      const bodyMat = new THREE.MeshLambertMaterial({ color: '#ffffff', flatShading: true });
      const body = new THREE.Mesh(this.types[0].body, bodyMat);
      const detail = new THREE.Mesh(this.types[0].detail, detailMat);
      const sigL = new THREE.Mesh(sigGeo, sigMat), sigR = new THREE.Mesh(sigGeo, sigMat);
      const shadow = makeBlobShadow(2.6, 5);
      g.add(body, detail, sigL, sigR, shadow);
      g.visible = false;
      scene.add(g);
      return { group: g, body, detail, sigL, sigR, shadow, bodyMat };
    }, 18);
    const obstMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
    const lampMat = new THREE.MeshBasicMaterial({ color: '#ffcc00' });
    const lampGeo = new THREE.SphereGeometry(0.11, 6, 4);
    this.obstacles = new Pool(() => {
      const g = new THREE.Group();
      const mesh = new THREE.Mesh(this.obst.cone.geo, obstMat);
      const lampA = new THREE.Mesh(lampGeo, lampMat), lampB = new THREE.Mesh(lampGeo, lampMat);
      lampA.position.set(-1.45, 1.22, 0); lampB.position.set(1.45, 1.22, 0);
      g.add(mesh, lampA, lampB);
      g.visible = false;
      scene.add(g);
      return { group: g, mesh, lampA, lampB, vel: new THREE.Vector3(), spinV: 0 };
    }, 48);
    this.reset(1);
  }

  reset(seed) {
    this.rng = createRng(seed * 7 + 3);
    this.cars.releaseAll();
    this.obstacles.releaseAll();
    this.cars.items.forEach((c) => (c.group.visible = false));
    this.obstacles.items.forEach((o) => (o.group.visible = false));
    this.nextCarAt = 140;
    this.nextZoneAt = 520;
    this.zones = [];
    this.time = 0;
    this.events = [];
  }

  // ---------- occupancy helpers ----------
  // does anything occupy `lane` within [s0, s1]?  (ignores `skip`)
  laneBlocked(lane, s0, s1, skip = null, carsOnly = false) {
    const cars = this.cars.items;
    for (let i = 0; i < cars.length; i++) {
      const c = cars[i];
      if (!c.active || c === skip) continue;
      if (c.lane !== lane && c.targetLane !== lane) continue;
      if (c.s + c.type.halfL >= s0 && c.s - c.type.halfL <= s1) return c;
    }
    if (carsOnly) return null;
    const ob = this.obstacles.items;
    for (let i = 0; i < ob.length; i++) {
      const o = ob[i];
      if (!o.active || o.knocked || o.lane !== lane) continue;
      if (o.s + o.type.halfL >= s0 && o.s - o.type.halfL <= s1) return o;
    }
    return null;
  }

  obstacleAhead(lane, s0, s1) {
    const ob = this.obstacles.items;
    let best = null;
    for (let i = 0; i < ob.length; i++) {
      const o = ob[i];
      if (!o.active || o.knocked || o.lane !== lane) continue;
      if (o.s >= s0 && o.s <= s1 && (!best || o.s < best.s)) best = o;
    }
    return best;
  }

  // would occupying `lanes` (a set via mask) at s seal the road?
  wouldSeal(mask, s, w, skip) {
    for (let l = 0; l < LANES; l++) {
      if (mask & (1 << l)) continue;
      if (!this.laneBlocked(l, s - w, s + w, skip)) return false;
    }
    return true;
  }

  sealWindow(playerSpeed) { return Math.max(20, playerSpeed * 0.62); }

  // ---------- spawning ----------
  spawnCar(s, playerSpeed) {
    const w = this.sealWindow(playerSpeed);
    const order = [0, 1, 2].sort(() => this.rng.next() - 0.5);
    for (const lane of order) {
      if (this.laneBlocked(lane, s - 28, s + 28)) continue;
      if (this.obstacleAhead(lane, s - 20, s + 70)) continue;
      if (this.wouldSeal(1 << lane, s, w, null)) continue;
      const c = this.cars.acquire();
      if (!c) return;
      const r = this.rng;
      let tot = 0; for (const t of this.types) tot += t.weight;
      let pick = r.next() * tot, type = this.types[0];
      for (const t of this.types) { pick -= t.weight; if (pick <= 0) { type = t; break; } }
      c.type = type;
      c.body.geometry = type.body;
      c.detail.geometry = type.detail;
      c.bodyMat.color.set(type.kind === 'truck' ? r.pick(['#f1f3f5', '#d62828', '#1d3557', '#2a9d8f']) : r.pick(TRAFFIC_COLORS));
      c.sigL.position.set(-type.halfW + 0.12, type.indicatorY, type.indicatorZ);
      c.sigR.position.set(type.halfW - 0.12, type.indicatorY, type.indicatorZ);
      c.shadow.scale.set(type.halfW / 1.25, type.halfL / 2.4, 1);
      c.s = s; c.lane = lane; c.targetLane = lane; c.x = laneX(lane);
      c.fromX = c.x; c.laneT = 1; c.signal = 0; c.signalTime = 0;
      c.desired = r.range(type.speed[0], type.speed[1]);
      c.speed = c.desired;
      c.decideTimer = r.range(1, 4);
      c.passed = false; c.minGap = 99; c.alongside = false;
      c.group.visible = true;
      return;
    }
  }

  spawnZone(s, playerSpeed) {
    const r = this.rng;
    const lane = r.int(0, LANES - 1);
    // never add a static block if it would seal the road with what is already there
    if (this.wouldSeal(1 << lane, s + 15, 45, null)) return false;
    const pattern = r.pick(['cones', 'cones', 'barrels', 'roadblock', 'barrels']);
    const lx = laneX(lane);
    const half = ROAD.laneWidth / 2;
    if (pattern === 'cones') {
      // taper from the outer edge across to the inner lane line, then a line of cones
      const out = lane === 0 ? -1 : lane === 2 ? 1 : (r.chance(0.5) ? 1 : -1);
      for (let i = 0; i < 4; i++) this._addObstacle('cone', lane, s + i * 5, lx + out * 0.85 * half - out * (i / 3) * 1.7 * half);
      for (let i = 0; i < 5; i++) this._addObstacle('cone', lane, s + 21 + i * 6, lx - out * 0.85 * half);
    } else if (pattern === 'barrels') {
      this._addObstacle('barrel', lane, s, lx - 0.95);
      this._addObstacle('barrel', lane, s, lx + 0.95);
      this._addObstacle('barrel', lane, s + 1.4, lx);
      this._addObstacle('cone', lane, s - 9, lx);
    } else {
      this._addObstacle('cone', lane, s - 14, lx - 1);
      this._addObstacle('cone', lane, s - 10, lx);
      this._addObstacle('cone', lane, s - 6, lx + 1);
      this._addObstacle('roadblock', lane, s, lx);
    }
    const zone = { lane, s0: s - 15, s1: s + (pattern === 'cones' ? 50 : 4), pattern };
    if (this.zones.length > 12) this.zones.shift();
    this.zones.push(zone);
    return zone;
  }

  // Around each obstacle zone, if cars occupy both open lanes, the rear-most one
  // waits so the zone is never walled off.
  _zoneYield(w, ps) {
    const cars = this.cars.items;
    for (let z = this.zones.length - 1; z >= 0; z--) {
      const zone = this.zones[z];
      if (zone.s1 < ps - 60) { this.zones.splice(z, 1); continue; }
      const a = zone.s0 - w - 30, b = zone.s1 + w;
      let rear = null, lanesMask = 0;
      for (let i = 0; i < cars.length; i++) {
        const c = cars[i];
        if (!c.active || c.s < a || c.s > b) continue;
        const m = ((1 << c.lane) | (1 << c.targetLane)) & ~(1 << zone.lane);
        if (!m) continue;
        lanesMask |= m;
        if (!rear || c.s < rear.s) rear = c;
      }
      const open = ((1 << LANES) - 1) & ~(1 << zone.lane);
      if ((lanesMask & open) === open && rear) rear.zoneYield = true;
    }
  }

  _addObstacle(kind, lane, s, x) {
    const o = this.obstacles.acquire();
    if (!o) return;
    const t = this.obst[kind];
    o.kind = kind; o.type = t; o.lane = lane; o.s = s; o.x = x;
    o.knocked = false; o.knockT = 0;
    o.mesh.geometry = t.geo;
    o.lampA.visible = o.lampB.visible = kind === 'roadblock';
    const f = this.frame;
    this.path.sample(s, f);
    o.group.position.set(f.x + f.rx * x, f.y, f.z + f.rz * x);
    o.group.rotation.set(0, -f.heading, 0);
    o.group.visible = true;
  }

  // ---------- update ----------
  update(dt, player, runDistance, difficultyScale = 1) {
    this.time += dt;
    const ps = player.s;
    const d = difficultyAt(runDistance) * difficultyScale;
    const w = this.sealWindow(player.speed);

    // spawn cars ahead, beyond the fog line
    if (player.launched && ps + 330 > this.nextCarAt) {
      if (this.nextCarAt < ps + 300) this.nextCarAt = ps + 330;
      this.spawnCar(this.nextCarAt, player.speed);
      const gap = (95 - 58 * d) * this.rng.range(0.65, 1.35);
      this.nextCarAt += gap;
    }
    let zone = null;
    if (player.launched && ps + 360 > this.nextZoneAt) {
      zone = this.spawnZone(this.nextZoneAt, player.speed);
      this.nextZoneAt += (430 - 250 * d) * this.rng.range(0.75, 1.25);
    }

    // cars: AI
    this._zoneYield(w, ps);
    const cars = this.cars.items;
    for (let i = 0; i < cars.length; i++) {
      const c = cars[i];
      if (!c.active) continue;
      this._driveCar(c, dt, player, w);
    }
    for (let i = 0; i < cars.length; i++) {
      const c = cars[i];
      if (!c.active) continue;
      if (c.s < ps - 45 || c.s > ps + 700) { c.group.visible = false; this.cars.release(c); continue; }
      this._placeCar(c);
    }

    // obstacles
    const ob = this.obstacles.items;
    const blink = Math.floor(this.time * 3) % 2 === 0;
    for (let i = 0; i < ob.length; i++) {
      const o = ob[i];
      if (!o.active) continue;
      if (o.s < ps - 40) { o.group.visible = false; this.obstacles.release(o); continue; }
      if (o.kind === 'roadblock') { o.lampA.visible = blink; o.lampB.visible = !blink; }
      if (o.knocked) {
        o.knockT += dt;
        o.vel.y -= 20 * dt;
        o.group.position.addScaledVector(o.vel, dt);
        o.group.rotation.x += o.spinV * dt;
        o.group.rotation.z += o.spinV * 0.6 * dt;
        if (o.knockT > 2) { o.group.visible = false; this.obstacles.release(o); }
      }
    }
    return zone;
  }

  _driveCar(c, dt, player, w) {
    const r = this.rng;
    const ahead = 12 + c.speed * 0.9;
    // follow the car in front (in current or target lane)
    let leader = null, leaderGap = 1e9;
    const cars = this.cars.items;
    for (let j = 0; j < cars.length; j++) {
      const o = cars[j];
      if (!o.active || o === c) continue;
      if (o.lane !== c.lane && o.targetLane !== c.lane && o.lane !== c.targetLane) continue;
      const gap = o.s - o.type.halfL - (c.s + c.type.halfL);
      if (gap > -0.5 && gap < leaderGap) { leaderGap = gap; leader = o; }
    }
    let target = c.desired;
    if (leader && leaderGap < ahead) {
      target = Math.min(target, leader.speed - (ahead - leaderGap) * 0.25);
    }
    const obstacle = this.obstacleAhead(c.lane, c.s, c.s + 75);
    const obstacleGap = obstacle ? obstacle.s - c.s - c.type.halfL - 2 : 1e9;
    if (obstacle && c.laneT >= 1) target = Math.min(target, Math.max(0, obstacleGap * 0.35));

    // anti-seal: if every other lane is blocked around this car, the rear-most
    // *moving* car drops back and the front one pulls away. Static obstacles never
    // move, so they are never the ones asked to resolve it.
    const mask = (1 << c.lane) | (1 << c.targetLane);
    let sealed = true, behindMover = false;
    for (let l = 0; l < LANES; l++) {
      if (mask & (1 << l)) continue;
      const b = this.laneBlocked(l, c.s - w, c.s + w, c);
      if (!b) { sealed = false; break; }
      if (b.speed !== undefined && b.speed > 2 && b.s > c.s) behindMover = true;
    }
    if (c.zoneYield || (sealed && behindMover)) target = Math.min(target, c.desired * 0.45);
    else if (sealed && !obstacle) target = Math.max(target, c.desired + 5);
    c.zoneYield = false;

    const acc = target > c.speed ? 3.5 : 7;
    c.speed += clamp(target - c.speed, -acc * dt, acc * dt);
    if (c.speed < 0) c.speed = 0;
    c.s += c.speed * dt;

    // lane change state machine
    if (c.signal !== 0) {
      c.signalTime += dt;
      if (c.laneT >= 1 && c.signalTime > SIGNAL_TIME) {
        // re-check right before committing
        const nl = c.lane + c.signal;
        if (this._laneChangeOk(c, nl, player, w)) {
          c.fromX = c.x; c.targetLane = nl; c.laneT = 0;
        } else { c.signal = 0; c.decideTimer = r.range(0.5, 1.5); }
      }
      if (c.laneT < 1) {
        c.laneT = Math.min(1, c.laneT + dt / CHANGE_TIME);
        c.x = c.fromX + (laneX(c.targetLane) - c.fromX) * smoothstep(c.laneT);
        if (c.laneT >= 1) { c.lane = c.targetLane; c.signal = 0; c.decideTimer = r.range(2, 5); }
      }
      return;
    }
    c.decideTimer -= dt;
    const blockedBySlow = leader && leaderGap < 30 && leader.speed < c.desired - 2;
    const needsOut = obstacle && obstacleGap < 70;
    const whim = c.decideTimer <= 0 && r.chance(0.18);
    if (c.decideTimer <= 0 || needsOut) {
      c.decideTimer = r.range(0.6, 1.4);
      if (blockedBySlow || needsOut || whim) {
        const opts = [c.lane - 1, c.lane + 1].filter((l) => l >= 0 && l < LANES);
        if (r.chance(0.5)) opts.reverse();
        for (const nl of opts) {
          if (this._laneChangeOk(c, nl, player, w, needsOut)) { c.signal = nl - c.lane; c.signalTime = 0; break; }
        }
      }
    }
  }

  _laneChangeOk(c, nl, player, w, forced = false) {
    if (nl < 0 || nl >= LANES) return false;
    if (this.laneBlocked(nl, c.s - 14, c.s + 20, c, true)) return false;
    if (this.obstacleAhead(nl, c.s - 10, c.s + 55)) return false;
    // be courteous: don't cut in close in front of the player unless forced
    const rel = c.s - player.s;
    if (!forced && rel > -10 && rel < 70) return false;
    if (forced && rel > -5 && rel < 28) return false;
    const mask = (1 << c.lane) | (1 << nl);
    if (this.wouldSeal(mask, c.s, w, c)) return false;
    return true;
  }

  _placeCar(c) {
    const f = this.frame;
    this.path.sample(c.s, f);
    const g = c.group;
    g.position.set(f.x + f.rx * c.x, f.y, f.z + f.rz * c.x);
    let yaw = 0;
    if (c.laneT < 1) {
      const dx = (laneX(c.targetLane) - c.fromX) * 6 * c.laneT * (1 - c.laneT) / CHANGE_TIME;
      yaw = Math.atan2(dx, Math.max(4, c.speed));
    }
    this._e.set(f.pitch, -f.heading - yaw, 0, 'YXZ');
    g.quaternion.setFromEuler(this._e);
    const on = c.signal !== 0 && Math.floor(this.time * 3.2) % 2 === 0;
    c.sigL.visible = on && c.signal < 0;
    c.sigR.visible = on && c.signal > 0;
  }

  // ---------- collisions ----------
  // Returns { type:'crash'|'cone'|'closeCall', ... } events into this.events
  collide(player) {
    const ev = this.events;
    ev.length = 0;
    if (player.crashed) return ev;
    const pHL = PLAYER.halfLength, pHW = PLAYER.halfWidth;
    const cars = this.cars.items;
    for (let i = 0; i < cars.length; i++) {
      const c = cars[i];
      if (!c.active) continue;
      const ds = c.s - player.s;
      const overlapS = Math.abs(ds) < c.type.halfL + pHL;
      const lat = Math.abs(c.x - player.x) - (c.type.halfW + pHW);
      if (overlapS) {
        if (lat < -0.05 && player.y < c.type.height - 0.15 && player.invuln <= 0) {
          ev.push({ type: 'crash', target: c, dir: Math.sign(player.x - c.x) || 1, isCar: true });
          continue;
        }
        if (lat < c.minGap) c.minGap = lat;
        c.alongside = true;
      } else if (c.alongside && ds < 0 && !c.passed) {
        c.passed = true;
        if (c.minGap < SCORE.closeCallGap && player.speed > c.speed + 4) ev.push({ type: 'closeCall', target: c, gap: c.minGap });
      }
      if (ds > c.type.halfL + pHL) { c.alongside = false; c.minGap = 99; }
    }
    const ob = this.obstacles.items;
    for (let i = 0; i < ob.length; i++) {
      const o = ob[i];
      if (!o.active || o.knocked) continue;
      if (Math.abs(o.s - player.s) > o.type.halfL + pHL) continue;
      if (Math.abs(o.x - player.x) > o.type.halfW + pHW - 0.05) continue;
      if (player.y > o.type.height - 0.05) continue;
      if (o.type.soft || player.shieldTime > 0 || player.invuln > 0) {
        this.knock(o, player);
        ev.push({ type: o.type.soft ? 'cone' : 'smash', target: o });
      } else {
        ev.push({ type: 'crash', target: o, dir: Math.sign(player.x - o.x) || 1, isCar: false });
      }
    }
    return ev;
  }

  knock(o, player) {
    o.knocked = true; o.knockT = 0;
    const f = this.frame;
    this.path.sample(o.s, f);
    const side = Math.sign(o.x - player.x) || 1;
    o.vel.set(f.tx * player.speed * 0.6 + f.rx * side * 6, 6 + Math.random() * 3, f.tz * player.speed * 0.6 + f.rz * side * 6);
    o.spinV = 8 + Math.random() * 6;
  }

  // clear the road just ahead after a revive
  clearAround(s, ahead) {
    this.cars.forEachActive((c) => { if (c.s > s - 20 && c.s < s + ahead) { c.group.visible = false; this.cars.release(c); } });
    this.obstacles.forEachActive((o) => { if (o.s > s - 20 && o.s < s + ahead) { o.group.visible = false; this.obstacles.release(o); } });
  }
}
