// Web Audio synthesis: ambient beds per biome/era, generative music per era, Chronometer + world SFX.
type Ctx = AudioContext;

const SCALES: Record<string, number[]> = {
  pentatonic_major: [0, 2, 4, 7, 9], pentatonic_minor: [0, 3, 5, 7, 10], major: [0, 2, 4, 5, 7, 9, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10], phrygian: [0, 1, 3, 5, 7, 8, 10], lydian: [0, 2, 4, 6, 7, 9, 11],
};

export class AudioEngine {
  ctx: Ctx | null = null;
  private master!: GainNode;
  private music!: GainNode;
  private sfx!: GainNode;
  private amb!: GainNode;
  private noiseBuf!: AudioBuffer;
  private ambNodes: AudioNode[] = [];
  private ambTimers: number[] = [];
  private musicTimer = 0;
  private musicCfg = { instrument: 'harp', scale: 'major', tempo: 80, pad: 'warm' };
  private root = 57; // A3
  private musicStep = 0;
  private chord = 0;
  private padNodes: { osc: OscillatorNode[]; g: GainNode } | null = null;
  vol = { master: 0.8, music: 0.55, sfx: 0.8, ambient: 0.7 };
  onCaption: ((t: string) => void) | null = null;
  private lastCaption = 0;

  /** Must be called from a user gesture. */
  start() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); return; }
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AC();
    } catch { this.ctx = null; return; }
    const c = this.ctx;
    this.master = c.createGain();
    this.master.connect(c.destination);
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.connect(this.master);
    this.music = c.createGain(); this.music.connect(comp);
    this.sfx = c.createGain(); this.sfx.connect(comp);
    this.amb = c.createGain(); this.amb.connect(comp);
    this.noiseBuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.applyVolumes();
  }

  applyVolumes() {
    if (!this.ctx) return;
    this.master.gain.value = this.vol.master;
    this.music.gain.value = this.vol.music * 0.5;
    this.sfx.gain.value = this.vol.sfx;
    this.amb.gain.value = this.vol.ambient * 0.6;
  }

  private noise(): AudioBufferSourceNode {
    const s = this.ctx!.createBufferSource();
    s.buffer = this.noiseBuf;
    s.loop = true;
    return s;
  }

  private caption(t: string) {
    const now = performance.now();
    if (now - this.lastCaption < 2500) return;
    this.lastCaption = now;
    this.onCaption?.(t);
  }

  // ---------------------------------------------------------------- ambience
  setAmbience(kinds: string[], extra: { water: boolean; wind: number; night: boolean }) {
    if (!this.ctx) return;
    this.stopAmbience();
    const c = this.ctx;
    const bed = (type: BiquadFilterType, freq: number, q: number, gain: number, lfo = 0) => {
      const n = this.noise();
      const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
      const g = c.createGain(); g.gain.value = gain;
      n.connect(f); f.connect(g); g.connect(this.amb);
      if (lfo) { const o = c.createOscillator(); o.frequency.value = lfo; const og = c.createGain(); og.gain.value = gain * 0.6; o.connect(og); og.connect(g.gain); o.start(); this.ambNodes.push(o); }
      n.start();
      this.ambNodes.push(n, f, g);
    };
    bed('lowpass', 400 + extra.wind * 600, 0.6, 0.05 + extra.wind * 0.12, 0.08);
    if (extra.water) bed('lowpass', 700, 0.4, 0.14, 0.12);
    const set = new Set(kinds);
    if (set.has('crowd') || set.has('crowd_small')) bed('bandpass', 900, 1.2, set.has('crowd') ? 0.07 : 0.04, 0.3);
    if (set.has('traffic')) bed('lowpass', 250, 0.8, 0.14, 0.05);
    if (set.has('machines') || set.has('hum')) {
      const o = c.createOscillator(); o.type = set.has('hum') ? 'sine' : 'sawtooth'; o.frequency.value = set.has('hum') ? 110 : 55;
      const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 300;
      const g = c.createGain(); g.gain.value = 0.025;
      o.connect(f); f.connect(g); g.connect(this.amb); o.start(); this.ambNodes.push(o, f, g);
    }
    if (set.has('fire')) bed('highpass', 2500, 0.5, 0.012, 7);
    const every = (ms: number, fn: () => void) => { const id = window.setInterval(() => { if (Math.random() < 0.6) fn(); }, ms); this.ambTimers.push(id); };
    if ((set.has('birds') || set.has('jungle')) && !extra.night) every(1700, () => this.chirp());
    if (set.has('gulls') || extra.water) every(5200, () => this.gull());
    if (set.has('insects') || set.has('jungle') || extra.night) every(2600, () => this.cricket());
    if (set.has('bells')) every(14000, () => this.bell(220 + Math.random() * 60));
    if (set.has('hammer')) every(3200, () => this.knock(0.5));
    if (set.has('chimes')) every(4200, () => this.bell(880 + Math.random() * 440, 0.05));
    if (set.has('train')) every(22000, () => this.whistle());
    if (set.has('distant_roar')) every(19000, () => this.roar(0.25));
    if (set.has('wind_cold')) bed('bandpass', 1400, 4, 0.03, 0.15);
  }

  stopAmbience() {
    for (const n of this.ambNodes) { try { (n as AudioScheduledSourceNode).stop?.(); } catch { /* ignore */ } try { n.disconnect(); } catch { /* ignore */ } }
    this.ambNodes = [];
    for (const t of this.ambTimers) clearInterval(t);
    this.ambTimers = [];
  }

  // ---------------------------------------------------------------- music
  setMusic(cfg: { instrument: string; scale: string; tempo: number; pad: string }, seed: number) {
    this.musicCfg = cfg;
    this.root = 50 + (seed % 12);
    this.musicStep = 0;
    if (!this.ctx) return;
    window.clearTimeout(this.musicTimer);
    this.startPad();
    this.tick();
  }

  stopMusic() { window.clearTimeout(this.musicTimer); this.stopPad(); }

  private stopPad() {
    if (!this.padNodes || !this.ctx) return;
    const { osc, g } = this.padNodes;
    g.gain.setTargetAtTime(0, this.ctx.currentTime, 0.8);
    setTimeout(() => osc.forEach((o) => { try { o.stop(); } catch { /* ignore */ } }), 3000);
    this.padNodes = null;
  }

  private startPad() {
    const c = this.ctx!;
    this.stopPad();
    const g = c.createGain(); g.gain.value = 0;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = this.musicCfg.pad === 'shimmer' ? 2400 : this.musicCfg.pad === 'cold' ? 900 : 700;
    g.connect(f); f.connect(this.music);
    const osc: OscillatorNode[] = [];
    for (const [i, semi] of [0, 7, 12].entries()) {
      const o = c.createOscillator();
      o.type = this.musicCfg.pad === 'bright' || this.musicCfg.pad === 'shimmer' ? 'triangle' : 'sine';
      o.frequency.value = midi(this.root - 12 + semi);
      o.detune.value = (i - 1) * 6;
      o.connect(g); o.start(); osc.push(o);
    }
    g.gain.setTargetAtTime(0.05, c.currentTime, 2);
    this.padNodes = { osc, g };
  }

  private tick() {
    if (!this.ctx) return;
    const cfg = this.musicCfg;
    const scale = SCALES[cfg.scale] ?? SCALES.major;
    const beat = 60 / cfg.tempo;
    const prog = [0, 3, 4, 0, 5, 3, 4, 4];
    if (this.musicStep % 8 === 0) {
      this.chord = prog[(this.musicStep / 8) % prog.length] % scale.length;
      if (this.padNodes) {
        const t = this.ctx.currentTime;
        [0, 2, 4].forEach((d, i) => { const deg = (this.chord + d) % scale.length, oct = Math.floor((this.chord + d) / scale.length); this.padNodes!.osc[i]?.frequency.setTargetAtTime(midi(this.root - 12 + scale[deg] + oct * 12), t, 0.6); });
      }
    }
    // sparse, gentle melody: phrases with rests
    const phrasePos = this.musicStep % 16;
    const play = phrasePos < 12 ? Math.random() < 0.62 : Math.random() < 0.15;
    if (play) {
      const deg = this.chord + Math.floor(Math.random() * 5) - 1;
      const n = scale[((deg % scale.length) + scale.length) % scale.length] + Math.floor(deg / scale.length) * 12;
      this.note(this.root + 12 + n, beat * (Math.random() < 0.3 ? 2 : 1), cfg.instrument);
    }
    if (this.musicStep % 4 === 0 && ['lute', 'harp', 'piano', 'electric_piano', 'marimba', 'lyre'].includes(cfg.instrument)) this.note(this.root + scale[this.chord % scale.length] - 12, beat * 2, cfg.instrument, 0.5);
    this.musicStep++;
    this.musicTimer = window.setTimeout(() => this.tick(), beat * 1000 * 0.5);
  }

  private note(m: number, dur: number, inst: string, vel = 1) {
    const c = this.ctx!;
    const t = c.currentTime + 0.02;
    const f = midi(m);
    const g = c.createGain();
    const out = c.createBiquadFilter(); out.type = 'lowpass';
    g.connect(out); out.connect(this.music);
    const osc = c.createOscillator();
    let attack = 0.01, decay = dur * 1.6, peak = 0.12 * vel;
    switch (inst) {
      case 'flute': case 'recorder': case 'bone_flute':
        osc.type = 'sine'; attack = 0.08; decay = dur * 1.1; peak = 0.09 * vel; out.frequency.value = 3000;
        { const v = c.createOscillator(); v.frequency.value = 5; const vg = c.createGain(); vg.gain.value = f * 0.006; v.connect(vg); vg.connect(osc.frequency); v.start(t); v.stop(t + decay + 0.2); }
        { const n = this.noise(); const nf = c.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = f * 2; const ng = c.createGain(); ng.gain.value = 0.015 * vel; n.connect(nf); nf.connect(ng); ng.connect(out); n.start(t); n.stop(t + 0.12); }
        break;
      case 'marimba': osc.type = 'sine'; decay = 0.5; peak = 0.16 * vel; out.frequency.value = 2000; break;
      case 'piano': case 'electric_piano': osc.type = 'triangle'; decay = dur * 2.4; out.frequency.value = inst === 'piano' ? 2200 : 1600; peak = 0.11 * vel; break;
      case 'synth_pluck': osc.type = 'sawtooth'; decay = 0.4; out.frequency.setValueAtTime(3000, t); out.frequency.exponentialRampToValueAtTime(400, t + 0.3); peak = 0.06 * vel; break;
      case 'glass_pad': osc.type = 'sine'; attack = 0.3; decay = dur * 3; peak = 0.07 * vel; out.frequency.value = 4000; break;
      default: osc.type = 'triangle'; decay = dur * 1.8; out.frequency.setValueAtTime(2600, t); out.frequency.exponentialRampToValueAtTime(700, t + decay); peak = 0.11 * vel; // plucked strings
    }
    osc.frequency.value = f;
    osc.connect(g);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0008, t + attack + decay);
    osc.start(t);
    osc.stop(t + attack + decay + 0.1);
    if (inst === 'marimba' || inst === 'glass_pad') { const o2 = c.createOscillator(); o2.type = 'sine'; o2.frequency.value = f * 4; const g2 = c.createGain(); g2.gain.setValueAtTime(peak * 0.25, t); g2.gain.exponentialRampToValueAtTime(0.0005, t + 0.25); o2.connect(g2); g2.connect(out); o2.start(t); o2.stop(t + 0.3); }
  }

  // ---------------------------------------------------------------- one-shots
  private env(o: AudioNode, t: number, a: number, peak: number, d: number, dest: AudioNode = this.sfx) {
    const g = this.ctx!.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0005, t + a + d);
    o.connect(g); g.connect(dest);
  }
  private tone(freq: number, type: OscillatorType, a: number, d: number, peak: number, glide = 0, dest?: AudioNode) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime;
    const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
    if (glide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * glide), t + a + d);
    this.env(o, t, a, peak, d, dest);
    o.start(t); o.stop(t + a + d + 0.05);
  }
  private burst(freq: number, q: number, d: number, peak: number, type: BiquadFilterType = 'bandpass', dest?: AudioNode) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime;
    const n = this.noise(); const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    n.connect(f); this.env(f, t, 0.005, peak, d, dest);
    n.start(t); n.stop(t + d + 0.05);
  }

  chirp() { if (!this.ctx) return; const f = 2500 + Math.random() * 2000; for (let i = 0; i < 2 + Math.floor(Math.random() * 3); i++) setTimeout(() => this.tone(f * (1 + i * 0.08), 'sine', 0.01, 0.07, 0.03, 1.3, this.amb), i * 90); this.caption('[birdsong]'); }
  gull() { this.tone(1400, 'sawtooth', 0.05, 0.4, 0.015, 0.6, this.amb); }
  cricket() { if (!this.ctx) return; for (let i = 0; i < 6; i++) setTimeout(() => this.tone(4200, 'square', 0.002, 0.03, 0.006, 1, this.amb), i * 40); }
  bell(f: number, v = 0.06) { this.tone(f, 'sine', 0.005, 2.5, v, 1, this.amb); this.tone(f * 2.76, 'sine', 0.005, 1.2, v * 0.3, 1, this.amb); this.caption('[distant bells]'); }
  knock(v = 1) { this.burst(500, 2, 0.08, 0.05 * v, 'bandpass', this.amb); }
  whistle() { this.tone(880, 'square', 0.1, 1.2, 0.02, 0.98, this.amb); this.caption('[train whistle]'); }
  roar(v = 1) { this.burst(180, 0.7, 1.2 * v + 0.3, 0.25 * v); this.tone(70, 'sawtooth', 0.15, 1.1, 0.12 * v, 0.6); this.caption('[a deep roar]'); }

  animalCall(kind: string) {
    switch (kind) {
      case 'moo': case 'moo_low': this.tone(kind === 'moo' ? 160 : 110, 'sawtooth', 0.15, 0.9, 0.05, 0.85); this.caption('[mooing]'); break;
      case 'baa': this.tone(320, 'sawtooth', 0.05, 0.5, 0.04, 0.95); this.caption('[bleating]'); break;
      case 'neigh': case 'neigh_small': this.tone(700, 'sawtooth', 0.05, 0.6, 0.03, 0.6); this.caption('[a horse neighs]'); break;
      case 'bark': this.burst(700, 3, 0.12, 0.08); this.tone(380, 'square', 0.01, 0.12, 0.03, 0.7); this.caption('[a dog barks]'); break;
      case 'cluck': case 'quack': this.tone(kind === 'quack' ? 420 : 600, 'square', 0.005, 0.08, 0.02, 0.8); break;
      case 'trumpet': this.tone(330, 'sawtooth', 0.1, 1.2, 0.05, 1.3); this.caption('[a trumpeting call]'); break;
      case 'roar': case 'roar_big': this.roar(kind === 'roar_big' ? 1.2 : 0.8); break;
      case 'growl': this.tone(90, 'sawtooth', 0.1, 0.8, 0.06, 0.9); this.caption('[growling]'); break;
      case 'howl': this.tone(420, 'sine', 0.4, 1.8, 0.04, 1.4); this.caption('[howling]'); break;
      case 'honk': case 'honk_low': case 'boom': this.tone(kind === 'honk' ? 220 : 110, 'triangle', 0.1, 0.9, 0.06, 0.9); this.caption('[a low call]'); break;
      case 'chirp': case 'chirp_harsh': case 'squawk': case 'screech': case 'call': this.tone(1600, 'sawtooth', 0.02, 0.3, 0.02, 0.6); break;
      case 'beep': case 'whirr': this.tone(1200, 'sine', 0.005, 0.12, 0.03, 1.5); break;
      default: break;
    }
  }

  // Chronometer & UI
  ping(near: number) { this.tone(1500 + near * 900, 'sine', 0.003, 0.18, 0.05 * (0.4 + near * 0.6)); }
  click() { this.tone(900, 'triangle', 0.002, 0.05, 0.04); }
  open() { this.tone(600, 'sine', 0.01, 0.12, 0.05, 1.5); }
  pickup() { [0, 4, 7].forEach((s, i) => setTimeout(() => this.tone(midi(76 + s), 'sine', 0.005, 0.25, 0.06), i * 70)); }
  capture() { [0, 7, 12, 16, 19].forEach((s, i) => setTimeout(() => this.tone(midi(72 + s), 'triangle', 0.005, 0.4, 0.07), i * 60)); this.burst(4000, 1, 0.6, 0.04); this.caption('[the Chronometer chimes]'); }
  returned() { [0, 4, 7, 12].forEach((s, i) => setTimeout(() => this.tone(midi(67 + s), 'sine', 0.01, 0.9, 0.07), i * 120)); }
  blink() { this.tone(2400, 'sine', 0.005, 0.25, 0.05, 0.3); }
  step(surface: string) { this.burst(surface === 'stone' ? 1800 : 700, 1.5, 0.05, 0.02 + Math.random() * 0.01); }
  splash() { this.burst(900, 0.6, 0.6, 0.12, 'lowpass'); this.caption('[splash]'); }
  thud() { this.burst(200, 0.8, 0.25, 0.1, 'lowpass'); }
  camera() { this.burst(3000, 1, 0.06, 0.08); setTimeout(() => this.burst(1800, 1, 0.08, 0.06), 70); }
  translator() { for (let i = 0; i < 6; i++) setTimeout(() => this.tone(500 + Math.random() * 1500, 'square', 0.002, 0.04, 0.015), i * 45); }
  timeTravel() {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime;
    const n = this.noise(); const f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 3;
    f.frequency.setValueAtTime(200, t); f.frequency.exponentialRampToValueAtTime(5000, t + 2.2); f.frequency.exponentialRampToValueAtTime(300, t + 4);
    const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.22, t + 1.2); g.gain.linearRampToValueAtTime(0.0001, t + 4.2);
    n.connect(f); f.connect(g); g.connect(this.sfx); n.start(t); n.stop(t + 4.3);
    for (let i = 0; i < 12; i++) setTimeout(() => this.tone(midi(60 + i * 2), 'sine', 0.01, 0.3, 0.04), i * 180);
    this.caption('[the Chronometer hums and whirls]');
  }
  fanfare() { [0, 4, 7, 12, 7, 12, 16].forEach((s, i) => setTimeout(() => this.tone(midi(64 + s), 'triangle', 0.01, 0.5, 0.07), i * 140)); }
}

function midi(m: number) { return 440 * Math.pow(2, (m - 69) / 12); }

export const audio = new AudioEngine();
