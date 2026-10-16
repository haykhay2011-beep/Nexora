// Sky dome, sun/moon positioned by latitude + season + hour, stars, clouds, extra moons/orbital ring.
import * as THREE from 'three';
import type { Palette } from '../data/types';
import { Rng } from '../core/rng';
import { GLOBAL } from './materials';

const D2R = Math.PI / 180;

export function sunDirection(lat: number, day: number, hour: number): THREE.Vector3 {
  const decl = 23.44 * Math.sin((2 * Math.PI * (284 + day)) / 365) * D2R;
  const H = (hour - 12) * 15 * D2R;
  const la = lat * D2R;
  const sinEl = Math.sin(la) * Math.sin(decl) + Math.cos(la) * Math.cos(decl) * Math.cos(H);
  const el = Math.asin(Math.max(-1, Math.min(1, sinEl)));
  const az = Math.atan2(-Math.sin(H), Math.tan(decl) * Math.cos(la) - Math.sin(la) * Math.cos(H)); // from north, clockwise
  return new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)).normalize();
}

export interface SkyState { sunDir: THREE.Vector3; moonDir: THREE.Vector3; daylight: number; night: number; dusk: number }

export class Sky {
  readonly root = new THREE.Group();
  /** world-space group (lights, clouds) — the dome root follows the camera */
  readonly world = new THREE.Group();
  readonly sun = new THREE.DirectionalLight(0xffffff, 2.2);
  readonly hemi = new THREE.HemisphereLight(0xbcd8ff, 0x6b5a3a, 1.1);
  private dome: THREE.Mesh;
  private domeMat: THREE.ShaderMaterial;
  private stars: THREE.Points;
  private sunDisc: THREE.Mesh;
  private moonDisc: THREE.Mesh;
  private extras = new THREE.Group();
  private clouds: THREE.InstancedMesh;
  private cloudData: { x: number; z: number; y: number; s: number; v: number }[] = [];
  state: SkyState = { sunDir: new THREE.Vector3(0, 1, 0), moonDir: new THREE.Vector3(0, -1, 0), daylight: 1, night: 0, dusk: 0 };
  overcast = 0;
  private top = new THREE.Color();
  private horizon = new THREE.Color();
  private moon: boolean;

  constructor(private palette: Palette, seed: number, opts: { moon: boolean; extraMoons: number; ring: boolean; stations: boolean; cloudiness: number }) {
    this.moon = opts.moon;
    this.top.set(palette.skyTop);
    this.horizon.set(palette.skyHorizon);
    this.domeMat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: {
        uTop: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() }, uSunDir: { value: new THREE.Vector3() },
        uSunCol: { value: new THREE.Color() }, uNight: { value: 0 },
      },
      vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * p; gl_Position.z = gl_Position.w; }`,
      fragmentShader: `varying vec3 vDir; uniform vec3 uTop; uniform vec3 uHorizon; uniform vec3 uSunDir; uniform vec3 uSunCol; uniform float uNight;
        void main(){ float h = clamp(vDir.y, -0.2, 1.0); float t = pow(max(h, 0.0), 0.55);
          vec3 c = mix(uHorizon, uTop, t);
          float s = max(dot(normalize(vDir), uSunDir), 0.0);
          c += uSunCol * (pow(s, 8.0) * 0.35 + pow(s, 200.0) * 0.6) * (1.0 - uNight * 0.8);
          if (vDir.y < 0.0) c = mix(c, uHorizon * 0.7, clamp(-vDir.y * 4.0, 0.0, 1.0));
          gl_FragColor = vec4(c, 1.0); }`,
    });
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(4500, 24, 16), this.domeMat);
    this.dome.renderOrder = -10;
    this.dome.frustumCulled = false;
    this.root.add(this.dome);

    // stars
    const rng = new Rng(seed ^ 0x5a5a);
    const n = 2200;
    const pos = new Float32Array(n * 3), sizes = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const u = rng.next() * 2 - 1, a = rng.next() * Math.PI * 2;
      const r = Math.sqrt(1 - u * u);
      pos.set([Math.cos(a) * r * 4200, Math.abs(u) * 4200 * (u < -0.2 ? -1 : 1), Math.sin(a) * r * 4200], i * 3);
      sizes[i] = rng.next() < 0.05 ? 3.2 : 1.2 + rng.next() * 1.4;
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    sg.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    const smat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, fog: false, uniforms: { uAlpha: { value: 0 }, uTime: GLOBAL.uTime },
      vertexShader: `attribute float size; uniform float uTime; varying float vT; void main(){ vT = fract(position.x * 0.013 + position.z * 0.007); gl_PointSize = size * (1.0 + 0.25*sin(uTime*2.0 + vT*40.0)); vec4 p = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * p; gl_Position.z = gl_Position.w * 0.9999; }`,
      fragmentShader: `uniform float uAlpha; varying float vT; void main(){ vec2 d = gl_PointCoord - 0.5; float a = smoothstep(0.5, 0.0, length(d)); gl_FragColor = vec4(mix(vec3(1.0,0.95,0.85), vec3(0.8,0.9,1.0), vT), a * uAlpha); }`,
    });
    this.stars = new THREE.Points(sg, smat);
    this.stars.frustumCulled = false;
    this.root.add(this.stars);

    this.sunDisc = new THREE.Mesh(new THREE.CircleGeometry(110, 20), new THREE.MeshBasicMaterial({ color: palette.sun, fog: false, transparent: true }));
    this.moonDisc = new THREE.Mesh(new THREE.CircleGeometry(80, 20), new THREE.MeshBasicMaterial({ color: '#e8e8f0', fog: false, transparent: true }));
    this.root.add(this.sunDisc, this.moonDisc);

    // far future: an extra moon and the orbital ring; near future: small station lights
    for (let i = 0; i < opts.extraMoons; i++) {
      const m = new THREE.Mesh(new THREE.CircleGeometry(50, 18), new THREE.MeshBasicMaterial({ color: '#c8b0ff', fog: false, transparent: true, opacity: 0.85 }));
      m.position.set(-1800, 1500, -2600);
      m.lookAt(0, 0, 0);
      this.extras.add(m);
    }
    if (opts.ring) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(3600, 14, 4, 120, Math.PI), new THREE.MeshBasicMaterial({ color: '#d8e0ff', fog: false, transparent: true, opacity: 0.55 }));
      ring.rotation.set(Math.PI / 2 + 0.25, 0, 0.35);
      ring.position.y = -400;
      this.extras.add(ring);
    }
    if (opts.stations) {
      for (let i = 0; i < 6; i++) {
        const s = new THREE.Mesh(new THREE.SphereGeometry(8, 6, 4), new THREE.MeshBasicMaterial({ color: '#fff8e0', fog: false }));
        s.position.set(Math.cos(i) * 3000, 1800 + i * 150, Math.sin(i * 1.7) * 3000);
        this.extras.add(s);
      }
    }
    this.root.add(this.extras);

    // clouds: instanced puffs
    const cg = new THREE.IcosahedronGeometry(1, 0);
    const cm = new THREE.MeshLambertMaterial({ color: '#ffffff', flatShading: true, transparent: true, opacity: 0.92 });
    const count = this.moon ? 0 : Math.round(40 + opts.cloudiness * 160);
    this.clouds = new THREE.InstancedMesh(cg, cm, Math.max(1, count * 4));
    this.clouds.count = count * 4;
    for (let i = 0; i < count; i++) {
      const x = rng.range(-3500, 3500), z = rng.range(-3500, 3500), y = rng.range(260, 520), s = rng.range(30, 90);
      for (let j = 0; j < 4; j++) this.cloudData.push({ x: x + rng.range(-s, s), z: z + rng.range(-s * 0.5, s * 0.5), y: y + rng.range(-8, 8), s: s * rng.range(0.5, 1), v: rng.range(2, 5) });
    }
    this.clouds.frustumCulled = false;
    this.world.add(this.clouds);

    this.sun.castShadow = true;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.6;
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 900;
    this.world.add(this.sun, this.sun.target, this.hemi);
    if (this.moon) { this.top.set('#000000'); this.horizon.set('#05060a'); this.stars.visible = true; }
  }

  setShadowSize(mapSize: number, extent: number) {
    this.sun.shadow.mapSize.set(mapSize, mapSize);
    const c = this.sun.shadow.camera;
    c.left = -extent; c.right = extent; c.top = extent; c.bottom = -extent;
    c.updateProjectionMatrix();
    this.sun.shadow.map?.dispose();
    this.sun.shadow.map = null as unknown as THREE.WebGLRenderTarget;
  }

  update(dt: number, lat: number, day: number, hour: number, camera: THREE.Camera, focus: THREE.Vector3, weatherDark: number) {
    const sd = sunDirection(lat, day, hour);
    const phase = ((day % 29.5) / 29.5) * Math.PI * 2;
    const md = sunDirection(lat, day, (hour + 12 + (phase / (Math.PI * 2)) * 24) % 24);
    this.state.sunDir.copy(sd);
    this.state.moonDir.copy(md);
    const elev = sd.y;
    const daylight = THREE.MathUtils.smoothstep(elev, -0.08, 0.18);
    const dusk = Math.max(0, 1 - Math.abs(elev) / 0.22) * (elev > -0.15 ? 1 : 0);
    this.state.daylight = daylight;
    this.state.night = 1 - daylight;
    this.state.dusk = dusk;
    GLOBAL.uNight.value = this.state.night;

    const night = new THREE.Color('#0a1028'), nightH = new THREE.Color('#1a2440');
    const duskTop = new THREE.Color('#4a5a9a'), duskH = new THREE.Color('#f08a50');
    const top = this.top.clone().lerp(night, this.state.night).lerp(duskTop, dusk * 0.35 * daylight);
    const hor = this.horizon.clone().lerp(nightH, this.state.night).lerp(duskH, dusk * 0.55);
    const grey = new THREE.Color('#8a9098');
    if (!this.moon) { top.lerp(grey.clone().multiplyScalar(0.4 + daylight * 0.6), weatherDark * 0.7); hor.lerp(grey.clone().multiplyScalar(0.5 + daylight * 0.6), weatherDark * 0.6); }
    else { top.set('#000000'); hor.set('#06070c'); }
    this.domeMat.uniforms.uTop.value.copy(top);
    this.domeMat.uniforms.uHorizon.value.copy(hor);
    this.domeMat.uniforms.uSunDir.value.copy(sd);
    this.domeMat.uniforms.uSunCol.value.set(this.palette.sun).lerp(new THREE.Color('#ff9a5a'), dusk);
    this.domeMat.uniforms.uNight.value = this.state.night;
    (this.stars.material as THREE.ShaderMaterial).uniforms.uAlpha.value = this.moon ? 1 : Math.max(0, this.state.night - weatherDark * 0.8);

    this.root.position.copy(camera.position);
    this.sunDisc.position.copy(sd).multiplyScalar(4000);
    this.sunDisc.lookAt(0, 0, 0);
    (this.sunDisc.material as THREE.MeshBasicMaterial).color.set(this.palette.sun).lerp(new THREE.Color('#ffb070'), dusk);
    this.sunDisc.visible = sd.y > -0.1 && weatherDark < 0.8;
    this.moonDisc.position.copy(md).multiplyScalar(4000);
    this.moonDisc.lookAt(0, 0, 0);
    this.moonDisc.visible = md.y > -0.1 && weatherDark < 0.8;
    (this.moonDisc.material as THREE.MeshBasicMaterial).opacity = 0.5 + this.state.night * 0.5;
    this.extras.visible = true;
    for (const c of this.extras.children) ((c as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.25 + this.state.night * 0.7;

    // lights: sun by day, moon by night
    const useSun = sd.y > -0.05;
    const ld = useSun ? sd : md;
    this.sun.position.copy(focus).addScaledVector(ld, 400);
    this.sun.target.position.copy(focus);
    const sunCol = new THREE.Color(this.palette.sun).lerp(new THREE.Color('#ff9a5a'), dusk * 0.7);
    if (useSun) { this.sun.color.copy(sunCol); this.sun.intensity = (0.25 + 2.3 * daylight) * (1 - weatherDark * 0.55); }
    else { this.sun.color.set('#8aa0d8'); this.sun.intensity = 0.35 * Math.max(0, md.y) + 0.1; }
    this.hemi.color.copy(top).lerp(new THREE.Color('#ffffff'), 0.4);
    this.hemi.groundColor.set(this.palette.ground).multiplyScalar(0.55 + daylight * 0.45);
    this.hemi.intensity = (this.moon ? 0.35 : 0.35 + daylight * 0.9) * (1 - weatherDark * 0.2);

    // clouds drift with the wind
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    const cc = new THREE.Color().copy(hor).lerp(new THREE.Color('#ffffff'), 0.6 * daylight).lerp(new THREE.Color('#6a7078'), weatherDark);
    (this.clouds.material as THREE.MeshLambertMaterial).color.copy(cc);
    for (let i = 0; i < this.cloudData.length; i++) {
      const c = this.cloudData[i];
      c.x += c.v * dt * (1 + weatherDark);
      if (c.x > 3600) c.x -= 7200;
      m.compose(p.set(c.x, c.y, c.z), q, s.set(c.s, c.s * 0.45, c.s * 0.7));
      this.clouds.setMatrixAt(i, m);
    }
    this.clouds.instanceMatrix.needsUpdate = true;
    return { horizon: hor, top };
  }

  destroy() { this.world.removeFromParent(); this.root.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh || (o as THREE.Points).isPoints) m.geometry?.dispose(); }); this.root.removeFromParent(); }
}
