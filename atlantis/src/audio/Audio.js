// All sound is generated with the Web Audio API: no audio files.

const ZONE_MUSIC = {
  // root: MIDI note, scale: semitone steps, chords: scale-degree triads, tempo: seconds per step
  title: { root: 50, scale: [0, 2, 4, 7, 9], chords: [[0, 2, 4], [3, 0, 2], [4, 1, 3], [2, 4, 1]], tempo: 0.9, density: 0.45, bright: 2400, wave: 'triangle' },
  reef: { root: 55, scale: [0, 2, 4, 7, 9], chords: [[0, 2, 4], [3, 0, 2], [1, 3, 0], [4, 1, 3]], tempo: 0.55, density: 0.55, bright: 3000, wave: 'triangle' },
  kelp: { root: 50, scale: [0, 2, 3, 5, 7, 9, 10], chords: [[0, 2, 4], [3, 5, 0], [4, 6, 1], [2, 4, 6]], tempo: 0.7, density: 0.4, bright: 2000, wave: 'sine' },
  city: { root: 52, scale: [0, 2, 4, 5, 7, 9, 10], chords: [[0, 2, 4], [6, 1, 3], [3, 5, 0], [4, 6, 1]], tempo: 0.8, density: 0.35, bright: 1800, wave: 'triangle' },
  temple: { root: 49, scale: [0, 1, 4, 5, 7, 8, 10], chords: [[0, 2, 4], [1, 3, 5], [5, 0, 2], [3, 5, 0]], tempo: 1.0, density: 0.3, bright: 1500, wave: 'sine' },
  vents: { root: 43, scale: [0, 1, 3, 6, 7, 8], chords: [[0, 2, 4], [1, 3, 5], [3, 5, 0]], tempo: 0.9, density: 0.25, bright: 900, wave: 'sawtooth' },
  abyss: { root: 38, scale: [0, 1, 3, 5, 6, 8, 10], chords: [[0, 3, 5], [1, 4, 6], [5, 1, 3]], tempo: 1.6, density: 0.15, bright: 700, wave: 'sine' },
  palace: { root: 53, scale: [0, 2, 4, 6, 7, 9, 11], chords: [[0, 2, 4], [4, 6, 1], [5, 0, 2], [3, 5, 0]], tempo: 0.75, density: 0.45, bright: 2600, wave: 'triangle' },
  ending: { root: 55, scale: [0, 2, 4, 5, 7, 9, 11], chords: [[0, 2, 4], [5, 0, 2], [3, 5, 0], [4, 6, 1]], tempo: 0.42, density: 0.75, bright: 4000, wave: 'triangle' },
};

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

export class AudioEngine {
  constructor(game) {
    this.game = game;
    this.ctx = null;
    this.zone = 'title';
    this.nextNote = 0;
    this.nextChord = 0;
    this.chordIndex = 0;
    this.breathT = 0;
    this.ducked = false;
    // Start audio on the first gesture anywhere (needed for the title music).
    const kick = () => { this.resume(); window.removeEventListener('pointerdown', kick); window.removeEventListener('keydown', kick); };
    window.addEventListener('pointerdown', kick);
    window.addEventListener('keydown', kick);
  }

  resume() {
    try {
      if (!this.ctx) this.init();
      if (this.ctx.state === 'suspended') this.ctx.resume();
    } catch (e) {
      console.warn('Audio unavailable', e);
    }
  }

  init() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    this.master.connect(ctx.destination);
    // underwater muffling on everything
    this.muffle = ctx.createBiquadFilter();
    this.muffle.type = 'lowpass';
    this.muffle.frequency.value = 2600;
    this.muffle.Q.value = 0.5;
    this.muffle.connect(this.master);
    this.musicBus = ctx.createGain();
    this.sfxBus = ctx.createGain();
    this.ambBus = ctx.createGain();
    this.musicFade = ctx.createGain();
    this.musicFilter = ctx.createBiquadFilter();
    this.musicFilter.type = 'lowpass';
    this.musicFilter.frequency.value = 2400;
    this.musicFade.connect(this.musicFilter);
    this.musicFilter.connect(this.musicBus);
    this.musicBus.connect(this.muffle);
    this.sfxBus.connect(this.muffle);
    this.ambBus.connect(this.master);
    // reverb + echo shared by music and sfx
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this.makeImpulse(3.5);
    this.reverbGain = ctx.createGain();
    this.reverbGain.gain.value = 0.55;
    this.reverb.connect(this.reverbGain);
    this.reverbGain.connect(this.muffle);
    this.delay = ctx.createDelay(2);
    this.delay.delayTime.value = 0.42;
    const fb = ctx.createGain();
    fb.gain.value = 0.35;
    this.delay.connect(fb);
    fb.connect(this.delay);
    this.delay.connect(this.reverb);
    this.noiseBuf = this.makeNoise(2);
    this.brownBuf = this.makeBrown(4);
    this.startAmbience();
    this.applyVolumes();
  }

  makeImpulse(seconds) {
    const rate = this.ctx.sampleRate;
    const len = Math.floor(rate * seconds);
    const buf = this.ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
    }
    return buf;
  }

  makeNoise(seconds) {
    const len = Math.floor(this.ctx.sampleRate * seconds);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  makeBrown(seconds) {
    const len = Math.floor(this.ctx.sampleRate * seconds);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      d[i] = last * 3.5;
    }
    return buf;
  }

  startAmbience() {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.brownBuf;
    src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 380;
    const g = ctx.createGain();
    g.gain.value = 0.5;
    src.connect(lp).connect(g).connect(this.ambBus);
    src.start();
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoG = ctx.createGain();
    lfoG.gain.value = 140;
    lfo.connect(lfoG).connect(lp.frequency);
    lfo.start();
    this.ambFilter = lp;
    // deep drone
    this.drone = [];
    for (const f of [55, 55.35, 82.5]) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      const og = ctx.createGain();
      og.gain.value = 0.035;
      o.connect(og).connect(this.ambBus);
      o.start();
      this.drone.push({ o, og });
    }
  }

  applyVolumes() {
    if (!this.ctx) return;
    const s = this.game.settings;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(s.master, t, 0.05);
    this.musicBus.gain.setTargetAtTime(s.music * (this.ducked ? 0.35 : 1) * 0.55, t, 0.1);
    this.sfxBus.gain.setTargetAtTime(s.sfx, t, 0.05);
    this.ambBus.gain.setTargetAtTime(s.sfx * 0.6 * (this.ducked ? 0.5 : 1), t, 0.1);
  }

  duck(on) {
    this.ducked = on;
    this.applyVolumes();
  }

  setZone(id) {
    if (id === this.zone) return;
    this.zone = id;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.musicFade.gain.cancelScheduledValues(t);
    this.musicFade.gain.setTargetAtTime(0, t, 0.6);
    this.musicFade.gain.setTargetAtTime(1, t + 2.2, 1.2);
    this.nextChord = t + 2.2;
    this.nextNote = t + 2.6;
    const m = ZONE_MUSIC[id] || ZONE_MUSIC.reef;
    this.musicFilter.frequency.setTargetAtTime(m.bright, t + 2, 1);
  }

  // ---------- synth helpers ----------
  tone(freq, start, dur, { type = 'sine', gain = 0.2, attack = 0.01, release, dest, detune = 0, sweep } = {}) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, start);
    if (sweep) o.frequency.exponentialRampToValueAtTime(Math.max(20, sweep), start + dur);
    o.detune.value = detune;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(gain, start + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, start + (release ?? dur));
    o.connect(g).connect(dest || this.sfxBus);
    o.start(start);
    o.stop(start + (release ?? dur) + 0.05);
    return g;
  }

  noise(start, dur, { gain = 0.2, type = 'lowpass', freq = 1000, q = 1, attack = 0.01, dest, sweep } = {}) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, start);
    if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, start + dur);
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(gain, start + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    src.connect(f).connect(g).connect(dest || this.sfxBus);
    src.start(start, Math.random() * 1.5);
    src.stop(start + dur + 0.05);
    return g;
  }

  bell(freq, start, gain = 0.12, dur = 2.2) {
    const out = this.ctx.createGain();
    out.gain.value = 1;
    out.connect(this.sfxBus);
    out.connect(this.reverb);
    this.tone(freq, start, dur, { gain, dest: out });
    this.tone(freq * 2.01, start, dur * 0.6, { gain: gain * 0.4, dest: out });
    this.tone(freq * 3.02, start, dur * 0.3, { gain: gain * 0.2, dest: out });
  }

  // ---------- sound effects ----------
  play(name, pos) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const t = this.ctx.currentTime + 0.01;
    let vol = 1;
    if (pos && this.game.player) {
      const d = pos.distanceTo(this.game.player.pos);
      vol = Math.max(0, 1 - d / 45);
      if (vol <= 0.01) return;
    }
    const s = this;
    switch (name) {
      case 'pearl':
        s.tone(1320 + Math.random() * 200, t, 0.25, { gain: 0.08 * vol, sweep: 1900 });
        s.tone(2640, t + 0.04, 0.2, { gain: 0.03 * vol });
        break;
      case 'chime': {
        const notes = [0, 4, 7, 12, 16, 19, 24];
        notes.forEach((n, i) => s.bell(mtof(67 + n), t + i * 0.11, 0.1, 3));
        s.noise(t, 2.5, { gain: 0.05, type: 'highpass', freq: 6000, attack: 0.5 });
        break;
      }
      case 'solve':
        [0, 7, 12, 16].forEach((n, i) => s.bell(mtof(60 + n), t + i * 0.18, 0.09, 2.5));
        s.noise(t, 1.8, { gain: 0.25, freq: 160, attack: 0.2 });
        break;
      case 'page':
        for (let i = 0; i < 3; i++) s.noise(t + i * 0.07, 0.12, { gain: 0.06, type: 'bandpass', freq: 3000 + i * 500, q: 0.8 });
        s.bell(mtof(74), t + 0.1, 0.04, 1.5);
        break;
      case 'relic':
        s.bell(mtof(72), t, 0.09, 2);
        s.bell(mtof(79), t + 0.15, 0.08, 2.4);
        break;
      case 'clam':
        s.tone(140, t, 0.4, { gain: 0.25 * vol, sweep: 70 });
        s.noise(t, 0.5, { gain: 0.08 * vol, type: 'bandpass', freq: 500, q: 2 });
        break;
      case 'click':
        s.tone(900, t, 0.05, { gain: 0.05, type: 'square', sweep: 600 });
        break;
      case 'click2':
        s.tone(420, t, 0.12, { gain: 0.15, type: 'triangle', sweep: 260 });
        s.noise(t, 0.15, { gain: 0.1, freq: 700 });
        break;
      case 'stone':
        s.noise(t, 0.9, { gain: 0.35 * vol, freq: 220, attack: 0.05 });
        s.tone(70, t, 0.6, { gain: 0.15 * vol, sweep: 50 });
        break;
      case 'slide':
        s.noise(t, 0.8, { gain: 0.3 * vol, type: 'bandpass', freq: 300, q: 1.5, attack: 0.05, sweep: 180 });
        break;
      case 'thud':
        s.tone(90, t, 0.35, { gain: 0.35 * vol, sweep: 40 });
        s.noise(t, 0.2, { gain: 0.15 * vol, freq: 300 });
        break;
      case 'sting':
        s.noise(t, 0.3, { gain: 0.25, type: 'highpass', freq: 3000 });
        s.tone(1800, t, 0.25, { gain: 0.06, type: 'sawtooth', sweep: 600 });
        break;
      case 'zap': {
        const g = s.tone(110, t, 0.5, { gain: 0.18, type: 'sawtooth' });
        const lfo = s.ctx.createOscillator();
        lfo.frequency.value = 45;
        const lg = s.ctx.createGain();
        lg.gain.value = 0.12;
        lfo.connect(lg).connect(g.gain);
        lfo.start(t); lfo.stop(t + 0.5);
        s.noise(t, 0.4, { gain: 0.12, type: 'highpass', freq: 4000 });
        break;
      }
      case 'hurt':
        s.tone(120, t, 0.4, { gain: 0.35, sweep: 50 });
        s.noise(t, 0.3, { gain: 0.2, freq: 600 });
        break;
      case 'sizzle':
        s.noise(t, 0.7, { gain: 0.14, type: 'highpass', freq: 3500, attack: 0.05 });
        break;
      case 'creak':
        s.tone(70 + Math.random() * 20, t, 1.2, { gain: 0.12, type: 'sawtooth', attack: 0.3, sweep: 55 });
        s.noise(t, 1.2, { gain: 0.08, type: 'bandpass', freq: 400, q: 6, attack: 0.3 });
        break;
      case 'alarm':
        for (let i = 0; i < 3; i++) {
          s.tone(880, t + i * 0.5, 0.18, { gain: 0.07, type: 'square' });
          s.tone(660, t + i * 0.5 + 0.2, 0.18, { gain: 0.07, type: 'square' });
        }
        break;
      case 'blackout':
        s.tone(220, t, 2.5, { gain: 0.15, sweep: 40, attack: 0.1 });
        s.noise(t, 2.5, { gain: 0.15, freq: 400, sweep: 80 });
        break;
      case 'sonar':
        s.tone(1500, t, 0.6, { gain: 0.12, dest: s.delay });
        s.tone(1500, t, 0.3, { gain: 0.1 });
        break;
      case 'shark':
        for (const f of [55, 58.3]) s.tone(f, t, 2.4, { gain: 0.16, type: 'sawtooth', attack: 0.6 });
        s.tone(110, t + 0.3, 1.6, { gain: 0.08, type: 'sawtooth', attack: 0.4 });
        break;
      case 'eel':
        s.noise(t, 0.5, { gain: 0.15 * vol, type: 'bandpass', freq: 2000, q: 4 });
        break;
      case 'ink':
        s.tone(300, t, 0.25, { gain: 0.15 * vol, sweep: 120 });
        break;
      case 'dolphin':
        for (let i = 0; i < 5; i++) {
          const f0 = 2200 + Math.random() * 1500;
          s.tone(f0, t + i * 0.09, 0.08, { gain: 0.06 * vol, sweep: f0 * (1.3 + Math.random() * 0.5) });
        }
        s.tone(3200, t + 0.5, 0.35, { gain: 0.05 * vol, sweep: 5200, dest: s.delay });
        break;
      case 'beacon':
        [0, 7, 12, 19].forEach((n, i) => s.tone(mtof(48 + n), t + i * 0.05, 3, { gain: 0.06, type: 'triangle', attack: 0.8, dest: s.reverb }));
        s.bell(mtof(84), t + 0.5, 0.06, 3);
        break;
      case 'crystal':
      case 'place':
        s.bell(mtof(84 + Math.floor(Math.random() * 5)), t, 0.06, 1.2);
        break;
      case 'pickup':
        s.tone(600, t, 0.15, { gain: 0.1, sweep: 1200 });
        break;
      case 'rope':
        s.noise(t, 0.2, { gain: 0.25, type: 'bandpass', freq: 1200, q: 2 });
        s.tone(200, t, 0.15, { gain: 0.1, type: 'triangle', sweep: 90 });
        break;
      case 'buy':
        s.bell(mtof(76), t, 0.08, 1.2);
        s.bell(mtof(83), t + 0.1, 0.08, 1.4);
        s.noise(t, 0.3, { gain: 0.05, type: 'highpass', freq: 5000 });
        break;
      case 'discover':
        s.bell(mtof(69), t, 0.05, 1.8);
        s.bell(mtof(76), t + 0.2, 0.05, 2);
        break;
      case 'bubbles':
        for (let i = 0; i < 6; i++) {
          const f = 300 + Math.random() * 500;
          s.tone(f, t + i * 0.05 + Math.random() * 0.05, 0.08, { gain: 0.03, sweep: f * 2.2 });
        }
        break;
      default:
        break;
    }
  }

  // ---------- music + breathing ----------
  update(dt) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const t = this.ctx.currentTime;
    const m = ZONE_MUSIC[this.zone] || ZONE_MUSIC.reef;
    const g = this.game;
    // muffle more with depth
    if (g.player) {
      const depth = Math.max(0, -g.player.pos.y);
      this.muffle.frequency.setTargetAtTime(2600 - Math.min(1, depth / 160) * 1400, t, 0.5);
    }
    // pad chords
    if (t >= this.nextChord - 0.05) {
      const chord = m.chords[this.chordIndex % m.chords.length];
      this.chordIndex++;
      const len = m.tempo * 16;
      for (const deg of chord) {
        const n = m.root - 12 + m.scale[deg % m.scale.length] + 12 * Math.floor(deg / m.scale.length);
        for (const det of [-6, 6]) {
          this.tone(mtof(n), t + 0.05, len, { type: m.wave === 'sawtooth' ? 'sawtooth' : 'sine', gain: m.wave === 'sawtooth' ? 0.012 : 0.03, attack: len * 0.35, release: len, detune: det, dest: this.musicFade });
        }
      }
      // low root
      this.tone(mtof(m.root - 24), t + 0.05, len, { gain: 0.04, attack: 2, release: len, dest: this.musicFade });
      this.nextChord = t + len;
      this.chordNotes = chord;
    }
    // melody notes
    while (this.nextNote < t + 0.1) {
      if (this.nextNote < t) this.nextNote = t;
      if (Math.random() < m.density) {
        const chord = this.chordNotes || [0, 2, 4];
        const useChord = Math.random() < 0.6;
        const deg = useChord ? chord[Math.floor(Math.random() * chord.length)] : Math.floor(Math.random() * m.scale.length);
        const oct = Math.random() < 0.3 ? 24 : 12;
        const n = m.root + oct + m.scale[deg % m.scale.length];
        const out = this.ctx.createGain();
        out.gain.value = 1;
        out.connect(this.musicFade);
        out.connect(this.delay);
        this.tone(mtof(n), this.nextNote, m.tempo * 3, { type: m.wave === 'sawtooth' ? 'triangle' : m.wave, gain: 0.05, attack: 0.02, dest: out });
      }
      this.nextNote += m.tempo * (Math.random() < 0.2 ? 2 : 1);
    }
    // breathing through the regulator
    if (g.mode === 'playing' && g.player) {
      const p = g.player;
      this.breathT -= dt;
      if (this.breathT <= 0) {
        const fast = p.sprinting;
        this.breathT = fast ? 2.4 : 4.2;
        const low = g.survival && g.survival.oxygen / g.survival.max < 0.25;
        // inhale hiss
        this.noise(t, 1.0, { gain: low ? 0.07 : 0.045, type: 'bandpass', freq: 1100, q: 1.2, attack: 0.35 });
        // exhale with bubbles
        this.noise(t + 1.3, 0.9, { gain: 0.04, type: 'lowpass', freq: 500, attack: 0.1 });
        setTimeout(() => this.play('bubbles'), 1400);
      }
    }
  }
}
