import { TUNING } from '../config/tuning';

/**
 * Gentle procedural audio (Web Audio only, no files).
 * Buses: master -> music (ambience) and sfx (short sounds, with a soft reverb send).
 * The AudioContext is created on the first user gesture (Mobile Safari safe).
 * Every method fails silently when audio is not available.
 */
export type AudioWorld = 'outer' | 'inner';
export type BreathPhase = 'idle' | 'inhale' | 'exhale';

const STORE_KEY = 'tk.audio';
/** Warm pentatonic scale (C major pentatonic, C5..C6). */
const PENTA = [523.25, 587.33, 659.25, 783.99, 880, 1046.5];

interface Saved {
  enabled: boolean;
  volume: number;
}

function load(): Saved {
  const d: Saved = { enabled: true, volume: TUNING.audio.defaultVolume };
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return d;
    const o = JSON.parse(raw) as Partial<Saved>;
    return {
      enabled: typeof o.enabled === 'boolean' ? o.enabled : d.enabled,
      volume: typeof o.volume === 'number' && o.volume >= 0 && o.volume <= 1 ? o.volume : d.volume,
    };
  } catch {
    return d;
  }
}

class AudioSystem {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private music!: GainNode;
  private sfx!: GainNode;
  private reverbIn!: GainNode;
  private noise!: AudioBuffer;
  private windGain!: GainNode;
  private padGain!: GainNode;
  private whooshGain!: GainNode;
  private whooshFilter!: BiquadFilterNode;
  private shimmerGain!: GainNode;
  private shimmerOscs: OscillatorNode[] = [];
  private world: AudioWorld = 'outer';
  private voices = 0;
  private birdTimer = 0;
  private peaked = false;
  private lastPhase: BreathPhase = 'idle';
  private appleCount = 0;
  private lastAppleAt = 0;
  private suspendedByTab = false;
  private saved: Saved = load();

  constructor() {
    if (typeof window === 'undefined') return;
    const unlock = (): void => {
      this.unlock();
      if (this.ctx && this.ctx.state === 'running') {
        for (const ev of ['pointerdown', 'touchend', 'keydown', 'click'])
          window.removeEventListener(ev, unlock, true);
      }
    };
    for (const ev of ['pointerdown', 'touchend', 'keydown', 'click']) window.addEventListener(ev, unlock, true);
    document.addEventListener('visibilitychange', () => this.onVisibility());
    // Very soft tick for calm UI buttons (menu, cards, start, end).
    document.addEventListener('click', (e) => {
      const t = e.target;
      if (t instanceof Element && t.closest('.menu-open,.menu-close,.menu-return,.ec-continue,.start-screen button')) {
        this.tick();
      }
    });
  }

  get enabled(): boolean {
    return this.saved.enabled;
  }
  get volume(): number {
    return this.saved.volume;
  }

  setEnabled(on: boolean): void {
    this.saved.enabled = on;
    this.persist();
    this.applyMaster();
    if (on) this.tick();
  }

  setVolume(v: number): void {
    this.saved.volume = Math.min(1, Math.max(0, v));
    this.persist();
    this.applyMaster();
  }

  private persist(): void {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(this.saved));
    } catch {
      /* private mode: ignore */
    }
  }

  private applyMaster(): void {
    if (!this.ctx) return;
    const target = this.saved.enabled ? this.saved.volume * TUNING.audio.master : 0;
    this.master.gain.setTargetAtTime(target, this.ctx.currentTime, 0.08);
  }

  /** Create the graph inside a user gesture and resume. */
  unlock(): void {
    try {
      if (!this.ctx) this.build();
      const ctx = this.ctx;
      if (ctx && ctx.state !== 'running' && !document.hidden) void ctx.resume().catch(() => undefined);
    } catch {
      this.ctx = null;
    }
  }

  private build(): void {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    const T = TUNING.audio;
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    // A gentle limiter so nothing is ever loud.
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 6;
    this.master.connect(comp).connect(ctx.destination);
    this.music = ctx.createGain();
    this.music.gain.value = T.musicBus;
    this.music.connect(this.master);
    this.sfx = ctx.createGain();
    this.sfx.gain.value = T.sfxBus;
    this.sfx.connect(this.master);

    // Soft reverb: decaying stereo noise impulse.
    const len = Math.floor(ctx.sampleRate * T.reverbSeconds);
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      let last = 0;
      for (let i = 0; i < len; i++) {
        last = last * 0.6 + (Math.random() * 2 - 1) * 0.4;
        d[i] = last * Math.pow(1 - i / len, 2.5);
      }
    }
    const conv = ctx.createConvolver();
    conv.buffer = ir;
    this.reverbIn = ctx.createGain();
    this.reverbIn.gain.value = T.reverbSend;
    const wet = ctx.createGain();
    wet.gain.value = 0.7;
    this.reverbIn.connect(conv).connect(wet).connect(this.master);

    // Shared noise (smooth, brownish).
    const n = ctx.sampleRate * 3;
    this.noise = ctx.createBuffer(1, n, ctx.sampleRate);
    const nd = this.noise.getChannelData(0);
    let b = 0;
    for (let i = 0; i < n; i++) {
      b = b * 0.92 + (Math.random() * 2 - 1) * 0.08;
      nd[i] = b * 3;
    }

    this.buildAmbience(ctx);
    this.buildBreath(ctx);
    this.ctx = ctx;
    this.applyMaster();
    this.applyWorld(true);
    this.scheduleBird();
    this.onVisibility();
  }

  private noiseSrc(ctx: AudioContext): AudioBufferSourceNode {
    const s = ctx.createBufferSource();
    s.buffer = this.noise;
    s.loop = true;
    s.start();
    return s;
  }

  private lfo(ctx: AudioContext, hz: number, depth: number, target: AudioParam): void {
    const o = ctx.createOscillator();
    o.frequency.value = hz;
    const g = ctx.createGain();
    g.gain.value = depth;
    o.connect(g).connect(target);
    o.start();
  }

  private buildAmbience(ctx: AudioContext): void {
    // Wind: filtered noise with slow swells.
    const wf = ctx.createBiquadFilter();
    wf.type = 'bandpass';
    wf.frequency.value = 420;
    wf.Q.value = 0.6;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0;
    this.noiseSrc(ctx).connect(wf).connect(this.windGain).connect(this.music);
    this.lfo(ctx, 0.05, 140, wf.frequency);
    // Slow swell of the wind loudness (added on top of the base level).
    const swell = ctx.createGain();
    swell.gain.value = 0;
    this.lfo(ctx, 0.08, TUNING.audio.windGain * 0.35, swell.gain);
    const sw = ctx.createBiquadFilter();
    sw.type = 'bandpass';
    sw.frequency.value = 600;
    sw.Q.value = 0.5;
    this.noiseSrc(ctx).connect(sw).connect(swell).connect(this.windGain);

    // Inner pad: a soft open chord D2 A2 D3 F#3 A3 with slow movement.
    this.padGain = ctx.createGain();
    this.padGain.gain.value = 0;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 700;
    lp.Q.value = 0.4;
    this.lfo(ctx, 0.03, 220, lp.frequency);
    lp.connect(this.padGain);
    this.padGain.connect(this.music);
    this.padGain.connect(this.reverbIn);
    [73.42, 110, 146.83, 185, 220].forEach((f, i) => {
      for (const det of [-5, 5]) {
        const o = ctx.createOscillator();
        o.type = i < 2 ? 'triangle' : 'sine';
        o.frequency.value = f;
        o.detune.value = det;
        const g = ctx.createGain();
        g.gain.value = i < 2 ? 0.5 : 0.22;
        o.connect(g).connect(lp);
        o.start();
        this.lfo(ctx, 0.04 + i * 0.011, 0.08, g.gain);
      }
    });
  }

  private buildBreath(ctx: AudioContext): void {
    this.whooshFilter = ctx.createBiquadFilter();
    this.whooshFilter.type = 'bandpass';
    this.whooshFilter.Q.value = 0.9;
    this.whooshFilter.frequency.value = 300;
    this.whooshGain = ctx.createGain();
    this.whooshGain.gain.value = 0;
    this.noiseSrc(ctx).connect(this.whooshFilter).connect(this.whooshGain);
    this.whooshGain.connect(this.sfx);
    this.whooshGain.connect(this.reverbIn);
    this.shimmerGain = ctx.createGain();
    this.shimmerGain.gain.value = 0;
    this.shimmerGain.connect(this.sfx);
    this.shimmerGain.connect(this.reverbIn);
    for (const f of [PENTA[3]! * 2, PENTA[5]! * 2]) {
      const o = ctx.createOscillator();
      o.frequency.value = f;
      o.detune.value = 3;
      o.connect(this.shimmerGain);
      o.start();
      this.shimmerOscs.push(o);
    }
  }

  private onVisibility(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    if (document.hidden) {
      this.suspendedByTab = true;
      void ctx.suspend().catch(() => undefined);
    } else if (this.suspendedByTab) {
      this.suspendedByTab = false;
      void ctx.resume().catch(() => undefined);
    }
  }

  /** Crossfade the ambience to a world. */
  setWorld(w: AudioWorld): void {
    this.world = w;
    this.applyWorld(false);
  }

  private applyWorld(instant: boolean): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const T = TUNING.audio;
    const tc = instant ? 0.01 : T.crossfadeS / 3;
    const inner = this.world === 'inner';
    this.windGain.gain.setTargetAtTime(inner ? T.windGain * 0.25 : T.windGain, ctx.currentTime, tc);
    this.padGain.gain.setTargetAtTime(inner ? T.padGain : 0, ctx.currentTime, tc);
  }

  private scheduleBird(): void {
    const T = TUNING.audio;
    const gap = T.birdGapMin + Math.random() * (T.birdGapMax - T.birdGapMin);
    this.birdTimer = window.setTimeout(() => {
      if (this.world === 'outer' && this.running()) this.bird();
      this.scheduleBird();
    }, gap * 1000);
  }

  private running(): boolean {
    return !!this.ctx && this.ctx.state === 'running' && this.saved.enabled;
  }

  /** A short distant bird: two or three soft rising chirps. */
  private bird(): void {
    const ctx = this.ctx;
    if (!ctx || this.voices >= TUNING.audio.maxVoices) return;
    const base = 2400 + Math.random() * 1200;
    const n = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < n; i++) {
      const t = ctx.currentTime + 0.02 + i * 0.16;
      this.voice((o, g) => {
        o.type = 'sine';
        o.frequency.setValueAtTime(base, t);
        o.frequency.exponentialRampToValueAtTime(base * 1.25, t + 0.09);
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(TUNING.audio.birdGain, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
        return t + 0.15;
      }, this.music, true);
    }
  }

  /** One oscillator voice with cap and clean-up. build() returns the stop time. */
  private voice(
    build: (o: OscillatorNode, g: GainNode) => number,
    bus: GainNode,
    reverb: boolean,
  ): void {
    const ctx = this.ctx;
    if (!ctx || !this.running() || this.voices >= TUNING.audio.maxVoices) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    const stop = build(o, g);
    o.connect(g).connect(bus);
    if (reverb) g.connect(this.reverbIn);
    this.voices++;
    o.onended = () => {
      this.voices--;
      o.disconnect();
      g.disconnect();
    };
    o.start();
    o.stop(stop + 0.05);
  }

  /** Soft sine bell/pluck with an optional quiet overtone. */
  private note(freq: number, delay: number, len: number, gain: number, over = 0, type: OscillatorType = 'sine'): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    const make = (f: number, a: number, l: number): void =>
      this.voice((o, g) => {
        o.type = type;
        o.frequency.value = f;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(a, t + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, t + l);
        return t + l;
      }, this.sfx, true);
    make(freq, gain * TUNING.audio.sfxGain, len);
    if (over > 0) make(freq * 2.76, gain * TUNING.audio.sfxGain * over, len * 0.35);
  }

  /** Airy noise burst through a sweeping band filter. */
  private air(from: number, to: number, delay: number, len: number, gain: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.running() || this.voices >= TUNING.audio.maxVoices) return;
    const t = ctx.currentTime + delay;
    const s = ctx.createBufferSource();
    s.buffer = this.noise;
    s.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 0.8;
    f.frequency.setValueAtTime(from, t);
    f.frequency.exponentialRampToValueAtTime(to, t + len);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + len * 0.45);
    g.gain.linearRampToValueAtTime(0, t + len);
    s.connect(f).connect(g).connect(this.sfx);
    g.connect(this.reverbIn);
    this.voices++;
    s.onended = () => {
      this.voices--;
      s.disconnect();
      g.disconnect();
    };
    s.start(t);
    s.stop(t + len + 0.05);
  }

  /** Call every frame with the shown world's breath. Drives whoosh, shimmer, peak chime. */
  breath(phase: BreathPhase, level: number): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const T = TUNING.audio;
    const now = ctx.currentTime;
    const active = phase !== 'idle' && level > 0.01;
    const whoosh = active ? T.breathWhooshGain * (phase === 'inhale' ? 1 : 0.7) * (0.35 + 0.65 * level) : 0;
    this.whooshGain.gain.setTargetAtTime(whoosh, now, 0.12);
    this.whooshFilter.frequency.setTargetAtTime(280 + level * 1500, now, 0.1);
    this.shimmerGain.gain.setTargetAtTime(level > 0.05 ? T.breathShimmerGain * level * level : 0, now, 0.15);
    for (const o of this.shimmerOscs) o.detune.setTargetAtTime(3 + level * 12, now, 0.2);
    if (level >= 0.97 && !this.peaked) {
      this.peaked = true;
      this.note(PENTA[5]! * 2, 0, 1.6, 0.8, 0.25);
    } else if (level < 0.5) {
      this.peaked = false;
    }
    this.lastPhase = phase;
  }

  // ---- Named sounds ----

  /** Soft button tick. */
  tick(): void {
    this.note(1320, 0, 0.09, 0.35, 0, 'triangle');
  }

  /** A thought card appears: soft bell. */
  cardPop(): void {
    this.note(PENTA[4]!, 0, 1.3, 0.8, 0.2);
    this.note(PENTA[2]! * 2, 0.07, 1.0, 0.4);
  }

  /** Push away: low muffled thump. */
  push(): void {
    this.note(92, 0, 0.55, 1.1, 0, 'sine');
    this.note(64, 0.02, 0.7, 0.9, 0, 'sine');
    this.air(300, 120, 0, 0.35, 0.05);
  }

  /** Breathe choice: warm chime. */
  breatheChoice(): void {
    this.note(PENTA[2]!, 0, 1.8, 0.9, 0.15);
    this.note(PENTA[4]!, 0.1, 1.8, 0.7, 0.15);
  }

  /** Apple pickup: little wooden pluck, rising per apple (resets after a pause). */
  apple(): void {
    const t = performance.now();
    if (t - this.lastAppleAt > 20000) this.appleCount = 0;
    this.lastAppleAt = t;
    const f = PENTA[Math.min(this.appleCount, PENTA.length - 1)]! * 0.5;
    this.appleCount++;
    this.note(f, 0, 0.5, 1.0, 0, 'triangle');
    this.note(f * 4, 0, 0.12, 0.35);
  }

  /** Basket complete: small three-note arpeggio. */
  basket(): void {
    [PENTA[0]!, PENTA[2]!, PENTA[3]!].forEach((f, i) => {
      this.note(f, 0.25 + i * 0.16, 1.4, 0.9, 0.1);
    });
    this.appleCount = 0;
  }

  /** Look within / go outside: soft swell. */
  swell(): void {
    this.air(250, 1400, 0, 1.4, 0.07);
    this.air(1400, 300, 1.3, 1.6, 0.05);
    this.note(PENTA[1]! * 0.5, 0.5, 2.2, 0.5);
  }

  /** Imp is calm: warm chord. */
  impCalm(): void {
    [PENTA[0]! * 0.5, PENTA[2]! * 0.5, PENTA[3]! * 0.5, PENTA[0]!].forEach((f, i) => {
      this.note(f, i * 0.12, 3.2 - i * 0.3, 0.9, 0.08);
    });
  }

  /** Lantern relit / hung on the tree: gentle bell chord. */
  lanternBells(): void {
    [PENTA[0]!, PENTA[2]!, PENTA[4]!, PENTA[5]!].forEach((f, i) => {
      this.note(f, i * 0.2, 2.6, 0.8, 0.2);
    });
  }

  /** For checks. */
  state(): Record<string, unknown> {
    return {
      ctx: this.ctx ? this.ctx.state : 'none',
      enabled: this.saved.enabled,
      volume: this.saved.volume,
      world: this.world,
      voices: this.voices,
      masterGain: this.ctx ? +this.master.gain.value.toFixed(3) : 0,
      wind: this.ctx ? +this.windGain.gain.value.toFixed(3) : 0,
      pad: this.ctx ? +this.padGain.gain.value.toFixed(3) : 0,
      breathPhase: this.lastPhase,
      birdTimer: this.birdTimer > 0,
    };
  }
}

export const audio = new AudioSystem();
