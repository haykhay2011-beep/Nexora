// Obstacles, hazards, ramps and the procedural "layout director" that decides
// what appears ahead of the player.
//
// The director works in rows. Every row has one guaranteed-safe lane; the safe
// lane random-walks one lane at a time and rows are spaced so a lane change is
// always possible in between. Slow cars open a "convoy window" in which solid
// rows are restricted so the lane the car occupies never combines with a
// blocked lane to seal the road.
import * as THREE from 'three';
import { LANE_CENTERS } from './config.js';
import { PartBuilder, flatMaterial } from './models.js';
import { RNG } from './rng.js';
import { TRAFFIC } from './armenianCars.js';

const ORANGE = 0xff7a1a;

function coneGeo() {
  const b = new PartBuilder();
  b.box(0.55, 0.06, 0.55, 0x2d2f36, [0, 0.03, 0]);
  b.cone(0.22, 0.72, 8, ORANGE, [0, 0.42, 0]);
  b.cyl(0.105, 0.14, 0.11, 8, 0xffffff, [0, 0.42, 0]);
  return b.build();
}

function barrelGeo() {
  const b = new PartBuilder();
  b.cyl(0.45, 0.45, 1.0, 10, 0xd1432f, [0, 0.5, 0]);
  b.cyl(0.47, 0.47, 0.09, 10, 0xf0d9a6, [0, 0.27, 0]);
  b.cyl(0.47, 0.47, 0.09, 10, 0xf0d9a6, [0, 0.74, 0]);
  b.cyl(0.38, 0.38, 0.04, 10, 0x2d2f36, [0, 1.01, 0]);
  return b.build();
}

function roadblockGeo() {
  const b = new PartBuilder();
  b.box(0.14, 1.2, 0.6, 0x4b4e57, [1.65, 0.6, 0]);
  b.box(0.14, 1.2, 0.6, 0x4b4e57, [-1.65, 0.6, 0]);
  for (let i = 0; i < 9; i++) {
    const col = i % 2 ? 0xe03a2f : 0xffffff;
    b.box(0.4, 0.34, 0.14, col, [-1.8 + i * 0.4 + 0.2, 1.3, 0]);
    b.box(0.4, 0.34, 0.14, i % 2 ? 0xffffff : 0xe03a2f, [-1.8 + i * 0.4 + 0.2, 0.85, 0]);
  }
  b.box(0.3, 0.14, 0.2, 0xffc21a, [1.65, 1.27, 0]);
  b.box(0.3, 0.14, 0.2, 0xffc21a, [-1.65, 1.27, 0]);
  return b.build();
}

function potholeGeo() {
  const b = new PartBuilder();
  b.cyl(1.15, 1.15, 0.03, 10, 0x37383e, [0, 0.03, 0]);
  b.cyl(0.9, 0.9, 0.03, 10, 0x131417, [0.05, 0.05, 0.05]);
  b.cyl(0.55, 0.55, 0.03, 8, 0x0a0a0c, [-0.1, 0.07, -0.05]);
  const g = b.build();
  g.scale(1.1, 1, 0.9);
  return g;
}

function oilGeo() {
  const b = new PartBuilder();
  b.cyl(1.6, 1.6, 0.03, 12, 0x181624, [0, 0.03, 0]);
  b.cyl(1.2, 1.2, 0.03, 10, 0x2a2350, [0.2, 0.05, 0.1]);
  b.cyl(0.8, 0.8, 0.03, 8, 0x1f5c66, [-0.2, 0.07, -0.1]);
  b.cyl(0.45, 0.45, 0.03, 8, 0x6a2f86, [0.3, 0.09, -0.2]);
  const g = b.build();
  g.scale(1, 1, 0.85);
  return g;
}

// How many times busier the road is than the original tuning.
const TRAFFIC_DENSITY = 12;

const RAMP_L = 11;
const RAMP_W = 4.2;
const RAMP_H = 2.5;

function rampGeo() {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(RAMP_L, 0);
  shape.lineTo(RAMP_L, RAMP_H);
  shape.closePath();
  const ex = new THREE.ExtrudeGeometry(shape, { depth: RAMP_W, bevelEnabled: false });
  ex.rotateY(Math.PI / 2);
  ex.translate(-RAMP_W / 2, 0, RAMP_L / 2);
  const b = new PartBuilder();
  b.add(ex, 0xe4a43a);
  const ang = Math.atan2(RAMP_H, RAMP_L);
  const len = Math.hypot(RAMP_L, RAMP_H);
  for (let i = 0; i < 5; i++) {
    const u = (i + 0.5) / 5; // along the slope from the start
    const z = RAMP_L / 2 - u * RAMP_L;
    const y = u * RAMP_H + 0.03;
    b.box(RAMP_W * 0.92, 0.04, len / 12, i % 2 ? 0xffffff : 0x2b2b30, [0, y, z], [ang, 0, 0]);
  }
  b.box(0.12, 0.3, RAMP_L * 0.97, 0xb77d22, [RAMP_W / 2 - 0.06, RAMP_H * 0.1, 0], [0, 0, 0]);
  return b.build();
}

const TYPES = {
  cone: { geo: coneGeo, count: 40, hl: 0.4, hw: 0.4, h: 0.75, solid: true, crush: true },
  barrel: { geo: barrelGeo, count: 28, hl: 0.5, hw: 0.5, h: 1.05, solid: true, crush: true },
  roadblock: { geo: roadblockGeo, count: 14, hl: 0.4, hw: 1.8, h: 1.5, solid: true },
  pothole: { geo: potholeGeo, count: 20, hl: 1.0, hw: 0.95, h: 0, hazard: true },
  oil: { geo: oilGeo, count: 14, hl: 1.5, hw: 1.4, h: 0, hazard: true },
  ramp: { geo: rampGeo, count: 5, hl: RAMP_L / 2, hw: RAMP_W / 2, h: 0, ramp: true },
};

// every traffic variant becomes its own pooled type, e.g. niva0, vaz2, marsh1
for (const [family, f] of Object.entries(TRAFFIC)) {
  f.variants.forEach((geo, i) => {
    const pool = family === 'marsh' ? 6 : family === 'niva' || family === 'vaz' ? 9 : 5;
    TYPES[family + i] = { geo, count: pool, hl: f.hl, hw: f.hw, h: f.h, solid: true, car: true, family };
  });
}

const _p = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _qy = new THREE.Quaternion();
const _up = new THREE.Vector3(0, 1, 0);
const _f = {};

export class Obstacles {
  constructor(scene, road, collectibles, fx) {
    this.scene = scene;
    this.road = road;
    this.path = road.path;
    this.collectibles = collectibles;
    this.fx = fx;
    this.rng = new RNG(1);
    this.pools = {};
    for (const [name, t] of Object.entries(TYPES)) {
      const geo = t.geo();
      const free = [];
      for (let i = 0; i < t.count; i++) {
        const m = new THREE.Mesh(geo, flatMaterial);
        m.visible = false;
        m.matrixAutoUpdate = true;
        scene.add(m);
        free.push(m);
      }
      this.pools[name] = free;
    }
    this.items = [];
    this.reset(1);
  }

  reset(seed, startS = 0) {
    for (const o of this.items) this._free(o);
    this.items.length = 0;
    this.rng.seed(seed ^ 0x51ed270b);
    this.nextS = startS + 140;
    this.safe = 1;
    this.t = 0;
    this.diff = 0;
    this.nextRampS = startS + 330;
    this.nextNitroS = startS + 520;
    this.nextBoxS = startS + 300;
    this.trafficNextS = startS + 120;
    this.noStatic = false; // No Hesi mode: traffic only
    this.trafficDensity = TRAFFIC_DENSITY;
    this.trafficScale = 1; // set by the game from the car-speed setting
    this.reserveEnd = -1;
  }

  _free(o) {
    o.mesh.visible = false;
    this.pools[o.poolName].push(o.mesh);
  }

  _spawn(type, s, d, extra) {
    const spec = TYPES[type];
    const pool = this.pools[type];
    const mesh = pool.pop();
    if (!mesh) return null;
    const o = {
      type, poolName: type, spec, mesh, s, d,
      hl: spec.hl, hw: spec.hw, h: spec.h,
      solid: !!spec.solid, crush: !!spec.crush, hazard: !!spec.hazard, ramp: !!spec.ramp, car: !!spec.car,
      dead: false, fly: null, vs: 0, hit: false,
    };
    if (extra) Object.assign(o, extra);
    mesh.visible = true;
    mesh.scale.set(1, 1, 1);
    this._place(o);
    this.items.push(o);
    return o;
  }

  _place(o) {
    this.path.point(o.s, o.d, o.type === 'ramp' ? 0 : 0.0, o.mesh.position);
    this.path.basis(o.s, _q);
    if (o.yawJitter) {
      _qy.setFromAxisAngle(_up, o.yawJitter);
      _q.multiply(_qy);
    }
    o.mesh.quaternion.copy(_q);
  }

  // Height of drivable surface (ramps) at road position (s, d).
  groundAt(s, d) {
    for (const o of this.items) {
      if (!o.ramp) continue;
      const u = (s - (o.s - o.hl)) / (o.hl * 2);
      if (u >= 0 && u <= 1 && Math.abs(d - o.d) < o.hw + 0.1) return u * RAMP_H;
    }
    return 0;
  }

  // ------------------------------------------------------------ director
  difficulty(t) {
    return 1 - Math.exp(-t / 95);
  }

  _laneD(l) {
    return LANE_CENTERS[l];
  }

  _walk(safe, allowed) {
    const r = this.rng;
    let n = safe;
    if (r.chance(0.6)) n = safe + (r.chance(0.5) ? -1 : 1);
    n = Math.min(2, Math.max(0, n));
    if (allowed && !allowed.includes(n)) n = allowed.includes(safe) ? safe : allowed[0];
    return n;
  }

  _straight(s0, s1) {
    return this.path.maxCurvature(s0, s1) < 0.0055;
  }

  generate(playerS, t, speedRef) {
    const horizon = playerS + 330;
    this.t = t;
    this.diff = this.difficulty(t);
    while (this.nextS < horizon) this._row(this.nextS, speedRef);
    while (this.trafficNextS < horizon + 20) this._traffic(this.trafficNextS);
  }

  _laneOf(d) {
    return Math.min(2, Math.max(0, Math.round(d / LANE_CENTERS[2]) + 1));
  }

  // A wave of one or two vehicles cruising at different speeds, never three abreast.
  _traffic(s) {
    const r = this.rng;
    const diff = this.diff;
    // eases from 1.5x to the full density over the first ~40 s of a run
    const d = this.trafficDensity;
    const density = d <= 1.5 ? d : Math.min(d, 1.5 + ((d - 1.5) * this.t) / 40);
    if (this.trafficDensity <= 0) {
      this.trafficNextS = s + 100;
      return;
    }
    const gap = ((95 - 50 * diff) / density) * r.range(0.75, 1.35);
    this.trafficNextS = s + gap;
    if (s < this.reserveEnd + 5) return;
    const n = diff > 0.2 && r.chance(0.2 + 0.25 * diff) ? 2 : 1;
    const lanes = [0, 1, 2];
    for (let k = 0; k < n; k++) {
      const lane = lanes.splice(r.int(0, lanes.length - 1), 1)[0];
      // keep clear of other vehicles already in that lane
      let clear = true;
      for (const o of this.items) if (o.car && !o.dead && this._occupies(o, lane) && Math.abs(o.s - s) < 11 + o.hl) clear = false;
      // do not spawn into a spot where the other two lanes are already occupied
      const occ = new Set();
      for (const o of this.items) if (o.solid && !o.dead && Math.abs(o.s - s) < 38) occ.add(o.lane !== undefined ? o.lane : this._laneOf(o.d));
      occ.delete(lane);
      if (!clear || occ.size >= 2) continue;
      let pick = r.next();
      let family = 'marsh';
      for (const [name, f] of Object.entries(TRAFFIC)) {
        if (pick < f.weight) {
          family = name;
          break;
        }
        pick -= f.weight;
      }
      const fam = TRAFFIC[family];
      const type = family + r.int(0, fam.variants.length - 1);
      const cruise = r.range(fam.speed[0], fam.speed[1]) * this.trafficScale;
      this._spawn(type, s + (k ? r.range(-12, 12) : 0), this._laneD(lane), { vs: cruise, cruise, lane, lane2: undefined, lc: null, lcT: r.range(2, 9) });
    }
  }

  _occupies(o, l) {
    if (o.lane !== undefined) return o.lane === l || o.lane2 === l;
    return this._laneOf(o.d) === l;
  }

  _shares(a, b) {
    for (let l = 0; l < 3; l++) if (this._occupies(a, l) && this._occupies(b, l)) return true;
    return false;
  }

  // Is it safe for car c to move into lane `tl` right now?
  _laneChangeOk(c, tl) {
    const items = this.items;
    const occ = [false, false, false];
    for (const o of items) {
      if (o === c || o.dead || !o.solid) continue;
      if (this._occupies(o, tl)) {
        const gap = Math.abs(o.s - c.s) - o.hl - c.hl;
        const behindFast = o.car && o.s < c.s && o.vs > c.vs;
        if (gap < (behindFast ? 20 : 11)) return false;
      }
      const win = o.car ? 26 : 18;
      if (Math.abs(o.s - c.s) < win) for (let l = 0; l < 3; l++) if (l !== tl && this._occupies(o, l)) occ[l] = true;
    }
    // never leave the other two lanes both occupied right beside the new position
    if (occ.filter(Boolean).length >= 2) return false;
    // keep clear of ramps
    for (const o of items) if (o.ramp && c.s > o.s - 170 && c.s < o.s + 30) return false;
    return true;
  }

  _tryLaneChange(c, playerS, urgent) {
    const r = this.rng;
    c.lcT = r.range(urgent ? 1.5 : 4, urgent ? 3 : 11);
    // hold lanes right next to the player so nobody is cut off unfairly
    if (c.s > playerS - 12 && c.s < playerS + 24) return;
    const dirs = r.chance(0.5) ? [-1, 1] : [1, -1];
    for (const dir of dirs) {
      const tl = c.lane + dir;
      if (tl < 0 || tl > 2) continue;
      if (!this._laneChangeOk(c, tl)) continue;
      c.lane2 = c.lane;
      c.lane = tl;
      c.lc = { t: 0, dur: r.range(1.7, 2.4), d0: c.d, d1: this._laneD(tl) };
      return;
    }
  }

  _trafficUpdate(dt, playerS) {
    const items = this.items;
    for (const c of items) {
      if (!c.car || c.dead) continue;
      let target = c.cruise;
      let blocked = false;
      // follow the vehicle ahead in the same lane
      for (const o of items) {
        if (o === c || !o.car || o.dead || o.s <= c.s || !this._shares(o, c)) continue;
        const gap = o.s - c.s - o.hl - c.hl;
        if (gap < 24) {
          target = Math.min(target, Math.max(0, o.vs + (gap - 8) * 0.5));
          if (o.vs < c.cruise - 1.5) blocked = true;
        }
      }
      // never help seal all three lanes: the rearmost car of a cluster drops back
      let rearmost = true;
      const occ = [false, false, false];
      for (const o of items) {
        if (o === c || o.dead || !o.solid) continue;
        const win = o.car ? 32 : 22;
        if (Math.abs(o.s - c.s) > win) continue;
        for (let l = 0; l < 3; l++) if (l !== c.lane && l !== c.lane2 && this._occupies(o, l)) occ[l] = true;
        if (o.car && o.s < c.s) rearmost = false;
      }
      if (occ.filter(Boolean).length >= 2 && rearmost) target = Math.min(target, c.vs - 8);
      const dv = target - c.vs;
      c.vs += Math.max(-12 * dt, Math.min(2.5 * dt, dv));
      if (c.vs < 2.5) c.vs = 2.5;

      // lane changes: drift across smoothly, or decide to start one
      if (c.lc) {
        const lc = c.lc;
        lc.t += dt;
        const u = Math.min(1, lc.t / lc.dur);
        c.d = lc.d0 + (lc.d1 - lc.d0) * (u * u * (3 - 2 * u));
        const vd = ((lc.d1 - lc.d0) * 6 * u * (1 - u)) / lc.dur;
        c.yawJitter = -Math.atan2(vd, Math.max(c.vs, 1));
        if (u >= 1) {
          c.lc = null;
          c.lane2 = undefined;
          c.yawJitter = 0;
          c.d = lc.d1;
        }
      } else {
        c.lcT -= dt;
        if (c.lcT <= 0 || (blocked && c.lcT < 5)) this._tryLaneChange(c, playerS, blocked);
      }
    }
  }

  _row(s, speedRef) {
    const r = this.rng;
    const diff = this.diff;
    const reserved = s < this.reserveEnd;
    const v = Math.max(speedRef, 22);
    let gap = v * (2.3 - 1.3 * diff) * r.range(1.1, 1.5);
    gap = Math.max(gap, 24);

    // --- ramp
    if (!reserved && !this.noStatic && s > this.nextRampS) {
      // a lane is usable if no traffic could drive into the ramp from behind
      const free = [0, 1, 2].filter((l) => !this.items.some((o) => o.car && !o.dead && this._occupies(o, l) && o.s > s - 200 && o.s < s + 110));
      if (free.length && this._straight(s + 8, s + 88)) {
        const lane = free[r.int(0, free.length - 1)];
        this._spawn('ramp', s + 20, this._laneD(lane));
        this.reserveEnd = s + 20 + 85;
        this.nextRampS = s + r.range(300, 560);
        // coins hanging in the air over the jump
        for (let i = 0; i < 6; i++) {
          const u = i / 5;
          this.collectibles.spawn('coin', s + 20 + 18 + u * 22, this._laneD(lane), 1.6 + Math.sin(u * Math.PI) * 2.4);
        }
        this.nextS = s + gap + 25;
        this.safe = lane;
        return;
      }
      this.nextRampS = s + 30;
    }

    const safe = this.safe;
    const next = this._walk(safe, null);
    this.safe = next;

    if (!reserved && !this.noStatic) {
      // solid obstacles
      // traffic shares the road, so static rows only ever block a single lane
      const nBlock = 1;
      const lanes = [0, 1, 2].filter((l) => l !== safe);
      const blocked = [];
      while (blocked.length < nBlock && lanes.length) blocked.push(lanes.splice(r.int(0, lanes.length - 1), 1)[0]);
      const sparse = s < 220;
      for (const l of blocked) {
        if (sparse && r.chance(0.35)) continue;
        // traffic already fills the other two lanes here: leave this lane open
        const taken = new Set();
        for (const o of this.items) if (o.car && !o.dead && Math.abs(o.s - s) < 28 && o.lane !== l) taken.add(o.lane);
        if (taken.size >= 2) continue;
        const roll = r.next();
        const d = this._laneD(l);
        if (roll < 0.45) {
          const n = r.int(1, 3);
          for (let i = 0; i < n; i++) {
            this._spawn('cone', s + i * 2.2, d + (i % 2 ? 0.5 : -0.5) * (n > 1 ? 1 : 0), { yawJitter: r.range(-0.3, 0.3) });
          }
        } else if (roll < 0.75 || diff < 0.12) {
          this._spawn('barrel', s, d + r.range(-0.4, 0.4));
          if (r.chance(0.4)) this._spawn('barrel', s + 1.4, d + r.range(-0.5, 0.5));
        } else {
          this._spawn('roadblock', s, d);
        }
      }
      // hazards (never solid, so the safe lane stays passable)
      if (r.chance(0.18 + 0.3 * diff)) {
        const l = r.int(0, 2);
        this._spawn('pothole', s + gap * 0.5 + r.range(-4, 4), this._laneD(l) + r.range(-0.5, 0.5));
      }
      if (diff > 0.08 && r.chance(0.12 + 0.2 * diff)) {
        const l = r.int(0, 2);
        this._spawn('oil', s + gap * 0.5 + r.range(-6, 6), this._laneD(l));
      }
    }

    // --- collectibles between this row and the next, in the next safe lane
    const d = this._laneD(next);
    const a = s + 7;
    const b = s + gap - 9;
    let itemS = -999;
    if (s > this.nextNitroS && b - a > 8) {
      this.collectibles.spawn('nitro', (a + b) / 2, d, 0.9);
      itemS = (a + b) / 2;
      this.nextNitroS = s + r.range(480, 800);
    } else if (s > this.nextBoxS && b - a > 8) {
      this.collectibles.spawn('box', (a + b) / 2, d, 1.0);
      itemS = (a + b) / 2;
      this.nextBoxS = s + r.range(380, 650);
    }
    if (r.chance(0.55) && b - a > 8) {
      for (let cs = a; cs <= b; cs += 3.2) {
        if (Math.abs(cs - itemS) < 3) continue;
        this.collectibles.spawn('coin', cs, d, 0.9);
      }
    }

    this.nextS = s + gap;
  }

  // ------------------------------------------------------------- per frame
  update(dt, playerS) {
    this._trafficUpdate(dt, playerS);
    for (let i = this.items.length - 1; i >= 0; i--) {
      const o = this.items[i];
      if (o.vs && !o.dead) {
        o.s += o.vs * dt;
        this._place(o);
      }
      if (o.fly) {
        const f = o.fly;
        f.t += dt;
        f.vel.y -= 22 * dt;
        o.mesh.position.addScaledVector(f.vel, dt);
        o.mesh.rotation.x += f.rot.x * dt;
        o.mesh.rotation.z += f.rot.z * dt;
        if (f.t > 1.4) this._remove(i);
        continue;
      }
      if (o.s < playerS - 40) {
        this._remove(i);
      }
    }
  }

  _remove(i) {
    const o = this.items[i];
    this._free(o);
    const last = this.items.pop();
    if (i < this.items.length) this.items[i] = last;
  }

  // Knock an object flying (crushed by a monster truck or hit with a shield).
  smash(o, speed) {
    if (o.dead) return;
    o.dead = true;
    o.solid = false;
    this.path.frame(o.s, _f);
    o.fly = {
      t: 0,
      vel: new THREE.Vector3(_f.fx * speed * 0.8 + (Math.random() - 0.5) * 6, 6 + Math.random() * 4, _f.fz * speed * 0.8 + (Math.random() - 0.5) * 6),
      rot: { x: (Math.random() - 0.5) * 14, z: (Math.random() - 0.5) * 14 },
    };
  }

  // Returns list of contacts for the vehicle this frame.
  collide(veh) {
    const hits = [];
    const vhl = veh.hl;
    const vhw = veh.hw;
    for (const o of this.items) {
      if (o.dead || o.ramp) continue;
      if (Math.abs(o.s - veh.s) > o.hl + vhl) continue;
      if (Math.abs(o.d - veh.d) > o.hw * 0.92 + vhw) continue;
      if (o.solid) {
        if (veh.h > o.h - 0.12) continue; // hopped over it
        hits.push(o);
      } else if (o.hazard) {
        if (veh.h > 0.35) continue;
        if (!o.hit) hits.push(o);
      }
    }
    return hits;
  }
}

export const RAMP = { L: RAMP_L, W: RAMP_W, H: RAMP_H };
