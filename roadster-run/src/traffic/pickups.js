import * as THREE from 'three';
import { ROAD, PLAYER, laneX, difficultyAt } from '../game/config.js';
import { Pool } from '../core/pool.js';
import { createRng } from '../core/rng.js';
import { mergeParts, part } from '../core/geometry.js';

const MAX_COINS = 140;

// Coins (one InstancedMesh), battery chargers and power-ups, all pooled.
export class Pickups {
  constructor(scene, path, traffic) {
    this.path = path;
    this.traffic = traffic;
    this.frame = { x: 0, y: 0, z: 0, tx: 0, ty: 0, tz: -1, rx: 1, rz: 0, k: 0, heading: 0, pitch: 0 };
    const coinGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.09, 12);
    coinGeo.rotateX(Math.PI / 2);
    const coinMat = new THREE.MeshPhongMaterial({ color: '#ffc93c', emissive: '#7a4d00', shininess: 80, specular: '#fff3c4' });
    this.coinMesh = new THREE.InstancedMesh(coinGeo, coinMat, MAX_COINS);
    this.coinMesh.frustumCulled = false;
    this.coinMesh.count = 0;
    scene.add(this.coinMesh);
    this.coins = new Pool(() => ({ s: 0, x: 0, h: 0, wx: 0, wy: 0, wz: 0, heading: 0, collectT: -1 }), MAX_COINS);
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._v = new THREE.Vector3(); this._sc = new THREE.Vector3();
    this._e = new THREE.Euler(0, 0, 0, 'YXZ');

    // charger pad + power-up meshes
    const charger = mergeParts([
      part(new THREE.CylinderGeometry(1.3, 1.3, 0.08, 10), '#1f2933', [0, 0.04, 0]),
      part(new THREE.CylinderGeometry(1.05, 1.05, 0.1, 10), '#2ee59d', [0, 0.06, 0]),
      part(new THREE.BoxGeometry(0.28, 0.9, 0.12), '#d9fff0', [0.12, 1.25, 0], [0, 0, -0.45]),
      part(new THREE.BoxGeometry(0.28, 0.9, 0.12), '#d9fff0', [-0.12, 0.75, 0], [0, 0, -0.45]),
      part(new THREE.BoxGeometry(0.5, 0.16, 0.12), '#d9fff0', [0, 1.0, 0]),
    ]);
    const bolt = mergeParts([
      part(new THREE.OctahedronGeometry(0.7, 0), '#ff4d2e', [0, 0, 0], [0, 0, 0], [1, 1.3, 0.5]),
      part(new THREE.BoxGeometry(0.22, 0.75, 0.6), '#fff1c1', [0.08, 0.15, 0], [0, 0, -0.4]),
    ]);
    const magnet = mergeParts([
      part(new THREE.TorusGeometry(0.5, 0.17, 6, 10, Math.PI), '#e63946', [0, 0.1, 0], [0, 0, 0]),
      part(new THREE.BoxGeometry(0.34, 0.35, 0.34), '#e9ecef', [-0.5, -0.12, 0]),
      part(new THREE.BoxGeometry(0.34, 0.35, 0.34), '#e9ecef', [0.5, -0.12, 0]),
    ]);
    const shield = mergeParts([part(new THREE.IcosahedronGeometry(0.65, 0), '#4cc9f0')]);
    this.geos = { charger, ludicrous: bolt, magnet, shield };
    const mat = new THREE.MeshBasicMaterial({ vertexColors: true });
    const beamMat = new THREE.MeshBasicMaterial({ color: '#7dffcf', transparent: true, opacity: 0.25, depthWrite: false });
    const beamGeo = new THREE.CylinderGeometry(0.9, 1.1, 6, 10, 1, true);
    beamGeo.translate(0, 3, 0);
    this.items = new Pool(() => {
      const g = new THREE.Group();
      const mesh = new THREE.Mesh(charger, mat);
      const beam = new THREE.Mesh(beamGeo, beamMat);
      g.add(mesh, beam);
      g.visible = false;
      scene.add(g);
      return { group: g, mesh, beam, kind: 'charger', s: 0, x: 0 };
    }, 8);
    this.reset(1);
  }

  reset(seed) {
    this.rng = createRng(seed * 13 + 5);
    this.coins.releaseAll();
    this.items.releaseAll();
    this.items.items.forEach((i) => (i.group.visible = false));
    this.coinMesh.count = 0;
    this.nextCoinsAt = 90;
    this.nextChargerAt = 700;
    this.nextPowerAt = 480;
    this.time = 0;
    this.events = [];
  }

  _coin(s, x, h) {
    const c = this.coins.acquire();
    if (!c) return;
    c.s = s; c.x = x; c.h = h; c.collectT = -1; c.magnet = false;
    this._placeCoin(c);
  }

  _placeCoin(c) {
    const f = this.frame;
    this.path.sample(c.s, f);
    c.wx = f.x + f.rx * c.x; c.wy = f.y + c.h; c.wz = f.z + f.rz * c.x;
    c.heading = f.heading;
  }

  _freeLane(s0, s1, prefer) {
    const order = prefer != null ? [prefer, 0, 1, 2] : [0, 1, 2].sort(() => this.rng.next() - 0.5);
    for (const l of order) if (!this.traffic.obstacleAhead(l, s0 - 10, s1 + 10)) return l;
    return -1;
  }

  spawnCoinPattern(s) {
    const r = this.rng;
    const kind = r.pick(['line', 'line', 'zigzag', 'weave']);
    if (kind === 'line') {
      const n = r.int(6, 10);
      const lane = this._freeLane(s, s + n * 7);
      if (lane < 0) return;
      for (let i = 0; i < n; i++) this._coin(s + i * 7, laneX(lane), 0.9);
    } else if (kind === 'zigzag') {
      let lane = this._freeLane(s, s + 70);
      if (lane < 0) return;
      for (let i = 0; i < 10; i++) {
        const t = (i % 5) / 4;
        const nl = Math.min(2, Math.max(0, lane + ((Math.floor(i / 5) % 2) ? -1 : 1)));
        const x = laneX(lane) + (laneX(nl) - laneX(lane)) * t;
        if (!this.traffic.obstacleAhead(nl, s + i * 7 - 5, s + i * 7 + 5) && !this.traffic.obstacleAhead(lane, s + i * 7 - 5, s + i * 7 + 5)) this._coin(s + i * 7, x, 0.9);
      }
    } else {
      // gentle S-curve across the road
      const n = 12;
      for (let i = 0; i < n; i++) {
        const x = Math.sin((i / (n - 1)) * Math.PI * 1.5) * ROAD.laneWidth;
        let lane = Math.round(x / ROAD.laneWidth) + 1;
        if (!this.traffic.obstacleAhead(lane, s + i * 6 - 4, s + i * 6 + 4)) this._coin(s + i * 6, x, 0.9);
      }
    }
  }

  // coin arc that rewards hopping over a barrel cluster / roadblock
  spawnHopArc(zone) {
    if (!zone || zone.pattern === 'cones') return;
    const base = zone.s0 + 15;
    const peak = 1.6;
    for (let i = -3; i <= 3; i++) {
      const t = i / 3.6;
      this._coin(base + i * 2.8, laneX(zone.lane), 0.9 + peak * (1 - t * t));
    }
  }

  _spawnItem(kind, s) {
    const lane = this._freeLane(s, s + 4);
    if (lane < 0) return false;
    const it = this.items.acquire();
    if (!it) return false;
    it.kind = kind; it.s = s; it.x = laneX(lane);
    it.mesh.geometry = this.geos[kind];
    it.beam.visible = kind === 'charger';
    it.mesh.position.y = kind === 'charger' ? 0 : 1.2;
    const f = this.frame;
    this.path.sample(s, f);
    it.group.position.set(f.x + f.rx * it.x, f.y, f.z + f.rz * it.x);
    it.group.rotation.set(0, -f.heading, 0);
    it.group.visible = true;
    return true;
  }

  update(dt, player, runDistance, zone) {
    this.time += dt;
    const ps = player.s;
    const d = difficultyAt(runDistance);
    const ev = this.events;
    ev.length = 0;
    if (player.launched) {
      if (ps + 300 > this.nextCoinsAt) {
        this.spawnCoinPattern(Math.max(this.nextCoinsAt, ps + 260));
        this.nextCoinsAt = Math.max(this.nextCoinsAt, ps + 260) + this.rng.range(80, 140) + 30 * d;
      }
      if (zone && this.rng.chance(0.7)) this.spawnHopArc(zone);
      if (ps + 300 > this.nextChargerAt) {
        this._spawnItem('charger', ps + 300);
        const low = player.batteryPct < 0.3;
        this.nextChargerAt = ps + 300 + (low ? this.rng.range(250, 400) : this.rng.range(700, 950));
      }
      if (player.battery <= 0 && this.nextChargerAt > ps + 420) this.nextChargerAt = ps + 120; // rescue charger
      if (ps + 300 > this.nextPowerAt) {
        this._spawnItem(this.rng.pick(['ludicrous', 'magnet', 'shield', 'ludicrous']), ps + 300);
        this.nextPowerAt = ps + 300 + this.rng.range(420, 700);
      }
    }

    // coins
    const coins = this.coins.items;
    const spinYaw = this.time * 3.2;
    let n = 0;
    const magnet = player.magnetTime > 0;
    const pm = player.mesh.position;
    for (let i = 0; i < coins.length; i++) {
      const c = coins[i];
      if (!c.active) continue;
      if (c.s < ps - 20) { this.coins.release(c); continue; }
      let scale = 1, lift = 0;
      if (c.collectT >= 0) {
        c.collectT += dt;
        if (c.collectT > 0.3) { this.coins.release(c); continue; }
        scale = 1 - c.collectT / 0.3; lift = c.collectT * 6;
        c.wx += (pm.x - c.wx) * Math.min(1, dt * 12);
        c.wz += (pm.z - c.wz) * Math.min(1, dt * 12);
      } else {
        const ds = c.s - ps;
        if (magnet && ds < 32 && ds > -3) {
          // pull toward the car
          c.s += (ps + 1 - c.s) * Math.min(1, dt * 7);
          c.x += (player.x - c.x) * Math.min(1, dt * 7);
          c.h += (player.y + 0.8 - c.h) * Math.min(1, dt * 7);
          this._placeCoin(c);
        }
        if (Math.abs(c.s - ps) < PLAYER.halfLength + 0.6 && Math.abs(c.x - player.x) < PLAYER.halfWidth + 0.55 && Math.abs(c.h - (player.y + 0.7)) < 1.05 && !player.crashed) {
          c.collectT = 0;
          ev.push({ type: 'coin' });
        }
      }
      this._e.set(0, -c.heading + spinYaw, 0, 'YXZ');
      this._q.setFromEuler(this._e);
      this._m.compose(this._v.set(c.wx, c.wy + lift + Math.sin(this.time * 4 + c.s) * 0.08, c.wz), this._q, this._sc.set(scale, scale, scale));
      this.coinMesh.setMatrixAt(n++, this._m);
    }
    this.coinMesh.count = n;
    this.coinMesh.instanceMatrix.needsUpdate = true;

    // chargers & power-ups
    const items = this.items.items;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it.active) continue;
      if (it.s < ps - 20) { it.group.visible = false; this.items.release(it); continue; }
      it.mesh.rotation.y = it.kind === 'charger' ? 0 : this.time * 2.5;
      if (it.kind !== 'charger') it.mesh.position.y = 1.2 + Math.sin(this.time * 3) * 0.15;
      it.beam.material.opacity = 0.18 + Math.sin(this.time * 5) * 0.07;
      if (!player.crashed && Math.abs(it.s - ps) < PLAYER.halfLength + 1.1 && Math.abs(it.x - player.x) < PLAYER.halfWidth + 1.0 && player.y < 2.2) {
        ev.push({ type: it.kind });
        it.group.visible = false;
        this.items.release(it);
      }
    }
    return ev;
  }
}
