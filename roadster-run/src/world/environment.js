import * as THREE from 'three';
import { LANDMARKS } from './props.js';
import { mergeParts, part } from '../core/geometry.js';
import { createRng } from '../core/rng.js';

// Sky gradient, lights, fog, distant mountains, water and the horizon landmark.
// Everything here follows the camera so it always sits "at infinity".
export class Environment {
  constructor(scene) {
    this.scene = scene;
    this.skyUniforms = {
      top: { value: new THREE.Color() },
      horizon: { value: new THREE.Color() },
      bottom: { value: new THREE.Color() },
    };
    const skyMat = new THREE.ShaderMaterial({
      uniforms: this.skyUniforms,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `uniform vec3 top; uniform vec3 horizon; uniform vec3 bottom; varying vec3 vDir;
        void main(){ float h = vDir.y; vec3 c = h > 0.0 ? mix(horizon, top, pow(min(1.0, h * 1.6), 0.7)) : mix(horizon, bottom, min(1.0, -h * 4.0));
        gl_FragColor = vec4(c, 1.0); }`,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(2600, 24, 12), skyMat);
    this.sky.renderOrder = -10;
    this.sky.frustumCulled = false;
    scene.add(this.sky);

    this.hemi = new THREE.HemisphereLight('#ffffff', '#888888', 1.2);
    scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight('#ffffff', 2);
    this.sun.position.set(-0.5, 1, 0.35).normalize();
    scene.add(this.sun);
    scene.fog = new THREE.Fog('#ffffff', 60, 300);

    this.far = new THREE.Group(); // camera-following, no fog
    scene.add(this.far);
    this.mountainMesh = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ vertexColors: true, fog: false }));
    this.far.add(this.mountainMesh);
    this.landmarkMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, fog: false });
    this.landmark = new THREE.Mesh(new THREE.BufferGeometry(), this.landmarkMat);
    this.far.add(this.landmark);
    this.landmarkCache = new Map();

    this.groundMat = new THREE.MeshLambertMaterial({ color: '#777777' });
    this.ground = new THREE.Mesh(new THREE.CircleGeometry(2400, 32), this.groundMat);
    this.ground.rotation.x = -Math.PI / 2;
    scene.add(this.ground);
    // the sea is drawn without fog so it keeps a crisp horizon line
    this.water = new THREE.Mesh(new THREE.CircleGeometry(2400, 32), new THREE.MeshBasicMaterial({ color: '#2d8fd0', fog: false }));
    this.water.rotation.x = -Math.PI / 2;
    scene.add(this.water);
    this.groundY = 0;
  }

  setDestination(dest) {
    this.dest = dest;
    this.skyUniforms.top.value.set(dest.sky.top);
    this.skyUniforms.horizon.value.set(dest.sky.horizon);
    this.skyUniforms.bottom.value.set(dest.sky.bottom);
    this.scene.fog.color.set(dest.sky.horizon);
    this.scene.fog.near = dest.fog.near;
    this.scene.fog.far = dest.fog.far;
    this.hemi.color.set(dest.light.hemiSky);
    this.hemi.groundColor.set(dest.light.hemiGround);
    this.hemi.intensity = dest.light.hemiIntensity;
    this.sun.color.set(dest.light.sun);
    this.sun.intensity = dest.light.sunIntensity;
    this.groundMat.color.set(dest.ground.far).lerp(new THREE.Color(dest.sky.horizon), 0.25);
    this.water.visible = !!dest.water;
    if (dest.water) this.water.material.color.set(dest.water.color).lerp(new THREE.Color(dest.sky.horizon), 0.2);
    this._buildMountains(dest);
    if (!this.landmarkCache.has(dest.landmark)) this.landmarkCache.set(dest.landmark, LANDMARKS[dest.landmark]());
    this.landmark.geometry = this.landmarkCache.get(dest.landmark);
  }

  _buildMountains(dest) {
    const rng = createRng(dest.id.length * 977 + 13);
    const base = new THREE.Color(dest.mountains);
    const haze = new THREE.Color(dest.sky.horizon);
    const parts = [];
    for (let i = 0; i < 46; i++) {
      const a = (i / 46) * Math.PI * 2 + rng.range(-0.05, 0.05);
      const r = rng.range(1900, 2200);
      const h = rng.range(140, 420) * (dest.id === 'alpine' ? 1.6 : dest.id === 'tokyo' ? 0.6 : 1);
      const c = base.clone().lerp(haze, rng.range(0.25, 0.55));
      parts.push(part(new THREE.ConeGeometry(rng.range(220, 420), h, 5), '#' + c.getHexString(), [Math.sin(a) * r, h / 2 - 30, -Math.cos(a) * r], [0, rng.range(0, 3), 0]));
      if (dest.id === 'alpine' && h > 380) {
        parts.push(part(new THREE.ConeGeometry(130, h * 0.3, 5), '#f4f7fb', [Math.sin(a) * r, h * 0.85 - 30, -Math.cos(a) * r]));
      }
    }
    this.mountainMesh.geometry.dispose();
    this.mountainMesh.geometry = mergeParts(parts);
  }

  update(camera, roadY) {
    const p = camera.position;
    this.sky.position.copy(p);
    this.far.position.set(p.x, roadY - 40, p.z);
    // landmark sits far ahead, slightly off-axis so it frames the road
    this.landmark.position.set(-250, 0, -1500);
    this.groundY += (roadY - 14 - this.groundY) * 0.02;
    this.ground.position.set(p.x, this.groundY, p.z);
    if (this.dest && this.dest.water) this.water.position.set(p.x, this.dest.water.level, p.z);
  }
}
