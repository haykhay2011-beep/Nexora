// All sounds are synthesised with the Web Audio API: no audio files.
export class Audio {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.ready = false;
  }

  // must be called from a user gesture
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try { this.ctx = new AC(); } catch { return; }
      this._build();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }

  _build() {
    const c = this.ctx;
    this.master = c.createGain();
    this.master.gain.value = this.muted ? 0 : 0.7;
    const comp = c.createDynamicsCompressor();
    this.master.connect(comp);
    comp.connect(c.destination);

    // white noise buffer reused by every noisy sound
    const len = c.sampleRate * 2;
    this.noise = c.createBuffer(1, len, c.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    // --- continuous: electric motor whine ---
    this.whineGain = c.createGain(); this.whineGain.gain.value = 0;
    const whineFilter = c.createBiquadFilter(); whineFilter.type = 'lowpass'; whineFilter.frequency.value = 2400; whineFilter.Q.value = 2;
    this.whineA = c.createOscillator(); this.whineA.type = 'sawtooth';
    this.whineB = c.createOscillator(); this.whineB.type = 'sine';
    this.whineC = c.createOscillator(); this.whineC.type = 'triangle';
    const gA = c.createGain(); gA.gain.value = 0.18;
    const gB = c.createGain(); gB.gain.value = 0.5;
    const gC = c.createGain(); gC.gain.value = 0.22;
    this.whineA.connect(gA).connect(whineFilter);
    this.whineB.connect(gB).connect(whineFilter);
    this.whineC.connect(gC).connect(whineFilter);
    whineFilter.connect(this.whineGain).connect(this.master);
    this.whineFilter = whineFilter;
    [this.whineA, this.whineB, this.whineC].forEach((o) => o.start());

    // --- continuous: regen hum ---
    this.regenGain = c.createGain(); this.regenGain.gain.value = 0;
    this.regenOsc = c.createOscillator(); this.regenOsc.type = 'triangle'; this.regenOsc.frequency.value = 110;
    this.regenOsc2 = c.createOscillator(); this.regenOsc2.type = 'sine'; this.regenOsc2.frequency.value = 221;
    const rg2 = c.createGain(); rg2.gain.value = 0.4;
    this.regenOsc.connect(this.regenGain);
    this.regenOsc2.connect(rg2).connect(this.regenGain);
    this.regenGain.connect(this.master);
    this.regenOsc.start(); this.regenOsc2.start();

    // --- continuous: wind / road noise ---
    this.wind = this._noiseSource(true);
    this.windFilter = c.createBiquadFilter(); this.windFilter.type = 'bandpass'; this.windFilter.frequency.value = 500; this.windFilter.Q.value = 0.6;
    this.windGain = c.createGain(); this.windGain.gain.value = 0;
    this.wind.connect(this.windFilter).connect(this.windGain).connect(this.master);
    this.wind.start();

    // --- continuous: tyre screech ---
    this.screech = this._noiseSource(true);
    this.screechFilter = c.createBiquadFilter(); this.screechFilter.type = 'bandpass'; this.screechFilter.frequency.value = 2600; this.screechFilter.Q.value = 9;
    this.screechGain = c.createGain(); this.screechGain.gain.value = 0;
    this.screechLfo = c.createOscillator(); this.screechLfo.frequency.value = 17;
    const lfoGain = c.createGain(); lfoGain.gain.value = 420;
    this.screechLfo.connect(lfoGain).connect(this.screechFilter.frequency);
    this.screech.connect(this.screechFilter).connect(this.screechGain).connect(this.master);
    this.screech.start(); this.screechLfo.start();
    this.ready = true;
  }

  _noiseSource(loop = false) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noise;
    s.loop = loop;
    if (loop) s.loopStart = Math.random();
    return s;
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.7, this.ctx.currentTime, 0.05);
  }

  // per-frame continuous sound update
  drive({ speed = 0, braking = false, skid = 0, boost = false, active = false, flat = false }) {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    const v = active ? speed : 0;
    const f = 180 + v * 19 + (boost ? 260 : 0);
    this.whineA.frequency.setTargetAtTime(f, t, 0.08);
    this.whineB.frequency.setTargetAtTime(f * 2.01, t, 0.08);
    this.whineC.frequency.setTargetAtTime(f * 0.5, t, 0.08);
    this.whineFilter.frequency.setTargetAtTime(1200 + v * 40, t, 0.1);
    const wg = active ? (flat ? 0.02 : 0.035 + Math.min(0.09, v * 0.0016)) : 0;
    this.whineGain.gain.setTargetAtTime(wg, t, 0.1);
    this.regenGain.gain.setTargetAtTime(active && braking && speed > 10 ? 0.07 : 0, t, 0.06);
    this.regenOsc.frequency.setTargetAtTime(90 + speed * 1.2, t, 0.1);
    this.regenOsc2.frequency.setTargetAtTime(181 + speed * 2.4, t, 0.1);
    this.windGain.gain.setTargetAtTime(active ? Math.min(0.16, v * 0.0024) : 0, t, 0.15);
    this.windFilter.frequency.setTargetAtTime(350 + v * 14, t, 0.2);
    this.screechGain.gain.setTargetAtTime(active ? skid * 0.11 : 0, t, 0.05);
  }

  _env(gainNode, t, a, peak, decay) {
    gainNode.gain.setValueAtTime(0.0001, t);
    gainNode.gain.exponentialRampToValueAtTime(peak, t + a);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, t + a + decay);
  }

  _tone(type, freq, start, dur, peak = 0.2, endFreq = null) {
    const c = this.ctx;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, start);
    if (endFreq) o.frequency.exponentialRampToValueAtTime(endFreq, start + dur);
    const g = c.createGain();
    this._env(g, start, 0.005, peak, dur);
    o.connect(g).connect(this.master);
    o.start(start);
    o.stop(start + dur + 0.05);
  }

  _noiseBurst(start, dur, { type = 'lowpass', freq = 1000, endFreq = null, q = 1, peak = 0.3, attack = 0.005 } = {}) {
    const c = this.ctx;
    const s = this._noiseSource();
    const f = c.createBiquadFilter();
    f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(freq, start);
    if (endFreq) f.frequency.exponentialRampToValueAtTime(endFreq, start + dur);
    const g = c.createGain();
    this._env(g, start, attack, peak, dur);
    s.connect(f).connect(g).connect(this.master);
    s.start(start, Math.random());
    s.stop(start + dur + attack + 0.05);
  }

  play(name, opt = 0) {
    if (!this.ready || this.muted) return;
    const t = this.ctx.currentTime;
    switch (name) {
      case 'coin': {
        const up = Math.min(6, opt) * 40;
        this._tone('sine', 1318 + up, t, 0.12, 0.15);
        this._tone('sine', 1976 + up, t + 0.06, 0.22, 0.12);
        break;
      }
      case 'click': this._tone('square', 880, t, 0.04, 0.06, 660); break;
      case 'back': this._tone('square', 520, t, 0.05, 0.05, 380); break;
      case 'buy':
        [660, 880, 1320].forEach((f, i) => this._tone('triangle', f, t + i * 0.07, 0.18, 0.12));
        break;
      case 'deny': this._tone('square', 200, t, 0.18, 0.08, 150); break;
      case 'launch':
        this._noiseBurst(t, 0.9, { type: 'bandpass', freq: 300, endFreq: 3200, q: 1.4, peak: 0.45, attack: 0.04 });
        this._tone('sawtooth', 120, t, 0.7, 0.08, 900);
        break;
      case 'boost':
        this._noiseBurst(t, 1.1, { type: 'bandpass', freq: 400, endFreq: 5000, q: 1.2, peak: 0.5, attack: 0.05 });
        this._tone('sawtooth', 220, t, 0.9, 0.09, 1600);
        this._tone('sine', 440, t, 0.9, 0.08, 2600);
        break;
      case 'crash':
        this._noiseBurst(t, 0.9, { type: 'lowpass', freq: 3000, endFreq: 200, peak: 0.9, attack: 0.002 });
        this._tone('sine', 140, t, 0.6, 0.6, 40);
        this._noiseBurst(t + 0.05, 0.4, { type: 'highpass', freq: 3500, peak: 0.25 });
        break;
      case 'cone':
        this._tone('triangle', 420, t, 0.12, 0.2, 200);
        this._noiseBurst(t, 0.12, { type: 'bandpass', freq: 1200, peak: 0.2 });
        break;
      case 'rail':
        this._noiseBurst(t, 0.25, { type: 'bandpass', freq: 3000, q: 4, peak: 0.25 });
        this._tone('square', 300, t, 0.1, 0.06, 180);
        break;
      case 'hop': this._tone('sine', 320, t, 0.18, 0.12, 640); break;
      case 'land': this._noiseBurst(t, 0.12, { type: 'lowpass', freq: 500, peak: 0.25 }); break;
      case 'closeCall':
        this._noiseBurst(t, 0.35, { type: 'bandpass', freq: 900, endFreq: 300, q: 2, peak: 0.3, attack: 0.03 });
        this._tone('sine', 1046 + opt * 80, t + 0.05, 0.18, 0.1);
        break;
      case 'charge':
        [523, 659, 784, 1046].forEach((f, i) => this._tone('triangle', f, t + i * 0.06, 0.2, 0.12));
        break;
      case 'power':
        [784, 988, 1175, 1568].forEach((f, i) => this._tone('square', f, t + i * 0.05, 0.12, 0.05));
        break;
      case 'shield': this._tone('sine', 600, t, 0.5, 0.15, 1200); break;
      case 'countdown': this._tone('square', opt ? 1046 : 523, t, 0.15, 0.08); break;
      case 'warn': this._tone('square', 440, t, 0.12, 0.06); this._tone('square', 330, t + 0.15, 0.12, 0.06); break;
      case 'gameover':
        [523, 415, 330, 262].forEach((f, i) => this._tone('triangle', f, t + i * 0.16, 0.3, 0.1));
        break;
      case 'best':
        [523, 659, 784, 1046, 1318].forEach((f, i) => this._tone('triangle', f, t + i * 0.09, 0.3, 0.12));
        break;
      default: break;
    }
  }
}
