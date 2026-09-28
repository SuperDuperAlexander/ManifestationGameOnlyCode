import type { CueId, EventBus } from '../core/events';
import { clamp01 } from '../core/math';

/**
 * All sound is generated with the Web Audio API. There are no audio files.
 * Audio starts only after the first user interaction, as browsers require.
 */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private padGain: GainNode | null = null;
  private padFilter: BiquadFilterNode | null = null;
  private breathGain: GainNode | null = null;
  private breathFilter: BiquadFilterNode | null = null;
  private droneGain: GainNode | null = null;
  private weatherGain: GainNode | null = null;
  private weatherFilter: BiquadFilterNode | null = null;
  private nightGain: GainNode | null = null;
  private cricketGain: GainNode | null = null;
  private muffle: BiquadFilterNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private started = false;
  private volume = 0.7;
  private muted = false;

  constructor(private readonly bus: EventBus) {
    bus.on('cue', ({ id }) => this.cue(id));
  }

  get isRunning(): boolean {
    return this.started && this.ctx?.state === 'running';
  }

  /**
   * Browsers suspend an audio context when the page is hidden, and on iOS it
   * does not always come back on its own. Call this when the page is shown
   * again. It does nothing if audio was never started.
   */
  resume(): void {
    if (!this.started || !this.ctx) return;
    if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => undefined);
  }

  /** Call this from a real user gesture. */
  async start(): Promise<void> {
    if (this.started) {
      await this.ctx?.resume();
      return;
    }
    type WithWebkit = typeof globalThis & { webkitAudioContext?: typeof AudioContext };
    const Ctor = window.AudioContext ?? (globalThis as WithWebkit).webkitAudioContext;
    if (!Ctor) return;
    this.started = true;
    const ctx = new Ctor();
    this.ctx = ctx;
    await ctx.resume().catch(() => undefined);

    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : this.volume;

    // Everything runs through one filter so the fog can muffle the whole mix.
    this.muffle = ctx.createBiquadFilter();
    this.muffle.type = 'lowpass';
    this.muffle.frequency.value = 20000;
    this.master.connect(this.muffle);
    this.muffle.connect(ctx.destination);

    this.noiseBuffer = this.makeNoise(ctx, 4);
    this.buildPad(ctx);
    this.buildBreath(ctx);
    this.buildDrone(ctx);
    this.buildWeather(ctx);
    this.buildNight(ctx);
  }

  private makeNoise(ctx: AudioContext, seconds: number): AudioBuffer {
    const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      // Slightly brown noise. It sounds softer than white noise.
      last = (last + (Math.random() * 2 - 1) * 0.04) * 0.985;
      data[i] = last * 4;
    }
    return buffer;
  }

  /** A soft evolving pad. It gets warmer as colour returns to the valley. */
  private buildPad(ctx: AudioContext): void {
    if (!this.master) return;
    this.padGain = ctx.createGain();
    this.padGain.gain.value = 0.1;
    this.padFilter = ctx.createBiquadFilter();
    this.padFilter.type = 'lowpass';
    this.padFilter.frequency.value = 520;
    this.padFilter.Q.value = 0.6;
    this.padGain.connect(this.padFilter);
    this.padFilter.connect(this.master);

    // A quiet open chord, each voice drifting a little.
    for (const [freq, detune] of [
      [110, 0],
      [164.81, 4],
      [220, -5],
      [329.63, 7],
    ] as const) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      osc.detune.value = detune;
      const g = ctx.createGain();
      g.gain.value = 0.25;
      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 0.04 + Math.random() * 0.06;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 0.16;
      lfo.connect(lfoGain);
      lfoGain.connect(g.gain);
      osc.connect(g);
      g.connect(this.padGain);
      osc.start();
      lfo.start();
    }
  }

  /** Filtered noise that rises on the in-breath and falls on the out-breath. */
  private buildBreath(ctx: AudioContext): void {
    if (!this.master || !this.noiseBuffer) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    this.breathFilter = ctx.createBiquadFilter();
    this.breathFilter.type = 'bandpass';
    this.breathFilter.frequency.value = 500;
    this.breathFilter.Q.value = 1.1;
    this.breathGain = ctx.createGain();
    this.breathGain.gain.value = 0;
    src.connect(this.breathFilter);
    this.breathFilter.connect(this.breathGain);
    this.breathGain.connect(this.master);
    src.start();
  }

  /** The low drone the fog gives off. */
  private buildDrone(ctx: AudioContext): void {
    if (!this.master) return;
    this.droneGain = ctx.createGain();
    this.droneGain.gain.value = 0;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 180;
    this.droneGain.connect(filter);
    filter.connect(this.master);
    for (const freq of [55, 58.27, 82.41]) {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.value = 0.3;
      osc.connect(g);
      g.connect(this.droneGain);
      osc.start();
    }
  }

  /**
   * The sound a weather makes while the player stands in it.
   *
   * One filtered noise layer covers all three: rain is a wide band low down,
   * the storm's wind is lower still, and the worry whisper sits high. They
   * are one layer rather than three because the player is only ever standing
   * in one weather, and a layer that is silent still costs a filter.
   */
  private buildWeather(ctx: AudioContext): void {
    if (!this.master || !this.noiseBuffer) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    this.weatherFilter = ctx.createBiquadFilter();
    this.weatherFilter.type = 'bandpass';
    this.weatherFilter.frequency.value = 900;
    this.weatherFilter.Q.value = 0.7;
    this.weatherGain = ctx.createGain();
    this.weatherGain.gain.value = 0;
    src.connect(this.weatherFilter);
    this.weatherFilter.connect(this.weatherGain);
    this.weatherGain.connect(this.master);
    src.start();
  }

  /**
   * Night: a low pad, and crickets.
   *
   * The crickets are a narrow band of noise with a fast wobble on it, which is
   * near enough at this volume and costs two nodes instead of a scheduler
   * chirping away all night.
   */
  private buildNight(ctx: AudioContext): void {
    if (!this.master || !this.noiseBuffer) return;
    this.nightGain = ctx.createGain();
    this.nightGain.gain.value = 0;
    const low = ctx.createBiquadFilter();
    low.type = 'lowpass';
    low.frequency.value = 300;
    this.nightGain.connect(low);
    low.connect(this.master);
    for (const freq of [73.42, 110, 146.83]) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.value = 0.3;
      osc.connect(g);
      g.connect(this.nightGain);
      osc.start();
    }

    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 4200;
    band.Q.value = 22;
    this.cricketGain = ctx.createGain();
    this.cricketGain.gain.value = 0;
    // The chirp: a fast wobble on the gain, so it pulses rather than hisses.
    const wobble = ctx.createOscillator();
    wobble.type = 'square';
    wobble.frequency.value = 7.5;
    const wobbleGain = ctx.createGain();
    wobbleGain.gain.value = 0.5;
    wobble.connect(wobbleGain);
    wobbleGain.connect(this.cricketGain.gain);
    src.connect(band);
    band.connect(this.cricketGain);
    this.cricketGain.connect(this.master);
    src.start();
    wobble.start();
  }

  /**
   * How loud the weather is, and which one it is.
   * @param kind which weather the player is standing in
   * @param amount 0 far away or gone, 1 right inside it
   */
  setWeather(kind: 'none' | 'rain' | 'storm' | 'whisper', amount: number): void {
    if (!this.ctx || !this.weatherGain || !this.weatherFilter) return;
    const now = this.ctx.currentTime;
    const a = clamp01(amount);
    const centre = kind === 'storm' ? 220 : kind === 'whisper' ? 2600 : 950;
    const q = kind === 'whisper' ? 1.6 : 0.7;
    // The storm's wind is the one that can be turned down in settings.
    const loud = kind === 'storm' || kind === 'whisper' ? this.stormVolume : 1;
    const level = kind === 'none' ? 0 : a * 0.075 * loud;
    this.weatherGain.gain.setTargetAtTime(level, now, 0.5);
    this.weatherFilter.frequency.setTargetAtTime(centre, now, 0.6);
    this.weatherFilter.Q.setTargetAtTime(q, now, 0.6);
  }

  /** 0 day, 1 night. The pad and the crickets come up together. */
  setNightAmbience(amount: number): void {
    if (!this.ctx || !this.nightGain || !this.cricketGain) return;
    const now = this.ctx.currentTime;
    const a = clamp01(amount);
    this.nightGain.gain.setTargetAtTime(a * 0.07, now, 1.2);
    this.cricketGain.gain.setTargetAtTime(a * 0.014, now, 1.5);
  }

  setVolume(v: number): void {
    this.volume = clamp01(v);
    if (this.master) this.master.gain.value = this.muted ? 0 : this.volume;
  }

  setMuted(on: boolean): void {
    this.muted = on;
    if (this.master) this.master.gain.value = on ? 0 : this.volume;
  }

  /**
   * Drives the continuous sounds each frame.
   * @param breath 0 to 1, how full the breath is
   * @param inhaling whether the player is breathing in
   * @param warmth 0 to 1, how much colour has returned
   * @param drone 0 to 1, how close the fog is
   * @param muffle 0 to 1, how muffled the mix should be
   */
  update(breath: number, inhaling: boolean, warmth: number, drone: number, muffle: number): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (this.breathGain && this.breathFilter) {
      this.breathGain.gain.setTargetAtTime(breath * 0.09, now, 0.12);
      // The filter rises on the in-breath and falls on the out-breath.
      const target = inhaling ? 320 + breath * 900 : 240 + breath * 420;
      this.breathFilter.frequency.setTargetAtTime(target, now, 0.15);
    }
    if (this.padFilter) this.padFilter.frequency.setTargetAtTime(460 + warmth * 1500, now, 0.5);
    if (this.padGain) this.padGain.gain.setTargetAtTime(0.09 + warmth * 0.06, now, 0.5);
    if (this.droneGain) this.droneGain.gain.setTargetAtTime(drone * 0.22, now, 0.4);
    if (this.muffle) this.muffle.frequency.setTargetAtTime(20000 - muffle * 19200, now, 0.3);
  }

  /** One-shot sounds. Every important cue is audio as well as visual. */
  cue(id: CueId): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;
    const now = ctx.currentTime;
    switch (id) {
      case 'calmBreath':
        this.bell(now, 528, 0.1, 2.2);
        this.bell(now + 0.03, 792, 0.045, 1.7);
        break;
      case 'mote':
        this.bell(now, 880 + Math.random() * 260, 0.05, 0.9);
        break;
      case 'spring':
        this.shimmer(now, 1.6);
        break;
      case 'push':
        this.thud(now);
        break;
      case 'fogEnter':
        this.bell(now, 138, 0.09, 2.4);
        break;
      case 'fogExit':
        this.shimmer(now, 2.4);
        this.bell(now + 0.1, 440, 0.09, 2.6);
        break;
      case 'seedGrow':
        for (let i = 0; i < 4; i++) this.bell(now + i * 0.13, 330 * Math.pow(1.18, i), 0.055, 1.1);
        break;
      case 'bridgeDone':
        for (const f of [261.6, 329.6, 392, 523.3]) this.bell(now, f, 0.075, 3.4);
        break;
      case 'thanks':
        for (const [i, f] of [392, 523.3, 659.3, 784].entries())
          this.bell(now + i * 0.18, f, 0.08, 4);
        break;
      case 'uiSelect':
        this.bell(now, 660, 0.04, 0.5);
        break;
      case 'soundBreath':
        // The first time the stone answers: the hum and one clear note.
        this.bell(now, 196, 0.08, 3.2);
        this.bell(now + 0.25, 392, 0.07, 2.8);
        break;
      case 'stoneHum':
        this.bell(now, 98, 0.07, 4.5);
        this.bell(now, 196, 0.03, 4);
        break;
      case 'stoneLit':
        this.bell(now, 440, 0.07, 1.8);
        this.bell(now + 0.06, 660, 0.04, 1.4);
        break;
      case 'rain':
        this.hiss(now, 2.6, 900, 0.05);
        break;
      case 'thunder':
        this.rumble(now);
        break;
      case 'whisper':
        this.hiss(now, 1.8, 2600, 0.035);
        break;
      case 'rainbow':
        for (const [i, f] of [523.3, 659.3, 784, 1046.5].entries())
          this.bell(now + i * 0.14, f, 0.055, 2.6);
        break;
      case 'night':
        this.bell(now, 174.6, 0.07, 5);
        this.bell(now + 0.4, 261.6, 0.05, 4.4);
        break;
    }
  }

  private bell(at: number, freq: number, gain: number, decay: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(gain, at + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, at + decay);
    osc.connect(g);
    g.connect(this.master);
    osc.start(at);
    osc.stop(at + decay + 0.05);
  }

  /** A gentle water shimmer. */
  private shimmer(at: number, length: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.master || !this.noiseBuffer) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(900, at);
    filter.frequency.linearRampToValueAtTime(2400, at + length * 0.6);
    filter.Q.value = 3.5;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(0.12, at + 0.2);
    g.gain.exponentialRampToValueAtTime(0.0001, at + length);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    src.start(at);
    src.stop(at + length + 0.05);
  }

  /**
   * One note of the sound breath. It is a single soft sine with a slow swell,
   * so a row of them sounds like one voice rather than a keyboard.
   */
  tone(hz: number, seconds: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const at = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = hz;
    const fifth = ctx.createOscillator();
    fifth.type = 'sine';
    fifth.frequency.value = hz * 1.5;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(0.1, at + seconds * 0.25);
    g.gain.exponentialRampToValueAtTime(0.0001, at + seconds);
    const gq = ctx.createGain();
    gq.gain.value = 0.35;
    osc.connect(g);
    fifth.connect(gq);
    gq.connect(g);
    g.connect(this.master);
    osc.start(at);
    fifth.start(at);
    osc.stop(at + seconds + 0.05);
    fifth.stop(at + seconds + 0.05);
  }

  /**
   * Filtered noise: rain when it is low, the worry whisper when it is high.
   */
  private hiss(at: number, length: number, centre: number, gain: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.master || !this.noiseBuffer) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = centre;
    filter.Q.value = 0.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(gain * this.stormVolume, at + length * 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, at + length);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    src.start(at);
    src.stop(at + length + 0.05);
  }

  /**
   * Low thunder. A rumble only, never a crack: a sharp sound would make the
   * storm a threat, and the storm is a feeling.
   */
  private rumble(at: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.master || !this.noiseBuffer) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(140, at);
    filter.frequency.linearRampToValueAtTime(60, at + 2.4);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, at);
    // A slow swell, so it arrives rather than hits.
    g.gain.linearRampToValueAtTime(0.16 * this.stormVolume, at + 0.9);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 3);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    src.start(at);
    src.stop(at + 3.1);
  }

  /**
   * "Soft storm sounds" in settings. Thunder and the worry whisper are the
   * two sounds in the game somebody might not want at full strength.
   */
  private stormVolume = 1;

  setSoftStorm(on: boolean): void {
    this.stormVolume = on ? 0.35 : 1;
  }

  /** A dull thud for the push that never works. */
  private thud(at: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, at);
    osc.frequency.exponentialRampToValueAtTime(48, at + 0.28);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.16, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.34);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 260;
    osc.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    osc.start(at);
    osc.stop(at + 0.4);
  }

  dispose(): void {
    void this.ctx?.close();
    this.ctx = null;
    this.started = false;
    void this.bus;
  }
}
