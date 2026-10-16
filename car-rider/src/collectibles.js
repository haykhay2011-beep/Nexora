// Coins, nitro canisters and mystery boxes. Pooled meshes, animated in place.
import * as THREE from 'three';
import { POWER } from './config.js';
import { PartBuilder, flatMaterial } from './models.js';

function coinGeo() {
  const b = new PartBuilder();
  b.cyl(0.42, 0.42, 0.1, 12, 0xffc928, [0, 0, 0], [Math.PI / 2, 0, 0]);
  b.cyl(0.3, 0.3, 0.13, 12, 0xffe27a, [0, 0, 0], [Math.PI / 2, 0, 0]);
  return b.build();
}

function nitroGeo() {
  const b = new PartBuilder();
  b.cyl(0.3, 0.3, 0.9, 10, 0x2f8cff, [0, 0, 0]);
  b.cyl(0.32, 0.32, 0.14, 10, 0xffffff, [0, 0.1, 0]);
  b.cyl(0.2, 0.2, 0.18, 8, 0xd8dde6, [0, 0.54, 0]);
  b.cone(0.17, 0.4, 6, 0xff8a1f, [0, 0.12, 0.33], [Math.PI / 2, 0, 0]);
  b.cone(0.17, 0.4, 6, 0xff8a1f, [0, 0.12, -0.33], [-Math.PI / 2, 0, 0]);
  b.cyl(0.32, 0.32, 0.08, 10, 0xe0392b, [0, -0.38, 0]);
  return b.build();
}

let boxTex = null;
function boxMaterial() {
  if (!boxTex) {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const x = c.getContext('2d');
    x.fillStyle = '#a65cff';
    x.fillRect(0, 0, 128, 128);
    x.strokeStyle = '#e7d0ff';
    x.lineWidth = 10;
    x.strokeRect(5, 5, 118, 118);
    x.fillStyle = '#fff';
    x.font = 'bold 92px system-ui, sans-serif';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText('?', 64, 70);
    boxTex = new THREE.CanvasTexture(c);
    boxTex.colorSpace = THREE.SRGBColorSpace;
  }
  return new THREE.MeshLambertMaterial({ map: boxTex, emissive: 0x3a1a66 });
}

const TYPES = {
  coin: { count: 90, r: 0.55 },
  nitro: { count: 6, r: 0.8 },
  box: { count: 6, r: 0.8 },
};

const _q = new THREE.Quaternion();

export class Collectibles {
  constructor(scene, road, fx) {
    this.road = road;
    this.path = road.path;
    this.fx = fx;
    this.pools = {};
    const geos = { coin: coinGeo(), nitro: nitroGeo(), box: new THREE.BoxGeometry(1.1, 1.1, 1.1) };
    const mats = { coin: flatMaterial, nitro: flatMaterial, box: boxMaterial() };
    for (const [name, t] of Object.entries(TYPES)) {
      const arr = [];
      for (let i = 0; i < t.count; i++) {
        const m = new THREE.Mesh(geos[name], mats[name]);
        m.visible = false;
        scene.add(m);
        arr.push(m);
      }
      this.pools[name] = arr;
    }
    this.items = [];
    this.time = 0;
  }

  reset() {
    for (const o of this.items) this._free(o);
    this.items.length = 0;
  }

  _free(o) {
    o.mesh.visible = false;
    this.pools[o.type].push(o.mesh);
  }

  spawn(type, s, d, h = 0.9) {
    const mesh = this.pools[type].pop();
    if (!mesh) return null;
    mesh.visible = true;
    const o = { type, s, d, h, mesh, baseY: 0, pulled: false, phase: Math.random() * 6.28 };
    this.items.push(o);
    this._place(o);
    return o;
  }

  _place(o) {
    this.path.point(o.s, o.d, o.h, o.mesh.position);
    o.baseY = o.mesh.position.y;
    this.path.basis(o.s, _q, true);
    o.mesh.quaternion.copy(_q);
  }

  // Returns the list of collected items; magnet pulls coins towards the vehicle.
  update(dt, veh, magnet, playerS) {
    this.time += dt;
    const got = [];
    for (let i = this.items.length - 1; i >= 0; i--) {
      const o = this.items[i];
      if (o.type === 'coin' && magnet && !o.pulled) {
        const ds = o.s - veh.s;
        const dd = o.d - veh.d;
        if (ds > -2 && ds < POWER.MAGNET_RADIUS && Math.abs(dd) < POWER.MAGNET_RADIUS * 0.6) o.pulled = true;
      }
      if (o.pulled) {
        const k = 1 - Math.exp(-9 * dt);
        o.s += (veh.s + 1 - o.s) * k + 4 * dt;
        o.d += (veh.d - o.d) * k;
        o.h += (veh.h + 0.8 - o.h) * k;
        this._place(o);
      }
      // spin & bob
      const m = o.mesh;
      if (o.type === 'coin') m.rotation.y = this.time * 4 + o.phase;
      else if (o.type === 'nitro') m.rotation.y = this.time * 2.4 + o.phase;
      else {
        m.rotation.y = this.time * 1.8 + o.phase;
        m.rotation.x = Math.sin(this.time * 2 + o.phase) * 0.25;
      }
      if (!o.pulled) m.position.y = o.baseY + Math.sin(this.time * 3 + o.phase) * 0.12;

      // collect
      if (Math.abs(o.s - veh.s) < veh.hl + 0.5 && Math.abs(o.d - veh.d) < veh.hw + (o.type === 'coin' ? 0.55 : 0.8)) {
        const vy = veh.h + 0.8;
        if (Math.abs(vy - o.h) < 1.5 + (veh.def.id === 'monster' ? 1.2 : 0)) {
          this.path.point(o.s, o.d, o.h, m.position);
          got.push({ type: o.type, x: m.position.x, y: m.position.y, z: m.position.z });
          this._free(o);
          this.items.splice(i, 1);
          continue;
        }
      }
      if (o.s < playerS - 30) {
        this._free(o);
        this.items.splice(i, 1);
      }
    }
    return got;
  }
}
