import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Low-poly creature models built from primitives. All face +Z.

const matCache = new Map();
export function lam(color, emissive = 0) {
  const k = `${color}|${emissive}`;
  if (!matCache.has(k)) matCache.set(k, new THREE.MeshLambertMaterial({ color, emissive, flatShading: true }));
  return matCache.get(k);
}
const basic = (color, opacity = 1, additive = false) => new THREE.MeshBasicMaterial({
  color, transparent: opacity < 1 || additive, opacity, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, depthWrite: !additive && opacity >= 1,
});

function strip(g) {
  g = g.index ? g.toNonIndexed() : g;
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
  return g;
}

// Fish: one geometry for instancing.
export function fishGeometry() {
  const body = new THREE.OctahedronGeometry(0.5, 0);
  body.scale(0.35, 0.55, 1);
  const tail = new THREE.ConeGeometry(0.3, 0.45, 3);
  tail.rotateX(-Math.PI / 2);
  tail.scale(0.3, 1.2, 1);
  tail.translate(0, 0, -0.62);
  const fin = new THREE.ConeGeometry(0.12, 0.3, 3);
  fin.translate(0, 0.3, -0.05);
  return mergeGeometries([strip(body), strip(tail), strip(fin)]);
}

export function turtleModel() {
  const g = new THREE.Group();
  const shell = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), lam(0x5a7a3a));
  shell.scale.set(1, 0.55, 1.25);
  g.add(shell);
  const belly = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.15, 8), lam(0xd8c890));
  belly.scale.set(1, 1, 1.25);
  g.add(belly);
  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.32, 0), lam(0x8aa05a));
  head.position.set(0, 0.1, 1.45);
  g.add(head);
  const flippers = [];
  for (const [x, z, s] of [[-1, 0.6, 1.2], [1, 0.6, 1.2], [-0.8, -0.8, 0.7], [0.8, -0.8, 0.7]]) {
    const pivot = new THREE.Group();
    pivot.position.set(x * 0.85, 0, z);
    const f = new THREE.Mesh(new THREE.BoxGeometry(1.1 * s, 0.08, 0.45 * s), lam(0x8aa05a));
    f.position.x = x * 0.5 * s;
    pivot.add(f);
    g.add(pivot);
    flippers.push({ pivot, side: x });
  }
  g.userData.flippers = flippers;
  return g;
}

export function rayModel(color = 0x4a5a6a) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.OctahedronGeometry(1, 0), lam(color));
  body.scale.set(0.7, 0.18, 1);
  g.add(body);
  const wings = [];
  for (const s of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.x = s * 0.5;
    const shape = new THREE.BufferGeometry();
    shape.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.9, s * 2.2, 0, -0.2, 0, 0, -0.9, 0, 0.12, 0, s * 2.2, 0, -0.2, 0, 0, 0.9, 0, 0.12, 0, 0, 0, -0.9, s * 2.2, 0, -0.2], 3));
    shape.computeVertexNormals();
    const w = new THREE.Mesh(shape, new THREE.MeshLambertMaterial({ color, flatShading: true, side: THREE.DoubleSide }));
    pivot.add(w);
    g.add(pivot);
    wings.push({ pivot, side: s });
  }
  const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.06, 2.2, 4), lam(color));
  tail.rotation.x = Math.PI / 2;
  tail.position.z = -1.8;
  g.add(tail);
  g.userData.wings = wings;
  return g;
}

export function dolphinModel(color = 0x7a92a8) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 6), lam(color));
  body.scale.set(0.42, 0.45, 1.25);
  g.add(body);
  const belly = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 6), lam(0xdfe8ee));
  belly.scale.set(0.36, 0.3, 1.1);
  belly.position.y = -0.14;
  g.add(belly);
  const snout = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.6, 6), lam(color));
  snout.rotation.x = Math.PI / 2;
  snout.position.set(0, -0.05, 1.45);
  g.add(snout);
  const dorsal = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.55, 4), lam(color));
  dorsal.position.set(0, 0.5, -0.1);
  dorsal.rotation.x = -0.5;
  g.add(dorsal);
  for (const s of [-1, 1]) {
    const pec = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.25), lam(color));
    pec.position.set(s * 0.45, -0.2, 0.4);
    pec.rotation.z = s * -0.4;
    g.add(pec);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.05, 4, 3), lam(0x101418));
    eye.position.set(s * 0.25, 0.1, 1.0);
    g.add(eye);
  }
  const tailPivot = new THREE.Group();
  tailPivot.position.z = -1.15;
  const stock = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.7, 6), lam(color));
  stock.rotation.x = -Math.PI / 2;
  stock.position.z = -0.25;
  tailPivot.add(stock);
  const fluke = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.05, 0.3), lam(color));
  fluke.position.z = -0.6;
  tailPivot.add(fluke);
  g.add(tailPivot);
  g.userData.tail = tailPivot;
  return g;
}

export function sharkModel() {
  const g = new THREE.Group();
  const color = 0x5a6670;
  const body = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 6), lam(color));
  body.scale.set(0.6, 0.62, 2.1);
  g.add(body);
  const belly = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 6), lam(0xd8dde0));
  belly.scale.set(0.5, 0.42, 1.9);
  belly.position.y = -0.2;
  g.add(belly);
  const snout = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.9, 6), lam(color));
  snout.rotation.x = Math.PI / 2;
  snout.position.set(0, 0.05, 2.2);
  g.add(snout);
  const dorsal = new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.2, 4), lam(color));
  dorsal.position.set(0, 0.9, 0.1);
  dorsal.rotation.x = -0.45;
  g.add(dorsal);
  for (const s of [-1, 1]) {
    const pec = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.06, 0.5), lam(color));
    pec.position.set(s * 0.8, -0.3, 0.6);
    pec.rotation.z = s * -0.35;
    pec.rotation.y = s * 0.4;
    g.add(pec);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.07, 4, 3), lam(0x050505));
    eye.position.set(s * 0.36, 0.15, 1.75);
    g.add(eye);
    for (let k = 0; k < 3; k++) {
      const gill = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.3, 0.04), lam(0x3a444c));
      gill.position.set(s * 0.56, 0, 1.15 - k * 0.15);
      g.add(gill);
    }
  }
  const tailPivot = new THREE.Group();
  tailPivot.position.z = -1.9;
  const stock = new THREE.Mesh(new THREE.ConeGeometry(0.32, 1.1, 6), lam(color));
  stock.rotation.x = -Math.PI / 2;
  stock.position.z = -0.4;
  tailPivot.add(stock);
  const upper = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.3, 0.35), lam(color));
  upper.position.set(0, 0.45, -1.0);
  upper.rotation.x = -0.6;
  tailPivot.add(upper);
  const lower = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.7, 0.3), lam(color));
  lower.position.set(0, -0.3, -0.9);
  lower.rotation.x = 0.6;
  tailPivot.add(lower);
  g.add(tailPivot);
  g.userData.tail = tailPivot;
  g.scale.setScalar(1.15);
  return g;
}

export function octopusModel(color = 0xd8643a) {
  const g = new THREE.Group();
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 6), lam(color));
  head.scale.set(1, 1.3, 1);
  head.position.y = 0.9;
  g.add(head);
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.1, 5, 4), lam(0xfff0c0));
    eye.position.set(s * 0.28, 0.75, 0.42);
    g.add(eye);
    const pupil = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.03, 0.03), lam(0x101010));
    pupil.position.set(s * 0.28, 0.75, 0.52);
    g.add(pupil);
  }
  const arms = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const p1 = new THREE.Group();
    p1.position.set(Math.cos(a) * 0.3, 0.4, Math.sin(a) * 0.3);
    p1.rotation.y = -a;
    const s1 = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.13, 0.8, 5), lam(color));
    s1.rotation.z = Math.PI / 2;
    s1.position.x = 0.4;
    p1.add(s1);
    const p2 = new THREE.Group();
    p2.position.x = 0.8;
    const s2 = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.08, 0.8, 5), lam(color));
    s2.rotation.z = Math.PI / 2;
    s2.position.x = 0.4;
    p2.add(s2);
    p1.add(p2);
    g.add(p1);
    arms.push({ p1, p2, ph: i * 0.8 });
  }
  g.userData.arms = arms;
  g.userData.mat = lam(color);
  return g;
}

export function jellyModel(glow, color) {
  const g = new THREE.Group();
  const c = color ?? (glow ? 0x6af0ff : 0xff9ad8);
  const bell = new THREE.Mesh(
    new THREE.SphereGeometry(0.7, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2),
    glow ? basic(c, 0.6, true) : new THREE.MeshLambertMaterial({ color: c, transparent: true, opacity: 0.55, emissive: new THREE.Color(c).multiplyScalar(0.25), side: THREE.DoubleSide, depthWrite: false })
  );
  g.add(bell);
  const inner = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 5), basic(glow ? 0xbff8ff : 0xffd0ee, 0.8, true));
  inner.position.y = 0.15;
  g.add(inner);
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const r = 0.45;
    let x = Math.cos(a) * r, z = Math.sin(a) * r;
    for (let k = 0; k < 6; k++) {
      const y0 = -k * 0.4, y1 = -(k + 1) * 0.4;
      const w0 = Math.sin(k * 1.3 + i) * 0.1, w1 = Math.sin((k + 1) * 1.3 + i) * 0.1;
      pts.push(x + w0, y0, z, x + w1, y1, z);
    }
  }
  const tg = new THREE.BufferGeometry();
  tg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const tent = new THREE.LineSegments(tg, new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: 0.6 }));
  g.add(tent);
  g.userData.bell = bell;
  g.userData.tent = tent;
  return g;
}

export function eelModel(glow) {
  const g = new THREE.Group();
  const segs = [];
  const color = glow ? 0x1a2a30 : 0x4a5a2a;
  for (let i = 0; i < 10; i++) {
    const r = 0.22 - i * 0.012;
    const s = new THREE.Mesh(new THREE.SphereGeometry(r, 6, 4), lam(color));
    s.scale.z = 1.8;
    g.add(s);
    segs.push(s);
    if (glow && i % 2 === 0) {
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.05, 4, 3), basic(0x7af0ff));
      dot.position.y = r * 0.8;
      s.add(dot);
    }
  }
  const head = segs[0];
  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.05, 4, 3), basic(0xffe060));
    eye.position.set(sx * 0.13, 0.08, 0.15);
    head.add(eye);
  }
  const spark = new THREE.Mesh(new THREE.SphereGeometry(0.9, 8, 6), basic(0x9fe8ff, 0, true));
  head.add(spark);
  g.userData.segs = segs;
  g.userData.spark = spark;
  return g;
}

export function anglerModel() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.IcosahedronGeometry(0.8, 0), lam(0x1a1e26));
  body.scale.set(0.9, 0.85, 1.1);
  g.add(body);
  const jaw = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.3, 0.5), lam(0x14181e));
  jaw.position.set(0, -0.35, 0.7);
  g.add(jaw);
  for (let i = 0; i < 6; i++) {
    const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.2, 3), basic(0xe8e0d0));
    tooth.position.set(-0.4 + i * 0.16, -0.18, 0.92);
    tooth.rotation.x = Math.PI;
    g.add(tooth);
  }
  const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 1.2, 4), lam(0x1a1e26));
  stalk.position.set(0, 1.0, 0.6);
  stalk.rotation.x = 0.7;
  g.add(stalk);
  const lure = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), basic(0xbff8ff));
  lure.position.set(0, 1.45, 1.15);
  g.add(lure);
  const halo = new THREE.Mesh(new THREE.SphereGeometry(0.6, 8, 6), basic(0x7af0ff, 0.25, true));
  halo.position.copy(lure.position);
  g.add(halo);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.7, 4), lam(0x1a1e26));
  tail.rotation.x = -Math.PI / 2;
  tail.position.z = -1.1;
  g.add(tail);
  g.userData.tail = tail;
  g.userData.halo = halo;
  return g;
}
