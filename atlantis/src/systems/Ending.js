import * as THREE from 'three';
import { shared } from '../world/Materials.js';
import { shardModel } from '../items/Models.js';
import { SHARD_IDS, SHARD_COLORS } from '../world/config.js';
import { RELIC_ORDER, JOURNAL_ORDER } from '../items/content.js';
import { formatTime, smoothstep } from '../core/math.js';
import { heightAt } from '../world/Terrain.js';

const CAPTIONS = [
  [1.0, 'The seven shards find their places in the cradle...'],
  [6.5, '...and the Heartstone sings again.'],
  [12, 'Light runs through the drowned streets like water through an old riverbed.'],
  [18.5, 'For the first time in ten thousand years, Atlantis glows.'],
  [25, '"Do not rule the sea. Light it." — Ilyra, last Keeper'],
];
const DURATION = 32;

// The final cutscene: the Heartstone is restored and the whole city lights up.
export class Ending {
  constructor(game) {
    this.game = game;
    this.t = 0;
    this.restored = 0;
    this.capIndex = 0;
    this.skipHold = 0;
  }

  // Beam of light rising from the palace to the surface.
  ensureBeam() {
    if (this.beam) return;
    const g = this.game;
    const heart = g.palace.heart.position;
    const h = Math.abs(heart.y);
    const mat = new THREE.MeshBasicMaterial({ color: 0xbff8ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    this.beam = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 2.2, h, 16, 1, true), mat);
    this.beam.position.set(heart.x, heart.y + h / 2, heart.z);
    this.halo = new THREE.Mesh(new THREE.CylinderGeometry(4, 6, h, 16, 1, true), mat.clone());
    this.halo.position.copy(this.beam.position);
    g.scene.add(this.beam, this.halo);
    this.beam.frustumCulled = false;
    this.halo.frustumCulled = false;
  }

  // Rising motes of light over the whole city once it is restored.
  ensureMotes() {
    if (this.motes) return;
    const n = 2600;
    const pos = new Float32Array(n * 3);
    const rnd = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random());
      const big = i < n * 0.75;
      const cx = big ? 0 : 0, cz = big ? 0 : -250, R = big ? 190 : 70;
      const x = cx + Math.cos(a) * d * R, z = cz + Math.sin(a) * d * R;
      pos[i * 3] = x; pos[i * 3 + 1] = heightAt(x, z); pos[i * 3 + 2] = z;
      rnd[i] = Math.random();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aRnd', new THREE.BufferAttribute(rnd, 1));
    this.moteU = { uTime: shared.uTime, uAmt: { value: 0 } };
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: this.moteU,
      vertexShader: /* glsl */`
        uniform float uTime; attribute float aRnd; varying float vA; varying float vR;
        void main() {
          float t = fract(uTime * (0.03 + aRnd * 0.04) + aRnd);
          vec3 p = position + vec3(sin(uTime * 0.5 + aRnd * 30.0) * 1.5, t * 45.0, cos(uTime * 0.4 + aRnd * 20.0) * 1.5);
          vA = sin(t * 3.14159); vR = aRnd;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          vA *= 1.0 - smoothstep(120.0, 200.0, -mv.z);
          gl_PointSize = (1.2 + aRnd) * 120.0 / max(-mv.z, 1.0);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */`
        uniform float uAmt; varying float vA; varying float vR;
        void main() {
          float a = smoothstep(0.5, 0.0, length(gl_PointCoord - 0.5)) * vA * uAmt;
          vec3 col = mix(vec3(1.0, 0.85, 0.45), vec3(0.5, 1.0, 0.95), step(0.5, vR));
          gl_FragColor = vec4(col * a, a);
        }`,
    });
    this.motes = new THREE.Points(geo, mat);
    this.motes.frustumCulled = false;
    this.game.scene.add(this.motes);
  }

  setRestored(v) {
    this.restored = v;
    this.ensureMotes();
    this.moteU.uAmt.value = v;
    const g = this.game;
    g.atmosphere.restored = v;
    shared.uCityLight.value = v * 1.3;
    if (g.palace) {
      g.palace.heart.visible = v > 0;
      this.ensureBeam();
      this.beam.material.opacity = 0.55 * smoothstep(0, 0.3, v);
      this.halo.material.opacity = 0.12 * smoothstep(0, 0.3, v);
    }
  }

  applyState() {
    if (this.game.state.ended) this.setRestored(1);
  }

  start() {
    const g = this.game;
    if (g.mode !== 'playing') return;
    g.mode = 'cutscene';
    g.input.unlock();
    g.ui.letterbox(true);
    g.ui.setPrompt(null);
    g.ui.setWarning(null);
    g.audio.setZone('ending');
    g.audio.play('chime');
    this.t = 0;
    this.capIndex = 0;
    this.skipHold = 0;
    this.ensureBeam();
    // shards fly from the player to the cradle
    const heart = g.palace.heart.position;
    this.flyers = SHARD_IDS.map((id, i) => {
      const m = shardModel(SHARD_COLORS[id]);
      m.scale.setScalar(0.6);
      const a = (i / 7) * Math.PI * 2;
      m.userData.start = new THREE.Vector3(heart.x + Math.cos(a) * 9, heart.y - 3, heart.z + Math.sin(a) * 9 + 6);
      m.position.copy(m.userData.start);
      m.userData.a = a;
      g.scene.add(m);
      return m;
    });
    this.path = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, -48, -170),
      new THREE.Vector3(45, -38, -110),
      new THREE.Vector3(60, -32, -10),
      new THREE.Vector3(10, -28, 70),
      new THREE.Vector3(-50, -30, 20),
    ]);
    this.lookPath = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, -65, -250),
      new THREE.Vector3(0, -60, -200),
      new THREE.Vector3(0, -55, -60),
      new THREE.Vector3(0, -50, 20),
      new THREE.Vector3(0, -55, -150),
    ]);
  }

  update(dt) {
    const g = this.game;
    this.t += dt;
    const t = this.t;
    const heart = g.palace.heart.position;
    const cam = g.camera;
    // skip by holding E
    if (g.input.keys.has('KeyE')) this.skipHold += dt; else this.skipHold = 0;
    if (this.skipHold > 1 && t < DURATION - 1) this.t = DURATION - 1;

    // captions
    while (this.capIndex < CAPTIONS.length && t >= CAPTIONS[this.capIndex][0]) {
      g.ui.caption(CAPTIONS[this.capIndex][1]);
      this.capIndex++;
    }

    // phase 1: shards converge (0-6s)
    if (t < 7) {
      const k = smoothstep(0.5, 5.5, t);
      for (const m of this.flyers) {
        const a = m.userData.a + t * (1 + k * 3);
        const r = 9 * (1 - k);
        m.position.set(heart.x + Math.cos(a) * r, THREE.MathUtils.lerp(m.userData.start.y, heart.y, k), heart.z + Math.sin(a) * r + 6 * (1 - k));
        m.rotation.y += dt * 3;
        m.visible = k < 0.98;
      }
      cam.position.set(heart.x + Math.sin(t * 0.15) * 4, heart.y - 1.5, heart.z + 13 - t * 0.4);
      cam.lookAt(heart);
      if (t > 5.5 && !g.palace.heart.visible) {
        g.palace.heart.visible = true;
        g.atmosphere.flash = 1.5;
        g.audio.play('beacon');
      }
    } else if (t < 12) {
      // phase 2: the beam rises (7-12s)
      for (const m of this.flyers) m.visible = false;
      const k = smoothstep(7, 11, t);
      this.beam.material.opacity = 0.55 * k;
      this.halo.material.opacity = 0.12 * k;
      shared.uGlyphGlow.value = 0.5 + 0.84 + k * 1.2;
      cam.position.set(heart.x + 34 - k * 6, heart.y + 6 + k * 14, heart.z + 52);
      cam.lookAt(heart.x, heart.y + 12 + k * 30, heart.z);
    } else {
      // phase 3: fly over the city as it lights up
      const u = Math.min(1, (t - 12) / (DURATION - 12));
      const e = u * u * (3 - 2 * u);
      cam.position.copy(this.path.getPoint(e));
      cam.lookAt(this.lookPath.getPoint(e));
      const lit = smoothstep(12, 22, t);
      this.setRestored(lit);
      shared.uGlyphGlow.value = 1.3 + lit * 1.2;
    }
    if (t >= DURATION) this.finish();
  }

  finish() {
    const g = this.game;
    for (const m of this.flyers || []) g.scene.remove(m);
    this.flyers = [];
    g.state.ended = true;
    this.setRestored(1);
    g.ui.caption('');
    g.mode = 'ended';
    g.save(true);
    const s = g.state;
    g.ui.showEnding(`
      <div>Time: <b>${formatTime(s.playTime)}</b></div>
      <div>Relics found: <b>${s.relics.size} / ${RELIC_ORDER.length}</b></div>
      <div>Journal entries: <b>${s.journal.size} / ${JOURNAL_ORDER.length}</b></div>
      <div>Map explored: <b>${Math.round(g.map.revealedFraction() * 100)}%</b></div>
      <div>Pearls in your pouch: <b>${s.pearls}</b></div>
      <p class="note">Thank you for playing. The city stays lit if you keep exploring.</p>
    `);
  }

  keepExploring() {
    const g = this.game;
    g.ui.letterbox(false);
    g.mode = 'playing';
    g.audio.setZone('palace');
    const p = g.palace.heart.position;
    g.player.teleport(p.x, p.y - 2, p.z + 12, 0);
    g.input.lock();
  }
}
