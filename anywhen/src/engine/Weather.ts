// Weather by climate: clear, cloudy, rain, storm, snow, sandstorm, fog, monsoon.
import * as THREE from 'three';
import { Rng } from '../core/rng';
import { GLOBAL } from './materials';
import type { WorldPlan } from '../gen/planTypes';

export type WeatherKind = 'clear' | 'cloudy' | 'rain' | 'storm' | 'snow' | 'sandstorm' | 'fog' | 'monsoon';

export class Weather {
  readonly root = new THREE.Group();
  kind: WeatherKind = 'clear';
  /** 0..1 smooth intensities */
  rain = 0; snow = 0; sand = 0; fog = 0; dark = 0;
  private target = { rain: 0, snow: 0, sand: 0, fog: 0, dark: 0 };
  private timer = 0;
  private rng: Rng;
  private points: THREE.Points;
  private mat: THREE.ShaderMaterial;
  lightning = 0;
  constructor(private plan: WorldPlan) {
    this.rng = new Rng(plan.seed ^ 0x77);
    const n = 4000;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) pos.set([this.rng.range(-40, 40), this.rng.range(0, 30), this.rng.range(-40, 40)], i * 3);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { uTime: GLOBAL.uTime, uCam: { value: new THREE.Vector3() }, uMode: { value: 0 }, uAmount: { value: 0 }, uColor: { value: new THREE.Color('#c8d8e8') } },
      vertexShader: `uniform float uTime; uniform vec3 uCam; uniform float uMode; uniform float uAmount; varying float vA;
        void main(){ vec3 p = position;
          float speed = uMode < 0.5 ? 18.0 : uMode < 1.5 ? 1.6 : 2.0;
          p.y = mod(p.y - uTime * speed + 30.0, 30.0);
          if (uMode > 0.5 && uMode < 1.5) { p.x += sin(uTime * 0.7 + p.y) * 1.2; }
          if (uMode > 1.5) { p.x = mod(p.x + uTime * 24.0 + 40.0, 80.0) - 40.0; p.y = mod(position.y + sin(uTime + position.x) * 2.0, 8.0); }
          vec3 w = vec3(uCam.x + p.x, uCam.y - 8.0 + p.y, uCam.z + p.z);
          vA = step(fract(position.x * 13.7 + position.z * 7.1), uAmount);
          vec4 mv = modelViewMatrix * vec4(w, 1.0);
          gl_PointSize = (uMode < 0.5 ? 14.0 : uMode < 1.5 ? 7.0 : 10.0) * 10.0 / max(1.0, -mv.z);
          gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform float uMode; uniform vec3 uColor; varying float vA;
        void main(){ if (vA < 0.5) discard; vec2 d = gl_PointCoord - 0.5; float a;
          if (uMode < 0.5) a = (1.0 - smoothstep(0.02, 0.07, abs(d.x))) * (1.0 - smoothstep(0.3, 0.5, abs(d.y)));
          else a = smoothstep(0.5, 0.15, length(d));
          gl_FragColor = vec4(uColor, a * (uMode < 0.5 ? 0.55 : uMode < 1.5 ? 0.9 : 0.45)); }`,
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    this.root.add(this.points);
    this.pick(true);
  }

  private pick(initial = false) {
    const w = this.plan.weather;
    const r = this.rng.next();
    let k: WeatherKind = 'clear';
    if (this.plan.moon) k = 'clear';
    else if (w.monsoon && r < 0.6) k = 'monsoon';
    else if (w.sandstorm && r < 0.12) k = 'sandstorm';
    else if (r < w.rainChance) k = w.snow ? 'snow' : r < w.rainChance * 0.25 ? 'storm' : 'rain';
    else if (r < w.rainChance + w.fog * 0.5) k = 'fog';
    else if (r < w.rainChance + 0.25) k = 'cloudy';
    if (initial && (k === 'storm' || k === 'sandstorm')) k = 'cloudy'; // arrive in calmer weather
    this.set(k);
    this.timer = this.rng.range(120, 360);
  }

  set(k: WeatherKind) {
    this.kind = k;
    const t = { rain: 0, snow: 0, sand: 0, fog: this.plan.weather.fog * 0.3, dark: 0 };
    switch (k) {
      case 'cloudy': t.dark = 0.35; break;
      case 'rain': t.rain = 0.5; t.dark = 0.55; t.fog = 0.3; break;
      case 'storm': t.rain = 1; t.dark = 0.8; t.fog = 0.4; break;
      case 'monsoon': t.rain = 1; t.dark = 0.7; t.fog = 0.5; break;
      case 'snow': t.snow = 0.8; t.dark = 0.5; t.fog = 0.4; break;
      case 'sandstorm': t.sand = 1; t.dark = 0.5; t.fog = 0.85; break;
      case 'fog': t.fog = 0.9; t.dark = 0.3; break;
    }
    this.target = t;
  }

  update(dt: number, cam: THREE.Vector3, sheltered: boolean) {
    this.timer -= dt;
    if (this.timer <= 0) this.pick();
    const k = Math.min(1, dt * 0.25);
    for (const key of ['rain', 'snow', 'sand', 'fog', 'dark'] as const) this[key] += (this.target[key] - this[key]) * k;
    this.mat.uniforms.uCam.value.copy(cam);
    const mode = this.sand > 0.05 ? 2 : this.snow > this.rain ? 1 : 0;
    this.mat.uniforms.uMode.value = mode;
    this.mat.uniforms.uAmount.value = sheltered ? 0 : mode === 2 ? this.sand : mode === 1 ? this.snow : this.rain;
    this.mat.uniforms.uColor.value.set(mode === 2 ? '#d8b880' : mode === 1 ? '#ffffff' : '#b8c8d8');
    this.points.visible = this.mat.uniforms.uAmount.value > 0.02;
    GLOBAL.uWind.value = 0.3 + this.rain * 0.7 + this.sand * 1.2;
    if (this.kind === 'storm' && Math.random() < dt * 0.08) this.lightning = 1;
    this.lightning = Math.max(0, this.lightning - dt * 4);
  }
  destroy() { this.points.geometry.dispose(); this.mat.dispose(); this.root.removeFromParent(); }
}
