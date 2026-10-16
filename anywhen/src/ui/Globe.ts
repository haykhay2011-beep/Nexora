// Interactive 3D globe: rotate, zoom, click to pick a location; day/night with city lights; landmark pins.
import * as THREE from 'three';
import type { EarthData } from '../geo/earth';
import { paintGlobe } from './globeTexture';
import { toVec } from '../geo/paleo';

export class Globe {
  readonly canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  private group = new THREE.Group();
  private earthMesh: THREE.Mesh;
  private mat: THREE.ShaderMaterial;
  private marker: THREE.Group;
  private pins: THREE.Points;
  private dragging = false;
  private moved = 0;
  private last = { x: 0, y: 0 };
  rotLon = -20;
  rotLat = 20;
  private targetLon: number | null = null;
  private targetLat: number | null = null;
  dist = 3.4;
  targetDist = 3.4;
  autoSpin = 0;
  onPick: ((lat: number, lon: number) => void) | null = null;
  private running = false;
  private yearPainted = NaN;
  private paintTimer = 0;
  private moonMode = false;

  constructor(private earth: EarthData, canvas?: HTMLCanvasElement) {
    this.canvas = canvas ?? document.createElement('canvas');
    this.canvas.className = 'globe';
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uDay: { value: null }, uLights: { value: null }, uSun: { value: new THREE.Vector3(1, 0.3, 0.6).normalize() }, uMoon: { value: 0 } },
      vertexShader: `varying vec2 vUv; varying vec3 vN; void main(){ vUv = uv; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `uniform sampler2D uDay; uniform sampler2D uLights; uniform vec3 uSun; uniform float uMoon; varying vec2 vUv; varying vec3 vN;
        void main(){ vec3 day = texture2D(uDay, vUv).rgb; vec3 lit = texture2D(uLights, vUv).rgb;
          float l = dot(normalize(vN), uSun); float d = smoothstep(-0.15, 0.25, l);
          vec3 c = day * (0.18 + 0.9 * d) + lit * (1.0 - d) * 1.4;
          if (uMoon > 0.5) { float g = dot(day, vec3(0.33)); c = vec3(g) * (0.35 + 0.8 * d); }
          gl_FragColor = vec4(c, 1.0); }`,
    });
    this.earthMesh = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), this.mat);
    this.group.add(this.earthMesh);
    const atmo = new THREE.Mesh(new THREE.SphereGeometry(1.08, 64, 32), new THREE.ShaderMaterial({
      transparent: true, side: THREE.BackSide, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `varying vec3 vN; varying vec3 vV; void main(){ vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position,1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1.0 - abs(dot(vN, vV)), 3.0); gl_FragColor = vec4(0.35, 0.7, 1.0, f * 0.9); }`,
    }));
    this.scene.add(atmo);
    this.scene.add(this.group);
    // marker pin
    this.marker = new THREE.Group();
    const pin = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.09, 8), new THREE.MeshBasicMaterial({ color: '#ffd27a' }));
    pin.rotation.x = Math.PI;
    pin.position.y = 0.045;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 8), new THREE.MeshBasicMaterial({ color: '#36e0ff' }));
    head.position.y = 0.1;
    this.marker.add(pin, head);
    this.marker.visible = false;
    this.group.add(this.marker);
    this.pins = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ color: '#ffd27a', size: 6, sizeAttenuation: false, transparent: true, opacity: 0.85, depthTest: true }));
    this.group.add(this.pins);
    // stars background
    const sp = new Float32Array(1500 * 3);
    for (let i = 0; i < 1500; i++) { const v = new THREE.Vector3().randomDirection().multiplyScalar(40); sp.set([v.x, v.y, v.z], i * 3); }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    this.scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: '#ffffff', size: 1.2, sizeAttenuation: false, transparent: true, opacity: 0.7 })));
    this.bind();
  }

  private bind() {
    const c = this.canvas;
    c.addEventListener('pointerdown', (e) => { this.dragging = true; this.moved = 0; this.last = { x: e.clientX, y: e.clientY }; c.setPointerCapture(e.pointerId); this.targetLon = null; });
    c.addEventListener('pointermove', (e) => {
      if (!this.dragging) return;
      const dx = e.clientX - this.last.x, dy = e.clientY - this.last.y;
      this.moved += Math.abs(dx) + Math.abs(dy);
      this.last = { x: e.clientX, y: e.clientY };
      const k = 0.25 * (this.dist - 1) / 2.4;
      this.rotLon -= dx * k;
      this.rotLat = Math.max(-85, Math.min(85, this.rotLat + dy * k));
    });
    c.addEventListener('pointerup', (e) => {
      this.dragging = false;
      if (this.moved < 6) this.pickAt(e.clientX, e.clientY);
    });
    c.addEventListener('wheel', (e) => { e.preventDefault(); this.targetDist = Math.max(1.35, Math.min(5, this.targetDist + Math.sign(e.deltaY) * 0.25)); }, { passive: false });
  }

  private pickAt(cx: number, cy: number) {
    const r = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.camera);
    const hit = ray.intersectObject(this.earthMesh)[0];
    if (!hit) return;
    const local = this.group.worldToLocal(hit.point.clone()).normalize();
    const lat = Math.asin(local.y) * 180 / Math.PI;
    const lon = Math.atan2(-local.z, local.x) * 180 / Math.PI;
    this.setMarker(lat, lon);
    this.onPick?.(lat, lon);
  }

  setMarker(lat: number, lon: number) {
    const v = toVec(lat, lon);
    this.marker.position.set(v[0], v[1], v[2]);
    this.marker.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(v[0], v[1], v[2]));
    this.marker.visible = true;
  }

  setPins(points: [number, number][]) {
    const pos = new Float32Array(points.length * 3);
    points.forEach(([lat, lon], i) => { const v = toVec(lat, lon); pos.set([v[0] * 1.004, v[1] * 1.004, v[2] * 1.004], i * 3); });
    this.pins.geometry.dispose();
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.pins.geometry = g;
  }

  /** Repaint the Earth for a year (debounced; low-res first for responsiveness). */
  setYear(year: number, immediate = false) {
    if (this.moonMode) return;
    if (year === this.yearPainted) return;
    window.clearTimeout(this.paintTimer);
    const paint = (w: number) => {
      const t = paintGlobe(this.earth, year, w, w / 2);
      const dt = new THREE.CanvasTexture(t.day); dt.colorSpace = THREE.SRGBColorSpace; dt.anisotropy = 4;
      const lt = new THREE.CanvasTexture(t.lights); lt.colorSpace = THREE.SRGBColorSpace;
      (this.mat.uniforms.uDay.value as THREE.Texture | null)?.dispose();
      (this.mat.uniforms.uLights.value as THREE.Texture | null)?.dispose();
      this.mat.uniforms.uDay.value = dt;
      this.mat.uniforms.uLights.value = lt;
    };
    if (immediate || isNaN(this.yearPainted)) paint(1024);
    else { paint(384); this.paintTimer = window.setTimeout(() => paint(1024), 350); }
    this.yearPainted = year;
  }

  setMoon(on: boolean) {
    this.moonMode = on;
    this.mat.uniforms.uMoon.value = on ? 1 : 0;
    if (on) {
      const c = document.createElement('canvas');
      c.width = 512; c.height = 256;
      const x = c.getContext('2d')!;
      x.fillStyle = '#9a9a9a'; x.fillRect(0, 0, 512, 256);
      for (let i = 0; i < 900; i++) { const r = Math.pow(Math.random(), 3) * 18 + 1; x.fillStyle = `rgba(${Math.random() < 0.5 ? '60,60,60' : '200,200,200'},${0.15 + Math.random() * 0.3})`; x.beginPath(); x.arc(Math.random() * 512, Math.random() * 256, r, 0, 6.28); x.fill(); }
      for (const [cx, cy, rx] of [[300, 110, 50], [250, 80, 35], [340, 140, 40], [200, 120, 30]]) { x.fillStyle = 'rgba(50,50,55,0.6)'; x.beginPath(); x.ellipse(cx, cy, rx, rx * 0.7, 0, 0, 6.28); x.fill(); }
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
      this.mat.uniforms.uDay.value = t;
      const b = document.createElement('canvas'); b.width = b.height = 4;
      this.mat.uniforms.uLights.value = new THREE.CanvasTexture(b);
    } else this.yearPainted = NaN;
  }

  flyTo(lat: number, lon: number, dist?: number) {
    this.targetLat = lat;
    this.targetLon = lon;
    if (dist !== undefined) this.targetDist = dist;
  }

  start() {
    if (this.running) return;
    this.running = true;
    let last = performance.now();
    const loop = (t: number) => {
      if (!this.running) return;
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      this.frame(dt);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
  stop() { this.running = false; }

  private frame(dt: number) {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    if (w > 0 && h > 0 && (this.canvas.width !== Math.floor(w * this.renderer.getPixelRatio()) || this.canvas.height !== Math.floor(h * this.renderer.getPixelRatio()))) {
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    }
    if (this.targetLon !== null && this.targetLat !== null) {
      const dl = ((((this.targetLon - this.rotLon) % 360) + 540) % 360) - 180;
      this.rotLon += dl * Math.min(1, dt * 3);
      this.rotLat += (this.targetLat - this.rotLat) * Math.min(1, dt * 3);
      if (Math.abs(dl) < 0.05 && Math.abs(this.targetLat - this.rotLat) < 0.05) { this.targetLon = null; this.targetLat = null; }
    } else if (!this.dragging) this.rotLon += this.autoSpin * dt;
    this.dist += (this.targetDist - this.dist) * Math.min(1, dt * 4);
    // rotate the globe so that (rotLat, rotLon) faces the camera (+z)
    this.group.rotation.set(0, 0, 0);
    this.group.rotateX(this.rotLat * Math.PI / 180);
    this.group.rotateY(-(this.rotLon + 90) * Math.PI / 180);
    this.camera.position.set(0, 0, this.dist);
    this.camera.lookAt(0, 0, 0);
    const sun = this.mat.uniforms.uSun.value as THREE.Vector3;
    sun.set(Math.cos(performance.now() * 0.00005) * 0.9, 0.35, 0.9).normalize();
    this.renderer.render(this.scene, this.camera);
  }

  dispose() { this.stop(); this.renderer.dispose(); }
}
