// All sound is synthesised with the Web Audio API. Nothing is downloaded.
import { save, persist } from './storage.js';

export class Sound {
  constructor() {
    this.ctx = null;
    this.muted = !!save.muted;
    this.engineOn = false;
  }

  // Must be called from a user gesture.
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try {
        this.ctx = new AC();
      } catch {
        return;
      }
      this._build();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  _build() {
    const c = this.ctx;
    this.master = c.createGain();
    this.master.gain.value = this.muted ? 0 : 0.55;
    const comp = c.createDynamicsCompressor();
    this.master.connect(comp);
    comp.connect(c.destination);

    // shared noise buffer
    const len = c.sampleRate * 1.5;
    this.noiseBuf = c.createBuffer(1, len, c.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    // engine: two detuned oscillators through a low-pass
    this.engGain = c.createGain();
    this.engGain.gain.value = 0;
    this.engFilter = c.createBiquadFilter();
    this.engFilter.type = 'lowpass';
    this.engFilter.frequency.value = 500;
    this.engA = c.createOscillator();
    this.engA.type = 'sawtooth';
    this.engB = c.createOscillator();
    this.engB.type = 'square';
    const gb = c.createGain();
    gb.gain.value = 0.45;
    this.engA.connect(this.engFilter);
    this.engB.connect(gb);
    gb.connect(this.engFilter);
    this.engFilter.connect(this.engGain);
    this.engGain.connect(this.master);
    this.engA.start();
    this.engB.start();
    // gentle rumble LFO
    this.lfo = c.createOscillator();
    this.lfo.frequency.value = 23;
    const lg = c.createGain();
    lg.gain.value = 0.03;
    this.lfo.connect(lg);
    lg.connect(this.engGain.gain);
    this.lfo.start();

    // tyre screech: looped noise through a band-pass
    this.skidSrc = c.createBufferSource();
    this.skidSrc.buffer = this.noiseBuf;
    this.skidSrc.loop = true;
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1900;
    bp.Q.value = 6;
    this.skidBp = bp;
    this.skidGain = c.createGain();
    this.skidGain.gain.value = 0;
    this.skidSrc.connect(bp);
    bp.connect(this.skidGain);
    this.skidGain.connect(this.master);
    this.skidSrc.start();

    // nitro: noise through sweeping band-pass, gated
    this.nitroSrc = c.createBufferSource();
    this.nitroSrc.buffer = this.noiseBuf;
    this.nitroSrc.loop = true;
    this.nitroBp = c.createBiquadFilter();
    this.nitroBp.type = 'bandpass';
    this.nitroBp.frequency.value = 700;
    this.nitroBp.Q.value = 0.8;
    this.nitroGain = c.createGain();
    this.nitroGain.gain.value = 0;
    this.nitroSrc.connect(this.nitroBp);
    this.nitroBp.connect(this.nitroGain);
    this.nitroGain.connect(this.master);
    this.nitroSrc.start();
  }

  setMuted(m) {
    this.muted = m;
    save.muted = m;
    persist();
    if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.55, this.ctx.currentTime, 0.02);
  }

  // speed in m/s, running: engine audible, skid 0..1, nitro bool
  setEngine(speed, running, skid, nitro) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const f = 48 + speed * 3.1 + (nitro ? 22 : 0);
    this.engA.frequency.setTargetAtTime(f, t, 0.05);
    this.engB.frequency.setTargetAtTime(f * 0.503, t, 0.05);
    this.engFilter.frequency.setTargetAtTime(380 + speed * 24 + (nitro ? 500 : 0), t, 0.08);
    this.engGain.gain.setTargetAtTime(running ? 0.16 + Math.min(speed, 50) * 0.002 : 0, t, 0.1);
    this.skidGain.gain.setTargetAtTime(running ? Math.min(1, skid) * 0.16 : 0, t, 0.04);
    this.skidBp.frequency.setTargetAtTime(1500 + skid * 700 + speed * 8, t, 0.05);
    this.nitroGain.gain.setTargetAtTime(running && nitro ? 0.2 : 0, t, 0.08);
    this.nitroBp.frequency.setTargetAtTime(nitro ? 900 + Math.sin(t * 9) * 300 : 400, t, 0.06);
  }

  silence() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.engGain.gain.setTargetAtTime(0, t, 0.05);
    this.skidGain.gain.setTargetAtTime(0, t, 0.03);
    this.nitroGain.gain.setTargetAtTime(0, t, 0.05);
  }

  // --- one shots ------------------------------------------------------
  _tone(type, f0, f1, dur, vol, delay = 0) {
    if (!this.ctx) return;
    const c = this.ctx;
    const t = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  _noise(dur, vol, f0, f1, type = 'lowpass', delay = 0, q = 1) {
    if (!this.ctx) return;
    const c = this.ctx;
    const t = c.currentTime + delay;
    const s = c.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f);
    f.connect(g);
    g.connect(this.master);
    s.start(t, Math.random());
    s.stop(t + dur + 0.05);
  }

  jump() {
    this._tone('sine', 260, 620, 0.16, 0.22);
    this._noise(0.1, 0.06, 2000, 800, 'highpass');
  }
  land(strength = 1) {
    const v = Math.min(1, strength);
    this._noise(0.22, 0.3 * v + 0.08, 700, 90, 'lowpass');
    this._tone('sine', 120, 45, 0.2, 0.3 * v + 0.05);
  }
  coin(pitch = 0) {
    const m = Math.pow(2, pitch / 12);
    this._tone('square', 988 * m, 988 * m, 0.07, 0.08);
    this._tone('square', 1319 * m, 1319 * m, 0.18, 0.08, 0.06);
  }
  nitro() {
    this._noise(0.9, 0.35, 400, 3200, 'bandpass', 0, 1.2);
    this._tone('sawtooth', 120, 520, 0.7, 0.1);
  }
  powerup() {
    [523, 659, 784, 1047].forEach((f, i) => this._tone('triangle', f, f, 0.14, 0.14, i * 0.06));
  }
  trick(n = 1) {
    for (let i = 0; i < 3 + n; i++) this._tone('triangle', 520 * Math.pow(1.122, i * 2), 520 * Math.pow(1.122, i * 2), 0.14, 0.14, i * 0.06);
  }
  pothole() {
    this._noise(0.18, 0.35, 500, 80, 'lowpass');
    this._tone('square', 90, 50, 0.15, 0.15);
  }
  splat() {
    this._noise(0.35, 0.18, 1200, 300, 'bandpass', 0, 2);
  }
  crush() {
    this._noise(0.18, 0.25, 1500, 200, 'lowpass');
    this._tone('square', 200, 80, 0.1, 0.1);
  }
  shieldBreak() {
    this._tone('sine', 900, 200, 0.35, 0.2);
    this._noise(0.3, 0.18, 4000, 600, 'highpass');
  }
  crash() {
    this._noise(0.9, 0.7, 2400, 60, 'lowpass');
    this._tone('sawtooth', 180, 30, 0.7, 0.35);
    this._tone('square', 90, 30, 0.5, 0.25, 0.05);
  }
  bounce() {
    this._noise(0.12, 0.2, 500, 100, 'lowpass');
  }
  click() {
    this._tone('square', 600, 800, 0.05, 0.07);
  }
  unlockFanfare() {
    [523, 659, 784, 1047, 1319].forEach((f, i) => this._tone('triangle', f, f, 0.2, 0.15, i * 0.09));
  }
}
